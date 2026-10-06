'use strict';
/* Combat balance report. Runs the game's own battle engine headlessly.
   node tools/balance.js [srcDir] [runsPerCase]
   - techniques: expected damage per use against a plain target, relative to a basic attack
   - duels: a ninja that uses techniques vs one that only basic-attacks (should win clearly)
   - missions: win rate and HP left of the auto-battler on every mission at its recommended level */
const {loadGame} = require('./simcore');
const srcDir = process.argv[2] || 'src', RUNS = +process.argv[3] || 40;
const g = loadGame(srcDir);

g.run(`
const __br = beginRound;
let __result = null;
beginRound = () => { if(B.round >= 70){ B.over = true; __result = 'draw'; return; } __br(); };
stageWon = () => { __result = 'win'; }; stageLost = () => { __result = 'lose'; };

function mkChar(el, L, opt = {}){
  S = defaultState();
  const c = newCharacter({name:'Sim', gender:'m', hairStyle:'spiky', hair:'#222', outfit:'#335', eyes:'#333', skin:'#eec', element:el});
  c.level = L; c.points = (L - 1) * POINTS_PER_LEVEL; allocRecruit(c, autoAllocRecruit(c));
  const gl = L - (opt.gearLag || 0);
  for(const sl of SLOTS){
    const items = ITEMS.filter(i => i.slot === sl && i.shop !== false && !i.shards && i.lvl <= gl).sort((a, b) => a.price - b.price);
    c.equip[sl] = items.length ? items[items.length - 1].id : (sl === 'weapon' ? 'kunai_train' : null);
  }
  const own = SKILLS.filter(s => s.el === el && s.lvl <= L && !s.enemyOnly && !s.petOnly);
  c.skills = own.map(s => s.id); c.loadout = own.slice(-MAX_LOADOUT).map(s => s.id);
  S.char = c; S.settings.auto = true; return c;
}
function runBattle(allies, enemies){
  __result = null;
  startBattle(allies, enemies, {title:'sim', stage:1, stages:1});
  return {result:__result || 'draw', rounds:B.round, allies:B.allies.map(u => ({hp:u.hp, max:u.maxHp, alive:u.alive, key:u.key}))};
}
function runMission(m, c, opt = {}){
  S.char = c; S.settings.auto = true; let carry = null, rounds = 0, last = null;
  for(let i = 0; i < m.stages.length; i++){
    const foes = m.stages[i].foes.map(([id, l]) => unitFromEnemy(id, l));
    const team = playerTeam(carry);
    const r = runBattle(team, foes); rounds += r.rounds; last = r;
    if(r.result !== 'win') return {win:false, rounds, hp:0};
    carry = {}; for(const u of B.allies) carry[u.key] = {hp:u.alive ? Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.25)) : Math.round(u.maxHp * 0.3), cp:Math.min(u.maxCp, u.cp + Math.round(u.maxCp * 0.3))};
  }
  const p = last.allies.find(a => a.key === 'leader');
  return {win:true, rounds, hp:p.hp / p.max};
}
// damage of one technique against an inert, dodge-free dummy
function skillDamage(s, atk){
  let tot = 0; const N = 600;
  for(let i = 0; i < N; i++){
    const a = mkUnit({name:'A', side:'ally', controller:'ai', el:s.el, level:20, maxHp:9999, maxCp:999, agi:10, atk, crit:5, dodge:0, skills:[], kind:'ninja', look:{}});
    const d = mkUnit({name:'D', side:'enemy', controller:'ai', el:'none', level:20, maxHp:999999, maxCp:99, agi:999, atk:1, crit:0, dodge:0, skills:[], kind:'ninja', look:{}});
    B = {allies:[a], enemies:[d], meta:{}, round:1, queue:[], log:[], over:false, awaiting:false, active:a, target:d.uid, fseq:0};
    d.agi = 0; const before = d.hp;
    // dummy cannot dodge: zero agi vs agi 10 gives the 5% floor, so push attacker agi below it
    a.agi = 0;
    if(s === 'basic') doBasic(a, d); else { a.cp = 999; useSkill(a, s, d); }
    let dot = 0; for(const st of d.statuses) if(st.s === 'burn' || st.s === 'bleed') dot += st.val * st.dur;
    tot += (before - d.hp) + dot;
  }
  return tot / N;
}
`);

