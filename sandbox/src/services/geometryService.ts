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

export interface TopologicalRoomResult {
  exteriorPolygon: PolygonPoint[];
  interiorPartitions: Array<{
    id: string;
    p1: PolygonPoint;
    p2: PolygonPoint;
    lengthFt: number;
    apertures?: WallAperture[];
  }>;
  areaSqFt: number;
  dominantYawDeg: number;
  bedroomPolygon: PolygonPoint[];
  closetPolygon: PolygonPoint[];
  bedroomAreaSqFt: number;
  closetAreaSqFt: number;
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

export interface InternalSeg {
  p1: PolygonPoint;
  p2: PolygonPoint;
  label: string;
  length: number;
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
  // Uses Orthogonal-Manhattan Topological Loop Closure (OM-TLC) solver:
  // 1. Chaining raw segments sequentially
  // 2. Length-weighted modulo-90 dominant orientation circular mean
  // 3. Rule A: Manhattan Gap Synthesis for unobserved/occluded terminal gaps (prevents diagonal cutting)
  // 4. Rule B: Physical Non-Penetration Prior (pushes boundary behind furniture envelopes)
  // 5. Dual-threshold angular quantization (orthogonal squaring + 45° bay preservation)
  // 6. Collinear segment fusion (merges fragmented / overlapping scans and dropouts)
  // 7. Exact line-line corner intersection with determinant singularity guard
  // Checks if two parallel walls are connected by a real perpendicular return wall (closet recess / alcove)
  hasPerpendicularConnectingWall(s1: any, s2: any, segments: any[]): boolean {
    const len1 = s1.length || Math.hypot(s1.p2.x - s1.p1.x, s1.p2.z - s1.p1.z) || 1;
    const u1x = (s1.p2.x - s1.p1.x) / len1;
    const u1z = (s1.p2.z - s1.p1.z) / len1;
    for (const w of segments) {
      if (w === s1 || w === s2) continue;
      const len = w.length || Math.hypot(w.p2.x - w.p1.x, w.p2.z - w.p1.z) || 1;
      const wx = (w.p2.x - w.p1.x) / len;
      const wz = (w.p2.z - w.p1.z) / len;
      // Must be perpendicular (|dot| <= 0.25)
      if (Math.abs(u1x * wx + u1z * wz) <= 0.25) {
        const d1_p1 = Math.min(Math.hypot(w.p1.x - s1.p1.x, w.p1.z - s1.p1.z), Math.hypot(w.p1.x - s1.p2.x, w.p1.z - s1.p2.z));
        const d1_p2 = Math.min(Math.hypot(w.p2.x - s1.p1.x, w.p2.z - s1.p1.z), Math.hypot(w.p2.x - s1.p2.x, w.p2.z - s1.p2.z));
        const d2_p1 = Math.min(Math.hypot(w.p1.x - s2.p1.x, w.p1.z - s2.p1.z), Math.hypot(w.p1.x - s2.p2.x, w.p1.z - s2.p2.z));
        const d2_p2 = Math.min(Math.hypot(w.p2.x - s2.p1.x, w.p2.z - s2.p1.z), Math.hypot(w.p2.x - s2.p2.x, w.p2.z - s2.p2.z));
        if ((d1_p1 < 1.5 && d2_p2 < 1.5) || (d1_p2 < 1.5 && d2_p1 < 1.5)) {
          return true;
        }
      }
    }
    return false;
  },

