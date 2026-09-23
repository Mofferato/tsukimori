
/* =====================================================================
   EXTRA SYSTEMS: daily quests, login streak, achievements, sound,
   auto-battle, the AI guide (Momo) and online multiplayer.
   ===================================================================== */

/* ---------------- Daily quests & login streak ---------------- */
const QUEST_POOL = [
  {id:'win',     key:'wins',     n:[3,5],  text:n => `Win ${n} battles`},
  {id:'mission', key:'missions', n:[1,3],  text:n => `Complete ${n} mission${n > 1 ? 's' : ''}`},
  {id:'skills',  key:'skills',   n:[8,14], text:n => `Use techniques ${n} times`},
  {id:'crit',    key:'crits',    n:[3,6],  text:n => `Land ${n} critical hits`},
  {id:'strong',  key:'strong',   n:[4,8],  text:n => `Hit foes ${n} times with a strong element`},
  {id:'arena',   key:'arena',    n:[1,2],  text:n => `Win ${n} Echo Arena duel${n > 1 ? 's' : ''}`, lvl:4},
  {id:'event',   key:'event',    n:[1,2],  text:n => `Attack the Crimson Moon boss ${n} time${n > 1 ? 's' : ''}`, lvl:5},
];
function syncDaily(){
  const day = todayKey(), c = S.char;
  if(!S.daily || S.daily.day !== day){
    const pool = QUEST_POOL.filter(q => !q.lvl || c.level >= q.lvl).sort(() => Math.random() - 0.5).slice(0, 3);
    S.daily = {day, quests:pool.map(q => { const n = q.n[0] + Math.floor(Math.random() * (q.n[1] - q.n[0] + 1)); return {id:q.id, key:q.key, n, base:S.counters[q.key] || 0, claimed:false}; })};
  }
}
const questProgress = q => Math.min(q.n, (S.counters[q.key] || 0) - q.base);
const questReward = () => ({gold:40 + S.char.level * 15, xp:Math.round(xpToNext(S.char.level) * 0.08), shards:3});
function claimQuest(i){
  syncDaily(); const q = S.daily.quests[i]; if(!q || q.claimed || questProgress(q) < q.n) return false;
  const r = questReward(); q.claimed = true; S.char.gold += r.gold; S.shards += r.shards; const ups = gainXp(r.xp);
  persist(); toast(`Quest done! +${r.gold} gold, +${r.xp} XP, +${r.shards} shards${ups.length ? `. Level ${S.char.level}!` : ''}`); sfx('win'); return true;
}
function checkLogin(){
  const day = todayKey(), L = S.login;
  if(L.day === day) return;
  const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  L.streak = L.day === y ? L.streak + 1 : 1; L.day = day;
  const d = ((L.streak - 1) % 7) + 1, gold = 30 * d + S.char.level * 5, shards = d === 7 ? 15 : 0;
  S.char.gold += gold; S.shards += shards; persist();
  setTimeout(() => showModal(`Day ${L.streak} login bonus`, `<p>Momo left you a gift at your door: <b>🪙 ${gold}</b>${shards ? ` and <b class="shardline">🔴 ${shards} Moon Shards</b>` : ''}.</p>
    <div class="streak">${[1,2,3,4,5,6,7].map(i => `<span class="${i <= d ? 'on' : ''}">${i === 7 ? '🎁' : '🪙'}<small>Day ${i}</small></span>`).join('')}</div>
    <p class="muted">Log in every day. Day 7 also brings Moon Shards.</p>`, [{label:'Thanks, Momo!', act:'closeModal', cls:'primary'}]), 400);
}

/* ---------------- Achievements ---------------- */
const ACHIEVEMENTS = [
  {id:'first',   icon:'🌱', name:'First Sprout',      desc:'Win your first battle',          test:() => S.counters.wins >= 1,  reward:{gold:50}},
  {id:'wins50',  icon:'🥋', name:'Scrappy Ninja',      desc:'Win 50 battles',                 test:() => S.counters.wins >= 50, reward:{gold:800, shards:10}},
  {id:'m10',     icon:'📜', name:'Errand Expert',      desc:'Complete 10 missions',           test:() => S.counters.missions >= 10, reward:{gold:400}},
  {id:'lv10',    icon:'🎋', name:'Reedblade',          desc:'Reach level 10',                 test:() => S.char.level >= 10, reward:{gold:300}},
  {id:'lv25',    icon:'🦅', name:'Moonhawk',           desc:'Reach level 25',                 test:() => S.char.level >= 25, reward:{gold:1500, shards:15}},
  {id:'lv45',    icon:'🌒', name:'Shadowcrest',        desc:'Reach level 45',                 test:() => S.char.level >= 45, reward:{gold:4000, shards:25}},
  {id:'lv60',    icon:'🌕', name:'Eclipse Warden',     desc:'Reach level 60',                 test:() => S.char.level >= 60, reward:{shards:60}},
  {id:'skills12',icon:'📖', name:'Bookworm',           desc:'Learn 12 techniques',            test:() => S.char.skills.length >= 12, reward:{gold:1000}},
  {id:'pets3',   icon:'🐾', name:'Critter Collector',  desc:'Adopt 3 pets',                   test:() => S.char.pets.length >= 3, reward:{shards:15}},
  {id:'elder',   icon:'⛩️', name:'Clan Elder',         desc:'Reach Elder rank in a clan',     test:() => S.char.clan && clanTier(S.char.clan.rep) >= 3, reward:{shards:20}},
  {id:'arena',   icon:'🏮', name:'Lantern Echo',       desc:'Reach 1250 arena rating',        test:() => S.arena.rating >= 1250, reward:{gold:1200, shards:10}},
  {id:'crits',   icon:'✨', name:'Sparkle Striker',    desc:'Land 100 critical hits',         test:() => S.counters.crits >= 100, reward:{gold:600}},
  {id:'moon',    icon:'🩸', name:'Moon Slayer',        desc:'Help defeat a Crimson Moon boss', test:() => S.event.kills >= 1 || (S.event.pool && S.event.dmg >= S.event.pool), reward:{shards:30}},
  {id:'final',   icon:'👑', name:'Keeper of the Moon', desc:'Clear "Lord of the Black Moon"', test:() => (S.missions.s3 || {}).clears > 0, reward:{shards:100}},
  {id:'friend',  icon:'💌', name:'Village Friend',     desc:'Send a shout or wave online',    test:() => S.counters.social >= 1, reward:{gold:100}},
];
function checkAchievements(silent){
  const got = [];
  for(const a of ACHIEVEMENTS){
    if(S.ach.includes(a.id) || !a.test()) continue;
    S.ach.push(a.id); got.push(a);
    if(a.reward.gold) S.char.gold += a.reward.gold;
    if(a.reward.shards) S.shards += a.reward.shards;
  }
  if(got.length){ persist(); if(!silent) setTimeout(() => toast(`🏅 Achievement: ${got.map(a => a.name).join(', ')}!`), 600); }
  return got;
}

/* ---------------- Sound (tiny WebAudio synth) ---------------- */
let AC = null, lastSfx = 0;
function sfx(type){
  if(!S || !S.settings.sound) return;
  const now = performance.now(); if(now - lastSfx < 45) return; lastSfx = now;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    const N = {hit:[[220,.06,'square']], crit:[[330,.05,'square'],[520,.08,'square']], heal:[[523,.07,'sine'],[784,.1,'sine']],
      skill:[[392,.05,'triangle'],[587,.07,'triangle']], win:[[523,.08,'triangle'],[659,.08,'triangle'],[784,.14,'triangle']],
      lose:[[330,.12,'sine'],[247,.18,'sine']], click:[[660,.03,'sine']], coin:[[880,.05,'square'],[1320,.07,'square']]}[type] || [];
    let t = AC.currentTime;
    for(const [f, d, w] of N){
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = w; o.frequency.value = f; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
    }
  }catch(e){}
}

/* ---------------- Auto-battle (smart local AI for your turns) ---------------- */
function autoAct(){
  if(!B || !B.awaiting || B.over) return;
  const p = B.active, t = getTarget(), ready = p.skills.map(id => SKILL[id]).filter(s => s && canUse(p, s));
  const healS = ready.find(s => s.heal && s.target !== 'ally');
  if(p.hp < p.maxHp * 0.35){
    if(healS) return ACT.bSkill(healS.id);
    const pot = ['moon_elixir','g_salve','salve'].find(id => S.inventory[id] > 0 && S.char.level >= ITEM[id].lvl);
    if(pot) return ACT.bUse(pot);
  }
  const buff = ready.find(s => s.target === 'self' && !s.heal && !s.power && !(s.apply || []).every(a => hasStatus(p, a.s)));
  if(buff && Math.random() < 0.6) return ACT.bSkill(buff.id);
  const foes = opponents(p).length;
  const off = ready.filter(s => s.power).map(s => [s, s.power * s.hits * elemMult(s.el, t.el) * (s.target === 'allEnemies' ? foes : 1) + (s.apply || []).length * 0.2]).sort((a, b) => b[1] - a[1]);
  if(off.length) return ACT.bSkill(off[0][0].id);
  if(p.cp < p.maxCp * 0.3) return ACT.bCharge();
  ACT.bAttack();
}

