import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/android-debug-apk.yml',import.meta.url),'utf8');
test('Android workflow is manual, builds web assets and syncs Capacitor before Gradle',()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/pnpm --filter @workspace\/lifequest build/);
  assert.match(workflow,/pnpm exec cap sync android/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/LIFEQUEST-debug-APK/);
});