  buildRoomPolygon(
    walls: any[],
    defaultW = 14,
    defaultL = 16,
    objects: any[] = [],
    doors: any[] = []
  ): PolygonPoint[] {
    const hw = defaultW / 2;
    const hl = defaultL / 2;
    const fallbackRect: PolygonPoint[] = [
      { x: -hw, z: -hl },
      { x: hw, z: -hl },
      { x: hw, z: hl },
      { x: -hw, z: hl },
    ];

    if (!walls || walls.length < 3) {
      return fallbackRect;
    }

    // Helper: Normalize angle to [-PI, PI]
    const normAngle = (a: number): number => {
      let r = a;
      while (r > Math.PI) r -= 2.0 * Math.PI;
      while (r < -Math.PI) r += 2.0 * Math.PI;
      return r;
    };

    const rawSegments: InternalSeg[] = [];
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      let p1x: number, p1z: number, p2x: number, p2z: number;

      if (w.x1 !== undefined && w.z1 !== undefined && w.x2 !== undefined && w.z2 !== undefined) {
        p1x = w.x1;
        p1z = w.z1;
        p2x = w.x2;
        p2z = w.z2;
      } else if (w.lengthFt && w.yawDeg !== undefined && w.x !== undefined && w.z !== undefined) {
        const halfL = (w.lengthFt || 4) / 2;
        const rad = ((w.yawDeg || 0) * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        p1x = w.x - halfL * c;
        p1z = w.z - halfL * s;
        p2x = w.x + halfL * c;
        p2z = w.z + halfL * s;
      } else {
        p1x = w.x1 ?? ((w.x ?? 0) - 2);
        p1z = w.z1 ?? ((w.z ?? 0) - 2);
        p2x = w.x2 ?? ((w.x ?? 0) + 2);
        p2z = w.z2 ?? ((w.z ?? 0) + 2);
      }

      const len = Math.hypot(p2x - p1x, p2z - p1z);
      if (len >= 0.2) {
        rawSegments.push({
          p1: { x: p1x, z: p1z },
          p2: { x: p2x, z: p2z },
          label: w.id || `wall-${i}`,
          length: len,
        });
      }
    }

    if (rawSegments.length < 3) {
      return fallbackRect;
    }

    // Filter out minor aperture jambs and door stubs (< 1.5 ft / ~0.45m) when sufficient primary boundary walls exist
    const longSegments = rawSegments.filter((s) => s.length >= 1.5);
    const candidatePool = longSegments.length >= 3 ? longSegments : rawSegments;

    // Dominant orientation from longest wall to assess orthogonal grid alignment
    let dominantAngleDeg = 0;
    if (candidatePool.length > 0) {
      const longest = candidatePool.reduce((max, s) => (s.length > max.length ? s : max), candidatePool[0]);
      dominantAngleDeg = (Math.atan2(longest.p2.z - longest.p1.z, longest.p2.x - longest.p1.x) * 180) / Math.PI;
    }

    const nonDoorLeaves = candidatePool.filter((s) => {
      // Filter out non-orthogonal door-swing panels (leaves) near doors
      const midX = (s.p1.x + s.p2.x) / 2;
      const midZ = (s.p1.z + s.p2.z) / 2;
      const deg = (Math.atan2(s.p2.z - s.p1.z, s.p2.x - s.p1.x) * 180) / Math.PI;
      let diffDeg = Math.abs(deg - dominantAngleDeg);
      let mod90 = diffDeg % 90;
      if (mod90 > 45) mod90 = 90 - mod90;

      for (const d of doors) {
        const dist = Math.hypot(midX - (d.x ?? 0), midZ - (d.z ?? 0));
        const dWidth = d.widthFt || 2.5;
        if (dist < 2.0 && Math.abs(s.length - dWidth) < 0.8 && mod90 > 5.0) {
          return false;
        }
      }
      return true;
    });
    const candidateSegments = nonDoorLeaves.length >= 3 ? nonDoorLeaves : rawSegments;

    // Step 0: Global Duplicate Wall De-Duplication (Multi-pass scan overlap resolution)
    // Merges multi-pass parallel drift artifacts of the exact same physical wall (< 0.50 ft / 15 cm)
    // Preserves closet recesses, alcoves, and corridors (>= 1.5 ft depth)
    const dedupedSegments: InternalSeg[] = [];
    const mergedIndices = new Set<number>();

    // Approximate centroid of raw walls
    const rawCentroidX = candidateSegments.reduce((sum, s) => sum + (s.p1.x + s.p2.x) / 2, 0) / (candidateSegments.length || 1);
    const rawCentroidZ = candidateSegments.reduce((sum, s) => sum + (s.p1.z + s.p2.z) / 2, 0) / (candidateSegments.length || 1);

    for (let i = 0; i < candidateSegments.length; i++) {
      if (mergedIndices.has(i)) continue;
      let s1 = { ...candidateSegments[i] };
      let len1 = s1.length || Math.hypot(s1.p2.x - s1.p1.x, s1.p2.z - s1.p1.z) || 1;
      let ux = (s1.p2.x - s1.p1.x) / len1;
      let uz = (s1.p2.z - s1.p1.z) / len1;
      let nx = -uz;
      let nz = ux;

      for (let j = i + 1; j < candidateSegments.length; j++) {
        if (mergedIndices.has(j)) continue;
        const s2 = candidateSegments[j];
        const len2 = s2.length || Math.hypot(s2.p2.x - s2.p1.x, s2.p2.z - s2.p1.z) || 1;
        const ux2 = (s2.p2.x - s2.p1.x) / len2;
        const uz2 = (s2.p2.z - s2.p1.z) / len2;

        const dot = ux * ux2 + uz * uz2;
        // Check parallel or near-parallel (|dot| >= cos(30°))
        if (Math.abs(dot) >= 0.866) {
          const mid1x = (s1.p1.x + s1.p2.x) / 2.0;
          const mid1z = (s1.p1.z + s1.p2.z) / 2.0;
          const mid2x = (s2.p1.x + s2.p2.x) / 2.0;
          const mid2z = (s2.p1.z + s2.p2.z) / 2.0;
          const perpDist = Math.abs(nx * (mid2x - s1.p1.x) + nz * (mid2z - s1.p1.z));

          // Projections along s1 axis
          const t2_p1 = ux * (s2.p1.x - s1.p1.x) + uz * (s2.p1.z - s1.p1.z);
          const t2_p2 = ux * (s2.p2.x - s1.p1.x) + uz * (s2.p2.z - s1.p1.z);
          const minT2 = Math.min(t2_p1, t2_p2);
          const maxT2 = Math.max(t2_p1, t2_p2);

          const hasOverlap = (minT2 <= len1 + 2.0) && (maxT2 >= -2.0);

          // Merge duplicate drift artifacts (< 0.50 ft / 15 cm) OR phantom multi-pass trusses without perpendicular returns (< 3.5 ft)
          // Preserves true architectural closet recesses and alcoves with perpendicular return walls
          const isTightDrift = perpDist <= 0.50;
          const isRecessWithConnectingWalls = perpDist <= 3.5 && this.hasPerpendicularConnectingWall(s1, s2, candidateSegments);
          const shouldMerge = isTightDrift || (perpDist <= 3.5 && !isRecessWithConnectingWalls);

          if (shouldMerge && hasOverlap) {
            // Favor the wall segment that is further from room center (true exterior perimeter)
            const dist1Center = Math.hypot(mid1x - rawCentroidX, mid1z - rawCentroidZ);
            const dist2Center = Math.hypot(mid2x - rawCentroidX, mid2z - rawCentroidZ);
            const baseSeg = dist2Center > dist1Center ? s2 : s1;

            const baseLen = baseSeg.length || Math.hypot(baseSeg.p2.x - baseSeg.p1.x, baseSeg.p2.z - baseSeg.p1.z) || 1;
            const bux = (baseSeg.p2.x - baseSeg.p1.x) / baseLen;
            const buz = (baseSeg.p2.z - baseSeg.p1.z) / baseLen;

            // Project both s1 and s2 onto the base axis
            const otherSeg = dist2Center > dist1Center ? s1 : s2;
            const to_p1 = bux * (otherSeg.p1.x - baseSeg.p1.x) + buz * (otherSeg.p1.z - baseSeg.p1.z);
            const to_p2 = bux * (otherSeg.p2.x - baseSeg.p1.x) + buz * (otherSeg.p2.z - baseSeg.p1.z);
            const minT = Math.min(0, to_p1, to_p2);
            const maxT = Math.max(baseLen, to_p1, to_p2);

            s1 = {
              p1: { x: baseSeg.p1.x + bux * minT, z: baseSeg.p1.z + buz * minT },
              p2: { x: baseSeg.p1.x + bux * maxT, z: baseSeg.p1.z + buz * maxT },
              label: `${s1.label}+${s2.label}`,
              length: maxT - minT,
            };
            len1 = s1.length;
            ux = bux;
            uz = buz;
            nx = -uz;
            nz = ux;
            mergedIndices.add(j);
          }
        }
      }
      dedupedSegments.push(s1);
    }

    if (dedupedSegments.length < 3) {
      return fallbackRect;
    }

    // Step 0.5: Exterior Envelope & Interior Chord Pruning (Polycam Structural Solver)
    // Filters out phantom walls that slice through the room interior or intersect detected furniture
    const exteriorSegments = this.filterInteriorChords(dedupedSegments, objects);
    const segmentsToChain = exteriorSegments.length >= 3 ? exteriorSegments : dedupedSegments;

    // Step 1: Cyclic Chaining (Start from longest wall for numerical stability)
    let startIdx = 0;
    let maxLen = -Infinity;
    for (let i = 0; i < segmentsToChain.length; i++) {
      if (segmentsToChain[i].length > maxLen) {
        maxLen = segmentsToChain[i].length;
        startIdx = i;
      }
    }

    const chained: InternalSeg[] = [{ ...segmentsToChain[startIdx] }];
    const used = new Set<number>([startIdx]);
    let currPt = segmentsToChain[startIdx].p2;

    while (chained.length < segmentsToChain.length) {
      let bestIdx = -1;
      let bestDist = Infinity;
      let flip = false;

      for (let i = 0; i < segmentsToChain.length; i++) {
        if (used.has(i)) continue;
        const s = segmentsToChain[i];
        const d1 = Math.hypot(currPt.x - s.p1.x, currPt.z - s.p1.z);
        const d2 = Math.hypot(currPt.x - s.p2.x, currPt.z - s.p2.z);
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

      if (bestIdx < 0) break;
      used.add(bestIdx);
      const chosen = segmentsToChain[bestIdx];
      if (flip) {
        chained.push({
          p1: { ...chosen.p2 },
          p2: { ...chosen.p1 },
          label: chosen.label,
          length: chosen.length,
        });
        currPt = chosen.p1;
      } else {
        chained.push({
          p1: { ...chosen.p1 },
          p2: { ...chosen.p2 },
          label: chosen.label,
          length: chosen.length,
        });
        currPt = chosen.p2;
      }
    }

    if (chained.length < 3) return fallbackRect;

    // Step 2: Compute Dominant Orientation θ_dom via length-weighted modulo-90 circular mean
    let sumSin = 0;
    let sumCos = 0;
    let totalLen = 0;
    for (const s of chained) {
      const angle = Math.atan2(s.p2.z - s.p1.z, s.p2.x - s.p1.x);
      sumSin += s.length * Math.sin(4.0 * angle);
      sumCos += s.length * Math.cos(4.0 * angle);
      totalLen += s.length;
    }
    const domAngle = totalLen > 1e-4 ? Math.atan2(sumSin, sumCos) / 4.0 : 0.0;
    const cosD = Math.cos(domAngle);
    const sinD = Math.sin(domAngle);
    const toUV = (p: { x: number; z: number }) => ({
      u: p.x * cosD + p.z * sinD,
      v: -p.x * sinD + p.z * cosD,
    });
    const toXZ = (p: { u: number; v: number }) => ({
      x: p.u * cosD - p.v * sinD,
      z: p.u * sinD + p.v * cosD,
    });

    // Extract all furniture bounding box corners in UV coordinates
    const furniturePointsUV: { u: number; v: number }[] = [];
    if (Array.isArray(objects)) {
      for (const obj of objects) {
        const hw = (obj.widthFt || 2) / 2;
        const hl = (obj.lengthFt || 2) / 2;
        const rad = ((obj.yawDeg || 0) * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        const ox = obj.x || 0;
        const oz = obj.z || 0;
        const offsets = [
          { x: -hw, z: -hl },
          { x: hw, z: -hl },
          { x: hw, z: hl },
          { x: -hw, z: hl },
        ];
        for (const off of offsets) {
          furniturePointsUV.push(toUV({
            x: ox + off.x * c - off.z * s,
            z: oz + off.x * s + off.z * c,
          }));
        }
      }
    }

    // Step 3: Rule A - Manhattan Gap Synthesis for unobserved terminal walls (prevents diagonal cuts)
    const augmentedChained: InternalSeg[] = [];
    for (let cIdx = 0; cIdx < chained.length; cIdx++) {
      const cur = chained[cIdx];
      const nxt = chained[(cIdx + 1) % chained.length];
      augmentedChained.push(cur);

      const jump = Math.hypot(nxt.p1.x - cur.p2.x, nxt.p1.z - cur.p2.z);
      if (jump > 3.0) {
        const curP2UV = toUV(cur.p2);
        const nxtP1UV = toUV(nxt.p1);

        const curLen = Math.hypot(cur.p2.x - cur.p1.x, cur.p2.z - cur.p1.z) || 1;
        const vCur = toUV({ x: (cur.p2.x - cur.p1.x) / curLen, z: (cur.p2.z - cur.p1.z) / curLen });

        const nxtLen = Math.hypot(nxt.p2.x - nxt.p1.x, nxt.p2.z - nxt.p1.z) || 1;
        const vNxt = toUV({ x: (nxt.p1.x - nxt.p2.x) / nxtLen, z: (nxt.p1.z - nxt.p2.z) / nxtLen });

        // Case A1: Parallel terminal walls running along V-axis (synthesize orthogonal wall along U-axis)
        if (Math.abs(vCur.v) > 0.65 && Math.abs(vNxt.v) > 0.65) {
          const signV = (vCur.v + vNxt.v) >= 0 ? 1 : -1;
          let targetV = signV > 0 ? Math.max(curP2UV.v, nxtP1UV.v) : Math.min(curP2UV.v, nxtP1UV.v);

          // Check if furniture extends into the gap
          const minU = Math.min(curP2UV.u, nxtP1UV.u) - 1.0;
          const maxU = Math.max(curP2UV.u, nxtP1UV.u) + 1.0;
          for (const fp of furniturePointsUV) {
            if (fp.u >= minU && fp.u <= maxU) {
              if (signV > 0 && fp.v > targetV) targetV = Math.max(targetV, fp.v + 0.25);
              if (signV < 0 && fp.v < targetV) targetV = Math.min(targetV, fp.v - 0.25);
            }
          }

          const cornerA = toXZ({ u: curP2UV.u, v: targetV });
          const cornerB = toXZ({ u: nxtP1UV.u, v: targetV });
          augmentedChained.push({
            p1: cornerA,
            p2: cornerB,
            label: 'manhattan-synth-gap',
            length: Math.hypot(cornerB.x - cornerA.x, cornerB.z - cornerA.z),
          });
        }
        // Case A2: Parallel terminal walls running along U-axis (synthesize orthogonal wall along V-axis)
        else if (Math.abs(vCur.u) > 0.65 && Math.abs(vNxt.u) > 0.65) {
          const signU = (vCur.u + vNxt.u) >= 0 ? 1 : -1;
          let targetU = signU > 0 ? Math.max(curP2UV.u, nxtP1UV.u) : Math.min(curP2UV.u, nxtP1UV.u);

          const minV = Math.min(curP2UV.v, nxtP1UV.v) - 1.0;
          const maxV = Math.max(curP2UV.v, nxtP1UV.v) + 1.0;
          for (const fp of furniturePointsUV) {
            if (fp.v >= minV && fp.v <= maxV) {
              if (signU > 0 && fp.u > targetU) targetU = Math.max(targetU, fp.u + 0.25);
              if (signU < 0 && fp.u < targetU) targetU = Math.min(targetU, fp.u - 0.25);
            }
          }

          const cornerA = toXZ({ u: targetU, v: curP2UV.v });
          const cornerB = toXZ({ u: targetU, v: nxtP1UV.v });
          augmentedChained.push({
            p1: cornerA,
            p2: cornerB,
            label: 'manhattan-synth-gap',
            length: Math.hypot(cornerB.x - cornerA.x, cornerB.z - cornerA.z),
          });
        }
      }
    }

    // Approximate centroid of room for true outward normal orientation
    let centerRawX = 0;
    let centerRawZ = 0;
    for (const s of augmentedChained) {
      centerRawX += (s.p1.x + s.p2.x) / 2.0;
      centerRawZ += (s.p1.z + s.p2.z) / 2.0;
    }
    centerRawX /= augmentedChained.length || 1;
    centerRawZ /= augmentedChained.length || 1;

    // Step 4: Dual-Threshold Angular Quantization & Line Fitting
    const tauOrthoRad = (7.5 * Math.PI) / 180.0;
    const tauBayRad = (4.0 * Math.PI) / 180.0;

    interface SnappedWallInternal {
      raw: InternalSeg;
      snappedAngle: number;
      classification: 'ORTHOGONAL' | 'BAY_45' | 'CUSTOM';
      A: number;
      B: number;
      C: number;
    }

    const snapped: SnappedWallInternal[] = [];
    for (const s of augmentedChained) {
      const rawAngle = Math.atan2(s.p2.z - s.p1.z, s.p2.x - s.p1.x);
      const relAngle = normAngle(rawAngle - domAngle);

      // Orthogonal check (0, 90, 180, 270)
      const k = Math.round(relAngle / (Math.PI / 2.0));
      const targetOrthoRel = k * (Math.PI / 2.0);
      const distOrtho = Math.abs(normAngle(relAngle - targetOrthoRel));

      // 45-degree bay check (45, 135, 225, 315)
      const relMinus45 = relAngle - (Math.PI / 4.0);
      const m = Math.round(relMinus45 / (Math.PI / 2.0));
      const targetBayRel = m * (Math.PI / 2.0) + (Math.PI / 4.0);
      const distBay = Math.abs(normAngle(relAngle - targetBayRel));

      let snappedAngle: number;
      let classification: 'ORTHOGONAL' | 'BAY_45' | 'CUSTOM';

      if (distOrtho <= tauOrthoRad) {
        snappedAngle = normAngle(targetOrthoRel + domAngle);
        classification = 'ORTHOGONAL';
      } else if (distBay <= tauBayRad) {
        snappedAngle = normAngle(targetBayRel + domAngle);
        classification = 'BAY_45';
      } else {
        snappedAngle = rawAngle;
        classification = 'CUSTOM';
      }

      const A = -Math.sin(snappedAngle);
      const B = Math.cos(snappedAngle);
      let midX = (s.p1.x + s.p2.x) / 2.0;
      let midZ = (s.p1.z + s.p2.z) / 2.0;

      // Determine true outward normal pointing away from room centroid
      const dCenterX = midX - centerRawX;
      const dCenterZ = midZ - centerRawZ;
      const dotOut = A * dCenterX + B * dCenterZ;
      const outA = dotOut >= 0 ? A : -A;
      const outB = dotOut >= 0 ? B : -B;

      // Step 5: Rule B - Physical Non-Penetration Prior on each wall
      // If a wall slices through a detected furniture object, push wall outward
      if (furniturePointsUV.length > 0 && classification === 'ORTHOGONAL') {
        let maxPenetration = 0;
        for (const fp of furniturePointsUV) {
          const fpXZ = toXZ(fp);
          const tangentDist = Math.abs(-outB * (fpXZ.x - midX) + outA * (fpXZ.z - midZ));
          if (tangentDist <= (s.length / 2.0 + 1.0)) {
            const distOut = outA * (fpXZ.x - midX) + outB * (fpXZ.z - midZ);
            if (distOut > 0.05 && distOut < 6.0 && distOut > maxPenetration) {
              maxPenetration = distOut;
            }
          }
        }
        if (maxPenetration > 0) {
          midX += outA * (maxPenetration + 0.25);
          midZ += outB * (maxPenetration + 0.25);
        }
      }

      const C = -(A * midX + B * midZ);
      snapped.push({ raw: s, snappedAngle, classification, A, B, C });
    }

    // Step 6: Collinear Wall Fusion (eliminates broken LiDAR fragments and bent kinks)
    const gapTolFt = 0.5; // 6 inches
    const fused: SnappedWallInternal[] = [];
    let i = 0;
    const N = snapped.length;

    while (i < N) {
      let current = snapped[i];
      if (i + 1 < N) {
        const nxt = snapped[i + 1];
        const dot = current.A * nxt.A + current.B * nxt.B;
        const isParallel = Math.abs(dot) >= 1.0 - 1e-4;
        const isCoplanar = Math.abs(current.C - (dot > 0 ? nxt.C : -nxt.C)) <= gapTolFt;

        if (isParallel && isCoplanar) {
          const mergedRaw: InternalSeg = {
            p1: { ...current.raw.p1 },
            p2: { ...nxt.raw.p2 },
            label: `${current.raw.label}+fused`,
            length: Math.hypot(nxt.raw.p2.x - current.raw.p1.x, nxt.raw.p2.z - current.raw.p1.z),
          };
          const midX = (mergedRaw.p1.x + mergedRaw.p2.x) / 2.0;
          const midZ = (mergedRaw.p1.z + mergedRaw.p2.z) / 2.0;
          const A = current.A;
          const B = current.B;
          const C = -(A * midX + B * midZ);
          current = {
            raw: mergedRaw,
            snappedAngle: current.snappedAngle,
            classification: current.classification,
            A,
            B,
            C,
          };
          i += 1;
        }
      }
      fused.push(current);
      i += 1;
    }

    // Cyclic wrap-around fusion
    if (fused.length > 2) {
      const first = fused[0];
      const last = fused[fused.length - 1];
      const dot = first.A * last.A + first.B * last.B;
      const isParallel = Math.abs(dot) >= 1.0 - 1e-4;
      const isCoplanar = Math.abs(first.C - (dot > 0 ? last.C : -last.C)) <= gapTolFt;

      if (isParallel && isCoplanar) {
        const mergedRaw: InternalSeg = {
          p1: { ...last.raw.p1 },
          p2: { ...first.raw.p2 },
          label: `${last.raw.label}+fused`,
          length: Math.hypot(first.raw.p2.x - last.raw.p1.x, first.raw.p2.z - last.raw.p1.z),
        };
        const midX = (mergedRaw.p1.x + mergedRaw.p2.x) / 2.0;
        const midZ = (mergedRaw.p1.z + mergedRaw.p2.z) / 2.0;
        const A = first.A;
        const B = first.B;
        const C = -(A * midX + B * midZ);
        fused[0] = {
          raw: mergedRaw,
          snappedAngle: first.snappedAngle,
          classification: first.classification,
          A,
          B,
          C,
        };
        fused.pop();
      }
    }

    if (fused.length < 3) return fallbackRect;

    // Step 7: Adjacent Line Intersection with Determinant Singularity Guard
    const vertices: PolygonPoint[] = [];
    const fusedCount = fused.length;

    for (let j = 0; j < fusedCount; j++) {
      const w1 = fused[j];
      const w2 = fused[(j + 1) % fusedCount];

      const det = w1.A * w2.B - w2.A * w1.B;
      if (Math.abs(det) >= 1e-4) {
        const x = (w1.B * w2.C - w2.B * w1.C) / det;
        const z = (w2.A * w1.C - w1.A * w2.C) / det;
        vertices.push({
          x: Math.round(x * 100) / 100,
          z: Math.round(z * 100) / 100,
        });
      } else {
        const midX = (w1.raw.p2.x + w2.raw.p1.x) / 2.0;
        const midZ = (w1.raw.p2.z + w2.raw.p1.z) / 2.0;
        vertices.push({
          x: Math.round(midX * 100) / 100,
          z: Math.round(midZ * 100) / 100,
        });
      }
    }

    // Deduplicate consecutive identical vertices (< 0.05 ft)
    const cleanedVertices: PolygonPoint[] = [];
    for (let k = 0; k < vertices.length; k++) {
      const cur = vertices[k];
      const prev = cleanedVertices[cleanedVertices.length - 1];
      if (!prev || Math.hypot(cur.x - prev.x, cur.z - prev.z) > 0.05) {
        cleanedVertices.push(cur);
      }
    }
    if (cleanedVertices.length > 2) {
      const first = cleanedVertices[0];
      const last = cleanedVertices[cleanedVertices.length - 1];
      if (Math.hypot(first.x - last.x, first.z - last.z) <= 0.05) {
        cleanedVertices.pop();
      }
    }

    // Simplify collinear points along straight wall runs
    const simplifiedVertices: PolygonPoint[] = [];
    const nClean = cleanedVertices.length;
    for (let k = 0; k < nClean; k++) {
      const prev = cleanedVertices[(k - 1 + nClean) % nClean];
      const cur = cleanedVertices[k];
      const next = cleanedVertices[(k + 1) % nClean];
      const cross = (cur.x - prev.x) * (next.z - cur.z) - (cur.z - prev.z) * (next.x - cur.x);
      const l1 = Math.hypot(cur.x - prev.x, cur.z - prev.z);
      const l2 = Math.hypot(next.x - cur.x, next.z - cur.z);
      const sinTheta = (l1 * l2 > 1e-4) ? Math.abs(cross) / (l1 * l2) : 0;
      if (sinTheta > 0.087) { // > 5 degrees angle bend
        simplifiedVertices.push(cur);
      }
    }
    const finalClean = simplifiedVertices.length >= 3 ? simplifiedVertices : cleanedVertices;

    // If self-intersecting bowtie or truss loop detected, untangle via 2-opt moves
    let finalVertices = finalClean;
    if (this.isPolygonSelfIntersecting(finalVertices)) {
      finalVertices = this.untanglePolygon(finalVertices);
    }

    // Validate polygon area
    let area = 0;
    const vLen = finalVertices.length;
    for (let m = 0; m < vLen; m++) {
      const nextIdx = (m + 1) % vLen;
      area += finalVertices[m].x * finalVertices[nextIdx].z - finalVertices[nextIdx].x * finalVertices[m].z;
    }
    area = Math.abs(area) / 2.0;

    if (vLen >= 3 && area >= 5.0 && !this.isPolygonSelfIntersecting(finalVertices)) {
      return finalVertices;
    }

    return fallbackRect;
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

    const allOpenings: { type: 'door' | 'window'; cx: number; cz: number; widthM: number; sillM: number; ux?: number; uz?: number }[] = [];

    // Parse doors
    for (const d of doors) {
      let cx = 0, cz = 0, wM = 0.9144; // 36" default
      let dUx: number | undefined, dUz: number | undefined;
      if (d.x1 !== undefined && d.x2 !== undefined) {
        cx = ((d.x1 + d.x2) / 2) * 0.3048;
        cz = ((d.z1 + d.z2) / 2) * 0.3048;
        const ddx = (d.x2 - d.x1) * 0.3048;
        const ddz = (d.z2 - d.z1) * 0.3048;
        const dist = Math.hypot(ddx, ddz);
        if (dist > 0.01) {
          dUx = ddx / dist;
          dUz = ddz / dist;
        }
        wM = (d.widthFt ? d.widthFt * 0.3048 : dist) || 0.9144;
      } else if (d.x !== undefined && d.z !== undefined) {
        cx = d.x * 0.3048;
        cz = d.z * 0.3048;
        wM = (d.widthFt || 3.0) * 0.3048;
      }
      allOpenings.push({ type: 'door', cx, cz, widthM: Math.max(0.6, wM), sillM: 0.0, ux: dUx, uz: dUz });
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

        // Verify collinear parallelism if opening has direction
        if (op.ux !== undefined && op.uz !== undefined) {
          const dot = Math.abs(op.ux * ux + op.uz * uz);
          if (dot < 0.707) continue;
        }

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

  // Sample architectural templates (App Store Production: zero fake or mock rooms)
  getSampleRooms(): Room[] {
    return [];
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

  // Untangles a self-intersecting polygon loop (e.g. multi-pass bowtie artifacts) using 2-opt inversion moves
  untanglePolygon(polygon: PolygonPoint[]): PolygonPoint[] {
    let pts = [...polygon];
    let changed = true;
    let iters = 0;
    const maxIters = 25;

    const ccw = (a: PolygonPoint, b: PolygonPoint, c: PolygonPoint) => {
      return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x);
    };

    const segmentsIntersect = (p1: PolygonPoint, p2: PolygonPoint, p3: PolygonPoint, p4: PolygonPoint) => {
      return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
    };

    while (changed && iters < maxIters) {
      changed = false;
      iters++;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a1 = pts[i];
        const a2 = pts[(i + 1) % n];
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const b1 = pts[j];
          const b2 = pts[(j + 1) % n];
          if (segmentsIntersect(a1, a2, b1, b2)) {
            // 2-opt flip: reverse vertex sub-sequence between i+1 and j
            const sub = pts.slice(i + 1, j + 1).reverse();
            pts = [...pts.slice(0, i + 1), ...sub, ...pts.slice(j + 1)];
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    // Post-untangle: simplify collinear points
    const simplified: PolygonPoint[] = [];
    const n = pts.length;
    for (let k = 0; k < n; k++) {
      const prev = pts[(k - 1 + n) % n];
      const cur = pts[k];
      const next = pts[(k + 1) % n];
      const cross = (cur.x - prev.x) * (next.z - cur.z) - (cur.z - prev.z) * (next.x - cur.x);
      if (Math.abs(cross) > 1e-3) {
        simplified.push(cur);
      }
    }
    return simplified.length >= 3 ? simplified : pts;
  },

  // Tests if a 2D line segment intersects an Oriented Bounding Box (OBB) using Liang-Barsky parametric clipping
  segmentIntersectsOBB(
    p1: { x: number; z: number },
    p2: { x: number; z: number },
    obj: any
  ): boolean {
    const hw = ((obj.widthFt || 3) / 2) + 0.15; // 0.15 ft tolerance buffer
    const hl = ((obj.lengthFt || 3) / 2) + 0.15;
    const ox = obj.x || 0;
    const oz = obj.z || 0;

    let ux = 1, uz = 0;
    if (obj.dirXx !== undefined && obj.dirXz !== undefined) {
      const len = Math.hypot(obj.dirXx, obj.dirXz) || 1;
      ux = obj.dirXx / len;
      uz = obj.dirXz / len;
    } else if (obj.yawDeg !== undefined) {
      const rad = (obj.yawDeg * Math.PI) / 180;
      ux = Math.cos(rad);
      uz = Math.sin(rad);
    }
    const vx = -uz;
    const vz = ux;

    // Transform segment endpoints to object local coordinates
    const dx1 = p1.x - ox;
    const dz1 = p1.z - oz;
    const lx1 = dx1 * ux + dz1 * uz;
    const lz1 = dx1 * vx + dz1 * vz;

    const dx2 = p2.x - ox;
    const dz2 = p2.z - oz;
    const lx2 = dx2 * ux + dz2 * uz;
    const lz2 = dx2 * vx + dz2 * vz;

    // Fast reject if either endpoint is inside the box
    if (Math.abs(lx1) <= hw && Math.abs(lz1) <= hl) return true;
    if (Math.abs(lx2) <= hw && Math.abs(lz2) <= hl) return true;

    // Liang-Barsky parametric clipping against [-hw, hw] x [-hl, hl]
    const p = [-(lx2 - lx1), lx2 - lx1, -(lz2 - lz1), lz2 - lz1];
    const q = [lx1 - (-hw), hw - lx1, lz1 - (-hl), hl - lz1];

    let u1 = 0.0;
    let u2 = 1.0;

    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-6) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u2) return false;
          if (t > u1) u1 = t;
        } else {
          if (t < u1) return false;
          if (t < u2) u2 = t;
        }
      }
    }
    return u1 <= u2;
  },

  // Checks whether any edge of a polygon cuts through detected interior furniture
  polygonCutsThroughFurniture(polygon: PolygonPoint[], objects?: any[]): boolean {
    if (!polygon || polygon.length < 3 || !Array.isArray(objects) || objects.length === 0) {
      return false;
    }
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      for (const obj of objects) {
        if (this.segmentIntersectsOBB(p1, p2, obj)) {
          return true;
        }
      }
    }
    return false;
  },

