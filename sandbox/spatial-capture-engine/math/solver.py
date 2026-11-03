# spatial-capture-engine/math/solver.py
"""
Orthogonal-Manhattan Topological Loop Closure (OM-TLC) Mathematical Engine.
Clean-room implementation derived from peer-reviewed academic SLAM literature:
- Dai et al. (BundleFusion)
- Zhang et al. (Compact Pose Graphs)
- Fan et al. (MIT Certifiable PGO)
- Li et al. (Structure-SLAM)
"""

import math
from dataclasses import dataclass
from typing import List, Tuple, Optional


@dataclass
class Point2D:
    x: float
    z: float

    def distance_to(self, other: 'Point2D') -> float:
        return math.hypot(self.x - other.x, self.z - other.z)


@dataclass
class RawSegment:
    p1: Point2D
    p2: Point2D
    label: str = ""

    @property
    def length(self) -> float:
        return self.p1.distance_to(self.p2)

    @property
    def angle(self) -> float:
        """Raw orientation angle in radians [-pi, pi]."""
        return math.atan2(self.p2.z - self.p1.z, self.p2.x - self.p1.x)

    @property
    def midpoint(self) -> Point2D:
        return Point2D((self.p1.x + self.p2.x) / 2.0, (self.p1.z + self.p2.z) / 2.0)


@dataclass
class SnappedWall:
    raw: RawSegment
    snapped_angle: float   # in radians
    classification: str    # 'ORTHOGONAL', 'BAY_45', or 'CUSTOM'
    A: float               # Line equation: A*x + B*z + C = 0
    B: float
    C: float


@dataclass
class SolverResult:
    dominant_orientation_deg: float
    snapped_walls: List[SnappedWall]
    closed_polygon: List[Point2D]
    is_watertight: bool
    loop_closing_gap_ft: float
    area_sqft: float
    perimeter_ft: float


def normalize_angle(angle: float) -> float:
    """Normalize angle to [-pi, pi]."""
    while angle > math.pi:
        angle -= 2.0 * math.pi
    while angle < -math.pi:
        angle += 2.0 * math.pi
    return angle


def compute_dominant_orientation(segments: List[RawSegment]) -> float:
    """
    Length-weighted modulo-90 circular mean.
    A 20ft wall has 60x more voting weight than a 4in wall.
    Returns dominant angle in radians in range [-pi/4, pi/4].
    """
    sum_sin = 0.0
    sum_cos = 0.0
    total_len = 0.0

    for seg in segments:
        length = seg.length
        if length < 1e-4:
            continue
        angle = seg.angle
        # Map to modulo-90 space by multiplying by 4
        theta_4 = 4.0 * angle
        sum_sin += length * math.sin(theta_4)
        sum_cos += length * math.cos(theta_4)
        total_len += length

    if total_len < 1e-4:
        return 0.0

    theta_dom_4 = math.atan2(sum_sin, sum_cos)
    return theta_dom_4 / 4.0


def quantize_wall_orientations(
    segments: List[RawSegment],
    dom_angle: float,
    tau_ortho_deg: float = 7.5,
    tau_bay_deg: float = 4.0
) -> List[SnappedWall]:
    """
    Dual-threshold angular quantization with hysteresis.
    - Snaps near-orthogonal walls to k*90 + dom_angle
    - Snaps near-45 bay angles to m*90 + 45 + dom_angle
    - Preserves custom architectural angles
    """
    tau_ortho = math.radians(tau_ortho_deg)
    tau_bay = math.radians(tau_bay_deg)
    snapped: List[SnappedWall] = []

    for seg in segments:
        raw_angle = seg.angle
        rel_angle = normalize_angle(raw_angle - dom_angle)

        # 1. Find distance to nearest orthogonal axis (0, 90, 180, 270)
        k = round(rel_angle / (math.pi / 2.0))
        target_ortho_rel = k * (math.pi / 2.0)
        dist_ortho = abs(normalize_angle(rel_angle - target_ortho_rel))

        # 2. Find distance to nearest 45-degree semi-Manhattan axis (45, 135, 225, 315)
        # Shift by 45 deg, divide by 90 deg, shift back
        rel_minus_45 = rel_angle - (math.pi / 4.0)
        m = round(rel_minus_45 / (math.pi / 2.0))
        target_bay_rel = m * (math.pi / 2.0) + (math.pi / 4.0)
        dist_bay = abs(normalize_angle(rel_angle - target_bay_rel))

        if dist_ortho <= tau_ortho:
            snapped_angle = normalize_angle(target_ortho_rel + dom_angle)
            classification = "ORTHOGONAL"
        elif dist_bay <= tau_bay:
            snapped_angle = normalize_angle(target_bay_rel + dom_angle)
            classification = "BAY_45"
        else:
            snapped_angle = raw_angle
            classification = "CUSTOM"

        # Constrained line equation: A*x + B*z + C = 0
        # Normal vector n = (-sin(snapped_angle), cos(snapped_angle))
        # Direction vector v = (cos(snapped_angle), sin(snapped_angle))
        # Line equation: -sin(snapped_angle)*x + cos(snapped_angle)*z + C = 0
        A = -math.sin(snapped_angle)
        B = math.cos(snapped_angle)

        # Pass through segment midpoint to minimize orthogonal displacement
        mid = seg.midpoint
        C = -(A * mid.x + B * mid.z)

        snapped.append(SnappedWall(
            raw=seg,
            snapped_angle=snapped_angle,
            classification=classification,
            A=A,
            B=B,
            C=C
        ))

    return snapped


