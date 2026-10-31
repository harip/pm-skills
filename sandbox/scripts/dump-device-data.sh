#!/bin/bash
set -e

DEVICE_UDID="00008150-001A25222205401C"
BUNDLE_ID="com.lidarstudio.roomscanner"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${SANDBOX_DIR}/data/device_dump"
TEMP_DUMP="/tmp/device_dump_docs"

echo "📱 Extracting Documents container from iPhone 17 Pro Max (${DEVICE_UDID})..."

rm -rf "${TEMP_DUMP}"
mkdir -p "${TEMP_DUMP}"
mkdir -p "${TARGET_DIR}/Documents"

xcrun devicectl device copy from \
  --device "${DEVICE_UDID}" \
  --domain-type appDataContainer \
  --domain-identifier "${BUNDLE_ID}" \
  --source Documents \
  --destination "${TEMP_DUMP}"

echo "📦 Syncing extracted files to local fixture storage: ${TARGET_DIR}/Documents..."
cp -R "${TEMP_DUMP}/" "${TARGET_DIR}/Documents/"

# Generate local manifest of all extracted rooms
node -e '
const fs = require("fs");
const path = require("path");

const docsDir = path.join(process.argv[1], "Documents");
const files = fs.readdirSync(docsDir);

const jsonScans = files.filter(f => f.endsWith(".json") && f.startsWith("scanned_room_") && !f.startsWith("scanned_room_room-"));
const rooms = [];

for (const file of jsonScans) {
  try {
    const content = JSON.parse(fs.readFileSync(path.join(docsDir, file), "utf8"));
    if (content.isDeleted) continue;
    rooms.push({
      file,
      id: content.id || file.replace(".json", ""),
      name: content.roomName || "Unnamed Room",
      lengthFt: content.lengthFt || 0,
      widthFt: content.widthFt || 0,
      areaSqFt: content.areaSqFt || 0,
      wallCount: content.walls ? content.walls.length : 0,
      objectCount: content.objects ? content.objects.length : 0,
      floorLevel: content.floorLevel || "Ground Floor"
    });
  } catch (e) {}
}

const manifest = {
  extractedAt: new Date().toISOString(),
  device: "iPhone 17 Pro Max (00008150-001A25222205401C)",
  totalFiles: files.length,
  totalActiveScans: rooms.length,
  rooms
};

fs.writeFileSync(path.join(process.argv[1], "manifest.json"), JSON.stringify(manifest, null, 2));

// Generate bundled_rooms.json containing full meshes for zero-latency local development
const fullRooms = [];
for (const file of jsonScans) {
  try {
    const content = JSON.parse(fs.readFileSync(path.join(docsDir, file), "utf8"));
    if (content.isDeleted) continue;
    fullRooms.push(content);
  } catch (e) {}
}
fs.writeFileSync(path.join(process.argv[1], "bundled_rooms.json"), JSON.stringify(fullRooms, null, 2));

console.log(`✅ Extracted ${manifest.totalActiveScans} active rooms (${manifest.totalFiles} total files) into manifest.json & bundled_rooms.json`);
' "${TARGET_DIR}"

echo "🎉 Device data dump completed successfully!"
