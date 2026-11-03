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

    /// Global duplicate wall de-duplication (fuses multi-pass scans of the same physical wall)
    public static func deduplicateOverlappingWalls(segments: [RawSegment], maxDist: Double = 3.5) -> [RawSegment] {
        guard segments.count > 1 else { return segments }
        var result: [RawSegment] = []
        var merged = Set<Int>()

        var cX = 0.0
        var cZ = 0.0
        for s in segments {
            cX += (s.p1.x + s.p2.x) / 2.0
            cZ += (s.p1.z + s.p2.z) / 2.0
        }
        let centroidX = cX / Double(segments.count)
        let centroidZ = cZ / Double(segments.count)

        for i in 0..<segments.count {
            if merged.contains(i) { continue }
            var s1 = segments[i]
            var len1 = s1.length
            guard len1 > 0.001 else { continue }
            var ux = (s1.p2.x - s1.p1.x) / len1
            var uz = (s1.p2.z - s1.p1.z) / len1
            var nx = -uz
            var nz = ux

            for j in (i + 1)..<segments.count {
                if merged.contains(j) { continue }
                let s2 = segments[j]
                let len2 = s2.length
                guard len2 > 0.001 else { continue }
                let ux2 = (s2.p2.x - s2.p1.x) / len2
                let uz2 = (s2.p2.z - s2.p1.z) / len2

                let dot = ux * ux2 + uz * uz2
                if abs(dot) >= cos(30.0 * .pi / 180.0) {
                    let mid1x = (s1.p1.x + s1.p2.x) / 2.0
                    let mid1z = (s1.p1.z + s1.p2.z) / 2.0
                    let mid2x = (s2.p1.x + s2.p2.x) / 2.0
                    let mid2z = (s2.p1.z + s2.p2.z) / 2.0
                    let perpDist = abs(nx * (mid2x - s1.p1.x) + nz * (mid2z - s1.p1.z))

                    let t2_p1 = ux * (s2.p1.x - s1.p1.x) + uz * (s2.p1.z - s1.p1.z)
                    let t2_p2 = ux * (s2.p2.x - s1.p1.x) + uz * (s2.p2.z - s1.p1.z)
                    let minT2 = min(t2_p1, t2_p2)
                    let maxT2 = max(t2_p1, t2_p2)

                    let hasOverlap = (minT2 <= len1 + 2.0) && (maxT2 >= -2.0)

                    if perpDist <= maxDist && hasOverlap {
                        let d1 = hypot(mid1x - centroidX, mid1z - centroidZ)
                        let d2 = hypot(mid2x - centroidX, mid2z - centroidZ)
                        let baseSeg = d2 > d1 ? s2 : s1
                        let otherSeg = d2 > d1 ? s1 : s2

                        let bLen = baseSeg.length
                        let bux = (baseSeg.p2.x - baseSeg.p1.x) / bLen
                        let buz = (baseSeg.p2.z - baseSeg.p1.z) / bLen

                        let to_p1 = bux * (otherSeg.p1.x - baseSeg.p1.x) + buz * (otherSeg.p1.z - baseSeg.p1.z)
                        let to_p2 = bux * (otherSeg.p2.x - baseSeg.p1.x) + buz * (otherSeg.p2.z - baseSeg.p1.z)
                        let minT = min(0.0, min(to_p1, to_p2))
                        let maxT = max(bLen, max(to_p1, to_p2))

                        s1 = RawSegment(
                            p1: Point2D(x: baseSeg.p1.x + bux * minT, z: baseSeg.p1.z + buz * minT),
                            p2: Point2D(x: baseSeg.p1.x + bux * maxT, z: baseSeg.p1.z + buz * maxT),
                            label: "\(s1.label)+\(s2.label)"
                        )
                        len1 = s1.length
                        ux = bux
                        uz = buz
                        nx = -uz
                        nz = ux
                        merged.insert(j)
                    }
                }
            }
            result.append(s1)
        }
        return result
    }

    /// Filters out phantom interior chords (e.g. bed edges, grazing LiDAR returns slicing through room interior)
    public static func filterInteriorChords(segments: [RawSegment]) -> [RawSegment] {
        guard segments.count > 3 else { return segments }

        var cX = 0.0
        var cZ = 0.0
        for s in segments {
            cX += (s.p1.x + s.p2.x) / 2.0
            cZ += (s.p1.z + s.p2.z) / 2.0
        }
        let centroidX = cX / Double(segments.count)
        let centroidZ = cZ / Double(segments.count)

        var radii: [Double] = []
        var maxR = 0.0
        for s in segments {
            let mx = (s.p1.x + s.p2.x) / 2.0
            let mz = (s.p1.z + s.p2.z) / 2.0
            let r = hypot(mx - centroidX, mz - centroidZ)
            radii.append(r)
            if r > maxR { maxR = r }
        }

        guard maxR >= 2.0 else { return segments }

        var filtered: [RawSegment] = []
        for (idx, s) in segments.enumerated() {
            let r = radii[idx]
            let rRatio = r / maxR

            let v1x = s.p1.x - centroidX
            let v1z = s.p1.z - centroidZ
            let v2x = s.p2.x - centroidX
            let v2z = s.p2.z - centroidZ
            let dot = v1x * v2x + v1z * v2z
            let len1 = hypot(v1x, v1z)
            let len2 = hypot(v2x, v2z)
            let cosAngle = (len1 * len2 > 1e-4) ? (dot / (len1 * len2)) : 1.0

            let isCentroidSpanningChord = (rRatio < 0.45 && cosAngle < -0.25)
            if !isCentroidSpanningChord {
                filtered.append(s)
            }
        }

        return filtered.count >= 3 ? filtered : segments
    }

    /// Chains segments sequentially into a continuous perimeter
    public static func chainSegments(segments: [RawSegment]) -> [RawSegment] {
        guard segments.count > 1 else { return segments }
        var startIdx = 0
        var maxLen = -Double.infinity
        for (idx, s) in segments.enumerated() {
            if s.length > maxLen {
                maxLen = s.length
                startIdx = idx
            }
        }

        var chained: [RawSegment] = [segments[startIdx]]
        var used = Set<Int>([startIdx])
        var currPt = segments[startIdx].p2

        while chained.count < segments.count {
            var bestIdx = -1
            var bestDist = Double.infinity
            var flip = false

            for i in 0..<segments.count {
                if used.contains(i) { continue }
                let s = segments[i]
                let d1 = currPt.distance(to: s.p1)
                let d2 = currPt.distance(to: s.p2)
                if d1 < bestDist {
                    bestDist = d1
                    bestIdx = i
                    flip = false
                }
                if d2 < bestDist {
                    bestDist = d2
                    bestIdx = i
                    flip = true
                }
            }

            if bestIdx < 0 { break }
            used.insert(bestIdx)
            let chosen = segments[bestIdx]
            if flip {
                chained.append(RawSegment(p1: chosen.p2, p2: chosen.p1, label: chosen.label))
                currPt = chosen.p1
            } else {
                chained.append(chosen)
                currPt = chosen.p2
            }
        }

        return chained
    }

    /// Self-intersection detector to reject bowtie geometries
    public static func isPolygonSelfIntersecting(points: [Point2D]) -> Bool {
        let n = points.count
        guard n >= 4 else { return false }

        func ccw(_ a: Point2D, _ b: Point2D, _ c: Point2D) -> Bool {
            return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x)
        }

        func segmentsIntersect(_ p1: Point2D, _ p2: Point2D, _ p3: Point2D, _ p4: Point2D) -> Bool {
            return ccw(p1, p3, p4) != ccw(p2, p3, p4) && ccw(p1, p2, p3) != ccw(p1, p2, p4)
        }

        for i in 0..<n {
            let a1 = points[i]
            let a2 = points[(i + 1) % n]
            for j in (i + 2)..<n {
                if i == 0 && j == n - 1 { continue }
                let b1 = points[j]
                let b2 = points[(j + 1) % n]
                if segmentsIntersect(a1, a2, b1, b2) {
                    return true
                }
            }
        }
        return false
    }

    /// Untangles a self-intersecting polygon loop (e.g. multi-pass bowtie artifacts) using 2-opt inversion moves
    public static func untanglePolygon(points: [Point2D]) -> [Point2D] {
        var pts = points
        var changed = true
        var iters = 0
        let maxIters = 25

        func ccw(_ a: Point2D, _ b: Point2D, _ c: Point2D) -> Bool {
            return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x)
        }

        func segmentsIntersect(_ p1: Point2D, _ p2: Point2D, _ p3: Point2D, _ p4: Point2D) -> Bool {
            return ccw(p1, p3, p4) != ccw(p2, p3, p4) && ccw(p1, p2, p3) != ccw(p1, p2, p4)
        }

        while changed && iters < maxIters {
            changed = false
            iters += 1
            let n = pts.count
            for i in 0..<n {
                let a1 = pts[i]
                let a2 = pts[(i + 1) % n]
                for j in (i + 2)..<n {
                    if i == 0 && j == n - 1 { continue }
                    let b1 = pts[j]
                    let b2 = pts[(j + 1) % n]
                    if segmentsIntersect(a1, a2, b1, b2) {
                        let sub = Array(pts[(i + 1)...j].reversed())
                        pts = Array(pts[0...i]) + sub + Array(pts[(j + 1)..<n])
                        changed = true
                        break
                    }
                }
                if changed { break }
            }
        }

        return pts
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

        let deduped = deduplicateOverlappingWalls(segments: segments)
        let filtered = filterInteriorChords(segments: deduped)
        let chained = chainSegments(segments: filtered)

        guard chained.count >= 3 else {
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

        let rawClosingGap = isClosed ? chained.last!.p2.distance(to: chained.first!.p1) : 0.0
        let domAngleRad = computeDominantOrientation(segments: chained)
        let domAngleDeg = domAngleRad * 180.0 / .pi

        var snapped = quantizeWallOrientations(segments: chained, domAngle: domAngleRad)

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

        var finalVertices = vertices
        if isClosed && isPolygonSelfIntersecting(points: finalVertices) {
            finalVertices = untanglePolygon(points: finalVertices)
        }

        let isSelfIntersecting = isClosed && isPolygonSelfIntersecting(points: finalVertices)
        let area = (isClosed && !isSelfIntersecting) ? computePolygonArea(points: finalVertices) : 0.0
        let perimeter = computePolygonPerimeter(points: finalVertices)

        return OptimizerResult(
            dominantOrientationDeg: domAngleDeg,
            snappedWalls: snapped,
            closedPolygon: finalVertices,
            isWatertight: isClosed && (finalVertices.count >= 3) && !isSelfIntersecting,
            loopClosingGapFt: isClosed ? 0.0 : rawClosingGap,
            areaSqFt: area,
            perimeterFt: perimeter
        )
    }
}
