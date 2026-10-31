#!/bin/bash
set -e

DEVICE_UDID="00008150-001A25222205401C"
BUNDLE_ID="com.lidarstudio.roomscanner"
SIGNING_ID="3BFED319DCFABBD92E2DE3B0A969C38447A7FA82"
APP_DIR="/Users/gootyboy/Library/Developer/Xcode/DerivedData/LiDARRoomStudio-fcpgulkktiorueactrglitjaweyd/Build/Products/Debug-iphoneos/LiDARRoomStudio.app"
XCENT_PATH="/Users/gootyboy/Library/Developer/Xcode/DerivedData/LiDARRoomStudio-fcpgulkktiorueactrglitjaweyd/Build/Intermediates.noindex/LiDARRoomStudio.build/Debug-iphoneos/LiDARRoomStudio.build/LiDARRoomStudio.app.xcent"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 Starting Automated Hardware UAT Deployment Pipeline for iPhone 17 Pro Max..."

# Step 1: Pre-flight Verification Gate
echo "🔍 1/5 Running pre-flight typecheck & verification suite..."
cd "${SANDBOX_DIR}"
npx tsc --noEmit
node test-runner.js
node test-fixture-runner.js

# Step 2: Standalone JS Embedding
echo "📦 2/5 Exporting embedded production bundle..."
npx expo export:embed \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output "${APP_DIR}/main.jsbundle" \
  --assets-dest "${APP_DIR}"

# Step 3: Codesign with Apple Development Identity & Entitlements
echo "🔏 3/5 Codesigning app bundle with Apple Development identity..."
/usr/bin/codesign --force --sign "${SIGNING_ID}" \
  --entitlements "${XCENT_PATH}" \
  --timestamp=none --generate-entitlement-der \
  "${APP_DIR}"

# Step 4: Install to Physical Hardware
echo "📲 4/5 Installing app onto physical iPhone 17 Pro Max (${DEVICE_UDID})..."
xcrun devicectl device install app --device "${DEVICE_UDID}" "${APP_DIR}"

# Step 5: Launch & Capture Visual Verification
echo "⚡ 5/5 Launching ${BUNDLE_ID} on device..."
xcrun devicectl device process launch --device "${DEVICE_UDID}" --terminate-existing "${BUNDLE_ID}"

SCREENSHOT_PATH="/Users/gootyboy/.gemini/antigravity/brain/9f6fadf7-a772-4c8e-93ca-a8021c824f6f/device_uat_verified_$(date +%s).png"
echo "📸 Capturing hardware UAT verification screenshot..."
xcrun devicectl device capture screenshot --device "${DEVICE_UDID}" --destination "${SCREENSHOT_PATH}"

echo "🎉 DEPLOYMENT & HARDWARE VERIFICATION COMPLETE!"
echo "   Screenshot saved: ${SCREENSHOT_PATH}"
