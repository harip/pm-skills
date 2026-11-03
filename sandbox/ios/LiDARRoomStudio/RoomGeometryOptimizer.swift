// sandbox/ios/LiDARRoomStudio/RoomGeometryOptimizer.swift
// Orthogonal-Manhattan Topological Loop Closure (OM-TLC) Native Swift Engine.
// Clean-room implementation derived from peer-reviewed academic SLAM literature:
// - Dai et al. (BundleFusion)
// - Zhang et al. (Compact Pose Graphs)
// - Fan et al. (MIT Certifiable PGO)
// - Li et al. (Structure-SLAM)

import Foundation
import simd

public struct Point2D {
    public var x: Double
    public var z: Double

    public init(x: Double, z: Double) {
        self.x = x
        self.z = z
    }

    public var simd: SIMD2<Double> {
        return SIMD2<Double>(x, z)
    }

    public func distance(to other: Point2D) -> Double {
        return simd_distance(self.simd, other.simd)
    }
}

public struct RawSegment {
    public var p1: Point2D
    public var p2: Point2D
    public var label: String

    public init(p1: Point2D, p2: Point2D, label: String = "") {
        self.p1 = p1
        self.p2 = p2
        self.label = label
    }

    public var length: Double {
        return p1.distance(to: p2)
    }

    public var angle: Double {
        return atan2(p2.z - p1.z, p2.x - p1.x)
    }

    public var midpoint: Point2D {
        return Point2D(x: (p1.x + p2.x) / 2.0, z: (p1.z + p2.z) / 2.0)
    }
}

public enum WallClassification: String {
    case orthogonal = "ORTHOGONAL"
    case bay45 = "BAY_45"
    case custom = "CUSTOM"
}

public struct SnappedWall {
    public var raw: RawSegment
    public var snappedAngle: Double
    public var classification: WallClassification
    public var A: Double
    public var B: Double
    public var C: Double

    public init(raw: RawSegment, snappedAngle: Double, classification: WallClassification, A: Double, B: Double, C: Double) {
        self.raw = raw
        self.snappedAngle = snappedAngle
        self.classification = classification
        self.A = A
        self.B = B
        self.C = C
    }
}

public struct OptimizerResult {
    public var dominantOrientationDeg: Double
    public var snappedWalls: [SnappedWall]
    public var closedPolygon: [Point2D]
    public var isWatertight: Bool
    public var loopClosingGapFt: Double
    public var areaSqFt: Double
    public var perimeterFt: Double

    public init(
        dominantOrientationDeg: Double,
        snappedWalls: [SnappedWall],
        closedPolygon: [Point2D],
        isWatertight: Bool,
        loopClosingGapFt: Double,
        areaSqFt: Double,
        perimeterFt: Double
    ) {
        self.dominantOrientationDeg = dominantOrientationDeg
        self.snappedWalls = snappedWalls
        self.closedPolygon = closedPolygon
        self.isWatertight = isWatertight
        self.loopClosingGapFt = loopClosingGapFt
        self.areaSqFt = areaSqFt
        self.perimeterFt = perimeterFt
    }
}

public final class RoomGeometryOptimizer {

    public static func normalizeAngle(_ angle: Double) -> Double {
        var a = angle
        while a > .pi { a -= 2.0 * .pi }
        while a < -.pi { a += 2.0 * .pi }
        return a
    }

    /// Length-weighted modulo-90 circular mean for dominant structural orientation.
    public static func computeDominantOrientation(segments: [RawSegment]) -> Double {
        var sumSin = 0.0
        var sumCos = 0.0
        var totalLen = 0.0

        for seg in segments {
            let length = seg.length
            if length < 1e-4 { continue }
            let theta4 = 4.0 * seg.angle
            sumSin += length * sin(theta4)
            sumCos += length * cos(theta4)
            totalLen += length
        }

        if totalLen < 1e-4 { return 0.0 }
        let thetaDom4 = atan2(sumSin, sumCos)
        return thetaDom4 / 4.0
    }

    /// Dual-threshold angular quantization with hysteresis.
    public static func quantizeWallOrientations(
        segments: [RawSegment],
        domAngle: Double,
        tauOrthoDeg: Double = 7.5,
        tauBayDeg: Double = 4.0
    ) -> [SnappedWall] {
        let tauOrtho = tauOrthoDeg * .pi / 180.0
        let tauBay = tauBayDeg * .pi / 180.0
        var snapped: [SnappedWall] = []

        for seg in segments {
            let rawAngle = seg.angle
            let relAngle = normalizeAngle(rawAngle - domAngle)

            // Nearest orthogonal axis (0, 90, 180, 270)
            let k = round(relAngle / (.pi / 2.0))
            let targetOrthoRel = k * (.pi / 2.0)
            let distOrtho = abs(normalizeAngle(relAngle - targetOrthoRel))

            // Nearest 45-degree semi-Manhattan axis (45, 135, 225, 315)
            let relMinus45 = relAngle - (.pi / 4.0)
            let m = round(relMinus45 / (.pi / 2.0))
            let targetBayRel = m * (.pi / 2.0) + (.pi / 4.0)
            let distBay = abs(normalizeAngle(relAngle - targetBayRel))

            let snappedAngle: Double
            let classification: WallClassification

            if distOrtho <= tauOrtho {
                snappedAngle = normalizeAngle(targetOrthoRel + domAngle)
                classification = .orthogonal
            } else if distBay <= tauBay {
                snappedAngle = normalizeAngle(targetBayRel + domAngle)
                classification = .bay45
            } else {
                snappedAngle = rawAngle
                classification = .custom
            }

            // Line equation: A*x + B*z + C = 0
            let A = -sin(snappedAngle)
            let B = cos(snappedAngle)
            let mid = seg.midpoint
            let C = -(A * mid.x + B * mid.z)

            snapped.append(SnappedWall(
                raw: seg,
                snappedAngle: snappedAngle,
                classification: classification,
                A: A,
                B: B,
                C: C
            ))
        }

        return snapped
    }

