'use strict';
/* Do the technique families (and talents) stay in balance? Build-vs-build duels where both sides use the same decision AI.
   node tools/families.js [runsPerPair]
   Builds: ELEM (ninjutsu only), TAI (taijutsu-heavy), GEN (genjutsu-heavy), KIN (kinjutsu + ninjutsu attacks), BEST (the optimizer's pick). */
const {loadGame} = require('./simcore');
const RUNS = +process.argv[2] || 30;
const g = loadGame('src');
// TUNE='{"taijutsu":{"power":0.85,"cp":1.2,"cd":0}}' tries multipliers on a family without touching the data
if(process.env.TUNE) g.run(`(() => { const T = ${process.env.TUNE}; for(const s of SKILLS){ if(s.enemyOnly || s.petOnly) continue; for(const m of [T[s.type], T[s.id]]){ if(!m) continue;
  if(m.power && s.power) s.power = +(s.power * m.power).toFixed(3); if(m.cp) s.cp = Math.round(s.cp * m.cp); if(m.cd) s.cd = Math.max(1, s.cd + m.cd); if(m.dur) (s.apply || []).forEach(a => { if(a.s !== 'haste' || !a.on) a.dur += m.dur; }); if(m.chance) (s.apply || []).forEach(a => { if(a.chance != null) a.chance = Math.min(1, a.chance + m.chance); }); } } })()`);

g.run(`
const __br = beginRound;
let __result = null;
beginRound = () => { if(B.round >= 80){ B.over = true; __result = 'draw'; return; } __br(); };
stageWon = () => { __result = 'win'; }; stageLost = () => { __result = 'lose'; };
// Both sides think the same way here, so the comparison is about the builds, not the AI.
aiAct = u => { const t = opponents(u)[0]; if(t) perform(u, smartChoose(u, t), t); };

function build(kind, el, L){
  S = defaultState();
  const c = newCharacter({name:'Sim', gender:'m', hairStyle:'spiky', hair:'#222', outfit:'#335', eyes:'#333', skin:'#eec', element:el});
  c.level = L; c.points = (L - 1) * POINTS_PER_LEVEL; allocRecruit(c, autoAllocRecruit(c));
  for(const sl of SLOTS){ const items = ITEMS.filter(i => i.slot === sl && i.shop !== false && !i.shards && i.lvl <= L).sort((a, b) => a.price - b.price); c.equip[sl] = items.length ? items[items.length - 1].id : (sl === 'weapon' ? 'kunai_train' : null); }
  const real = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl <= L);
  const util = real.filter(s => s.el === el && !s.power);                // the element's heals and buffs
  const att = real.filter(s => s.el === el && s.power);
  const pool = {ELEM:real.filter(s => s.el === el), TAI:[...real.filter(s => s.type === 'taijutsu'), ...util], GEN:[...real.filter(s => s.type === 'genjutsu'), ...att.slice(-3), ...util.slice(0, 1)],
    KIN:[...real.filter(s => s.type === 'kinjutsu'), ...att, ...util], BEST:real.filter(s => !s.el || s.el === el)}[kind];
  c.skills = pool.map(s => s.id); c.loadout = bestLoadout(c, c.skills).ids; c.talents = autoTalents(c);
  S.char = c; return c;
}
function duel(ka, kb, el, L){
  const a = build(ka, el, L), b = build(kb, el, L);
  const ua = unitFromChar(a, 'ai', 'ally'), ub = unitFromChar(b, 'ai', 'enemy'); ua.key = 'leader';
  __result = null; startBattle([ua], [ub], {title:'sim', stage:1, stages:1});
  return __result || 'draw';
}
`);

const kinds = ['ELEM', 'TAI', 'GEN', 'KIN', 'BEST'], els = ['fire', 'wind', 'lightning', 'earth', 'water'];
for(const L of [10, 20, 30, 45, 58]){
  // p[a][b] = how often a wins when seated as the ally; a pairing's true score averages both seatings so the seat doesn't matter
  const p = {};
  for(const a of kinds){ p[a] = {}; for(const b of kinds){
    if(a === b) continue;
    let w = 0, n = 0;
    for(const el of els) for(let i = 0; i < RUNS; i++){ const r = g.run(`duel("${a}", "${b}", "${el}", ${L})`); if(r === 'win') w++; if(r !== 'draw') n++; }
    p[a][b] = n ? w / n : 0.5;
  } }
  const score = (a, b) => (p[a][b] + 1 - p[b][a]) / 2;
  const overall = a => kinds.filter(b => b !== a).reduce((t, b) => t + score(a, b), 0) / (kinds.length - 1);
  if(process.env.QUIET){ console.log(`L${String(L).padEnd(3)} ` + kinds.map(k => k + ' ' + (overall(k) * 100).toFixed(0).padStart(3) + '%').join('   ')); continue; }
  console.log(`
Level ${L}: row beats column (${els.length * RUNS * 2} duels per pairing, both seatings)`);
  console.log('        ' + kinds.map(k => k.padEnd(6)).join(' ') + '  overall');
  for(const a of kinds) console.log(a.padEnd(7) + ' ' + kinds.map(b => a === b ? '  -   ' : (score(a, b) * 100).toFixed(0).padStart(4) + '% ').join('') + '  ' + (overall(a) * 100).toFixed(0) + '%');
}
