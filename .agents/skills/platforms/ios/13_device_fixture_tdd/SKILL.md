---
name: device_fixture_tdd_ios
description: Universal Device-to-Fixture Test-Driven Development (Device-Fixture TDD) for iOS applications across all domains. Captures real-device sandbox state, seeds persistent Before/After SQLite test fixtures, and iterates code against automated assertions until 100% parity before hardware re-deployment.
---

# Universal Device-to-Fixture Test-Driven Development (Device-Fixture TDD)

## Overview & Core Philosophy
In real-world iOS development, the most elusive defects, data corruptions, and interaction failures occur on physical devices—where real sensors, touch kinematics, memory pressures, network fluctuations, and offline databases interact.

**Device-Fixture TDD** replaces speculative manual debugging and artificial mocks with a deterministic 4-step loop:
1. **Extract Physical Reality**: Pull the exact application state from the connected iPhone via `xcrun devicectl`.
2. **Seed Persistent Fixture Database**: Store the snapshot as a version-controlled **Before State** and define the mathematically/relationally verified **Target After State** in a local SQLite test database (`test-fixtures.sqlite`).
3. **Local Test-Driven Iteration Loop**: Run high-speed automated regression tests against the Before State, asserting 100% parity with the Target After State. Refactor and refine code locally with sub-second feedback.
4. **Deploy & Verify on Hardware**: Re-install the verified binary to the physical iPhone, launch, and execute automated visual OCR verification.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. REAL DEVICE CAPTURE                                                 │
│    xcrun devicectl device copy from --domain-type appDataContainer     │
│    (Pulls raw SQLite, JSON state, sensor point clouds, or cache dumps) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PERSISTENT TEST FIXTURE DATABASE (test-fixtures.sqlite)             │
│    • TC-ID: Unique Test Identifier                                     │
│    • Before State: Exact snapshot from physical device                 │
│    • Action Trigger: User gesture, network event, or state mutation    │
│    • Target After State: Expected post-action state & invariants       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. FAST LOCAL TEST-DRIVEN ITERATION (0.2s Terminal Loop)               │
│    node test-fixture-runner.js                                         │
│    Iterate code until computed state matches Target After State (100%) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. HARDWARE DEPLOYMENT & VISUAL OCR CONFIRMATION                       │
│    xcrun devicectl device install app & process launch                 │
│    Capture native screenshot & assert visual OCR text/layout           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Universal Applicability Across Application Domains

This protocol is intentionally domain-agnostic and applies to **all categories of iOS applications**:

### 1. FinTech & E-Commerce Applications
- **Real-World Device State**: User's active shopping cart, multi-currency wallet balance, offline pending transactions, layered promotional codes, tax exemption flags.
- **Before State**: Cart with mixed taxable/tax-exempt items, localized currency formatting, partial promo code applied.
- **Action Trigger**: User toggles shipping address to another tax jurisdiction or applies a stacked coupon.
- **Target After State**: Subtotal, compound sales tax allocations, discounts, and ledger balance match exact statutory rounding rules (zero cent discrepancy).

### 2. Productivity, Notes & Offline-First Collaboration
- **Real-World Device State**: Local SQLite/WatermelonDB/Realm tables, dirty conflict markers, outbox mutation queue, rich-text markdown AST.
- **Before State**: Note edited while device was in Airplane Mode, containing uncommitted local blocks.
- **Action Trigger**: Network reconnects; incoming server delta modifies overlapping block.
- **Target After State**: CRDT / operational transform cleanly merges remote changes without duplicated UUIDs, lost paragraphs, or timestamp inversion.

### 3. Social, Messaging & Feed Applications
- **Real-World Device State**: Chat thread message cache, unread badge counters, cursor pagination token, media upload queue.
- **Before State**: 20 cached messages with scroll offset at top; socket disconnects.
- **Action Trigger**: User pulls-to-refresh while 3 new incoming messages arrive over socket.
- **Target After State**: Contiguous, deduplicated message list with strictly monotonic timestamps and preserved scroll position.

### 4. Media, Audio & File Management
- **Real-World Device State**: Offline playback download queue, audio playback state machine, disk cache eviction LRU table.
- **Before State**: Local disk cache directory at 98% storage quota with 5 downloaded tracks.
- **Action Trigger**: User starts streaming/downloading a high-res video file.
- **Target After State**: Least-recently-used cache files evicted cleanly, active track indexed without playback stutter, quota invariant preserved.

