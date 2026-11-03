# Spatial Capture Engine: Mathematical Architecture & Verification Plan
**Clean-Room Architectural Geometry Pipeline for Precision Mobile LiDAR Capture**

---

## 1. Executive Summary & Clean-Room IP Statement

### 1.1 IP Protection & Academic Grounding
This architecture is developed under strict **Clean-Room Design principles**. We explicitly avoid copying or reverse-engineering proprietary commercial pipelines. Instead, all mathematical formulations, optimization objectives, and algorithms in this pipeline are derived directly from open, peer-reviewed academic computer science and robotics literature:
- **Dai et al. (Princeton / Stanford)**: *Real-time Globally Consistent 3D Reconstruction using Online Loop Closure* (Dynamic keyframe de-integration & loop closure)
- **Zhang et al.**: *Fast Pose Tracking of Rigid Objects with Compact Pose Graph Optimization* (Lightweight relative-pose constraints)
- **Spatial Science (Taylor & Francis)**: *Globally consistent dense 3D reconstruction with loop closure detection based on depth maps* (Photometric-invariant geometric curvature & normal revisitation)
- **Fan et al. (MIT SPARK Lab)**: *Distributed Certifiably Correct Pose-Graph Optimization* (Convex relaxation, global optimality guarantees, local minima elimination)
- **Li et al. / Tombari Lab (IEEE RAL)**: *Structure-SLAM: Low-Drift Monocular Immersive SLAM in Indoor Environments* (Weak Manhattan World structural priors & normal clustering)
- **Du et al.**: *Mobile-GS: Real-time Gaussian Splatting for Mobile Devices* (Order-independent mobile rasterization at 100+ FPS)
- **PocketSplat**: *Mobile Gaussian Reconstruction via World-Space Latent Allocation* (Fixed-memory budget mobile splat generation)

### 1.2 Core Problem Definition
Raw mobile LiDAR scanning (via ARKit / RoomPlan) suffers from **temporal odometry drift**:
1. Frame-to-frame local tracking accumulates angular ($\Delta \theta$) and translational ($\Delta d$) errors.
2. Long walks around a room result in open loop gaps ($2''$ to $8''$), non-parallel walls, and skewed corners ($87^{\circ}$ to $93^{\circ}$).
3. Short wall features (HVAC chases, door jambs) suffer high angular noise due to small baseline length.
4. Featureless white drywall causes visual point tracking to slip.

---

## 2. Phase 1: Pure Mathematical Formulations

The pipeline is structured as an **Orthogonal-Manhattan Topological Loop Closure (OM-TLC)** engine operating in $\mathbb{R}^2$ on wall centerlines and planar projections:

### Module 1: Length-Weighted Modulo-$90^{\circ}$ Circular Mean ($\theta_{\text{dom}}$)
To find the building's true dominant structural orientation without being distorted by short noisy segments:
1. For each wall segment $i$ with length $L_i$ and raw orientation angle $\alpha_i \in [-\pi, \pi]$:
   Map $\alpha_i$ into the modulo-$90^{\circ}$ circular domain ($4\alpha_i$):
   $$\theta_i = 4 \alpha_i$$
2. Compute the length-weighted circular vector sum:
   $$S = \sum_{i=1}^N L_i \sin(\theta_i), \quad C = \sum_{i=1}^N L_i \cos(\theta_i)$$
3. The dominant angle $\theta_{\text{dom}} \in [-\frac{\pi}{4}, \frac{\pi}{4}]$ is:
   $$\theta_{\text{dom}} = \frac{1}{4} \operatorname{atan2}(S, C)$$
*Key Property*: A $20\text{ ft}$ wall has $60\times$ more voting weight than a $4\text{ in}$ door jamb.

### Module 2: Dual-Threshold Angular Quantization with Hysteresis
Instead of forcing all walls into $90^{\circ}$, classify each wall $i$ relative to $\theta_{\text{dom}}$:
- Let $\Delta \theta_i = \operatorname{normAngle}(\alpha_i - \theta_{\text{dom}})$.
- Compute angular distance to nearest orthogonal axis:
  $$\delta_{90} = \min_{k \in \{0, 1, 2, 3\}} |\Delta \theta_i - k \cdot 90^{\circ}|$$
- Compute angular distance to nearest $45^{\circ}$ semi-Manhattan axis:
  $$\delta_{45} = \min_{m \in \{0, 1, 2, 3\}} |\Delta \theta_i - (m \cdot 90^{\circ} + 45^{\circ})|$$