/* ---------------- AI guide: Momo the lantern spirit ---------------- */
const GUIDE = {open:false, msgs:[], busy:false, sample:null, tools:false, ctl:null, undo:null, pending:null, mode:'offline'};
const GUIDE_LOOK = {core:'#fff6e8', flame:'#ff9f6e'};
function guideState(){
  const c = S.char, st = charStats(c); syncDaily(); syncEvent();
  return {name:c.name, level:c.level, rank:rankOf(c.level).name, element:c.element, gold:c.gold, shards:S.shards, unspentPoints:c.points,
    stats:{hp:st.maxHp, chakra:st.maxCp, agility:st.agi, power:st.atk, crit:+st.crit.toFixed(1)}, alloc:c.alloc,
    equipped:c.equip, loadout:c.loadout, learnedSkills:c.skills, inventory:S.inventory, pet:c.pet, pets:c.pets,
    clan:c.clan ? {id:c.clan.id, rank:CLAN_TIERS[clanTier(c.clan.rep)].name, rep:c.clan.rep} : null,
    squad:activeSquad().map(r => ({id:r.id, name:r.name, level:r.level, element:r.element, points:r.points})), roster:S.squad.roster.length,
    arenaRating:S.arena.rating, event:{boss:ENEMY[S.event.bossId].name, bossElement:ENEMY[S.event.bossId].el, triesLeft:EVENT_TRIES - S.event.tries, pctDone:Math.round(S.event.dmg / S.event.pool * 100)},
    dailyQuests:S.daily.quests.map((q, i) => ({i, text:QUEST_POOL.find(x => x.id === q.id).text(q.n), progress:questProgress(q), need:q.n, claimed:q.claimed})),
    screen:UI.screen};
}
function guideList(kind){
  const c = S.char;
  if(kind === 'missions') return MISSIONS.filter(m => m.lvl <= c.level + 2).map(m => ({id:m.id, rank:m.rank, name:m.name, lvl:m.lvl, locked:c.level < m.lvl, clears:(S.missions[m.id] || {}).clears || 0, foes:[...new Set(m.stages.flatMap(s => s.foes.map(f => ENEMY[f[0]].name + ' (' + ENEMY[f[0]].el + ')')))]}));
  if(kind === 'skills') return SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl <= c.level + 5).map(s => ({id:s.id, name:s.name, el:s.el, lvl:s.lvl, cp:s.cp, cd:s.cd, price:skillPrice(s), learned:c.skills.includes(s.id), effects:skillTags(s).join(', ')}));
  if(kind === 'shop') return ITEMS.filter(i => i.shop !== false && !i.shards && i.lvl <= c.level + 3).map(i => ({id:i.id, name:i.name, slot:i.slot, lvl:i.lvl, price:i.price, bonus:i.bonus || i.desc}));
  if(kind === 'pets') return PETS.map(p => ({id:p.id, name:p.name, el:p.el, lvl:p.lvl, price:p.price || null, shards:p.shards || null, owned:c.pets.includes(p.id), desc:p.desc}));
  if(kind === 'clans') return CLANS.map(cl => ({id:cl.id, name:cl.name, lvl:cl.lvl, perks:clanPerkText(cl, 0)}));
  if(kind === 'arena'){ if(!S.arena.opps.length) refreshArena(); return S.arena.opps.map((g, i) => ({index:i, name:g.name, level:g.level, element:g.element, style:g.archetype, power:buildPower(g)})); }
  throw new Error('Unknown list kind');
}
function need(cond, msg){ if(!cond) throw new Error(msg); }
const GUIDE_TOOLS = [
  {name:'get_game_state', description:'Returns the player\'s current state: level, gold, stats, gear, techniques, pet, clan, daily quests and event status.', run:() => guideState()},
  {name:'list_options', description:'Lists what is available. kind is one of missions, skills, shop, pets, clans, arena. Returns ids to use with the other tools.',
   schema:{type:'object', properties:{kind:{type:'string', enum:['missions','skills','shop','pets','clans','arena']}}, required:['kind']}, run:i => guideList(String(i.kind))},
  {name:'allocate_points', description:'Spends unspent stat points. Give how many go to hp, cp (chakra) and agi. Returns the new stats.', mutates:true,
   schema:{type:'object', properties:{hp:{type:'integer'}, cp:{type:'integer'}, agi:{type:'integer'}}},
   run:i => { const c = S.char, a = {hp:Math.max(0, i.hp | 0), cp:Math.max(0, i.cp | 0), agi:Math.max(0, i.agi | 0)}; need(a.hp + a.cp + a.agi <= c.points, `Only ${c.points} points available`); for(const k in a){ c.alloc[k] += a[k]; c.points -= a[k]; } return charStats(c); }},
  {name:'learn_skill', description:'Learns a technique at the Academy by id (costs gold) and equips it if a loadout slot is free.', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}, required:['id']},
   run:i => { const s = SKILL[i.id], c = S.char; need(s && !s.enemyOnly && !s.petOnly, 'No such technique'); need(!c.skills.includes(s.id), 'Already learned'); need(c.level >= s.lvl, `Requires level ${s.lvl}`); need(c.gold >= skillPrice(s), 'Not enough gold'); c.gold -= skillPrice(s); c.skills.push(s.id); if(c.loadout.length < MAX_LOADOUT) c.loadout.push(s.id); return `Learned ${s.name}`; }},
  {name:'set_loadout', description:'Sets the battle loadout to up to 6 learned technique ids, in order.', mutates:true,
   schema:{type:'object', properties:{ids:{type:'array', items:{type:'string'}}}, required:['ids']},
   run:i => { const c = S.char, ids = (i.ids || []).map(String).filter(id => c.skills.includes(id)).slice(0, MAX_LOADOUT); need(ids.length, 'None of those are learned'); c.loadout = [...new Set(ids)]; return c.loadout; }},
  {name:'buy_item', description:'Buys an item from the Shop by id. qty defaults to 1.', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}, qty:{type:'integer'}}, required:['id']},
   run:i => { const it = ITEM[i.id], c = S.char, n = clamp(i.qty | 0 || 1, 1, 20); need(it && it.shop !== false && !it.shards, 'Not sold in the Shop'); need(c.level >= it.lvl, `Requires level ${it.lvl}`); need(c.gold >= it.price * n, 'Not enough gold'); c.gold -= it.price * n; addInv(it.id, n); return `Bought ${n}× ${it.name}`; }},
  {name:'equip_item', description:'Equips an owned weapon, clothing, back or accessory item by id.', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}, required:['id']},
   run:i => { const it = ITEM[i.id], c = S.char; need(it && SLOTS.includes(it.slot), 'Not equipment'); need(S.inventory[it.id] > 0, 'Not in inventory'); need(c.level >= it.lvl, `Requires level ${it.lvl}`); const prev = c.equip[it.slot]; if(prev) addInv(prev, 1); addInv(it.id, -1); c.equip[it.slot] = it.id; return `Equipped ${it.name}`; }},
  {name:'adopt_pet', description:'Adopts a pet by id (gold or Moon Shards) and brings it along.', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}, required:['id']},
   run:i => { const p = PET[i.id], c = S.char; need(p, 'No such pet'); need(!c.pets.includes(p.id), 'Already owned'); need(c.level >= p.lvl, `Requires level ${p.lvl}`);
     if(p.shards){ need(S.shards >= p.shards, 'Not enough shards'); S.shards -= p.shards; } else { need(c.gold >= p.price, 'Not enough gold'); c.gold -= p.price; } c.pets.push(p.id); c.pet = p.id; return `${p.name} adopted`; }},
  {name:'set_pet', description:'Chooses which owned pet fights beside the player. Pass an empty id to leave pets home.', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}}, run:i => { const c = S.char; need(!i.id || c.pets.includes(i.id), 'Pet not owned'); c.pet = i.id || null; return c.pet || 'none'; }},
  {name:'join_clan', description:'Joins a clan by id (200 gold, or 500 to switch).', mutates:true,
   schema:{type:'object', properties:{id:{type:'string'}}, required:['id']},
   run:i => { const cl = CLAN[i.id], c = S.char, cost = c.clan ? 500 : 200; need(cl, 'No such clan'); need(c.level >= cl.lvl, `Requires level ${cl.lvl}`); need(c.gold >= cost, 'Not enough gold'); c.gold -= cost; c.clan = {id:cl.id, rep:0}; return `Joined ${cl.name}`; }},
  {name:'claim_rewards', description:'Claims every finished daily quest and reached Crimson Moon milestone. Returns what was claimed.', mutates:true,
   run:() => { syncDaily(); let n = 0; S.daily.quests.forEach((q, i) => { if(claimQuest(i)) n++; }); EVENT_MILESTONES.forEach((m, i) => { if(!S.event.claimed.includes(i) && S.event.dmg / S.event.pool * 100 >= m.pct){ ACT.eventClaim(String(i)); n++; } }); return `${n} rewards claimed`; }},
  {name:'set_auto_battle', description:'Turns auto-battle on or off. When on, the player\'s turns are played automatically.', mutates:true,
   schema:{type:'object', properties:{on:{type:'boolean'}}, required:['on']}, run:i => { S.settings.auto = !!i.on; return S.settings.auto ? 'Auto-battle on' : 'Auto-battle off'; }},
  {name:'go_to', description:'Opens a screen after the reply: hub, missions, academy, shop, home, character, den, clan, arena, event, journal, online.',
   schema:{type:'object', properties:{screen:{type:'string'}}, required:['screen']},
   run:i => { const scr = String(i.screen); need(['hub','missions','academy','shop','home','character','den','clan','arena','event','journal','online'].includes(scr), 'Unknown screen'); GUIDE.pending = () => go(scr); return `Will open ${scr}`; }},
  {name:'start_battle', description:'Starts a fight right after the reply. kind is mission (with id), arena (with index from list_options arena) or event.',
   schema:{type:'object', properties:{kind:{type:'string', enum:['mission','arena','event']}, id:{type:'string'}, index:{type:'integer'}}, required:['kind']},
   run:i => { const c = S.char;
     if(i.kind === 'mission'){ const m = MISSION[i.id]; need(m, 'No such mission'); need(c.level >= m.lvl, `Requires level ${m.lvl}`); GUIDE.pending = () => startMission(m.id); return `Will start ${m.name}`; }
     if(i.kind === 'arena'){ need(c.level >= 4, 'Arena opens at level 4'); if(!S.arena.opps.length) refreshArena(); const k = clamp(i.index | 0, 0, S.arena.opps.length - 1); GUIDE.pending = () => ACT.arenaFight(String(k)); return `Will challenge ${S.arena.opps[k].name}`; }
     need(c.level >= EVENTS[0].lvl, 'Event opens at level 5'); syncEvent(); need(S.event.tries < EVENT_TRIES, 'No attempts left today'); GUIDE.pending = () => startEvent(); return 'Will start the Crimson Moon attempt'; }},
];
const GUIDE_RULES = `You are Momo, a cheerful little lantern spirit who guides players of "Tsukimori", a cute turn-based ninja RPG in a moon-forest village. Speak warmly and briefly (2-5 short sentences, playful but clear; no markdown headers).
Game facts: Elements counter wheel Fire>Wind>Lightning>Earth>Water>Fire (+25% strong, -25% weak). Stat points: hp +10 HP, cp +6 Chakra, agi +2 Agility (turn order, dodge, crit). Power comes from level, weapon and clan. Techniques cost Chakra and have cooldowns; Charge restores Chakra. Off-element techniques cost double. Missions D(1+) C(10+) B(20+) A(35+) S(50+). Pets fight beside you and gain bond. Clans give passive perks that grow with reputation. Echo Arena fights AI ghosts of other builds. Crimson Moon is a weekly boss with 3 tries a day. Daily quests and a login streak give rewards.
You can act for the player with the tools. Check get_game_state before advising. When asked to do something, do it, then say plainly what you changed. Don't spend more than the player asked; if a request is vague ("gear me up"), prefer good value and keep some gold for supplies. Never invent ids: use list_options.`;
function guideSay(role, text, extra){ GUIDE.msgs.push({role, text, extra}); if(GUIDE.msgs.length > 40) GUIDE.msgs.shift(); renderGuideMsgs(); }
function renderGuide(){
  const g = $('#guide'); if(!g) return;
  const fab = $('#guide-fab'); if(fab && !fab.innerHTML) fab.innerHTML = spiritSVG(GUIDE_LOOK);
  g.classList.toggle('hidden', !GUIDE.open); $('#guide-fab').classList.toggle('hidden', GUIDE.open || !(S && S.char) || UI.screen === 'battle');
  if(!GUIDE.open) return;
  const mode = GUIDE.mode === 'claude' ? 'Powered by Claude' : GUIDE.mode === 'byok' ? 'Using your API key' : 'Offline helper';
  g.innerHTML = `<div class="g-head"><span class="g-face">${spiritSVG(GUIDE_LOOK)}</span><div><b>Momo</b><small>${mode}</small></div><button class="btn sm ghost" data-act="guideClose" aria-label="Close guide">✕</button></div>
    <div class="g-msgs" id="g-msgs"></div>
    <div class="g-chips">${['What should I do next?','Spend my stat points','Gear me up','Pick a mission for me','Claim my rewards'].map(t => `<button class="chipbtn" data-act="guideAsk" data-arg="${t}">${t}</button>`).join('')}</div>
    <div class="g-in"><input id="g-input" placeholder="Ask Momo anything…" maxlength="400" autocomplete="off"><button class="btn primary" data-act="guideSend">${GUIDE.busy ? 'Stop' : 'Send'}</button></div>
    ${GUIDE.mode === 'offline' && !GUIDE.sample ? `<details class="g-key"><summary>Use Claude with your own API key</summary><p class="muted">For self-hosted copies. The key stays in this browser only and is sent straight to Anthropic.</p><input id="g-key" type="password" placeholder="sk-ant-…" value="${esc(getKey())}"><button class="btn sm" data-act="guideKey">Save key</button></details>` : ''}`;
  renderGuideMsgs();
}
function renderGuideMsgs(){
  const box = $('#g-msgs'); if(!box) return;
  if(!GUIDE.msgs.length) guideIntro();
  box.innerHTML = GUIDE.msgs.map((m, i) => `<div class="g-msg ${m.role}">${m.role === 'momo' ? '<span class="g-dot">🏮</span>' : ''}<div><div class="g-bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>${m.extra ? m.extra : ''}</div></div>`).join('')
    + (GUIDE.busy ? `<div class="g-msg momo"><span class="g-dot">🏮</span><div class="g-bubble g-typing"><i></i><i></i><i></i></div></div>` : '')
    + (GUIDE.undo ? `<div class="g-undo"><button class="btn sm" data-act="guideUndo">Undo Momo's changes</button></div>` : '');
  box.scrollTop = box.scrollHeight;
}
function guideIntro(){ GUIDE.msgs.push({role:'momo', text:`Hi ${S.char.name}! I'm Momo, your lantern guide. Ask me anything about Tsukimori, or tap a button and I'll handle it for you.`}); }
function getKey(){ try{ return localStorage.getItem('tsukimori_api_key') || ''; }catch(e){ return ''; } }
async function guideAsk(text){
  if(GUIDE.busy || !text.trim()) return;
  guideSay('you', text);
  if(GUIDE.mode === 'offline') return offlineGuide(text);
  GUIDE.busy = true; GUIDE.undo = null; GUIDE.pending = null; renderGuide();
  const snapshot = JSON.stringify(S); let changed = false;
  const convo = GUIDE.msgs.filter(m => !m.extra).slice(-10).map(m => ({role:m.role === 'you' ? 'user' : 'assistant', content:m.text}));
  while(convo.length && convo[0].role !== 'user') convo.shift();
  const first = {role:'user', content:GUIDE_RULES + '\n\nCurrent state:\n' + JSON.stringify(guideState())};
  const wrap = t => ({name:t.name, description:t.description, schema:t.schema, run:inp => { const r = t.run(inp || {}); if(t.mutates){ changed = true; persist(); render(); } return r; }});
  const tools = GUIDE_TOOLS.map(wrap);
  try{
    let text;
    if(GUIDE.mode === 'claude'){
      GUIDE.ctl = new AbortController();
      const res = await GUIDE.sample([first, ...convo], {modelTier:'quick', signal:GUIDE.ctl.signal, tools:tools.map(t => ({name:t.name, description:t.description, inputSchema:t.schema, execute:t.run}))});
      text = res.text;
    } else text = await byokAsk([first, ...convo], tools);
    guideSay('momo', (text || '').trim() || 'Done!');
  }catch(e){
    const code = e && e.code;
    if(code === 'cancelled') guideSay('momo', 'Okay, I stopped.');
    else if(code === 'not_granted' || code === 'sampling_disabled'){ GUIDE.mode = 'offline'; guideSay('momo', "I can't reach Claude here, so I'll help the simple way."); offlineGuide(text); }
    else if(code === 'rate_limited') guideSay('momo', "I'm a little out of breath. Try again in a moment!");
    else guideSay('momo', 'Something went wrong reaching Claude: ' + ((e && e.message) || 'unknown error'));
  }
  GUIDE.busy = false; if(changed) GUIDE.undo = snapshot; renderGuide();
  if(GUIDE.pending){ const f = GUIDE.pending; GUIDE.pending = null; GUIDE.open = false; renderGuide(); f(); }
}
async function byokAsk(messages, tools){
  const key = getKey(); if(!key) throw new Error('No API key saved');
  const defs = tools.map(t => ({name:t.name, description:t.description, input_schema:t.schema || {type:'object', properties:{}}}));
  let msgs = messages.map(m => ({role:m.role, content:m.content}));
  // merge consecutive user turns for the Messages API
  msgs = msgs.reduce((a, m) => { if(a.length && a[a.length - 1].role === m.role) a[a.length - 1].content += '\n\n' + m.content; else a.push(m); return a; }, []);
  for(let round = 0; round < 6; round++){
    const r = await fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001', max_tokens:800, tools:defs, messages:msgs})});
    const d = await r.json(); if(!r.ok) throw new Error((d.error && d.error.message) || r.statusText);
    msgs.push({role:'assistant', content:d.content});
    const uses = d.content.filter(b => b.type === 'tool_use');
    if(!uses.length) return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    msgs.push({role:'user', content:uses.map(u => { let out; try{ out = JSON.stringify(tools.find(t => t.name === u.name).run(u.input)); }catch(e){ out = 'Error: ' + e.message; } return {type:'tool_result', tool_use_id:u.id, content:String(out).slice(0, 8000)}; })});
  }
  return 'Done!';
}
/* Offline helper: rule-based advice with one-tap actions (works anywhere, no AI needed). */
function suggestions(){
  const c = S.char, out = [], st = charStats(c); syncDaily(); syncEvent();
  if(c.points){ const a = autoAllocRecruit(c);
    out.push({text:`Spend your ${c.points} stat points (${a.hp} HP, ${a.cp} Chakra, ${a.agi} Agility suits a ${ELEMENTS[c.element].name} ninja).`, tool:'allocate_points', input:a}); }
  const claim = S.daily.quests.some(q => !q.claimed && questProgress(q) >= q.n) || EVENT_MILESTONES.some((m, i) => !S.event.claimed.includes(i) && S.event.dmg / S.event.pool * 100 >= m.pct);
  if(claim) out.push({text:'You have rewards waiting to be claimed.', tool:'claim_rewards', input:{}});
  const sk = SKILLS.find(s => s.el === c.element && !s.enemyOnly && !s.petOnly && s.lvl <= c.level && !c.skills.includes(s.id) && c.gold >= s.price);
  if(sk) out.push({text:`Learn ${sk.name} at the Academy for ${sk.price} gold.`, tool:'learn_skill', input:{id:sk.id}});
  for(const sl of SLOTS){
    const cur = ITEM[c.equip[sl]], score = it => it ? Object.entries(it.bonus || {}).reduce((a, [k, v]) => a + v * ({hp:.25, cp:.3, agi:2, atk:2.5, crit:1.5, dodge:1.5}[k] || 1), 0) : 0;
    const best = ITEMS.filter(i => i.slot === sl && i.shop !== false && !i.shards && i.lvl <= c.level && i.price <= c.gold * 0.8).sort((a, b) => score(b) - score(a))[0];
    if(best && score(best) > score(cur) * 1.15 && !(S.inventory[best.id] > 0)){ out.push({text:`Buy and equip ${best.name} (${fmtBonus(best.bonus)}) for ${best.price} gold.`, tool:'buy_equip', input:{id:best.id}}); break; }
  }
  if(c.level >= SQUAD_LVL && S.squad.roster.length < MAX_SQUAD){ syncPool(); const pi = S.squad.pool.findIndex(r => r.cost <= c.gold * 0.7); if(pi >= 0) out.push({text:`Recruit ${S.squad.pool[pi].name} (${ELEMENTS[S.squad.pool[pi].element].name}, Lv ${S.squad.pool[pi].level}) for ${S.squad.pool[pi].cost} gold. Squadmates fight beside you!`, tool:'recruit_ninja', input:{index:pi}}); }
  for(const r of activeSquad()) if(r.points){ out.push({text:`${r.name} has ${r.points} points to spend.`, tool:'manage_recruit', input:{id:r.id, auto:true}}); break; }
  for(const r of activeSquad()) if(r.level < c.level && trainsLeft(r) > 0 && c.gold >= trainCost(r) * 3){ out.push({text:`Train ${r.name} (Lv ${r.level}) for ${trainCost(r)} gold.`, tool:'train_recruit', input:{id:r.id}}); break; }
  if(!c.pets.length && c.level >= 3){ const p = PETS.filter(p => !p.shards && p.lvl <= c.level && p.price <= c.gold).pop(); if(p) out.push({text:`Adopt ${p.name} at the Beast Den. Pets fight beside you!`, tool:'adopt_pet', input:{id:p.id}}); }
  if(!c.clan && c.level >= 5 && c.gold >= 300){ const cl = CLANS.find(x => x.perk.elem === c.element) || CLANS.find(x => x.lvl <= c.level); out.push({text:`Join the ${cl.name} for ${clanPerkText(cl, 0)}.`, tool:'join_clan', input:{id:cl.id}}); }
  const open = MISSIONS.filter(m => m.lvl <= c.level), fresh = open.filter(m => !(S.missions[m.id] || {}).clears);
  const m = (fresh.length ? fresh : open).sort((a, b) => b.lvl - a.lvl)[0];
  if(m) out.push({text:`Take on "${m.name}" (${m.rank}-rank)${fresh.includes(m) ? ', a mission you haven\'t cleared yet' : ''}.`, tool:'start_battle', input:{kind:'mission', id:m.id}});
  if(c.level >= 5 && S.event.tries < EVENT_TRIES && S.event.dmg < S.event.pool) out.push({text:`You still have ${EVENT_TRIES - S.event.tries} Crimson Moon attempts today. Bring ${ELEMENTS[EL_ORDER.find(e => ELEMENTS[e].beats === ENEMY[S.event.bossId].el)].name} techniques!`, tool:'start_battle', input:{kind:'event'}});
  return out;
}
const FAQ = [
  [/element|weak|strong|counter/i, 'Follow the wheel: Fire beats Wind, Wind beats Lightning, Lightning beats Earth, Earth beats Water, Water beats Fire. Strong hits deal +25%, weak ones −25%. Look for the ▲ on your skill buttons!'],
  [/chakra|cp|charge/i, 'Techniques cost Chakra. When you run low, use Charge to recover about a third of it, or drink a Chakra Pill.'],
  [/point|stat|agil/i, 'Each level gives 3 points. HP keeps you standing, Chakra fuels techniques, and Agility makes you act first, dodge and crit more.'],
  [/squad|team|recruit|train/i, 'At the Squad Lodge you can recruit up to 6 ninja and bring 2 into battle. You command their turns too! Train them with gold, teach them techniques, and online you can even hire echoes of real players.'],
  [/pet|den/i, 'Pets from the Beast Den fight beside you on their own. They get stronger with bond every time you win together.'],
  [/clan/i, 'Clans give passive perks. Earn reputation from missions, arena wins and the Crimson Moon to rank up and make the perks stronger.'],
  [/arena|pvp|echo|ghost/i, 'The Echo Arena pits you against AI copies of other builds, including real players online. Win to raise your rating.'],
  [/moon|boss|event|raid/i, 'The Crimson Moon boss changes weekly and keeps its wounds between tries. You get 3 attempts a day, and everyone online chips in toward community rewards.'],
  [/online|multi|friend|chat/i, 'Open the Village Square to see who is online, wave, shout, and challenge their echoes. Your build is shared automatically when you play online.'],
  [/save|load|backup/i, 'The game autosaves in your browser. The Save screen can copy your save, and online you can also save to the cloud.'],
];
function offlineGuide(text){
  const hit = FAQ.find(([re]) => re.test(text || ''));
  const sug = suggestions();
  if(hit && !/next|do|help|spend|gear|pick|claim/i.test(text)) return guideSay('momo', hit[1]);
  let pick = sug;
  if(/spend|point/i.test(text)) pick = sug.filter(s => s.tool === 'allocate_points');
  else if(/gear|equip|buy/i.test(text)) pick = sug.filter(s => s.tool === 'buy_equip');
  else if(/mission|fight|battle/i.test(text)) pick = sug.filter(s => s.tool === 'start_battle');
  else if(/claim|reward/i.test(text)) pick = sug.filter(s => s.tool === 'claim_rewards');
  if(!pick.length) return guideSay('momo', /spend|point/i.test(text) ? 'You have no unspent points right now.' : /gear/i.test(text) ? 'Your gear is looking good for your level and budget!' : /claim/i.test(text) ? 'Nothing to claim yet. Keep going!' : 'Hmm, I have no special tips right now. A mission is always a good idea!');
  GUIDE.offerList = pick.slice(0, 4);
  guideSay('momo', pick.length > 1 ? "Here's what I'd do next. Tap one and I'll take care of it:" : pick[0].text,
    `<div class="g-acts">${GUIDE.offerList.map((s, i) => `<button class="btn sm ${i ? '' : 'primary'}" data-act="guideDo" data-arg="${i}">${pick.length > 1 ? esc(s.text) : 'Do it for me'}</button>`).join('')}</div>`);
}
function guideDo(i){
  const s = (GUIDE.offerList || [])[+i]; if(!s) return;
  const snap = JSON.stringify(S);
  try{
    let r;
    if(s.tool === 'buy_equip'){ GUIDE_TOOLS.find(t => t.name === 'buy_item').run(s.input); r = GUIDE_TOOLS.find(t => t.name === 'equip_item').run(s.input); }
    else r = GUIDE_TOOLS.find(t => t.name === s.tool).run(s.input);
    persist(); GUIDE.undo = snap; GUIDE.offerList = null;
    GUIDE.msgs.forEach(m => { m.extra = null; });
    guideSay('momo', typeof r === 'string' ? r + '!' : 'All done!');
    if(GUIDE.pending){ const f = GUIDE.pending; GUIDE.pending = null; GUIDE.open = false; renderGuide(); f(); } else render();
  }catch(e){ guideSay('momo', 'I couldn\'t do that: ' + e.message); }
}

