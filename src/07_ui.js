
/* ============================ UI SHELL ============================ */
function go(screen){ UI.screen = screen; UI.itemPanel = false; closeModal(); render(); window.scrollTo(0, 0); }
function render(){
  const scr = UI.screen, hud = $('#hud');
  const hudOn = S && S.char && !['title','create','battle'].includes(scr);
  hud.innerHTML = hudOn ? hudHTML() : ''; hud.style.display = hudOn ? '' : 'none';
  if(scr === 'battle'){ renderBattle(); renderGuide(); presence(); return; }
  const R = {title:titleScreen, create:createScreen, hub:hubScreen, missions:missionScreen, academy:academyScreen, shop:shopScreen, home:homeScreen, character:charScreen, results:resultsScreen, system:systemScreen, den:denScreen, clan:clanScreen, squad:squadScreen, recruit:recruitScreen, arena:arenaScreen, event:eventScreen, journal:journalScreen, online:onlineScreen};
  $('#main').innerHTML = (R[scr] || hubScreen)();
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

/* ============================ SCREENS ============================ */
function titleScreen(){
  const saved = loadLocal(), has = saved && saved.char;
  return `<section class="title">
    <div class="title-art"><div class="moonbg"></div><div class="title-ninja">${ninjaSVG({gender:'m',hairStyle:'spiky',hair:'#2b2b3a',outfit:'#27347f',eyes:'#3b6fd6',skin:'#f3d2b3'}, {weapon:{w:'sword'}, back:{b:'scroll'}}, {scarf:'#e8553a'})}</div></div>
    <h1>Tsukimori<small>A moon-forest ninja RPG</small></h1>
    <p class="lede">Train at the academy, master the five elements and climb from Lantern Pupil to Eclipse Warden.</p>
    <div class="title-btns">
      ${has ? `<button class="btn primary big" data-act="continue">Continue as ${esc(saved.char.name)} (Lv ${saved.char.level | 0})</button>` : ''}
      <button class="btn ${has ? '' : 'primary'} big" data-act="go" data-arg="create">Create a new ninja</button>
      <button class="btn ghost" data-act="go" data-arg="system">Import a save</button>
    </div></section>`;
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
  const c = S.char, tab = UI.tab.academy || c.element, list = SKILLS.filter(s => s.el === tab && !s.enemyOnly && !s.petOnly);
  return `<section><h2 class="scr-title">🏯 Academy</h2>
    <div class="panel loadout"><div class="lo-head"><b>Battle loadout</b><small>${c.loadout.length} of ${MAX_LOADOUT} slots. Tap a slot to remove it.</small></div>
      <div class="lo-slots">${Array.from({length:MAX_LOADOUT}, (_, i) => { const s = SKILL[c.loadout[i]]; return s ? `<button class="lo-slot" style="--c:${ELEMENTS[s.el].color}" data-act="toggleLoad" data-arg="${s.id}" aria-label="Remove ${s.name}">${s.icon}<small>${s.name}</small></button>` : `<div class="lo-slot empty">empty</div>`; }).join('')}</div></div>
    <div class="tabs" role="tablist">${EL_ORDER.map(e => `<button class="tab ${e === tab ? 'on' : ''}" style="--c:${ELEMENTS[e].color}" data-act="tab" data-arg="academy:${e}" role="tab" aria-selected="${e === tab}">${ELEMENTS[e].icon} ${ELEMENTS[e].name}${e === c.element ? ' ★' : ''}</button>`).join('')}</div>
    <p class="note">${tab === c.element ? '★ Your affinity element: techniques cost the standard price.' : 'Off-affinity techniques cost double, but let you cover your weak matchups.'}</p>
    <div class="stack">${list.map(skillCard).join('')}</div>
  </section>`;
}
function skillCard(s){
  const c = S.char, owned = c.skills.includes(s.id), inLo = c.loadout.includes(s.id), locked = c.level < s.lvl, price = skillPrice(s);
  let btn;
  if(owned) btn = `<button class="btn ${inLo ? '' : 'primary'}" data-act="toggleLoad" data-arg="${s.id}">${inLo ? 'Unequip' : 'Equip'}</button>`;
  else if(locked) btn = `<button class="btn" disabled>🔒 Level ${s.lvl}</button>`;
  else btn = `<button class="btn primary" data-act="learn" data-arg="${s.id}" ${c.gold < price ? 'disabled' : ''}>Learn for 🪙 ${price}</button>`;
  return `<article class="panel skill ${locked && !owned ? 'locked' : ''}" style="--c:${ELEMENTS[s.el].color}">
    <div class="sk-ic">${s.icon}</div>
    <div class="sk-body"><h4>${s.name}<small>Lv ${s.lvl}</small></h4><p>${s.desc}</p>
      <div class="tags"><span class="tag cp">${s.cp} CP</span><span class="tag">${s.cd}-turn cooldown</span>${skillTags(s).map(t => `<span class="tag">${t}</span>`).join('')}</div></div>
    <div class="sk-act">${owned ? `<span class="owned">✓ Learned</span>` : ''}${btn}</div>
  </article>`;
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
        <div class="pts">${c.points ? `<b>${c.points}</b> stat points to spend` : 'No unspent points'} <small class="muted">(you earn ${POINTS_PER_LEVEL} per level)</small></div>
        ${row('hp','❤️','Health', st.maxHp, '+10 max HP per point')}
        ${row('cp','🔷','Chakra', st.maxCp, '+6 max Chakra per point')}
        ${row('agi','💨','Agility', st.agi, '+2 Agility per point: act sooner, dodge and crit more')}
        <div class="derived"><span>⚔️ Power ${st.atk} (level, weapon, clan)</span>${st.elem ? `<span>${ELEMENTS[st.elem].icon} +${Math.round(st.elemPct * 100)}% ${ELEMENTS[st.elem].name} damage</span>` : ''}<span>🎯 Crit ${st.crit.toFixed(1)}%</span><span>🌫️ Gear dodge +${st.dodge}%</span></div>
        <button class="btn sm ghost" data-act="respec" ${c.alloc.hp + c.alloc.cp + c.alloc.agi ? '' : 'disabled'}>Refund all points</button>
      </div>
    </div>
    <div class="panel" style="margin-top:12px"><h3>Rank path</h3><ol class="ranks">${RANKS.map(x => `<li class="${c.level >= x.min ? 'done' : ''} ${x === r ? 'cur' : ''}"><b>${x.name}</b><small>Level ${x.min}+</small></li>`).join('')}</ol></div>
    <div class="panel wheel-wrap">${wheelSVG(c.element)}<div><h3>Your matchups</h3><p class="muted">${ELEMENTS[c.element].name} techniques hit ${ELEMENTS[ELEMENTS[c.element].beats].name} foes 25% harder. ${ELEMENTS[EL_ORDER.find(e => ELEMENTS[e].beats === c.element)].name} techniques hit you 25% harder, so learn an off-element technique to cover it.</p></div></div>
    <div class="panel records" style="margin-top:12px"><span>📜 Missions cleared ${S.stats.missions}</span><span>🏆 Battles won ${S.stats.won}</span><span>🩹 Battles lost ${S.stats.lost}</span><span>🏟️ Arena ${S.arena.wins}–${S.arena.losses}</span><span>🌕 Moon Shards ${S.shards}</span></div>
  </section>`;
}
function resultsScreen(){
  const r = UI.results; if(!r) return hubScreen();
  const c = S.char, mine = r.newSkills.filter(s => s.el === c.element);
  return `<section class="${r.win ? 'win' : 'lose'}">
    <div class="res-banner"><span>${r.title}</span><small>${esc(r.sub)}</small></div>
    <div class="panel res-body"><div class="res-sprite ${r.win ? 'cheer' : 'slump'}">${playerSprite()}</div>
      <div><div class="res-row">✨ <b>+${r.xp}</b> XP</div><div class="res-row">🪙 <b>+${r.gold}</b> gold</div>
        ${r.items.map(it => `<div class="res-row">${ITEM[it.id].icon} ${ITEM[it.id].name}${it.first ? ' <span class="chip" style="--c:var(--gold)">first clear</span>' : ''}</div>`).join('')}
        ${r.lines.map(l => `<div class="res-row" style="font-size:14px">${l}</div>`).join('')}
        <div class="xpline"><span>Lv ${c.level}</span><span class="bar xp"><i style="width:${xpPct(c)}%"></i></span><span>${c.level >= MAX_LEVEL ? 'MAX' : `${c.xp}/${xpToNext(c.level)}`}</span></div></div></div>
    ${r.ups.length ? `<div class="panel hl-panel">⬆️ Reached level ${c.level}! You have ${c.points} stat points to spend.</div>` : ''}
    ${(r.ach || []).map(a => `<div class="panel hl-panel">🏅 Achievement: ${a.icon} ${a.name}! ${a.reward.gold ? `+${a.reward.gold} gold ` : ''}${a.reward.shards ? `+${a.reward.shards} shards` : ''}</div>`).join('')}
    ${r.newRank ? `<div class="panel hl-panel">🎖️ New rank: ${r.newRank.name}. ${r.newRank.desc}</div>` : ''}
    ${mine.length ? `<div class="panel hl-panel">📖 New at the Academy: ${mine.map(s => s.icon + ' ' + s.name).join(', ')}</div>` : ''}
    ${!r.win && !r.fled ? `<p class="muted center">Tip: bring salves, Charge when Chakra runs low, and lead with the element that beats your foe.</p>` : ''}
    <div class="res-btns">
      <button class="btn primary" data-act="go" data-arg="hub">Return to the village</button>
      ${r.retry ? `<button class="btn" data-act="${r.retry.act}" data-arg="${r.retry.arg}">${r.retry.label}</button>` : ''}
      ${c.points ? `<button class="btn" data-act="go" data-arg="character">Spend points</button>` : ''}
    </div></section>`;
}
function systemScreen(){
  const has = S && S.char;
  return `<section><h2 class="scr-title">💾 Save and load</h2><div class="stack">
    ${has ? `<div class="panel"><h3>Export</h3><p class="muted">Progress autosaves in this browser after every mission and purchase. Copy this JSON to keep a backup or move to another device.</p>
      <textarea id="exp" readonly rows="5">${esc(JSON.stringify(S))}</textarea><button class="btn primary" data-act="copyExport">Copy save</button></div>` : ''}
    <div class="panel"><h3>Import</h3><p class="muted">Paste a save exported from Tsukimori. This replaces the current game.</p>
      <textarea id="imp" rows="5" placeholder='{"version":1, ...}'></textarea><button class="btn primary" data-act="importSave">Load save</button></div>
    ${has ? `<div class="panel"><h3>Cloud save</h3><p class="muted">${NET.db && NET.uid ? 'Keep a private copy of your save on your Claude account.' : 'Available when you play the Claude-hosted version.'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="cloudSave" ${NET.db && NET.uid ? '' : 'disabled'}>Save to cloud</button><button class="btn" data-act="cloudLoad" ${NET.db && NET.uid ? '' : 'disabled'}>Load from cloud</button></div></div>
      <div class="panel"><h3>Sound</h3><div class="seg"><button class="${S.settings.sound ? 'on' : ''}" data-act="soundSet" data-arg="1">On</button><button class="${S.settings.sound ? '' : 'on'}" data-act="soundSet" data-arg="0">Off</button></div></div>
      <div class="panel"><h3>Battle speed</h3><div class="seg">${[1,2,3].map(v => `<button class="${S.settings.speed === v ? 'on' : ''}" data-act="speed" data-arg="${v}">${v}×</button>`).join('')}</div></div>
      <div class="panel"><h3>Start over</h3><p class="muted">Deletes this browser's save. Export first if you want to keep it.</p><button class="btn bad" data-act="askNew">Start a new game</button></div>`
      : `<button class="btn ghost" data-act="go" data-arg="title">Back to title</button>`}
  </div></section>`;
}


/* ---------- Beast Den (pets) ---------- */
function denScreen(){
  const c = S.char; if(c.level < 3) return lockedScreen('🦊 Beast Den', 3, 'Beast handlers will trust you with a partner once you prove yourself on a few missions.');
  const st = charStats(c);
  return `<section><h2 class="scr-title">🦊 Beast Den</h2>
    <p class="note">One pet fights beside you under its own control. Its stats scale with yours, and every battle it wins together with you raises its bond (up to level 10, +6% stats per level).</p>
    <div class="stack">${PETS.map(p => {
      const own = c.pets.includes(p.id), act = c.pet === p.id, lock = c.level < p.lvl, bond = c.bond[p.id] || 0;
      const pu = unitFromPet(p.id, st, 'ally', bond, c.level);
      const cost = p.shards ? `🔴 ${p.shards} shards` : `🪙 ${p.price}`;
      const afford = p.shards ? S.shards >= p.shards : c.gold >= p.price;
      let btn;
      if(own) btn = act ? `<button class="btn" data-act="petSet" data-arg="">Send home</button>` : `<button class="btn primary" data-act="petSet" data-arg="${p.id}">Bring along</button>`;
      else if(lock) btn = `<button class="btn" disabled>🔒 Level ${p.lvl}</button>`;
      else btn = `<button class="btn primary" data-act="petBuy" data-arg="${p.id}" ${afford ? '' : 'disabled'}>Adopt for ${cost}</button>`;
      return `<article class="panel pet-card ${act ? 'active' : ''} ${lock && !own ? 'locked' : ''}">
        <div class="ps">${petSprite(p.id)}</div>
        <div><h3>${p.name} <span class="chip" style="--c:${ELEMENTS[p.el].color}">${ELEMENTS[p.el].icon} ${ELEMENTS[p.el].name}</span></h3>
          <p class="muted" style="font-size:13.5px">${p.desc}</p>
          <div class="tags"><span class="tag">❤️ ${pu.maxHp}</span><span class="tag">⚔️ ${Math.round(pu.atk)}</span><span class="tag">💨 ${pu.agi}</span>${own ? `<span class="tag">🐾 Bond ${bondLevel(bond)}</span>` : ''}${p.skills.map(id => `<span class="tag">${SKILL[id].icon} ${SKILL[id].name}</span>`).join('')}</div></div>
        <div class="acts">${act ? '<span class="owned">✓ Your partner</span>' : ''}${btn}</div></article>`;
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
  return `<div class="unit ${u.side} ${u.boss ? 'boss' : ''} ${u.isPet ? 'pet' : ''} ${u.isSquad ? 'squad' : ''}" id="u${u.uid}" ${u.side === 'enemy' ? `data-act="target" data-arg="${u.uid}" role="button" aria-label="Target ${esc(u.name)}"` : ''}>
    <div class="statuses"></div>
    <div class="sprite-wrap"><div class="sprite ${u.side === 'enemy' ? 'flip' : ''}">${spriteSVG(u)}</div><div class="target-mark">▼</div></div>
    <div class="plate"><span class="uname">${ELEMENTS[u.el].icon} ${esc(u.name)}</span><span class="ulv">${u.isPet ? '🐾' : u.isSquad ? '👥' : ''}Lv${u.level}</span></div>
    <div class="bars"><div class="bar hp"><i></i><b></b></div><div class="bar cp"><i></i><b></b></div></div>
  </div>`;
}
function renderBattle(){
  const m = B.meta;
  $('#main').innerHTML = `<section class="battle">
    <div class="bt-top"><div class="bt-title"><b>${esc(m.title)}</b><small>${m.sub ? esc(m.sub) : `Stage ${m.stage} of ${m.stages}`}${m.boss ? ' <span class="boss-flag">— boss</span>' : ''}${m.roundLimit ? `, round limit ${m.roundLimit}` : ''}</small></div>
      <div class="bt-tools"><button class="btn sm ${S.settings.auto ? 'primary' : ''}" data-act="autoB" id="autob" aria-pressed="${!!S.settings.auto}">🤖 Auto</button><button class="btn sm" data-act="soundB" id="sndb" aria-label="Sound">${S.settings.sound ? '🔊' : '🔇'}</button><button class="btn sm" data-act="speedB" id="spd" aria-label="Battle speed">⏩ ${S.settings.speed}×</button></div></div>
    <div class="turnorder" id="turnorder"></div>
    <div class="field">
      <div class="side ${B.allies.length > 1 ? 'multi' : ''}">${B.allies.map(unitCard).join('')}</div>
      <div class="vs">VS</div>
      <div class="side ${B.enemies.length > 1 ? 'multi' : ''}">${B.enemies.map(unitCard).join('')}</div>
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
  const hint = `<div class="turn-hint ${mine ? 'mine' : ''}">${B.over ? 'The battle is over…' : mine ? (u.isPlayer ? 'Your move. Tap a foe to target it, then choose an action.' : `👥 ${esc(u.name)}'s move. You're in command!`) : u ? `${esc(u.name)} is acting…` : 'Get ready…'}</div>`;
  if(UI.itemPanel && mine){
    const cons = ITEMS.filter(i => i.slot === 'consumable' && S.inventory[i.id] > 0);
    return hint + `<div class="item-panel">${cons.length ? cons.map(i => `<button class="ibtn" data-act="bUse" data-arg="${i.id}">${i.icon} ${i.name} ×${S.inventory[i.id]}<small>${i.desc}</small></button>`).join('') : '<div class="panel empty">No supplies left. Buy some at the Shop.</div>'}
      <button class="btn ghost" data-act="bItems">Back to actions</button></div>`;
  }
  const d = mine ? '' : 'disabled', t = getTarget();
  const sk = p.skills.map(id => SKILL[id]).filter(Boolean).map(s => {
    const raw = p.cds[s.id] || 0, cd = mine ? raw : Math.max(0, raw - 1), can = mine && cd <= 0 && p.cp >= s.cp;
    const em = s.power && t ? elemMult(s.el, t.el) : 1;
    return `<button class="sbtn ${cd > 0 ? 'oncd' : ''}" style="--c:${ELEMENTS[s.el].color}" data-act="bSkill" data-arg="${s.id}" ${can ? '' : 'disabled'} title="${esc(s.desc)}">
      <span class="si">${s.icon}</span><span class="sn">${s.name}</span><span class="sc">${s.cp} CP</span><span class="stg">${skillTags(s).slice(0, 2).join(', ')}</span>
      ${em > 1 ? '<span class="em up" title="Strong against target">▲</span>' : em < 1 ? '<span class="em down" title="Weak against target">▼</span>' : ''}
      ${cd > 0 ? `<span class="cdv" aria-label="${cd} turns">${cd}</span>` : ''}</button>`;
  }).join('');
  return hint + `<div class="act-row">
      <button class="abtn main" data-act="bAttack" ${d}><span class="ai">🗡️</span>Attack</button>
      <button class="abtn" data-act="bCharge" ${d}><span class="ai">🌀</span>Charge</button>
      <button class="abtn" data-act="bItems" ${d}><span class="ai">🎒</span>Item</button>
      <button class="abtn" data-act="bFlee" ${d}><span class="ai">🏳️</span>Retreat</button>
    </div><div class="skillbar">${sk || '<div class="muted">No techniques equipped. Visit the Academy.</div>'}</div>`;
}

/* ============================ ACTIONS ============================ */
const ACT = {
  go: a => { if(!['title','create','system'].includes(a) && !(S && S.char)) return go('title'); go(a); },
  continue: () => { try{ S = migrate(loadLocal()); go('hub'); checkLogin(); checkAchievements(); publishEcho(); }catch(e){ toast(e.message); } },
  cset: a => {
    const i = a.indexOf(':'), k = a.slice(0, i), v = a.slice(i + 1);
    UI.create[k] = v;
    if(k === 'gender') UI.create.hairStyle = v === 'f' ? 'ponytail' : 'spiky';
    render();
  },
  createDone: () => {
    const n = (UI.create.name || '').trim();
    if(!n){ toast('Give your ninja a name first'); const i = $('#cname'); if(i) i.focus(); return; }
    S = defaultState(); S.char = newCharacter(UI.create); persist();
    S.login = {day:todayKey(), streak:1}; go('hub'); publishEcho();
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
  respec: () => { const c = S.char; c.points += c.alloc.hp + c.alloc.cp + c.alloc.agi; c.alloc = {hp:0, cp:0, agi:0}; persist(); render(); toast('Points refunded'); },
  askNew: () => showModal('Start a new game?', '<p>This deletes the save in this browser. Export it first if you want to keep it.</p>', [{label:'Keep playing', act:'closeModal'}, {label:'Delete and start over', act:'doNewGame', cls:'bad'}]),
  doNewGame: () => { try{ localStorage.removeItem(SAVE_KEY); }catch(e){} S = null; UI.create = defaultCreate(); go('create'); },
  copyExport: () => {
    const ta = $('#exp'); if(!ta) return;
    const done = () => toast('Save copied');
    const fallback = () => { ta.focus(); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('Select the text and copy it manually'); } };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
  },
  importSave: () => {
    const t = ($('#imp') || {}).value || '';
    try{ S = migrate(JSON.parse(t)); persist(); go('hub'); toast(`Loaded ${S.char.name}`); }
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
  commClaim: a => { const i = +a, g = COMMUNITY_GOALS[i], ev = S.event; ev.commClaimed = ev.commClaimed || []; if(ev.commClaimed.includes(i) || raidTotals().total < g.pct) return; ev.commClaimed.push(i); S.shards += g.shards; persist(); render(); toast(`+${g.shards} Moon Shards`); },
  petBuy: a => {
    const p = PET[a], c = S.char; if(!p || c.pets.includes(a)) return;
    if(c.level < p.lvl) return toast(`Requires level ${p.lvl}`);
    if(p.shards){ if(S.shards < p.shards) return toast('Not enough Moon Shards'); S.shards -= p.shards; }
    else { if(c.gold < p.price) return toast('Not enough gold'); c.gold -= p.price; }
    c.pets.push(a); c.pet = a; persist(); render(); toast(`${p.name} joins you!`);
  },
  petSet: a => { S.char.pet = a || null; persist(); render(); toast(a ? `${PET[a].name} will fight beside you` : 'Your pet stays home'); },
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
    const c = S.char, build = JSON.stringify({name:c.name, element:c.element, level:c.level, look:c.look, alloc:c.alloc, equip:c.equip, skills:c.skills, loadout:c.loadout, pets:c.pet ? [c.pet] : [], pet:c.pet, bond:c.pet ? {[c.pet]:c.bond[c.pet] || 0} : {}, clan:c.clan});
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
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  if(e.target.id === 'g-input'){ e.preventDefault(); ACT.guideSend(); }
  if(e.target.id === 'shout-in'){ e.preventDefault(); ACT.shout(); }
});
document.addEventListener('input', e => {
  if(e.target.id === 'cname'){ UI.create.name = e.target.value; const p = $('.preview-name'); if(p) p.textContent = e.target.value || 'Your name'; }
});

// Boot
render();
initNet();
</script>
</body>
</html>
