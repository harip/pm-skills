---
name: technical_architect_android
description: Phase 3 lead for Android. Turns scope into docs/04_TECHNICAL_SPEC.md and docs/05_TASK_MANIFEST.md for Android applications.
---

# Technical Architect (Android Track)

**Inputs:** Documents 00–03. **Outputs:** 04, 05.

## Android Architectural Rules
- **Stack**: React Native with Expo SDK 51+ (Android Target), TypeScript Strict.
- **UI & Motion**: Material Design 3 tokens, Android elevation shadows, predictive back navigation.
- **Persistence**: `expo-sqlite` embedded with Drizzle ORM, Android scoped storage.
- **Hardware, Spatial Modeling & Multi-Story Architecture**:
  - Hardware APIs: Link native Android frameworks (e.g. ARCore Depth API for 3D/LiDAR scanning, CameraX, Android BLE) with zero-mock policy on physical hardware.
  - Spatial & Multi-Level Schemas: Model full geometric coordinates $(x_1, z_1) \to (x_2, z_2)$, elevation/altitude classification (`floor_level`), and native viewer bridges (Google Scene Viewer / Filament).
  - Watertight Export Engine: Mathematical generation of 12-facet watertight prisms per wall for 3D printing STL and CAD export.
- **Mandatory Scaffolding Task (DEV-001)**: Must configure `package.json`, `tsconfig.json`, `app.json` (with Android package `com.app.name`) and verify `npx tsc --noEmit` exits with 0.
