// sandbox/src/services/geometryService.ts
import { Room } from '../types/room';

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

export interface PolygonPoint {
  x: number;
  z: number;
}

export interface WallAperture {
  id?: string;
  type: 'door' | 'window';
  startDist: number; // Station distance in meters from wall start (p1)
  endDist: number;   // Station distance in meters from wall start (p1)
  yBottom: number;   // Bottom elevation in meters (0 for doors, sill for windows)
  yTop: number;      // Top elevation in meters (header line: 80" = 2.0320m)
}

export interface WallSubPrism {
  type: 'left_pier' | 'right_pier' | 'mid_pier' | 'header' | 'sill' | 'solid_wall';
  vertices: {
    v0: { x: number; y: number; z: number };
    v1: { x: number; y: number; z: number };
    v2: { x: number; y: number; z: number };
    v3: { x: number; y: number; z: number };
    v4: { x: number; y: number; z: number };
    v5: { x: number; y: number; z: number };
    v6: { x: number; y: number; z: number };
    v7: { x: number; y: number; z: number };
  };
  tMin: number;
  tMax: number;
  yMin: number;
  yMax: number;
}

export const GeometryService = {
  // Certified Architectural Standards (IRC 2024 / AIA CAD)
  EXTERIOR_WALL_THICKNESS_M: 0.1651, // 6.50 inches (2x6 studs + 0.5" OSB + 0.5" drywall)
  INTERIOR_WALL_THICKNESS_M: 0.1143, // 4.50 inches (2x4 studs + 2x0.5" drywall)
  PLUMBING_WALL_THICKNESS_M: 0.1651, // 6.50 inches for plumbing stacks
  HEADER_DATUM_AFF_M: 2.0320,        // 80.0 inches (6'8") universal header height
  BEDROOM_WINDOW_SILL_M: 0.8128,     // 32.0 inches sill height (IRC R310 EERO)
  KITCHEN_WINDOW_SILL_M: 0.9652,     // 38.0 inches sill height (clears counter)
  INTER_STORY_CAVITY_M: 0.2794,      // 11.00 inches floor joist + subfloor + ceiling drywall
  STORY_ELEVATION_STEP_M: 2.7432,    // 9'0" floor-to-floor elevation increment
  GEOM_EPSILON_M: 0.0050,            // 5.0 mm degenerate suppression threshold

  formatFeetInches(totalFeet: number): string {
    const feet = Math.floor(totalFeet);
    const inches = Math.round((totalFeet - feet) * 12);
    if (inches === 12) return `${feet + 1}' 0"`;
    return `${feet}' ${inches}"`;
  },

  formatMetric(totalFeet: number): string {
    const meters = totalFeet * 0.3048;
    return `${meters.toFixed(2)} m`;
  },

  formatAreaSqFt(sqFt: number): string {
    return `${Math.round(sqFt)} sq ft`;
  },

  formatAreaMetric(sqFt: number): string {
    const sqM = sqFt * 0.092903;
    return `${sqM.toFixed(1)} m²`;
  },

  // Perspective 3D projection with depth buffer calculation
  project3D(
    x: number,
    y: number,
    z: number,
    angleX: number,
    angleY: number,
    viewWidth: number,
    viewHeight: number
  ): ProjectedPoint {
    const radX = angleX;
    const radY = angleY;
    const x1 = x * Math.cos(radY) + z * Math.sin(radY);
    const z1 = -x * Math.sin(radY) + z * Math.cos(radY);
    const y2 = y * Math.sin(radX) - z1 * Math.cos(radX);
    const z2 = y * Math.cos(radX) + z1 * Math.sin(radX);

    const fov = 420;
    const scale = fov / (fov + z2 + 280);
    return {
      x: viewWidth / 2 + x1 * scale,
      y: viewHeight / 2 + y2 * scale,
      scale: scale,
      depth: z2,
    };
  },

  // Builds a continuous, watertight closed boundary polygon from scanned walls
  buildRoomPolygon(walls: any[], defaultW = 14, defaultL = 16): PolygonPoint[] {
    if (!walls || walls.length < 3) {
      const hw = defaultW / 2;
      const hl = defaultL / 2;
      return [
        { x: -hw, z: -hl },
        { x: hw, z: -hl },
        { x: hw, z: hl },
        { x: -hw, z: hl },
      ];
    }

    // Extract wall segments
    const segments = walls.map((w) => ({
      p1: { x: w.x1 ?? (w.x - 2), z: w.z1 ?? (w.z - 2) },
      p2: { x: w.x2 ?? (w.x + 2), z: w.z2 ?? (w.z + 2) },
      used: false,
    }));

    const poly: PolygonPoint[] = [];
    const currentSeg = segments[0];
    currentSeg.used = true;
    poly.push({ x: currentSeg.p1.x, z: currentSeg.p1.z });
    let currentPt = currentSeg.p2;

    for (let step = 1; step < segments.length; step++) {
      let bestIdx = -1;
      let bestDist = Infinity;
      let flip = false;

      for (let i = 0; i < segments.length; i++) {
        if (segments[i].used) continue;
        const d1 = Math.hypot(currentPt.x - segments[i].p1.x, currentPt.z - segments[i].p1.z);
        const d2 = Math.hypot(currentPt.x - segments[i].p2.x, currentPt.z - segments[i].p2.z);
        if (d1 < bestDist) {
          bestDist = d1;
          bestIdx = i;
          flip = false;
        }
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = i;
          flip = true;
        }
      }

      if (bestIdx >= 0) {
        const seg = segments[bestIdx];
        seg.used = true;
        if (flip) {
          poly.push({ x: (currentPt.x + seg.p2.x) / 2, z: (currentPt.z + seg.p2.z) / 2 });
          currentPt = seg.p1;
        } else {
          poly.push({ x: (currentPt.x + seg.p1.x) / 2, z: (currentPt.z + seg.p1.z) / 2 });
          currentPt = seg.p2;
        }
      }
    }

    if (poly.length >= 3) {
      return poly;
    }

    const hw = defaultW / 2;
    const hl = defaultL / 2;
    return [
      { x: -hw, z: -hl },
      { x: hw, z: -hl },
      { x: hw, z: hl },
      { x: -hw, z: hl },
    ];
  },

  // Subdivides a wall run into discrete watertight sub-prisms around door and window openings
  subdivideWallWithOpenings(
    p1: { x: number; z: number },
    p2: { x: number; z: number },
    thicknessM: number,
    heightM: number,
    outwardNormal: { x: number; z: number },
    apertures: WallAperture[] = []
  ): WallSubPrism[] {
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const wallLength = Math.hypot(dx, dz);
    const eps = this.GEOM_EPSILON_M; // 5 mm

    if (wallLength < eps) return [];

    const ux = dx / wallLength;
    const uz = dz / wallLength;
    const nx = outwardNormal.x;
    const nz = outwardNormal.z;
    const halfT = thicknessM / 2;

    // Helper to generate a 6-face rectangular sub-prism between station tMin..tMax and elevation yMin..yMax
    const makePrism = (
      type: WallSubPrism['type'],
      tMin: number,
      tMax: number,
      yMin: number,
      yMax: number
    ): WallSubPrism | null => {
      if (tMax - tMin < eps || yMax - yMin < eps) return null;

      // Outer & Inner vertices at tMin
      const ox0 = p1.x + tMin * ux + nx * halfT;
      const oz0 = p1.z + tMin * uz + nz * halfT;
      const ix0 = p1.x + tMin * ux - nx * halfT;
      const iz0 = p1.z + tMin * uz - nz * halfT;

      // Outer & Inner vertices at tMax
      const ox1 = p1.x + tMax * ux + nx * halfT;
      const oz1 = p1.z + tMax * uz + nz * halfT;
      const ix1 = p1.x + tMax * ux - nx * halfT;
      const iz1 = p1.z + tMax * uz - nz * halfT;

      return {
        type,
        tMin,
        tMax,
        yMin,
        yMax,
        vertices: {
          v0: { x: ox0, y: yMin, z: oz0 },
          v1: { x: ox1, y: yMin, z: oz1 },
          v2: { x: ix1, y: yMin, z: iz1 },
          v3: { x: ix0, y: yMin, z: iz0 },
          v4: { x: ox0, y: yMax, z: oz0 },
          v5: { x: ox1, y: yMax, z: oz1 },
          v6: { x: ix1, y: yMax, z: iz1 },
          v7: { x: ix0, y: yMax, z: iz0 },
        },
      };
    };

    // If no openings, return a single solid wall prism
    if (!apertures || apertures.length === 0) {
      const solid = makePrism('solid_wall', 0, wallLength, 0, heightM);
      return solid ? [solid] : [];
    }

    // Filter, clamp, and sort valid apertures along the wall
    const sorted = apertures
      .map((a) => ({
        ...a,
        startDist: Math.max(0, Math.min(wallLength, a.startDist)),
        endDist: Math.max(0, Math.min(wallLength, a.endDist)),
      }))
      .filter((a) => a.endDist - a.startDist >= eps)
      .sort((a, b) => a.startDist - b.startDist);

    if (sorted.length === 0) {
      const solid = makePrism('solid_wall', 0, wallLength, 0, heightM);
      return solid ? [solid] : [];
    }

    const prisms: WallSubPrism[] = [];

    // 1. Left Pier: between station 0 and first opening
    const firstOp = sorted[0];
    if (firstOp.startDist >= eps) {
      const p = makePrism('left_pier', 0, firstOp.startDist, 0, heightM);
      if (p) prisms.push(p);
    }

    // 2. Openings & Intermediate Piers
    for (let i = 0; i < sorted.length; i++) {
      const op = sorted[i];

      // Lintel Header over opening
      const header = makePrism('header', op.startDist, op.endDist, op.yTop, heightM);
      if (header) prisms.push(header);

      // Window Sill under opening (only if yBottom >= eps)
      if (op.yBottom >= eps) {
        const sill = makePrism('sill', op.startDist, op.endDist, 0, op.yBottom);
        if (sill) prisms.push(sill);
      }

      // Mid Pier between current opening and next opening
      if (i < sorted.length - 1) {
        const nextOp = sorted[i + 1];
        if (nextOp.startDist - op.endDist >= eps) {
          const mid = makePrism('mid_pier', op.endDist, nextOp.startDist, 0, heightM);
          if (mid) prisms.push(mid);
        }
      }
    }

    // 3. Right Pier: between last opening and wall end
    const lastOp = sorted[sorted.length - 1];
    if (wallLength - lastOp.endDist >= eps) {
      const p = makePrism('right_pier', lastOp.endDist, wallLength, 0, heightM);
      if (p) prisms.push(p);
    }

    return prisms;
  },

  // Projects detected doors and windows onto wall segments
  projectAperturesOntoWalls(
    walls: { p1: { x: number; z: number }; p2: { x: number; z: number } }[],
    doors: any[] = [],
    windows: any[] = [],
    defaultWindowSillM = 0.8128 // 32.0"
  ): Map<number, WallAperture[]> {
    const apertureMap = new Map<number, WallAperture[]>();
    for (let i = 0; i < walls.length; i++) {
      apertureMap.set(i, []);
    }

    const allOpenings: { type: 'door' | 'window'; cx: number; cz: number; widthM: number; sillM: number }[] = [];

    // Parse doors
    for (const d of doors) {
      let cx = 0, cz = 0, wM = 0.9144; // 36" default
      if (d.x1 !== undefined && d.x2 !== undefined) {
        cx = ((d.x1 + d.x2) / 2) * 0.3048;
        cz = ((d.z1 + d.z2) / 2) * 0.3048;
        wM = (d.widthFt ? d.widthFt * 0.3048 : Math.hypot(d.x2 - d.x1, d.z2 - d.z1) * 0.3048) || 0.9144;
      } else if (d.x !== undefined && d.z !== undefined) {
        cx = d.x * 0.3048;
        cz = d.z * 0.3048;
        wM = (d.widthFt || 3.0) * 0.3048;
      }
      allOpenings.push({ type: 'door', cx, cz, widthM: Math.max(0.6, wM), sillM: 0.0 });
    }

    // Parse windows
    for (const w of windows) {
      // Solution A Disambiguation Guard:
      // If a surface starts at floor level (< 16" / 0.40m) and is full-height (> 6'5" / 1.95m),
      // it is a closed closet or door panel, NOT an exterior window opening. Suppress window void.
      const sillFt = w.sillFt !== undefined ? w.sillFt : (w.yBottomFt !== undefined ? w.yBottomFt : undefined);
      const hFt = w.heightFt;
      if (sillFt !== undefined && hFt !== undefined && sillFt < 1.33 && hFt > 6.4) {
        continue;
      }
      if (w.isCloset || w.type === 'closet') {
        continue;
      }

      let cx = 0, cz = 0, wM = 1.2192; // 48" default
      if (w.x1 !== undefined && w.x2 !== undefined) {
        cx = ((w.x1 + w.x2) / 2) * 0.3048;
        cz = ((w.z1 + w.z2) / 2) * 0.3048;
        wM = (w.widthFt ? w.widthFt * 0.3048 : Math.hypot(w.x2 - w.x1, w.z2 - w.z1) * 0.3048) || 1.2192;
      } else if (w.x !== undefined && w.z !== undefined) {
        cx = w.x * 0.3048;
        cz = w.z * 0.3048;
        wM = (w.widthFt || 4.0) * 0.3048;
      }
      allOpenings.push({ type: 'window', cx, cz, widthM: Math.max(0.6, wM), sillM: defaultWindowSillM });
    }

    for (const op of allOpenings) {
      let bestWallIdx = -1;
      let minPerpDist = Infinity;
      let bestStation = 0;

      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        const dx = w.p2.x - w.p1.x;
        const dz = w.p2.z - w.p1.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.1) continue;
        const ux = dx / len;
        const uz = dz / len;

        const vx = op.cx - w.p1.x;
        const vz = op.cz - w.p1.z;
        const station = vx * ux + vz * uz;
        const perpDist = Math.abs(vx * uz - vz * ux);

        if (station >= -0.3 && station <= len + 0.3) {
          if (perpDist < minPerpDist) {
            minPerpDist = perpDist;
            bestWallIdx = i;
            bestStation = station;
          }
        }
      }

      if (bestWallIdx >= 0 && minPerpDist <= 0.6) {
        const wall = walls[bestWallIdx];
        const wallLen = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.z - wall.p1.z);
        const halfW = op.widthM / 2;
        const sDist = Math.max(0, bestStation - halfW);
        const eDist = Math.min(wallLen, bestStation + halfW);

        if (eDist - sDist >= this.GEOM_EPSILON_M) {
          apertureMap.get(bestWallIdx)!.push({
            type: op.type,
            startDist: sDist,
            endDist: eDist,
            yBottom: op.sillM,
            yTop: this.HEADER_DATUM_AFF_M,
          });
        }
      }
    }

    return apertureMap;
  },

  // Sample architectural templates
  getSampleRooms(): Room[] {
    return [
      {
        id: 'sample-001',
        name: 'Living Room (Sample)',
        length_ft: 18.2,
        width_ft: 14.5,
        height_ft: 9.0,
        area_sqft: 263.9,
        mesh_json: JSON.stringify({
          widthFt: 14.5,
          lengthFt: 18.2,
          heightFt: 9.0,
          walls: [
            { id: 'w0', x1: -7.25, z1: -9.1, x2: 7.25, z2: -9.1, lengthFt: 14.5, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w1', x1: 7.25, z1: -9.1, x2: 7.25, z2: 9.1, lengthFt: 18.2, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w2', x1: 7.25, z1: 9.1, x2: -7.25, z2: 9.1, lengthFt: 14.5, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w3', x1: -7.25, z1: 9.1, x2: -7.25, z2: -9.1, lengthFt: 18.2, heightFt: 9.0, thicknessFt: 0.5 },
          ],
          doors: [{ x1: 0, z1: 9.1, x2: 3.0, z2: 9.1, widthFt: 3.0 }],
          windows: [{ x1: -3.0, z1: -9.1, x2: 3.0, z2: -9.1, widthFt: 6.0 }],
          objects: [
            { id: 'sample-obj-1', category: 'Sofa', x: 0, y: 0, z: -6.5, widthFt: 7.0, heightFt: 2.8, lengthFt: 3.2, yawDeg: 0, dirXx: 1, dirXz: 0, dirZx: 0, dirZz: 1 },
            { id: 'sample-obj-2', category: 'Coffee Table', x: 0, y: 0, z: -2.0, widthFt: 4.2, heightFt: 1.5, lengthFt: 2.2, yawDeg: 0, dirXx: 1, dirXz: 0, dirZx: 0, dirZz: 1 },
            { id: 'sample-obj-3', category: 'Storage / TV Console', x: 0, y: 0, z: 7.2, widthFt: 6.5, heightFt: 2.2, lengthFt: 1.8, yawDeg: 180, dirXx: -1, dirXz: 0, dirZx: 0, dirZz: -1 },
          ],
        }),
        is_sample: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'sample-002',
        name: 'Dining & Kitchen (Sample)',
        length_ft: 15.0,
        width_ft: 12.0,
        height_ft: 9.0,
        area_sqft: 180.0,
        mesh_json: JSON.stringify({
          widthFt: 12.0,
          lengthFt: 15.0,
          heightFt: 9.0,
          walls: [
            { id: 'w0', x1: -6.0, z1: -7.5, x2: 6.0, z2: -7.5, lengthFt: 12.0, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w1', x1: 6.0, z1: -7.5, x2: 6.0, z2: 7.5, lengthFt: 15.0, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w2', x1: 6.0, z1: 7.5, x2: -6.0, z2: 7.5, lengthFt: 12.0, heightFt: 9.0, thicknessFt: 0.5 },
            { id: 'w3', x1: -6.0, z1: 7.5, x2: -6.0, z2: -7.5, lengthFt: 15.0, heightFt: 9.0, thicknessFt: 0.5 },
          ],
          doors: [{ x1: -6.0, z1: 0, x2: -6.0, z2: 3.0, widthFt: 3.0 }],
          windows: [{ x1: -2.5, z1: -7.5, x2: 2.5, z2: -7.5, widthFt: 5.0 }],
        }),
        is_sample: true,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
  },

  // Perpendicular distance from a point to a line segment
  distanceToSegment(
    p: PolygonPoint,
    a: PolygonPoint,
    b: PolygonPoint
  ): { dist: number; t: number; proj: PolygonPoint } {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) {
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      return { dist: d, t: 0, proj: { ...a } };
    }
    let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * dx, z: a.z + t * dz };
    const dist = Math.hypot(p.x - proj.x, p.z - proj.z);
    return { dist, t, proj };
  },

  // Mathematical Fixture & Furniture Magnetic Coupling Engine (Story 4)
  findFixtureCoupling(
    anchor: PolygonPoint,
    rotating: PolygonPoint,
    fixtures: any[],
    angleThresholdDeg = 5.0
  ): {
    isCoupled: boolean;
    coupledAngleDeg: number;
    fixtureId?: string;
    fixtureCategory?: string;
  } | null {
    if (!fixtures || fixtures.length === 0) return null;

    const dx = rotating.x - anchor.x;
    const dz = rotating.z - anchor.z;
    const wallLen = Math.hypot(dx, dz);
    if (wallLen < 0.1) return null;

    let wallAngleDeg = (Math.atan2(dz, dx) * 180) / Math.PI;
    if (wallAngleDeg < 0) wallAngleDeg += 360;

    let bestCoupling: {
      isCoupled: boolean;
      coupledAngleDeg: number;
      fixtureId?: string;
      fixtureCategory?: string;
      diffDeg: number;
    } | null = null;

    for (const fix of fixtures) {
      const fixX = fix.x ?? 0;
      const fixZ = fix.z ?? 0;
      const fixW = fix.widthFt || 3.0;
      const fixL = fix.lengthFt || 3.0;
      const fixYaw = ((fix.yawDeg ?? 0) % 360 + 360) % 360;

      // Distance from fixture center to wall line segment
      const { dist } = this.distanceToSegment({ x: fixX, z: fixZ }, anchor, rotating);
      const fixtureRadius = Math.max(fixW, fixL) / 2;

      // Proximity check: only evaluate fixtures near the wall (radius + 2.5 ft)
      if (dist > fixtureRadius + 2.5) continue;

      // Fixture principal alignment angles: parallel and perpendicular
      const targetAngles = [
        fixYaw,
        (fixYaw + 90) % 360,
        (fixYaw + 180) % 360,
        (fixYaw + 270) % 360,
      ];

      for (const targetDeg of targetAngles) {
        let diff = Math.abs(wallAngleDeg - targetDeg);
        if (diff > 180) diff = 360 - diff;

        if (diff <= angleThresholdDeg) {
          if (!bestCoupling || diff < bestCoupling.diffDeg) {
            bestCoupling = {
              isCoupled: true,
              coupledAngleDeg: targetDeg,
              fixtureId: fix.id || fix.category,
              fixtureCategory: fix.category || 'Fixture',
              diffDeg: diff,
            };
          }
        }
      }
    }

    return bestCoupling;
  },

  // Calculate Anchor and Rotated Vertex with Magnetic Snap
  calculateAnchorAndRotation(
    p1: PolygonPoint,
    p2: PolygonPoint,
    touchPt: PolygonPoint,
    currentPt: PolygonPoint,
    snapThresholdDeg = 6.0,
    fixtures?: any[]
  ): {
    anchor: PolygonPoint;
    anchorIdx: number; // 0 for p1, 1 for p2
    rotating: PolygonPoint;
    angleDeg: number;
    isSnapped: boolean;
    snappedAxis: 'vertical' | 'horizontal' | 'fixture' | null;
    fixtureName?: string;
  } {
    const d1 = Math.hypot(touchPt.x - p1.x, touchPt.z - p1.z);
    const d2 = Math.hypot(touchPt.x - p2.x, touchPt.z - p2.z);

    // Furthest endpoint from touch point is the anchor
    const anchorIdx = d1 >= d2 ? 0 : 1;
    const anchor = anchorIdx === 0 ? { ...p1 } : { ...p2 };

    const dx = currentPt.x - anchor.x;
    const dz = currentPt.z - anchor.z;
    const dragDist = Math.hypot(dx, dz);
    const minLength = 1.0; // Enforce minimum wall length 1.0 ft
    const effectiveLength = Math.max(minLength, dragDist);

    let angleRad = Math.atan2(dz, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    let isSnapped = false;
    let snappedAxis: 'vertical' | 'horizontal' | 'fixture' | null = null;
    let finalAngleRad = angleRad;
    let fixtureName: string | undefined = undefined;

    // 1. Check snapping to cardinal directions: 0 (East), 90 (South/Down), 180 (West), 270 (North/Up)
    const cardinalSnaps = [
      { deg: 0, axis: 'horizontal' as const },
      { deg: 90, axis: 'vertical' as const },
      { deg: 180, axis: 'horizontal' as const },
      { deg: 270, axis: 'vertical' as const },
      { deg: 360, axis: 'horizontal' as const },
    ];

    for (const snap of cardinalSnaps) {
      if (Math.abs(angleDeg - snap.deg) <= snapThresholdDeg) {
        isSnapped = true;
        snappedAxis = snap.axis;
        finalAngleRad = (snap.deg % 360) * (Math.PI / 180);
        angleDeg = snap.deg % 360;
        break;
      }
    }

    // 2. Check Magnetic Coupling with nearby furniture & fixtures (Story 4)
    if (!isSnapped && fixtures && fixtures.length > 0) {
      const candidateRot = {
        x: anchor.x + effectiveLength * Math.cos(angleRad),
        z: anchor.z + effectiveLength * Math.sin(angleRad),
      };
      const coupling = this.findFixtureCoupling(anchor, candidateRot, fixtures, snapThresholdDeg);
      if (coupling && coupling.isCoupled) {
        isSnapped = true;
        snappedAxis = 'fixture';
        fixtureName = coupling.fixtureCategory;
        finalAngleRad = coupling.coupledAngleDeg * (Math.PI / 180);
        angleDeg = coupling.coupledAngleDeg;
      }
    }

    const rotating: PolygonPoint = {
      x: anchor.x + effectiveLength * Math.cos(finalAngleRad),
      z: anchor.z + effectiveLength * Math.sin(finalAngleRad),
    };

    return {
      anchor,
      anchorIdx,
      rotating,
      angleDeg,
      isSnapped,
      snappedAxis,
      fixtureName,
    };
  },

  // Check if polygon self-intersects
  isPolygonSelfIntersecting(polygon: PolygonPoint[]): boolean {
    const n = polygon.length;
    if (n < 4) return false;

    const ccw = (a: PolygonPoint, b: PolygonPoint, c: PolygonPoint) => {
      return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x);
    };

    const segmentsIntersect = (p1: PolygonPoint, p2: PolygonPoint, p3: PolygonPoint, p4: PolygonPoint) => {
      return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
    };

    for (let i = 0; i < n; i++) {
      const a1 = polygon[i];
      const a2 = polygon[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // Adjacent wrap-around segments
        const b1 = polygon[j];
        const b2 = polygon[(j + 1) % n];
        if (segmentsIntersect(a1, a2, b1, b2)) {
          return true;
        }
      }
    }
    return false;
  },

  // Convert a closed polygon to the standard RoomCapture mesh walls array
  polygonToWalls(polygon: PolygonPoint[], originalWalls?: any[], wallHeightFt = 8.1): any[] {
    const n = polygon.length;
    const newWalls: any[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      const lenFt = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      const yaw = Math.atan2(p2.z - p1.z, p2.x - p1.x) * (180 / Math.PI);
      const orig = originalWalls && originalWalls[i] ? originalWalls[i] : {};

      newWalls.push({
        ...orig,
        id: orig.id || `wall-${i}`,
        x: +midX.toFixed(2),
        y: orig.y ?? 0,
        z: +midZ.toFixed(2),
        x1: +p1.x.toFixed(2),
        z1: +p1.z.toFixed(2),
        x2: +p2.x.toFixed(2),
        z2: +p2.z.toFixed(2),
        lengthFt: +lenFt.toFixed(2),
        heightFt: orig.heightFt || wallHeightFt,
        thicknessFt: orig.thicknessFt || 0.54,
        yawDeg: Math.round(yaw),
      });
    }
    return newWalls;
  },

  // Dissolve a spurious acute apex vertex into a clean rectangular corner
  dissolveSpuriousApex(polygon: PolygonPoint[], apexIdx: number): PolygonPoint[] {
    const n = polygon.length;
    if (n <= 3) return polygon;

    const prevIdx = (apexIdx - 1 + n) % n;
    const nextIdx = (apexIdx + 1) % n;
    const prevPt = polygon[prevIdx];
    const apexPt = polygon[apexIdx];
    const nextPt = polygon[nextIdx];

    const dx1 = Math.abs(apexPt.x - prevPt.x);
    const dz1 = Math.abs(apexPt.z - prevPt.z);

    let newCorner: PolygonPoint;
    if (dx1 >= dz1) {
      newCorner = { x: nextPt.x, z: prevPt.z };
    } else {
      newCorner = { x: prevPt.x, z: nextPt.z };
    }

    const updated = [...polygon];
    updated[apexIdx] = newCorner;
    return updated;
  },
};
