
/* ============================ STATE ============================ */
const SAVE_KEY = 'tsukimori_save_v1';
let S = null;     // saved game state (single object)
let B = null;     // live battle (not saved)
let RUN = null;   // live run: mission | arena | event (not saved)
const UI = {screen:'title', tab:{missions:'D', academy:null, shop:'weapon'}, create:defaultCreate(), itemPanel:false, results:null};

function defaultCreate(){ return {name:'', gender:'m', hairStyle:'spiky', hair:'#2b2b3a', outfit:'#3a5a8c', eyes:'#3b6fd6', skin:'#f3d2b3', element:'fire'}; }
function defaultState(){
  return {version:2, char:null, inventory:{salve:3, pill:2}, missions:{}, stats:{won:0, lost:0, missions:0},
    settings:{speed:1}, shards:0,
    arena:{rating:1000, wins:0, losses:0, opps:[]},
    event:{week:-1, bossLvl:0, pool:0, dmg:0, day:'', tries:0, claimed:[], best:0, kills:0, commClaimed:[]},
    counters:{wins:0, missions:0, skills:0, crits:0, strong:0, arena:0, event:0, social:0}, daily:null, ach:[], login:{day:'', streak:0},
    squad:defaultSquad()};
}
function starterSkill(el){ return SKILLS.find(s => s.el === el && s.lvl === 1 && !s.enemyOnly && !s.petOnly).id; }
function newCharacter(cr){
  const first = starterSkill(cr.element);
  return {name:cr.name.trim().slice(0,16) || 'Nameless', element:cr.element,
    look:{gender:cr.gender, hairStyle:cr.hairStyle, hair:cr.hair, outfit:cr.outfit, eyes:cr.eyes, skin:cr.skin},
    level:1, xp:0, gold:120, points:0, alloc:{hp:0, cp:0, agi:0},
    equip:{weapon:'kunai_train', clothing:null, back:null, accessory:null},
    skills:[first], loadout:[first], pets:[], pet:null, bond:{}, clan:null};
}
function persist(){ try{ if(S && S.char) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function loadLocal(){ try{ const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; }catch(e){ return null; } }
// Normalizes a character (the player's, or an imported ghost) so every field exists.
function normChar(o){
  const c = Object.assign({level:1, xp:0, gold:0, points:0, skills:[], loadout:[], pets:[], pet:null, bond:{}, clan:null}, o);
  c.name = String(c.name || 'Nameless').slice(0, 16);
  c.alloc = Object.assign({hp:0, cp:0, agi:0}, o.alloc || {});
  c.equip = Object.assign({weapon:null, clothing:null, back:null, accessory:null}, o.equip || {});
  for(const sl of SLOTS) if(c.equip[sl] && !ITEM[c.equip[sl]]) c.equip[sl] = null;
  c.look = Object.assign(defaultCreate(), o.look || {}); delete c.look.name; delete c.look.element;
  if(!ELEMENTS[c.element]) c.element = 'fire';
  c.level = clamp(c.level | 0, 1, MAX_LEVEL);
  c.skills = (c.skills || []).filter(id => SKILL[id]);
  if(!c.skills.length) c.skills = [starterSkill(c.element)];
  c.loadout = (c.loadout || []).filter(id => c.skills.includes(id)).slice(0, MAX_LOADOUT);
  c.pets = (c.pets || []).filter(id => PET[id]);
  if(c.pet && !c.pets.includes(c.pet)) c.pet = null;
  c.bond = Object.assign({}, o.bond || {});
  if(c.clan && !CLAN[c.clan.id]) c.clan = null;
  c.squad = Array.isArray(o.squad) ? o.squad.slice(0, MAX_SQUAD).map(x => Object.assign(normChar(Object.assign({}, x, {squad:[]})), {squad:[]})) : [];
  return c;
}
function migrate(o){
  if(o && o.char === undefined && o.name && o.element) o = {char:o}; // bare character JSON
  if(!o || typeof o !== 'object' || !o.char || typeof o.char.name !== 'string') throw new Error('That text is not a Tsukimori save.');
  const d = defaultState(), s = Object.assign(d, o);
  s.char = normChar(o.char);
  s.inventory = Object.assign({}, o.inventory || {});
  for(const k in s.inventory) if(!ITEM[k] || !(s.inventory[k] > 0)) delete s.inventory[k];
  s.missions = Object.assign({}, o.missions || {});
  s.settings = Object.assign({speed:1}, o.settings || {});
  s.stats = Object.assign({won:0, lost:0, missions:0}, o.stats || {});
  s.arena = Object.assign(defaultState().arena, o.arena || {});
  s.event = Object.assign(defaultState().event, o.event || {});
  s.shards = o.shards | 0;
  s.counters = Object.assign(defaultState().counters, o.counters || {});
  s.ach = Array.isArray(o.ach) ? o.ach : [];
  s.login = Object.assign({day:'', streak:0}, o.login || {});
  s.settings = Object.assign({speed:1, sound:true, auto:false}, o.settings || {});
  s.squad = Object.assign(defaultSquad(), o.squad || {});
  s.squad.roster = (s.squad.roster || []).filter(r => r && r.id).map(r => Object.assign(normChar(r), {squad:[]}));
  s.squad.active = (s.squad.active || []).filter(id => s.squad.roster.some(r => r.id === id)).slice(0, MAX_SQUAD);
  s.squad.pool = (s.squad.pool || []).map(r => Object.assign(normChar(r), {squad:[]}));
  s.version = 4;
  return s;
}
function addInv(id, n){ S.inventory[id] = (S.inventory[id] || 0) + n; if(S.inventory[id] <= 0) delete S.inventory[id]; }

/* ============================ PROGRESSION ============================ */
function xpToNext(l){ return Math.floor(50 * Math.pow(l, 1.5)); }
function rankOf(l){ let r = RANKS[0]; for(const x of RANKS) if(l >= x.min) r = x; return r; }
function gainXp(amount){
  const c = S.char, ups = [];
  if(c.level >= MAX_LEVEL) return ups;
  c.xp += amount;
  while(c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)){ c.xp -= xpToNext(c.level); c.level++; c.points += POINTS_PER_LEVEL; ups.push(c.level); }
  if(c.level >= MAX_LEVEL) c.xp = 0;
  return ups;
}
function clanBonus(c){
  if(!c.clan || !CLAN[c.clan.id]) return {};
  const cl = CLAN[c.clan.id], m = 1 + 0.25 * clanTier(c.clan.rep || 0), p = cl.perk, o = {};
  for(const k in p) o[k] = typeof p[k] === 'number' ? p[k] * m : p[k];
  return o;
}
function gearBonus(c){
  const g = {hp:0, cp:0, agi:0, atk:0, crit:0, dodge:0};
  for(const sl of SLOTS){ const it = ITEM[c.equip[sl]]; if(it && it.bonus) for(const k in it.bonus) g[k] = (g[k] || 0) + it.bonus[k]; }
  return g;
}
function charStats(c){
  const g = gearBonus(c), cb = clanBonus(c);
  const agi = Math.round((5 + c.level + c.alloc.agi * 2 + g.agi) * (1 + (cb.agiPct || 0)));
  return {maxHp:Math.round((90 + c.level * 12 + c.alloc.hp * 10 + g.hp) * (1 + (cb.hpPct || 0))),
          maxCp:Math.round((40 + c.level * 5 + c.alloc.cp * 6 + g.cp) * (1 + (cb.cpPct || 0))),
          agi, atk:Math.round((8 + c.level * 2 + g.atk) * (1 + (cb.atkPct || 0))),
          crit:Math.min(50, 5 + agi * 0.15 + g.crit + (cb.crit || 0)), dodge:g.dodge + (cb.dodge || 0),
          elem:cb.elem || null, elemPct:cb.elemPct || 0, g};
}
function skillPrice(s){ return s.el === S.char.element ? s.price : s.price * 2; }
function skillTags(s){
  const t = [];
  if(s.power) t.push(`${s.hits > 1 ? s.hits + '×' : ''}${Math.round(s.power * 100)}% power`);
  if(s.target === 'allEnemies') t.push('All foes');
  if(s.target === 'ally') t.push('Ally');
  if(s.heal) t.push(`Heal ${Math.round(s.heal * 100)}%`);
  if(s.cpRestore) t.push(`+${Math.round(s.cpRestore * 100)}% CP`);
  if(s.cleanse) t.push('Cleanse');
  if(s.critBonus) t.push(`+${s.critBonus}% crit`);
  (s.apply || []).forEach(a => { const st = STATUSES[a.s]; t.push(`${st.icon} ${st.name}${a.chance < 1 ? ' ' + Math.round(a.chance * 100) + '%' : ''}${a.on === 'self' ? ' (self)' : ''}`); });
  return t;
}
function missionXp(m){ return m.xp != null ? m.xp : Math.round(xpToNext(m.lvl) * 0.3); }
function missionGold(m){ return m.gold != null ? m.gold : Math.round(30 + m.lvl * 20); }

/* ============================ UNITS ============================ */
let UID = 0;
function mkUnit(o){ return Object.assign({uid:++UID, hp:o.maxHp, cp:o.maxCp, cds:{}, statuses:[], alive:true, turns:0, gear:{}}, o); }
function unitFromChar(c, controller = 'player', side = 'ally'){
  const st = charStats(c);
  return mkUnit({name:c.name, side, controller, isPlayer:controller === 'player', el:c.element, level:c.level,
    maxHp:st.maxHp, maxCp:st.maxCp, agi:st.agi, atk:st.atk, crit:st.crit, dodge:st.dodge, elemBoost:st.elem, elemPct:st.elemPct,
    skills:[...c.loadout], kind:'ninja', look:Object.assign({}, c.look, {scarf:ELEMENTS[c.element].color}), gear:gearLooks(c)});
}
function enemyStats(L){ return {hp:48 + 15 * L + 0.12 * L * L, atk:5 + 1.9 * L + 0.012 * L * L, agi:4 + 0.9 * L, cp:30 + 4 * L}; }
function unitFromEnemy(id, lvl){
  const d = ENEMY[id], b = enemyStats(lvl);
  return mkUnit({name:d.name, side:'enemy', controller:'ai', el:d.el, level:lvl,
    maxHp:Math.round(b.hp * d.hpM), maxCp:Math.round(b.cp), agi:Math.round(b.agi * d.agiM), atk:Math.round(b.atk * d.atkM * 10) / 10,
    crit:5 + b.agi * d.agiM * 0.15, dodge:0, skills:[...d.skills], kind:d.kind, look:d.look, gear:d.gear || {},
    xp:Math.round((12 + xpToNext(lvl) * 0.05) * (d.xpM || 1)), gold:Math.round((8 + lvl * 4) * (d.goldM || 1)),
    boss:!!d.boss, enrage:d.boss ? 0.35 : 0, defId:id});
}
// Pets fight on their owner's side under AI control; stats scale from the owner and bond level.
function unitFromPet(pid, ownerStats, side, bond, level){
  const p = PET[pid], m = 1 + 0.06 * (bondLevel(bond) - 1);
  return mkUnit({name:p.name, side, controller:'ai', isPet:true, el:p.el, level,
    maxHp:Math.round(ownerStats.maxHp * 0.45 * p.hpM * m), maxCp:40 + level * 3, agi:Math.round(ownerStats.agi * 0.9 * p.agiM),
    atk:Math.round(ownerStats.atk * 0.55 * p.atkM * m * 10) / 10, crit:8, dodge:0, skills:[...p.skills], kind:p.kind, look:p.look});
}
// PvP: any character (generated ghost, your own echo, or a friend's export) becomes an AI team.
function ghostTeam(g){
  const u = unitFromChar(g, 'ai', 'enemy'); u.isGhost = true;
  const team = [u];
  for(const m of (g.squad || []).slice(0, MAX_SQUAD)){ const su = unitFromChar(Object.assign({}, m, {clan:g.clan}), 'ai', 'enemy'); su.isGhost = true; team.push(su); }
  if(g.pet && PET[g.pet]) team.push(unitFromPet(g.pet, charStats(g), 'enemy', (g.bond || {})[g.pet] || 0, g.level));
  return team;
}
function unitFromGhost(ghostChar){ return ghostTeam(normChar(ghostChar))[0]; }

/* ---- ghost generator ---- */
const SYL1 = ['Ao','Hi','Ka','Ren','Sora','Yu','Mi','Tsu','Ha','Ko','Na','Ri','Shi','Ta','Ki','Se','Fu','Ma'];
const SYL2 = ['ru','ki','ne','to','ya','mi','sa','ro','ji','ka','no','ho','ri','ta'];
const SYL3 = ['','','','n','ko','ra','shi','e'];
const pick = a => a[Math.floor(Math.random() * a.length)];
function makeGhost(level, squadN = 0){
  level = clamp(level, 1, MAX_LEVEL);
  const el = pick(EL_ORDER), arch = pick(GHOST_ARCHETYPES), gender = Math.random() < 0.5 ? 'm' : 'f';
  const g = {name:pick(SYL1) + pick(SYL2) + pick(SYL3), element:el, level, archetype:arch.name,
    look:{gender, hairStyle:pick(HAIR_STYLES).id, hair:pick(HAIR_COLORS), outfit:pick(OUTFIT_COLORS), eyes:pick(EYE_COLORS), skin:pick(SKIN_TONES)},
    alloc:{hp:0, cp:0, agi:0}, equip:{}, skills:[], loadout:[], pets:[], pet:null, bond:{}, clan:null};
  const tot = arch.w.hp + arch.w.cp + arch.w.agi;
  for(let i = 0; i < (level - 1) * POINTS_PER_LEVEL; i++){ const r = Math.random() * tot; g.alloc[r < arch.w.hp ? 'hp' : r < arch.w.hp + arch.w.cp ? 'cp' : 'agi']++; }
  for(const sl of SLOTS){
    const opts = ITEMS.filter(i => i.slot === sl && i.lvl <= level && !i.shards).sort((a, b) => b.lvl - a.lvl).slice(0, 2);
    g.equip[sl] = opts.length && Math.random() < 0.9 ? pick(opts).id : null;
  }
  const own = SKILLS.filter(s => s.el === el && s.lvl <= level && !s.enemyOnly && !s.petOnly).slice(-5);
  const off = SKILLS.filter(s => s.el !== el && s.lvl <= level && !s.enemyOnly && !s.petOnly);
  g.skills = own.map(s => s.id); if(off.length && level >= 5) g.skills.push(pick(off).id);
  g.loadout = g.skills.slice(0, MAX_LOADOUT);
  const pets = PETS.filter(p => p.lvl <= level && !p.shards);
  if(pets.length && Math.random() < 0.55){ g.pet = pick(pets).id; g.pets = [g.pet]; g.bond[g.pet] = Math.floor(Math.random() * level); }
  if(level >= 5 && Math.random() < 0.6){ const cl = pick(CLANS.filter(c => c.lvl <= level)); g.clan = {id:cl.id, rep:Math.floor(Math.random() * level * 20)}; }
  g.squad = Array.from({length:squadN}, () => { const m = makeGhost(Math.max(1, level - Math.floor(Math.random() * 3)), 0); m.pet = null; m.pets = []; m.clan = null; return m; });
  return normChar(g);
}
function soloPower(c){ const s = charStats(c); return Math.round(s.maxHp * 0.25 + s.atk * 3 + s.agi * 2 + s.maxCp * 0.2 + c.loadout.length * 8); }
function buildPower(c, squad){ const sq = squad || c.squad || []; return soloPower(c) + (c.pet ? 25 : 0) + sq.reduce((a, m) => a + Math.round(soloPower(m) * 0.8), 0); }
function refreshArena(){ const L = S.char.level, n = activeSquad().length; S.arena.opps = [-1, 0, 1].map(d => Object.assign(makeGhost(L + d, n), {diff:d})); persist(); }

/* ============================ BATTLE ENGINE ============================ */
function later(fn, ms){ const b = B; setTimeout(() => { if(B === b && B) fn(); }, ms / ((S && S.settings.speed) || 1)); }
const hasStatus = (u, s) => u.statuses.some(x => x.s === s);
const effAgi = u => u.agi * (hasStatus(u, 'slow') ? 0.6 : 1) * (hasStatus(u, 'haste') ? 1.4 : 1);
const opponents = u => (u.side === 'ally' ? B.enemies : B.allies).filter(x => x.alive);
const friends = u => (u.side === 'ally' ? B.allies : B.enemies).filter(x => x.alive);
const allUnits = () => [...B.allies, ...B.enemies];
function dodgeChance(att, def){ return clamp(5 + (effAgi(def) - effAgi(att)) * 1.2 + (def.dodge || 0) + (hasStatus(def, 'haste') ? 10 : 0), 3, 45); }
function log(msg){ if(!B) return; B.log.push(msg); if(B.log.length > 40) B.log.shift(); }
const mostWounded = u => friends(u).reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));

