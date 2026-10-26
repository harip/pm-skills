---
name: service_engineer_ios
description: Phase 6 lead for iOS. Builds services, hooks, and local-first SQLite database adapters using Drizzle and expo-sqlite.
---

# Service Engineer (iOS Track)

**Inputs:** Documents 00, 04, 05, 08, schemas. **Outputs:** Document 08; `src/db/`, `src/services/`, `src/hooks/`.

## Local-First SQLite Setup (INF-001)
- Engine: `expo-sqlite` embedded with Drizzle ORM.
- Storage: `expo-file-system` document directory for binary blobs/images.
- Soft Delete: Mandatory `deletedAt` timestamp; never use hard SQL `DELETE`.
- Secrets: Never store cloud secrets or API keys in code or registers for local-first apps.

## Architecture & Hooks
- Hooks: `useResource<T>` → `{ data, isLoading, error, refetch }`; `useMutation<TIn, TOut>` → `{ mutate, isSubmitting, error, reset }`.
- Performance: Offload heavy geometric/analytical calculations (e.g. Shoelace area, Euclidean perimeter) into worklets or memoized pure functions.
- **Dynamic Repository & Decoupled Seed Data**: All queries must flow through dynamic repository methods (`getAll()`, `save()`, `delete()`). Provide a decoupled `seedInitialData()` function in `src/db/` so sample records are never hardcoded into screen components, allowing fresh installs to start cleanly in the Zero/Empty state.
- **Spatial Geometry, Multi-Story Partitioning & Watertight Export Engines**:
  - **Full-Fidelity Persistence**: Schemas and repositories must persist complete geometric payloads (`mesh_json`, wall arrays $(x_1, z_1) \to (x_2, z_2)$, thickness, elevation, and floor levels).
  - **Multi-Story Partitioning Engine**:
    - Group and partition rooms/entities by elevation/level (`floor_level: 'Basement' | 'Ground Floor' | 'Second Floor'`).
    - Spatial alignment algorithms must stitch within level boundaries, never flattening multi-story rooms onto a single flat plane.
    - Calculate vertical elevation offsets ($Y$ / $Z$) for multi-level composite 3D models.
  - **Watertight STL & CAD Export Generation**:
    - Implement mathematical mesh generators calculating facet surface normal vectors and 12-facet watertight prisms per wall.
    - Composite STL generators must preserve vertical altitude offsets so 3D printing slicers render multi-story structures correctly.

## Mandatory Compile Gate
Before marking Phase 6 complete:
1. Verify database schema migrations compile without syntax errors.
2. Run `npm run typecheck` (`npx tsc --noEmit`) to confirm clean build exit code 0.
