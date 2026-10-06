
/* ============================ UI SHELL ============================ */
function go(screen){ UI.screen = screen; UI.itemPanel = false; closeModal(); render(); window.scrollTo(0, 0); }
function render(){
  const scr = UI.screen, hud = $('#hud');
  const hudOn = S && S.char && !['title','create','battle'].includes(scr);
  hud.innerHTML = hudOn ? hudHTML() : ''; hud.style.display = hudOn ? '' : 'none';
  if(scr === 'battle'){ renderBattle(); renderGuide(); presence(); return; }
  const R = {title:titleScreen, create:createScreen, hub:hubScreen, missions:missionScreen, academy:academyScreen, shop:shopScreen, home:homeScreen, character:charScreen, results:resultsScreen, system:systemScreen, den:denScreen, clan:clanScreen, squad:squadScreen, recruit:recruitScreen, arena:arenaScreen, event:eventScreen, journal:journalScreen, online:onlineScreen, custom:customScreen};
  $('#main').innerHTML = (R[scr] || hubScreen)();
  document.querySelectorAll('.tabs .tab.on').forEach(t => { const p = t.parentElement; if(p) p.scrollLeft = t.offsetLeft - (p.clientWidth - t.clientWidth) / 2; }); // keep the active tab in view
  renderGuide(); presence(); netChanged();
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1900); }
function showModal(title, html, btns){
  $('#modal-card').innerHTML = `<h3>${title}</h3>${html}<div class="modal-btns">${btns.map(b => `<button class="btn ${b.cls || ''}" data-act="${b.act}" data-arg="${b.arg || ''}">${b.label}</button>`).join('')}</div>`;
  $('#modal').classList.remove('hidden');
  const f = $('#modal-card .btn.primary, #modal-card .btn'); if(f) f.focus();
}
function closeModal(){ $('#modal').classList.add('hidden'); }
const xpPct = c => c.level >= MAX_LEVEL ? 100 : c.xp / xpToNext(c.level) * 100;

function hudHTML(){
  const c = S.char, r = rankOf(c.level), on = s => UI.screen === s ? 'on' : '';
  return `<div class="hud-in">
    <button class="hud-id" data-act="go" data-arg="character" aria-label="Open character sheet">
      <span class="face">${ninjaSVG(c.look, {}, {viewBox:'18 20 84 84', scarf:ELEMENTS[c.element].color})}</span>
      <span class="hud-txt"><b>${esc(c.name)}</b><small>${r.name}, level ${c.level}${c.points ? ` <em>+${c.points} points</em>` : ''}</small>
      <span class="bar xp thin" title="XP ${c.xp}/${xpToNext(c.level)}"><i style="width:${xpPct(c)}%"></i></span></span>
    </button>
    <div class="hud-gold" title="Gold">🪙 ${c.gold}</div>
    <nav class="hud-nav" aria-label="Main">
      <button data-act="go" data-arg="hub" class="${on('hub')}"><span>🏯</span><span>Village</span></button>
      <button data-act="go" data-arg="character" class="${on('character')}"><span>👤</span><span>Ninja</span></button>
      <button data-act="go" data-arg="journal" class="${on('journal')}"><span>📓</span><span>Journal</span></button>
      <button data-act="go" data-arg="system" class="${on('system')}"><span>💾</span><span>Save</span></button>
    </nav></div>`;
}

/* ============================ SHARED PANELS ============================
   Used by the leader's screens and by each squadmate's screen. `who` is 'leader' or a recruit id. */

// ---- talents ----
function talentPanelHTML(c, who){
  const un = talentsUnpicked(c);
  return `<div class="panel talents"><div class="tal-head"><small class="muted">One talent per tier, unlocked by level (${TALENT_TIERS.join(', ')}). ${un ? `<b class="hl">${un} tier${un > 1 ? 's' : ''} waiting for a pick.</b> ` : ''}Changing a pick costs 🪙 ${talentSwapCost(c)}.</small>
    <button class="btn sm" data-act="talentAuto" data-arg="${who}">🤖 Auto-pick</button></div>
    ${TALENT_TIERS.map((lv, i) => {
      const locked = c.level < lv, cur = (c.talents || [])[i];
      return `<div class="tal-tier ${locked ? 'locked' : ''}"><div class="tal-lv">${locked ? '🔒' : cur ? '✓' : '★'} Level ${lv}</div><div class="tal-opts">${TALENTS.filter(t => t.tier === i).map(t =>
        `<button class="tal ${cur === t.id ? 'on' : ''}" data-act="talent" data-arg="${who}:${i}:${t.id}" ${locked ? 'disabled' : ''} aria-pressed="${cur === t.id}"><span class="tal-ic">${t.icon}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div></div>`;
    }).join('')}</div>`;
}

// ---- techniques ----
const TECH_TABS = [...EL_ORDER, 'taijutsu', 'genjutsu', 'kinjutsu'];
const techsFor = tab => SKILLS.filter(s => !s.enemyOnly && !s.petOnly && (ELEMENTS[tab] ? s.type === 'ninjutsu' && s.el === tab : s.type === tab));
function techTabsHTML(active, key, c){
  return `<div class="tabs" role="tablist">${TECH_TABS.map(t => {
    const el = ELEMENTS[t], col = el ? el.color : TECH_TYPES[t].color, label = el ? `${el.icon} ${el.name}${t === c.element ? ' ★' : ''}` : `${TECH_TYPES[t].icon} ${TECH_TYPES[t].name}`;
    return `<button class="tab ${t === active ? 'on' : ''}" style="--c:${col}" data-act="tab" data-arg="${key}:${t}" role="tab" aria-selected="${t === active}">${label}</button>`; }).join('')}</div>`;
}
function loadoutHTML(c, who){
  const lead = who === 'leader', act = lead ? 'toggleLoad' : 'loadR', arg = id => lead ? id : `${who}:${id}`;
  return `<div class="panel loadout"><div class="lo-head"><b>Battle loadout</b><small>${c.loadout.length} of ${MAX_LOADOUT} slots. Tap a slot to remove it.</small><button class="btn sm" data-act="bestLoadout" data-arg="${who}">🤖 Best loadout</button></div>
    <div class="lo-slots">${Array.from({length:MAX_LOADOUT}, (_, i) => { const s = SKILL[c.loadout[i]];
      return s ? `<button class="lo-slot" style="--c:${skillColor(s)}" data-act="${act}" data-arg="${arg(s.id)}" aria-label="Remove ${s.name}">${s.icon}<small>${s.name}</small></button>` : `<div class="lo-slot empty">empty</div>`; }).join('')}</div></div>`;
}
function skillCardHTML(s, c, who, U){
  const lead = who === 'leader', own = c.skills.includes(s.id), inLo = c.loadout.includes(s.id), lock = c.level < s.lvl, price = skillPrice(s, c), arg = lead ? s.id : `${who}:${s.id}`;
  let btn;
  if(own) btn = `<button class="btn sm ${inLo ? '' : 'primary'}" data-act="${lead ? 'toggleLoad' : 'loadR'}" data-arg="${arg}">${inLo ? 'Unequip' : 'Equip'}</button>`;
  else if(lock) btn = `<button class="btn sm" disabled>🔒 Level ${s.lvl}</button>`;
  else btn = `<button class="btn sm primary" data-act="${lead ? 'learn' : 'learnR'}" data-arg="${arg}" ${S.char.gold < price ? 'disabled' : ''}>Learn for 🪙 ${price}</button>`;
  const dmg = s.power ? previewDamage(U, s, null) : 0, ty = TECH_TYPES[s.type];
  return `<article class="panel skill ${lock && !own ? 'locked' : ''}" style="--c:${skillColor(s)}"><div class="sk-ic">${s.icon}</div>
    <div class="sk-body"><h4>${s.name}<small>Lv ${s.lvl}</small></h4><p>${s.desc}</p>
      <div class="tags"><span class="tag cp">${s.cp} CP</span><span class="tag">${s.cd}-turn cooldown</span>${s.type !== 'ninjutsu' ? `<span class="tag">${ty.icon} ${ty.name}</span>` : ''}${dmg ? `<span class="tag dmg">≈${dmg} dmg${s.hits > 1 ? ' total' : ''}${s.target === 'allEnemies' ? ' each' : ''}</span>` : ''}${skillTags(s).map(t => `<span class="tag">${t}</span>`).join('')}</div></div>
    <div class="sk-act">${own ? `<span class="owned">✓ Learned</span>` : ''}${btn}</div></article>`;
}
// mode 'academy' (the leader) or 'recruit'
function techSectionHTML(c, who, mode){
  const key = mode === 'recruit' ? 'recruit' : 'academy', tab = TECH_TABS.includes(UI.tab[key]) ? UI.tab[key] : c.element;
  const U = unitFromChar(c, 'ai', 'ally');
  const note = ELEMENTS[tab] ? (tab === c.element ? '★ Affinity element: techniques cost the standard price.' : 'Off-affinity ninjutsu costs double, but lets you cover your weak matchups.') : TECH_TYPES[tab].blurb + ' Same price for every ninja.';
  return loadoutHTML(c, who) + techTabsHTML(tab, key, c) + `<p class="note">${note} "≈ dmg" is the typical hit with this ninja's stats.</p><div class="stack">${techsFor(tab).map(s => skillCardHTML(s, c, who, U)).join('')}</div>`;
}