// Your side: leader + active squadmates (you control them too) + pet (AI). Squadmates share the leader's clan perks.
function playerTeam(carry){
  const c = S.char, st = charStats(c), p = unitFromChar(c); p.key = 'leader';
  const team = [p];
  for(const r of activeSquad()){ const u = unitFromChar(Object.assign({}, r, {clan:c.clan}), 'player', 'ally'); u.isPlayer = false; u.isSquad = true; u.key = r.id; team.push(u); }
  if(c.pet && PET[c.pet]){ const pu = unitFromPet(c.pet, st, 'ally', c.bond[c.pet] || 0, c.level); pu.key = 'pet'; team.push(pu); }
  if(carry) for(const u of team){ const k = carry[u.key]; if(k){ u.hp = clamp(k.hp, 1, u.maxHp); u.cp = clamp(k.cp, 0, u.maxCp); } }
  return team;
}
function startMission(id){
  const m = MISSION[id]; if(!m) return;
  if(S.char.level < m.lvl) return toast(`Requires level ${m.lvl}`);
  RUN = {kind:'mission', id, stage:0, xp:0, gold:0, carry:null, stages:m.stages.length};
  startStage();
}
function startStage(){
  if(RUN.kind === 'mission'){
    const m = MISSION[RUN.id], st = m.stages[RUN.stage];
    const foes = st.foes.map(([id, l]) => unitFromEnemy(id, l)), n = activeSquad().length;
    if(n) foes.forEach(e => { e.maxHp = e.hp = Math.round(e.maxHp * (1 + 0.45 * n)); e.atk = Math.round(e.atk * (1 + 0.12 * n) * 10) / 10; }); // bigger squad, tougher foes
    startBattle(playerTeam(RUN.carry), foes, {title:m.name, stage:RUN.stage + 1, stages:m.stages.length, boss:!!st.boss});
  } else if(RUN.kind === 'arena'){
    startBattle(playerTeam(null), ghostTeam(RUN.ghost), {title:`Echo Arena: ${RUN.ghost.name}`, stage:1, stages:1, sub:RUN.ghost.archetype || 'Ghost build'});
  } else if(RUN.kind === 'event'){
    startBattle(playerTeam(null), [RUN.boss], {title:'Crimson Moon', stage:1, stages:1, boss:true, roundLimit:EVENT_ROUNDS, sub:`Survive and deal damage for ${EVENT_ROUNDS} rounds`});
  }
}
function startBattle(allies, enemies, meta){
  B = {allies, enemies, meta, round:0, queue:[], log:[], over:false, awaiting:false, active:null, target:enemies[0].uid, fseq:0};
  UI.screen = 'battle'; UI.itemPanel = false;
  closeModal(); render(); window.scrollTo(0, 0);
  log(`${meta.boss ? '⚠️ Boss battle! ' : ''}${enemies.map(e => `<b>${esc(e.name)}</b>`).join(', ')} ${enemies.length > 1 ? 'appear' : 'appears'}!`);
  if(allies.find(a => a.isPet)) log(`🐾 ${esc(allies.find(a => a.isPet).name)} fights at your side.`);
  updateBattle();
  emit('battleStart', B);
  later(beginRound, 700);
}
function beginRound(){
  if(B.meta.roundLimit && B.round >= B.meta.roundLimit){
    B.over = true; B.awaiting = false; log(`🌘 The blood moon sets. Time is up!`); updateBattle(); later(() => finishRun('timeout'), 1100); return;
  }
  B.round++;
  B.queue = allUnits().filter(u => u.alive).map(u => [u, effAgi(u) + Math.random() * 0.5]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  nextTurn();
}
function checkEnd(){
  if(B.over) return true;
  if(B.allies.filter(u => !u.isPet).every(u => !u.alive)){ B.over = true; B.awaiting = false; updateBattle(); later(stageLost, 1000); return true; }
  if(B.enemies.every(u => !u.alive)){ B.over = true; B.awaiting = false; updateBattle(); later(stageWon, 1000); return true; }
  return false;
}
function nextTurn(){
  if(checkEnd()) return;
  if(!B.queue.length) return beginRound();
  const u = B.queue.shift();
  if(!u.alive) return nextTurn();
  B.active = u; B.fseq = 0;
  startOfTurn(u);
  updateBattle();
  if(!u.alive){ later(nextTurn, 800); return; }
  if(hasStatus(u, 'stun')){
    log(`💫 <b>${esc(u.name)}</b> is stunned and can't move!`); float(u, 'Stunned', 'fl-status fl-debuff');
    endOfTurn(u); updateBattle(); later(nextTurn, 950); return;
  }
  if(u.controller === 'player'){ B.awaiting = true; if(!opponents(u).find(e => e.uid === B.target)) retarget(); updateBattle(); if(S.settings.auto) later(autoAct, 500); else if(u.isSquad) sfx('click'); }
  else later(() => { B.fseq = 0; aiAct(u); endOfTurn(u); updateBattle(); later(nextTurn, 850); }, 650);
}
function startOfTurn(u){
  u.turns++;
  for(const k in u.cds) if(u.cds[k] > 0) u.cds[k]--;
  for(const st of [...u.statuses]){
    if(!u.alive) break;
    if(st.s === 'burn' || st.s === 'bleed'){ dealDamage(u, st.val, {cls:'fl-' + st.s}); log(`${STATUSES[st.s].icon} ${esc(u.name)} takes ${st.val} ${st.s} damage.`); }
    else if(st.s === 'regen') heal(u, Math.max(1, Math.round(st.val * u.maxHp)));
  }
}
function endOfTurn(u){ u.statuses.forEach(x => x.dur--); u.statuses = u.statuses.filter(x => x.dur > 0); }
function retarget(){ const n = B.enemies.find(e => e.alive); if(n) B.target = n.uid; }
function getTarget(){ return B.enemies.find(e => e.uid === B.target && e.alive) || B.enemies.find(e => e.alive); }

function attack(att, def, o){
  let landed = false;
  for(let i = 0; i < (o.hits || 1); i++){
    if(!def.alive) break;
    if(Math.random() * 100 < dodgeChance(att, def) * (o.dodgeMult == null ? 1 : o.dodgeMult)){
      float(def, 'Dodge', 'fl-miss'); log(`${esc(def.name)} dodges!`); continue;
    }
    let d = att.atk * o.power * rand(0.9, 1.1);
    const em = elemMult(o.el, def.el); d *= em;
    if(o.el && att.elemBoost === o.el) d *= 1 + att.elemPct;
    if(hasStatus(att, 'empower')) d *= 1.3;
    if(hasStatus(att, 'weaken')) d *= 0.75;
    if(hasStatus(def, 'guard')) d *= 0.65;
    if(hasStatus(def, 'expose')) d *= 1.25;
    const crit = Math.random() * 100 < att.crit + (o.critBonus || 0);
    if(crit) d *= 1.5;
    d = Math.max(1, Math.round(d));
    dealDamage(def, d, {crit, em});
    if(att.side === 'ally' && att.controller === 'player'){ if(crit) S.counters.crits++; if(em > 1) S.counters.strong++; }
    log(`${esc(att.name)} hits ${esc(def.name)} for <b>${d}</b>${crit ? ' — critical!' : ''}${em > 1 ? ' (strong element)' : em < 1 ? ' (weak element)' : ''}`);
    landed = true;
  }
  return landed;
}
function dealDamage(u, d, o = {}){
  if(!u.alive) return;
  u.hp = Math.max(0, u.hp - d);
  const cls = ['fl-dmg', o.crit ? 'fl-crit' : '', o.cls || '', o.em > 1 ? 'fl-strong' : o.em < 1 ? 'fl-weak' : ''].join(' ');
  const dl = float(u, `-${d}${o.crit ? '!' : ''}${o.em > 1 ? ' ▲' : o.em < 1 ? ' ▼' : ''}`, cls);
  anim(u, 'hit', dl); setTimeout(() => sfx(o.crit ? 'crit' : 'hit'), dl);
  if(u.hp <= 0){
    u.alive = false; u.statuses = [];
    log(`💀 <b>${esc(u.name)}</b> is defeated!`);
    if(u.side === 'enemy' && RUN){ RUN.xp += u.xp || 0; RUN.gold += u.gold || 0; }
    if(B.target === u.uid) retarget();
  } else if(u.enrage && !u.enraged && u.hp < u.maxHp * u.enrage){
    u.enraged = true; u.statuses.push({s:'empower', dur:99, val:0});
    float(u, '😡 ENRAGED', 'fl-status fl-debuff'); log(`😡 <b>${esc(u.name)}</b> becomes enraged! Its attacks grow stronger.`);
  }
}
function heal(u, amt){ amt = Math.min(amt, u.maxHp - u.hp); if(amt <= 0 || !u.alive) return; u.hp += amt; float(u, `+${amt}`, 'fl-heal'); sfx('heal'); }
function restoreCp(u, amt){ amt = Math.min(amt, u.maxCp - u.cp); if(amt <= 0) return; u.cp += amt; float(u, `+${amt} CP`, 'fl-cp'); }
function cleanse(u){ const n = u.statuses.length; u.statuses = u.statuses.filter(x => STATUSES[x.s].kind !== 'debuff'); if(u.statuses.length < n) float(u, 'Cleansed', 'fl-status fl-buff'); }
function applyStatus(t, s, dur, pow, src){
  if(!t.alive) return;
  const d = STATUSES[s]; let val = 0;
  if(d.scale === 'atk') val = Math.max(1, Math.round((pow || 0.3) * src.atk));
  else if(d.scale === 'maxhp') val = pow || 0.05;
  if(t === B.active) dur += 1; // a self-buff shouldn't tick down on the turn it's cast
  const ex = t.statuses.find(x => x.s === s);
  if(ex){ ex.dur = Math.max(ex.dur, dur); ex.val = Math.max(ex.val, val); } else t.statuses.push({s, dur, val});
  float(t, `${d.icon} ${d.name}`, 'fl-status fl-' + d.kind);
}
const canUse = (u, s) => (u.cds[s.id] || 0) <= 0 && u.cp >= s.cp;

function doBasic(u, t){ if(!t) return; anim(u, 'lunge'); log(`<b>${esc(u.name)}</b> attacks.`); attack(u, t, {power:1}); }
function doCharge(u){ anim(u, 'charge'); log(`🌀 <b>${esc(u.name)}</b> gathers chakra.`); restoreCp(u, Math.round(u.maxCp * 0.3) + 4); }
function useSkill(u, s, t){
  u.cp -= s.cp; u.cds[s.id] = s.cd + 1; if(u.side === 'ally' && u.controller === 'player') S.counters.skills++; sfx('skill');
  float(u, `${s.icon} ${s.name}`, 'fl-skill');
  log(`<b>${esc(u.name)}</b> uses <b style="color:${ELEMENTS[s.el].color}">${s.name}</b>!`);
  const self = s.target === 'self', ally = s.target === 'ally' ? mostWounded(u) : null;
  const targets = self || ally ? [] : s.target === 'allEnemies' ? opponents(u) : [t && t.alive ? t : opponents(u)[0]];
  if(s.power) anim(u, 'lunge'); else anim(u, 'charge');
  for(const tg of targets){
    if(!tg) continue;
    const landed = s.power ? attack(u, tg, {power:s.power, hits:s.hits, el:s.el, critBonus:s.critBonus, dodgeMult:0.6}) : true;
    if(landed) for(const a of s.apply || []) if(a.on !== 'self' && Math.random() < (a.chance == null ? 1 : a.chance)) applyStatus(tg, a.s, a.dur, a.pow, u);
  }
  const buffTo = ally || u;
  for(const a of s.apply || []) if((a.on === 'self' || self || ally) && Math.random() < (a.chance == null ? 1 : a.chance)) applyStatus(a.on === 'self' ? u : buffTo, a.s, a.dur, a.pow, u);
  if(s.heal) heal(buffTo, Math.round(buffTo.maxHp * s.heal));
  if(s.cpRestore) restoreCp(u, Math.round(u.maxCp * s.cpRestore));
  if(s.cleanse) cleanse(u);
}
function useItem(u, id, t){
  const it = ITEM[id], us = it.use;
  addInv(id, -1);
  float(u, `${it.icon} ${it.name}`, 'fl-skill');
  log(`<b>${esc(u.name)}</b> uses ${it.name}.`);
  if(us.cleanse) cleanse(u);
  if(us.healPct) heal(u, Math.round(u.maxHp * us.healPct));
  if(us.cpPct) restoreCp(u, Math.round(u.maxCp * us.cpPct));
  if(us.damage && t){ const em = elemMult(us.el, t.el), d = Math.round((us.damage + S.char.level * us.scale) * em); dealDamage(t, d, {em}); log(`${it.icon} The tag blasts ${esc(t.name)} for <b>${d}</b>.`); }
}
function aiAct(u){
  const foes = opponents(u); if(!foes.length) return;
  const t = Math.random() < 0.7 ? foes.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b)) : foes[Math.floor(Math.random() * foes.length)];
  const ready = u.skills.map(id => SKILL[id]).filter(s => s && canUse(u, s));
  const hurt = mostWounded(u);
  const healS = ready.find(s => s.heal && (s.target === 'ally' ? hurt.hp < hurt.maxHp * 0.55 : u.hp < u.maxHp * 0.45));
  if(healS && Math.random() < 0.8) return useSkill(u, healS, t);
  const buff = ready.find(s => (s.target === 'self' || s.target === 'ally') && !s.heal && !(s.apply || []).every(a => hasStatus(s.target === 'ally' ? hurt : u, a.s)));
  if(buff && Math.random() < 0.35) return useSkill(u, buff, t);
  const off = ready.filter(s => s.target === 'enemy' || s.target === 'allEnemies');
  if(off.length && Math.random() < (u.isPet ? 0.7 : 0.55)) return useSkill(u, off[Math.floor(Math.random() * off.length)], t);
  if(u.cp < u.maxCp * 0.3 && Math.random() < 0.4) return doCharge(u);
  doBasic(u, t);
}
function playerAct(fn){
  if(!B || !B.awaiting || B.over) return;
  const u = B.active;
  B.awaiting = false; UI.itemPanel = false; B.fseq = 0;
  fn(u);
  endOfTurn(u); updateBattle();
  later(nextTurn, 800);
}

