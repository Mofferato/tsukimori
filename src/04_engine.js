
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
    skills:[first], loadout:[first], pets:[], pet:null, bond:{}, clan:null, talents:blankTalents(), petAuto:true};
}
/* ---- Save slots ----
   Each ninja lives in its own slot. The index lists them for the title and Save screens; the first
   slot keeps the original key, so saves from before slots existed simply become slot "main". */
const SLOTS_KEY = 'tsukimori_slots', MAX_SLOTS = 8;
const slotKey = id => id === 'main' ? SAVE_KEY : SAVE_KEY + ':' + id;
const slotMeta = (id, s) => ({id, name:s.char.name, level:s.char.level | 0, element:s.char.element, look:s.char.look, updated:Date.now()});
function slotIndex(){
  let x = null; try{ x = JSON.parse(localStorage.getItem(SLOTS_KEY)); }catch(e){}
  if(x && typeof x.active === 'string' && Array.isArray(x.list)) return x;
  x = {active:'main', list:[]};
  try{ const t = localStorage.getItem(SAVE_KEY), o = t && JSON.parse(t); if(o && o.char) x.list.push(slotMeta('main', o)); }catch(e){}
  return x;
}
function saveIndex(x){ try{ localStorage.setItem(SLOTS_KEY, JSON.stringify(x)); }catch(e){} }
const activeSlot = () => slotIndex().active;
function readSlot(id){ try{ const t = localStorage.getItem(slotKey(id)); return t ? JSON.parse(t) : null; }catch(e){ return null; } }
function persist(){
  if(!(S && S.char)) return;
  try{
    const x = slotIndex(); localStorage.setItem(slotKey(x.active), JSON.stringify(S));
    const m = slotMeta(x.active, S), i = x.list.findIndex(e => e.id === x.active);
    if(i >= 0) x.list[i] = m; else x.list.push(m);
    saveIndex(x);
  }catch(e){}
}
function loadLocal(){ return readSlot(activeSlot()); }
// Points the game at a fresh, empty slot (it appears in the list once the new ninja is saved).
function openNewSlot(){
  const x = slotIndex(); if(x.list.length >= MAX_SLOTS) throw new Error(`You can keep up to ${MAX_SLOTS} saves. Delete one first.`);
  if(S && S.char) persist();
  x.active = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); saveIndex(x);
  return x.active;
}
function useSlot(id){
  const o = readSlot(id); if(!o) throw new Error('That save is empty');
  if(S && S.char) persist();
  const next = migrate(o), x = slotIndex(); x.active = id; saveIndex(x);
  return next;
}
function deleteSlot(id){
  const x = slotIndex(); try{ localStorage.removeItem(slotKey(id)); }catch(e){}
  x.list = x.list.filter(e => e.id !== id);
  if(x.active === id) x.active = x.list.length ? x.list[0].id : 'main';
  saveIndex(x);
}
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
  c.petAuto = o.petAuto !== false; c.auto = !!o.auto;
  c.talents = blankTalents().map((_, i) => { const id = (o.talents || [])[i]; return TALENT[id] && TALENT[id].tier === i ? id : null; });
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
  s.squad.roster.forEach(r => { r.autoTech = r.autoTech !== false; learnNewTechs(r); }); // older saves: catch recruits up on techniques they've outgrown
  s.version = 5;
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
  const g = gearBonus(c), cb = clanBonus(c), tb = talentBonus(c), P = k => 1 + (cb[k] || 0) + (tb[k] || 0);
  const agi = Math.round((5 + c.level + c.alloc.agi * 2 + g.agi) * P('agiPct'));
  return {maxHp:Math.round((90 + c.level * 12 + c.alloc.hp * 10 + g.hp) * P('hpPct')),
          maxCp:Math.round((40 + c.level * 5 + c.alloc.cp * 6 + g.cp) * P('cpPct')),
          agi, atk:Math.round((8 + c.level * 2 + g.atk) * P('atkPct')),
          crit:Math.min(50, 5 + agi * 0.15 + g.crit + (cb.crit || 0) + (tb.crit || 0)), dodge:g.dodge + (cb.dodge || 0) + (tb.dodge || 0),
          elem:cb.elem || null, elemPct:cb.elemPct || 0, g, tb};
}
// Talents: one pick per tier (see TALENTS). Everything they grant is summed into one bag.
const blankTalents = () => TALENT_TIERS.map(() => null);
function talentBonus(c){
  const o = {dmgType:{}, opening:[]}, lv = c.level || 1;
  (c.talents || []).forEach((id, i) => {
    const t = TALENT[id]; if(!t || t.tier !== i || lv < TALENT_TIERS[i]) return;
    for(const k in t.fx){
      const v = t.fx[k];
      if(k === 'dmgType') for(const ty in v) o.dmgType[ty] = (o.dmgType[ty] || 0) + v[ty];
      else if(k === 'opening') o.opening.push(...v);
      else o[k] = (o[k] || 0) + v;
    }
  });
  return o;
}
const tv = (u, k) => (u.t && u.t[k]) || 0;
// Off-element ninjutsu costs double; the other technique families are element-free, so they cost the same for everyone.
function skillPrice(s, c){ c = c || S.char; return s.type === 'ninjutsu' && s.el !== c.element ? s.price * 2 : s.price; }
const skillColor = s => s.el ? ELEMENTS[s.el].color : TECH_TYPES[s.type || 'ninjutsu'].color;
function skillTags(s){
  const t = [];
  if(s.power) t.push(`${s.hits > 1 ? s.hits + '×' : ''}${Math.round(s.power * 100)}% power`);
  if(s.target === 'allEnemies') t.push('All foes');
  if(s.target === 'ally') t.push('Ally');
  if(s.heal) t.push(`Heal ${Math.round(s.heal * 100)}%`);
  if(s.cpRestore) t.push(`+${Math.round(s.cpRestore * 100)}% CP`);
  if(s.cleanse) t.push('Cleanse');
  if(s.critBonus) t.push(`+${s.critBonus}% crit`);
  if(s.pierce) t.push('Ignores Guard');
  if(s.leech) t.push(`Steals ${Math.round(s.leech * 100)}%`);
  if(s.hpCost) t.push(`☠️ −${Math.round(s.hpCost * 100)}% HP`);
  (s.apply || []).forEach(a => { const st = STATUSES[a.s]; t.push(`${st.icon} ${st.name}${a.chance < 1 ? ' ' + Math.round(a.chance * 100) + '%' : ''}${a.on === 'self' || (s.target === 'self') ? ' (self)' : ''}`); });
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
    skills:[...c.loadout], kind:'ninja', look:Object.assign({}, c.look, {scarf:ELEMENTS[c.element].color}), gear:gearLooks(c), t:st.tb});
}
// Foes are tuned against the technique rules above (stronger techniques, free Chakra regen, Charge guards): ENEMY_HP/ENEMY_ATK keep
// fights the same length as before. They ramp in over the first ten levels so a brand-new ninja with one technique isn't punished.
const ENEMY_HP = 1.3, ENEMY_ATK = 1.1;
function enemyStats(L){
  const k = clamp((L - 1) / 9, 0, 1), hm = 1 + (ENEMY_HP - 1) * k, am = 1 + (ENEMY_ATK - 1) * k;
  return {hp:(48 + 15 * L + 0.12 * L * L) * hm, atk:(5 + 1.9 * L + 0.012 * L * L) * am, agi:4 + 0.9 * L, cp:30 + 4 * L};
}
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
  return mkUnit({name:p.name, side, controller:'ai', isPet:true, petId:pid, el:p.el, level,
    maxHp:Math.round(ownerStats.maxHp * 0.45 * p.hpM * m), maxCp:40 + level * 3, agi:Math.round(ownerStats.agi * 0.9 * p.agiM),
    atk:Math.round(ownerStats.atk * 0.55 * p.atkM * m * 10) / 10, crit:8, dodge:0, skills:[...p.skills], kind:p.kind, look:p.look});
}
// PvP: any character (generated ghost, your own echo, or a friend's export) becomes an AI team.
function ghostTeam(g){
  const u = unitFromChar(g, 'ai', 'enemy'); u.isGhost = true;
  const team = [u];
  const addPet = (ch, owner) => { if(ch.pet && PET[ch.pet]){ const pu = unitFromPet(ch.pet, charStats(ch), 'enemy', (ch.bond || {})[ch.pet] || 0, ch.level); pu.ownerUid = owner.uid; team.push(pu); } };
  addPet(g, u);
  for(const m of (g.squad || []).slice(0, MAX_SQUAD)){
    const mm = Object.assign({}, m, {clan:g.clan}), su = unitFromChar(mm, 'ai', 'enemy'); su.isGhost = true; team.push(su); addPet(mm, su);
  }
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
  const real = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl <= level);
  const own = real.filter(s => s.el === el).slice(-5);
  const off = real.filter(s => s.el && s.el !== el), free = real.filter(s => !s.el);
  g.skills = own.map(s => s.id); if(off.length && level >= 5) g.skills.push(pick(off).id);
  if(free.length && level >= 3) for(const s of [...free].sort(() => Math.random() - 0.5).slice(0, 2)) g.skills.push(s.id);
  g.loadout = g.skills.slice(0, MAX_LOADOUT);
  const pets = PETS.filter(p => p.lvl <= level && !p.shards);
  if(pets.length && Math.random() < 0.55){ g.pet = pick(pets).id; g.pets = [g.pet]; g.bond[g.pet] = Math.floor(Math.random() * level); }
  if(level >= 5 && Math.random() < 0.6){ const cl = pick(CLANS.filter(c => c.lvl <= level)); g.clan = {id:cl.id, rep:Math.floor(Math.random() * level * 20)}; }
  g.talents = autoTalents(g);
  g.squad = Array.from({length:squadN}, () => { const m = makeGhost(Math.max(1, level - Math.floor(Math.random() * 3)), 0); m.clan = null; if(!(m.pet && Math.random() < 0.5)){ m.pet = null; m.pets = []; } return m; });
  return normChar(g);
}
function soloPower(c){ const s = charStats(c); return Math.round(s.maxHp * 0.25 + s.atk * 3 + s.agi * 2 + s.maxCp * 0.2 + c.loadout.length * 8); }
function buildPower(c, squad){ const sq = squad || c.squad || []; return soloPower(c) + (c.pet ? 25 : 0) + sq.reduce((a, m) => a + Math.round(soloPower(m) * 0.8) + (m.pet ? 20 : 0), 0); }
function refreshArena(){ const L = S.char.level, n = activeSquad().length; S.arena.opps = [-1, 0, 1].map(d => Object.assign(makeGhost(L + d, n), {diff:d})); persist(); }

