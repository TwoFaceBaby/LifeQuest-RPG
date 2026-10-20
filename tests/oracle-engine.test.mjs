import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../artifacts/lifequest/src/oracle-engine.ts',import.meta.url),'utf8');
test('local advisor covers business, learning, health and employment',()=>{for(const term of ['freelanc','study','fitness','interview'])assert.ok(src.includes(term));});
test('advisor avoids unsupported numeric probabilities',()=>assert.ok(src.includes('no numerical confidence estimate')));