/* ---- visual feedback ---- */
function float(u, text, cls){
  if(!B) return 0;
  const delay = (B.fseq++) * 190;
  setTimeout(() => {
    const card = document.getElementById('u' + u.uid); if(!card) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls; el.textContent = text;
    el.style.left = (38 + Math.random() * 24) + '%';
    card.appendChild(el); setTimeout(() => el.remove(), 1200);
  }, delay);
  return delay;
}
function anim(u, cls, delay = 0){
  setTimeout(() => {
    const sp = document.querySelector(`#u${u.uid} .sprite`); if(!sp) return;
    sp.classList.remove(cls); void sp.offsetWidth; sp.classList.add(cls);
    setTimeout(() => sp.classList.remove(cls), 420);
  }, delay);
}

/* ---- ending a stage / run ---- */
function stageWon(){
  S.stats.won++; S.counters.wins++; sfx('win'); emit('battleEnd', {win:true, battle:B});
  if(RUN.kind !== 'mission') return finishRun(true);
  const m = MISSION[RUN.id], p = B.allies.find(a => a.isPlayer), pet = B.allies.find(a => a.isPet);
  RUN.stage++;
  if(RUN.stage < m.stages.length){
    RUN.carry = {};
    for(const u of B.allies) RUN.carry[u.key] = {hp:u.alive ? Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.25)) : Math.round(u.maxHp * 0.3), cp:Math.min(u.maxCp, u.cp + Math.round(u.maxCp * 0.3))};
    RUN.carry.hp = RUN.carry.leader.hp; RUN.carry.cp = RUN.carry.leader.cp;
    const nx = m.stages[RUN.stage];
    showModal(`Stage ${RUN.stage} of ${m.stages.length} cleared`,
      `<p>You catch your breath and recover 25% HP and 30% Chakra.${pet ? ` ${esc(pet.name)} ${pet.alive ? 'rests too' : 'gets back on its feet'}.` : ''}</p>
       <p><b>HP ${RUN.carry.hp}/${p.maxHp}</b>, <b>Chakra ${RUN.carry.cp}/${p.maxCp}</b></p>
       <div class="stages"><div class="stage">${nx.foes.map(([id, l]) => `<div class="mini flip">${miniSprite(id)}<small>Lv${l}</small></div>`).join('')}${nx.boss ? '<span class="bosstag">BOSS</span>' : ''}</div></div>
       <p class="muted">Up next: ${nx.foes.map(([id, l]) => `${ENEMY[id].name} (Lv ${l})`).join(', ')}</p>`,
      [{label:'Continue the mission', act:'nextStage', cls:'primary'}]);
  } else finishRun(true);
}
function stageLost(){ sfx('lose'); S.stats.lost++; emit('battleEnd', {win:false, battle:B}); finishRun(false); }
function addClanRep(n){ const c = S.char; if(!c.clan || !n) return 0; const before = clanTier(c.clan.rep); c.clan.rep += n; return clanTier(c.clan.rep) > before ? clanTier(c.clan.rep) : 0; }
function finishRun(outcome, fled = false){
  const c = S.char, oldLv = c.level, oldRank = rankOf(oldLv), win = outcome === true;
  const res = {win, fled, xp:RUN.xp, gold:RUN.gold, items:[], lines:[], kind:RUN.kind};
  const petUnit = B && B.allies.find(a => a.isPet), squadUnits = B ? B.allies.filter(a => a.isSquad) : [];
  if(RUN.kind === 'mission'){
    const m = MISSION[RUN.id];
    res.title = win ? 'Mission complete' : fled ? 'Mission abandoned' : 'Mission failed'; res.sub = m.name; res.retry = {act:'startMission', arg:m.id, label:win ? 'Run it again' : 'Try again'};
    if(win){
      res.xp += missionXp(m); res.gold += missionGold(m);
      const rec = S.missions[m.id] || (S.missions[m.id] = {clears:0});
      if(!rec.clears && m.firstClear) m.firstClear.forEach(id => res.items.push({id, first:true}));
      for(const d of m.drops || []) if(Math.random() < d.chance) res.items.push({id:d.item});
      rec.clears++; S.stats.missions++; S.counters.missions++;
      const rep = CLAN_REP[m.rank]; if(c.clan){ res.lines.push(`${CLAN[c.clan.id].crest} +${rep} clan reputation`); res.clanUp = addClanRep(rep); }
    }
  } else if(RUN.kind === 'arena'){
    const g = RUN.ghost, diff = g.diff || 0;
    res.title = win ? 'Echo defeated' : fled ? 'You left the arena' : 'The echo wins'; res.sub = `${g.name}, ${g.archetype || 'ghost build'}`; res.retry = {act:'go', arg:'arena', label:'Back to the arena'};
    const oldR = S.arena.rating;
    if(win){
      res.xp += Math.round(xpToNext(c.level) * (0.1 + 0.03 * diff)); res.gold += Math.round((25 + g.level * 10) * (1 + 0.2 * diff));
      S.arena.rating += 16 + diff * 5; S.arena.wins++; S.counters.arena++;
      if(!RUN.custom) S.arena.opps = S.arena.opps.filter(o => o !== g);
      if(S.arena.opps.length === 0) refreshArena();
      if(c.clan){ res.lines.push(`${CLAN[c.clan.id].crest} +8 clan reputation`); res.clanUp = addClanRep(8); }
    } else { S.arena.rating = Math.max(0, S.arena.rating - 10); S.arena.losses++; }
    res.lines.unshift(`🏟️ Echo rating ${oldR} → <b>${S.arena.rating}</b> (${arenaTier(S.arena.rating).name})`);
  } else if(RUN.kind === 'event'){
    const ev = S.event, boss = RUN.boss, dealt = Math.max(0, RUN.startHp - boss.hp), before = ev.dmg;
    ev.dmg = Math.min(ev.pool, ev.dmg + dealt); ev.best = Math.max(ev.best, dealt); S.counters.event++;
    const sh = 5 + Math.floor(dealt / ev.pool * 200); S.shards += sh;
    res.win = true; res.title = boss.hp <= 0 ? 'The boss has fallen!' : 'Attempt complete'; res.sub = boss.name; res.retry = {act:'go', arg:'event', label:'Back to the event'};
    res.lines.push(`💥 You dealt <b>${dealt}</b> damage (${(dealt / ev.pool * 100).toFixed(1)}% of its health)`);
    res.lines.push(`<span class="shardline">🔴 +${sh} Moon Shards</span>`);
    if(boss.hp <= 0 && before < ev.pool){ ev.kills++; res.lines.push('🏆 You struck the final blow this week!'); }
    res.xp += Math.round(xpToNext(c.level) * 0.05); res.gold += 20 + c.level * 5;
    if(c.clan){ res.lines.push(`${CLAN[c.clan.id].crest} +10 clan reputation`); res.clanUp = addClanRep(10); }
  }
  if(petUnit && (win || RUN.kind === 'event')){
    c.bond[c.pet] = (c.bond[c.pet] || 0) + 1;
    if(c.bond[c.pet] % 5 === 0 && bondLevel(c.bond[c.pet]) <= 10) res.lines.push(`🐾 ${PET[c.pet].name} reached bond level ${bondLevel(c.bond[c.pet])}!`);
  }
  if(res.clanUp) res.lines.push(`🎖️ Clan rank up: ${CLAN_TIERS[res.clanUp].name}! Clan perks grow stronger.`);
  c.gold += res.gold;
  res.items.forEach(it => addInv(it.id, 1));
  res.ups = gainXp(res.xp);
  if(win || RUN.kind === 'event') for(const su of squadUnits){
    const r = S.squad.roster.find(x => x.id === su.key); if(!r) continue;
    const ups = gainXpFor(r, res.xp); res.lines.push(`👥 ${esc(r.name)} +${res.xp} XP${ups.length ? `, now level ${r.level}! (+${ups.length * POINTS_PER_LEVEL} points)` : ''}`);
  }
  const nr = rankOf(c.level); res.newRank = nr !== oldRank ? nr : null;
  res.newSkills = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl > oldLv && s.lvl <= c.level);
  res.ups.forEach(l => emit('levelUp', l));
  B = null; RUN = null; UI.results = res;
  res.ach = checkAchievements(true);
  persist(); publishEcho(); if(res.kind === 'event') publishRaid(); go('results');
}