// ---- appearance ----
const MASK_COLORS = ['#3a3030', '#1f2a24', '#cfd2e6', '#8a95a3', '#b8363a', '#6b4a8c'];
const BAND_COLORS = ['#27305e', '#b8363a', '#2f6f4f', '#d9a22b', '#2c2c38', '#8a3fbf', '#e7e3f0'];
const hex6 = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#888888';
function customScreen(){
  const who = UI.custWho || 'leader', c = ninjaById(who); if(!c) return hubScreen();
  const L = c.look, E = ELEMENTS[c.element];
  const A = (k, v) => `data-act="lookSet" data-arg="${k}:${v}"`;
  const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${(cur == null ? L[key] : cur) === v ? 'on' : ''}" ${A(key, v)} aria-pressed="${(cur == null ? L[key] : cur) === v}">${l}</button>`).join('')}</div>`;
  const sw = (key, list) => `<div class="swatches" role="group">${list.map(v => `<button class="sw ${L[key] === v ? 'on' : ''}" style="--c:${v}" ${A(key, v)} aria-label="${key} color ${v}" aria-pressed="${L[key] === v}"></button>`).join('')}<label class="sw custom" title="Pick any color"><input type="color" data-look="${key}" value="${hex6(L[key])}" aria-label="Custom ${key} color"><span>＋</span></label></div>`;
  return `<section><h2 class="scr-title">✏️ Name and appearance</h2>
    <button class="btn sm ghost" data-act="custBack">← Back</button>
    <div class="create-grid" style="margin-top:10px">
      <div class="panel preview" style="--c:${E.color}"><div class="preview-sprite">${ninjaSVG(L, gearLooks(c), {scarf:E.color})}</div><div class="preview-name">${esc(c.name)}</div>
        <span class="chip" style="--c:${E.color}">${E.icon} ${E.name} affinity</span><small class="muted">Your element and gear stay the same.</small></div>
      <div class="panel">
        <div class="fld"><span>Name</span><div class="name-row"><input id="cust-name" maxlength="16" value="${esc(c.name)}" autocomplete="off" aria-label="Name"><button class="btn sm primary" data-act="renameApply">Save name</button></div></div>
        <div class="fld"><span>Body</span>${seg('gender', [['m', 'Boy'], ['f', 'Girl']])}</div>
        <div class="fld"><span>Hairstyle</span>${seg('hairStyle', HAIR_STYLES.map(h => [h.id, h.name]))}</div>
        <div class="fld"><span>Hair color</span>${sw('hair', HAIR_COLORS)}</div>
        <div class="fld"><span>Outfit color</span>${sw('outfit', OUTFIT_COLORS)}</div>
        <div class="fld"><span>Eyes</span>${sw('eyes', EYE_COLORS)}</div>
        <div class="fld"><span>Skin</span>${sw('skin', SKIN_TONES)}</div>
        <div class="fld"><span>Headband</span>${seg('band', [['show', 'Worn'], ['none', 'None']], L.band === 'none' ? 'none' : 'show')}${L.band === 'none' ? '' : sw('bandColor', BAND_COLORS)}</div>
        <div class="fld"><span>Face wrap</span><div class="swatches"><button class="sw none ${L.mask ? '' : 'on'}" ${A('mask', 'none')} aria-label="No face wrap" aria-pressed="${!L.mask}">✕</button>${MASK_COLORS.map(v => `<button class="sw ${L.mask === v ? 'on' : ''}" style="--c:${v}" ${A('mask', v)} aria-label="Face wrap ${v}" aria-pressed="${L.mask === v}"></button>`).join('')}</div></div>
        <button class="btn sm" data-act="lookRandom">🎲 Surprise me</button>
      </div>
    </div></section>`;
}

