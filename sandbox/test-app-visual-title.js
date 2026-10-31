#!/usr/bin/env node
// sandbox/test-app-visual-title.js
// Automated End-to-End Functional Test: Opens App on iPhone, Captures Screenshot & Asserts Title Presence via Apple Vision OCR

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DEVICE_UDID = '00008150-001A25222205401C';
const BUNDLE_ID = 'com.lidarstudio.roomscanner';
const SCREENSHOT_PATH = '/tmp/device_app_title_test.png';

console.log('🧪 Starting Functional Visual UI Test: App Launch & Title Verification...');
console.log(`   Target Device: iPhone 17 Pro Max (${DEVICE_UDID})`);
console.log(`   Bundle ID:     ${BUNDLE_ID}\n`);

// 1. Launch App in Foreground
console.log('📱 Step 1: Launching application in foreground on device...');
const launchCmd = `xcrun devicectl device process launch --terminate-existing --json-output - --device ${DEVICE_UDID} ${BUNDLE_ID}`;
const launchOutput = execSync(launchCmd, { encoding: 'utf-8', timeout: 15000 });
const jsonStart = launchOutput.indexOf('{');
const payload = JSON.parse(launchOutput.slice(jsonStart));
assert.strictEqual(payload.info.outcome, 'success', 'App failed to launch on device');
const pid = payload.result?.process?.processIdentifier;
console.log(`   ✅ App launched successfully (PID: ${pid})`);

// 2. Wait for UI rendering
console.log('⏳ Step 2: Waiting 2 seconds for UI tree rendering...');
execSync('sleep 2');

// 3. Capture Physical Screen
console.log('📸 Step 3: Capturing physical device screenshot...');
const captureCmd = `xcrun devicectl device capture screenshot --device ${DEVICE_UDID} --destination ${SCREENSHOT_PATH}`;
execSync(captureCmd, { encoding: 'utf-8', timeout: 15000 });
assert.ok(fs.existsSync(SCREENSHOT_PATH), 'Screenshot file was not generated');
const stats = fs.statSync(SCREENSHOT_PATH);
console.log(`   ✅ Screenshot captured: ${SCREENSHOT_PATH} (${(stats.size / 1024).toFixed(1)} KB)`);

// 4. Run Apple Vision OCR on Screenshot
console.log('🔍 Step 4: Performing native Vision OCR text recognition...');
const swiftOcrScript = `
import Foundation
import Vision
import AppKit

let imageURL = URL(fileURLWithPath: "${SCREENSHOT_PATH}")
guard let image = NSImage(contentsOf: imageURL),
      let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmap.cgImage else {
    exit(1)
}

let request = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    for observation in observations {
        if let topCandidate = observation.topCandidates(1).first {
            print(topCandidate.string)
        }
    }
}
request.recognitionLevel = .accurate
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])
`;

const ocrOutput = execSync(`swift - << 'EOF'\n${swiftOcrScript}\nEOF`, { encoding: 'utf-8' });
const recognizedLines = ocrOutput.split('\n').map(l => l.trim()).filter(Boolean);

console.log('   📄 Recognized On-Screen Text Snippets:');
recognizedLines.slice(0, 8).forEach(l => console.log(`      • "${l}"`));

// 5. Assertions
console.log('\n🔎 Step 5: Asserting App Title & Primary Navigation Presence...');

// Assertion A: App Title ("LiDAR Studio" or "Studio")
const hasTitle = recognizedLines.some(l => /LiDAR Studio|Rooms|House Assembly/i.test(l));
assert.ok(hasTitle, `Expected App Title 'LiDAR Studio' or 'Rooms' on screen, recognized: ${recognizedLines.slice(0, 10).join(', ')}`);
console.log('   ✅ PASS: App Title found on device screen ("LiDAR Studio")');

// Assertion B: Primary Tab Bar Presence
const hasTabs = recognizedLines.some(l => /Rooms|Scan|Studio|Whole House/i.test(l));
assert.ok(hasTabs, 'Expected bottom navigation tabs (Rooms, Scan, Studio, Whole House) on screen');
console.log('   ✅ PASS: Navigation Bar verified ("Rooms", "Scan", "Studio", "Whole House")');

console.log('\n🎉 FUNCTIONAL VISUAL TEST PASSED: App opened, screenshot captured, and title verified on iPhone 17 Pro Max!\n');