- **Classification Decision Rule**:
  1. If $\delta_{90} \le \tau_{\text{ortho}}$ (default $7.5^{\circ}$): Snap to nearest $k \cdot 90^{\circ} + \theta_{\text{dom}}$.
  2. Else if $\delta_{45} \le \tau_{\text{bay}}$ (default $4.0^{\circ}$): Snap to nearest $m \cdot 90^{\circ} + 45^{\circ} + \theta_{\text{dom}}$ (Bay Window / Diagonal).
  3. Else: **Preserve true architected angle** $\alpha_i$ (Acute/Obtuse custom architectural feature).

### Module 3: Constrained Orthogonal Least-Squares Projection
For each snapped wall $i$, find line equation $A_i x + B_i z + C_i = 0$ with normal $\vec{n}_i = (A_i, B_i) = (\cos \phi_i, \sin \phi_i)$:
- Center of mass of raw segment endpoints $P_{i,1}, P_{i,2}$:
  $$\bar{x}_i = \frac{x_{i,1} + x_{i,2}}{2}, \quad \bar{z}_i = \frac{z_{i,1} + z_{i,2}}{2}$$
- The constant $C_i$ that minimizes orthogonal displacement $\sum d_j^2$:
  $$C_i = - (A_i \bar{x}_i + B_i \bar{z}_i)$$

### Module 4: Determinant-Guarded Line-Line Intersection ($\det \to 0$ Guard)
For adjacent sequential walls $i$ and $j = (i+1) \pmod N$:
- Form linear system:
  $$\begin{pmatrix} A_i & B_i \\ A_j & B_j \end{pmatrix} \begin{pmatrix} x^* \\ z^* \end{pmatrix} = \begin{pmatrix} -C_i \\ -C_j \end{pmatrix}$$
- Determinant:
  $$\det = A_i B_j - A_j B_i = \sin(\phi_j - \phi_i)$$
- **Numerical Stability Guard**:
  - If $|\det| \ge \epsilon$ (where $\epsilon = 10^{-4}$):
    $$\begin{pmatrix} x^* \\ z^* \end{pmatrix} = \frac{1}{\det} \begin{pmatrix} B_j & -B_i \\ -A_j & A_i \end{pmatrix} \begin{pmatrix} -C_i \\ -C_j \end{pmatrix}$$
  - If $|\det| < \epsilon$ (Near-collinear adjacent segments):
    Apply midpoint bridge projection to prevent infinite projection coordinates.

### Module 5: Collinear Segment Fusion (LiDAR Dropout Repair)
If two disjoint segments $i$ and $k$ share:
1. Parallel snapped normals: $|\vec{n}_i \cdot \vec{n}_k| \ge 1 - 10^{-4}$
2. Co-planar offset distance: $|C_i - C_k| \le \text{gap}_{\text{tol}}$ ($1.5\text{ inches}$)
3. Longitudinal overlap or proximity:
Merge into a single continuous wall segment spanning the extreme endpoints.

### Module 6: Parent-Child Kinematic Transformation (Openings & Fixtures)
Doors, windows, openings, and furniture objects detected by RoomPlan exist in raw 3D space with transform matrices $\mathbf{T}_{\text{child}} \in \mathrm{SE}(3)$. When host wall $i$ is rotated by $\Delta \theta_i$ and translated by $\Delta \mathbf{p}_i$ during loop closure, every attached opening and object must inherit the exact same transformation:
1. Compute relative local transform within host wall's raw coordinate frame:
   $$\mathbf{T}_{\text{local}} = (\mathbf{T}_{\text{wall}}^{\text{raw}})^{-1} \cdot \mathbf{T}_{\text{child}}^{\text{raw}}$$
2. Apply updated host wall pose after mathematical snapping and loop closure:
   $$\mathbf{T}_{\text{child}}^{\text{snapped}} = \mathbf{T}_{\text{wall}}^{\text{snapped}} \cdot \mathbf{T}_{\text{local}}$$
3. **Planar Constraint Enforcement**:
   - Window sill elevation $y_{\text{sill}}$ and door bottom $y = 0$ remain strictly locked to floor plane.
   - Opening normal vector $\vec{n}_{\text{opening}}$ is strictly locked to host wall normal $\vec{n}_{\text{wall}}$.

### Module 7: Physical Wall Thickness Offsetting & 3D Watertight Solid Extrusion
Architectural floor plans and 3D solid models require finite physical wall thickness ($t = 4.5''$ for interior $2\times4$ drywall, $t = 6.5''$ for exterior $2\times6$ partitions):
1. **Half-Thickness Face Offsets**:
   For wall segment with centerline endpoints $P_1, P_2$ and unit normal $\vec{n} = (A, B)$:
   $$\text{Inner Line: } A x + B z + (C - \frac{t}{2}) = 0$$
   $$\text{Outer Line: } A x + B z + (C + \frac{t}{2}) = 0$$