    /// Fuses collinear adjacent wall fragments (LiDAR dropout repair).
    public static func fuseCollinearWalls(walls: [SnappedWall], gapTolFt: Double = 0.25) -> [SnappedWall] {
        guard walls.count > 1 else { return walls }

        var fused: [SnappedWall] = []
        var i = 0
        let N = walls.count

        while i < N {
            var current = walls[i]
            if i + 1 < N {
                let nxt = walls[i + 1]
                let dot = current.A * nxt.A + current.B * nxt.B
                let isParallel = abs(dot) >= 1.0 - 1e-4
                let isCoplanar = abs(current.C - (dot > 0 ? nxt.C : -nxt.C)) <= gapTolFt

                if isParallel && isCoplanar {
                    let mergedRaw = RawSegment(p1: current.raw.p1, p2: nxt.raw.p2, label: "\(current.raw.label)+fused")
                    let mid = mergedRaw.midpoint
                    let A = current.A
                    let B = current.B
                    let C = -(A * mid.x + B * mid.z)
                    current = SnappedWall(
                        raw: mergedRaw,
                        snappedAngle: current.snappedAngle,
                        classification: current.classification,
                        A: A,
                        B: B,
                        C: C
                    )
                    i += 1
                }
            }
            fused.append(current)
            i += 1
        }

        return fused
    }

    /// Exact line-line intersection with near-collinear singularity guard.
    public static func intersectLines(w1: SnappedWall, w2: SnappedWall, epsilon: Double = 1e-4) -> Point2D {
        let A1 = w1.A, B1 = w1.B, C1 = w1.C
        let A2 = w2.A, B2 = w2.B, C2 = w2.C

        let det = A1 * B2 - A2 * B1

        if abs(det) >= epsilon {
            let x = (B1 * C2 - B2 * C1) / det
            let z = (A2 * C1 - A1 * C2) / det
            return Point2D(x: x, z: z)
        } else {
            // Near-collinear singularity guard: return midpoint to avoid infinity
            let pRaw1 = w1.raw.p2
            let pRaw2 = w2.raw.p1
            return Point2D(x: (pRaw1.x + pRaw2.x) / 2.0, z: (pRaw1.z + pRaw2.z) / 2.0)
        }
    }

    /// Shoelace polygon area calculation.
    public static func computePolygonArea(points: [Point2D]) -> Double {
        let n = points.count
        guard n >= 3 else { return 0.0 }
        var area = 0.0
        for i in 0..<n {
            let j = (i + 1) % n
            area += points[i].x * points[j].z
            area -= points[j].x * points[i].z
        }
        return abs(area) / 2.0
    }

    /// Perimeter calculation.
    public static func computePolygonPerimeter(points: [Point2D]) -> Double {
        let n = points.count
        guard n >= 2 else { return 0.0 }
        var perim = 0.0
        for i in 0..<n {
            let j = (i + 1) % n
            perim += points[i].distance(to: points[j])
        }
        return perim
    }

    /// Master solver entry point.
    public static func solve(
        segments: [RawSegment],
        isClosed: Bool = true,
        fuseCollinear: Bool = true
    ) -> OptimizerResult {
        guard !segments.isEmpty else {
            return OptimizerResult(
                dominantOrientationDeg: 0.0,
                snappedWalls: [],
                closedPolygon: [],
                isWatertight: false,
                loopClosingGapFt: 0.0,
                areaSqFt: 0.0,
                perimeterFt: 0.0
            )
        }

        let rawClosingGap = isClosed ? segments.last!.p2.distance(to: segments.first!.p1) : 0.0
        let domAngleRad = computeDominantOrientation(segments: segments)
        let domAngleDeg = domAngleRad * 180.0 / .pi

        var snapped = quantizeWallOrientations(segments: segments, domAngle: domAngleRad)

        if fuseCollinear {
            snapped = fuseCollinearWalls(walls: snapped)
        }

        let N = snapped.count
        var vertices: [Point2D] = []

        if isClosed && N >= 3 {
            for i in 0..<N {
                let wCurr = snapped[i]
                let wNext = snapped[(i + 1) % N]
                let corner = intersectLines(w1: wCurr, w2: wNext)
                vertices.append(corner)
            }
        } else {
            for i in 0..<(N - 1) {
                let corner = intersectLines(w1: snapped[i], w2: snapped[i + 1])
                vertices.append(corner)
            }
        }

        let area = isClosed ? computePolygonArea(points: vertices) : 0.0
        let perimeter = computePolygonPerimeter(points: vertices)

        return OptimizerResult(
            dominantOrientationDeg: domAngleDeg,
            snappedWalls: snapped,
            closedPolygon: vertices,
            isWatertight: isClosed && (vertices.count >= 3),
            loopClosingGapFt: isClosed ? 0.0 : rawClosingGap,
            areaSqFt: area,
            perimeterFt: perimeter
        )
    }
}
