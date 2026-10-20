import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const app = read('artifacts/lifequest/src/App.tsx');
const phase = read('artifacts/lifequest/src/PhaseTwo.tsx');
const pkg = JSON.parse(read('artifacts/lifequest/package.json'));
test('pre-APK source includes all primary persistence operations', () => {
  for (const token of ['indexedDB','readBackup','handleErase','handleRestore','downloadBackup']) assert.ok(app.includes(token), `Missing ${token}`);
});
test('quest rewards and level formula are defined', () => {
  assert.match(app, /Trivial: 5, Easy: 20, Medium: 50, Hard: 100, Epic: 250/);
  assert.match(app, /Math\.pow\(level, 1\.5\)/);
});
test('advanced world is connected and includes expected modules', () => {
  assert.ok(app.includes('PhaseTwoWorld'));
  for (const token of ['English','training','business','social']) assert.ok(phase.toLowerCase().includes(token.toLowerCase()), `Missing ${token}`);
});
test('Android build configuration exists without creating APK', () => {
  assert.ok(existsSync(new URL('artifacts/lifequest/capacitor.config.ts', root)));
  assert.ok(pkg.scripts['android:sync']);
  assert.ok(pkg.scripts.build);
});
test('PWA assets are present', () => {
  assert.ok(existsSync(new URL('artifacts/lifequest/public/manifest.webmanifest', root)) || existsSync(new URL('artifacts/lifequest/public/manifest.json', root)));
});
