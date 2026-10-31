// sandbox/scripts/patch-svg-web.js
const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.resolve(__dirname, '../node_modules/react-native-svg/lib/module/web/utils/prepare.js'),
  path.resolve(__dirname, '../node_modules/react-native-svg/lib/commonjs/web/utils/prepare.js'),
];

for (const filePath of filesToPatch) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const target = /(?:\(0,\s*_\.hasTouchableProperty\)|hasTouchableProperty)\(props\)\s*\?\s*\{[^}]*onStartShouldSetResponder[^}]*\}\s*:\s*null/gs;
    if (target.test(content)) {
      content = content.replace(target, 'null');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-svg-web] Patched ${path.basename(filePath)}`);
    } else {
      console.log(`[patch-svg-web] Already clean or pattern not found: ${path.basename(filePath)}`);
    }
  }
}
