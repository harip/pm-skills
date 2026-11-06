// sandbox/ios/LiDARRoomStudio/RoomGeometryOptimizer.swift
// Orthogonal-Manhattan Topological Loop Closure (OM-TLC) Native Swift Engine.
// Clean-room implementation derived from peer-reviewed academic SLAM literature:
// - Dai et al. (BundleFusion)
// - Zhang et al. (Compact Pose Graphs)
// - Fan et al. (MIT Certifiable PGO)
// - Li et al. (Structure-SLAM)

import Foundation
import simd
import RoomPlan

// ==============================================================================
// MARK: - Hardened Semantic Deduplication & Parametric Surface Layer
// ==============================================================================

@available(iOS 16.0, *)
public struct ParametricWall: Identifiable, Sendable {
    public var id: String
    public var transform: simd_float4x4
    public var dimensions: simd_float3
    public var confidence: Float

    public init(id: String, transform: simd_float4x4, dimensions: simd_float3, confidence: Float = 1.0) {
        self.id = id
        self.transform = transform
        self.dimensions = dimensions
        self.confidence = confidence
    }

    public init(surface: CapturedRoom.Surface, id: String? = nil) {
        self.id = id ?? surface.identifier.uuidString
        self.transform = surface.transform
        self.dimensions = surface.dimensions
        self.confidence = surface.confidence == .high ? 1.0 : (surface.confidence == .medium ? 0.7 : 0.4)
    }

    // Position (Center) Vector P = [T_0,3, T_1,3, T_2,3]
    public var center: SIMD3<Float> {
        get {
            SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
        }
        set {
            transform.columns.3 = SIMD4<Float>(newValue.x, newValue.y, newValue.z, 1.0)
        }
    }

    // Normal Vector n = [T_0,2, T_1,2, T_2,2]
    public var normal: SIMD3<Float> {
        let col = transform.columns.2
        let n = SIMD3<Float>(col.x, col.y, col.z)
        let lenSq = simd_length_squared(n)
        return lenSq > 1e-6 ? simd_normalize(n) : SIMD3<Float>(0, 0, 1)
    }

    // Tangent Vector along width u = [T_0,0, T_1,0, T_2,0]
    public var tangent: SIMD3<Float> {
        let col = transform.columns.0
        let u = SIMD3<Float>(col.x, col.y, col.z)
        let lenSq = simd_length_squared(u)
        return lenSq > 1e-6 ? simd_normalize(u) : SIMD3<Float>(1, 0, 0)
    }

    // Up Vector along height v = [T_0,1, T_1,1, T_2,1]
    public var up: SIMD3<Float> {
        let col = transform.columns.1
        let v = SIMD3<Float>(col.x, col.y, col.z)
        let lenSq = simd_length_squared(v)
        return lenSq > 1e-6 ? simd_normalize(v) : SIMD3<Float>(0, 1, 0)
    }

    // 3D Endpoint P1
    public var p1: SIMD3<Float> {
        center - tangent * (dimensions.x / 2.0)
    }

    // 3D Endpoint P2
    public var p2: SIMD3<Float> {
        center + tangent * (dimensions.x / 2.0)
    }
}

@available(iOS 16.0, *)
public final class HardenedSemanticDeduplicationLayer: @unchecked Sendable {
    // Exact mathematical thresholds from engineering plan
    public static let epsilonTheta: Float = 0.05 // Orientation threshold (~3.0 degrees)
    public static let maxPerpendicularDistanceM: Float = 0.15 // 15 cm perpendicular offset threshold
    public static let alphaBlend: Float = 0.3 // Confidence-weighted update smoothing factor (30%)
    public static let cornerMinAngleDeg: Float = 85.0
    public static let cornerMaxAngleDeg: Float = 95.0

    // Thread-safe bounded live tracking cache (ring buffer with capacity limit)
    private var cachedWalls: [ParametricWall] = []
    private let lock = NSLock()
    private let maxCacheCapacity = 64