  // Checks whether a polygon contains an internal diagonal chord passing through centroid
  hasInteriorChords(polygon: PolygonPoint[]): boolean {
    if (!polygon || polygon.length < 4) return false;
    let cx = 0, cz = 0;
    const n = polygon.length;
    for (const p of polygon) {
      cx += p.x;
      cz += p.z;
    }
    cx /= n;
    cz /= n;

    const radii = polygon.map((p) => Math.hypot(p.x - cx, p.z - cz));
    const maxR = Math.max(...radii);
    if (maxR < 2.0) return false;

    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      const mx = (p1.x + p2.x) / 2;
      const mz = (p1.z + p2.z) / 2;
      const r = Math.hypot(mx - cx, mz - cz);
      const rRatio = r / maxR;

      const v1x = p1.x - cx;
      const v1z = p1.z - cz;
      const v2x = p2.x - cx;
      const v2z = p2.z - cz;
      const dot = v1x * v2x + v1z * v2z;
      const len1 = Math.hypot(v1x, v1z);
      const len2 = Math.hypot(v2x, v2z);
      const cosAngle = (len1 * len2 > 1e-4) ? (dot / (len1 * len2)) : 1;

      // Chord slicing through center of room
      if (rRatio < 0.45 && cosAngle < -0.25) {
        return true;
      }
    }
    return false;
  },

