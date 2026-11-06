#!/usr/bin/env node
// sandbox/scripts/live_scan_monitor.js
// Live LiDAR Stream & Misalignment Detector for iPhone 17 Pro Max

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEVICE_ID = '00008150-001A25222205401C';
const BUNDLE_ID = 'com.lidarstudio.roomscanner';
const LOCAL_TMP = '/tmp/live_scan_telemetry.json';

console.log('📡 Starting Real-Time LiDAR Scan Stream Monitor for iPhone 17 Pro Max...');
console.log('🔗 Device:', DEVICE_ID);
console.log('⏳ Waiting for user to tap "Start Your First Scan" or "+ New Scan" on iPhone...\n');

let lastTimestamp = 0;
let lastWallCount = -1;
let iteration = 0;

function formatWall(w) {
  const p1 = `(${w.p1.x.toFixed(2)}, ${w.p1.z.toFixed(2)})`;
  const p2 = `(${w.p2.x.toFixed(2)}, ${w.p2.z.toFixed(2)})`;
  return `  Wall ${w.index} [${w.confidence}]: ${w.lengthFt.toFixed(1)}ft (${w.lengthM.toFixed(2)}m) from ${p1} -> ${p2}`;
}

async function loop() {
  while (true) {
    try {
      // Pull telemetry file from device over USB
      execSync(
        `xcrun devicectl device copy from --device ${DEVICE_ID} --domain-type appDataContainer --domain-identifier ${BUNDLE_ID} --source Documents/live_scan_telemetry.json --destination ${LOCAL_TMP} 2>/dev/null`,
        { timeout: 3000 }
      );

      if (fs.existsSync(LOCAL_TMP)) {
        const raw = fs.readFileSync(LOCAL_TMP, 'utf8');
        const data = JSON.parse(raw);

        if (data.isScanning) {
          const isNew = data.timestamp !== lastTimestamp || data.wallCount !== lastWallCount;
          lastTimestamp = data.timestamp;
          lastWallCount = data.wallCount;

          const timeStr = new Date(data.timestamp * 1000).toLocaleTimeString();
          console.clear();
          console.log(`========================================================================`);
          console.log(`🔴 LIVE SCAN STREAM ACTIVE | ${timeStr} | iPhone 17 Pro Max`);
          console.log(`📊 Walls: ${data.wallCount} | Objects: ${data.objectCount} | Doors: ${data.doorCount} | Windows: ${data.windowCount}`);
          console.log(`========================================================================`);

          console.log('\n🧱 Real-Time Detected Walls:');
          if (data.walls && data.walls.length > 0) {
            data.walls.forEach((w) => console.log(formatWall(w)));
          } else {
            console.log('  (Aim camera at floor-wall boundaries to begin tracking...)');
          }

          if (data.objects && data.objects.length > 0) {
            console.log('\n🛋️ Detected Objects:');
            data.objects.forEach((o) => {
              console.log(`  Obj ${o.index} [${o.category}]: ${o.widthFt.toFixed(1)}' × ${o.lengthFt.toFixed(1)}' at (${o.x.toFixed(2)}, ${o.z.toFixed(2)})`);
            });
          }

          console.log('\n🔍 Real-Time Misalignment & Quality Diagnostics:');
          if (data.misalignments && data.misalignments.length > 0) {
            data.misalignments.forEach((m) => {
              if (m.type === 'PARALLEL_OVERLAP_DRIFT') {
                console.log(`  ⚠️  [${m.severity}] PARALLEL DUPLICATE DRIFT: ${m.message}`);
              } else if (m.type === 'NON_ORTHOGONAL_CORNER') {
                console.log(`  📐  [${m.severity}] BENT CORNER: ${m.message}`);
              }
            });
          } else if (data.wallCount >= 4) {
            console.log('  ✅ Perfect alignment: All walls orthogonal, zero duplicate drift detected.');
          } else {
            console.log('  ⏳ Analyzing scan trajectory for drift & closure gaps...');
          }

          console.log(`\n(Press Ctrl+C to stop monitor)`);
        } else {
          iteration++;
          if (iteration % 5 === 0) {
            process.stdout.write(`\r⏳ Scanner idle on device. Tap "+ New Scan" or "Start Your First Scan" to stream... (${iteration}s)`);
          }
        }
      }
    } catch (err) {
      // Waiting for file to be created or device busy
    }

    await new Promise((r) => setTimeout(r, 600));
  }
}

loop();