    public init() {
        cachedWalls.reserveCapacity(maxCacheCapacity)
    }

    public func reset() {
        lock.lock()
        defer { lock.unlock() }
        cachedWalls.removeAll(keepingCapacity: true)
    }

    public var currentWalls: [ParametricWall] {
        lock.lock()
        defer { lock.unlock() }
        return cachedWalls
    }

    // MARK: - Mathematical Extraction & Distance Formulas

    /// Extracts normalized normal vector from a 4x4 rigid transform: n = [T_0,2, T_1,2, T_2,2]
    public static func extractNormal(from transform: simd_float4x4) -> SIMD3<Float> {
        let col = transform.columns.2
        let n = SIMD3<Float>(col.x, col.y, col.z)
        let lenSq = simd_length_squared(n)
        return lenSq > 1e-6 ? simd_normalize(n) : SIMD3<Float>(0, 0, 1)
    }

    /// Extracts center position point from a 4x4 rigid transform: P = [T_0,3, T_1,3, T_2,3]
    public static func extractCenter(from transform: simd_float4x4) -> SIMD3<Float> {
        let col = transform.columns.3
        return SIMD3<Float>(col.x, col.y, col.z)
    }

    /// Extracts tangent direction vector along surface width: u = [T_0,0, T_1,0, T_2,0]
    public static func extractTangent(from transform: simd_float4x4) -> SIMD3<Float> {
        let col = transform.columns.0
        let u = SIMD3<Float>(col.x, col.y, col.z)
        let lenSq = simd_length_squared(u)
        return lenSq > 1e-6 ? simd_normalize(u) : SIMD3<Float>(1, 0, 0)
    }

    /// Tests parallelism between two surface normals using absolute dot product:
    /// |n_new · n_exist| >= 1.0 - epsilon_theta
    public static func isParallel(
        _ n1: SIMD3<Float>,
        _ n2: SIMD3<Float>,
        epsilon: Float = epsilonTheta
    ) -> Bool {
        let dot = abs(simd_dot(n1, n2))
        return dot >= (1.0 - epsilon)
    }

    /// Computes perpendicular distance offset:
    /// d_perp = |(P_new - P_exist) · n_exist|
    public static func perpendicularDistance(
        pNew: SIMD3<Float>,
        pExist: SIMD3<Float>,
        nExist: SIMD3<Float>
    ) -> Float {
        let diff = pNew - pExist
        return abs(simd_dot(diff, nExist))
    }

    /// Determines whether two parallel coplanar walls overlap or abut along their tangent axis
    public static func hasSpatialOverlap(
        w1: ParametricWall,
        w2: ParametricWall,
        marginMeters: Float = 0.30
    ) -> Bool {
        let u = w1.tangent
        let dCenter = w2.center - w1.center
        let tangentDist = abs(simd_dot(dCenter, u))
        let maxAllowedDist = (w1.dimensions.x + w2.dimensions.x) / 2.0 + marginMeters
        return tangentDist <= maxAllowedDist
    }

    // MARK: - Confidence-Weighted Matrix Blending

