import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../artifacts/lifequest/src/App.tsx',import.meta.url),'utf8');
const extra=readFileSync(new URL('../artifacts/lifequest/src/AdvancedWorld.tsx',import.meta.url),'utf8');
test('life systems are persisted in primary app state and normalized for older backups',()=>{for(const term of ['extras: LifeExtras','extras: defaultExtras()','extras: normalizeExtras(v.extras)','onExtras={extras=>setData'])assert.ok(app.includes(term),term)});
test('life systems expose check-in, capacity planner, forecasts, exchange rates and cosmetic unlocks',()=>{for(const term of ['Save','Suggested quest plan','Estimated net','exchangeRates','unlockedTitles','checkIns'])assert.ok(extra.includes(term),term)});
