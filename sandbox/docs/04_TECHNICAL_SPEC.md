# 04 Technical Specification: LiDAR Room & Whole-House 3D Studio (iOS)

## 1. System Context & Runtime Architecture
- **Target Platform**: iOS (React Native / Expo SDK 52+, TypeScript Strict)
- **Design Standard**: Strict Apple Human Interface Guidelines in Light Mode (`#f5f5f7` canvas, `#ffffff` card/sheet surfaces, `#1c1c1e` text, `#007aff` action tint, SF Pro fonts)
- **Graphics Pipeline**: `react-native-svg` and vector 3D projection engine with touch orbit controls, 100% compatible with Expo Go and web preview
- **Hardware Integration**: Dual-engine architecture featuring hardware sensor hooks with universal functional simulation fallback, ensuring zero hollow shells on any device
- **Persistence**: `expo-sqlite` embedded local database with offline-first indexing

## 2. Module Boundaries
```
sandbox/
├── src/
│   ├── types/               # TypeScript interfaces & domain models
│   │   ├── room.ts          # Room mesh, dimensions, and coordinates
│   │   ├── furniture.ts     # Furniture CAD catalog item
│   │   └── house.ts         # Multi-room stitched composite model
│   ├── db/                  # expo-sqlite database & migrations
│   │   ├── schema.ts        # Database table schemas
│   │   └── database.ts      # Database connection & initialization
│   ├── services/            # Pure domain services
│   │   ├── scannerService.ts    # LiDAR & simulation scanner engine
│   │   ├── geometryService.ts   # 3D/2D projection & dimension math
│   │   ├── stitchEngine.ts      # Doorway matching & composite stitcher
│   │   └── stlExporterService.ts# STL 3D mesh generator & downloader
│   ├── hooks/               # React Native state hooks
│   │   ├── useRoomsCatalog.ts
│   │   ├── useLidarScanner.ts
│   │   ├── useRoomStudio.ts
│   │   └── useHouseStitch.ts
│   └── screens/             # Strict Apple HIG Light Mode screens
│       ├── RoomsCatalogScreen.tsx   # SCR-001 (First-class empty state)
│       ├── LidarScannerScreen.tsx   # SCR-002 (3D scanner & point cloud)
│       ├── RoomStudioScreen.tsx     # SCR-003 (3D solid mesh / 2D floor plan)
│       └── WholeHouseStitchScreen.tsx# SCR-004 (Composite whole-house)
```

## 3. Data Model Schema
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  length_ft REAL NOT NULL,
  width_ft REAL NOT NULL,
  height_ft REAL NOT NULL,
  area_sqft REAL NOT NULL,
  mesh_json TEXT NOT NULL,
  is_sample INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS furniture_items (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  pos_x REAL NOT NULL,
  pos_z REAL NOT NULL,
  rotation_deg REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS house_projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  room_ids_json TEXT NOT NULL,
  total_area_sqft REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 4. Hardware Simulation Fallback Pipeline
Every scanner trigger interacts with `scannerService.ts`. If hardware LiDAR depth buffers are unavailable (e.g. standard iPhone or simulator), the service generates synthetic 3D room geometries with realistic noise and live dimension updates. When "Finish Scan" is pressed, a complete structured room record is committed to SQLite, ensuring all subsequent studio views and STL exports operate flawlessly.

## 5. NFR Verification Mapping
- **NFR-01 (60fps Render)**: Verified via batched SVG vector updates in `react-native-svg`.
- **NFR-02 (Empty State Launch < 800ms)**: Verified by direct asynchronous SQLite select query on mount.
- **NFR-03 (Offline Integrity)**: Verified by executing all scan, studio, stitch, and export actions with zero external network calls.