def fuse_collinear_walls(walls: List[SnappedWall], gap_tol_ft: float = 0.25) -> List[SnappedWall]:
    """
    Fuses adjacent wall segments that are collinear and share the same line equation.
    Crucial for LiDAR dropouts.
    """
    if len(walls) <= 1:
        return walls

    fused: List[SnappedWall] = []
    i = 0
    N = len(walls)

    while i < N:
        current = walls[i]
        # Check if next wall is collinear
        if i + 1 < N:
            nxt = walls[i + 1]
            # Same classification and parallel normal
            dot = current.A * nxt.A + current.B * nxt.B
            is_parallel = abs(dot) >= 1.0 - 1e-4
            is_coplanar = abs(current.C - (nxt.C if dot > 0 else -nxt.C)) <= gap_tol_ft

            if is_parallel and is_coplanar:
                # Merge into one segment spanning p1 of current to p2 of nxt
                merged_raw = RawSegment(p1=current.raw.p1, p2=nxt.raw.p2, label=f"{current.raw.label}+fused")
                mid = merged_raw.midpoint
                A, B = current.A, current.B
                C = -(A * mid.x + B * mid.z)
                current = SnappedWall(
                    raw=merged_raw,
                    snapped_angle=current.snapped_angle,
                    classification=current.classification,
                    A=A,
                    B=B,
                    C=C
                )
                i += 1  # Skip the merged next segment

        fused.append(current)
        i += 1

    return fused


def intersect_lines(w1: SnappedWall, w2: SnappedWall, epsilon: float = 1e-4) -> Point2D:
    """
    Computes exact line-line intersection of two snapped walls:
    A1*x + B1*z + C1 = 0
    A2*x + B2*z + C2 = 0
    Includes determinant guard for near-parallel stability.
    """
    A1, B1, C1 = w1.A, w1.B, w1.C
    A2, B2, C2 = w2.A, w2.B, w2.C

    det = A1 * B2 - A2 * B1

    if abs(det) >= epsilon:
        # Standard Cramer's rule
        x = (B1 * C2 - B2 * C1) / det
        z = (A2 * C1 - A1 * C2) / det
        return Point2D(x, z)
    else:
        # Near-collinear singularity guard: project midpoint to avoid infinity
        p_raw1 = w1.raw.p2
        p_raw2 = w2.raw.p1
        return Point2D((p_raw1.x + p_raw2.x) / 2.0, (p_raw1.z + p_raw2.z) / 2.0)


def compute_polygon_area(points: List[Point2D]) -> float:
    """Shoelace formula for polygon area."""
    n = len(points)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += points[i].x * points[j].z
        area -= points[j].x * points[i].z
    return abs(area) / 2.0


def compute_polygon_perimeter(points: List[Point2D]) -> float:
    n = len(points)
    if n < 2:
        return 0.0
    perim = 0.0
    for i in range(n):
        j = (i + 1) % n
        perim += points[i].distance_to(points[j])
    return perim


def solve_room_capture(
    segments: List[RawSegment],
    is_closed: bool = True,
    fuse_collinear: bool = True
) -> SolverResult:
    """
    Master pipeline:
    1. Dominant orientation extraction
    2. Dual-threshold angular quantization & orthogonal least-squares fitting
    3. Optional collinear wall fusion
    4. Determinant-guarded corner intersection & topological loop closure
    5. Metric verification
    """
    if not segments:
        return SolverResult(0.0, [], [], False, 0.0, 0.0, 0.0)

    # Calculate initial loop closing gap from raw sensor
    raw_closing_gap = segments[-1].p2.distance_to(segments[0].p1) if is_closed else 0.0

    # Step 1: Dominant orientation
    dom_angle_rad = compute_dominant_orientation(segments)
    dom_angle_deg = math.degrees(dom_angle_rad)

    # Step 2: Angular quantization & line fitting
    snapped = quantize_wall_orientations(segments, dom_angle_rad)

    # Step 3: Collinear fusion
    if fuse_collinear:
        snapped = fuse_collinear_walls(snapped)

    # Step 4: Corner intersection & loop closure
    N = len(snapped)
    vertices: List[Point2D] = []

    if is_closed and N >= 3:
        for i in range(N):
            w_curr = snapped[i]
            w_next = snapped[(i + 1) % N]
            corner = intersect_lines(w_curr, w_next)
            vertices.append(corner)
    else:
        # Open layout (e.g., 3 physical walls)
        for i in range(N - 1):
            corner = intersect_lines(snapped[i], snapped[i + 1])
            vertices.append(corner)

    area = compute_polygon_area(vertices) if is_closed else 0.0
    perimeter = compute_polygon_perimeter(vertices)

    return SolverResult(
        dominant_orientation_deg=dom_angle_deg,
        snapped_walls=snapped,
        closed_polygon=vertices,
        is_watertight=is_closed and (len(vertices) >= 3),
        loop_closing_gap_ft=0.0 if is_closed else raw_closing_gap,
        area_sqft=area,
        perimeter_ft=perimeter
    )
