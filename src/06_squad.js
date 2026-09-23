
/* =====================================================================
   SQUAD: recruit ninja, train them, and command them in battle.
   Online: hire echoes of real players, and your squad travels with your echo.
   ===================================================================== */
const MAX_ROSTER = 6, MAX_SQUAD = 2, TRAIN_PER_DAY = 3, SQUAD_LVL = 3;
function defaultSquad(){ return {roster:[], active:[], pool:[], poolDay:'', train:{day:'', n:{}}, hired:[], hireClaims:0}; }
const activeSquad = () => (S && S.squad ? S.squad.active : []).map(id => S.squad.roster.find(r => r.id === id)).filter(Boolean);
const recruitById = id => S.squad.roster.find(r => r.id === id);
const hireCost = (l, real) => real ? 150 + l * 50 : 100 + l * 40;
const trainCost = r => 20 + r.level * 15;
const trainsLeft = r => { const t = S.squad.train; if(t.day !== todayKey()){ t.day = todayKey(); t.n = {}; } return TRAIN_PER_DAY - (t.n[r.id] || 0); };
const recruitSkillPrice = (r, s) => s.el === r.element ? s.price : s.price * 2;
const newId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
function asRecruit(g, origin){
  g.id = newId(); g.origin = origin; g.xp = 0; g.points = 0; g.pet = null; g.pets = []; g.bond = {}; g.clan = null; g.squad = []; delete g.diff;
  g.bound = {}; for(const sl of SLOTS) if(g.equip[sl]) g.bound[sl] = true;  // starting gear is bound to the recruit
  return g;
}
function syncPool(force){
  const q = S.squad;
  if(!force && q.poolDay === todayKey() && q.pool.length) return;
  const L = S.char.level, els = [...EL_ORDER].sort(() => Math.random() - 0.5);
  q.pool = [L - 2, L - 1, L].map((l, i) => { const g = makeGhost(Math.max(1, l), 0); g.element = els[i]; return asRecruit(normChar(Object.assign(g, {skills:[], loadout:[]}, {skills:SKILLS.filter(s => s.el === els[i] && s.lvl <= Math.max(1, l) && !s.enemyOnly && !s.petOnly).slice(-3).map(s => s.id)})), 'npc'); });
  q.pool.forEach(r => { r.loadout = r.skills.slice(0, MAX_LOADOUT); r.cost = hireCost(r.level); });
  q.poolDay = todayKey();
}
function gainXpFor(r, amt){
  const ups = [], cap = S.char.level;
  r.xp += amt;
  while(r.level < cap && r.xp >= xpToNext(r.level)){ r.xp -= xpToNext(r.level); r.level++; r.points += POINTS_PER_LEVEL; ups.push(r.level); }
  if(r.level >= cap) r.xp = Math.min(r.xp, xpToNext(r.level) - 1);
  return ups;
}
// Recruits grow into their element: the lodge master teaches them each new technique of their element for free
// as they reach its level. With auto-upgrade on (the default) the new technique takes the loadout slot of their weakest one.
const recruitTechs = r => SKILLS.filter(s => s.el === r.element && !s.enemyOnly && !s.petOnly && s.lvl <= r.level);
function learnNewTechs(r){
  const learned = recruitTechs(r).filter(s => !r.skills.includes(s.id));
  for(const s of learned){
    r.skills.push(s.id);
    if(r.autoTech === false) continue;
    if(r.loadout.length < MAX_LOADOUT){ r.loadout.push(s.id); continue; }
    const weakest = r.loadout.reduce((w, id) => SKILL[id].lvl < SKILL[w].lvl ? id : w);
    if(SKILL[weakest].lvl < s.lvl) r.loadout[r.loadout.indexOf(weakest)] = s.id;
  }
  return learned;
}
// Levels a recruit up and teaches any techniques they've grown into. Returns {ups, learned}.
function progressRecruit(r, amt){
  const ups = gainXpFor(r, amt);
  return {ups, learned:ups.length ? learnNewTechs(r) : []};
}
// An echo of a real player joins at no higher than your level, with points and techniques scaled to fit.
function recruitFromEcho(e){
  let g; try{ g = normChar(JSON.parse(e.build)); }catch(err){ return null; }
  const L = Math.min(g.level, S.char.level), total = g.alloc.hp + g.alloc.cp + g.alloc.agi, budget = (L - 1) * POINTS_PER_LEVEL, k = total ? Math.min(1, budget / total) : 0;
  g.alloc = {hp:Math.floor(g.alloc.hp * k), cp:Math.floor(g.alloc.cp * k), agi:Math.floor(g.alloc.agi * k)};
  g.level = L; g.skills = g.skills.filter(id => SKILL[id].lvl <= L); if(!g.skills.length) g.skills = [starterSkill(g.element)];
  g.loadout = g.loadout.filter(id => g.skills.includes(id)); if(!g.loadout.length) g.loadout = g.skills.slice(0, MAX_LOADOUT);
  for(const sl of SLOTS) if(g.equip[sl] && ITEM[g.equip[sl]].lvl > L) g.equip[sl] = null;
  g = asRecruit(g, 'echo'); g.fromId = e.id; g.fromName = String(e.name || '').slice(0, 16); g.archetype = 'Echo of a real ninja';
  return g;
}
function addToRoster(r){
  const q = S.squad; if(q.roster.length >= MAX_ROSTER) throw new Error(`Your roster is full (${MAX_ROSTER}). Dismiss someone first.`);
  r.autoTech = true; learnNewTechs(r);
  q.roster.push(r); if(q.active.length < MAX_SQUAD) q.active.push(r.id);
}
function hireFromPool(i){
  syncPool(); const r = S.squad.pool[i]; if(!r) throw new Error('No such candidate');
  if(S.char.level < SQUAD_LVL) throw new Error(`The lodge opens at level ${SQUAD_LVL}`);
  if(S.char.gold < r.cost) throw new Error('Not enough gold');
  addToRoster(r); S.char.gold -= r.cost; S.squad.pool.splice(i, 1); return `${r.name} joined your squad`;
}
function trainRecruit(r){
  if(!r) throw new Error('No such recruit');
  if(r.level >= S.char.level) throw new Error(`${r.name} can't outgrow the leader. Level up first!`);
  if(trainsLeft(r) <= 0) throw new Error(`${r.name} is worn out. Train again tomorrow.`);
  const cost = trainCost(r); if(S.char.gold < cost) throw new Error('Not enough gold');
  S.char.gold -= cost; S.squad.train.n[r.id] = (S.squad.train.n[r.id] || 0) + 1;
  const xp = Math.round(xpToNext(r.level) * 0.35), {ups, learned} = progressRecruit(r, xp);
  return `${r.name} trained hard: +${xp} XP${ups.length ? `, reached level ${r.level}!` : ''}${learned.length ? ` Learned ${learned.map(s => s.name).join(', ')}.` : ''}`;
}
function unequipRecruit(r, sl){
  const id = r.equip[sl]; if(!id) return;
  if(!r.bound[sl]) addInv(id, 1);
  r.equip[sl] = null; delete r.bound[sl];
}
function equipRecruit(r, id){
  const it = ITEM[id]; if(!it || !SLOTS.includes(it.slot)) throw new Error('Not equipment');
  if(!(S.inventory[id] > 0)) throw new Error('Not in your pack');
  if(r.level < it.lvl) throw new Error(`${r.name} needs level ${it.lvl}`);
  unequipRecruit(r, it.slot); addInv(id, -1); r.equip[it.slot] = id; return `${r.name} equipped ${it.name}`;
}
function learnRecruit(r, id){
  const s = SKILL[id]; if(!s || s.enemyOnly || s.petOnly) throw new Error('No such technique');
  if(r.skills.includes(id)) throw new Error('Already learned'); if(r.level < s.lvl) throw new Error(`${r.name} needs level ${s.lvl}`);
  const cost = recruitSkillPrice(r, s); if(S.char.gold < cost) throw new Error('Not enough gold');
  S.char.gold -= cost; r.skills.push(id); if(r.loadout.length < MAX_LOADOUT) r.loadout.push(id); return `${r.name} learned ${s.name}`;
}
function allocRecruit(r, a){
  const t = (a.hp | 0) + (a.cp | 0) + (a.agi | 0); if(t > r.points || t < 0) throw new Error(`${r.name} has ${r.points} points`);
  for(const k of ['hp','cp','agi']){ const v = Math.max(0, a[k] | 0); r.alloc[k] += v; r.points -= v; } return charStats(r);
}
// Splits unspent points by element (fire leans agility, earth health, and so on). Works for the leader too.
function autoAllocRecruit(r){
  const w = {fire:[1,1,2], wind:[1,1,3], lightning:[1,2,2], earth:[3,1,1], water:[2,2,1]}[r.element], t = w[0] + w[1] + w[2];
  const a = {hp:Math.round(r.points * w[0] / t), cp:Math.round(r.points * w[1] / t)}; a.agi = r.points - a.hp - a.cp; return a;
}
function hiredBy(){ // how many other players have recruited your echo
  if(!NET.uid) return 0;
  return (NET.hires || []).filter(h => h.id !== NET.uid && Array.isArray(h.ids) && h.ids.includes(NET.uid)).length;
}
function publishHires(){
  if(!NET.db || !NET.uid) return;
  NET.db.doc('hires/' + NET.uid).set({ids:S.squad.hired.slice(-50), name:S.char.name, updatedAt:Date.now()}).catch(() => {});
}

