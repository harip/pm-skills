// sandbox/src/services/stlExporterService.ts
import { Room } from '../types/room';
import { GeometryService, WallSubPrism } from './geometryService';
import { StitchEngine, StitchedRoomLayout } from './stitchEngine';

export interface StlExportOptions {
  withRoof?: boolean;
  includeFurniture?: boolean;
}

export const StlExporterService = {
  generateAsciiStl(room: Room, options: StlExportOptions = {}): string {
    const withRoof = options.withRoof !== undefined ? options.withRoof : true;
    const includeFurniture = options.includeFurniture !== undefined ? options.includeFurniture : true;
    const safeName = (room.name || 'Room').replace(/[^a-zA-Z0-9_]/g, '_');

    let parsedMesh: any = null;
    try {
      if (room.mesh_json) {
        parsedMesh = JSON.parse(room.mesh_json);
      }
    } catch {
      parsedMesh = null;
    }

    const walls: any[] = parsedMesh?.walls || [];
    const polygon = GeometryService.buildRoomPolygon(walls, room.width_ft || 14, room.length_ft || 16);
    const N = polygon.length;
    const heightM = (room.height_ft || 8.1) * 0.3048;
    const floorSlabM = 0.08; // 8cm solid floor slab
    const roofSlabM = 0.10;  // 10cm solid roof slab

    let stl = `solid ${safeName}\n`;

    // Certified Pure Rigid 90° Rotation (det = +1.0, ZERO Reflection / Zero Mirroring):
    // Maps RoomPlan right-handed frame (X=Right, Y=Up, Z=Back/South)
    // to STL 3D-Printer Slicer frame (X_stl=X, Y_stl=-Z, Z_stl=Y)
    // Preserves exact spatial chirality: What is on the right in 3D remains on the right in STL.
    const addFacet = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number
    ) => {
      const pAx = ax, pAy = -az, pAz = ay;
      const pBx = bx, pBy = -bz, pBz = by;
      const pCx = cx, pCy = -cz, pCz = cy;

      const u1 = pBx - pAx, u2 = pBy - pAy, u3 = pBz - pAz;
      const v1 = pCx - pAx, v2 = pCy - pAy, v3 = pCz - pAz;

      // Standard Right-Hand Outward Normal: u x v
      const nx = u2 * v3 - u3 * v2;
      const ny = u3 * v1 - u1 * v3;
      const nz = u1 * v2 - u2 * v1;
      const len = Math.hypot(nx, ny, nz) || 1.0;

      stl += `  facet normal ${(nx / len).toFixed(5)} ${(ny / len).toFixed(5)} ${(nz / len).toFixed(5)}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${pAx.toFixed(4)} ${pAy.toFixed(4)} ${pAz.toFixed(4)}\n`;
      stl += `      vertex ${pBx.toFixed(4)} ${pBy.toFixed(4)} ${pBz.toFixed(4)}\n`;
      stl += `      vertex ${pCx.toFixed(4)} ${pCy.toFixed(4)} ${pCz.toFixed(4)}\n`;
      stl += `    endloop\n  endfacet\n`;
    };

    // Watertight Manifold 6-Face Rectangular Sub-Prism with Strictly Outward Facets
    const addPrism = (prism: WallSubPrism) => {
      const { v0, v1, v2, v3, v4, v5, v6, v7 } = prism.vertices;

      // 1. Bottom face (y = yMin, normal down in STL: [0, 0, -1])
      addFacet(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      addFacet(v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);

      // 2. Top face (y = yMax, normal up in STL: [0, 0, 1])
      addFacet(v4.x, v4.y, v4.z, v7.x, v7.y, v7.z, v6.x, v6.y, v6.z);
      addFacet(v4.x, v4.y, v4.z, v6.x, v6.y, v6.z, v5.x, v5.y, v5.z);

      // 3. Outer face (normal outward)
      addFacet(v0.x, v0.y, v0.z, v4.x, v4.y, v4.z, v5.x, v5.y, v5.z);
      addFacet(v0.x, v0.y, v0.z, v5.x, v5.y, v5.z, v1.x, v1.y, v1.z);

      // 4. Inner face (normal inward)
      addFacet(v2.x, v2.y, v2.z, v6.x, v6.y, v6.z, v7.x, v7.y, v7.z);
      addFacet(v2.x, v2.y, v2.z, v7.x, v7.y, v7.z, v3.x, v3.y, v3.z);

      // 5. Start cap (transverse return at tMin)
      addFacet(v3.x, v3.y, v3.z, v7.x, v7.y, v7.z, v4.x, v4.y, v4.z);
      addFacet(v3.x, v3.y, v3.z, v4.x, v4.y, v4.z, v0.x, v0.y, v0.z);

      // 6. End cap (transverse return at tMax)
      addFacet(v1.x, v1.y, v1.z, v5.x, v5.y, v5.z, v6.x, v6.y, v6.z);
      addFacet(v1.x, v1.y, v1.z, v6.x, v6.y, v6.z, v2.x, v2.y, v2.z);
    };

    // Convert polygon to meters
    const ptsM = polygon.map((p) => ({ x: p.x * 0.3048, z: p.z * 0.3048 }));

    // Center of room polygon
    const centerM = {
      x: ptsM.reduce((acc, p) => acc + p.x, 0) / N,
      z: ptsM.reduce((acc, p) => acc + p.z, 0) / N,
    };

    // Convert wall segments to meters for aperture projection
    const wallSegments = [];
    for (let i = 0; i < N; i++) {
      const cur = ptsM[i];
      const next = ptsM[(i + 1) % N];
      wallSegments.push({ p1: cur, p2: next });
    }

    // Determine window sill height based on room type (ADJ-09: kitchen 38.0", bedroom 32.0")
    const isKitchen = /kitchen|dining/i.test(room.name || '');
    const defaultSillM = isKitchen
      ? GeometryService.KITCHEN_WINDOW_SILL_M
      : GeometryService.BEDROOM_WINDOW_SILL_M;

    // Project detected doors and windows onto walls
    const apertureMap = GeometryService.projectAperturesOntoWalls(
      wallSegments,
      parsedMesh?.doors || [],
      parsedMesh?.windows || [],
      defaultSillM
    );

    // Check for nearby plumbing fixtures to upgrade wet walls (ADJ-05)
    const objects: any[] = parsedMesh?.objects || [];
    const hasPlumbingFixtureNearWall = (w1: { x: number; z: number }, w2: { x: number; z: number }) => {
      const len = Math.hypot(w2.x - w1.x, w2.z - w1.z);
      if (len < 0.1) return false;
      const ux = (w2.x - w1.x) / len;
      const uz = (w2.z - w1.z) / len;

      for (const obj of objects) {
        if (/sink|toilet|bath|tub|shower|lavatory/i.test(obj.category || '')) {
          const ox = (obj.x || 0) * 0.3048;
          const oz = (obj.z || 0) * 0.3048;
          const vx = ox - w1.x;
          const vz = oz - w1.z;
          const proj = vx * ux + vz * uz;
          const perp = Math.abs(vx * uz - vz * ux);
          if (proj >= -0.2 && proj <= len + 0.2 && perp <= 0.4572) {
            return true;
          }
        }
      }
      return false;
    };

    // --- 1. Solid Base Floor Slab (y = 0 to floorSlabM) ---
    // Bottom face (y = 0, normal: [0, 0, -1])
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addFacet(
        centerM.x, 0, centerM.z,
        ptsM[i].x, 0, ptsM[i].z,
        ptsM[next].x, 0, ptsM[next].z
      );
    }
    // Top face of floor slab (y = floorSlabM, normal: [0, 0, 1])
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addFacet(
        centerM.x, floorSlabM, centerM.z,
        ptsM[next].x, floorSlabM, ptsM[next].z,
        ptsM[i].x, floorSlabM, ptsM[i].z
      );
    }
    // Floor slab perimeter edge faces (outward facing)
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const p1 = ptsM[i];
      const p2 = ptsM[next];
      addFacet(p1.x, 0, p1.z, p1.x, floorSlabM, p1.z, p2.x, floorSlabM, p2.z);
      addFacet(p1.x, 0, p1.z, p2.x, floorSlabM, p2.z, p2.x, 0, p2.z);
    }

    // --- 2. Watertight Parametric Wall Assemblies with Real Aperture Cutouts ---
    for (let i = 0; i < N; i++) {
      const p1 = ptsM[i];
      const p2 = ptsM[(i + 1) % N];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz) || 1.0;

      // Compute outward-facing wall normal in RoomPlan
      let nx = -dz / len;
      let nz = dx / len;
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      if (nx * (midX - centerM.x) + nz * (midZ - centerM.z) < 0) {
        nx = -nx;
        nz = -nz;
      }

      const isWet = hasPlumbingFixtureNearWall(p1, p2);
      const wallThickM = isWet
        ? GeometryService.PLUMBING_WALL_THICKNESS_M
        : GeometryService.EXTERIOR_WALL_THICKNESS_M;

      const apertures = apertureMap.get(i) || [];

      // Subdivide wall into discrete sub-prisms around openings
      const subPrisms = GeometryService.subdivideWallWithOpenings(
        p1,
        p2,
        wallThickM,
        heightM,
        { x: nx, z: nz },
        apertures
      );

      // Emit all watertight sub-prisms
      for (const prism of subPrisms) {
        addPrism(prism);
      }
    }

    // --- 3. Roof Slab (If Selected) ---
    if (withRoof) {
      const topY = heightM + roofSlabM;
      // Roof slab top face (y = topY, normal up)
      for (let i = 0; i < N; i++) {
        const next = (i + 1) % N;
        addFacet(
          centerM.x, topY, centerM.z,
          ptsM[next].x, topY, ptsM[next].z,
          ptsM[i].x, topY, ptsM[i].z
        );
      }
      // Roof slab bottom ceiling face (y = heightM, normal down)
      for (let i = 0; i < N; i++) {
        const next = (i + 1) % N;
        addFacet(
          centerM.x, heightM, centerM.z,
          ptsM[i].x, heightM, ptsM[i].z,
          ptsM[next].x, heightM, ptsM[next].z
        );
      }
      // Roof slab perimeter edge faces
      for (let i = 0; i < N; i++) {
        const next = (i + 1) % N;
        const p1 = ptsM[i];
        const p2 = ptsM[next];
        addFacet(p1.x, heightM, p1.z, p1.x, topY, p1.z, p2.x, topY, p2.z);
        addFacet(p1.x, heightM, p1.z, p2.x, topY, p2.z, p2.x, heightM, p2.z);
      }
    }

    // --- 4. Furniture / Detected Objects (Watertight Grounded Manifold Boxes) ---
    if (includeFurniture) {
      objects.forEach((obj) => {
        const cx = (obj.x ?? 0) * 0.3048;
        const cz = (obj.z ?? 0) * 0.3048;
        const wM = (obj.widthFt || 3) * 0.3048;
        const lM = (obj.lengthFt || 3) * 0.3048;
        const hM = (obj.heightFt || 2.5) * 0.3048;
        const halfW = wM / 2;
        const halfL = lM / 2;

        let ux = 1, uz = 0;
        let vx = 0, vz = 1;
        if (obj.dirXx !== undefined && obj.dirXz !== undefined) {
          const lenX = Math.hypot(obj.dirXx, obj.dirXz) || 1;
          ux = obj.dirXx / lenX;
          uz = obj.dirXz / lenX;
          if (obj.dirZx !== undefined && obj.dirZz !== undefined) {
            const lenZ = Math.hypot(obj.dirZx, obj.dirZz) || 1;
            vx = obj.dirZx / lenZ;
            vz = obj.dirZz / lenZ;
          } else {
            vx = -uz;
            vz = ux;
          }
        } else if (obj.yawDeg !== undefined) {
          const rad = (obj.yawDeg * Math.PI) / 180;
          ux = Math.cos(rad);
          uz = Math.sin(rad);
          vx = -uz;
          vz = ux;
        }

        // Solid Grounded Base: Anchors all furniture directly to build plate (y = 0.0)
        const yBase = 0.0;
        const yTop = floorSlabM + hM;

        const c0 = { x: cx - halfW * ux - halfL * vx, z: cz - halfW * uz - halfL * vz };
        const c1 = { x: cx + halfW * ux - halfL * vx, z: cz + halfW * uz - halfL * vz };
        const c2 = { x: cx + halfW * ux + halfL * vx, z: cz + halfW * uz + halfL * vz };
        const c3 = { x: cx - halfW * ux + halfL * vx, z: cz - halfW * uz + halfL * vz };

        // Bottom face (y = yBase, normal down in STL)
        addFacet(c0.x, yBase, c0.z, c1.x, yBase, c1.z, c2.x, yBase, c2.z);
        addFacet(c0.x, yBase, c0.z, c2.x, yBase, c2.z, c3.x, yBase, c3.z);

        // Top face (y = yTop, normal up in STL)
        addFacet(c0.x, yTop, c0.z, c3.x, yTop, c3.z, c2.x, yTop, c2.z);
        addFacet(c0.x, yTop, c0.z, c2.x, yTop, c2.z, c1.x, yTop, c1.z);

        // Side 0 (c0 -> c1)
        addFacet(c0.x, yBase, c0.z, c0.x, yTop, c0.z, c1.x, yTop, c1.z);
        addFacet(c0.x, yBase, c0.z, c1.x, yTop, c1.z, c1.x, yBase, c1.z);

        // Side 1 (c1 -> c2)
        addFacet(c1.x, yBase, c1.z, c1.x, yTop, c1.z, c2.x, yTop, c2.z);
        addFacet(c1.x, yBase, c1.z, c2.x, yTop, c2.z, c2.x, yBase, c2.z);

        // Side 2 (c2 -> c3)
        addFacet(c2.x, yBase, c2.z, c2.x, yTop, c2.z, c3.x, yTop, c3.z);
        addFacet(c2.x, yBase, c2.z, c3.x, yTop, c3.z, c3.x, yBase, c3.z);

        // Side 3 (c3 -> c0)
        addFacet(c3.x, yBase, c3.z, c3.x, yTop, c3.z, c0.x, yTop, c0.z);
        addFacet(c3.x, yBase, c3.z, c0.x, yTop, c0.z, c0.x, yBase, c0.z);
      });
    }

    stl += `endsolid ${safeName}`;
    return stl;
  },

  // Multi-Story & Multi-Room Contiguous Attached Composite STL
  generateCompositeStl(rooms: Room[], options: StlExportOptions = {}): string {
    let output = `solid Whole_House_Composite_Model\n`;

    const layouts = StitchEngine.computeAttachedLayout(rooms);
    const layoutMap = new Map<string, StitchedRoomLayout>();
    layouts.forEach((l) => layoutMap.set(l.room.id, l));

    rooms.forEach((room) => {
      const layout = layoutMap.get(room.id);
      const offsetX_M = (layout?.offsetX || 0) * 0.3048;
      // In pure rigid rotation: Y_stl = -Z_plan, so offsetY_M = -offsetZ * 0.3048
      const offsetY_M = -(layout?.offsetZ || 0) * 0.3048;
      const elevM = (layout?.elevationFt || 0) * 0.3048;

      const stlSnippet = StlExporterService.generateAsciiStl(room, options);
      const adjusted = stlSnippet.replace(
        /vertex\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/g,
        (_, vx, vy, vz) => {
          const newX = (parseFloat(vx) + offsetX_M).toFixed(4);
          const newY = (parseFloat(vy) + offsetY_M).toFixed(4);
          const newZ = (parseFloat(vz) + elevM).toFixed(4);
          return `vertex ${newX} ${newY} ${newZ}`;
        }
      );
      const body = adjusted
        .replace(/solid\s+[^\n]+\n/, '')
        .replace(/endsolid\s+[^\n]+/, '');
      output += body + '\n';
    });

    output += `endsolid Whole_House_Composite_Model`;
    return output;
  },
};