2. **Mitered Corner Resolution**:
   At a corner where adjacent walls meet at interior angle $\alpha \in (0, 2\pi)$, the miter offset distance along the angle bisector $\vec{b}$ is:
   $$d_{\text{miter}} = \frac{t / 2}{\sin(\alpha / 2)}$$
   - *Guard against extreme sharp miters*: If $\alpha < 30^{\circ}$, bevel the miter to prevent needle-thin corner spikes.
3. **3D Solid Extrusion & Cutout Voids**:
   - Base elevation $Y = 0$ (floor) to $Y = H$ (ceiling height).
   - Door cutouts: zero triangles generated between $Y = 0$ and $Y = h_{\text{door}}$ ($80''$ standard door height).
   - Window cutouts: zero triangles generated between $Y = y_{\text{sill}}$ ($36''$) and $Y = y_{\text{sill}} + h_{\text{win}}$ ($48''$).

### Module 8: ARKit $(X, Y, Z)$ Spatial Coordinate Bridge
ARKit uses a **Right-Handed, Y-Up** coordinate system (in meters). CAD and architectural software use top-down floor plans (often in feet/inches):
1. **Coordinate Projection**:
   $$\begin{pmatrix} x_{\text{CAD}} \\ z_{\text{CAD}} \end{pmatrix} = s \cdot \begin{pmatrix} X_{\text{ARKit}} \\ Z_{\text{ARKit}} \end{pmatrix}, \quad y_{\text{elevation}} = s \cdot Y_{\text{ARKit}}$$
   where scale factor $s = 3.280839895\text{ ft/m}$ (exact IEEE 754 float precision).
2. **Floor Level Alignment**:
   Gravity alignment vector from CoreMotion accelerometer $\vec{g} = (g_x, g_y, g_z)$ ensures horizontal slicing is strictly perpendicular to gravity ($\vec{n}_{\text{floor}} = (0, 1, 0)$).

---

## 3. Phase 2: Verification Protocol & Stress-Test Battery

### 3.1 Pass A: The Mathematician's Stress Test (Python Implementation)
Executed via standalone pure-math Python test suite (`spatial-capture-engine/tests/test_stress_battery.py`):
1. **Case 1: Standard 4-Wall Rectangle with 5.4-inch Drift Loop Gap**
2. **Case 2: L-Shaped Multi-Corner Room (4 Outside + 2 Reflex Corners)**
3. **Case 3: U-Shaped Wrap-Around Corridor (Compounding 60-second drift)**
4. **Case 4: Intentional 45°/135° Bay Window (Strict Right Angles + Preserved Bay)**
5. **Case 5: Acute/Obtuse Custom Room (30°/60°/120° Attic Walls preserved)**
6. **Case 6: Micro-Wall Bump-Out (4-inch door jamb / plumbing chase noise filtering)**
7. **Case 7: Open-Concept 3-Wall Room (Kitchen/Living transition with virtual boundary)**
8. **Case 8: Segmented Collinear Wall (LiDAR dropout fusion)**
9. **Case 9: Extreme Aspect Ratio Hallway (4 ft x 40 ft narrow corridor drift)**
10. **Case 10: Near-Collinear Singularity Guard (179.8° intersection stability)**

### 3.2 Pass B: iOS Systems & Mobile Performance Review
- Time complexity: Must be $O(N \log N)$ or $O(N)$ for $N \le 100$ walls.
- Execution latency budget: $< 25\text{ ms}$ on Apple Silicon (A16/A17/A18/M-series).
- Memory budget: Zero heap allocations during loop relaxation (stack-allocated vectors).

### 3.3 Pass C: Architectural Field Sanity Check
- Area conservation: Calculated polygon area must remain within $\pm 0.5\%$ of physical room.
- Wall thickness consistency: Structural partitions must maintain realistic standard thicknesses ($4.5''$ interior, $6.5''$ exterior).

---

## 4. Phase 3: Handoff to Implementation Engineer (Detailed Execution Protocol)

The coder implementing this engine in production must execute the following 4 milestones:

### Milestone 1: Swift Native Geometry Optimizer (`RoomGeometryOptimizer.swift`)
- Port `sandbox/spatial-capture-engine/math/solver.py` into native Swift.
- Use Apple's `simd` framework (`SIMD2<Double>`) for all 2D vector operations:
  - Dot products, cross products, and line-line intersections map directly to ARM NEON hardware registers.
  - Guarantees sub-millisecond execution ($< 0.1\text{ ms}$) with zero heap allocations.

### Milestone 2: Native Hook in `RoomCaptureViewController.swift`
- In `captureView(shouldPresent:for:)` and `captureSession(_:didEndWith:error:)`:
  1. Extract raw walls, doors, windows, and openings from `CapturedRoom`.
  2. Feed wall centerlines into `RoomGeometryOptimizer.solve(rawWalls)`.
  3. Apply parent-child kinematic transform to update doors and windows.
  4. Generate watertight `mesh_json` containing closed polygon, dimensions, and cutouts.
  5. Pass clean, closed, watertight JSON through React Native bridge to `RoomPlanModule.swift`.