/* ---------------- Online multiplayer ----------------
   Two backends share one shape ({db, room}):
   • claude.ai: the artifact runtime's db + room + user capabilities.
   • Tsukimori servers: anyone can host server/server.js; players join from the Village Square.
   With neither, every call below is skipped and the game plays solo. */
const NET = {db:null, room:null, user:null, uid:null, peers:[], echoes:[], raid:[], chat:[], ready:false, lastPresence:'', mode:null, server:null, backend:null, list:[]};
const hashN = (s, m) => { let h = 7; for(const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % m; };
async function initNet(){
  if(!(window.claude && window.claude.use)){ initServers(); return; }
  NET.mode = 'claude';
  const use = n => window.claude.use(n).catch(() => null);
  const [db, room, user, sample] = await Promise.all([use('db'), use('room'), use('user'), use('sample')]);
  NET.db = db; NET.room = room; NET.user = user;
  if(sample){ GUIDE.sample = sample; try{ const lim = await sample.limits(); GUIDE.mode = lim && lim.tools !== false ? 'claude' : 'offline'; }catch(e){ GUIDE.mode = 'claude'; } }
  if(user) NET.uid = await user.id().catch(() => null);
  attachNet(db, room);
  NET.ready = true; renderGuide(); presence(); publishEcho(); netChanged();
}
function attachNet(db, room){
  if(db){
    db.collection('echoes').orderBy('rating', 'desc').limit(60).onSnapshot(s => { NET.echoes = s.docs.map(d => Object.assign({id:d.id}, d.data())); netChanged(); }, () => {});
    db.collection('hires').onSnapshot(s => { NET.hires = s.docs.map(d => Object.assign({id:d.id}, d.data())); netChanged(); }, () => {});
    db.collection('raidhits').onSnapshot(s => { NET.raid = s.docs.map(d => Object.assign({id:d.id}, d.data())); netChanged(); }, () => {});
  }
  if(room){
    room.onPeers(ch => { NET.peers = ch.peers.filter(p => p.presence && p.presence.name); netChanged(); }, () => {});
    room.on('shout', m => { const d = m.data || {}; NET.chat.push({name:String(d.name || 'Someone').slice(0, 16), text:String(d.text || '').slice(0, 140), me:m.isMe, t:Date.now()}); if(NET.chat.length > 40) NET.chat.shift(); netChanged(); });
    room.on('emote', m => { const d = m.data || {}; showEmote(m.peer, String(d.emoji || '👋').slice(0, 4)); });
  }
}

/* ---- Self-hosted servers (server/server.js) ----
   The adapter below speaks the server's small JSON-over-WebSocket protocol and exposes the same
   db/room calls as the claude.ai runtime, so the rest of the game doesn't care which one it has. */
const SERVER_KEY = 'tsukimori_server', SERVERS_KEY = 'tsukimori_servers', TOKENS_KEY = 'tsukimori_server_tokens';
const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
const lsSet = (k, v) => { try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
// Your identity on a server is a random secret kept in this browser (one per server).
function serverToken(url){
  const t = lsGet(TOKENS_KEY, {}); if(t[url]) return t[url];
  const a = new Uint8Array(24); crypto.getRandomValues(a); t[url] = Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); lsSet(TOKENS_KEY, t); return t[url];
}
// "my.host:8787", "https://my.host" or "wss://my.host/ws" → a WebSocket URL; "ABC123" or "p2p:ABC123" → a device-hosted village
const P2P_CODE = /^[A-Z2-9]{4,8}$/;
function normServerUrl(u){
  u = String(u || '').trim(); if(!u) return '';
  const code = u.replace(/^p2p:/i, '').toUpperCase();
  if(/^p2p:/i.test(u) || (P2P_CODE.test(code) && !/[.:/]/.test(u))) return P2P_CODE.test(code) ? 'p2p:' + code : '';
  if(/^https?:\/\//i.test(u)) u = u.replace(/^http/i, 'ws');
  else if(!/^wss?:\/\//i.test(u)) u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + u;
  try{ const x = new URL(u); return x.protocol + '//' + x.host + (x.pathname === '/' ? '' : x.pathname.replace(/\/$/, '')); }catch(e){ return ''; }
}

/* Transports carry text messages. Each takes handlers {onopen, onmessage(text), onclose} and returns {send(text), close(), ready()}. */
function wsTransport(url){
  return h => { const ws = new WebSocket(url); ws.onopen = h.onopen; ws.onmessage = e => h.onmessage(e.data); ws.onclose = h.onclose;
    return {send:t => ws.send(t), close:() => ws.close(), ready:() => ws.readyState === 1}; };
}
// The host plays in their own village without any network in between.
function loopTransport(){
  return h => {
    if(!HOST.core){ setTimeout(h.onclose, 0); return {send(){}, close(){}, ready:() => false}; }
    let open = true;
    const shut = () => { if(!open) return; open = false; conn.drop(); HOST.loops.delete(tr); setTimeout(h.onclose, 0); };
    const conn = HOST.core.connect(o => { if(open) setTimeout(() => open && h.onmessage(JSON.stringify(o)), 0); }, shut);
    const tr = {send:t => { try{ conn.receive(JSON.parse(t)); }catch(e){} }, close:shut, ready:() => open};
    HOST.loops.add(tr); setTimeout(h.onopen, 0); return tr;
  };
}

/* ---- WebRTC for device-hosted villages ----
   Players find the host through a public PeerJS broker (it only relays the connection handshake),
   then talk directly over a data channel. Big messages are split so they fit a data channel. */
const SIGNAL_URL = () => lsGet('tsukimori_signal', '') || 'wss://0.peerjs.com:443/peerjs';
const ICE = {iceServers:[{urls:'stun:stun.l.google.com:19302'}, {urls:['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username:'peerjs', credential:'peerjsp'}]};
const rid6 = (n, abc) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => abc[b % abc.length]).join(''); };
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ID_ABC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const hostPeerId = code => 'tsukimori-' + code.toLowerCase();
// A connection to the broker as `id`. onMsg gets {type, src, payload}; onStatus gets 'open' | 'taken' | 'closed'.
function signalConn(id, onMsg, onStatus){
  let ws, beat, done = false;
  try{ ws = new WebSocket(`${SIGNAL_URL()}?key=peerjs&id=${encodeURIComponent(id)}&token=${rid6(10, ID_ABC)}&version=1.5.4`); }catch(e){ setTimeout(() => onStatus('closed'), 0); return {send(){}, close(){}}; }
  ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(err){ return; }
    if(m.type === 'OPEN') onStatus('open'); else if(m.type === 'ID-TAKEN'){ done = true; ws.close(); onStatus('taken'); } else onMsg(m); };
  ws.onopen = () => { beat = setInterval(() => ws.readyState === 1 && ws.send('{"type":"HEARTBEAT"}'), 5000); };
  ws.onclose = () => { clearInterval(beat); if(!done){ done = true; onStatus('closed'); } };
  return {send:m => { if(ws.readyState === 1) ws.send(JSON.stringify(m)); }, close:() => { done = true; clearInterval(beat); ws.close(); }};
}
const CHUNK = 16000;
function dcSend(dc, t){
  if(dc.readyState !== 'open') return;
  if(t.length <= CHUNK) return dc.send(t);
  const id = rid6(6, ID_ABC), n = Math.ceil(t.length / CHUNK);
  for(let i = 0; i < n; i++) dc.send(`~${id}:${i}:${n}:` + t.slice(i * CHUNK, (i + 1) * CHUNK));
}
function dcReader(cb){
  const parts = {};
  return t => {
    if(t[0] !== '~') return cb(t);
    const m = /^~(\w+):(\d+):(\d+):/.exec(t); if(!m) return;
    const [all, id, i, n] = m, p = parts[id] = parts[id] || []; p[+i] = t.slice(all.length);
    if(p.filter(x => x != null).length === +n){ delete parts[id]; cb(p.join('')); }
  };
}
function rtcTransport(code){
  return h => {
    let pc = null, dc = null, sig = null, done = false;
    const cid = rid6(10, ID_ABC), early = [];
    const fail = () => { if(done) return; done = true; clearTimeout(timer); if(sig) sig.close(); try{ if(pc) pc.close(); }catch(e){} h.onclose(); };
    const timer = setTimeout(fail, 25000);
    async function start(){
      pc = new RTCPeerConnection(ICE);
      dc = pc.createDataChannel('tsukimori', {ordered:true});
      dc.onopen = () => { clearTimeout(timer); sig.close(); h.onopen(); };
      dc.onmessage = (read => e => read(e.data))(dcReader(h.onmessage));
      dc.onclose = fail;
      pc.onconnectionstatechange = () => { if(['failed', 'closed'].includes(pc.connectionState)) fail(); };
      pc.onicecandidate = e => { if(e.candidate) sig.send({type:'CANDIDATE', dst:hostPeerId(code), payload:{cid, candidate:e.candidate}}); };
      await pc.setLocalDescription(await pc.createOffer());
      sig.send({type:'OFFER', dst:hostPeerId(code), payload:{cid, sdp:pc.localDescription}});
    }
    sig = signalConn('tsukimori-c' + rid6(12, ID_ABC), async m => {
      const p = m.payload || {};
      if(m.type === 'EXPIRE' || m.type === 'ERROR') return fail();
      if(p.cid !== cid || !pc) return;
      try{
        if(m.type === 'ANSWER'){ await pc.setRemoteDescription(p.sdp); for(const c of early.splice(0)) pc.addIceCandidate(c).catch(() => {}); }
        else if(m.type === 'CANDIDATE'){ if(pc.remoteDescription) pc.addIceCandidate(p.candidate).catch(() => {}); else early.push(p.candidate); }
      }catch(e){ fail(); }
    }, st => { if(st === 'open') start().catch(fail); else if(!dc || dc.readyState !== 'open') fail(); });
    return {send:t => dc && dcSend(dc, t), close:fail, ready:() => !!dc && dc.readyState === 'open'};
  };
}

/* ---- The client side of the server protocol, over any transport ---- */
function protoBackend(url, transport, onStatus){
  let tr = null, rid = 0, subN = 0, closed = false, retry = 0, presenceData = null, beat = null;
  const me = {uid:null, peer:null}, pending = new Map(), subs = new Map(), handlers = {}, peerCbs = [];
  const send = o => { if(tr && tr.ready()){ tr.send(JSON.stringify(o)); return true; } return false; };
  const req = o => new Promise((resolve, reject) => {
    const id = ++rid; o.rid = id; if(!send(o)) return reject(new Error('Not connected to the server'));
    pending.set(id, {resolve, reject}); setTimeout(() => { if(pending.delete(id)) reject(new Error('The server did not answer')); }, 10000);
  });
  function open(){
    onStatus('connecting');
    let mine = null;
    try{
      mine = tr = transport({
        onopen:() => send({t:'hello', v:1, token:serverToken(url)}),
        onmessage:t => { let m; try{ m = JSON.parse(t); }catch(err){ return; } recv(m); },
        onclose:() => {
          if(tr !== mine) return; tr = null; clearInterval(beat); for(const p of pending.values()) p.reject(new Error('Disconnected')); pending.clear();
          if(closed) return; peerCbs.forEach(cb => cb({peers:[]}));
          const wait = Math.min(30000, 1000 * 2 ** retry++); onStatus('offline', {retryIn:wait}); setTimeout(() => { if(!closed) open(); }, wait);
        }});
    }catch(e){ onStatus('error', {err:e.message}); }
  }
  function recv(m){
    if(m.t === 'welcome'){
      retry = 0; me.uid = m.uid; me.peer = m.peer;
      for(const [id, sb] of subs) send({t:'sub', id, col:sb.col, orderBy:sb.orderBy, limit:sb.limit});
      if(presenceData) send({t:'presence', data:presenceData});
      clearInterval(beat); beat = setInterval(() => send({t:'ping'}), 25000);
      onStatus('online', m);
    } else if(m.t === 'ack'){ const p = pending.get(m.rid); if(!p) return; pending.delete(m.rid); if(m.ok) p.resolve(m.doc); else p.reject(new Error(m.err || 'Server error')); }
    else if(m.t === 'snap'){ const sb = subs.get(m.id); if(sb) sb.cb({docs:(m.docs || []).map(d => ({id:d.id, data:() => d.data}))}); }
    else if(m.t === 'peers'){ const peers = (m.peers || []).map(p => Object.assign({}, p, {isMe:p.peer === me.peer})); peerCbs.forEach(cb => cb({peers})); }
    else if(m.t === 'ev'){ (handlers[m.ev] || []).forEach(cb => cb({data:m.data, peer:m.peer, isMe:m.peer === me.peer})); }
  }
  const collection = col => { const q = {col, orderBy:null, limit:0}, api = {
    orderBy:f => (q.orderBy = f, api), limit:n => (q.limit = n, api),
    onSnapshot:cb => { const id = ++subN; subs.set(id, Object.assign({cb}, q)); send({t:'sub', id, col:q.col, orderBy:q.orderBy, limit:q.limit}); return () => subs.delete(id); }}; return api; };
  const db = {collection, doc:path => ({set:data => req({t:'set', path, data}), get:() => req({t:'get', path}).then(d => ({exists:!!d, data:() => d}))})};
  const room = {onPeers:cb => { peerCbs.push(cb); }, on:(ev, cb) => { (handlers[ev] = handlers[ev] || []).push(cb); },
    emit:(ev, data) => req({t:'emit', ev, data}), presence:data => { presenceData = data; send({t:'presence', data}); return Promise.resolve(); }};
  setTimeout(open, 0); // after the caller has stored the backend
  return {db, room, me, close(){ closed = true; clearInterval(beat); if(tr) tr.close(); }};
}
function transportFor(url){
  if(/^p2p:/.test(url)) return HOST.core && url === 'p2p:' + HOST.code ? loopTransport() : rtcTransport(url.slice(4));
  return wsTransport(url);
}
function connectServer(url, quiet){
  url = normServerUrl(url); if(!url) return quiet || toast('That doesn\'t look like a server address or village code');
  if(location.protocol === 'https:' && /^ws:/i.test(url)) return quiet || toast('This page is on HTTPS, so it can only join wss:// servers. Open the game from the server\'s own address instead.');
  if(/^p2p:/.test(url) && !window.RTCPeerConnection && !(HOST.core && url === 'p2p:' + HOST.code)) return quiet || toast('This browser can\'t join device-hosted villages');
  disconnectServer(true);
  NET.server = {url, status:'connecting', info:null};
  const be = protoBackend(url, transportFor(url), (st, m) => {
    if(!NET.server || NET.backend !== be) return;
    NET.server.status = st;
    if(st === 'online'){
      const first = !NET.server.info; NET.server.info = {name:String(m.name || 'Server').slice(0, 40), motd:String(m.motd || '').slice(0, 200)}; NET.uid = m.uid;
      rememberServer(url, NET.server.info.name); NET.lastPresence = ''; presence(); publishEcho(); if(S && S.squad) publishHires();
      if(first && !quiet) toast(`Joined ${NET.server.info.name}`);
    }
    if(st === 'offline') NET.peers = [];
    netChanged(); if(UI.screen === 'online') render();
  });
  NET.backend = be; NET.db = be.db; NET.room = be.room; NET.mode = 'server'; NET.ready = true;
  attachNet(be.db, be.room); lsSet(SERVER_KEY, url);
  if(UI.screen === 'online') render();
}
function disconnectServer(keepChoice){
  if(NET.backend) NET.backend.close();
  Object.assign(NET, {backend:null, db:null, room:null, uid:null, server:null, mode:null, peers:[], echoes:[], hires:[], raid:[], chat:[], lastPresence:''});
  if(!keepChoice) lsSet(SERVER_KEY, ''); // '' remembers that the player chose to play offline
}
function rememberServer(url, name){
  const list = lsGet(SERVERS_KEY, []).filter(x => x && x.url !== url); list.unshift({url, name}); lsSet(SERVERS_KEY, list.slice(0, 12));
}

/* ---- Host on this device ----
   Runs the same host core as server/server.js inside this page. Players reach it over WebRTC with the
   village code; the host joins through a loopback. The village lives only while this page is open. */
const HOST_KEY = 'tsukimori_host', HOST_DATA_KEY = 'tsukimori_host_data';
const HOST = {core:null, code:'', status:'off', err:'', sig:null, peers:new Map(), loops:new Set(), wake:null, saveT:null, retry:0};
const hexOf = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const hostPlayers = () => HOST.core ? HOST.core.info().players : 0;
function startHosting(){
  if(HOST.core) return;
  if(!window.RTCPeerConnection || !(crypto && crypto.subtle)) return toast('This browser can\'t host. Try Chrome, Safari or Firefox over HTTPS.');
  const cfg = lsGet(HOST_KEY, {}) || {};
  HOST.code = cfg.code || rid6(6, CODE_ABC);
  const name = (cfg.name || (S && S.char ? `${S.char.name}'s village` : 'Pocket village')).slice(0, 40);
  lsSet(HOST_KEY, {code:HOST.code, name, on:true});
  HOST.core = createHostCore({name, motd:'Hosted on a ninja\'s own device. It closes when they do!', maxPlayers:12,
    maxDocs:{echoes:300, hires:300, raidhits:300, saves:12}, maxSave:150000, store:lsGet(HOST_DATA_KEY, null),
    persist:store => { clearTimeout(HOST.saveT); HOST.saveT = setTimeout(() => { try{ localStorage.setItem(HOST_DATA_KEY, JSON.stringify(store)); }catch(e){} }, 1500); },
    hashId:async t => hexOf(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))), randomId:() => rid6(10, ID_ABC)});
  HOST.status = 'starting'; HOST.err = '';
  hostSignal(); keepAwake();
  connectServer('p2p:' + HOST.code, true);
  render();
}
function hostSignal(){
  if(!HOST.core) return;
  HOST.sig = signalConn(hostPeerId(HOST.code), hostOnSignal, st => {
    if(!HOST.core) return;
    if(st === 'open'){ HOST.status = 'online'; HOST.retry = 0; }
    else if(st === 'taken'){ HOST.status = 'error'; HOST.err = 'That village code is busy (is it open in another tab?). Retrying…'; }
    if(st !== 'open'){ // keep trying to stay listed with the broker; players already connected are unaffected
      if(st === 'closed' && HOST.status !== 'error'){ HOST.status = 'error'; HOST.err = 'Can\'t reach the matchmaking service. Retrying…'; }
      setTimeout(() => { if(HOST.core) hostSignal(); }, Math.min(30000, 2000 * 2 ** HOST.retry++));
    }
    if(UI.screen === 'online') render();
  });
}
async function hostOnSignal(m){
  const p = m.payload || {}, src = m.src; if(!HOST.core || !src || !p.cid) return;
  const key = src + '/' + p.cid;
  if(m.type === 'OFFER'){
    if(HOST.core.full() || HOST.peers.size >= 12) return;
    const pc = new RTCPeerConnection(ICE), rec = {pc, conn:null, early:[]}; HOST.peers.set(key, rec);
    const drop = () => { if(!HOST.peers.has(key)) return; HOST.peers.delete(key); if(rec.conn) rec.conn.drop(); try{ pc.close(); }catch(e){} if(UI.screen === 'online') render(); };
    pc.onicecandidate = e => { if(e.candidate && HOST.sig) HOST.sig.send({type:'CANDIDATE', dst:src, payload:{cid:p.cid, candidate:e.candidate}}); };
    pc.onconnectionstatechange = () => { if(['failed', 'closed', 'disconnected'].includes(pc.connectionState)) setTimeout(() => { if(pc.connectionState !== 'connected') drop(); }, pc.connectionState === 'disconnected' ? 8000 : 0); };
    pc.ondatachannel = e => {
      const dc = e.channel;
      dc.onopen = () => { rec.conn = HOST.core.connect(o => dcSend(dc, JSON.stringify(o)), () => { dc.close(); drop(); }); if(UI.screen === 'online') render(); };
      dc.onmessage = (read => e2 => read(e2.data))(dcReader(t => { let msg; try{ msg = JSON.parse(t); }catch(err){ return; } if(rec.conn) rec.conn.receive(msg); }));
      dc.onclose = drop;
    };
    setTimeout(() => { if(!rec.conn) drop(); }, 30000);
    try{
      await pc.setRemoteDescription(p.sdp);
      for(const c of rec.early.splice(0)) pc.addIceCandidate(c).catch(() => {});
      await pc.setLocalDescription(await pc.createAnswer());
      HOST.sig.send({type:'ANSWER', dst:src, payload:{cid:p.cid, sdp:pc.localDescription}});
    }catch(e){ drop(); }
  } else if(m.type === 'CANDIDATE'){
    const rec = HOST.peers.get(key); if(!rec) return;
    if(rec.pc.remoteDescription) rec.pc.addIceCandidate(p.candidate).catch(() => {}); else rec.early.push(p.candidate);
  }
}
function stopHosting(){
  if(!HOST.core) return;
  const cfg = lsGet(HOST_KEY, {}) || {}; lsSet(HOST_KEY, Object.assign(cfg, {on:false}));
  if(HOST.sig) HOST.sig.close();
  for(const rec of HOST.peers.values()){ try{ rec.pc.close(); }catch(e){} }
  for(const tr of [...HOST.loops]) tr.close();
  if(HOST.saveT){ clearTimeout(HOST.saveT); try{ localStorage.setItem(HOST_DATA_KEY, JSON.stringify(HOST.core.store)); }catch(e){} }
  Object.assign(HOST, {core:null, status:'off', err:'', sig:null, peers:new Map(), loops:new Set(), retry:0});
  if(HOST.wake){ HOST.wake.release().catch(() => {}); HOST.wake = null; }
  if(NET.server && NET.server.url === 'p2p:' + HOST.code) disconnectServer();
  render();
}
// Phones pause pages whose screen turns off, which would close the village, so keep the screen awake while hosting.
async function keepAwake(){
  if(!HOST.core || HOST.wake || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try{ HOST.wake = await navigator.wakeLock.request('screen'); HOST.wake.addEventListener('release', () => { HOST.wake = null; }); }catch(e){}
}
document.addEventListener('visibilitychange', keepAwake);
const inviteLink = () => location.origin + location.pathname + '?join=' + HOST.code;

async function initServers(){
  const known = new Map();
  // A server that serves the game itself is joined automatically.
  if(/^https?:$/.test(location.protocol)){
    try{ const r = await fetch('api/info', {cache:'no-store'}); const j = r.ok && await r.json(); if(j && j.tsukimori){ const u = normServerUrl(location.host + location.pathname.replace(/\/[^/]*$/, '')); known.set(u, {url:u, name:j.name, here:true}); if(lsGet(SERVER_KEY, null) === null) lsSet(SERVER_KEY, u); } }catch(e){}
    try{ const r = await fetch('servers.json', {cache:'no-store'}); const j = r.ok && await r.json(); for(const x of (j && j.servers) || []){ const u = normServerUrl(x.url); if(u && !known.has(u)) known.set(u, {url:u, name:String(x.name || u).slice(0, 40), desc:String(x.description || '').slice(0, 120), community:true}); } }catch(e){}
  }
  NET.list = [...known.values()];
  // An invite link (?join=CODE) joins that village; a host that was hosting picks up where it left off.
  const q = new URLSearchParams(location.search), join = normServerUrl(q.get('join') || '');
  if(q.has('join')){ q.delete('join'); try{ history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }catch(e){} }
  const host = lsGet(HOST_KEY, {}) || {};
  if(host.on && !join) startHosting();
  else if(join) connectServer(join);
  else { const saved = lsGet(SERVER_KEY, ''); if(saved) connectServer(saved, true); }
  if(UI.screen === 'online') render();
}
function serverRows(){
  const mine = lsGet(SERVERS_KEY, []), all = [...NET.list], seen = new Set(all.map(x => x.url));
  if(HOST.core) seen.add('p2p:' + HOST.code);
  for(const x of mine) if(x && x.url && !seen.has(x.url)){ all.push({url:x.url, name:x.name, saved:true}); seen.add(x.url); }
  return all;
}
function hostHTML(){
  if(!HOST.core) return `<div class="srv-hostbox"><h4>📱 Host on this device</h4>
    <p class="muted">Turn this phone, tablet or computer into a village. Friends join with a code, nothing to install. It stays open while this page does, so keep the screen on.</p>
    <button class="btn primary" data-act="hostStart">Start hosting</button></div>`;
  const n = HOST.peers.size, st = HOST.status;
  return `<div class="srv-hostbox on"><h4>📱 You're hosting</h4>
    <div class="srv-now"><span class="srv-dot ${st === 'online' ? 'online' : st === 'error' ? 'offline' : 'connecting'}"></span><div><b>Village code <span class="host-code">${HOST.code}</span></b>
      <small>${st === 'online' ? `Open for players, ${n} connected${HOST.wake ? ', screen kept awake' : ''}` : st === 'error' ? esc(HOST.err) : 'Opening the gates…'}</small></div></div>
    <div class="res-acts" style="margin-top:8px"><button class="btn sm primary" data-act="hostShare">${navigator.share ? 'Share invite' : 'Copy invite link'}</button><button class="btn sm bad" data-act="hostStop">Stop hosting</button></div>
    <small class="muted" style="display:block;margin-top:6px">Friends tap the invite link, or type the code into the box above. Keep this page open and your screen on; if the page closes, the village closes too (its leaderboard is kept for next time).</small></div>`;
}
function serversHTML(){
  if(NET.mode === 'claude') return '';
  const sv = NET.server, rows = serverRows();
  const status = !sv ? '<p class="muted">You\'re playing offline. Join a server to meet other ninja, climb a shared leaderboard and raid together.</p>'
    : `<div class="srv-now"><span class="srv-dot ${sv.status}"></span><div><b>${esc(sv.info ? sv.info.name : sv.url)}</b><small>${sv.status === 'online' ? `Connected, <span class="net-n">${NET.peers.filter(p => !p.isMe).length}</span> other ninja here` : sv.status === 'connecting' ? 'Connecting…' : 'Connection lost, retrying…'}</small>${sv.info && sv.info.motd ? `<small class="srv-motd">📣 ${esc(sv.info.motd)}</small>` : ''}</div><button class="btn sm" data-act="srvLeave">Leave</button></div>`;
  return `<div class="panel srv"><h3>🌐 Servers</h3>${status}
    ${rows.length ? `<div class="stack" style="margin-top:8px">${rows.map(x => `<div class="lb"><span class="lb-n">${x.here ? '🏠' : x.community ? '🌍' : /^p2p:/.test(x.url) ? '📱' : '⭐'}</span><span><b>${esc(x.name || x.url)}</b><br><small class="muted">${esc(x.desc || (/^p2p:/.test(x.url) ? 'Village code ' + x.url.slice(4) : x.url))}</small></span><span></span>${sv && sv.url === x.url ? '<span class="owned">✓ Joined</span>' : `<button class="btn sm primary" data-act="srvJoin" data-arg="${esc(x.url)}">Join</button>`}${x.saved ? `<button class="btn sm ghost" data-act="srvForget" data-arg="${esc(x.url)}" aria-label="Forget this server">✕</button>` : ''}</div>`).join('')}</div>` : ''}
    <div class="g-in" style="margin-top:10px"><input id="srv-in" placeholder="Village code or server address" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn primary" data-act="srvAdd">Join</button></div>
    ${hostHTML()}
    <details class="srv-host"><summary>Run a dedicated server (always on)</summary>
      <p>The server is one file with no dependencies. With <a href="https://nodejs.org" target="_blank" rel="noopener">Node.js 18+</a>:</p>
      <pre>git clone https://github.com/Mofferato/tsukimori
cd tsukimori
node server/server.js</pre>
      <p>Friends on your network open <code>http://&lt;your-ip&gt;:8787</code> and are joined automatically. To let anyone in, run it on a host with HTTPS (Render, Fly.io, Railway or any VPS; a <code>Dockerfile</code> is included), then share its <code>wss://</code> address or add it to <code>servers.json</code> with a pull request.</p>
      <p>On an Android phone you can run it in <a href="https://termux.dev" target="_blank" rel="noopener">Termux</a>: <code>pkg install nodejs git</code>, then the commands above.</p>
      <p class="muted">Set <code>SERVER_NAME</code> and <code>MOTD</code> to name your village and greet players.</p></details></div>`;
}
function netChanged(){
  const scr = UI.screen;
  const el = id => document.getElementById(id);
  if(el('net-village')) el('net-village').innerHTML = villagePeersHTML();
  if(el('net-online')) el('net-online').innerHTML = onlineListHTML();
  if(el('net-chat')){ el('net-chat').innerHTML = chatHTML(); el('net-chat').scrollTop = 1e6; }
  if(el('net-board')) el('net-board').innerHTML = boardHTML();
  if(el('net-raid')) el('net-raid').innerHTML = raidHTML();
  if(el('net-hire')) el('net-hire').innerHTML = hireHTML();
  if(el('net-fame')) el('net-fame').innerHTML = fameHTML();
  if(el('net-count')) el('net-count').textContent = NET.peers.filter(p => !p.isMe).length;
  document.querySelectorAll('.net-n').forEach(x => { x.textContent = NET.peers.filter(p => !p.isMe).length; });
}
function presence(){
  if(!NET.room || !S || !S.char) return;
  const c = S.char, p = {name:c.name, level:c.level, element:c.element, look:c.look, screen:UI.screen === 'battle' ? 'battle' : 'village', rank:rankOf(c.level).name, squad:activeSquad().length};
  const k = JSON.stringify(p); if(k === NET.lastPresence) return; NET.lastPresence = k;
  NET.room.presence(p).catch(() => {});
}
function buildOf(c){ return {name:c.name, element:c.element, level:c.level, look:c.look, alloc:c.alloc, equip:c.equip, skills:c.skills, loadout:c.loadout, pets:c.pet ? [c.pet] : [], pet:c.pet, bond:c.pet ? {[c.pet]:c.bond[c.pet] || 0} : {}, clan:c.clan}; }
function publishEcho(){
  if(!NET.db || !NET.uid || !S || !S.char) return;
  const c = S.char;
  const sq = activeSquad(), build = Object.assign(buildOf(c), {squad:sq.map(r => ({name:r.name, element:r.element, level:r.level, look:r.look, alloc:r.alloc, equip:r.equip, skills:r.skills, loadout:r.loadout}))});
  NET.db.doc('echoes/' + NET.uid).set({name:c.name, level:c.level, element:c.element, rating:S.arena.rating, power:buildPower(c, sq), squad:sq.length, build:JSON.stringify(build), updatedAt:Date.now()}).catch(() => {});
}
function publishRaid(){
  if(!NET.db || !NET.uid) return;
  const ev = S.event;
  NET.db.doc('raidhits/' + NET.uid).set({week:ev.week, bossId:ev.bossId, dmg:ev.dmg, pct:+(ev.dmg / ev.pool * 100).toFixed(2), name:S.char.name, updatedAt:Date.now()}).catch(() => {});
}
async function cloudSave(){ if(!NET.db || !NET.uid) return toast('Cloud save needs a server connection'); try{ await NET.db.doc(`data/users/${NET.uid}/save`).set({json:JSON.stringify(S), savedAt:Date.now()}); toast('Saved to the cloud'); }catch(e){ toast('Cloud save failed: ' + e.message); } }
async function cloudLoad(){
  if(!NET.db || !NET.uid) return toast('Cloud save needs a server connection');
  try{ const d = await NET.db.doc(`data/users/${NET.uid}/save`).get(); if(!d.exists) return toast('No cloud save yet'); S = migrate(JSON.parse(d.data().json)); persist(); go('hub'); toast('Cloud save loaded'); }
  catch(e){ toast('Could not load: ' + e.message); }
}
function echoGhost(e){
  try{ const g = normChar(JSON.parse(e.build)); g.archetype = 'Real player'; g.diff = clamp(g.level - S.char.level, -2, 3); return g; }catch(err){ return null; }
}
function villagePeersHTML(){
  return NET.peers.slice(0, 12).map(p => {
    const pr = p.presence, x = 8 + hashN(p.peer, 80), y = 62 + hashN(p.peer + 'y', 22);
    return `<div class="vpeer ${p.isMe ? 'me' : ''}" style="left:${x}%;top:${y}%" id="vp-${esc(p.peer)}"><div class="vp-sprite">${ninjaSVG(pr.look || {}, {}, {scarf:(ELEMENTS[pr.element] || ELEMENTS.fire).color})}</div><span>${p.isMe ? 'You' : esc(String(pr.name).slice(0, 12))}</span></div>`;
  }).join('');
}
function showEmote(peer, emoji){
  const el = document.getElementById('vp-' + peer) || document.getElementById('op-' + peer);
  if(!el) return;
  const b = document.createElement('div'); b.className = 'emote-pop'; b.textContent = emoji; el.appendChild(b); setTimeout(() => b.remove(), 1800);
}
function onlineListHTML(){
  const others = NET.peers.filter(p => !p.isMe);
  if(!NET.room) return '<p class="muted">Join a server above to see who else is in the village. You can still share builds with the Echo Arena\'s copy-and-paste.</p>';
  if(!others.length) return '<p class="muted">No one else is in the village right now. Share the game with friends so they can join!</p>';
  return others.map(p => { const pr = p.presence, e = NET.echoes.find(x => x.id === p.by);
    return `<div class="panel oprow" id="op-${esc(p.peer)}"><span class="op-face">${ninjaSVG(pr.look || {}, {}, {viewBox:'18 20 84 84', scarf:(ELEMENTS[pr.element] || ELEMENTS.fire).color})}</span>
      <div><b>${esc(String(pr.name).slice(0, 16))}</b><small>${esc(String(pr.rank || ''))}, level ${pr.level | 0}${pr.squad ? `, 👥 +${pr.squad | 0}` : ''}${pr.screen === 'battle' ? ', in battle ⚔️' : ''}${p.guest ? ', guest' : ''}</small></div>
      <div class="op-acts">${e ? `<button class="btn sm primary" data-act="fightEcho" data-arg="${esc(e.id)}">Duel echo</button>` : ''}</div></div>`; }).join('');
}
function chatHTML(){
  if(!NET.chat.length) return '<p class="muted">Shouts from ninja in the village appear here. Messages are not saved.</p>';
  return NET.chat.map(m => `<div class="shout ${m.me ? 'me' : ''}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('');
}
function boardHTML(){
  if(!NET.db) return '<p class="muted">Join a server to see its leaderboard.</p>';
  if(!NET.echoes.length) return '<p class="muted">No ninja have posted an echo yet. Play a battle to post yours!</p>';
  return NET.echoes.slice(0, 20).map((e, i) => `<div class="lb ${e.id === NET.uid ? 'me' : ''}"><span class="lb-n">${i + 1}</span><span>${ELEMENTS[e.element] ? ELEMENTS[e.element].icon : ''} <b>${esc(String(e.name).slice(0, 16))}</b> <small class="muted">Lv ${e.level | 0}${e.squad ? `, 👥 squad of ${1 + (e.squad | 0)}` : ''}</small></span><span class="lb-r">${e.rating | 0}</span>
    ${e.id !== NET.uid ? `<button class="btn sm" data-act="fightEcho" data-arg="${esc(e.id)}">Duel</button>` : '<span class="muted" style="font-size:12px">you</span>'}</div>`).join('');
}
function raidTotals(){
  const ev = S.event, hits = NET.raid.filter(h => h.week === ev.week && h.bossId === ev.bossId);
  return {hits:hits.sort((a, b) => b.pct - a.pct), total:hits.reduce((a, h) => a + (+h.pct || 0), 0)};
}
const COMMUNITY_GOALS = [{pct:100, shards:10}, {pct:300, shards:20}, {pct:600, shards:40}];
function raidHTML(){
  if(!NET.db) return '<p class="muted">Join a server in the Village Square for community raids: everyone\'s damage adds up toward shared rewards.</p>';
  const {hits, total} = raidTotals(), ev = S.event; ev.commClaimed = ev.commClaimed || [];
  return `<p>All ninja together have dealt <b>${total.toFixed(0)}%</b> of a boss's health this week.</p>
    ${COMMUNITY_GOALS.map((g, i) => { const got = ev.commClaimed.includes(i), ok = total >= g.pct; return `<div class="ms ${got ? 'done' : ''}"><span class="pct">${g.pct}%</span><span>Community goal: 🔴 ${g.shards} shards each</span><button class="btn sm ${ok && !got ? 'primary' : ''}" data-act="commClaim" data-arg="${i}" ${ok && !got ? '' : 'disabled'}>${got ? 'Claimed' : ok ? 'Claim' : 'Locked'}</button></div>`; }).join('')}
    <div style="margin-top:8px">${hits.slice(0, 8).map((h, i) => `<div class="lb ${h.id === NET.uid ? 'me' : ''}"><span class="lb-n">${i + 1}</span><span><b>${esc(String(h.name).slice(0, 16))}</b></span><span class="lb-r">${(+h.pct).toFixed(1)}%</span></div>`).join('')}</div>`;
}
function onlineScreen(){
  return `<section><h2 class="scr-title">🏮 Village Square</h2>
    <p class="note">${NET.room ? `<b id="net-count">${NET.peers.filter(p => !p.isMe).length}</b> other ninja online right now.` : 'Playing offline.'} Wave, shout and duel the echoes of real players.</p>
    ${serversHTML()}
    ${NET.room ? `<div class="emote-row">${['👋','😆','🎉','🔥','💪','🙏','😭','🌙'].map(e => `<button class="emo" data-act="emote" data-arg="${e}" aria-label="Send ${e}">${e}</button>`).join('')}</div>` : ''}
    <div id="net-online" class="stack">${onlineListHTML()}</div>
    ${NET.room ? `<h3 class="sub">Shouts</h3><div class="panel"><div id="net-chat" class="chatbox">${chatHTML()}</div>
      <div class="g-in"><input id="shout-in" maxlength="140" placeholder="Shout to the village…" autocomplete="off"><button class="btn primary" data-act="shout">Shout</button></div></div>` : ''}
    <h3 class="sub">Echo leaderboard</h3><div class="panel" id="net-board">${boardHTML()}</div>
  </section>`;
}
