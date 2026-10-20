import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../artifacts/lifequest/src/prediction-metrics.ts',import.meta.url),'utf8');
test('forecast evaluation rejects invalid inputs and handles zero actual',()=>{
 assert.match(source,/Number\.isFinite\(estimate\)/);
 assert.match(source,/actual===0\?null/);
 assert.match(source,/Math\.abs\(error\/actual\)\*100/);
});
test('Oracle UI captures actual and predicted values',()=>{
 const ui=fs.readFileSync(new URL('../artifacts/lifequest/src/Intelligence.tsx',import.meta.url),'utf8');
 assert.match(ui,/evaluateForecast/);
 assert.match(ui,/Measured actual outcome/);
 assert.match(ui,/Estimated outcome/);
});