/* ============================ BATTLE ENGINE ============================ */
function later(fn, ms){ const b = B; setTimeout(() => { if(B === b && B) fn(); }, ms / ((S && S.settings.speed) || 1)); }
const hasStatus = (u, s) => u.statuses.some(x => x.s === s);
const effAgi = u => u.agi * (hasStatus(u, 'slow') ? 0.6 : 1) * (hasStatus(u, 'haste') ? 1.4 : 1);
const opponents = u => (u.side === 'ally' ? B.enemies : B.allies).filter(x => x.alive);
const friends = u => (u.side === 'ally' ? B.allies : B.enemies).filter(x => x.alive);
const allUnits = () => [...B.allies, ...B.enemies];
function dodgeChance(att, def){ return clamp(5 + (effAgi(def) - effAgi(att)) * 1.2 + (def.dodge || 0) + (hasStatus(def, 'haste') ? 10 : 0) + (hasStatus(def, 'evasion') ? 25 : 0) + (hasStatus(att, 'blind') ? 30 : 0), 3, 60); }
function log(msg){ if(!B) return; B.log.push(msg); if(B.log.length > 40) B.log.shift(); }
const mostWounded = u => friends(u).reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));

// Your side: leader + active squadmates (you control them, or the AI does) and each ninja's own pet, which stands behind its owner.
// Squadmates share the leader's clan perks.
function playerTeam(carry){
  const c = S.char, team = [];
  const addPet = (ch, owner, key) => {
    if(!(ch.pet && PET[ch.pet])) return;
    const pu = unitFromPet(ch.pet, charStats(ch), 'ally', (ch.bond || {})[ch.pet] || 0, ch.level);
    pu.key = key === 'leader' ? 'pet' : 'pet:' + key; pu.owner = key; pu.ownerUid = owner.uid; pu.controller = ch.petAuto === false ? 'player' : 'ai';
    team.push(pu);
  };
  const p = unitFromChar(c); p.key = 'leader'; team.push(p); addPet(c, p, 'leader');
  for(const r of activeSquad()){
    const m = Object.assign({}, r, {clan:c.clan}), u = unitFromChar(m, r.auto ? 'ai' : 'player', 'ally');
    u.isPlayer = false; u.isSquad = true; u.key = r.id; team.push(u); addPet(m, u, r.id);
  }
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
    const foes = st.foes.map(([id, l]) => unitFromEnemy(id, l)), sq = activeSquad(), n = sq.length, np = sq.filter(r => r.pet && PET[r.pet]).length;
    if(n) foes.forEach(e => { e.maxHp = e.hp = Math.round(e.maxHp * (1 + 0.45 * n + 0.15 * np)); e.atk = Math.round(e.atk * (1 + 0.12 * n + 0.04 * np) * 10) / 10; }); // bigger squad, tougher foes
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
  const pets = allies.filter(a => a.isPet); if(pets.length) log(`🐾 ${pets.map(p => esc(p.name)).join(', ')} ${pets.length > 1 ? 'fight' : 'fights'} at your side.`);
  for(const u of [...allies, ...enemies]) for(const [st, dur] of (u.t && u.t.opening) || []) applyStatus(u, st, dur, 0, u);
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
  if(hasStatus(u, 'stun') || hasStatus(u, 'sleep')){
    const asleep = !hasStatus(u, 'stun');
    log(asleep ? `😴 <b>${esc(u.name)}</b> is fast asleep!` : `💫 <b>${esc(u.name)}</b> is stunned and can't move!`); float(u, asleep ? 'Asleep' : 'Stunned', 'fl-status fl-debuff');
    endOfTurn(u); updateBattle(); later(nextTurn, 950); return;
  }
  if(u.controller === 'player'){ B.awaiting = true; if(!opponents(u).find(e => e.uid === B.target)) retarget(); updateBattle(); if(S.settings.auto) later(autoAct, 500); else if(u.isSquad || u.isPet) sfx('click'); }
  else later(() => { B.fseq = 0; aiAct(u); endOfTurn(u); updateBattle(); later(nextTurn, 850); }, 650);
}
function startOfTurn(u){
  u.turns++;
  for(const k in u.cds) if(u.cds[k] > 0) u.cds[k]--;
  const reg = Math.round(u.maxCp * (CP_REGEN + tv(u, 'cpRegen'))); if(reg > 0) u.cp = Math.min(u.maxCp, u.cp + reg);
  if(tv(u, 'hpRegen')) heal(u, Math.max(1, Math.round(u.maxHp * tv(u, 'hpRegen'))));
  for(const st of [...u.statuses]){
    if(!u.alive) break;
    if(st.s === 'burn' || st.s === 'bleed'){ dealDamage(u, st.val, {cls:'fl-' + st.s, dot:true}); log(`${STATUSES[st.s].icon} ${esc(u.name)} takes ${st.val} ${st.s} damage.`); }
    else if(st.s === 'regen') heal(u, Math.max(1, Math.round(st.val * u.maxHp)));
  }
}
function endOfTurn(u){ u.statuses.forEach(x => x.dur--); u.statuses = u.statuses.filter(x => x.dur > 0); }
function retarget(){ const n = B.enemies.find(e => e.alive); if(n) B.target = n.uid; }
function getTarget(){ return B.enemies.find(e => e.uid === B.target && e.alive) || B.enemies.find(e => e.alive); }

