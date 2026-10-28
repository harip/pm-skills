# 01 Architecture Brief: LiDAR Room & Whole-House 3D Studio (iOS)

## Executive Summary
A native iOS application providing real-time 3D room scanning, architectural floor plan generation, CAD furniture fitting, and multi-room whole-house stitching. Designed exclusively in strict Apple HIG Light Mode with minimalist aesthetics and robust offline-first SQLite persistence. Includes a universal functional simulation engine guaranteeing 100% testability across all iPhones and preview environments.

## Confirmed UX Journey
1. **Catalog & Launch**: Fresh launch renders a first-class Apple Empty State with zero hardcoded mock records. Users can toggle the segmented control to preview sample layouts or tap "Start New LiDAR Scan".
2. **Realtime 3D Scanning**: Full-bleed 3D viewport renders dynamic point cloud wireframe with live dimension tags (W × L × H). Tap "Finish Scan" to save structured mesh records.
3. **Room Studio**: Inspect scanned rooms in 3D Solid Mesh or 2D Architectural Floor Plan. Toggle imperial/metric units, drop 3D furniture models, and export 3D `.STL` files.
4. **Whole-House Auto-Stitch**: Combine multiple room scans via shared doorway matching to create complete home composites with square footage totals and master `.STL` download.

## Complete Screen Inventory
| Screen ID | Screen Name | Purpose | Key Interactive Controls |
|---|---|---|---|
| `SCR-001` | Rooms Catalog | Catalog & Project Management | Empty state CTA, segmented sample toggle, project cards, new scan button |
| `SCR-002` | Realtime LiDAR Scanner | AR/LiDAR scanning & point cloud | 360° orbit drag, record/pause button, mesh density toggle, dimension tags |
| `SCR-003` | Room & Floor Plan Studio | 3D inspection & 2D CAD blueprint | `[ 🧊 3D \| 📐 2D ]` toggle, unit switcher, furniture tray, `.STL` export |
| `SCR-004` | Whole-House 3D Stitch | Composite multi-room alignment | Room filter chips, auto-align button, total area badge, master `.STL` export |

## Platform Stack & Dependencies
- **Core Platform**: React Native + Expo (SDK 52+), TypeScript Strict
- **UI & Aesthetics**: Apple HIG Light Mode (`#f5f5f7` canvas, `#ffffff` cards, `#1c1c1e` text, `#007aff` tint, SF Pro)
- **3D Graphics & Floor Plan Rendering**: SVG & Canvas 2.5D/3D projection engine with interactive touch orbit
- **Data Persistence**: `expo-sqlite` embedded local database
- **Haptics & Exports**: `expo-haptics`, `expo-sharing`, `expo-file-system`

## Data Architecture
- **Table `rooms`**: `id`, `name`, `length`, `width`, `height`, `area_sqft`, `mesh_json`, `created_at`
- **Table `furniture_items`**: `id`, `room_id`, `name`, `pos_x`, `pos_z`, `rotation`
- **Table `house_projects`**: `id`, `name`, `room_ids_json`, `total_area_sqft`, `updated_at`

## Integrations & Guardrails
- **Hardware Agnostic**: Automatically activates universal high-fidelity simulation on non-LiDAR iPhones and simulators.
- **Zero Dark Mode**: Strict light theme enforcement across all screens, modals, and HUD overlays.
- **Zero Hollow Shells**: Every button executes a real state transition or persists verified data.