    /// Blends incoming surface into existing surface when classified as duplicate drift:
    /// P_fused = (1 - alpha)*P_exist + alpha*P_new
    public static func blendSurfaces(
        existing: inout ParametricWall,
        incoming: ParametricWall,
        alpha: Float = alphaBlend
    ) {
        // 1. Position interpolation
        let fusedCenter = (1.0 - alpha) * existing.center + alpha * incoming.center

        // 2. Normal orientation blending (accounting for opposing normal direction)
        let dotNorm = simd_dot(existing.normal, incoming.normal)
        let alignedIncomingNormal = dotNorm >= 0 ? incoming.normal : -incoming.normal
        let rawNormal = (1.0 - alpha) * existing.normal + alpha * alignedIncomingNormal
        let fusedNormal = simd_length_squared(rawNormal) > 1e-6 ? simd_normalize(rawNormal) : existing.normal

        // 3. Orthonormal basis reconstruction (Horizontal plane constraint)
        let worldUp = SIMD3<Float>(0, 1, 0)
        var fusedTangent = simd_cross(worldUp, fusedNormal)
        if simd_length_squared(fusedTangent) < 1e-4 {
            fusedTangent = SIMD3<Float>(1, 0, 0)
        } else {
            fusedTangent = simd_normalize(fusedTangent)
        }
        let fusedUp = simd_cross(fusedNormal, fusedTangent)

        // 4. Extent expansion along fused tangent
        let extP1 = simd_dot(existing.p1, fusedTangent)
        let extP2 = simd_dot(existing.p2, fusedTangent)
        let incP1 = simd_dot(incoming.p1, fusedTangent)
        let incP2 = simd_dot(incoming.p2, fusedTangent)

        let tMin = min(min(extP1, extP2), min(incP1, incP2))
        let tMax = max(max(extP1, extP2), max(incP1, incP2))
        let fusedLength = max(existing.dimensions.x, tMax - tMin)
        let fusedHeight = max(existing.dimensions.y, incoming.dimensions.y)
        let fusedThickness = (1.0 - alpha) * existing.dimensions.z + alpha * incoming.dimensions.z

        // 5. Reconstruct 4x4 matrix
        var newTransform = matrix_identity_float4x4
        newTransform.columns.0 = SIMD4<Float>(fusedTangent.x, fusedTangent.y, fusedTangent.z, 0)
        newTransform.columns.1 = SIMD4<Float>(fusedUp.x, fusedUp.y, fusedUp.z, 0)
        newTransform.columns.2 = SIMD4<Float>(fusedNormal.x, fusedNormal.y, fusedNormal.z, 0)
        newTransform.columns.3 = SIMD4<Float>(fusedCenter.x, fusedCenter.y, fusedCenter.z, 1)

        existing.transform = newTransform
        existing.dimensions = SIMD3<Float>(fusedLength, fusedHeight, fusedThickness)
        existing.confidence = min(1.0, existing.confidence + 0.1)
    }

    // MARK: - Graph-Based 90-Degree Orthogonal Corner Snapping

