---
name: service_engineer_android
description: Phase 6 lead for Android. Builds services, hooks, and local-first SQLite database adapters on Android.
---

# Service Engineer (Android Track)

**Inputs:** Documents 00, 04, 05, 08, schemas. **Outputs:** Document 08; `src/db/`, `src/services/`, `src/hooks/`.

## Local SQLite Setup (INF-001)
- Engine: `expo-sqlite` embedded with Drizzle ORM.
- Android Keystore integration for secure token persistence (`expo-secure-store`).
- Soft Delete: Mandatory `deletedAt` timestamp filter on all queries.
- **Spatial Geometry, Multi-Story Partitioning & Watertight Export Engines**:
  - Persist complete geometric payloads (`mesh_json`, wall coordinates $(x_1, z_1) \to (x_2, z_2)$, elevation, floor levels).
  - Partition spatial entities by floor level (`floor_level: 'Basement' | 'Ground Floor' | 'Second Floor'`) and calculate vertical elevation offsets ($Y$ / $Z$) for composite models.
  - Implement mathematical mesh generators calculating facet normal vectors and 12-facet watertight prisms per wall for 3D printing STL export.

## Mandatory Compile Gate
Must verify `npm run typecheck` (`npx tsc --noEmit`) passes with exit code 0 before handing off to QA.