/* ---- technique rules: cost, cooldown and whether a move can be used right now ---- */
function skillCost(u, s){ return s.cp ? Math.max(1, Math.round(s.cp * (1 - Math.min(0.5, tv(u, 'cpCut'))))) : 0; }
function hpCostOf(u, s){ return s.hpCost ? Math.max(1, Math.round(u.maxHp * s.hpCost * (1 - tv(u, 'hpCostCut')))) : 0; }
const skillCd = (u, s) => s.cd >= 2 ? Math.max(1, s.cd - tv(u, 'cdCut')) : s.cd;
const canUse = (u, s) => (u.cds[s.id] || 0) <= 0 && u.cp >= skillCost(u, s) && !hasStatus(u, 'silence') && (!s.hpCost || u.hp > hpCostOf(u, s) + 1);
function whyNot(u, s){
  if((u.cds[s.id] || 0) > 0) return 'Still on cooldown';
  if(hasStatus(u, 'silence')) return 'Silenced: no techniques this turn';
  if(u.cp < skillCost(u, s)) return 'Not enough Chakra. Try Charge.';
  if(s.hpCost && u.hp <= hpCostOf(u, s) + 1) return 'Too wounded to pay the health cost';
  return '';
}
const chargeGain = u => Math.round(u.maxCp * CHARGE.cp) + CHARGE.flat;
const BASIC = {id:'basic', type:'basic', el:null, power:BASIC_POWER, hits:1, cp:0, cd:0, target:'enemy', apply:[]};