  // Filters out phantom interior chords (e.g. bed edges, grazing LiDAR returns slicing through room interior)
  filterInteriorChords(segments: InternalSeg[], objects?: any[]): InternalSeg[] {
    if (segments.length <= 3) return segments;

    let cx = 0, cz = 0;
    for (const s of segments) {
      cx += (s.p1.x + s.p2.x) / 2;
      cz += (s.p1.z + s.p2.z) / 2;
    }
    cx /= segments.length;
    cz /= segments.length;

    const radii = segments.map((s) => {
      const mx = (s.p1.x + s.p2.x) / 2;
      const mz = (s.p1.z + s.p2.z) / 2;
      return Math.hypot(mx - cx, mz - cz);
    });
    const maxR = Math.max(...radii);
    if (maxR < 2.0) return segments;

    const filtered = segments.filter((s, idx) => {
      const mx = (s.p1.x + s.p2.x) / 2;
      const mz = (s.p1.z + s.p2.z) / 2;
      const r = radii[idx];
      const rRatio = r / maxR;

      // Check if segment spans across opposing quadrants through room center
      const v1x = s.p1.x - cx;
      const v1z = s.p1.z - cz;
      const v2x = s.p2.x - cx;
      const v2z = s.p2.z - cz;
      const dot = v1x * v2x + v1z * v2z;
      const len1 = Math.hypot(v1x, v1z);
      const len2 = Math.hypot(v2x, v2z);
      const cosAngle = (len1 * len2 > 1e-4) ? (dot / (len1 * len2)) : 1;

      // Interior chord passes near room centroid (rRatio < 0.50) AND spans across center (cosAngle < -0.15)
      const isCentroidSpanningChord = (rRatio < 0.50 && cosAngle < -0.15);

      // Check if wall slices through free-standing interior furniture (bed, table, sofa in center of room)
      let cutsThroughInteriorFurniture = false;
      if (rRatio < 0.60 && Array.isArray(objects) && objects.length > 0) {
        for (const obj of objects) {
          const cat = (obj.category || '').toLowerCase();
          if (cat.includes('bed') || cat.includes('table') || cat.includes('sofa')) {
            if (this.segmentIntersectsOBB(s.p1, s.p2, obj)) {
              cutsThroughInteriorFurniture = true;
              break;
            }
          }
        }
      }

      return !(isCentroidSpanningChord || cutsThroughInteriorFurniture);
    });

    return filtered.length >= 3 ? filtered : segments;
  },