### Milestone 3: TypeScript CAD Invariant Verification
- In `GeometryService.ts`, consume the snapped polygon:
  - Verify `shoelaceArea` matches physical room area.
  - Verify wall segments display crisp rounded dimensions ($16\text{' }0''$ rather than $16\text{' }0.184''$).
  - Render 2D SVG walls with mitered thickness and opening cutouts.

### Milestone 4: Hardware Verification & Parity
- Run headless automated tests (`npm run test:fixture`).
- Deploy to physical iPhone (`00008150-001A25222205401C`) and verify live room scans produce $100\%$ closed, watertight, square floor plans on device.

---

## 5. Phase 4: Photorealistic Radiance Extension (Mobile-GS & PocketSplat Integration)

### 5.1 The Dual-Layer Spatial Computing Paradigm
Spatial room models require two distinct representations to satisfy both technical and consumer use-cases:
1. **Layer 1: The Metric Skeleton (Our OM-TLC Engine)**:
   - Watertight CAD polygons, millimeter-accurate dimensions, structural wall thicknesses, opening cutouts, and certified square footage.
   - Purpose: Contractors, architects, structural engineers, appraisers, and BIM/CAD export.
2. **Layer 2: The Photorealistic Skin (Mobile-GS & PocketSplat)**:
   - Continuous 3D Gaussian radiance fields capturing real-world lighting, wall textures, paint sheens, flooring grain, and material reflections.
   - Purpose: Immersive 100+ FPS mobile virtual walkthroughs for homeowners and real-estate buyers.

```
       [Raw LiDAR Point Cloud + RGB Camera Keyframes]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Layer 1: Metric Skeleton]        [Layer 2: Photoreal Radiance]
      OM-TLC Structural Math            PocketSplat & Mobile-GS
            │                                 │
   - Watertight CAD Polygons         - World-Space Latent Allocation
   - Loop Closure (0.000'' Gap)      - Hard Hardware Memory Budget
   - Mitered Wall Thicknesses        - Depth-Aware OIT (Zero Sorting)
   - DXF / CAD / SVG / STL           - 100+ FPS Metal Walkthrough
            │                                 │
            └───────────────┬─────────────────┘
                            ▼
           [Unified Dual-Layer Spatial Model]
```

### 5.2 CAD-Constrained Gaussian Initialization (Eliminating Floaters)
Standard Gaussian Splatting trained on raw cameras suffers from "floaters" (stray Gaussians hovering in mid-air). 
Our pipeline solves this by using Layer 1's snapped CAD geometry as a **Hard Structural Prior**:
- Gaussians are seeded directly on the mathematically closed wall planes $A_i x + B_i z + C_i = 0$ and the floor plane $Y = 0$.
- Gaussian anisotropic scales are constrained parallel to wall tangent planes ($\vec{v} = (\cos \phi_i, 0, \sin \phi_i)$), preventing Gaussians from bleeding through walls or protruding into adjacent rooms.

### 5.3 PocketSplat: World-Space Latent Budget Allocation
*(Derived from: PocketSplat — Mobile Gaussian Reconstruction via World-Space Latent Allocation, 2026)*
To prevent mobile Out-of-Memory (OOM) crashes on iOS:
- The user or device profile defines a strict hardware budget envelope (e.g., $150,000$ Gaussians max, $< 25\text{MB}$ RAM).
- PocketSplat divides the Layer 1 closed room volume into a grid of 3D world-space latent cells.
- Integer Gaussian capacities are distributed adaptively:
  - Dense allocations to visually complex regions (furniture, cabinetry, window trim, fireplaces).
  - Sparse allocations to flat, uniform drywall surfaces.
- Decodes complete Gaussian attributes exclusively for the budgeted candidates.

### 5.4 Mobile-GS: Order-Independent Metal Rasterization (100+ FPS)
*(Derived from: Mobile-GS — Real-time Gaussian Splatting for Mobile Devices, Du et al., 2026)*
To render photorealistic splats on an iPhone without thermal throttling:
1. **Elimination of the $O(N \log N)$ Sorting Bottleneck**:
   - Replaces traditional CPU/GPU alpha-blending back-to-front sorting with **Depth-Aware Order-Independent Transparency (OIT)**.
2. **Neural View-Dependent Enhancement**:
   - Uses lightweight spherical harmonics (SH) distillation and neural vector quantization to restore view-dependent specular highlights and eliminate transparency artifacts.
3. **Apple Metal Implementation**:
   - Implemented via compute shaders on Apple Silicon GPUs (A16/A17/A18 Pro), achieving **100+ FPS** rendering at native iPhone retina resolutions while consuming $< 15\text{MB}$ storage.