/* ---------------- Screens ---------------- */
function hireHTML(){
  if(!NET.db) return '<p class="muted">Join a multiplayer server in the Village Square to hire echoes of real players here.</p>';
  const c = S.char, mine = new Set(S.squad.roster.map(r => r.fromId).filter(Boolean));
  const echoes = NET.echoes.filter(e => e.id !== NET.uid && !mine.has(e.id)).slice(0, 8);
  if(!echoes.length) return '<p class="muted">No other players have posted an echo yet.</p>';
  return echoes.map(e => `<div class="lb"><span class="lb-n">${ELEMENTS[e.element] ? ELEMENTS[e.element].icon : '•'}</span><span><b>${esc(String(e.name).slice(0, 16))}</b> <small class="muted">Lv ${e.level | 0}${e.level > c.level ? `, joins at Lv ${c.level}` : ''}</small></span><span class="lb-r">🪙 ${hireCost(Math.min(e.level | 0, c.level), true)}</span><button class="btn sm primary" data-act="hireEcho" data-arg="${esc(e.id)}">Hire</button></div>`).join('');
}
function fameHTML(){
  if(!NET.db) return '';
  const hb = hiredBy(), claim = Math.max(0, hb - S.squad.hireClaims);
  return `<div class="panel hl-panel" style="margin-top:12px">🌟 Your echo has been recruited by <b>${hb}</b> other ninja.${claim ? ` <button class="btn sm primary" data-act="claimHires">Claim 🪙 ${claim * 60} + 🔴 ${claim * 2}</button>` : ''}</div>`;
}
function recruitCardHTML(r, mode, i){
  const st = charStats(r), act = S.squad.active.includes(r.id), E = ELEMENTS[r.element];
  const tags = `<div class="tags" style="margin-top:6px"><span class="tag">❤️ ${st.maxHp}</span><span class="tag">🔷 ${st.maxCp}</span><span class="tag">💨 ${st.agi}</span><span class="tag">⚔️ ${st.atk}</span></div>
    <div class="tags" style="margin-top:4px">${r.loadout.map(id => `<span class="tag">${SKILL[id].icon} ${SKILL[id].name}</span>`).join('')}</div>`;
  let acts = '';
  if(mode === 'roster'){
    const tl = trainsLeft(r), capped = r.level >= S.char.level;
    acts = `${act ? '<span class="owned">✓ In squad</span>' : ''}
      <button class="btn sm ${act ? '' : 'primary'}" data-act="squadToggle" data-arg="${r.id}">${act ? 'Bench' : 'Add to squad'}</button>
      <button class="btn sm" data-act="trainR" data-arg="${r.id}" ${capped || tl <= 0 || S.char.gold < trainCost(r) ? 'disabled' : ''}>${capped ? 'At leader level' : `Train 🪙${trainCost(r)} (${tl} left)`}</button>
      <button class="btn sm" data-act="manageR" data-arg="${r.id}">Manage${r.points ? ` (+${r.points})` : ''}</button>`;
  } else if(mode === 'pool') acts = `<button class="btn sm primary" data-act="hireR" data-arg="${i}" ${S.char.gold < r.cost ? 'disabled' : ''}>Recruit for 🪙 ${r.cost}</button>`;
  return `<article class="panel ghost rc ${act ? 'active-r' : ''}"><div class="ps">${ninjaSVG(r.look, gearLooks(r), {scarf:E.color})}</div>
    <div><h3>${esc(r.name)} <small class="muted" style="font-family:var(--body);font-size:12.5px">Lv ${r.level}</small></h3>
      <small class="muted">${r.origin === 'echo' ? `Echo of ${esc(r.fromName || 'a real ninja')}` : esc(r.archetype || 'Recruit')}</small>
      <div class="gm"><span class="chip" style="--c:${E.color}">${E.icon} ${E.name}</span></div>
      ${mode === 'roster' ? `<div class="xpline" style="margin:6px 0 0"><span>XP</span><span class="bar xp thin"><i style="width:${r.level >= MAX_LEVEL ? 100 : r.xp / xpToNext(r.level) * 100}%"></i></span><span>${r.xp}/${xpToNext(r.level)}</span></div>` : ''}
      ${tags}</div>
    <div class="acts">${acts}</div></article>`;
}
function squadScreen(){
  const c = S.char; if(c.level < SQUAD_LVL) return lockedScreen('🎌 Squad Lodge', SQUAD_LVL, 'The lodge master only lends recruits to ninja with a few missions behind them.');
  syncPool(); persist();
  const q = S.squad, act = activeSquad();
  return `<section><h2 class="scr-title">🎌 Squad Lodge</h2>
    <p class="note">Bring up to ${MAX_SQUAD} squadmates into every battle and command their turns yourself (or let Auto do it). They earn the same XP you do, share your clan perks, and can't outlevel you. Missions send tougher foes when your squad is bigger.</p>
    <div class="panel"><h3>Battle squad</h3><div class="squad-row">
      <div class="sq-slot lead"><div class="sq-sp">${playerSprite()}</div><b>${esc(c.name)}</b><small>Leader, Lv ${c.level}</small></div>
      ${Array.from({length:MAX_SQUAD}, (_, i) => { const r = act[i]; return r ? `<button class="sq-slot" data-act="manageR" data-arg="${r.id}"><div class="sq-sp">${ninjaSVG(r.look, gearLooks(r), {scarf:ELEMENTS[r.element].color})}</div><b>${esc(r.name)}</b><small>${ELEMENTS[r.element].icon} Lv ${r.level}</small></button>` : `<div class="sq-slot empty"><div class="sq-sp big">＋</div><small>Empty slot</small></div>`; }).join('')}
      ${c.pet ? `<div class="sq-slot"><div class="sq-sp">${petSprite(c.pet)}</div><b>${PET[c.pet].name}</b><small>Pet</small></div>` : ''}
    </div><small class="muted">Team power ${buildPower(c, act)}</small></div>
    <h3 class="sub">Roster (${q.roster.length}/${MAX_ROSTER})</h3>
    <div class="stack">${q.roster.length ? q.roster.map(r => recruitCardHTML(r, 'roster')).join('') : '<div class="panel empty">No recruits yet. Hire one from the board below!</div>'}</div>
    <h3 class="sub">Recruit board</h3>
    <p class="note">New hopefuls arrive every day.</p>
    <div class="stack">${q.pool.length ? q.pool.map((r, i) => recruitCardHTML(r, 'pool', i)).join('') : '<div class="panel empty">Everyone on today\'s board has been hired.</div>'}</div>
    <div style="margin-top:10px"><button class="btn sm" data-act="refreshPool" ${c.gold < 50 ? 'disabled' : ''}>Post a new notice (🪙 50)</button></div>
    <h3 class="sub">Real ninja for hire</h3>
    <div class="panel" id="net-hire">${hireHTML()}</div>
    <div id="net-fame">${fameHTML()}</div>
  </section>`;
}
function recruitScreen(){
  const r = recruitById(UI.recruitId); if(!r) return squadScreen();
  const st = charStats(r), E = ELEMENTS[r.element], gear = ITEMS.filter(i => SLOTS.includes(i.slot) && S.inventory[i.id] > 0);
  const row = (k, ic, name, val) => `<div class="srow"><span class="sic">${ic}</span><div><b>${name}</b><small>Points spent: ${r.alloc[k]}</small></div><span class="sv">${val}</span><button class="plus" data-act="allocR" data-arg="${r.id}:${k}" ${r.points ? '' : 'disabled'} aria-label="Add a point to ${name}">+</button></div>`;
  const skills = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && (s.el === r.element || r.skills.includes(s.id)) && s.lvl <= r.level + 5);
  return `<section><h2 class="scr-title">🎌 ${esc(r.name)}</h2>
    <button class="btn sm ghost" data-act="go" data-arg="squad">← Back to the lodge</button>
    <div class="char-grid" style="margin-top:10px">
      <div class="panel doll"><div class="doll-sprite">${ninjaSVG(r.look, gearLooks(r), {scarf:E.color})}</div>
        <div class="rank-line"><b>Level ${r.level}</b><small>${r.origin === 'echo' ? `Echo of ${esc(r.fromName || 'a real ninja')}` : esc(r.archetype || 'Recruit')}</small></div>
        <span class="chip" style="--c:${E.color}">${E.icon} ${E.name}</span></div>
      <div class="panel"><div class="pts">${r.points ? `<b>${r.points}</b> points to spend` : 'No unspent points'} ${r.points ? `<button class="btn sm" data-act="autoAllocR" data-arg="${r.id}">Auto-assign</button>` : ''}</div>
        ${row('hp','❤️','Health', st.maxHp)}${row('cp','🔷','Chakra', st.maxCp)}${row('agi','💨','Agility', st.agi)}
        <div class="derived"><span>⚔️ Power ${st.atk}</span><span>🎯 Crit ${st.crit.toFixed(1)}%</span></div></div>
    </div>
    <h3 class="sub">Equipment</h3>
    <div class="slots">${SLOTS.map(sl => { const it = ITEM[r.equip[sl]]; return `<div class="panel slot"><div class="item-ic">${it ? it.icon : SLOT_INFO[sl].icon}</div>
      <div><small>${SLOT_INFO[sl].name}${it && r.bound[sl] ? ', bound' : ''}</small><b>${it ? it.name : 'Empty'}</b>${it ? `<small class="bonus">${fmtBonus(it.bonus)}</small>` : ''}</div>
      ${it ? `<button class="btn sm" data-act="unequipR" data-arg="${r.id}:${sl}" title="${r.bound[sl] ? 'Bound gear is discarded when removed' : ''}">${r.bound[sl] ? 'Discard' : 'Remove'}</button>` : ''}</div>`; }).join('')}</div>
    ${gear.length ? `<p class="note" style="margin-top:10px">Equip from your pack (starting gear is bound to the recruit and is discarded when replaced):</p><div class="stack">${gear.map(it => `<div class="panel item"><div class="item-ic">${it.icon}</div><div class="item-b"><b>${it.name} ×${S.inventory[it.id]}</b><small class="bonus">${fmtBonus(it.bonus)}</small>${r.level < it.lvl ? `<small>Needs level ${it.lvl}</small>` : ''}</div><div class="item-act"><button class="btn sm primary" data-act="equipR" data-arg="${r.id}:${it.id}" ${r.level < it.lvl ? 'disabled' : ''}>Equip</button></div></div>`).join('')}</div>` : ''}
    <h3 class="sub">Techniques (${r.loadout.length}/${MAX_LOADOUT} equipped)</h3>
    <div class="panel" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><small class="muted">${esc(r.name)} learns each new ${E.name} technique for free on reaching its level.</small>
      <div class="seg" role="group" aria-label="Auto-upgrade techniques"><button class="${r.autoTech !== false ? 'on' : ''}" data-act="autoTechR" data-arg="${r.id}:1" aria-pressed="${r.autoTech !== false}">Auto-equip new</button><button class="${r.autoTech === false ? 'on' : ''}" data-act="autoTechR" data-arg="${r.id}:0" aria-pressed="${r.autoTech === false}">I'll choose</button></div></div>
    <div class="stack">${skills.map(s => { const own = r.skills.includes(s.id), inLo = r.loadout.includes(s.id), lock = r.level < s.lvl, pr = recruitSkillPrice(r, s);
      return `<article class="panel skill ${lock && !own ? 'locked' : ''}" style="--c:${ELEMENTS[s.el].color}"><div class="sk-ic">${s.icon}</div>
        <div class="sk-body"><h4>${s.name}<small>Lv ${s.lvl}</small></h4><div class="tags"><span class="tag cp">${s.cp} CP</span>${skillTags(s).map(t => `<span class="tag">${t}</span>`).join('')}</div></div>
        <div class="sk-act">${own ? `<button class="btn sm ${inLo ? '' : 'primary'}" data-act="loadR" data-arg="${r.id}:${s.id}">${inLo ? 'Unequip' : 'Equip'}</button>` : lock ? `<button class="btn sm" disabled>🔒 Lv ${s.lvl}</button>` : `<button class="btn sm primary" data-act="learnR" data-arg="${r.id}:${s.id}" ${S.char.gold < pr ? 'disabled' : ''}>Teach for 🪙 ${pr}</button>`}</div></article>`; }).join('')}</div>
    <div style="margin-top:16px"><button class="btn bad sm" data-act="dismissR" data-arg="${r.id}">Dismiss ${esc(r.name)}</button></div>
  </section>`;
}