    /// Snaps adjacent walls within [85°, 95°] to exactly 90.0° and computes plane-plane intersection
    public static func snapOrthogonalCorners(
        walls: inout [ParametricWall],
        minAngleDeg: Float = cornerMinAngleDeg,
        maxAngleDeg: Float = cornerMaxAngleDeg
    ) {
        guard walls.count >= 2 else { return }
        let maxCos = cos(minAngleDeg * .pi / 180.0) // ~ 0.08716

        for i in 0..<walls.count {
            for j in (i + 1)..<walls.count {
                var wA = walls[i]
                var wB = walls[j]

                let dotNorm = simd_dot(wA.normal, wB.normal)
                if abs(dotNorm) <= maxCos { // 85° <= theta <= 95°
                    // Programmatically force theta = 90.0°
                    let nA_xz = simd_normalize(SIMD2<Float>(wA.normal.x, wA.normal.z))
                    let perpToA = SIMD2<Float>(-nA_xz.y, nA_xz.x)
                    let nB_xz = SIMD2<Float>(wB.normal.x, wB.normal.z)
                    let sign = simd_dot(nB_xz, perpToA) >= 0 ? 1.0 : -1.0
                    let snapped_nB_xz = Float(sign) * perpToA

                    // Line equations in 2D (horizontal plane)
                    // Line A: nA_xz.x * x + nA_xz.y * z + dA = 0
                    let pA_xz = SIMD2<Float>(wA.center.x, wA.center.z)
                    let dA = -simd_dot(nA_xz, pA_xz)

                    // Line B: snapped_nB_xz.x * x + snapped_nB_xz.y * z + dB = 0
                    let pB_xz = SIMD2<Float>(wB.center.x, wB.center.z)
                    let dB = -simd_dot(snapped_nB_xz, pB_xz)

                    let det = nA_xz.x * snapped_nB_xz.y - nA_xz.y * snapped_nB_xz.x
                    if abs(det) > 1e-4 {
                        let intX = (-dA * snapped_nB_xz.y - (-dB) * nA_xz.y) / det
                        let intZ = (nA_xz.x * (-dB) - snapped_nB_xz.x * (-dA)) / det
                        let corner2D = SIMD2<Float>(intX, intZ)

                        // Test proximity: corner must be reasonably near one of the endpoints (< 1.5m)
                        let distA1 = simd_distance(corner2D, SIMD2<Float>(wA.p1.x, wA.p1.z))
                        let distA2 = simd_distance(corner2D, SIMD2<Float>(wA.p2.x, wA.p2.z))
                        let distB1 = simd_distance(corner2D, SIMD2<Float>(wB.p1.x, wB.p1.z))
                        let distB2 = simd_distance(corner2D, SIMD2<Float>(wB.p2.x, wB.p2.z))

                        if min(distA1, distA2) < 1.5 && min(distB1, distB2) < 1.5 {
                            // Recompute edge vertices to lie exactly on intersection point
                            var newPA1 = wA.p1
                            var newPA2 = wA.p2
                            if distA1 < distA2 {
                                newPA1 = SIMD3<Float>(corner2D.x, wA.center.y, corner2D.y)
                            } else {
                                newPA2 = SIMD3<Float>(corner2D.x, wA.center.y, corner2D.y)
                            }
                            let newCenterA = (newPA1 + newPA2) / 2.0
                            let newLengthA = simd_distance(newPA1, newPA2)
                            wA.center = newCenterA
                            wA.dimensions.x = newLengthA

                            var newPB1 = wB.p1
                            var newPB2 = wB.p2
                            if distB1 < distB2 {
                                newPB1 = SIMD3<Float>(corner2D.x, wB.center.y, corner2D.y)
                            } else {
                                newPB2 = SIMD3<Float>(corner2D.x, wB.center.y, corner2D.y)
                            }
                            let newCenterB = (newPB1 + newPB2) / 2.0
                            let newLengthB = simd_distance(newPB1, newPB2)
                            wB.center = newCenterB
                            wB.dimensions.x = newLengthB

                            walls[i] = wA
                            walls[j] = wB
                        }
                    }
                }
            }
        }
    }

    // MARK: - Pipeline Entry Points

    /// Real-time live update processing with bounded memory buffer
    public func updateWithLiveSurfaces(_ surfaces: [CapturedRoom.Surface]) {
        lock.lock()
        defer { lock.unlock() }

        for surface in surfaces {
            let incoming = ParametricWall(surface: surface)
            var merged = false

            for idx in 0..<cachedWalls.count {
                let exist = cachedWalls[idx]

                // Condition 1: Parallelism verification
                let isPar = Self.isParallel(incoming.normal, exist.normal)
                // Condition 2: Perpendicular distance offset (< 0.15m)
                let dPerp = Self.perpendicularDistance(pNew: incoming.center, pExist: exist.center, nExist: exist.normal)

                if isPar && dPerp < Self.maxPerpendicularDistanceM && Self.hasSpatialOverlap(w1: exist, w2: incoming) {
                    Self.blendSurfaces(existing: &cachedWalls[idx], incoming: incoming)
                    merged = true
                    break
                }
            }

            if !merged && cachedWalls.count < maxCacheCapacity {
                cachedWalls.append(incoming)
            }
        }

        Self.snapOrthogonalCorners(walls: &cachedWalls)
    }