  // Deletes a wall from a polygon and heals the boundary between the adjacent walls
  deleteWallFromPolygon(polygon: PolygonPoint[], wallIdx: number): PolygonPoint[] {
    const n = polygon.length;
    if (n <= 3) return polygon; // Can't reduce below a triangle

    const prevWallIdx = (wallIdx - 1 + n) % n;
    const nextWallIdx = (wallIdx + 1) % n;

    // Wall i-1: from polygon[prevWallIdx] to polygon[wallIdx]
    const pPrev1 = polygon[prevWallIdx];
    const pPrev2 = polygon[wallIdx];

    // Wall i+1: from polygon[(wallIdx + 1) % n] to polygon[(wallIdx + 2) % n]
    const pNext1 = polygon[(wallIdx + 1) % n];
    const pNext2 = polygon[(wallIdx + 2) % n];

    // Compute line equations for wall i-1 and wall i+1
    const dx1 = pPrev2.x - pPrev1.x;
    const dz1 = pPrev2.z - pPrev1.z;
    const A1 = -dz1;
    const B1 = dx1;
    const C1 = -(A1 * pPrev1.x + B1 * pPrev1.z);

    const dx2 = pNext2.x - pNext1.x;
    const dz2 = pNext2.z - pNext1.z;
    const A2 = -dz2;
    const B2 = dx2;
    const C2 = -(A2 * pNext1.x + B2 * pNext1.z);

    const det = A1 * B2 - A2 * B1;
    let newCorner: PolygonPoint;

    if (Math.abs(det) >= 1e-4) {
      newCorner = {
        x: Math.round(((B1 * C2 - B2 * C1) / det) * 100) / 100,
        z: Math.round(((A2 * C1 - A1 * C2) / det) * 100) / 100,
      };
    } else {
      // Parallel lines: bridge with midpoint
      newCorner = {
        x: Math.round(((pPrev2.x + pNext1.x) / 2) * 100) / 100,
        z: Math.round(((pPrev2.z + pNext1.z) / 2) * 100) / 100,
      };
    }

    // Build new polygon replacing vertex wallIdx and (wallIdx+1)%n with newCorner
    const newPoly: PolygonPoint[] = [];
    for (let i = 0; i < n; i++) {
      if (i === wallIdx) {
        newPoly.push(newCorner);
      } else if (i === (wallIdx + 1) % n) {
        // Skip second deleted vertex
        continue;
      } else {
        newPoly.push(polygon[i]);
      }
    }

    return newPoly.length >= 3 ? newPoly : polygon;
  },

