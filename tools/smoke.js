'use strict';
/* End-to-end smoke test: loads the built index.html in jsdom and plays through every screen and several battles,
   clicking real buttons. Dev-only; needs jsdom (npm i jsdom somewhere on NODE_PATH).
   node tools/smoke.js [path/to/index.html] */
const fs = require('fs'), path = require('path');
const {JSDOM, VirtualConsole} = require('jsdom');
const file = path.resolve(process.argv[2] || 'index.html');
const html = fs.readFileSync(file, 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){ w.scrollTo = () => {}; w.matchMedia = () => ({matches:false, addEventListener(){}, addListener(){}}); w.HTMLElement.prototype.scrollIntoView = () => {}; w.Element.prototype.scrollTo = () => {}; }});
const w = dom.window, doc = w.document;
w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message)));
const ev = c => w.eval(c);
let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if(!cond){ fails++; console.log('  FAIL: ' + msg); } };
const section = t => console.log('\n# ' + t);
const click = sel => { const el = doc.querySelector(sel); if(!el) return false; if(el.disabled) return false; el.click(); return true; };

// instant timers: turn loops run synchronously, input waits for a click
ev('later = fn => fn(); setTimeout = (fn) => 0;');
w.setTimeout = () => 0;

section('boot');
ok(ev('typeof S') !== 'undefined', 'game script loaded');
ev("ACT.newSlot(); UI.create.name = 'Tester'; UI.create.element = 'fire'; ACT.createDone();");
ok(ev('S && S.char && S.char.name') === 'Tester', 'character created');
ok(ev('S.char.talents.length') === 6, 'talents array present');
ev('S.char.level = 30; S.char.gold = 60000; S.char.points = 60; S.char.xp = 0;');
ev("GUIDE.open = false;");