/* ---- damage ---- */
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
    d *= 1 + tv(att, 'dmg') + ((att.t && att.t.dmgType && att.t.dmgType[o.type]) || 0);
    if(hasStatus(att, 'empower')) d *= 1.3;
    if(hasStatus(att, 'frenzy')) d *= 1.5;
    if(hasStatus(att, 'weaken')) d *= 0.75;
    if(hasStatus(def, 'guard') && !o.pierce) d *= 0.65;
    if(hasStatus(def, 'expose')) d *= 1.25;
    if(hasStatus(def, 'frenzy')) d *= 1.2;
    if(def.hp < def.maxHp * 0.3) d *= 1 + tv(att, 'execute');
    if(att.hp < att.maxHp * 0.35) d *= 1 + tv(att, 'lastStand');
    const crit = Math.random() * 100 < att.crit + (o.critBonus || 0) + (hasStatus(att, 'focus') ? 25 : 0);
    if(crit) d *= 1.5 + tv(att, 'critDmg');
    d = Math.max(1, Math.round(d));
    dealDamage(def, d, {crit, em});
    if(att.side === 'ally' && att.controller === 'player'){ if(crit) S.counters.crits++; if(em > 1) S.counters.strong++; }
    log(`${esc(att.name)} hits ${esc(def.name)} for <b>${d}</b>${crit ? ' — critical!' : ''}${em > 1 ? ' (strong element)' : em < 1 ? ' (weak element)' : ''}`);
    const back = (hasStatus(att, 'vamp') ? 0.35 : 0) + tv(att, 'lifesteal') + (o.leech || 0);
    if(back && att.alive) heal(att, Math.max(1, Math.round(d * back)));
    landed = true;
  }
  return landed;
}
function dealDamage(u, d, o = {}){
  if(!u.alive) return;
  if(d >= u.hp && tv(u, 'undying') && !u.usedUndying){ // Second Wind: refuse to fall, once
    u.usedUndying = true; d = u.hp - 1; float(u, '🌙 Second Wind', 'fl-status fl-buff'); log(`🌙 <b>${esc(u.name)}</b> refuses to fall!`);
    u.hp = Math.max(1, u.hp - d); heal(u, Math.round(u.maxHp * 0.3)); return;
  }
  u.hp = Math.max(0, u.hp - d);
  if(!o.dot && hasStatus(u, 'sleep')) u.statuses = u.statuses.filter(x => x.s !== 'sleep');
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
// Illusions are harder to shrug off with talents, and bosses half-resist the two that would trivialise them.
function statusChance(u, s, a, tg){
  let ch = a.chance == null ? 1 : a.chance;
  if(s.type === 'genjutsu') ch += tv(u, 'statusChance');
  if(tg && tg.boss && (a.s === 'sleep' || a.s === 'confuse')) ch *= 0.5;
  return Math.min(1, ch);
}
// A confused fighter sometimes lashes out at a random fighter on its own side.
function redirect(u, t){
  if(!hasStatus(u, 'confuse') || Math.random() >= 0.5) return t;
  const pool = friends(u), n = pool[Math.floor(Math.random() * pool.length)];
  if(!n) return t;
  log(`😵 <b>${esc(u.name)}</b> is confused and lashes out at ${esc(n.name)}!`); float(u, 'Confused', 'fl-status fl-debuff');
  return n;
}

/* ---- actions ---- */
function doBasic(u, t){ if(!t) return; t = redirect(u, t); anim(u, 'lunge'); log(`<b>${esc(u.name)}</b> attacks.`); attack(u, t, {power:BASIC_POWER, type:'basic'}); }
function doCharge(u){
  anim(u, 'charge'); log(`🌀 <b>${esc(u.name)}</b> gathers chakra${CHARGE.guard ? ' and braces' : ''}.`);
  restoreCp(u, chargeGain(u)); if(CHARGE.guard) applyStatus(u, 'guard', 1, 0, u);
}
function useSkill(u, s, t){
  u.cp -= skillCost(u, s); u.cds[s.id] = skillCd(u, s) + 1;
  if(s.hpCost){ const hc = hpCostOf(u, s); u.hp = Math.max(1, u.hp - hc); float(u, `-${hc} HP`, 'fl-dmg fl-self'); }
  if(u.side === 'ally' && u.controller === 'player') S.counters.skills++; sfx('skill');
  float(u, `${s.icon} ${s.name}`, 'fl-skill');
  log(`<b>${esc(u.name)}</b> uses <b style="color:${skillColor(s)}">${s.name}</b>!${s.hpCost ? ' ☠️ It costs blood.' : ''}`);
  const self = s.target === 'self', ally = s.target === 'ally' ? mostWounded(u) : null;
  if(!self && !ally && s.target === 'enemy') t = redirect(u, t);
  const targets = self || ally ? [] : s.target === 'allEnemies' ? opponents(u) : [t && t.alive ? t : opponents(u)[0]];
  if(s.power) anim(u, 'lunge'); else anim(u, 'charge');
  const gen = s.type === 'genjutsu';
  for(const tg of targets){
    if(!tg) continue;
    const landed = s.power ? attack(u, tg, {power:s.power, hits:s.hits, el:s.el, type:s.type, critBonus:s.critBonus, dodgeMult:0.6, pierce:s.pierce, leech:s.leech}) : true;
    if(landed) for(const a of s.apply || []) if(a.on !== 'self' && Math.random() < statusChance(u, s, a, tg)) applyStatus(tg, a.s, a.dur + (gen ? tv(u, 'genDur') : 0), a.pow, u);
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

/* ---- how much is a move worth? One value model shared by allied AI, auto-battle, and the auto-loadout picker ----
   Units are "points of Power": a plain attack is worth about 1. */
const STATUS_WORTH = {stun:1.1, sleep:1.1, slow:0.18, weaken:0.28, expose:0.3, confuse:0.45, blind:0.35, silence:0.4,
  empower:0.3, guard:0.3, haste:0.22, regen:0, frenzy:0.4, vamp:0.25, focus:0.2, evasion:0.25};
// average damage of one hit, ignoring luck and crits
function hitDamage(u, s, t){
  let d = u.atk * (s.power == null ? BASIC_POWER : s.power);
  if(t) d *= elemMult(s.el, t.el);
  if(s.el && u.elemBoost === s.el) d *= 1 + u.elemPct;
  d *= 1 + tv(u, 'dmg') + ((u.t && u.t.dmgType && u.t.dmgType[s.type]) || 0);
  if(hasStatus(u, 'empower')) d *= 1.3;
  if(hasStatus(u, 'frenzy')) d *= 1.5;
  if(hasStatus(u, 'weaken')) d *= 0.75;
  if(t){ if(hasStatus(t, 'guard') && !s.pierce) d *= 0.65; if(hasStatus(t, 'expose')) d *= 1.25; if(hasStatus(t, 'frenzy')) d *= 1.2; }
  return d;
}
// what the battle screen promises: expected damage to one target, crits included
function previewDamage(u, s, t){
  if(!s.power) return 0;
  const crit = Math.min(1, (u.crit + (s.critBonus || 0) + (hasStatus(u, 'focus') ? 25 : 0)) / 100);
  return Math.round(hitDamage(u, s, t) * s.hits * (1 + crit * (0.5 + tv(u, 'critDmg'))));
}
function moveValue(u, s, t, foes){
  const atk = Math.max(1, u.atk), aoe = s.target === 'allEnemies', nT = aoe ? Math.min(3, Math.max(1, foes.length)) : 1;
  let v = 0;
  if(s.power){
    const crit = Math.min(1, (u.crit + (s.critBonus || 0)) / 100), dmg = hitDamage(u, s, t) * s.hits * (1 + crit * 0.5) * 0.93 / atk * nT;
    v += dmg; if(s.leech) v += dmg * s.leech * 0.5;
  }
  for(const a of s.apply || []){
    const ch = a.chance == null ? 1 : a.chance, self = a.on === 'self' || s.target === 'self' || s.target === 'ally';
    const tgt = self ? (s.target === 'ally' ? mostWounded(u) : u) : t; if(!tgt) continue;
    let w;
    if(a.s === 'burn' || a.s === 'bleed') w = (a.pow || 0.3) * a.dur * 0.9;
    else if(a.s === 'regen') w = (a.pow || 0.05) * tgt.maxHp * a.dur / atk * 0.5;
    else w = (STATUS_WORTH[a.s] || 0.2) * a.dur;
    if(hasStatus(tgt, a.s)) w *= 0.15;                                          // already has it
    if(!self && STATUSES[a.s].kind === 'debuff' && tgt.hp < tgt.maxHp * 0.15) w *= 0.3; // about to fall anyway
    if(!self && tgt.boss && (a.s === 'sleep' || a.s === 'confuse')) w *= 0.5;
    v += w * ch * (aoe ? nT : 1);
  }
  if(s.heal){
    const who = s.target === 'ally' ? mostWounded(u) : u, urgent = 1 + clamp((0.5 - who.hp / who.maxHp) * 3, 0, 1.5);
    v += Math.min(who.maxHp - who.hp, s.heal * who.maxHp) / atk * 0.9 * urgent;
  }
  if(s.cpRestore) v += Math.min(u.maxCp - u.cp, s.cpRestore * u.maxCp) / atk * 0.15;
  if(s.cleanse) v += u.statuses.filter(x => STATUSES[x.s].kind === 'debuff').length * 0.5;
  if(s.hpCost) v -= hpCostOf(u, s) / atk * 0.45 * (u.hp < u.maxHp * 0.5 ? 2 : 1);
  // Chakra is paid back by Charging, which costs a turn; plenty of Chakra makes a technique nearly free
  v -= skillCost(u, s) / chargeGain(u) * 0.8 * clamp(1.2 - u.cp / u.maxCp, 0.35, 1);
  return v;
}
// Picks a move: {k:'skill', s} | {k:'attack'} | {k:'charge'} | {k:'item', id}
function smartChoose(u, t){
  const foes = opponents(u), pool = [];
  for(const id of u.skills){
    const s = SKILL[id]; if(!s || !canUse(u, s)) continue;
    if((s.target === 'enemy' || s.target === 'allEnemies') && !foes.length) continue;
    pool.push({k:'skill', s, v:moveValue(u, s, t, foes)});
  }
  const basic = {k:'attack', v:moveValue(u, BASIC, t, foes)}; pool.push(basic);
  if(!u.isPet && u.side === 'ally' && u.hp < u.maxHp * 0.3 && !pool.some(m => m.s && m.s.heal && m.v > 0)){
    const pot = ['moon_elixir', 'g_salve', 'salve'].find(id => S.inventory[id] > 0 && S.char.level >= ITEM[id].lvl);
    if(pot) return {k:'item', id:pot};
  }
  pool.sort((a, b) => b.v - a.v);
  const best = pool[0];
  if(best.v < basic.v * 1.12 && u.cp < u.maxCp * 0.35) return {k:'charge'};
  return best;
}
function perform(u, ch, t){
  if(ch.k === 'skill') useSkill(u, ch.s, t);
  else if(ch.k === 'item') useItem(u, ch.id, t);
  else if(ch.k === 'charge') doCharge(u);
  else doBasic(u, t);
}
// Foes (and ghosts) pick their moves with a little randomness; your side's AI uses the value model.
function aiAct(u){
  const foes = opponents(u); if(!foes.length) return;
  if(u.side === 'ally'){ const t = getTarget(); return perform(u, smartChoose(u, t), t); }
  const t = Math.random() < 0.7 ? foes.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b)) : foes[Math.floor(Math.random() * foes.length)];
  const ready = u.skills.map(id => SKILL[id]).filter(s => s && canUse(u, s));
  const hurt = mostWounded(u);
  const healS = ready.find(s => s.heal && (s.target === 'ally' ? hurt.hp < hurt.maxHp * 0.55 : u.hp < u.maxHp * 0.45));
  if(healS && Math.random() < 0.8) return useSkill(u, healS, t);
  const buff = ready.find(s => (s.target === 'self' || s.target === 'ally') && !s.heal && !(s.apply || []).every(a => hasStatus(s.target === 'ally' ? hurt : u, a.s)));
  if(buff && Math.random() < 0.35) return useSkill(u, buff, t);
  const off = ready.filter(s => s.target === 'enemy' || s.target === 'allEnemies');
  if(off.length && Math.random() < 0.55) return useSkill(u, off[Math.floor(Math.random() * off.length)], t);
  if(u.cp < u.maxCp * 0.3 && Math.random() < 0.4) return doCharge(u);
  doBasic(u, t);
}
// Turns a unit over to the AI (or back to you) in the middle of a battle.
function charOfUnit(u){ return u.isPet ? (u.owner === 'leader' ? S.char : recruitById(u.owner)) : u.key === 'leader' ? S.char : recruitById(u.key); }
function setAuto(u, auto){
  if(!B || !u || u.side !== 'ally' || u.key === 'leader') return;
  const ch = charOfUnit(u); if(ch){ if(u.isPet) ch.petAuto = auto; else ch.auto = auto; }
  u.controller = auto ? 'ai' : 'player';
  if(auto && B.active === u && B.awaiting) playerAct(x => { const t = getTarget(); perform(x, smartChoose(x, t), t); });
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
  const petUnits = B ? B.allies.filter(a => a.isPet) : [], squadUnits = B ? B.allies.filter(a => a.isSquad) : [];
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
  if(win || RUN.kind === 'event') for(const pu of petUnits){
    const owner = charOfUnit(pu); if(!owner || !owner.pet) continue;
    owner.bond[owner.pet] = (owner.bond[owner.pet] || 0) + 1;
    const b = owner.bond[owner.pet];
    if(b % 5 === 0 && bondLevel(b) <= 10) res.lines.push(`🐾 ${esc(PET[owner.pet].name)}${owner === c ? '' : ` (${esc(owner.name)}'s)`} reached bond level ${bondLevel(b)}!`);
  }
  if(res.clanUp) res.lines.push(`🎖️ Clan rank up: ${CLAN_TIERS[res.clanUp].name}! Clan perks grow stronger.`);
  c.gold += res.gold;
  res.items.forEach(it => addInv(it.id, 1));
  res.ups = gainXp(res.xp);
  res.squadUps = [];
  if(win || RUN.kind === 'event') for(const su of squadUnits){
    const r = S.squad.roster.find(x => x.id === su.key); if(!r) continue;
    const {ups, learned} = progressRecruit(r, res.xp); res.lines.push(`👥 ${esc(r.name)} +${res.xp} XP`);
    if(ups.length) res.squadUps.push({id:r.id, name:r.name, level:r.level, gained:ups.length * POINTS_PER_LEVEL, learned:learned.map(s => s.id)});
  }
  const nr = rankOf(c.level); res.newRank = nr !== oldRank ? nr : null;
  res.newSkills = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl > oldLv && s.lvl <= c.level);
  res.newTalent = TALENT_TIERS.filter(lv => lv > oldLv && lv <= c.level).length;
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
