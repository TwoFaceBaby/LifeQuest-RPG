/** Deterministic, offline talent rules. Ranks are cosmetic progression, not measured ability. */
export const TALENT_BRANCHES = ['Discipline','Knowledge','Creativity','Communication','Strategy','Endurance'] as const;
export type TalentBranch = typeof TALENT_BRANCHES[number];
export const TALENT_PREREQUISITES: Partial<Record<TalentBranch,{branch:TalentBranch;rank:number}>> = {
  Strategy:{branch:'Knowledge',rank:2},
  Endurance:{branch:'Discipline',rank:2},
};
export function playerLevelFromXp(totalXp:number):number {
  let remaining=Math.max(0,Number.isFinite(totalXp)?Math.floor(totalXp):0), level=1;
  while(level<10000){const required=Math.round(100*Math.pow(level,1.5));if(remaining<required)break;remaining-=required;level++;}
  return level;
}
export function normalizeTalentRanks(raw:unknown):Record<string,number>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  const input=raw as Record<string,unknown>,result:Record<string,number>={};
  for(const branch of TALENT_BRANCHES){const rank=input[branch];if(typeof rank==='number'&&Number.isInteger(rank)&&rank>=0&&rank<=5)result[branch]=rank;}
  return result;
}
export function availableTalentPoints(totalXp:number,ranks:Record<string,number>):number {
  const spent=Object.values(normalizeTalentRanks(ranks)).reduce((a,b)=>a+b,0);
  return Math.max(0,playerLevelFromXp(totalXp)-1-spent);
}
export function canUpgradeTalent(totalXp:number,ranks:Record<string,number>,branch:TalentBranch):boolean {
  const normalized=normalizeTalentRanks(ranks), prerequisite=TALENT_PREREQUISITES[branch];
  return (normalized[branch]||0)<5 && availableTalentPoints(totalXp,normalized)>0 && (!prerequisite||(normalized[prerequisite.branch]||0)>=prerequisite.rank);
}
export function upgradeTalent(totalXp:number,ranks:Record<string,number>,branch:TalentBranch):Record<string,number>{
  if(!canUpgradeTalent(totalXp,ranks,branch))return ranks;
  const normalized=normalizeTalentRanks(ranks);
  return {...normalized,[branch]:(normalized[branch]||0)+1};
}