/* ---------------- Actions ---------------- */
const tryDo = f => { try{ const m = f(); persist(); render(); if(m) toast(m); }catch(e){ toast(e.message); } };
const splitArg = a => { const i = a.indexOf(':'); return [a.slice(0, i), a.slice(i + 1)]; };
const SQUAD_ACT = {
  squadToggle: id => tryDo(() => { const q = S.squad, i = q.active.indexOf(id); if(i >= 0){ q.active.splice(i, 1); return 'Benched'; } if(q.active.length >= MAX_SQUAD) throw new Error(`Squad is full (${MAX_SQUAD}). Bench someone first.`); q.active.push(id); return `${recruitById(id).name} joins the squad`; }),
  trainR: id => tryDo(() => { const m = trainRecruit(recruitById(id)); sfx('coin'); return m; }),
  manageR: id => { UI.recruitId = id; go('recruit'); },
  allocR: a => tryDo(() => { const [id, k] = splitArg(a), r = recruitById(id); allocRecruit(r, {[k]:1}); }),
  autoAllocR: id => tryDo(() => { const r = recruitById(id); allocRecruit(r, autoAllocRecruit(r)); return 'Points assigned'; }),
  equipR: a => tryDo(() => { const [id, item] = splitArg(a); return equipRecruit(recruitById(id), item); }),
  unequipR: a => tryDo(() => { const [id, sl] = splitArg(a); unequipRecruit(recruitById(id), sl); }),
  learnR: a => tryDo(() => { const [id, sk] = splitArg(a); return learnRecruit(recruitById(id), sk); }),
  autoTechR: a => tryDo(() => { const [id, v] = splitArg(a), r = recruitById(id); r.autoTech = v === '1'; if(r.autoTech) learnNewTechs(r); return r.autoTech ? `${r.name} will equip new techniques automatically` : `You'll pick ${r.name}'s techniques`; }),
  loadR: a => tryDo(() => { const [id, sk] = splitArg(a), r = recruitById(id), i = r.loadout.indexOf(sk); if(i >= 0) r.loadout.splice(i, 1); else { if(r.loadout.length >= MAX_LOADOUT) throw new Error('Loadout full'); r.loadout.push(sk); } }),
  dismissR: id => { const r = recruitById(id); showModal(`Dismiss ${esc(r.name)}?`, '<p>They leave the lodge for good. Gear you gave them returns to your pack; bound gear leaves with them.</p>', [{label:'Keep them', act:'closeModal'}, {label:'Dismiss', act:'doDismissR', arg:id, cls:'bad'}]); },
  doDismissR: id => { closeModal(); const q = S.squad, r = recruitById(id); if(!r) return; for(const sl of SLOTS) unequipRecruit(r, sl); q.roster = q.roster.filter(x => x.id !== id); q.active = q.active.filter(x => x !== id); persist(); go('squad'); toast(`${r.name} has left`); },
  hireR: i => tryDo(() => hireFromPool(+i)),
  refreshPool: () => tryDo(() => { if(S.char.gold < 50) throw new Error('Not enough gold'); S.char.gold -= 50; syncPool(true); return 'New recruits posted'; }),
  hireEcho: id => tryDo(() => {
    const e = NET.echoes.find(x => x.id === id); if(!e) throw new Error('That ninja is gone');
    const r = recruitFromEcho(e); if(!r) throw new Error('That echo could not be read');
    const cost = hireCost(r.level, true); if(S.char.gold < cost) throw new Error('Not enough gold');
    addToRoster(r); S.char.gold -= cost; if(!S.squad.hired.includes(id)) S.squad.hired.push(id); publishHires(); publishEcho();
    return `${r.name}'s echo joined your squad`;
  }),
  claimHires: () => tryDo(() => { const n = Math.max(0, hiredBy() - S.squad.hireClaims); if(!n) return; S.squad.hireClaims += n; S.char.gold += n * 60; S.shards += n * 2; sfx('coin'); return `Fame pays! +${n * 60} gold, +${n * 2} shards`; }),
};

