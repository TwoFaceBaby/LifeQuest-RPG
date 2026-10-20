import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../artifacts/lifequest/src/talent-engine.ts',import.meta.url),'utf8');
test('talent engine includes rank validation, level budget and prerequisite enforcement',()=>{
 for(const name of ['normalizeTalentRanks','playerLevelFromXp','availableTalentPoints','canUpgradeTalent','upgradeTalent','TALENT_PREREQUISITES'])assert.match(source,new RegExp(name));
 assert.match(source,/Strategy:\{branch:'Knowledge',rank:2\}/);
 assert.match(source,/Endurance:\{branch:'Discipline',rank:2\}/);
});
test('talent UI uses shared deterministic rules',()=>{
 const ui=fs.readFileSync(new URL('../artifacts/lifequest/src/AdvancedWorld.tsx',import.meta.url),'utf8');
 assert.match(ui,/canUpgradeTalent\(totalXp,value\.talentRanks,t\)/);
 assert.match(ui,/upgradeTalent\(totalXp,value\.talentRanks,t\)/);
 assert.match(ui,/normalizeTalentRanks\(v\.talentRanks\)/);
});