const pct = x => (x * 100).toFixed(0).padStart(3) + '%';

// ---- techniques ----
console.log('\n== Technique damage vs basic attack (atk 40, no dodge, neutral element; DoT included) ==');
const basic = g.run('skillDamage("basic", 40)');
console.log('basic attack'.padEnd(26), basic.toFixed(1).padStart(6));
const skills = g.run('SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.power).map(s => s.id)');
const rows = skills.map(id => {
  const d = g.run(`skillDamage(SKILL["${id}"], 40)`), s = g.run(`(({name,el,lvl,cp,cd,power,hits})=>({name,el,lvl,cp,cd,power,hits}))(SKILL["${id}"])`);
  return {id, ...s, d};
});
for(const r of rows) console.log(`${(r.el || '-').slice(0, 4)} L${String(r.lvl).padStart(2)} ${r.name.padEnd(22)} ${String(r.cp).padStart(2)}cp cd${r.cd}  ${r.d.toFixed(1).padStart(6)}  x${(r.d / basic).toFixed(2)}${r.d < basic * 1.2 ? '   <-- weak' : ''}`);

// ---- duels ----
console.log('\n== Duels: auto-battler with techniques vs basic-attack-only twin (same stats) ==');
for(const L of [3, 10, 20, 35, 55]){
  const out = [];
  for(const el of ['fire', 'wind', 'lightning', 'earth', 'water']){
    let w = 0, hp = 0, n = RUNS;
    for(let i = 0; i < n; i++){
      const r = g.run(`(() => { const c = mkChar("${el}", ${L}); const a = playerTeam(null).slice(0, 1);
        const twin = unitFromChar(c, 'ai', 'enemy'); twin.skills = []; twin.name = 'Twin';
        const r = runBattle(a, [twin]); return {win:r.result === 'win', hp:r.allies[0].hp / r.allies[0].max}; })()`);
      if(r.win) w++; hp += r.hp;
    }
    out.push(`${el.slice(0, 4)} ${pct(w / n)}`);
  }
  console.log(`L${String(L).padEnd(3)} win rate of the technique user: ${out.join('  ')}`);
}

// ---- missions ----
console.log('\n== Missions at recommended level (auto-battle, best gear for level, solo) ==');
console.log('id  lvl  ' + ['fire', 'wind', 'ltn ', 'earth', 'water'].map(x => x.padEnd(11)).join('') + 'avgHP-left rounds');
const missions = g.run('MISSIONS.map(m => ({id:m.id, lvl:m.lvl}))');
const tot = {w:0, n:0};
for(const m of missions){
  let line = `${m.id.padEnd(3)} ${String(m.lvl).padStart(3)}  `, hps = 0, rounds = 0, runs = 0, mw = 0;
  for(const el of ['fire', 'wind', 'lightning', 'earth', 'water']){
    let w = 0;
    for(let i = 0; i < RUNS; i++){
      const r = g.run(`(() => { const c = mkChar("${el}", ${m.lvl}); return runMission(MISSION["${m.id}"], c); })()`);
      if(r.win){ w++; mw++; hps += r.hp; } rounds += r.rounds; runs++;
    }
    tot.w += w; tot.n += RUNS; line += pct(w / RUNS).padEnd(11);
  }
  console.log(line + ` ${(hps / Math.max(1, mw)).toFixed(2).padStart(5)}       ${(rounds / runs).toFixed(1)}`);
}
console.log(`overall win rate ${pct(tot.w / tot.n)}`);
