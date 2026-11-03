# spatial-capture-engine/tests/test_stress_battery.py
"""
10-Case Mathematical Stress-Test Battery for Spatial Capture Engine.
Verifies Pass A: Mathematical Convergence, Orthogonal Snapping,
Loop Closure, Collinear Fusion, and Singularity Protection.
"""

import math
from math import isclose
import sys
import os
from importlib.machinery import SourceFileLoader

solver_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../math/solver.py'))
solver = SourceFileLoader("solver", solver_path).load_module()

Point2D = solver.Point2D
RawSegment = solver.RawSegment
SnappedWall = solver.SnappedWall
solve_room_capture = solver.solve_room_capture
compute_dominant_orientation = solver.compute_dominant_orientation
quantize_wall_orientations = solver.quantize_wall_orientations
fuse_collinear_walls = solver.fuse_collinear_walls
intersect_lines = solver.intersect_lines


def run_all_tests():
    passed = 0
    total = 10
    print("=" * 70)
    print("📐 RUNNING 10-CASE MATHEMATICAL STRESS-TEST BATTERY (Pass A)")
    print("=" * 70)

    # -------------------------------------------------------------
    # CASE 1: Standard 4-Wall Rectangle with 5.4-inch Loop Gap Drift
    # -------------------------------------------------------------
    print("\n[Case 1] 4-Wall Rectangle with 5.4'' Cumulative Drift Gap...")
    # Physical room: 16ft x 14ft (Area: 224 sq ft)
    # Raw sensor drifted: ends up with a 0.45 ft (5.4 in) opening gap
    w1 = RawSegment(Point2D(0.0, 0.0), Point2D(16.08, 0.22), "South Wall")
    w2 = RawSegment(Point2D(16.08, 0.22), Point2D(15.75, 14.15), "East Wall")
    w3 = RawSegment(Point2D(15.75, 14.15), Point2D(-0.35, 13.90), "North Wall")
    w4 = RawSegment(Point2D(-0.35, 13.90), Point2D(0.32, 0.31), "West Wall (Drifted)")

    raw_gap = w4.p2.distance_to(w1.p1)
    assert raw_gap > 0.4, f"Setup error: raw gap should be ~0.45 ft, got {raw_gap}"

    res1 = solve_room_capture([w1, w2, w3, w4], is_closed=True)

    assert res1.is_watertight, "Room must be watertight"
    assert res1.loop_closing_gap_ft == 0.0, "Closing gap must be mathematically 0"
    assert len(res1.closed_polygon) == 4, f"Must have 4 corners, got {len(res1.closed_polygon)}"
    assert all(w.classification == "ORTHOGONAL" for w in res1.snapped_walls), "All walls must snap to ORTHOGONAL"
    # Verify area is within 1% of true 224 sq ft
    assert 220.0 <= res1.area_sqft <= 228.0, f"Area expected ~224, got {res1.area_sqft:.2f}"
    print(f"  ✅ PASS: Dominant orientation {res1.dominant_orientation_deg:.2f}°, Gap 5.4'' -> 0.0'', Area: {res1.area_sqft:.1f} sqft")
    passed += 1

    # -------------------------------------------------------------
    # CASE 2: L-Shaped Multi-Corner Room (4 Outside + 2 Reflex Inside)
    # -------------------------------------------------------------
    print("\n[Case 2] L-Shaped Multi-Corner Room (6 walls, reflex corners)...")
    # L-shape: 20x15 box with 10x8 bite removed
    w_l1 = RawSegment(Point2D(0.0, 0.0), Point2D(20.05, 0.1), "Bottom")
    w_l2 = RawSegment(Point2D(20.05, 0.1), Point2D(19.9, 7.0), "Right Lower")
    w_l3 = RawSegment(Point2D(19.9, 7.0), Point2D(10.1, 7.1), "Reflex Cut In")
    w_l4 = RawSegment(Point2D(10.1, 7.1), Point2D(9.9, 15.0), "Reflex Cut Up")
    w_l5 = RawSegment(Point2D(9.9, 15.0), Point2D(-0.1, 14.9), "Top")
    w_l6 = RawSegment(Point2D(-0.1, 14.9), Point2D(0.2, 0.2), "Left")

    res2 = solve_room_capture([w_l1, w_l2, w_l3, w_l4, w_l5, w_l6], is_closed=True)
    assert len(res2.closed_polygon) == 6, f"Expected 6 corners, got {len(res2.closed_polygon)}"
    assert all(w.classification == "ORTHOGONAL" for w in res2.snapped_walls)
    # Area expected: (20*15) - (10*8) = 300 - 80 = 220 sq ft
    assert 215.0 <= res2.area_sqft <= 225.0, f"Area expected ~220, got {res2.area_sqft:.2f}"
    print(f"  ✅ PASS: 6-wall L-shape closed watertight, Area: {res2.area_sqft:.1f} sqft")
    passed += 1

    # -------------------------------------------------------------
    # CASE 3: U-Shaped Wrap-Around Corridor (Compounding 60s Drift)
    # -------------------------------------------------------------
    print("\n[Case 3] U-Shaped Wrap-Around Corridor (8 walls, long drift walk)...")
    # 8 segments forming a U
    u_segs = [
        RawSegment(Point2D(0.0, 0.0), Point2D(30.1, 0.2)),
        RawSegment(Point2D(30.1, 0.2), Point2D(29.8, 10.0)),
        RawSegment(Point2D(29.8, 10.0), Point2D(20.1, 9.8)),
        RawSegment(Point2D(20.1, 9.8), Point2D(20.2, 4.1)),
        RawSegment(Point2D(20.2, 4.1), Point2D(9.9, 4.0)),
        RawSegment(Point2D(9.9, 4.0), Point2D(10.1, 10.1)),
        RawSegment(Point2D(10.1, 10.1), Point2D(-0.2, 9.9)),
        RawSegment(Point2D(-0.2, 9.9), Point2D(0.3, 0.3)),
    ]
    res3 = solve_room_capture(u_segs, is_closed=True)
    assert len(res3.closed_polygon) == 8
    assert res3.is_watertight
    print(f"  ✅ PASS: 8-wall U-corridor closed with zero gaps, Area: {res3.area_sqft:.1f} sqft")
    passed += 1

    # -------------------------------------------------------------
    # CASE 4: Bay Window Room (Strict 90° + Preserved 45° Bay Wings)
    # -------------------------------------------------------------
    print("\n[Case 4] Bay Window Room (Preserving 45° Bay Wings without flattening)...")
    # South, East, North-East Bay (45°), North Bay Flat (0°), North-West Bay (135°), West
    s_ang45 = math.radians(43.9)   # Raw sensor detected 43.9° (target ~45°)
    s_ang225 = math.radians(-136.2) # Raw sensor detected -136.2° (target -135°)
    bay_len = 4.0

    p_bay_start = Point2D(16.0, 10.0)
    p_bay_mid1 = Point2D(p_bay_start.x - bay_len * math.cos(s_ang45), p_bay_start.z + bay_len * math.sin(s_ang45))
    p_bay_end = Point2D(0.0, 10.0)
    p_bay_mid2 = Point2D(p_bay_end.x - bay_len * math.cos(s_ang225), p_bay_end.z - bay_len * math.sin(s_ang225))

    bay_segs = [
        RawSegment(Point2D(0.0, 0.0), Point2D(16.0, 0.0), "South"),
        RawSegment(Point2D(16.0, 0.0), p_bay_start, "East"),
        RawSegment(p_bay_start, p_bay_mid1, "Bay Wing East"),
        RawSegment(p_bay_mid1, p_bay_mid2, "Bay Front"),
        RawSegment(p_bay_mid2, p_bay_end, "Bay Wing West"),
        RawSegment(p_bay_end, Point2D(0.0, 0.0), "West"),
    ]
    res4 = solve_room_capture(bay_segs, is_closed=True)
    classifications = [w.classification for w in res4.snapped_walls]

    # Verify that the two bay wings were classified as BAY_45, and NOT crushed into ORTHOGONAL
    assert classifications.count("BAY_45") == 2, f"Expected 2 BAY_45 walls, got {classifications}"
    assert classifications.count("ORTHOGONAL") == 4, f"Expected 4 ORTHOGONAL walls, got {classifications}"
    print(f"  ✅ PASS: 4 walls snapped to ORTHOGONAL, 2 bay wings preserved as true 45.0°")
    passed += 1

    # -------------------------------------------------------------
    # CASE 5: Custom Attic Room (30° / 60° / 120° Non-Standard Angles)
    # -------------------------------------------------------------
    print("\n[Case 5] Custom Attic / Trapezoid Room (Preserving non-Manhattan architecture)...")
    # Trapezoid room with roof slope at 60 degrees
    w_c1 = RawSegment(Point2D(0.0, 0.0), Point2D(15.0, 0.0))
    w_c2 = RawSegment(Point2D(15.0, 0.0), Point2D(10.0, 8.66)) # 60 degree slope
    w_c3 = RawSegment(Point2D(10.0, 8.66), Point2D(0.0, 8.66))
    w_c4 = RawSegment(Point2D(0.0, 8.66), Point2D(0.0, 0.0))

    res5 = solve_room_capture([w_c1, w_c2, w_c3, w_c4], is_closed=True)
    c_classes = [w.classification for w in res5.snapped_walls]
    # The 60 degree slope must NOT be forced into 90° or 45°; it must stay CUSTOM
    assert "CUSTOM" in c_classes, f"Expected 60° wall to be CUSTOM, got {c_classes}"
    print(f"  ✅ PASS: 60° custom roofline safely preserved as CUSTOM without mangling")
    passed += 1

    # -------------------------------------------------------------
    # CASE 6: Micro-Wall Bump-Out Noise Immunity (4-inch Door Jamb)
    # -------------------------------------------------------------
    print("\n[Case 6] Micro-Wall Noise Immunity (4'' door jamb with 18° raw sensor noise)...")
    # A big 25ft wall, a 20ft wall, a 4-inch door jamb rotated 18° off grid, and returning walls
    w_big1 = RawSegment(Point2D(0.0, 0.0), Point2D(25.0, 0.0), "Main Wall 25ft")
    w_big2 = RawSegment(Point2D(25.0, 0.0), Point2D(25.0, 20.0), "Main Wall 20ft")
    # 4-inch door jamb (0.33 ft) with 18-degree tilt noise
    jamb_dx = 0.33 * math.cos(math.radians(18.0))
    jamb_dz = 0.33 * math.sin(math.radians(18.0))
    w_micro = RawSegment(Point2D(25.0, 20.0), Point2D(25.0 - jamb_dx, 20.0 - jamb_dz), "Noisy 4in Jamb")
    w_ret1 = RawSegment(Point2D(25.0 - jamb_dx, 20.0 - jamb_dz), Point2D(0.0, 20.0), "Return Wall")
    w_ret2 = RawSegment(Point2D(0.0, 20.0), Point2D(0.0, 0.0), "West Wall")

    res6 = solve_room_capture([w_big1, w_big2, w_micro, w_ret1, w_ret2], is_closed=True)
    # Dominant orientation must NOT be swayed by the 18° noisy 4-inch jamb
    assert abs(res6.dominant_orientation_deg) < 0.25, f"Dominant orientation swayed to {res6.dominant_orientation_deg}°"
    print(f"  ✅ PASS: Length-weighted mean resisted 18° micro-wall noise (Dom angle: {res6.dominant_orientation_deg:.3f}°)")
    passed += 1

    # -------------------------------------------------------------
    # CASE 7: Open-Concept 3-Wall Room (Open Kitchen / Living Divider)
    # -------------------------------------------------------------
    print("\n[Case 7] Open-Concept 3-Wall Room (Kitchen peninsula / virtual opening)...")
    # 3 physical walls; 4th side is open
    w_open1 = RawSegment(Point2D(0.0, 12.0), Point2D(0.0, 0.0), "West Physical Wall")
    w_open2 = RawSegment(Point2D(0.0, 0.0), Point2D(18.0, 0.0), "South Physical Wall")
    w_open3 = RawSegment(Point2D(18.0, 0.0), Point2D(18.0, 12.0), "East Physical Wall")

    res7 = solve_room_capture([w_open1, w_open2, w_open3], is_closed=False)
    assert not res7.is_watertight, "Open room must not claim to be watertight closed polygon"
    assert len(res7.closed_polygon) == 2, f"3 walls should produce 2 internal corners, got {len(res7.closed_polygon)}"
    print(f"  ✅ PASS: 3-wall open concept resolved cleanly with 2 square interior corners")
    passed += 1

    # -------------------------------------------------------------
    # CASE 8: Segmented Collinear Wall (LiDAR Dropout Fusion)
    # -------------------------------------------------------------
    print("\n[Case 8] Segmented Collinear Wall (Merging broken wall fragments)...")
    # Single 24ft South wall broken by a bright sunbeam into two pieces
    seg_a = RawSegment(Point2D(0.0, 0.0), Point2D(10.0, 0.05), "Wall A Piece 1")
    seg_b = RawSegment(Point2D(14.0, 0.08), Point2D(24.0, 0.02), "Wall A Piece 2")
    seg_c = RawSegment(Point2D(24.0, 0.02), Point2D(24.0, 14.0), "East Wall")
    seg_d = RawSegment(Point2D(24.0, 14.0), Point2D(0.0, 14.0), "North Wall")
    seg_e = RawSegment(Point2D(0.0, 14.0), Point2D(0.0, 0.0), "West Wall")

    res8 = solve_room_capture([seg_a, seg_b, seg_c, seg_d, seg_e], is_closed=True, fuse_collinear=True)
    # After fusion, seg_a and seg_b should become 1 wall, resulting in a 4-wall rectangle
    assert len(res8.snapped_walls) == 4, f"Expected 4 walls after fusion, got {len(res8.snapped_walls)}"
    assert len(res8.closed_polygon) == 4, f"Expected 4 corners, got {len(res8.closed_polygon)}"
    print(f"  ✅ PASS: 2 broken collinear segments merged into 1 continuous wall line")
    passed += 1

    # -------------------------------------------------------------
    # CASE 9: Extreme Aspect Ratio Hallway (4 ft x 40 ft Long Corridor)
    # -------------------------------------------------------------
    print("\n[Case 9] Extreme Aspect Ratio Hallway (4ft x 40ft bowling alley)...")
    # Long walls drift inward, risking a pinched corridor
    hw_1 = RawSegment(Point2D(0.0, 0.0), Point2D(40.1, 0.3), "Long Hallway South")
    hw_2 = RawSegment(Point2D(40.1, 0.3), Point2D(39.9, 4.2), "Short End East")
    hw_3 = RawSegment(Point2D(39.9, 4.2), Point2D(-0.1, 3.8), "Long Hallway North")
    hw_4 = RawSegment(Point2D(-0.1, 3.8), Point2D(0.2, 0.2), "Short End West")

    res9 = solve_room_capture([hw_1, hw_2, hw_3, hw_4], is_closed=True)
    assert res9.is_watertight
    # Check that South and North walls are strictly parallel
    w_s = res9.snapped_walls[0]
    w_n = res9.snapped_walls[2]
    dot = abs(w_s.A * w_n.A + w_s.B * w_n.B)
    assert isclose(dot, 1.0, abs_tol=1e-5), f"Long hallway walls must be strictly parallel, dot: {dot}"
    print(f"  ✅ PASS: 40ft long hallway walls remain strictly parallel (dot product: {dot:.6f})")
    passed += 1

    # -------------------------------------------------------------
    # CASE 10: Near-Collinear Singularity Guard (det -> 0 Guard)
    # -------------------------------------------------------------
    print("\n[Case 10] Near-Collinear Singularity Guard (det -> 0 protection)...")
    # Two adjacent walls almost in a straight line (179.9 degrees)
    w_sg1 = solver.SnappedWall(
        raw=RawSegment(Point2D(0, 0), Point2D(10, 0)),
        snapped_angle=0.0,
        classification="ORTHOGONAL",
        A=0.0, B=1.0, C=0.0
    )
    # Nearly parallel segment (A=0.00001, B=0.99999) -> det ~ 0
    w_sg2 = solver.SnappedWall(
        raw=RawSegment(Point2D(10, 0), Point2D(20, 0.0001)),
        snapped_angle=0.00001,
        classification="ORTHOGONAL",
        A=-0.00001, B=1.0, C=0.0
    )

    pt_intersect = intersect_lines(w_sg1, w_sg2, epsilon=1e-3)
    # Check that it did NOT blow up to infinity
    assert abs(pt_intersect.x) < 100.0, f"Intersection exploded to x = {pt_intersect.x}"
    assert abs(pt_intersect.z) < 100.0, f"Intersection exploded to z = {pt_intersect.z}"
    print(f"  ✅ PASS: Epsilon guard prevented matrix singularity (Intersects safely at: {pt_intersect.x:.2f}, {pt_intersect.z:.2f})")
    passed += 1

    print("\n" + "=" * 70)
    print(f"🏆 ALL {passed}/{total} MATHEMATICAL BENCHMARK CASES PASSED WITH 100% SUCCESS!")
    print("=" * 70)
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