/* ============================ SCREENS ============================ */
function titleScreen(){
  const saved = loadLocal(), has = saved && saved.char, others = slotIndex().list.filter(e => e.id !== activeSlot());
  return `<section class="title">
    <div class="title-art"><div class="moonbg"></div><div class="title-ninja">${ninjaSVG({gender:'m',hairStyle:'spiky',hair:'#2b2b3a',outfit:'#27347f',eyes:'#3b6fd6',skin:'#f3d2b3'}, {weapon:{w:'sword'}, back:{b:'scroll'}}, {scarf:'#e8553a'})}</div></div>
    <h1>Tsukimori<small>A moon-forest ninja RPG</small></h1>
    <p class="lede">Train at the academy, master the five elements and climb from Lantern Pupil to Eclipse Warden.</p>
    <div class="title-btns">
      ${has ? `<button class="btn primary big" data-act="continue">Continue as ${esc(saved.char.name)} (Lv ${saved.char.level | 0})</button>` : ''}
      ${others.length ? `<div class="slot-list">${others.map(slotRowHTML).join('')}</div>` : ''}
      <button class="btn ${has || others.length ? '' : 'primary'} big" data-act="newSlot">Create a new ninja</button>
      <button class="btn ghost" data-act="go" data-arg="system">Import a save</button>
    </div>${has || others.length ? '<p class="muted center" style="margin-top:6px">A new ninja gets its own save. Your other ninja are kept.</p>' : ''}</section>`;
}
// One row in a list of saves: face, name and level, plus Play (and Delete where offered).
function slotRowHTML(e, withDelete){
  const E = ELEMENTS[e.element] || ELEMENTS.fire, cur = S && S.char && e.id === activeSlot();
  return `<div class="panel slot-row ${cur ? 'cur' : ''}"><span class="op-face">${ninjaSVG(e.look || {}, {}, {viewBox:'18 20 84 84', scarf:E.color})}</span>
    <div><b>${esc(String(e.name || 'Nameless').slice(0, 16))}</b><small>${E.icon} Level ${e.level | 0}${cur ? ', playing now' : ''}</small></div>
    <div class="op-acts">${cur ? '' : `<button class="btn sm primary" data-act="playSlot" data-arg="${esc(e.id)}">Play</button>`}${withDelete ? `<button class="btn sm" data-act="askDelSlot" data-arg="${esc(e.id)}" aria-label="Delete ${esc(e.name)}">Delete</button>` : ''}</div></div>`;
}
function createScreen(){
  const c = UI.create, E = ELEMENTS[c.element];
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${c[key] === v ? 'on' : ''}" data-act="cset" data-arg="${key}:${v}" aria-pressed="${c[key] === v}">${l}</button>`).join('')}</div>`;
  const sw = (key, list) => `<div class="swatches" role="group">${list.map(v => `<button class="sw ${c[key] === v ? 'on' : ''}" style="--c:${v}" data-act="cset" data-arg="${key}:${v}" aria-label="${key} color ${v}" aria-pressed="${c[key] === v}"></button>`).join('')}</div>`;
  return `<section>
    <h2 class="scr-title">Create your ninja</h2>
    <div class="create-grid">
      <div class="panel preview" style="--c:${E.color}">
        <div class="preview-sprite">${ninjaSVG(c, {weapon:ITEM.kunai_train.look}, {scarf:E.color})}</div>
        <div class="preview-name">${esc(c.name || 'Your name')}</div>
        <span class="chip" style="--c:${E.color}">${E.icon} ${E.name} affinity</span>
      </div>
      <div class="panel">
        <label class="fld"><span>Name</span><input id="cname" maxlength="16" value="${esc(c.name)}" placeholder="e.g. Hikaru" autocomplete="off"></label>
        <div class="fld"><span>Body</span>${seg('gender', [['m','Boy'],['f','Girl']])}</div>
        <div class="fld"><span>Hairstyle</span>${seg('hairStyle', HAIR_STYLES.map(h => [h.id, h.name]))}</div>
        <div class="fld"><span>Hair color</span>${sw('hair', HAIR_COLORS)}</div>
        <div class="fld"><span>Outfit color</span>${sw('outfit', OUTFIT_COLORS)}</div>
        <div class="fld"><span>Eyes</span>${sw('eyes', EYE_COLORS)}</div>
        <div class="fld"><span>Skin</span>${sw('skin', SKIN_TONES)}</div>
      </div>
    </div>
    <h3 class="sub">Starting element</h3>
    <div class="el-grid">${EL_ORDER.map(e => { const X = ELEMENTS[e]; return `<button class="el-card ${c.element === e ? 'on' : ''}" style="--c:${X.color}" data-act="cset" data-arg="element:${e}" aria-pressed="${c.element === e}">
      <span class="el-ic">${X.icon}</span><b>${X.name}</b><small>${X.style}</small><small class="beats">Strong vs ${ELEMENTS[X.beats].name}</small><small>Starts with ${SKILL[starterSkill(e)].name}</small></button>`; }).join('')}</div>
    <div class="panel wheel-wrap">${wheelSVG(c.element)}<div><h3>The counter wheel</h3><p class="muted">Follow the arrows: each element deals 25% more damage to the one it points at, and 25% less to the one pointing at it. Your affinity also sets your defensive element.</p></div></div>
    <p class="muted center" style="margin-top:14px">You start with 120 gold, a training kunai, 3 salves and 2 chakra pills.</p>
    <button class="btn primary big wide" data-act="createDone">Enter Tsukimori</button>
  </section>`;
}
function hubScreen(){
  const c = S.char;
  const b = (to, ic, t, d, lvl) => `<button class="hub-btn" data-act="go" data-arg="${to}"><span class="hi">${ic}</span><span><b>${t}</b><small>${lvl && c.level < lvl ? `🔒 Opens at level ${lvl}` : d}</small></span></button>`;
  syncEvent(); syncDaily();
  const ev = S.event, boss = ENEMY[ev.bossId];
  return `<section>
    <div class="village-wrap">${villageSVG()}<div id="net-village" class="net-village" aria-hidden="true"></div></div>
    ${c.points ? `<div class="panel notice" data-act="go" data-arg="character" role="button" tabindex="0">⬆️ You have ${c.points} unspent stat points. Tap to allocate them.</div>` : ''}
    ${talentsUnpicked(c) ? `<div class="panel notice" data-act="go" data-arg="character" role="button" tabindex="0">🌟 You have ${talentsUnpicked(c)} talent pick${talentsUnpicked(c) > 1 ? 's' : ''} waiting. Tap to choose.</div>` : ''}
    ${(S.squad.roster || []).filter(m => talentsUnpicked(m) && m.autoTech === false).map(m => `<div class="panel notice" data-act="manageR" data-arg="${m.id}" role="button" tabindex="0">🌟 ${esc(m.name)} has a talent pick waiting.</div>`).join('')}
    ${(S.squad.roster || []).filter(m => m.points).map(m => `<div class="panel notice" data-act="manageR" data-arg="${m.id}" role="button" tabindex="0">👥 ${esc(m.name)} has ${m.points} unspent stat points. Tap to allocate them.</div>`).join('')}
    <div class="hub-grid">
      ${b('missions','📜','Mission Board','Ranked missions for XP and gold')}
      ${b('academy','🏯','Academy','Learn and equip techniques')}
      ${b('shop','🏮','Shop','Weapons, garb and supplies')}
      ${b('home','🏠','Home','Inventory and equipment')}
      ${b('squad','🎌','Squad Lodge', activeSquad().length ? `Squad: ${activeSquad().map(r => esc(r.name)).join(', ')}` : 'Recruit and train teammates', 3)}
      ${b('den','🦊','Beast Den', c.pet ? `Partner: ${PET[c.pet].name}` : 'Adopt a pet partner', 3)}
      ${b('clan','⛩️','Clan Hall', c.clan ? `${CLAN[c.clan.id].name}, ${CLAN_TIERS[clanTier(c.clan.rep)].name}` : 'Join a clan for perks', 5)}
      ${b('arena','👥','Echo Arena', `${arenaTier(S.arena.rating).name}, rating ${S.arena.rating}`, 4)}
      ${b('event','🌕','Crimson Moon', `${boss.name.split(',')[0]}: ${Math.max(0, EVENT_TRIES - ev.tries)} tries left today`, EVENTS[0].lvl)}
      ${b('journal','📓','Journal', `${S.daily.quests.filter(q => !q.claimed && questProgress(q) >= q.n).length ? '✨ Quest rewards ready!' : 'Daily quests and achievements'}`)}
      ${b('online','🏮','Village Square', NET.room ? `${NET.peers.filter(p => !p.isMe).length} ninja online` : 'Multiplayer and leaderboard')}
    </div></section>`;
}
function lockedScreen(title, lvl, text){
  return `<section><h2 class="scr-title">${title}</h2><div class="panel lockbox"><div class="big">🔒</div><h3>Opens at level ${lvl}</h3><p class="muted">${text}</p><button class="btn primary" data-act="go" data-arg="missions">Find a mission</button></div></section>`;
}
function missionScreen(){
  const tab = UI.tab.missions, rk = MISSION_RANKS.find(r => r.id === tab), list = MISSIONS.filter(m => m.rank === tab);
  return `<section><h2 class="scr-title">📜 Mission Board</h2>
    <div class="tabs" role="tablist">${MISSION_RANKS.map(r => `<button class="tab ${r.id === tab ? 'on' : ''}" style="--c:${r.color}" data-act="tab" data-arg="missions:${r.id}" role="tab" aria-selected="${r.id === tab}">${r.id}-rank</button>`).join('')}</div>
    <div class="stack">${list.length ? list.map(missionCard).join('') : `<div class="panel empty">No ${tab}-rank missions are posted yet.<br><small>They open around level ${rk.lvl} as the village grows.</small></div>`}</div>
  </section>`;
}
function missionCard(m){
  const c = S.char, locked = c.level < m.lvl, clears = (S.missions[m.id] || {}).clears || 0, rc = MISSION_RANKS.find(r => r.id === m.rank).color;
  const stages = m.stages.map(st => `<div class="stage">${st.foes.map(([id, l]) => `<div class="mini flip" title="${esc(ENEMY[id].name)}, level ${l}">${miniSprite(id)}<small>Lv${l}</small></div>`).join('')}${st.boss ? '<span class="bosstag">BOSS</span>' : ''}</div>`).join('<span class="arrow">›</span>');
  return `<article class="panel mission ${locked ? 'locked' : ''}" style="--c:${rc}">
    <header><span class="rank-badge">${m.rank}</span><div><h3>${m.name}</h3><small>For the ${m.client.toLowerCase()}, recommended level ${m.lvl}</small></div></header>
    <p>${m.desc}</p>
    <div class="stages">${stages}</div>
    <div class="rewards"><span>✨ ${missionXp(m)} XP</span><span>🪙 ${missionGold(m)}</span>${m.firstClear && !clears ? `<span class="fc">🎁 First clear: ${m.firstClear.map(i => ITEM[i].name).join(', ')}</span>` : ''}${clears ? `<span>Cleared ${clears}×</span>` : ''}</div>
    <button class="btn primary" data-act="startMission" data-arg="${m.id}" ${locked ? 'disabled' : ''}>${locked ? `Reach level ${m.lvl} to accept` : 'Accept mission'}</button>
  </article>`;
}
function academyScreen(){
  const c = S.char;
  return `<section><h2 class="scr-title">🏯 Academy</h2>
    <p class="note">Five elements of ninjutsu, plus three element-free families: <b>🥋 Taijutsu</b> (cheap, many-hit), <b>🌀 Genjutsu</b> (illusions) and <b>☠️ Kinjutsu</b> (forbidden, costs health). Equip up to ${MAX_LOADOUT}.</p>
    ${techSectionHTML(c, 'leader', 'academy')}
    <div class="acts-row" style="margin-top:12px"><button class="btn primary sm" data-act="optMe">✨ Let the AI pick my techniques, talents and gear</button></div>
  </section>`;
}
function shopScreen(){
  const tab = UI.tab.shop, c = S.char, list = ITEMS.filter(i => i.slot === tab && i.shop !== false && !i.shards);
  return `<section><h2 class="scr-title">🏮 Shop</h2>
    <div class="tabs" role="tablist">${[...SLOTS, 'consumable'].map(sl => `<button class="tab ${sl === tab ? 'on' : ''}" data-act="tab" data-arg="shop:${sl}" role="tab" aria-selected="${sl === tab}">${SLOT_INFO[sl].icon} ${SLOT_INFO[sl].name}</button>`).join('')}</div>
    <div class="stack">${list.map(it => {
      const own = S.inventory[it.id] || 0, eq = c.equip[it.slot] === it.id, lock = c.level < it.lvl;
      return `<div class="panel item ${lock ? 'locked' : ''}"><div class="item-ic">${it.icon}</div>
        <div class="item-b"><b>${it.name}</b><small class="${it.bonus ? 'bonus' : ''}">${it.bonus ? fmtBonus(it.bonus) : it.desc}</small><small>${lock ? `Requires level ${it.lvl}` : ''}${own ? ` You own ${own}.` : ''}${eq ? ' Equipped.' : ''}</small></div>
        <div class="item-act"><button class="btn primary sm" data-act="buy" data-arg="${it.id}" ${lock || c.gold < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>
        ${it.slot === 'consumable' ? `<button class="btn sm" data-act="buy5" data-arg="${it.id}" ${lock || c.gold < it.price * 5 ? 'disabled' : ''}>Buy 5</button>` : ''}</div></div>`;
    }).join('')}</div></section>`;
}
function homeScreen(){
  const c = S.char, st = charStats(c);
  const inv = Object.keys(S.inventory).map(id => ITEM[id]).filter(Boolean).sort((a, b) => (a.slot === 'consumable') - (b.slot === 'consumable'));
  return `<section><h2 class="scr-title">🏠 Home</h2>
    <div class="home-grid">
      <div class="panel doll"><div class="doll-sprite">${playerSprite()}</div>
        <div class="mini-stats"><span>❤️ ${st.maxHp}</span><span>🔷 ${st.maxCp}</span><span>💨 ${st.agi}</span><span>⚔️ ${st.atk}</span></div></div>
      <div class="slots">${SLOTS.map(sl => { const it = ITEM[c.equip[sl]]; return `<div class="panel slot"><div class="item-ic">${it ? it.icon : SLOT_INFO[sl].icon}</div>
        <div><small>${SLOT_INFO[sl].name}</small><b>${it ? it.name : 'Empty'}</b>${it ? `<small class="bonus">${fmtBonus(it.bonus)}</small>` : '<small>Buy gear at the Shop</small>'}</div>
        ${it ? `<button class="btn sm" data-act="unequip" data-arg="${sl}">Remove</button>` : ''}</div>`; }).join('')}</div>
    </div>
    <div class="acts-row" style="margin-top:10px"><button class="btn primary sm" data-act="gearMe">🛒 Buy and equip my best gear</button><button class="btn sm" data-act="gearTeam">🛒 Gear up the whole team</button><small class="muted">Spends up to 90% of your gold on the best upgrades for each ninja.</small></div>
    <h3 class="sub">Inventory</h3>
    <div class="stack">${inv.length ? inv.map(it => { const val = Math.floor((it.price || 100) / 2), gear = it.slot !== 'consumable';
      return `<div class="panel item"><div class="item-ic">${it.icon}</div>
        <div class="item-b"><b>${it.name} ×${S.inventory[it.id]}</b><small class="${gear ? 'bonus' : ''}">${gear ? fmtBonus(it.bonus) : it.desc}</small>${gear && c.level < it.lvl ? `<small>Requires level ${it.lvl}</small>` : ''}</div>
        <div class="item-act">${gear ? `<button class="btn primary sm" data-act="equip" data-arg="${it.id}" ${c.level < it.lvl ? 'disabled' : ''}>Equip</button>` : ''}<button class="btn sm" data-act="sell" data-arg="${it.id}">Sell 🪙${val}</button></div></div>`; }).join('')
      : `<div class="panel empty">Your pack is empty. The Shop sells gear and supplies.</div>`}</div>
  </section>`;
}
function charScreen(){
  const c = S.char, st = charStats(c), r = rankOf(c.level);
  const row = (k, ic, name, val, help) => `<div class="srow"><span class="sic">${ic}</span><div><b>${name}</b><small>${help}. Points spent: ${c.alloc[k]}</small></div><span class="sv">${val}</span><button class="plus" data-act="alloc" data-arg="${k}" ${c.points ? '' : 'disabled'} aria-label="Add a point to ${name}">+</button></div>`;
  return `<section><h2 class="scr-title">👤 ${esc(c.name)}</h2>
    <div class="char-grid">
      <div class="panel doll"><div class="doll-sprite">${playerSprite()}</div>
        <div class="rank-line"><b>${r.name}</b><small>${r.desc}</small></div>
        <div class="xpline"><span>Lv ${c.level}</span><span class="bar xp"><i style="width:${xpPct(c)}%"></i></span><span>${c.level >= MAX_LEVEL ? 'MAX' : `${c.xp}/${xpToNext(c.level)}`}</span></div>
        <span class="chip" style="--c:${ELEMENTS[c.element].color}">${ELEMENTS[c.element].icon} ${ELEMENTS[c.element].name} affinity</span>
        ${c.clan ? `<span class="chip" style="--c:${CLAN[c.clan.id].color}">${CLAN[c.clan.id].crest} ${CLAN[c.clan.id].name}</span>` : ''}
        ${c.pet ? `<span class="chip" style="--c:${ELEMENTS[PET[c.pet].el].color}">🐾 ${PET[c.pet].name}</span>` : ''}</div>
      <div class="panel">
        <div class="pts">${c.points ? `<b>${c.points}</b> stat points to spend <button class="btn sm" data-act="autoAlloc">Auto-assign</button>` : 'No unspent points'} <small class="muted">(you earn ${POINTS_PER_LEVEL} per level)</small></div>
        ${row('hp','❤️','Health', st.maxHp, '+10 max HP per point')}
        ${row('cp','🔷','Chakra', st.maxCp, '+6 max Chakra per point')}
        ${row('agi','💨','Agility', st.agi, '+2 Agility per point: act sooner, dodge and crit more')}
        <div class="derived"><span>⚔️ Power ${st.atk} (level, weapon, clan)</span>${st.elem ? `<span>${ELEMENTS[st.elem].icon} +${Math.round(st.elemPct * 100)}% ${ELEMENTS[st.elem].name} damage</span>` : ''}<span>🎯 Crit ${st.crit.toFixed(1)}%</span><span>🌫️ Gear dodge +${st.dodge}%</span></div>
        <button class="btn sm ghost" data-act="respec" ${c.alloc.hp + c.alloc.cp + c.alloc.agi ? '' : 'disabled'}>Refund all points</button>
      </div>
    </div>
    <div class="panel" style="margin-top:12px"><h3>Tools</h3><div class="acts-row"><button class="btn sm" data-act="custom" data-arg="leader">✏️ Name and appearance</button><button class="btn primary sm" data-act="optMe">✨ Optimize me</button><button class="btn sm" data-act="optTeam">✨ Optimize the team</button></div>
      <small class="muted">Optimize spends your points, picks talents, learns the best techniques and equips the best gear.</small></div>
    <h3 class="sub">Talents</h3>${talentPanelHTML(c, 'leader')}
    <div class="panel" style="margin-top:12px"><h3>Rank path</h3><ol class="ranks">${RANKS.map(x => `<li class="${c.level >= x.min ? 'done' : ''} ${x === r ? 'cur' : ''}"><b>${x.name}</b><small>Level ${x.min}+</small></li>`).join('')}</ol></div>
    <div class="panel wheel-wrap">${wheelSVG(c.element)}<div><h3>Your matchups</h3><p class="muted">${ELEMENTS[c.element].name} techniques hit ${ELEMENTS[ELEMENTS[c.element].beats].name} foes 25% harder. ${ELEMENTS[EL_ORDER.find(e => ELEMENTS[e].beats === c.element)].name} techniques hit you 25% harder, so learn an off-element technique to cover it.</p></div></div>
    <div class="panel records" style="margin-top:12px"><span>📜 Missions cleared ${S.stats.missions}</span><span>🏆 Battles won ${S.stats.won}</span><span>🩹 Battles lost ${S.stats.lost}</span><span>🏟️ Arena ${S.arena.wins}–${S.arena.losses}</span><span>🌕 Moon Shards ${S.shards}</span></div>
  </section>`;
}
function resultsScreen(){
  const r = UI.results; if(!r) return hubScreen();
  const c = S.char, mine = r.newSkills.filter(s => s.type === 'ninjutsu' ? s.el === c.element : true);
  return `<section class="${r.win ? 'win' : 'lose'}">
    <div class="res-banner"><span>${r.title}</span><small>${esc(r.sub)}</small></div>
    <div class="panel res-body"><div class="res-sprite ${r.win ? 'cheer' : 'slump'}">${playerSprite()}</div>
      <div><div class="res-row">✨ <b>+${r.xp}</b> XP</div><div class="res-row">🪙 <b>+${r.gold}</b> gold</div>
        ${r.items.map(it => `<div class="res-row">${ITEM[it.id].icon} ${ITEM[it.id].name}${it.first ? ' <span class="chip" style="--c:var(--gold)">first clear</span>' : ''}</div>`).join('')}
        ${r.lines.map(l => `<div class="res-row" style="font-size:14px">${l}</div>`).join('')}
        <div class="xpline"><span>Lv ${c.level}</span><span class="bar xp"><i style="width:${xpPct(c)}%"></i></span><span>${c.level >= MAX_LEVEL ? 'MAX' : `${c.xp}/${xpToNext(c.level)}`}</span></div></div></div>
    ${r.ups.length ? `<div class="panel hl-panel sq-up"><div>⬆️ Reached level ${c.level}! ${c.points ? `You have ${c.points} stat points to spend.` : 'Points spent.'}</div>${c.points ? `<span class="res-acts"><button class="btn sm primary" data-act="autoAlloc">Auto-assign</button><button class="btn sm" data-act="go" data-arg="character">Choose myself</button></span>` : ''}</div>` : ''}
    ${(r.squadUps || []).map(u => { const m = recruitById(u.id); if(!m) return ''; return `<div class="panel hl-panel sq-up"><div>👥 <b>${esc(m.name)}</b> reached level ${u.level}! ${m.points ? `${m.points} stat points to spend.` : 'Points already spent.'}${u.learned.length ? `<br>📖 Learned ${u.learned.map(id => SKILL[id].icon + ' ' + SKILL[id].name).join(', ')}${m.autoTech !== false ? ` and equipped ${u.learned.length > 1 ? 'them' : 'it'}` : ''}.` : ''}</div>${m.points ? `<span class="res-acts"><button class="btn sm primary" data-act="autoAllocR" data-arg="${m.id}">Auto-assign</button><button class="btn sm" data-act="manageR" data-arg="${m.id}">Choose myself</button></span>` : ''}</div>`; }).join('')}
    ${(r.ach || []).map(a => `<div class="panel hl-panel">🏅 Achievement: ${a.icon} ${a.name}! ${a.reward.gold ? `+${a.reward.gold} gold ` : ''}${a.reward.shards ? `+${a.reward.shards} shards` : ''}</div>`).join('')}
    ${r.newTalent ? `<div class="panel hl-panel sq-up"><div>🌟 A new talent tier unlocked! Pick a talent for ${esc(c.name)}.</div><span class="res-acts"><button class="btn sm primary" data-act="go" data-arg="character">Choose</button><button class="btn sm" data-act="optMe">Let the AI pick</button></span></div>` : ''}
    ${r.newRank ? `<div class="panel hl-panel">🎖️ New rank: ${r.newRank.name}. ${r.newRank.desc}</div>` : ''}
    ${mine.length ? `<div class="panel hl-panel">📖 New at the Academy: ${mine.map(s => s.icon + ' ' + s.name).join(', ')}</div>` : ''}
    ${!r.win && !r.fled ? `<p class="muted center">Tip: bring salves, Charge when Chakra runs low, and lead with the element that beats your foe.</p>` : ''}
    <div class="res-btns">
      <button class="btn primary" data-act="go" data-arg="hub">Return to the village</button>
      ${r.retry ? `<button class="btn" data-act="${r.retry.act}" data-arg="${r.retry.arg}">${r.retry.label}</button>` : ''}
      ${c.points || (r.squadUps || []).some(u => (recruitById(u.id) || {}).points) ? `<button class="btn" data-act="autoAllocAll">Auto-assign all points</button>` : ''}
    </div></section>`;
}
function systemScreen(){
  const has = S && S.char;
  const slots = slotIndex().list;
  return `<section><h2 class="scr-title">💾 Save and load</h2><div class="stack">
    <div class="panel"><h3>Your ninja (${slots.length}/${MAX_SLOTS})</h3><p class="muted">Each ninja has its own save in this browser. Switching keeps everyone's progress.</p>
      <div class="slot-list">${slots.map(e => slotRowHTML(e, true)).join('') || '<p class="muted">No saves yet.</p>'}</div>
      <button class="btn primary" data-act="newSlot" ${slots.length >= MAX_SLOTS ? 'disabled' : ''}>Create a new ninja</button></div>
    ${has ? `<div class="panel"><h3>Export</h3><p class="muted">Progress autosaves in this browser after every mission and purchase. Copy this JSON to keep a backup or move to another device.</p>
      <textarea id="exp" readonly rows="5">${esc(JSON.stringify(S))}</textarea><button class="btn primary" data-act="copyExport">Copy save</button></div>` : ''}
    <div class="panel"><h3>Import</h3><p class="muted">Paste a save exported from Tsukimori. It's added as a new save; your other ninja are kept.</p>
      <textarea id="imp" rows="5" placeholder='{"version":1, ...}'></textarea><button class="btn primary" data-act="importSave">Load save</button></div>
    ${has ? `<div class="panel"><h3>Cloud save</h3><p class="muted">${NET.db && NET.uid ? (NET.mode === 'server' ? `Keep a private copy of your save on ${esc(NET.server.info ? NET.server.info.name : 'this server')}. It is tied to this browser.` : 'Keep a private copy of your save on your Claude account.') : 'Available when you join a multiplayer server (Village Square) or play the Claude-hosted version.'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="cloudSave" ${NET.db && NET.uid ? '' : 'disabled'}>Save to cloud</button><button class="btn" data-act="cloudLoad" ${NET.db && NET.uid ? '' : 'disabled'}>Load from cloud</button></div></div>
      <div class="panel"><h3>Sound</h3><div class="seg"><button class="${S.settings.sound ? 'on' : ''}" data-act="soundSet" data-arg="1">On</button><button class="${S.settings.sound ? '' : 'on'}" data-act="soundSet" data-arg="0">Off</button></div></div>
      <div class="panel"><h3>Battle speed</h3><div class="seg">${[1,2,3].map(v => `<button class="${S.settings.speed === v ? 'on' : ''}" data-act="speed" data-arg="${v}">${v}×</button>`).join('')}</div></div>
      <div class="panel"><h3>Delete this ninja</h3><p class="muted">Deletes ${esc(S.char.name)}'s save for good. Export it first if you want to keep a copy. Your other ninja are not affected.</p><button class="btn bad" data-act="askDelSlot" data-arg="${esc(activeSlot())}">Delete ${esc(S.char.name)}</button></div>`
      : `<button class="btn ghost" data-act="go" data-arg="title">Back to title</button>`}
  </div></section>`;
}


/* ---------- Beast Den (pets) ---------- */
function denScreen(){
  const c = S.char; if(c.level < 3) return lockedScreen('🦊 Beast Den', 3, 'Beast handlers will trust you with a partner once you prove yourself on a few missions.');
  const members = [c, ...S.squad.roster], owner = UI.denWho && UI.denWho !== 'leader' && recruitById(UI.denWho) ? recruitById(UI.denWho) : c, who = owner === c ? 'leader' : owner.id;
  const st = charStats(owner), you = owner === c;
  return `<section><h2 class="scr-title">🦊 Beast Den</h2>
    <p class="note">Every ninja can bring one pet. It stands behind its ninja, its stats scale with its owner's, and each battle it wins raises its bond (up to level 10, +6% stats per level). You can command a pet yourself or leave it to the AI.</p>
    ${members.length > 1 ? `<div class="tabs" role="tablist" aria-label="Choose whose pet">${members.map(m => { const w = m === c ? 'leader' : m.id; return `<button class="tab ${w === who ? 'on' : ''}" data-act="denFor" data-arg="${w}" role="tab" aria-selected="${w === who}">${m === c ? '★ ' : ''}${esc(m.name)}${m.pet && PET[m.pet] ? ' 🐾' : ''}</button>`; }).join('')}</div>` : ''}
    <p class="muted" style="margin-bottom:8px">Pets for <b>${esc(owner.name)}</b> (level ${owner.level}). Adopting costs your gold.</p>
    <div class="stack">${PETS.map(p => {
      const own = owner.pets.includes(p.id), act = owner.pet === p.id, lock = owner.level < p.lvl, bond = (owner.bond || {})[p.id] || 0;
      const pu = unitFromPet(p.id, st, 'ally', bond, owner.level);
      const cost = p.shards ? `🔴 ${p.shards} shards` : `🪙 ${p.price}`;
      const afford = p.shards ? S.shards >= p.shards : c.gold >= p.price;
      let btn;
      if(own) btn = act ? `<button class="btn" data-act="petSet" data-arg="${who}:">Send home</button>` : `<button class="btn primary" data-act="petSet" data-arg="${who}:${p.id}">Bring along</button>`;
      else if(lock) btn = `<button class="btn" disabled>🔒 Level ${p.lvl}</button>`;
      else btn = `<button class="btn primary" data-act="petBuy" data-arg="${who}:${p.id}" ${afford ? '' : 'disabled'}>Adopt for ${cost}</button>`;
      const ctl = act ? `<div class="seg" role="group" aria-label="Who controls the pet"><button class="${owner.petAuto === false ? 'on' : ''}" data-act="petCtl" data-arg="${who}:0" aria-pressed="${owner.petAuto === false}">🎮 You command</button><button class="${owner.petAuto === false ? '' : 'on'}" data-act="petCtl" data-arg="${who}:1" aria-pressed="${owner.petAuto !== false}">🤖 Auto (AI)</button></div>` : '';
      return `<article class="panel pet-card ${act ? 'active' : ''} ${lock && !own ? 'locked' : ''}">
        <div class="ps">${petSprite(p.id)}</div>
        <div><h3>${p.name} <span class="chip" style="--c:${ELEMENTS[p.el].color}">${ELEMENTS[p.el].icon} ${ELEMENTS[p.el].name}</span></h3>
          <p class="muted" style="font-size:13.5px">${p.desc}</p>
          <div class="tags"><span class="tag">❤️ ${pu.maxHp}</span><span class="tag">⚔️ ${Math.round(pu.atk)}</span><span class="tag">💨 ${pu.agi}</span>${own ? `<span class="tag">🐾 Bond ${bondLevel(bond)}</span>` : ''}${p.skills.map(id => `<span class="tag">${SKILL[id].icon} ${SKILL[id].name}</span>`).join('')}</div>${ctl}</div>
        <div class="acts">${act ? `<span class="owned">✓ ${you ? 'Your partner' : esc(owner.name) + "'s partner"}</span>` : ''}${btn}</div></article>`;
    }).join('')}</div></section>`;
}
/* ---------- Clan Hall ---------- */
function clanScreen(){
  const c = S.char; if(c.level < 5) return lockedScreen('⛩️ Clan Hall', 5, 'The clans only recruit ninja who have seen real missions.');
  const mine = c.clan && CLAN[c.clan.id];
  let head = '';
  if(mine){
    const t = clanTier(c.clan.rep), next = CLAN_TIERS[t + 1];
    head = `<div class="panel clan-card" style="--c:${mine.color}"><header><span class="crest">${mine.crest}</span><div><h3>${mine.name}</h3><small class="muted">“${mine.motto}”</small></div></header>
      <div class="tierbar">${CLAN_TIERS.map((x, i) => `<span class="${i <= t ? 'on' : ''}" title="${x.name}"></span>`).join('')}</div>
      <p><b>${CLAN_TIERS[t].name}</b>, ${c.clan.rep} reputation${next ? `, ${next.rep - c.clan.rep} more to ${next.name}` : ' (highest rank)'}</p>
      <p class="muted">Active perks: ${clanPerkText(mine, t)}</p>
      <p class="muted" style="font-size:13px">Earn reputation from missions (D 5, C 12, B 25, A 45, S 80), arena wins (8), Crimson Moon attempts (10) and donations.</p>
      <div class="acts"><button class="btn primary" data-act="donate" ${c.gold >= 100 ? '' : 'disabled'}>Donate 🪙 100 for +5 reputation</button></div></div>
      <h3 class="sub">Other clans</h3>`;
  }
  return `<section><h2 class="scr-title">⛩️ Clan Hall</h2>
    ${mine ? head : `<p class="note">Clans grant passive perks that grow stronger with your clan rank. Joining costs 200 gold. Switching later costs 500 gold and resets your reputation.</p>`}
    <div class="stack">${CLANS.filter(cl => !mine || cl.id !== mine.id).map(cl => {
      const lock = c.level < cl.lvl, cost = mine ? 500 : 200;
      return `<article class="panel clan-card ${lock ? 'locked' : ''}" style="--c:${cl.color}"><header><span class="crest">${cl.crest}</span><div><h3>${cl.name}</h3><small class="muted">“${cl.motto}”</small></div></header>
        <p class="muted" style="margin-top:8px">Initiate perks: ${clanPerkText(cl, 0)}. Clan head: ${clanPerkText(cl, 4)}.</p>
        <div class="acts">${lock ? `<button class="btn" disabled>🔒 Level ${cl.lvl}</button>` : `<button class="btn ${mine ? '' : 'primary'}" data-act="clanJoin" data-arg="${cl.id}" ${c.gold >= cost ? '' : 'disabled'}>${mine ? 'Switch' : 'Join'} for 🪙 ${cost}</button>`}</div></article>`;
    }).join('')}</div>
    ${mine ? `<div style="margin-top:12px"><button class="btn ghost sm" data-act="clanLeave">Leave ${mine.name}</button></div>` : ''}
  </section>`;
}
/* ---------- Echo Arena (PvP vs AI ghosts) ---------- */
function ghostCard(g, i, custom){
  const st = charStats(g), pet = g.pet && PET[g.pet], cl = g.clan && CLAN[g.clan.id];
  const d = g.diff || 0, diffTxt = custom ? 'Custom echo' : d < 0 ? 'Easier' : d > 0 ? 'Harder, bigger reward' : 'Even match';
  return `<article class="panel ghost"><div class="ps">${ninjaSVG(g.look, gearLooks(g), {scarf:ELEMENTS[g.element].color})}</div>
    <div><h3>${esc(g.name)} <small class="muted" style="font-family:var(--body);font-size:12.5px">Lv ${g.level}</small></h3>
      <small class="muted">${esc(g.archetype || 'Ghost build')}, ${diffTxt}</small>
      <div class="gm"><span class="chip" style="--c:${ELEMENTS[g.element].color}">${ELEMENTS[g.element].icon} ${ELEMENTS[g.element].name}</span>${cl ? `<span class="chip" style="--c:${cl.color}">${cl.crest} ${cl.name}</span>` : ''}${pet ? `<span class="chip" style="--c:${ELEMENTS[pet.el].color}">🐾 ${pet.name}</span>` : ''}${(g.squad || []).length ? `<span class="chip" style="--c:#8a7fd0">👥 +${g.squad.length}: ${g.squad.map(m => esc(m.name)).join(', ')}</span>` : ''}</div>
      <div class="tags" style="margin-top:6px"><span class="tag">❤️ ${st.maxHp}</span><span class="tag">🔷 ${st.maxCp}</span><span class="tag">💨 ${st.agi}</span><span class="tag">⚔️ ${st.atk}</span><span class="tag">Power rating ${buildPower(g)}</span></div>
      <div class="tags" style="margin-top:4px">${g.loadout.map(id => `<span class="tag">${SKILL[id].icon} ${SKILL[id].name}</span>`).join('')}</div></div>
    <div class="acts"><button class="btn primary" data-act="arenaFight" data-arg="${custom ? 'custom' : i}">Challenge</button></div></article>`;
}
function arenaScreen(){
  const c = S.char; if(c.level < 4) return lockedScreen('👥 Echo Arena', 4, 'The arena keepers record the echoes of real ninja. Come back once you have some battles behind you.');
  if(!S.arena.opps.length) refreshArena();
  const r = S.arena.rating, t = arenaTier(r), nt = ARENA_TIERS.find(x => x.r > r);
  return `<section><h2 class="scr-title">👥 Echo Arena</h2>
    <div class="panel rating"><div><small class="muted">Echo rating</small><br><b>${r}</b></div><div><b style="font-size:18px">${t.name}</b><br><small class="muted">${nt ? `${nt.r - r} to ${nt.name}` : 'Top tier'}. Record ${S.arena.wins}–${S.arena.losses}</small></div></div>
    <p class="note" style="margin-top:12px">Echoes are AI-controlled copies of other ninja builds: their stats, gear, techniques, clan and pet. Win to gain rating, gold and XP. Your power rating is ${buildPower(c)}.</p>
    <div class="stack">${S.arena.opps.map((g, i) => ghostCard(g, i)).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn" data-act="arenaRefresh">New opponents</button>
      <button class="btn" data-act="arenaSelf">Fight your own echo</button>
    </div>
    <h3 class="sub">Real ninja</h3>
    <div class="panel" id="net-board">${boardHTML()}</div>
    <div class="panel" style="margin-top:14px"><h3>Friends' builds</h3>
      <p class="muted">Share your build as text, or paste a friend's build (or a full save) to fight their echo.</p>
      <button class="btn sm" data-act="copyBuild">Copy my build</button>
      <textarea id="ghostin" rows="3" placeholder='Paste a build here'></textarea>
      <button class="btn primary sm" data-act="arenaCustom">Fight this echo</button></div>
  </section>`;
}
/* ---------- Crimson Moon (boss event) ---------- */
function fmtDur(ms){ const h = Math.floor(ms / 36e5), d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`; }
function eventScreen(){
  const c = S.char; if(c.level < EVENTS[0].lvl) return lockedScreen('🌕 Crimson Moon', EVENTS[0].lvl, 'When the moon turns red, a great enemy rises. You will be called once you are ready.');
  syncEvent(); persist();
  const ev = S.event, boss = ENEMY[ev.bossId], pct = ev.dmg / ev.pool * 100, left = EVENT_TRIES - ev.tries, dead = ev.dmg >= ev.pool;
  const weakTo = EL_ORDER.find(e => ELEMENTS[e].beats === boss.el);
  const shop = ITEMS.filter(i => i.shards);
  return `<section><h2 class="scr-title">🌕 Crimson Moon</h2>
    <div class="event-hero"><div class="eb"><div>${spriteSVG({kind:boss.kind, look:boss.look, gear:boss.gear})}</div>
      <div><small>This week's boss, level ${ev.bossLvl}. Changes in ${fmtDur(msToNextWeek())}.</small><h3>${boss.name}</h3>
        <small>${ELEMENTS[boss.el].icon} ${ELEMENTS[boss.el].name}, weak to ${ELEMENTS[weakTo].icon} ${ELEMENTS[weakTo].name}. Enrages below half health.</small>
        <div class="bar hp"><i style="width:${100 - pct}%"></i><b>${Math.max(0, ev.pool - ev.dmg)} / ${ev.pool}</b></div>
        <small>${dead ? 'Defeated this week! Claim your rewards below.' : `The boss keeps its wounds between attempts. Each attempt lasts ${EVENT_ROUNDS} rounds.`}</small></div></div></div>
    <div class="panel" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div><b>${left} of ${EVENT_TRIES}</b> attempts left today<br><small class="muted">Best hit this week: ${ev.best}. Shards: <b class="shardline">🔴 ${S.shards}</b></small></div>
      <button class="btn primary big" data-act="eventFight" ${dead || left <= 0 ? 'disabled' : ''}>${dead ? 'Defeated' : left <= 0 ? 'Come back tomorrow' : 'Challenge the boss'}</button></div>
    <div class="panel" style="margin-top:12px"><h3>Weekly milestones</h3>
      ${EVENT_MILESTONES.map((m, i) => { const got = ev.claimed.includes(i), ok = pct >= m.pct;
        return `<div class="ms ${got ? 'done' : ''}"><span class="pct">${m.pct}%</span><span>${m.label}${m.reward.goldPerLvl ? ` (🪙 ${m.reward.goldPerLvl * c.level})` : ''}</span>
        <button class="btn sm ${ok && !got ? 'primary' : ''}" data-act="eventClaim" data-arg="${i}" ${ok && !got ? '' : 'disabled'}>${got ? 'Claimed' : ok ? 'Claim' : 'Locked'}</button></div>`; }).join('')}</div>
    <h3 class="sub">Community raid</h3><div class="panel" id="net-raid">${raidHTML()}</div>
    <h3 class="sub">Moon Shard exchange</h3>
    <div class="stack">${shop.map(it => `<div class="panel item"><div class="item-ic">${it.icon}</div><div class="item-b"><b>${it.name}</b><small class="${it.bonus ? 'bonus' : ''}">${it.bonus ? fmtBonus(it.bonus) : it.desc}</small>${c.level < it.lvl ? `<small>Requires level ${it.lvl}</small>` : ''}${S.inventory[it.id] ? `<small>You own ${S.inventory[it.id]}.</small>` : ''}</div>
      <div class="item-act"><button class="btn primary sm" data-act="shardBuy" data-arg="${it.id}" ${S.shards >= it.shards && c.level >= it.lvl ? '' : 'disabled'}>🔴 ${it.shards}</button></div></div>`).join('')}
      <div class="panel item"><div class="item-ic">🐾</div><div class="item-b"><b>${PET.moon_wisp.name}</b><small>Exclusive pet. Adopt it at the Beast Den for 🔴 ${PET.moon_wisp.shards} shards.</small></div><div class="item-act"><button class="btn sm" data-act="go" data-arg="den">Beast Den</button></div></div>
    </div></section>`;
}


/* ---------- Journal: daily quests + achievements ---------- */
function journalScreen(){
  syncDaily(); checkAchievements(); const r = questReward();
  return `<section><h2 class="scr-title">📓 Journal</h2>
    <div class="panel"><h3>Today's quests</h3><p class="muted" style="font-size:13px">New quests every day. Each gives 🪙 ${r.gold}, ✨ ${r.xp} XP and 🔴 ${r.shards} shards. Login streak: day ${S.login.streak}.</p>
      ${S.daily.quests.map((q, i) => { const pr = questProgress(q), ok = pr >= q.n;
        return `<div class="ms ${q.claimed ? 'done' : ''}"><span class="pct">${q.claimed ? '✓' : `${pr}/${q.n}`}</span><span>${QUEST_POOL.find(x => x.id === q.id).text(q.n)}<span class="bar xp thin" style="margin-top:4px"><i style="width:${pr / q.n * 100}%"></i></span></span>
        <button class="btn sm ${ok && !q.claimed ? 'primary' : ''}" data-act="questClaim" data-arg="${i}" ${ok && !q.claimed ? '' : 'disabled'}>${q.claimed ? 'Claimed' : ok ? 'Claim' : 'In progress'}</button></div>`; }).join('')}</div>
    <h3 class="sub">Achievements (${S.ach.length}/${ACHIEVEMENTS.length})</h3>
    <div class="ach-grid">${ACHIEVEMENTS.map(a => { const got = S.ach.includes(a.id); return `<div class="ach ${got ? 'got' : ''}"><span class="ach-ic">${got ? a.icon : '🔒'}</span><b>${a.name}</b><small>${a.desc}</small><small class="ach-r">${a.reward.gold ? `🪙 ${a.reward.gold} ` : ''}${a.reward.shards ? `🔴 ${a.reward.shards}` : ''}</small></div>`; }).join('')}</div>
  </section>`;
}

/* ============================ BATTLE VIEW ============================ */
function unitCard(u){
  const ctl = u.side === 'ally' && (u.isSquad || u.isPet);
  return `<div class="unit ${u.side} ${u.boss ? 'boss' : ''} ${u.isPet ? 'pet' : ''} ${u.isSquad ? 'squad' : ''}" id="u${u.uid}" ${u.side === 'enemy' ? `data-act="target" data-arg="${u.uid}" role="button" aria-label="Target ${esc(u.name)}"` : ''}>
    <div class="statuses"></div>
    <div class="sprite-wrap"><div class="sprite ${u.side === 'enemy' ? 'flip' : ''}">${spriteSVG(u)}</div><div class="target-mark">▼</div>${ctl ? `<button class="ctl" data-act="ctl" data-arg="${u.uid}" aria-label="Switch who controls ${esc(u.name)}"></button>` : ''}</div>
    <div class="plate"><span class="uname">${ELEMENTS[u.el].icon} ${esc(u.name)}</span><span class="ulv">${u.isPet ? '🐾' : u.isSquad ? '👥' : ''}Lv${u.level}</span></div>
    <div class="bars"><div class="bar hp"><i></i><b></b></div><div class="bar cp"><i></i><b></b></div></div>
  </div>`;
}
// Each ninja's pet stands behind it: to the left on your side, to the right on the foe's side.
function sideHTML(units, foe){
  const out = [];
  for(const o of units.filter(u => !u.isPet)){
    const pets = units.filter(p => p.isPet && p.ownerUid === o.uid);
    out.push(pets.length ? `<div class="grp">${foe ? unitCard(o) + pets.map(unitCard).join('') : pets.map(unitCard).join('') + unitCard(o)}</div>` : unitCard(o));
  }
  for(const p of units.filter(p => p.isPet && !units.some(o => o.uid === p.ownerUid))) out.push(unitCard(p));
  return out.join('');
}
function renderBattle(){
  const m = B.meta;
  $('#main').innerHTML = `<section class="battle">
    <div class="bt-top"><div class="bt-title"><b>${esc(m.title)}</b><small>${m.sub ? esc(m.sub) : `Stage ${m.stage} of ${m.stages}`}${m.boss ? ' <span class="boss-flag">— boss</span>' : ''}${m.roundLimit ? `, round limit ${m.roundLimit}` : ''}</small></div>
      <div class="bt-tools"><button class="btn sm ${S.settings.auto ? 'primary' : ''}" data-act="autoB" id="autob" aria-pressed="${!!S.settings.auto}">🤖 Auto</button><button class="btn sm" data-act="soundB" id="sndb" aria-label="Sound">${S.settings.sound ? '🔊' : '🔇'}</button><button class="btn sm" data-act="speedB" id="spd" aria-label="Battle speed">⏩ ${S.settings.speed}×</button></div></div>
    <div class="turnorder" id="turnorder"></div>
    <div class="field">
      <div class="side ${B.allies.length > 1 ? 'multi' : ''}">${sideHTML(B.allies, false)}</div>
      <div class="vs">VS</div>
      <div class="side ${B.enemies.length > 1 ? 'multi' : ''}">${sideHTML(B.enemies, true)}</div>
    </div>
    <div class="bt-log" id="btlog" aria-live="polite"></div>
    <div class="actions" id="actions"></div>
  </section>`;
}
function updateBattle(){
  if(!B || UI.screen !== 'battle') return;
  for(const u of allUnits()){
    const el = document.getElementById('u' + u.uid); if(!el) continue;
    const hp = el.querySelector('.bar.hp'), cp = el.querySelector('.bar.cp');
    hp.querySelector('i').style.width = (u.hp / u.maxHp * 100) + '%'; hp.querySelector('b').textContent = `${u.hp}/${u.maxHp}`;
    cp.querySelector('i').style.width = (u.cp / u.maxCp * 100) + '%'; cp.querySelector('b').textContent = `${u.cp}/${u.maxCp} CP`;
    el.querySelector('.statuses').innerHTML = u.statuses.map(x => { const d = STATUSES[x.s]; return `<span class="st ${d.kind}" title="${d.name}: ${d.desc} (${x.dur} turns)">${d.icon}<sub>${x.dur}</sub></span>`; }).join('');
    const cb = el.querySelector('.ctl'); if(cb){ const ai = u.controller === 'ai'; cb.textContent = ai ? '🤖' : '🎮'; cb.title = ai ? 'On Auto: tap to command it yourself' : 'You command it: tap to put it on Auto'; }
    el.classList.toggle('dead', !u.alive);
    el.classList.toggle('active', B.active === u && !B.over && u.alive);
    el.classList.toggle('targeted', u.side === 'enemy' && B.target === u.uid && u.alive && B.enemies.filter(e => e.alive).length > 0);
  }
  const ord = [B.active, ...B.queue].filter((u, i, a) => u && u.alive && a.indexOf(u) === i);
  $('#turnorder').innerHTML = `<span class="rnd">Round ${B.round}</span>` + ord.map((u, i) => `<span class="to ${u.side} ${i === 0 ? 'now' : ''}">${u.isPlayer ? '★ ' : ''}${esc(u.name)}</span>`).join('');
  $('#btlog').innerHTML = B.log.slice(-4).map(l => `<div>${l}</div>`).join('');
  $('#actions').innerHTML = actionsHTML();
  const spd = $('#spd'); if(spd) spd.textContent = `⏩ ${S.settings.speed}×`;
  const ab = $('#autob'); if(ab){ ab.classList.toggle('primary', !!S.settings.auto); ab.setAttribute('aria-pressed', !!S.settings.auto); }
  const sb = $('#sndb'); if(sb) sb.textContent = S.settings.sound ? '🔊' : '🔇';
}
function actionsHTML(){
  const u = B.active, mine = B.awaiting && u && u.controller === 'player' && !B.over;
  const p = u && u.controller === 'player' && u.side === 'ally' ? u : B.allies.find(a => a.isPlayer);
  const hint = `<div class="turn-hint ${mine ? 'mine' : ''}">${B.over ? 'The battle is over…' : mine ? (u.isPlayer ? 'Your move. Tap a foe to target it, then choose an action.' : `${u.isPet ? '🐾' : '👥'} ${esc(u.name)}'s move. You're in command!`) : u ? `${esc(u.name)} is acting…` : 'Get ready…'}</div>`;
  const helpers = B.allies.filter(a => (a.isSquad || a.isPet) && a.alive);
  const strip = helpers.length ? `<div class="ctlstrip"><small class="muted">Who plays:</small>${helpers.map(a => `<button class="ctlchip ${a.controller === 'ai' ? 'auto' : ''}" data-act="ctl" data-arg="${a.uid}" title="Tap to switch">${a.isPet ? '🐾' : '👥'} ${esc(a.name)}: ${a.controller === 'ai' ? '🤖 Auto' : '🎮 You'}</button>`).join('')}</div>` : '';
  if(UI.itemPanel && mine){
    const cons = ITEMS.filter(i => i.slot === 'consumable' && S.inventory[i.id] > 0);
    return hint + `<div class="item-panel">${cons.length ? cons.map(i => `<button class="ibtn" data-act="bUse" data-arg="${i.id}">${i.icon} ${i.name} ×${S.inventory[i.id]}<small>${i.desc}</small></button>`).join('') : '<div class="panel empty">No supplies left. Buy some at the Shop.</div>'}
      <button class="btn ghost" data-act="bItems">Back to actions</button></div>`;
  }
  const d = mine ? '' : 'disabled', t = getTarget();
  const sk = p.skills.map(id => SKILL[id]).filter(Boolean).map(s => {
    const raw = p.cds[s.id] || 0, cd = mine ? raw : Math.max(0, raw - 1), can = mine && cd <= 0 && canUse(p, s), hc = hpCostOf(p, s);
    const em = s.power && t ? elemMult(s.el, t.el) : 1, dmg = s.power ? previewDamage(p, s, t) : 0;
    const fx = skillTags(s).filter(x => !/power$/.test(x) && !/^Ally$|^All foes$/.test(x)), allx = s.target === 'allEnemies';
    const line = [dmg ? `≈${dmg}${s.hits > 1 ? ' total' : ''}${allx ? ' each' : ''} dmg` : '', ...fx].filter(Boolean).slice(0, 3).join(' · ');
    const why = mine && !can && cd <= 0 ? whyNot(p, s) : '';
    return `<button class="sbtn ${cd > 0 ? 'oncd' : ''}" style="--c:${skillColor(s)}" data-act="bSkill" data-arg="${s.id}" ${can ? '' : 'disabled'} title="${esc(s.desc)}${why ? ' (' + why + ')' : ''}">
      <span class="si">${s.icon}</span><span class="sn">${s.name}</span><span class="sc">${skillCost(p, s)} CP${hc ? ` · ${hc} HP` : ''} · CD ${s.cd}</span><span class="stg">${line}</span>
      ${em > 1 ? '<span class="em up" title="Strong against target">▲</span>' : em < 1 ? '<span class="em down" title="Weak against target">▼</span>' : ''}
      ${cd > 0 ? `<span class="cdv" aria-label="${cd} turns">${cd}</span>` : ''}</button>`;
  }).join('');
  const basicDmg = t ? previewDamage(p, BASIC, t) : 0;
  return hint + strip + `<div class="act-row">
      <button class="abtn main" data-act="bAttack" ${d} title="A plain strike: free, no cooldown, but weaker than any technique."><span class="ai">🗡️</span>Attack<small>≈${basicDmg} dmg</small></button>
      <button class="abtn" data-act="bCharge" ${d} title="Spend this turn gathering Chakra, and brace: Guard (35% less damage) until your next turn."><span class="ai">🌀</span>Charge<small>+${chargeGain(p)} CP · Guard</small></button>
      <button class="abtn" data-act="bItems" ${d}><span class="ai">🎒</span>Item<small>Supplies</small></button>
      <button class="abtn" data-act="bFlee" ${d}><span class="ai">🏳️</span>Retreat<small>Leave</small></button>
    </div><div class="skillbar">${sk || '<div class="muted">No techniques equipped. Visit the Academy.</div>'}</div>`;
}

/* ============================ ACTIONS ============================ */
const ACT = {
  go: a => { if(!['title','create','system'].includes(a) && !(S && S.char)) return go('title'); go(a); },
  continue: () => { try{ S = migrate(loadLocal()); go('hub'); checkLogin(); checkAchievements(); publishEcho(); }catch(e){ toast(e.message); } },
  newSlot: () => { if(B || RUN) return toast('Finish the battle first'); try{ openNewSlot(); }catch(e){ return toast(e.message); } S = null; UI.results = null; GUIDE.undo = null; GUIDE.open = false; GUIDE.msgs = []; UI.create = defaultCreate(); go('create'); },
  playSlot: id => { if(B || RUN) return toast('Finish the battle first'); try{ S = useSlot(id); }catch(e){ return toast(e.message); }
    UI.results = null; GUIDE.undo = null; GUIDE.open = false; GUIDE.msgs = []; go('hub'); checkLogin(); checkAchievements(); netSlotChanged(); toast(`Playing as ${S.char.name}`); },
  askDelSlot: id => { const e = slotIndex().list.find(x => x.id === id); if(!e) return;
    showModal(`Delete ${esc(e.name)}?`, `<p>${esc(e.name)} (level ${e.level | 0}) is deleted from this browser for good. Your other ninja are kept.</p>`, [{label:'Keep', act:'closeModal'}, {label:'Delete', act:'doDelSlot', arg:id, cls:'bad'}]); },
  doDelSlot: id => { closeModal(); const cur = S && S.char && id === activeSlot(); deleteSlot(id);
    if(cur){ S = null; B = null; RUN = null; UI.results = null; GUIDE.undo = null; GUIDE.open = false; GUIDE.msgs = []; go('title'); } else render(); toast('Save deleted'); },
  cset: a => {
    const i = a.indexOf(':'), k = a.slice(0, i), v = a.slice(i + 1);
    UI.create[k] = v;
    if(k === 'gender') UI.create.hairStyle = v === 'f' ? 'ponytail' : 'spiky';
    render();
  },
  createDone: () => {
    const n = (UI.create.name || '').trim();
    if(!n){ toast('Give your ninja a name first'); const i = $('#cname'); if(i) i.focus(); return; }
    S = defaultState(); S.char = newCharacter(UI.create); S.login = {day:todayKey(), streak:1}; persist();
    go('hub'); netSlotChanged(); publishEcho();
    setTimeout(() => { GUIDE.open = true; GUIDE.msgs = []; guideIntro(); guideSay('momo', 'Tip: tap the Mission Board and take "Bandits on the Reed Road" first. I can also do things for you, just ask!'); renderGuide(); }, 500);
  },
  tab: a => { const [k, v] = a.split(':'); UI.tab[k] = v; render(); },
  startMission: a => startMission(a),
  learn: a => {
    const s = SKILL[a], c = S.char, price = skillPrice(s);
    if(c.level < s.lvl) return toast(`Requires level ${s.lvl}`);
    if(c.gold < price) return toast('Not enough gold');
    c.gold -= price; c.skills.push(a);
    if(c.loadout.length < MAX_LOADOUT) c.loadout.push(a);
    persist(); render(); toast(`Learned ${s.name}`);
  },
  toggleLoad: a => {
    const c = S.char, i = c.loadout.indexOf(a);
    if(i >= 0) c.loadout.splice(i, 1);
    else if(c.loadout.length >= MAX_LOADOUT) return toast('Loadout full. Remove a technique first.');
    else c.loadout.push(a);
    persist(); render();
  },
  buy: (a, el, n = 1) => {
    const it = ITEM[a], c = S.char;
    if(c.level < it.lvl) return toast(`Requires level ${it.lvl}`);
    if(c.gold < it.price * n) return toast('Not enough gold');
    c.gold -= it.price * n; addInv(a, n); persist(); render(); toast(`Bought ${n > 1 ? n + '× ' : ''}${it.name}`);
  },
  buy5: a => ACT.buy(a, null, 5),
  equip: a => {
    const it = ITEM[a], c = S.char;
    if(!it || !SLOTS.includes(it.slot) || !(S.inventory[a] > 0)) return;
    if(c.level < it.lvl) return toast(`Requires level ${it.lvl}`);
    const prev = c.equip[it.slot]; if(prev) addInv(prev, 1);
    addInv(a, -1); c.equip[it.slot] = a; persist(); render(); toast(`Equipped ${it.name}`);
  },
  unequip: a => { const c = S.char, id = c.equip[a]; if(!id) return; addInv(id, 1); c.equip[a] = null; persist(); render(); },
  sell: a => {
    const it = ITEM[a]; if(!(S.inventory[a] > 0)) return;
    const v = Math.floor((it.price || 100) / 2); addInv(a, -1); S.char.gold += v; persist(); render(); toast(`Sold ${it.name} for ${v} gold`);
  },
  alloc: a => { const c = S.char; if(!c.points) return; c.alloc[a]++; c.points--; persist(); render(); },
  autoAlloc: () => { const c = S.char; if(!c.points) return; allocRecruit(c, autoAllocRecruit(c)); persist(); render(); toast('Points assigned'); },
  autoAllocAll: () => { let n = 0; for(const x of [S.char, ...S.squad.roster]) if(x.points){ allocRecruit(x, autoAllocRecruit(x)); n++; } persist(); render(); toast(n > 1 ? `Points assigned for ${n} ninja` : 'Points assigned'); },
  respec: () => { const c = S.char; c.points += c.alloc.hp + c.alloc.cp + c.alloc.agi; c.alloc = {hp:0, cp:0, agi:0}; persist(); render(); toast('Points refunded'); },
  copyExport: () => {
    const ta = $('#exp'); if(!ta) return;
    const done = () => toast('Save copied');
    const fallback = () => { ta.focus(); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('Select the text and copy it manually'); } };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
  },
  importSave: () => {
    const t = ($('#imp') || {}).value || '';
    try{ const next = migrate(JSON.parse(t)); openNewSlot(); S = next; persist(); UI.results = null; GUIDE.undo = null; GUIDE.open = false; GUIDE.msgs = []; go('hub'); netSlotChanged(); toast(`Added ${S.char.name} as a new save`); }
    catch(e){ toast(e instanceof SyntaxError ? 'That text is not valid JSON.' : e.message); }
  },
  speed: a => { S.settings.speed = +a; persist(); render(); },
  speedB: () => { S.settings.speed = S.settings.speed >= 3 ? 1 : S.settings.speed + 1; persist(); updateBattle(); },
  target: a => { if(!B) return; const u = B.enemies.find(e => e.uid === +a); if(u && u.alive){ B.target = u.uid; updateBattle(); } },
  bAttack: () => playerAct(u => doBasic(u, getTarget())),
  bSkill: a => {
    const p = B && B.active, s = SKILL[a]; if(!p || !s || !B.awaiting) return;
    if(!canUse(p, s)) return toast((p.cds[a] || 0) > 0 ? 'Still on cooldown' : 'Not enough Chakra. Try Charge.');
    playerAct(u => useSkill(u, s, getTarget()));
  },
  bCharge: () => playerAct(u => doCharge(u)),
  bItems: () => { if(!B || !B.awaiting) return; UI.itemPanel = !UI.itemPanel; updateBattle(); },
  bUse: a => { if(!(S.inventory[a] > 0)) return; playerAct(u => useItem(u, a, getTarget())); },
  bFlee: () => { if(!B || !B.awaiting) return; showModal('Retreat?', RUN && RUN.kind === 'event' ? '<p>Your damage so far still counts toward the boss.</p>' : '<p>You keep XP and gold from foes already defeated, but lose the reward.</p>', [{label:'Keep fighting', act:'closeModal'}, {label:'Retreat', act:'doFlee', cls:'bad'}]); },
  doFlee: () => { closeModal(); if(!RUN || !B) return; S.stats.lost++; finishRun(false, true); },
  nextStage: () => { closeModal(); if(RUN) startStage(); },
  closeModal: () => closeModal(),
  ...SQUAD_ACT,
  openGuide: () => { GUIDE.open = true; renderGuide(); setTimeout(() => { const i = $('#g-input'); if(i) i.focus(); }, 50); },
  guideClose: () => { GUIDE.open = false; renderGuide(); },
  guideAsk: a => guideAsk(a),
  guideSend: () => { if(GUIDE.busy){ if(GUIDE.ctl) GUIDE.ctl.abort(); return; } const i = $('#g-input'); const t = i ? i.value : ''; if(i) i.value = ''; guideAsk(t); },
  guideDo: a => guideDo(a),
  guideUndo: () => { if(!GUIDE.undo) return; S = migrate(JSON.parse(GUIDE.undo)); GUIDE.undo = null; persist(); render(); guideSay('momo', 'Undone! Everything is back the way it was.'); },
  guideKey: () => { const v = ($('#g-key') || {}).value || ''; try{ localStorage.setItem('tsukimori_api_key', v.trim()); }catch(e){} GUIDE.mode = v.trim() ? 'byok' : 'offline'; renderGuide(); toast(v.trim() ? 'Key saved in this browser' : 'Key removed'); },
  questClaim: a => { if(claimQuest(+a)) render(); },
  autoB: () => { S.settings.auto = !S.settings.auto; persist(); updateBattle(); if(S.settings.auto && B && B.awaiting) autoAct(); },
  soundB: () => { S.settings.sound = !S.settings.sound; persist(); updateBattle(); sfx('click'); },
  soundSet: a => { S.settings.sound = a === '1'; persist(); render(); sfx('click'); },
  cloudSave: () => cloudSave(),
  cloudLoad: () => cloudLoad(),
  fightEcho: a => { const e = NET.echoes.find(x => x.id === a); const g = e && echoGhost(e); if(!g) return toast('That echo could not be loaded'); RUN = {kind:'arena', ghost:g, custom:true, xp:0, gold:0, stages:1}; startStage(); },
  emote: a => { if(!NET.room) return; NET.room.emit('emote', {emoji:a, name:S.char.name}).then(() => { S.counters.social++; checkAchievements(); }).catch(() => toast('Could not send')); },
  shout: () => { const i = $('#shout-in'); const t = (i && i.value || '').trim().slice(0, 140); if(!t || !NET.room) return; i.value = ''; NET.room.emit('shout', {text:t, name:S.char.name}).then(() => { S.counters.social++; checkAchievements(); }).catch(() => toast('Could not send')); },
  srvJoin: a => connectServer(a),
  srvAdd: () => { const i = $('#srv-in'); if(i && i.value.trim()) connectServer(i.value); },
  srvLeave: () => { disconnectServer(); render(); toast('Left the server'); },
  hostStart: () => startHosting(),
  hostStop: () => showModal('Stop hosting?', '<p>Everyone in your village is disconnected. The leaderboard is kept on this device for next time.</p>', [{label:'Keep hosting', act:'closeModal'}, {label:'Stop hosting', act:'doHostStop', cls:'bad'}]),
  doHostStop: () => { closeModal(); stopHosting(); toast('Your village is closed'); },
  hostShare: () => {
    const url = inviteLink(), text = `Join my Tsukimori village! Code ${HOST.code}`;
    if(navigator.share) return navigator.share({title:'Tsukimori', text, url}).catch(() => {});
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Invite link copied'), () => toast(url)); else toast(url);
  },
  srvForget: a => { lsSet(SERVERS_KEY, lsGet(SERVERS_KEY, []).filter(x => x.url !== a)); render(); },
  commClaim: a => { const i = +a, g = COMMUNITY_GOALS[i], ev = S.event; ev.commClaimed = ev.commClaimed || []; if(ev.commClaimed.includes(i) || raidTotals().total < g.pct) return; ev.commClaimed.push(i); S.shards += g.shards; persist(); render(); toast(`+${g.shards} Moon Shards`); },
  petBuy: a => {
    const [who, id] = splitArg(a), p = PET[id], c = S.char, o = ninjaById(who); if(!p || !o || o.pets.includes(id)) return;
    if(o.level < p.lvl) return toast(`Requires level ${p.lvl}`);
    if(p.shards){ if(S.shards < p.shards) return toast('Not enough Moon Shards'); S.shards -= p.shards; }
    else { if(c.gold < p.price) return toast('Not enough gold'); c.gold -= p.price; }
    o.pets.push(id); o.pet = id; persist(); render(); toast(`${p.name} joins ${o === c ? 'you' : o.name}!`);
  },
  petSet: a => { const [who, id] = splitArg(a), o = ninjaById(who); if(!o) return; o.pet = id || null; persist(); render(); toast(id ? `${PET[id].name} will fight behind ${o === S.char ? 'you' : o.name}` : 'The pet stays home'); },
  petCtl: a => { const [who, v] = splitArg(a), o = ninjaById(who); if(!o) return; o.petAuto = v === '1'; persist(); render(); toast(o.petAuto ? 'The pet fights on Auto' : 'You will command the pet'); },
  ctl: a => { if(!B) return; const u = allUnits().find(x => x.uid === +a); if(!u) return; setAuto(u, u.controller === 'player'); persist(); updateBattle(); },
  bestLoadout: a => tryDo(() => { const c = ninjaById(a); autoLoadout(c); return `Loadout set: ${c.loadout.map(id => SKILL[id].name).join(', ')}`; }),
  talent: a => tryDo(() => { const [who, tier, id] = a.split(':'); return pickTalent(ninjaById(who), +tier, id); }),
  talentAuto: a => tryDo(() => { const c = ninjaById(a), n = talentsUnpicked(c); if(!n) throw new Error('Every unlocked tier already has a talent'); c.talents = autoTalents(c, true); return `Picked ${n} talent${n > 1 ? 's' : ''}`; }),
  optMe: () => tryDo(() => summarize(optimizeTeam('leader'))),
  gearMe: () => tryDo(() => { const got = applyGearPlan(gearPlan([S.char], Math.floor(S.char.gold * 0.9)).plan); return got.length ? 'Equipped: ' + got.join(', ') : 'Already well equipped for your budget'; }),
  gearTeam: () => tryDo(() => { const got = applyGearPlan(gearPlan(teamNinja(), Math.floor(S.char.gold * 0.9)).plan); return got.length ? 'Equipped: ' + got.join(', ') : 'Everyone is already well equipped'; }),
  custom: a => { UI.custWho = a || 'leader'; go('custom'); },
  custBack: () => { if(UI.custWho && UI.custWho !== 'leader'){ UI.recruitId = UI.custWho; go('recruit'); } else go('character'); },
  lookSet: a => { const [k, v] = splitArg(a), c = ninjaById(UI.custWho); if(!c) return; applyLook(c, k, v); persist(); publishEcho(); render(); },
  lookRandom: () => { const c = ninjaById(UI.custWho); if(!c) return; const r = a => a[Math.floor(Math.random() * a.length)];
    Object.assign(c.look, {gender:r(['m', 'f']), hairStyle:r(HAIR_STYLES).id, hair:r(HAIR_COLORS), outfit:r(OUTFIT_COLORS), eyes:r(EYE_COLORS), skin:r(SKIN_TONES), bandColor:r(BAND_COLORS)}); persist(); publishEcho(); render(); },
  renameApply: () => { const c = ninjaById(UI.custWho), v = (($('#cust-name') || {}).value || '').trim().slice(0, 16); if(!c) return; if(!v) return toast('A ninja needs a name'); c.name = v; persist(); publishEcho(); presence(); render(); toast(`Now called ${v}`); },
  clanJoin: a => {
    const cl = CLAN[a], c = S.char, cost = c.clan ? 500 : 200;
    if(c.level < cl.lvl) return toast(`Requires level ${cl.lvl}`);
    if(c.gold < cost) return toast('Not enough gold');
    c.gold -= cost; c.clan = {id:a, rep:0}; persist(); render(); toast(`Welcome to the ${cl.name}`);
  },
  clanLeave: () => showModal('Leave your clan?', '<p>You lose your clan perks and all reputation.</p>', [{label:'Stay', act:'closeModal'}, {label:'Leave clan', act:'doClanLeave', cls:'bad'}]),
  doClanLeave: () => { closeModal(); S.char.clan = null; persist(); render(); },
  donate: () => { const c = S.char; if(!c.clan || c.gold < 100) return; c.gold -= 100; const up = addClanRep(5); persist(); render(); toast(up ? `Clan rank up: ${CLAN_TIERS[up].name}!` : '+5 clan reputation'); },
  arenaRefresh: () => { refreshArena(); render(); },
  arenaFight: a => {
    const g = a === 'custom' ? UI.customGhost : S.arena.opps[+a]; if(!g) return;
    RUN = {kind:'arena', ghost:g, custom:a === 'custom', xp:0, gold:0, stages:1}; startStage();
  },
  arenaSelf: () => {
    const g = normChar(JSON.parse(JSON.stringify(S.char))); g.name = ('Echo of ' + S.char.name).slice(0, 16); g.archetype = 'Your own build'; g.diff = 0;
    RUN = {kind:'arena', ghost:g, custom:true, xp:0, gold:0, stages:1}; startStage();
  },
  arenaCustom: () => {
    const t = ($('#ghostin') || {}).value || '';
    try{
      let o = JSON.parse(t); if(o.char) o = o.char;
      if(!o || !o.name || !o.element) throw new Error('That text is not a Tsukimori build.');
      const g = normChar(o); g.archetype = "A friend's build"; g.diff = clamp(g.level - S.char.level, -2, 3);
      UI.customGhost = g; ACT.arenaFight('custom');
    }catch(e){ toast(e instanceof SyntaxError ? 'That text is not valid JSON.' : e.message); }
  },
  copyBuild: () => {
    const c = S.char, build = JSON.stringify(Object.assign(buildOf(c), {squad:activeSquad().map(r => Object.assign(buildOf(r), {clan:null}))}));
    const ta = $('#ghostin');
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(build).then(() => toast('Build copied. Send it to a friend!'), () => { ta.value = build; ta.select(); toast('Copy the build from the box'); });
    else { ta.value = build; ta.select(); toast('Copy the build from the box'); }
  },
  eventFight: () => startEvent(),
  eventClaim: a => {
    syncEvent(); const i = +a, m = EVENT_MILESTONES[i], ev = S.event, c = S.char;
    if(ev.claimed.includes(i) || ev.dmg / ev.pool * 100 < m.pct) return;
    const r = m.reward; ev.claimed.push(i);
    if(r.goldPerLvl) c.gold += r.goldPerLvl * c.level;
    if(r.items) for(const k in r.items) addInv(k, r.items[k]);
    if(r.shards) S.shards += r.shards;
    if(r.item) addInv(r.item, 1);
    persist(); render(); toast(`Claimed: ${m.label}`);
  },
  shardBuy: a => { const it = ITEM[a]; if(S.shards < it.shards) return toast('Not enough Moon Shards'); S.shards -= it.shards; addInv(a, 1); persist(); render(); toast(`Got ${it.name}`); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el || el.disabled) return;
  const f = ACT[el.dataset.act]; if(f){ e.preventDefault(); f(el.dataset.arg, el); }
});
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][role="button"]')){ e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', {bubbles:true})); }
});
document.addEventListener('change', e => { if(e.target.dataset && e.target.dataset.look){ persist(); publishEcho(); render(); } });
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  if(e.target.id === 'cust-name'){ e.preventDefault(); ACT.renameApply(); }
  if(e.target.id === 'g-input'){ e.preventDefault(); ACT.guideSend(); }
  if(e.target.id === 'shout-in'){ e.preventDefault(); ACT.shout(); }
  if(e.target.id === 'srv-in'){ e.preventDefault(); ACT.srvAdd(); }
});
function applyLook(c, k, v){
  if(k === 'band'){ if(v === 'none') c.look.band = 'none'; else delete c.look.band; }
  else if(k === 'mask'){ if(v === 'none') delete c.look.mask; else c.look.mask = v; }
  else c.look[k] = v;
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.look;
  if(k){ const c = ninjaById(UI.custWho); if(c){ applyLook(c, k, e.target.value); const pv = $('.preview-sprite'); if(pv) pv.innerHTML = ninjaSVG(c.look, gearLooks(c), {scarf:ELEMENTS[c.element].color}); } return; }
  if(e.target.id === 'cname'){ UI.create.name = e.target.value; const p = $('.preview-name'); if(p) p.textContent = e.target.value || 'Your name'; }
});

// Boot
render();
initNet();
</script>
</body>
</html>