### 5. Spatial, Hardware Sensors & IoT (LiDAR, Camera, BLE)
- **Real-World Device State**: Raw LiDAR mesh polygons, BLE beacon RSSI readings, CoreMotion gyroscope packets.
- **Before State**: Raw sensor data with noisy zig-zag edge artifacts or non-orthogonal wall lines.
- **Action Trigger**: User drags or snaps a wall to vertical ($90^\circ$) or perpendicular ($\perp$).
- **Target After State**: Closed watertight polygon, true $90.0^\circ$ right-angle corners, zero self-intersections, no dimensional ballooning.

---

## Step-by-Step Implementation Guide

### Step 1: Extract Physical Device State
Use Apple's modern CoreDevice CLI (`devicectl`) to pull the application's data container:

```bash
# 1. Discover connected iPhone UDID
xcrun devicectl list devices

# 2. Copy the entire Documents / Application Support directory from device
xcrun devicectl device copy from \
  --device <DEVICE_UDID> \
  --domain-type appDataContainer \
  --domain-identifier <PRODUCT_BUNDLE_ID> \
  --source Documents \
  --destination /tmp/device_app_documents
```

Files extracted include:
- Local SQLite database files (`*.sqlite`, `*.db`).
- Saved JSON documents, serialized user profiles, or drafts.
- Cache blobs, sensor scan payloads (`.json`, `.usdz`), or logs.

---

### Step 2: Seed the Persistent Fixture Database (`test-fixtures.sqlite`)

Create or update the standard SQLite fixture database in the workspace (`sandbox/test-fixtures.sqlite`):

```sql
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,                       -- e.g. "TC-CART-TAX-01", "TC-SYNC-MERGE-02"
  name TEXT NOT NULL,                        -- Descriptive title of the scenario
  app_category TEXT NOT NULL,                -- "fintech" | "productivity" | "social" | "media" | "sensors"
  description TEXT,                          -- Specific defect or interaction being tested
  before_state_json TEXT NOT NULL,           -- Raw JSON extracted from device
  action_trigger TEXT NOT NULL,              -- Action signature (e.g. "APPLY_DISCOUNT", "ROTATE_WALL_90")
  target_after_state_json TEXT NOT NULL,     -- Mathematically/relationally verified target state
  actual_after_state_json TEXT,              -- Last computed output from test runner
  is_passing INTEGER DEFAULT 0,              -- 1 if passing, 0 if failing
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Defining the Target After State
Never use "close enough" estimates. The **Target After State** must define exact invariant assertions:
- **Relational Integrity**: Foreign keys, unique constraints, and referential completeness.
- **Mathematical Invariants**: Monetary balance sums, coordinate angles ($\theta \pm 0.1^\circ$), dimensional bounds ($W \le 14\text{ft}$, never $75\text{ft}$).
- **Topological Invariants**: Watertight closure, zero self-intersections, strict array ordering.

---

### Step 3: Fast Local Test-Driven Iteration Loop

Author an automated runner (`sandbox/test-fixture-runner.js`) that:
1. Connects to `test-fixtures.sqlite`.
2. Queries the targeted test case(s).
3. Invokes the real production service / state machine / pipeline against `before_state_json`.
4. Evaluates assertions against `target_after_state_json`.
5. Updates `actual_after_state_json` and `is_passing` in SQLite.
6. Prints a concise ASCII diff showing passing invariants or failure deltas.

```bash
# High-speed local test loop (sub-second execution)
node sandbox/test-fixture-runner.js
```

**Development Rule**: Engineers and agents must iterate on application code locally until the fixture runner outputs **100% PASS** across all assertions before touching Xcode or device deployment tools.

---

### Step 4: Hardware Re-Deployment & Visual OCR Verification

Once all local fixture tests pass:
1. Re-bundle and codesign the standalone application:
   ```bash
   npx expo export:embed --entry-file index.js --platform ios --dev false ...
   /usr/bin/codesign --force --sign <SIGNING_IDENTITY> --entitlements ...
   ```
2. Install and launch on the connected iPhone:
   ```bash
   xcrun devicectl device install app --device <DEVICE_UDID> <AppPath>
   xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing <BUNDLE_ID>
   ```
3. Run native Vision OCR / Maestro verification to capture a physical screen screenshot and assert that the validated state renders correctly on device.

---

## Benefits & Future-Proofing

1. **Permanent Regression Shield**: Every edge case discovered on a physical device becomes a permanent, automated regression test in `test-fixtures.sqlite`.
2. **Zero-Guesswork Collaboration**: When users or QA report an anomaly, simply extract the container state, drop it into the fixture database, and reproduce the bug in milliseconds without guesswork.
3. **Multi-Domain Scalability**: Whether the next project is an AI financial advisor, a real-time multiplayer board game, a podcast player, or a spatial design tool, the same 4-step Device-Fixture TDD pipeline guarantees production robustness.