/* ---------------- Momo tools for the squad ---------------- */
GUIDE_TOOLS.push(
  {name:'list_squad', description:'Lists the player\'s recruits (id, level, element, points, in squad or not, trains left today) and today\'s recruit board candidates (index, cost).',
   run:() => { syncPool(); return {roster:S.squad.roster.map(r => ({id:r.id, name:r.name, level:r.level, element:r.element, points:r.points, inSquad:S.squad.active.includes(r.id), trainsLeft:trainsLeft(r), trainCost:trainCost(r), loadout:r.loadout})), candidates:S.squad.pool.map((r, i) => ({index:i, name:r.name, level:r.level, element:r.element, cost:r.cost}))}; }},
  {name:'recruit_ninja', description:'Hires a candidate from today\'s recruit board by index (costs gold). They join the battle squad if a slot is free.', mutates:true,
   schema:{type:'object', properties:{index:{type:'integer'}}, required:['index']}, run:i => hireFromPool(i.index | 0)},
  {name:'train_recruit', description:'Pays gold for a training session that gives a recruit XP (3 per recruit per day, never above the leader\'s level).', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}, required:['id']}, run:i => trainRecruit(recruitById(String(i.id)))},
  {name:'set_squad', description:'Chooses which recruits (up to 2 ids) fight in battles. An empty list means the leader fights alone.', mutates:true,
   schema:{type:'object', properties:{ids:{type:'array', items:{type:'string'}}}, required:['ids']},
   run:i => { const ids = (i.ids || []).map(String).filter(id => recruitById(id)).slice(0, MAX_SQUAD); S.squad.active = [...new Set(ids)]; return activeSquad().map(r => r.name); }},
  {name:'manage_recruit', description:'Improves one recruit: spend their points (hp, cp, agi, or auto:true), teach a technique id (learn), or equip an item id from the pack (equip).', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}, hp:{type:'integer'}, cp:{type:'integer'}, agi:{type:'integer'}, auto:{type:'boolean'}, learn:{type:'string'}, equip:{type:'string'}}, required:['id']},
   run:i => { const r = recruitById(String(i.id)); need(r, 'No such recruit'); const out = [];
     if(i.auto) allocRecruit(r, autoAllocRecruit(r)), out.push('points assigned'); else if(i.hp || i.cp || i.agi) allocRecruit(r, i), out.push('points spent');
     if(i.learn) out.push(learnRecruit(r, String(i.learn))); if(i.equip) out.push(equipRecruit(r, String(i.equip)));
     return `${r.name}: ${out.join(', ') || 'nothing changed'}`; }}
);