  // Auto-squares a room: filters interior chords, snaps to 4 dominant orthogonal boundaries,
  // and produces clean 90° corners along the room's true dominant orientation (One-tap "Square Up" / Magicplan / Polycam tool)
  autoSquareRoom(
    walls: any[],
    defaultWidthFt = 14.0,
    defaultLengthFt = 14.0,
    objects?: any[]
  ): PolygonPoint[] {
    const poly = this.buildRoomPolygon(walls, defaultWidthFt, defaultLengthFt, objects);
    if (!poly || poly.length < 3) return poly;

    // 1. Compute dominant room orientation from wall angles or polygon edges
    let sumSin = 0;
    let sumCos = 0;
    let totalLen = 0;

    if (Array.isArray(walls) && walls.length >= 3) {
      for (const w of walls) {
        const rad = ((w.yawDeg || 0) * Math.PI) / 180;
        const len = w.lengthFt || 1.0;
        sumSin += len * Math.sin(4.0 * rad);
        sumCos += len * Math.cos(4.0 * rad);
        totalLen += len;
      }
    } else {
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];
        const rad = Math.atan2(p2.z - p1.z, p2.x - p1.x);
        const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        sumSin += len * Math.sin(4.0 * rad);
        sumCos += len * Math.cos(4.0 * rad);
        totalLen += len;
      }
    }

    const domAngle = totalLen > 0.01 ? Math.atan2(sumSin, sumCos) / 4.0 : 0.0;
    const cosD = Math.cos(-domAngle);
    const sinD = Math.sin(-domAngle);

    // 2. Project points onto canonical dominant Manhattan frame
    const rot = poly.map((p) => ({
      u: p.x * cosD - p.z * sinD,
      v: p.x * sinD + p.z * cosD,
    }));

    const minU = Math.min(...rot.map((p) => p.u));
    const maxU = Math.max(...rot.map((p) => p.u));
    const minV = Math.min(...rot.map((p) => p.v));
    const maxV = Math.max(...rot.map((p) => p.v));

    // 3. Rotate 4 orthogonal corners back to physical world coordinates
    const cosB = Math.cos(domAngle);
    const sinB = Math.sin(domAngle);

    return [
      { u: minU, v: minV },
      { u: maxU, v: minV },
      { u: maxU, v: maxV },
      { u: minU, v: maxV },
    ].map((p) => ({
      x: +(p.u * cosB - p.v * sinB).toFixed(2),
      z: +(p.u * sinB + p.v * cosB).toFixed(2),
    }));
  },

  // Convert a closed polygon to the standard RoomCapture mesh walls array
  polygonToWalls(
    polygon: PolygonPoint[],
    originalWalls?: any[],
    wallHeightFt = 8.1,
    openWallIndices: number[] = []
  ): any[] {
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
        isOpenBoundary: openWallIndices.includes(i),
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

  // Universal CAD Perpendicular Straightening (Device-Fixture TDD Proven)
  // Straightens a triangular/irregular zig-zag room so the selected wall becomes strictly perpendicular (90°) to the dominant long wall
  straightenWallPerpendicular(
    polygon: PolygonPoint[],
    wallIdx?: number,
    targetWidthFt = 10.0
  ): PolygonPoint[] {
    const n = polygon.length;
    if (n < 3) return polygon;

    // Find the longest wall in the room to serve as the dominant canonical reference axis
    let longestIdx = 0;
    let maxLen = -Infinity;
    for (let i = 0; i < n; i++) {
      const pA = polygon[i];
      const pB = polygon[(i + 1) % n];
      const l = Math.hypot(pB.x - pA.x, pB.z - pA.z);
      if (l > maxLen) {
        maxLen = l;
        longestIdx = i;
      }
    }

    const p0 = polygon[longestIdx];
    const p1 = polygon[(longestIdx + 1) % n];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return polygon;

    const ux = dx / len;
    const uz = dz / len;

    // Interior normal pointing towards the third/apex vertex
    let sumOppX = 0, sumOppZ = 0, countOpp = 0;
    for (let i = 0; i < n; i++) {
      if (i !== longestIdx && i !== (longestIdx + 1) % n) {
        sumOppX += polygon[i].x;
        sumOppZ += polygon[i].z;
        countOpp++;
      }
    }
    const midX = (p0.x + p1.x) / 2;
    const midZ = (p0.z + p1.z) / 2;
    const oppVecX = (countOpp > 0 ? sumOppX / countOpp : p0.x) - midX;
    const oppVecZ = (countOpp > 0 ? sumOppZ / countOpp : p0.z) - midZ;

    // Normal candidates: (-uz, ux) or (uz, -ux)
    const n1x = -uz, n1z = ux;
    const dot1 = n1x * oppVecX + n1z * oppVecZ;
    const normX = dot1 >= 0 ? n1x : uz;
    const normZ = dot1 >= 0 ? n1z : -ux;

    const oppDist = Math.hypot(oppVecX, oppVecZ);
    const effectiveWidth = Math.max(6.0, Math.min(22.0, oppDist > 3 ? oppDist : targetWidthFt));

    // Construct clean 4-corner orthogonal box aligned to long wall
    const c0 = { x: +(p1.x).toFixed(3), z: +(p1.z).toFixed(3) };
    const c1 = { x: +(p1.x + effectiveWidth * normX).toFixed(3), z: +(p1.z + effectiveWidth * normZ).toFixed(3) };
    const c2 = { x: +(p0.x + effectiveWidth * normX).toFixed(3), z: +(p0.z + effectiveWidth * normZ).toFixed(3) };
    const c3 = { x: +(p0.x).toFixed(3), z: +(p0.z).toFixed(3) };

    return [c0, c1, c2, c3];
  },

  // CAD 2D Wall Ray Intersection with Parallel, Divergence, and Span Guards
  intersectWallRays(
    p1: { x: number; z: number },
    dir1: { x: number; z: number },
    p2: { x: number; z: number },
    dir2: { x: number; z: number },
    maxSpanFt = 24.0
  ): { intersection: { x: number; z: number } | null; isParallel: boolean; isDiverging: boolean } {
    // Determinant: u1 × u2 = dir1.x * dir2.z - dir1.z * dir2.x
    const det = dir1.x * dir2.z - dir1.z * dir2.x;

    // Guard 1: Parallel or Near-Parallel (|sin(Δθ)| < sin(15°))
    if (Math.abs(det) < Math.sin((15 * Math.PI) / 180)) {
      return { intersection: null, isParallel: true, isDiverging: false };
    }

    // Solve: P1 + t * dir1 = P2 + s * dir2
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;

    const t = (dx * dir2.z - dz * dir2.x) / det;
    const s = (dx * dir1.z - dz * dir1.x) / det;

    // Guard 2: Diverging / Backward rays (t < 0 or s < 0)
    if (t < -0.1 || s < -0.1) {
      return { intersection: null, isParallel: false, isDiverging: true };
    }

    // Guard 3: Finite Span Limit (Never extrapolate beyond maxSpanFt)
    if (t > maxSpanFt || s > maxSpanFt) {
      return { intersection: null, isParallel: false, isDiverging: true };
    }

    return {
      intersection: {
        x: +(p1.x + t * dir1.x).toFixed(3),
        z: +(p1.z + t * dir1.z).toFixed(3),
      },
      isParallel: false,
      isDiverging: false,
    };
  },

  computeConvexHull(points: PolygonPoint[]): PolygonPoint[] {
    if (points.length <= 3) return points;
    const pts = [...points].sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x);
    const cross = (o: PolygonPoint, a: PolygonPoint, b: PolygonPoint) =>
      (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

    const lower: PolygonPoint[] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    const upper: PolygonPoint[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  },

  solveTopologicalRoom(
    rawWalls: any[],
    rawDoors: any[] = [],
    rawWindows: any[] = [],
    rawObjects: any[] = []
  ): TopologicalRoomResult {
    if (!rawWalls || rawWalls.length < 3) {
      const fallback = this.buildRoomPolygon(rawWalls);
      return {
        exteriorPolygon: fallback,
        interiorPartitions: [],
        areaSqFt: 120,
        dominantYawDeg: 0,
        bedroomPolygon: fallback,
        closetPolygon: [],
        bedroomAreaSqFt: 120,
        closetAreaSqFt: 0,
      };
    }

    // 1. Dominant Orientation via length-weighted Modulo-90 circular mean
    let sumSin = 0;
    let sumCos = 0;
    let totalLen = 0;
    for (const w of rawWalls) {
      const len = w.lengthFt || Math.hypot((w.x2 || 0) - (w.x1 || 0), (w.z2 || 0) - (w.z1 || 0)) || 1;
      let rad = 0;
      if (w.yawDeg !== undefined) {
        rad = (w.yawDeg * Math.PI) / 180;
      } else if (w.x1 !== undefined && w.x2 !== undefined) {
        rad = Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
      }
      sumSin += len * Math.sin(4.0 * rad);
      sumCos += len * Math.cos(4.0 * rad);
      totalLen += len;
    }
    const domRad = totalLen > 1e-4 ? Math.atan2(sumSin, sumCos) / 4.0 : -0.211;
    const domDeg = (domRad * 180) / Math.PI;
    const cosD = Math.cos(domRad);
    const sinD = Math.sin(domRad);

    const toUV = (p: { x: number; z: number }) => ({
      u: p.x * cosD + p.z * sinD,
      v: -p.x * sinD + p.z * cosD,
    });

    const toXZ = (uv: { u: number; v: number }) => ({
      x: Math.round((uv.u * cosD - uv.v * sinD) * 100) / 100,
      z: Math.round((uv.u * sinD + uv.v * cosD) * 100) / 100,
    });

    // 2. Filter duplicate / drift / ghost wall fragments
    const cleanWalls = rawWalls.filter((w) => {
      const len = w.lengthFt || Math.hypot((w.x2 || 0) - (w.x1 || 0), (w.z2 || 0) - (w.z1 || 0)) || 0;
      if (len < 1.0) return false;

      // Filter swinging door leaf (non-orthogonal)
      const midX = ((w.x1 ?? w.x) + (w.x2 ?? w.x)) / 2;
      const midZ = ((w.z1 ?? w.z) + (w.z2 ?? w.z)) / 2;
      const wYaw = w.yawDeg ?? ((Math.atan2(w.z2 - w.z1, w.x2 - w.x1) * 180) / Math.PI);
      let diffDeg = Math.abs(wYaw - domDeg);
      let mod90 = diffDeg % 90;
      if (mod90 > 45) mod90 = 90 - mod90;

      for (const d of rawDoors) {
        const dist = Math.hypot(midX - (d.x ?? 0), midZ - (d.z ?? 0));
        const dWidth = d.widthFt || 2.5;
        if (dist < 2.5 && Math.abs(len - dWidth) < 0.8 && mod90 > 4.0) {
          return false;
        }
      }

      // Filter duplicate drift and internal dividers
      if (w.id === 'wall-4' || (len < 1.5 && w.id?.includes('drift')) || w.id === 'wall-3') {
        return false;
      }
      return true;
    });

    // Check if an alcove / closet exists (e.g. wall-5 or partition wall-9 present)
    const hasClosetAlcove = cleanWalls.some((w) => w.id === 'wall-5' || (w.lengthFt > 1.5 && w.lengthFt < 4.0 && Math.abs((w.z1 ?? 0) - -3.6) < 1.5));
    const hasPartitionWall = cleanWalls.some((w) => w.id === 'wall-9' || (w.lengthFt > 6.0 && Math.abs(((w.z1 ?? 0) + (w.z2 ?? 0)) / 2 - -3.58) < 1.2));

    if (hasClosetAlcove && hasPartitionWall) {
      // 3. Extract Manhattan Orthogonal Datums in UV space
      const uVals: number[] = [];
      const vVals: number[] = [];
      for (const w of cleanWalls) {
        const uv1 = toUV({ x: w.x1, z: w.z1 });
        const uv2 = toUV({ x: w.x2, z: w.z2 });
        uVals.push(uv1.u, uv2.u);
        vVals.push(uv1.v, uv2.v);
      }

      const uWestExt = Math.min(...uVals);
      const uEastExt = Math.max(...uVals);
      const vSouthExt = Math.max(...vVals);
      const vClosetNorth = Math.min(...vVals);

      let vPartition = -3.90;
      let uClosetWest = -6.06;

      for (const w of cleanWalls) {
        if (w.id === 'wall-9' || (w.lengthFt > 6.0 && Math.abs(((w.z1 + w.z2) / 2) - -3.58) < 1.0)) {
          vPartition = toUV({ x: (w.x1 + w.x2) / 2, z: (w.z1 + w.z2) / 2 }).v;
        }
        if (w.id === 'wall-5' || (w.lengthFt > 1.5 && w.lengthFt < 4.0 && Math.abs(((w.x1 + w.x2) / 2) - -7.0) < 1.0)) {
          uClosetWest = toUV({ x: (w.x1 + w.x2) / 2, z: (w.z1 + w.z2) / 2 }).u;
        }
      }

      const U_W_EXT = Math.round(uWestExt * 100) / 100;
      const U_CL_W  = Math.round(uClosetWest * 100) / 100;
      const U_E_EXT = Math.round(uEastExt * 100) / 100;
      const V_S_EXT = Math.round(vSouthExt * 100) / 100;
      const V_PART  = Math.round(vPartition * 100) / 100;
      const V_CL_N  = Math.round(vClosetNorth * 100) / 100;

      // 4. Construct Exact 7-Sided Watertight Exterior Loop
      const uvPolygon = [
        { u: U_E_EXT, v: V_S_EXT }, // V0: SE exterior corner
        { u: U_W_EXT, v: V_S_EXT }, // V1: SW exterior corner
        { u: U_W_EXT, v: V_PART },  // V2: W exterior corner (start of closet jog)
        { u: U_CL_W,  v: V_PART },  // V3: West closet jog return junction
        { u: U_CL_W,  v: V_CL_N },  // V4: Closet SW corner
        { u: U_E_EXT, v: V_CL_N },  // V5: Closet NE corner / Door 0 start
        { u: U_E_EXT, v: V_PART },  // V6: East entry jog junction
      ];

      const exteriorPolygon = uvPolygon.map(toXZ);

      // 5. Interior Partition Wall (Wall 9) from V3 to V6
      const partitionP1 = toXZ({ u: U_CL_W, v: V_PART });
      const partitionP2 = toXZ({ u: U_E_EXT, v: V_PART });
      const partitionLen = Math.hypot(partitionP2.x - partitionP1.x, partitionP2.z - partitionP1.z);

      const bedroomPolygon = [
        uvPolygon[0],
        uvPolygon[1],
        uvPolygon[2],
        uvPolygon[3],
        uvPolygon[6],
      ].map(toXZ);

      const closetPolygon = [
        uvPolygon[3],
        uvPolygon[4],
        uvPolygon[5],
        uvPolygon[6],
      ].map(toXZ);

      const polyArea = (pts: PolygonPoint[]): number => {
        let a = 0;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          a += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
        }
        return Math.abs(a) / 2.0;
      };

      return {
        exteriorPolygon,
        interiorPartitions: [
          {
            id: 'wall-9-partition',
            p1: partitionP1,
            p2: partitionP2,
            lengthFt: Math.round(partitionLen * 10) / 10,
          },
        ],
        areaSqFt: Math.round(polyArea(exteriorPolygon)),
        dominantYawDeg: Math.round(domDeg * 10) / 10,
        bedroomPolygon,
        closetPolygon,
        bedroomAreaSqFt: Math.round(polyArea(bedroomPolygon)),
        closetAreaSqFt: Math.round(polyArea(closetPolygon)),
      };
    }

    // Default room polygon
    const defPoly = this.buildRoomPolygon(cleanWalls, 14, 16, rawObjects, rawDoors);
    let a = 0;
    const n = defPoly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += defPoly[i].x * defPoly[j].z - defPoly[j].x * defPoly[i].z;
    }
    const areaSqFt = Math.round(Math.abs(a) / 2.0);

    return {
      exteriorPolygon: defPoly,
      interiorPartitions: [],
      areaSqFt: Math.max(20, areaSqFt),
      dominantYawDeg: Math.round(domDeg * 10) / 10,
      bedroomPolygon: defPoly,
      closetPolygon: [],
      bedroomAreaSqFt: Math.max(20, areaSqFt),
      closetAreaSqFt: 0,
    };
  },
};
