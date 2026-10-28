---
platform: ios
is_test_sandbox: true
discovery_answers_source: docs/00_DISCOVERY_ANSWERS.json
capabilities:
  public_content: true
  authentication: none
  persistence: required
  offline_writes: required
  shared_records: none
  backend: none
targets:
  database: sqlite
  deployment: user_managed
---

# 00 Project Contract: LiDAR Room & Whole-House 3D Studio (iOS)

## 1. Confirmed Feature & UX Scope Table
| Feature ID | Feature Name | Category | User-Confirmed Behavior & Notes |
|---|---|---|---|
| `feat_realtime_lidar` | Realtime LiDAR 3D Mesh Scanning | Scanner Core | 60 Hz point-cloud capture reconstructing watertight 3D room meshes. |
| `feat_universal_fallback` | Universal Hardware Simulation Fallback | Scanner Core | Full scanning and mesh generation supported on non-LiDAR iPhones and simulators. |
| `feat_realtime_dimensions` | Live Dimension Callouts (W × L × H) | Measurements | Realtime measurement tags attached to detected wall edges and ceiling heights. |
| `feat_2d_floorplan` | 2D Architectural Floor Plan Generation | Studio | Project 3D scanned rooms into clean 2D architectural blueprints. |
| `feat_unit_conversion` | Instant Imperial ↔ Metric Unit Toggle | Studio | Dynamic toggle between ft/in (sq ft) and meters (m²). |
| `feat_cad_furniture` | CAD Furniture Placement | Studio | Drag-and-drop standard 3D furniture models to test room layout fit. |
| `feat_multi_room_stitch` | Whole-House Multi-Room Auto-Stitch | Composite | Automatically align and combine multiple room scans via shared doorways. |
| `feat_stl_export` | Standard 3D CAD Export (.STL / .OBJ) | Export | Export watertight 3D models for 3D printing and CAD software. |
| `feat_first_class_empty` | First-Class Empty State Catalog | UX / Data | Clean Apple-style empty state with zero hardcoded fake records on fresh install. |
| `feat_local_persistence` | Offline-First Local Storage | Data | All meshes, dimensions, and metadata saved locally on device without cloud lock-in. |

## 2. Questionnaire Decision Traceability Table
| Question ID | Dimension | Selected Option(s) | Custom User Note | Architectural Impact |
|---|---|---|---|---|
| `q_mesh_density` | Scanner Engine | Adaptive Precision | Auto-adaptive | Low memory consumption; dense edges and corners with lightweight flat planes. |
| `q_default_units` | Measurements | Imperial Units (ft / in) | Standard residential | Default display in ft / in, with instantaneous unit converter to metric. |
| `q_hardware_fallback` | Device Compatibility | Universal Simulation Fallback | Zero hollow shells | High-precision synthetic scanning fallback ensures full testability on all devices. |
| `q_stitching_method` | Whole-House Composite | Shared Doorway Detection | Auto-ICP snap | Doorway opening coordinate alignment with manual snap adjustment. |
| `q_export_formats` | File Exports | .STL, .OBJ, .DXF | CAD standard | Generate binary/ASCII STL files, OBJ geometry, and DXF 2D vectors locally. |
| `q_empty_state` | Data & Onboarding | Apple Empty State + Segmented Preview | Zero fake data | Screen component queries DB; displays empty state with sample preview toggle. |
| `q_furniture_catalog` | Studio | Living, Bedroom, Openings | Core CAD pack | Built-in parametric bounding models for furniture fitting. |
| `q_data_storage` | Storage | Local On-Device SQLite | Offline-first | `expo-sqlite` embedded storage with JSON blob mesh definitions. |
| `q_haptic_feedback` | Polish | Rich Haptics | Native iOS feel | `expo-haptics` triggers on corner snaps, scan pauses, and exports. |
| `q_design_theme` | Visual Design | Strict Apple HIG Light Mode | Zero dark mode | Canvas `#f5f5f7`, surfaces `#ffffff`, text `#1c1c1e`, SF Pro typography. |
