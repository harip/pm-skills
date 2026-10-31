// sandbox/scripts/init-test-fixtures.js
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'test-fixtures.sqlite');
const RAW_SCAN_PATH = '/tmp/app_documents/room-1793411826.json';

// Ensure database file directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// 1. Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    app_category TEXT NOT NULL,
    description TEXT,
    before_state_json TEXT NOT NULL,
    action_trigger TEXT NOT NULL,
    target_after_state_json TEXT NOT NULL,
    actual_after_state_json TEXT,
    is_passing INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ SQLite Schema initialized in test-fixtures.sqlite');

// 2. Read exact Physical Room scan copied from phone
let rawScanData = null;
if (fs.existsSync(RAW_SCAN_PATH)) {
  rawScanData = JSON.parse(fs.readFileSync(RAW_SCAN_PATH, 'utf8'));
} else {
  // Fallback to embedded copy if /tmp was cleared
  rawScanData = {
    roomName: "Physical Room (19' × 12')",
    widthFt: 12.0,
    lengthFt: 19.0,
    heightFt: 8.1,
    areaSqFt: 228.0,
    floorLevel: "Ground Floor",
    walls: [
      { id: "wall-0", x1: -6.15, z1: 12.23, x2: -2.37, z2: -5.03, lengthFt: 17.7, yawDeg: -78 },
      { id: "wall-1", x1: 1.77, z1: 13.97, x2: -6.15, z2: 12.23, lengthFt: 8.1, yawDeg: -168 },
      { id: "wall-2", x1: -2.37, z1: -5.03, x2: 5.86, z2: -3.23, lengthFt: 8.4, yawDeg: 12 }
    ]
  };
}

// Long reference wall coordinates (Wall 0: V0 -> V1)
const V0 = { x: -6.150000095367432, z: 12.229999542236328 }; // Bottom-Left
const V1 = { x: -2.369999885559082, z: -5.03000020980835 };  // Top-Left
const V2 = { x: 3.815000057220459, z: 5.370000123977661 };   // Protruding Right Apex

const dxLong = V1.x - V0.x;
const dzLong = V1.z - V0.z;
const lenLong = Math.hypot(dxLong, dzLong);
let angleLongDeg = (Math.atan2(dzLong, dxLong) * 180) / Math.PI;
let targetPerpAngleDeg = angleLongDeg + 90.0;
if (targetPerpAngleDeg < 0) targetPerpAngleDeg += 360;

// Target After State: One of the triangle sides is strictly perpendicular to the long wall
// Long wall angle: -77.58° (282.42°). Perpendicular angle: +12.42°.
// Target 4-corner orthogonal box aligned to long wall reference frame:
const perpRad = (targetPerpAngleDeg * Math.PI) / 180;
const targetWidthFt = 10.0; // Desired room width along perpendicular axis

const targetTopRight = {
  x: +(V1.x + targetWidthFt * Math.cos(perpRad)).toFixed(3),
  z: +(V1.z + targetWidthFt * Math.sin(perpRad)).toFixed(3),
};
const targetBottomRight = {
  x: +(V0.x + targetWidthFt * Math.cos(perpRad)).toFixed(3),
  z: +(V0.z + targetWidthFt * Math.sin(perpRad)).toFixed(3),
};

const targetAfterState = {
  description: "Right wall straightened perpendicular to 17'8\" long wall with clean 90° corners",
  long_wall: {
    p1: V0,
    p2: V1,
    lengthFt: +lenLong.toFixed(2),
    angleDeg: +angleLongDeg.toFixed(2)
  },
  perpendicular_target: {
    targetAngleDeg: +targetPerpAngleDeg.toFixed(2),
    toleranceDeg: 0.1
  },
  target_polygon: [
    { name: "Top-Left (V1)", x: +V1.x.toFixed(3), z: +V1.z.toFixed(3) },
    { name: "Top-Right", x: targetTopRight.x, z: targetTopRight.z },
    { name: "Bottom-Right", x: targetBottomRight.x, z: targetBottomRight.z },
    { name: "Bottom-Left (V0)", x: +V0.x.toFixed(3), z: +V0.z.toFixed(3) }
  ],
  expected_invariants: {
    corner_angles: [90.0, 90.0, 90.0, 90.0],
    is_watertight: true,
    is_self_intersecting: false,
    min_area_sqft: 150.0,
    max_area_sqft: 230.0,
    max_wall_length_ft: 20.0 // Strict guard: wall must NEVER balloon to 75ft
  }
};

const beforeState = {
  roomName: rawScanData.roomName || "Physical Room (19' × 12')",
  source_file: "room-1793411826.json",
  device: "iPhone 17 Pro Max (00008150-001A25222205401C)",
  dimensions: {
    widthFt: rawScanData.widthFt,
    lengthFt: rawScanData.lengthFt,
    areaSqFt: rawScanData.areaSqFt
  },
  raw_walls: rawScanData.walls,
  raw_polygon: [
    { name: "Bottom-Left (V0)", x: V0.x, z: V0.z },
    { name: "Top-Left (V1)", x: V1.x, z: V1.z },
    { name: "Right-Apex (V2)", x: V2.x, z: V2.z }
  ]
};

// 3. Upsert test case
const stmt = db.prepare(`
  INSERT OR REPLACE INTO test_cases (
    id, name, app_category, description,
    before_state_json, action_trigger,
    target_after_state_json, actual_after_state_json,
    is_passing, updated_at
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?,
    ?, NULL,
    0, CURRENT_TIMESTAMP
  )
`);

stmt.run(
  'TC-TRIANGLE-ORTHO-01',
  'Physical Room - Triangular Zig-Zag to Perpendicular Wall',
  'sensors_geometry',
  'Real LiDAR 3-wall scan with triangular zig-zag apex converted to perpendicular wall (90° relative to 17\'8" long wall)',
  JSON.stringify(beforeState, null, 2),
  'ROTATE_TRIANGLE_SIDE_PERPENDICULAR_90',
  JSON.stringify(targetAfterState, null, 2)
);

console.log('✅ Seeded TC-TRIANGLE-ORTHO-01 into test-fixtures.sqlite');
console.log('   - Long wall length:', lenLong.toFixed(2), 'ft');
console.log('   - Long wall angle:', angleLongDeg.toFixed(2) + '°');
console.log('   - Target perpendicular angle:', targetPerpAngleDeg.toFixed(2) + '°');
console.log('   - Target orthogonal polygon:', targetAfterState.target_polygon);