    /// Post-processing finalization on globally optimized room surfaces
    public static func finalizeRoomSurfaces(_ surfaces: [CapturedRoom.Surface]) -> [ParametricWall] {
        let walls = surfaces.map { ParametricWall(surface: $0) }
        var deduplicated: [ParametricWall] = []

        for incoming in walls {
            var merged = false
            for idx in 0..<deduplicated.count {
                let exist = deduplicated[idx]
                let isPar = isParallel(incoming.normal, exist.normal)
                let dPerp = perpendicularDistance(pNew: incoming.center, pExist: exist.center, nExist: exist.normal)

                if isPar && dPerp < maxPerpendicularDistanceM && hasSpatialOverlap(w1: exist, w2: incoming) {
                    blendSurfaces(existing: &deduplicated[idx], incoming: incoming)
                    merged = true
                    break
                }
            }
            if !merged {
                deduplicated.append(incoming)
            }
        }

        snapOrthogonalCorners(walls: &deduplicated)
        return deduplicated
    }
}

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

            let isCentroidSpanningChord = (rRatio < 0.50 && cosAngle < -0.15)
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

    /// Self-intersection detector to reject bowtie geometries (Zero range operator dependencies)
    public static func isPolygonSelfIntersecting(points: [Point2D]) -> Bool {
        let n = points.count
        guard n >= 4 else { return false }

        func ccw(_ a: Point2D, _ b: Point2D, _ c: Point2D) -> Bool {
            return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x)
        }

        func segmentsIntersect(_ p1: Point2D, _ p2: Point2D, _ p3: Point2D, _ p4: Point2D) -> Bool {
            return ccw(p1, p3, p4) != ccw(p2, p3, p4) && ccw(p1, p2, p3) != ccw(p1, p2, p4)
        }

        var i = 0
        while i < n - 2 {
            let a1 = points[i]
            let a2 = points[(i + 1) % n]
            var j = i + 2
            while j < n {
                if !(i == 0 && j == n - 1) {
                    let b1 = points[j]
                    let b2 = points[(j + 1) % n]
                    if segmentsIntersect(a1, a2, b1, b2) {
                        return true
                    }
                }
                j += 1
            }
            i += 1
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
            guard n >= 4 else { break }

            var i = 0
            while i < n - 2 {
                let a1 = pts[i]
                let a2 = pts[(i + 1) % n]
                var j = i + 2
                while j < n {
                    if !(i == 0 && j == n - 1) {
                        let b1 = pts[j]
                        let b2 = pts[(j + 1) % n]
                        if segmentsIntersect(a1, a2, b1, b2) {
                            if i + 1 <= j && j < n {
                                let sub = Array(pts[(i + 1)...j].reversed())
                                let prefix = Array(pts[0...i])
                                let suffix = (j + 1 < n) ? Array(pts[(j + 1)..<n]) : []
                                pts = prefix + sub + suffix
                                changed = true
                                break
                            }
                        }
                    }
                    j += 1
                }
                if changed { break }
                i += 1
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

        // Filter out minor aperture jambs and door stubs (< 2.2 ft / ~0.67m) when sufficient primary boundary walls exist
        var structural = filtered
        let longWalls = structural.filter { $0.length >= 2.2 }
        if longWalls.count >= 3 {
            structural = longWalls
        }
        let chained = chainSegments(segments: structural)

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

        // Simplify collinear points along straight continuous walls
        if isClosed && finalVertices.count >= 4 {
            var simplified: [Point2D] = []
            let nV = finalVertices.count
            for k in 0..<nV {
                let prev = finalVertices[(k - 1 + nV) % nV]
                let cur = finalVertices[k]
                let next = finalVertices[(k + 1) % nV]
                let cross = (cur.x - prev.x) * (next.z - cur.z) - (cur.z - prev.z) * (next.x - cur.x)
                let l1 = cur.distance(to: prev)
                let l2 = next.distance(to: cur)
                let sinTheta = (l1 * l2 > 1e-4) ? abs(cross) / (l1 * l2) : 0.0
                if sinTheta > 0.087 {
                    simplified.append(cur)
                }
            }
            if simplified.count >= 3 {
                finalVertices = simplified
            }
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
