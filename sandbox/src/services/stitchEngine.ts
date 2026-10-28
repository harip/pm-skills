// sandbox/src/services/stitchEngine.ts
import { Room } from '../types/room';
import { GeometryService } from './geometryService';

export interface StitchedRoomLayout {
  room: Room;
  offsetX: number;     // Feet in house coordinate space (center X)
  offsetY: number;     // 3D projection Y offset (based on floor elevation)
  offsetZ: number;     // Feet in house coordinate space (center Z)
  width: number;       // Feet
  length: number;      // Feet
  height: number;      // Feet
  elevationFt: number; // Feet relative to Ground Floor
  floorLevel: string;
  color: string;
  rotationDeg?: number; // 0, 90, 180, 270
}

export interface SharedPartitionSegment {
  roomId1: string;
  roomId2: string;
  start: { x: number; z: number }; // In house coordinate space (feet)
  end: { x: number; z: number };   // In house coordinate space (feet)
  lengthFt: number;
  thicknessM: number;
  isWetWall: boolean;
  doors: { x: number; z: number; widthFt: number }[];
}

export const StitchEngine = {
  // Certified Multi-Story Elevation Steps (IRC 2024 Section R502)
  SECOND_FLOOR_ELEVATION_FT: 9.0, // 8'1" ceiling + 11.0" joist cavity = 9'0" floor-to-floor
  BASEMENT_ELEVATION_FT: -8.5,

  // Groups rooms by their architectural altitude / floor level
  groupRoomsByFloor(rooms: Room[]): Record<string, Room[]> {
    const groups: Record<string, Room[]> = {
      'Ground Floor': [],
      'Second Floor': [],
      'Basement': [],
    };

    for (const r of rooms) {
      const fl = r.floor_level || 'Ground Floor';
      if (!groups[fl]) {
        groups[fl] = [];
      }
      groups[fl].push(r);
    }

    const result: Record<string, Room[]> = {};
    for (const [key, list] of Object.entries(groups)) {
      if (list.length > 0) {
        result[key] = list;
      }
    }
    return result;
  },

  // 1D Interval Overlap Detection on Parallel Collinear Wall Segments
  detectSharedPartitions(layouts: StitchedRoomLayout[]): SharedPartitionSegment[] {
    const partitions: SharedPartitionSegment[] = [];
    const eps = 0.45; // 5.4 inches threshold for collinearity

    for (let i = 0; i < layouts.length; i++) {
      for (let j = i + 1; j < layouts.length; j++) {
        const l1 = layouts[i];
        const l2 = layouts[j];
        if (l1.floorLevel !== l2.floorLevel) continue;

        // Box 1 bounds in feet
        const b1 = {
          minX: l1.offsetX - l1.width / 2,
          maxX: l1.offsetX + l1.width / 2,
          minZ: l1.offsetZ - l1.length / 2,
          maxZ: l1.offsetZ + l1.length / 2,
        };
        // Box 2 bounds in feet
        const b2 = {
          minX: l2.offsetX - l2.width / 2,
          maxX: l2.offsetX + l2.width / 2,
          minZ: l2.offsetZ - l2.length / 2,
          maxZ: l2.offsetZ + l2.length / 2,
        };

        // Check East-West contact (l1.maxX approx l2.minX or vice versa)
        if (Math.abs(b1.maxX - b2.minX) <= eps || Math.abs(b2.maxX - b1.minX) <= eps) {
          const contactX = Math.abs(b1.maxX - b2.minX) <= eps ? (b1.maxX + b2.minX) / 2 : (b2.maxX + b1.minX) / 2;
          const overlapMinZ = Math.max(b1.minZ, b2.minZ);
          const overlapMaxZ = Math.min(b1.maxZ, b2.maxZ);
          const overlapLen = overlapMaxZ - overlapMinZ;

          if (overlapLen >= 0.5) {
            // Check if either room is a wet room (kitchen, bath, utility)
            const isWet = /kitchen|bath|toilet|utility|laundry/i.test(l1.room.name + ' ' + l2.room.name);
            partitions.push({
              roomId1: l1.room.id,
              roomId2: l2.room.id,
              start: { x: contactX, z: overlapMinZ },
              end: { x: contactX, z: overlapMaxZ },
              lengthFt: overlapLen,
              thicknessM: isWet ? GeometryService.PLUMBING_WALL_THICKNESS_M : GeometryService.INTERIOR_WALL_THICKNESS_M,
              isWetWall: isWet,
              doors: [],
            });
          }
        }

        // Check North-South contact (l1.maxZ approx l2.minZ or vice versa)
        if (Math.abs(b1.maxZ - b2.minZ) <= eps || Math.abs(b2.maxZ - b1.minZ) <= eps) {
          const contactZ = Math.abs(b1.maxZ - b2.minZ) <= eps ? (b1.maxZ + b2.minZ) / 2 : (b2.maxZ + b1.minZ) / 2;
          const overlapMinX = Math.max(b1.minX, b2.minX);
          const overlapMaxX = Math.min(b1.maxX, b2.maxX);
          const overlapLen = overlapMaxX - overlapMinX;

          if (overlapLen >= 0.5) {
            const isWet = /kitchen|bath|toilet|utility|laundry/i.test(l1.room.name + ' ' + l2.room.name);
            partitions.push({
              roomId1: l1.room.id,
              roomId2: l2.room.id,
              start: { x: overlapMinX, z: contactZ },
              end: { x: overlapMaxX, z: contactZ },
              lengthFt: overlapLen,
              thicknessM: isWet ? GeometryService.PLUMBING_WALL_THICKNESS_M : GeometryService.INTERIOR_WALL_THICKNESS_M,
              isWetWall: isWet,
              doors: [],
            });
          }
        }
      }
    }

    return partitions;
  },

  // Automatically arranges and attaches rooms seamlessly into a contiguous floor plan
  // Uses Spatial Zoning & Contact Maximization to snap common walls flush
  computeAttachedLayout(rooms: Room[]): StitchedRoomLayout[] {
    if (!rooms || rooms.length === 0) return [];

    const palette = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55'];
    const floorGroups = this.groupRoomsByFloor(rooms);
    const allStitched: StitchedRoomLayout[] = [];

    // Helper to test if two 2D boxes overlap (interior intersection)
    const boxesOverlap = (
      b1: { x: number; z: number; w: number; l: number },
      b2: { x: number; z: number; w: number; l: number }
    ) => {
      const eps = 0.05;
      return !(
        b1.x + b1.w <= b2.x + eps ||
        b2.x + b2.w <= b1.x + eps ||
        b1.z + b1.l <= b2.z + eps ||
        b2.z + b2.l <= b1.z + eps
      );
    };

    let globalColorIdx = 0;

    for (const [floorLevel, floorRooms] of Object.entries(floorGroups)) {
      if (floorRooms.length === 0) continue;

      let elevFt = 0;
      let elevY3D = 0;
      if (floorLevel === 'Basement') {
        elevFt = this.BASEMENT_ELEVATION_FT;
        elevY3D = 55; // render below ground in 3D projection
      } else if (floorLevel === 'Second Floor') {
        elevFt = this.SECOND_FLOOR_ELEVATION_FT;
        elevY3D = -55; // render above ground in 3D projection
      }

      interface PlacedBox {
        room: Room;
        x: number;
        z: number;
        w: number;
        l: number;
        h: number;
        color: string;
      }

      const placed: PlacedBox[] = [];

      // Sort rooms so primary living spaces place first, followed by dining/kitchen, then bedrooms/baths
      const sortedFloorRooms = [...floorRooms].sort((a, b) => {
        const score = (r: Room) => {
          const n = (r.name || '').toLowerCase();
          if (n.includes('living') || n.includes('entry') || n.includes('great')) return 1;
          if (n.includes('dining') || n.includes('kitchen')) return 2;
          if (n.includes('bed')) return 3;
          if (n.includes('bath')) return 4;
          return 5;
        };
        return score(a) - score(b);
      });

      // Place initial room at (0, 0)
      const r0 = sortedFloorRooms[0];
      const w0 = r0.width_ft || 14;
      const l0 = r0.length_ft || 16;
      const h0 = r0.height_ft || 8.1;

      placed.push({
        room: r0,
        x: 0,
        z: 0,
        w: w0,
        l: l0,
        h: h0,
        color: palette[globalColorIdx++ % palette.length],
      });

      // Attach each subsequent room along the optimal common wall
      for (let i = 1; i < sortedFloorRooms.length; i++) {
        const curRoom = sortedFloorRooms[i];
        const rw = curRoom.width_ft || 14;
        const rl = curRoom.length_ft || 16;
        const rh = curRoom.height_ft || 8.1;

        const candidates: { x: number; z: number }[] = [];

        // Generate attachment candidates against each placed room's boundaries
        for (const p of placed) {
          // East attachment (flush with p's right wall)
          candidates.push({ x: p.x + p.w, z: p.z });
          candidates.push({ x: p.x + p.w, z: p.z + p.l - rl });
          // West attachment (flush with p's left wall)
          candidates.push({ x: p.x - rw, z: p.z });
          candidates.push({ x: p.x - rw, z: p.z + p.l - rl });
          // South attachment (flush with p's bottom wall)
          candidates.push({ x: p.x, z: p.z + p.l });
          candidates.push({ x: p.x + p.w - rw, z: p.z + p.l });
          // North attachment (flush with p's top wall)
          candidates.push({ x: p.x, z: p.z - rl });
          candidates.push({ x: p.x + p.w - rw, z: p.z - rl });
        }

        let bestCandidate: { x: number; z: number } | null = null;
        let bestScore = -Infinity;

        const isCurWet = /kitchen|bath|laundry/i.test(curRoom.name || '');
        const isCurBed = /bed/i.test(curRoom.name || '');

        for (const c of candidates) {
          const testBox = { x: c.x, z: c.z, w: rw, l: rl };
          if (placed.some((p) => boxesOverlap(testBox, p))) {
            continue;
          }

          // Measure shared wall contact length
          let sharedLength = 0;
          let zoningBonus = 0;

          for (const p of placed) {
            const isPWet = /kitchen|bath|laundry/i.test(p.room.name || '');
            const isPLiving = /living|dining/i.test(p.room.name || '');

            let overlap = 0;
            // East-West contact
            if (Math.abs(testBox.x + testBox.w - p.x) < 0.1 || Math.abs(p.x + p.w - testBox.x) < 0.1) {
              overlap = Math.max(0, Math.min(testBox.z + testBox.l, p.z + p.l) - Math.max(testBox.z, p.z));
            }
            // North-South contact
            if (Math.abs(testBox.z + testBox.l - p.z) < 0.1 || Math.abs(p.z + p.l - testBox.z) < 0.1) {
              overlap = Math.max(0, Math.min(testBox.x + testBox.w, p.x + p.w) - Math.max(testBox.x, p.x));
            }

            if (overlap > 0.5) {
              sharedLength += overlap;
              // Architectural Zoning Rules (ADJ-10):
              // Bonus for back-to-back wet walls (plumbing run optimization)
              if (isCurWet && isPWet) {
                zoningBonus += 25.0;
              }
              // Living + Dining connection bonus
              if (/dining/i.test(curRoom.name) && /living/i.test(p.room.name)) {
                zoningBonus += 30.0;
              }
              // Bedroom directly opening onto living room slight privacy buffer penalty
              if (isCurBed && isPLiving) {
                zoningBonus -= 10.0;
              }
            }
          }

          // Measure overall footprint compactness
          const allX1 = Math.min(c.x, ...placed.map((p) => p.x));
          const allX2 = Math.max(c.x + rw, ...placed.map((p) => p.x + p.w));
          const allZ1 = Math.min(c.z, ...placed.map((p) => p.z));
          const allZ2 = Math.max(c.z + rl, ...placed.map((p) => p.z + p.l));
          const spanX = allX2 - allX1;
          const spanZ = allZ2 - allZ1;
          const aspect = Math.max(spanX, spanZ) / (Math.min(spanX, spanZ) + 1e-4);

          const score = sharedLength * 30.0 + zoningBonus - (spanX + spanZ) * 4.0 - aspect * 10.0;

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = c;
          }
        }

        const finalPos = bestCandidate || { x: placed[0].x + placed[0].w, z: placed[0].z };
        placed.push({
          room: curRoom,
          x: finalPos.x,
          z: finalPos.z,
          w: rw,
          l: rl,
          h: rh,
          color: palette[globalColorIdx++ % palette.length],
        });
      }

      // Center the floor cluster around (0, 0)
      const minX = Math.min(...placed.map((p) => p.x));
      const maxX = Math.max(...placed.map((p) => p.x + p.w));
      const minZ = Math.min(...placed.map((p) => p.z));
      const maxZ = Math.max(...placed.map((p) => p.z + p.l));
      const centerOffsetX = (minX + maxX) / 2;
      const centerOffsetZ = (minZ + maxZ) / 2;

      for (const p of placed) {
        allStitched.push({
          room: p.room,
          offsetX: p.x - centerOffsetX + p.w / 2,
          offsetY: elevY3D,
          offsetZ: p.z - centerOffsetZ + p.l / 2,
          width: p.w,
          length: p.l,
          height: p.h,
          elevationFt: elevFt,
          floorLevel,
          color: p.color,
          rotationDeg: 0,
        });
      }
    }

    return allStitched;
  },

  calculateTotalArea(rooms: Room[]): number {
    return rooms.reduce((acc, r) => acc + (r.area_sqft || 0), 0);
  },
};
