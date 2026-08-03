#!/usr/bin/env node
/**
 * Build Installers Script
 * 
 * Uses electron-builder to produce native installers:
 *   - Windows: .exe (NSIS installer)
 *   - macOS: .dmg
 *   - Linux: .AppImage
 * 
 * Usage:
 *   node scripts/build-installers.js           # Build for current platform
 *   node scripts/build-installers.js --all     # Build for all platforms (requires cross-compilation setup)
 *   node scripts/build-installers.js --win     # Build Windows only
 *   node scripts/build-installers.js --mac     # Build macOS only
 *   node scripts/build-installers.js --linux   # Build Linux only
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

// Determine target platform(s)
let targets = '';
if (args.includes('--all')) {
  targets = '--win --mac --linux';
} else if (args.includes('--win')) {
  targets = '--win';
} else if (args.includes('--mac')) {
  targets = '--mac';
} else if (args.includes('--linux')) {
  targets = '--linux';
}
// If no flag, electron-builder defaults to current platform

console.log('═══════════════════════════════════════════════════');
console.log('  Japanese Learning System — Build Installers');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log(`Root: ${ROOT}`);
console.log(`Platform target: ${targets || '(current platform)'}`);
console.log('');

try {
  console.log('Building installers...');
  console.log('');

  const cmd = `npx electron-builder ${targets} --config`;
  console.log(`> ${cmd}`);
  console.log('');

  execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env }
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Build complete! Check the dist/ directory.');
  console.log('═══════════════════════════════════════════════════');
} catch (err) {
  console.error('');
  console.error('Build failed:', err.message);
  process.exit(1);
}