section('every screen renders (leader at level 30)');
const screens = ['hub', 'missions', 'academy', 'shop', 'home', 'character', 'den', 'clan', 'squad', 'arena', 'event', 'journal', 'online', 'system'];
const bad = /undefined|NaN|\[object|null</;
for(const sc of screens){
  try{ ev(`go('${sc}')`); }catch(e){ ok(false, `${sc} threw: ${e.message}`); continue; }
  const t = doc.querySelector('#main').innerHTML;
  ok(t.length > 150, `${sc} has content`); ok(!bad.test(t.replace(/<[^>]*data-[^>]*>/g, '')), `${sc} has no undefined/NaN text`);
}
for(const tab of ['fire', 'wind', 'lightning', 'earth', 'water', 'taijutsu', 'genjutsu', 'kinjutsu']){
  ev(`UI.tab.academy = '${tab}'; go('academy')`); const t = doc.querySelector('#main').innerHTML;
  ok(doc.querySelectorAll('#main .skill').length >= 4, `academy tab ${tab} lists techniques`); ok(!bad.test(t), `academy ${tab} clean`);
}
ev("UI.tab.academy = null");

section('technique data');
const info = ev(`SKILLS.filter(s => !s.enemyOnly && !s.petOnly).map(s => [s.id, s.type, s.el, s.cp, s.cd, s.lvl, !!SKILL[s.id]])`);
ok(info.length >= 50, 'player technique count ' + info.length);
ok(ev(`['ninjutsu','taijutsu','genjutsu','kinjutsu'].every(t => SKILLS.some(s => s.type === t && !s.enemyOnly && !s.petOnly))`), 'all four families exist');
ok(ev(`SKILLS.every(s => (s.apply || []).every(a => STATUSES[a.s]))`), 'every applied status is defined');
ok(ev(`MAX_LOADOUT`) === 8, 'loadout limit is 8');

section('talents');
ev(`S.char.talents = blankTalents()`);
ok(ev(`talentsUnpicked(S.char)`) === 4 || ev(`talentsUnpicked(S.char)`) === 4, 'level 30 has 4 open tiers');
ev(`go('character')`);
ok(doc.querySelectorAll('.tal').length === 18, '18 talent buttons render');
ok(click('.tal-tier:not(.locked) .tal:not(:disabled)'), 'a talent button is clickable');
ok(ev(`S.char.talents.filter(Boolean).length`) === 1, 'clicking a talent picks it');
ev(`ACT.talentAuto('leader')`);
ok(ev(`talentsUnpicked(S.char)`) === 0, 'auto-pick fills the open tiers');
ok(ev(`charStats(S.char).tb && typeof charStats(S.char).tb.dmgType === 'object'`), 'talent bonus feeds stats');

section('optimizer: points, techniques, gear');
ev(`S.char.skills = [starterSkill('fire')]; S.char.loadout = [starterSkill('fire')]; S.char.equip = {weapon:'kunai_train', clothing:null, back:null, accessory:null}; S.inventory = {}; S.char.points = 60; S.char.alloc = {hp:0,cp:0,agi:0}; S.char.gold = 60000;`);
const lines = ev(`optimizeTeam('leader')`);
console.log('  optimizer said:', JSON.stringify(lines).slice(0, 400));
ok(lines.length >= 2, 'optimizer reports changes');
ok(ev(`S.char.points`) === 0, 'points spent');
ok(ev(`S.char.loadout.length`) === 8, 'loadout filled to 8: ' + ev(`S.char.loadout.map(id => SKILL[id].name).join(', ')`));
ok(ev(`SLOTS.every(sl => S.char.equip[sl])`), 'every gear slot filled');
ok(ev(`S.char.gold`) >= 0, 'gold never negative');
ok(ev(`new Set(S.char.loadout).size === S.char.loadout.length`), 'no duplicate loadout entries');
ok(ev(`S.char.loadout.every(id => S.char.skills.includes(id))`), 'loadout only holds learned techniques');

section('customize (leader)');
ev(`UI.custWho = 'leader'; go('custom')`);
ok(doc.querySelector('#cust-name'), 'customize screen shows a name box');
ev(`ACT.lookSet('hairStyle:twin'); ACT.lookSet('hair:#ff00aa'); ACT.lookSet('band:none'); ACT.lookSet('mask:#3a3030');`);
ok(ev(`S.char.look.hairStyle`) === 'twin' && ev(`S.char.look.hair`) === '#ff00aa' && ev(`S.char.look.band`) === 'none', 'look changes saved');
for(const h of ['spiky', 'short', 'ponytail', 'long', 'bun', 'bob', 'twin', 'braid']){ ev(`ACT.lookSet('hairStyle:${h}')`); ok(doc.querySelector('.preview-sprite svg'), 'preview draws ' + h); }
doc.querySelector('#cust-name').value = 'Newname'; ev(`ACT.renameApply()`);
ok(ev(`S.char.name`) === 'Newname', 'rename works');
ev(`ACT.lookRandom(); ACT.lookSet('band:show'); ACT.lookSet('mask:none')`);
ev(`S.char.name = 'Tester'; persist()`);

section('squad: recruits, pets, control');
ev(`syncPool(); S.char.gold = 60000; hireFromPool(0); hireFromPool(0);`);
ok(ev(`S.squad.active.length`) === 2, 'two recruits in the squad');
const rid = ev(`S.squad.active[0]`), rid2 = ev(`S.squad.active[1]`);
ok(ev(`recruitById('${rid}').talents.length`) === 6, 'recruit has talents array');
ev(`UI.recruitId = '${rid}'; go('recruit')`);
ok(doc.querySelectorAll('#main .tal').length === 18, 'recruit screen lists talents');
ok(!bad.test(doc.querySelector('#main').innerHTML), 'recruit screen is clean');
ev(`UI.denWho = '${rid}'; go('den')`);
ok(doc.querySelectorAll('.tabs .tab').length >= 3, 'den has a tab for each ninja');
ev(`ACT.petBuy('${rid}:ember_fox'); ACT.petBuy('${rid2}:gale_hawk'); ACT.petBuy('leader:moss_boar');`);
ok(ev(`recruitById('${rid}').pet`) === 'ember_fox' && ev(`recruitById('${rid2}').pet`) === 'gale_hawk', 'recruits own their own pets');
ok(ev(`S.char.pet`) === 'moss_boar', 'leader has a pet too');
ev(`ACT.petCtl('${rid}:0'); ACT.ctlRSet('${rid2}:1')`);
ok(ev(`recruitById('${rid}').petAuto`) === false && ev(`recruitById('${rid2}').auto`) === true, 'control flags stored');
ev(`optimizeTeam('all')`);
ok(ev(`activeSquad().every(r => r.loadout.length >= 3)`), 'squad optimized');
ok(!bad.test(ev(`(go('squad'), $('#main').innerHTML)`)), 'squad screen clean');
ev(`UI.custWho = '${rid}'; go('custom')`); ok(doc.querySelector('#cust-name').value.length > 0, 'recruit customize screen works');

section('battle: manual play, switching control mid-fight');
ev(`go('hub'); S.char.hp = 1;`);
function playBattle(startJs, label, maxSteps = 900){
  ev(startJs);
  // an AI squad can finish a weak stage before the leader ever gets a turn: that's a legitimate end
  if(!ev('!!B') && ev('UI.screen') === 'results') return 'results';
  ok(ev('!!B'), label + ': battle started');
  ok(doc.querySelectorAll('.unit').length >= 2, label + ': units drawn');
  let steps = 0, clicked = {attack:0, skill:0, charge:0, ctl:0, item:0};
  while(ev('!!B && !B.over') && steps++ < maxSteps){
    if(!ev('B.awaiting')){ break; }
    const r = Math.random();
    if(steps === 3 && doc.querySelector('.ctlchip')){ click('.ctlchip'); clicked.ctl++; continue; }
    if(r < 0.5 && doc.querySelector('.sbtn:not(:disabled)')){ const els = [...doc.querySelectorAll('.sbtn:not(:disabled)')]; els[Math.floor(Math.random() * els.length)].click(); clicked.skill++; }
    else if(r < 0.65 && click('[data-act="bCharge"]')) clicked.charge++;
    else if(r < 0.72){ if(click('[data-act="bItems"]')){ if(!click('.ibtn')) click('[data-act="bItems"]'); clicked.item++; } }
    else { click('[data-act="bAttack"]'); clicked.attack++; }
  }
  ok(steps < maxSteps, label + ': battle ended in ' + steps + ' inputs');
  console.log('  ' + label + ' inputs:', JSON.stringify(clicked), 'screen:', ev('UI.screen'));
  return ev('UI.screen');
}
for(const m of ['d1', 'd3', 'c3', 'b4']){
  ev(`S.settings.auto = false; S.char.level = 30;`);
  let scr = playBattle(`startMission('${m}')`, 'mission ' + m);
  // multi-stage: continue the mission until results
  let guard = 0; while(ev('!!RUN') && guard++ < 6){ if(!click('#modal-card [data-act="nextStage"]')) break; scr = playBattle('0', m + ' next stage'); }
  ok(ev('UI.screen') === 'results', m + ': ends on the results screen (got ' + ev('UI.screen') + ')');
  ok(!bad.test(doc.querySelector('#main').innerHTML), m + ': results screen clean');
}

section('battle: AI squad + auto + arena + event');
ev(`S.settings.auto = true; S.char.level = 30; ACT.ctlRSet('${rid}:1'); ACT.petCtl('${rid}:1')`);
playBattle(`startMission('c5')`, 'auto mission c5');
ev(`S.settings.auto = false; syncEvent(); S.event.tries = 0; S.event.dmg = 0;`);
playBattle(`startEvent()`, 'event boss', 1200);
ev(`S.settings.auto = false; refreshArena(); S.arena.opps.forEach(g => { g.squad = [makeGhost(25, 0), makeGhost(24, 0)]; g.squad.forEach(m => { m.pet = 'shadow_wolf'; m.pets = ['shadow_wolf']; }); });`);
playBattle(`ACT.arenaFight('1')`, 'arena (ghost with squad and pets)', 1200);

section('statuses and technique rules in battle');
ev(`go('hub'); S.settings.auto = false;`);
const rules = ev(`(() => {
  const out = {};
  const mk = (o = {}) => mkUnit(Object.assign({name:'U', side:'ally', controller:'ai', el:'fire', level:20, maxHp:500, maxCp:100, agi:20, atk:40, crit:0, dodge:0, skills:[], kind:'ninja', look:{}}, o));
  const a = mk(), d = mk({side:'enemy', el:'none'});
  B = {allies:[a], enemies:[d], meta:{}, round:1, queue:[], log:[], over:false, awaiting:false, active:a, target:d.uid, fseq:0};
  // silence blocks techniques, not basic attacks
  a.statuses.push({s:'silence', dur:2, val:0}); out.silenced = canUse(a, SKILL.fire_spark); a.statuses = [];
  // hp cost
  a.hp = 500; useSkill(a, SKILL.kin_pact, a); out.hpPaid = 500 - a.hp; a.cds = {}; a.hp = 300; const before = a.hp; const k = SKILL.kin_siphon; useSkill(a, k, d); out.leech = a.hp > before - Math.round(500 * 0.10); a.hp = 500; a.cds = {}; a.statuses = [];
  // cannot cast a kinjutsu that would kill you
  a.hp = 10; out.tooWeak = canUse(a, k); a.hp = 500;
  // sleep skips the turn and wakes on damage
  d.statuses.push({s:'sleep', dur:3, val:0}); dealDamage(d, 5, {}); out.woke = !d.statuses.some(s => s.s === 'sleep');
  // dot does not wake
  d.statuses.push({s:'sleep', dur:3, val:0}); dealDamage(d, 5, {dot:true}); out.dotKeepsSleep = d.statuses.some(s => s.s === 'sleep');
  // charge gives guard
  a.cp = 0; doCharge(a); out.charged = a.cp; out.guard = a.statuses.some(s => s.s === 'guard');
  // pierce ignores guard
  d.statuses = [{s:'guard', dur:5, val:0}]; d.hp = d.maxHp = 100000; const avg = (f) => { let t = 0; for(let i = 0; i < 400; i++){ const h = d.hp; f(); t += h - d.hp; d.hp = d.maxHp; } return t / 400; };
  a.statuses = []; a.crit = 0; a.agi = 0; d.agi = 0;
  out.normal = avg(() => attack(a, d, {power:2, type:'taijutsu'})); out.pierce = avg(() => attack(a, d, {power:2, type:'taijutsu', pierce:true}));
  // undying talent
  const u = mk({t:{undying:1, dmgType:{}, opening:[]}}); u.hp = 20; dealDamage(u, 999, {}); out.undying = u.alive && u.hp > 1; dealDamage(u, 9999, {}); out.diesSecondTime = !u.alive;
  B = null; return out;
})()`);
console.log('  rules:', JSON.stringify(rules));
ok(rules.silenced === false, 'silence blocks techniques'); ok(rules.hpPaid > 0, 'kinjutsu costs HP'); ok(rules.leech, 'leech heals the caster'); ok(rules.tooWeak === false, 'cannot cast a kinjutsu that would kill you');
ok(rules.woke === true, 'damage wakes a sleeper'); ok(rules.dotKeepsSleep === true, 'poison does not wake a sleeper');
ok(rules.charged > 0 && rules.guard === true, 'Charge restores Chakra and guards'); ok(rules.pierce > rules.normal * 1.3, 'pierce ignores Guard (' + rules.normal.toFixed(1) + ' vs ' + rules.pierce.toFixed(1) + ')');
ok(rules.undying && rules.diesSecondTime, 'Second Wind saves you exactly once');

section("Momo's tools and the offline helper");
const tool = (n, i) => ev(`(() => { try{ const t = GUIDE_TOOLS.find(t => t.name === '${n}'); if(!t) return {err:'no tool ${n}'}; return {ok:t.run(${JSON.stringify(i || {})})}; }catch(e){ return {err:e.message}; } })()`);
const names = ev('GUIDE_TOOLS.map(t => t.name)');
for(const n of ['optimize_team', 'auto_gear', 'set_talent', 'customize_ninja', 'set_control', 'adopt_pet', 'set_pet']) ok(names.includes(n), 'tool exists: ' + n);
for(const k of ['missions', 'skills', 'shop', 'pets', 'clans', 'arena', 'talents']){ const r = tool('list_options', {kind:k}); ok(r.ok && r.ok.length, 'list_options ' + k + (r.err ? ' -> ' + r.err : '')); }
ok(tool('get_game_state').ok && tool('get_game_state').ok.talents.length === 6, 'game state lists talents');
ok(tool('get_game_state').ok.squad.every(m => 'control' in m && 'petControl' in m), 'game state lists squad control');
ev(`S.char.gold = 50000; S.char.talents = blankTalents(); S.char.equip = {weapon:'kunai_train', clothing:null, back:null, accessory:null};`);
let r = tool('optimize_team', {who:'all'}); ok(r.ok, 'optimize_team all works ' + (r.err || ''));
r = tool('set_talent', {who:'leader', id:'thrifty'}); ok(r.ok || /free|chosen/.test(JSON.stringify(r)), 'set_talent ' + JSON.stringify(r));
r = tool('set_talent', {who:'leader', id:'fist'}); ok(r.ok && ev('S.char.talents[2]') === 'fist', 'set_talent tier 2: ' + JSON.stringify(r));
r = tool('set_talent', {who:'leader', id:'master'}); ok(r.err && /Unlocks/.test(r.err) || ev('S.char.level') >= 50, 'locked tier refused');
r = tool('customize_ninja', {who:'leader', name:'Haru', hairStyle:'bun', hair:'#112233', mask:'none', headband:'none'}); ok(r.ok && ev('S.char.name') === 'Haru' && ev('S.char.look.hairStyle') === 'bun', 'customize_ninja ' + JSON.stringify(r));
r = tool('customize_ninja', {who:'leader', hairStyle:'nope'}); ok(r.err, 'bad hairstyle refused');
r = tool('customize_ninja', {who:'leader', hair:'red'}); ok(r.err, 'bad color refused');
ev(`S.char.name = 'Tester'`);
r = tool('set_control', {id:rid, auto:false}); ok(r.ok && ev(`recruitById('${rid}').auto`) === false, 'set_control ninja');
r = tool('set_control', {id:rid, target:'pet', auto:false}); ok(r.ok && ev(`recruitById('${rid}').petAuto`) === false, 'set_control pet');
r = tool('adopt_pet', {id:'static_ferret', owner:rid2}); ok(r.ok && ev(`recruitById('${rid2}').pet`) === 'static_ferret', 'adopt_pet for a recruit ' + JSON.stringify(r));
r = tool('set_pet', {id:'', owner:rid2}); ok(r.ok && ev(`recruitById('${rid2}').pet`) === null, 'set_pet clears');
r = tool('auto_gear', {who:rid}); ok(r.ok, 'auto_gear a recruit');
const sug = ev('suggestions()'); ok(Array.isArray(sug) && sug.every(x => x.text && x.tool), 'suggestions well-formed (' + sug.length + ')');
ev(`S.char.gold = 30000; S.char.equip = {weapon:'kunai_train', clothing:null, back:null, accessory:null}; S.inventory = {};`);
for(const x of ev('suggestions()')){ const out = ev(`(() => { try{ GUIDE.offerList = [suggestions().find(s => s.tool === '${x.tool}')]; guideDo(0); return 'ok'; }catch(e){ return e.message; } })()`); ok(out === 'ok', 'offline suggestion runs: ' + x.tool); }

section('every data-act in every screen has a handler');
const handlers = new Set(ev('Object.keys(ACT)'));
const seen = new Set();
for(const sc of [...screens, 'recruit', 'custom', 'results', 'title', 'create']){
  try{ ev(`go('${sc}')`); }catch(e){ continue; }
  doc.querySelectorAll('[data-act]').forEach(el => seen.add(el.dataset.act));
}
const missing = [...seen].filter(a => !handlers.has(a));
ok(missing.length === 0, 'missing handlers: ' + missing.join(', '));

section('save, reload, migrate');
const saved = ev(`JSON.stringify(S)`);
ok(ev(`(() => { const m = migrate(JSON.parse(JSON.stringify(S))); return m.char.talents.length === 6 && m.squad.roster.every(r => r.talents.length === 6); })()`), 'round-trips through migrate');
// an old (version 4) save without any of the new fields must load cleanly
const old = ev(`(() => { const o = JSON.parse(JSON.stringify(S)); delete o.char.talents; delete o.char.petAuto; o.char.loadout = o.char.loadout.slice(0, 6); o.squad.roster.forEach(r => { delete r.talents; delete r.petAuto; delete r.auto; }); o.version = 4; const m = migrate(o); return {ok:true, talents:m.char.talents.length, rtal:m.squad.roster.map(r => talentsUnpicked(r))}; })()`);
ok(old.ok && old.talents === 6, 'old save migrates'); ok(old.rtal.every(n => n === 0), 'old recruits get talents automatically');

console.log(`\n${checks - fails}/${checks} checks passed`);
if(errors.length){ console.log('\nRuntime errors captured:'); [...new Set(errors)].slice(0, 12).forEach(e => console.log(' - ' + e.split('\n').slice(0, 4).join('\n   '))); }
process.exit(fails || errors.length ? 1 : 0);