/* ---- Crimson Moon event ---- */
const DAY = 864e5;
function weekIndex(){ return Math.floor((Date.now() / DAY + 3) / 7); }  // weeks start Monday 00:00 UTC
function msToNextWeek(){ return ((weekIndex() + 1) * 7 - 3) * DAY - Date.now(); }
function todayKey(){ return new Date().toISOString().slice(0, 10); }
function syncEvent(){
  const ev = S.event, w = weekIndex();
  if(ev.week !== w) Object.assign(ev, {week:w, bossId:EVENT_BOSSES[((w % EVENT_BOSSES.length) + EVENT_BOSSES.length) % EVENT_BOSSES.length], dmg:0, claimed:[], best:0});
  if(ev.dmg === 0){ // boss level locks in with the first hit of the week
    const lvl = Math.max(5, S.char.level + 2);
    ev.bossLvl = lvl; ev.pool = Math.round(enemyStats(lvl).hp * ENEMY[ev.bossId].hpM * EVENT_POOL);
  }
  if(ev.day !== todayKey()){ ev.day = todayKey(); ev.tries = 0; }
}
function startEvent(){
  syncEvent(); const ev = S.event;
  if(S.char.level < EVENTS[0].lvl) return toast(`Requires level ${EVENTS[0].lvl}`);
  if(ev.dmg >= ev.pool) return toast('The boss is already defeated this week');
  if(ev.tries >= EVENT_TRIES) return toast('No attempts left today');
  ev.tries++; persist();
  const boss = unitFromEnemy(ev.bossId, ev.bossLvl);
  boss.maxHp = ev.pool; boss.hp = ev.pool - ev.dmg; boss.enrage = 0.5; boss.xp = 0; boss.gold = 0;
  if(boss.hp < boss.maxHp * 0.5){ boss.enraged = true; boss.statuses.push({s:'empower', dur:99, val:0}); }
  RUN = {kind:'event', xp:0, gold:0, boss, startHp:boss.hp, stages:1};
  startStage();
}
