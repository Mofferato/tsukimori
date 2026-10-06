
/* =====================================================================
   AUTOMATION: pick the best talents, techniques and gear for any ninja.
   Rule-based and offline. The technique ranking reuses the battle AI's value model (moveValue),
   so what "best" means here is what the allied AI would actually want to cast. Momo calls these too.
   ===================================================================== */
const ninjaById = id => (!id || id === 'leader') ? S.char : recruitById(id);
const teamNinja = () => [S.char, ...activeSquad()];
const isLeaderChar = c => c === S.char;

/* ---------------- talents ---------------- */
// How well a talent suits a build (higher is better): it leans on the loadout's mix of technique families and the element.
function talentFit(t, c){
  const lo = c.loadout.map(id => SKILL[id]).filter(Boolean), n = Math.max(1, lo.length);
  const share = ty => lo.filter(s => s.type === ty).length / n, avgCp = lo.reduce((a, s) => a + s.cp, 0) / n;
  const el = c.element, longCd = lo.filter(s => s.cd >= 3).length;
  const base = {hardy:1 + (el === 'earth' || el === 'water' ? 0.5 : 0), deep:0.8 + avgCp / 40, eyes:0.9 + (el === 'wind' || el === 'lightning' ? 0.3 : 0),
    thrifty:0.9 + avgCp / 35, brisk:0.9 + longCd * 0.12, reflex:0.9 + (el === 'wind' ? 0.3 : 0),
    fist:0.4 + 2.4 * share('taijutsu'), veil:0.4 + 2.6 * share('genjutsu'), elems:0.5 + 1.9 * share('ninjutsu'),
    forbid:0.3 + 3.2 * share('kinjutsu'), thirst:1, ember:0.9, gambit:1, exec:1.05, stoic:0.95 + (el === 'earth' ? 0.3 : 0),
    second:1.1, master:1.15, bless:1.2};
  return base[t.id] == null ? 1 : base[t.id];
}
// The best pick for every unlocked tier. keep = true leaves choices already made alone.
function autoTalents(c, keep){
  const out = blankTalents();
  TALENT_TIERS.forEach((lv, i) => {
    if(c.level < lv) return;
    if(keep && c.talents && TALENT[c.talents[i]]){ out[i] = c.talents[i]; return; }
    out[i] = TALENTS.filter(t => t.tier === i).sort((a, b) => talentFit(b, c) - talentFit(a, c))[0].id;
  });
  return out;
}
const talentsOpen = c => TALENT_TIERS.filter(lv => c.level >= lv).length;
const talentsUnpicked = c => TALENT_TIERS.filter((lv, i) => c.level >= lv && !TALENT[(c.talents || [])[i]]).length;
function pickTalent(c, tier, id, free){
  const t = TALENT[id]; if(!t || t.tier !== tier) throw new Error('No such talent');
  if(c.level < TALENT_TIERS[tier]) throw new Error(`Unlocks at level ${TALENT_TIERS[tier]}`);
  if(!c.talents) c.talents = blankTalents();
  if(c.talents[tier] === id) return `${t.name} is already chosen`;
  const swap = !!c.talents[tier], cost = swap ? talentSwapCost(c) : 0;
  if(swap && !free){ if(S.char.gold < cost) throw new Error(`Changing a talent costs 🪙 ${cost}`); S.char.gold -= cost; }
  c.talents[tier] = id; return `${t.name} chosen${swap && !free ? ` (-${cost} gold)` : ''}`;
}
const talentSwapCost = c => 60 + c.level * 10;

/* ---------------- techniques ---------------- */
// Worth of every technique to this ninja, judged on a sandbox battle (a wounded, half-spent ninja against two average foes).
function worthMap(c){
  const u = unitFromChar(c, 'ai', 'ally'); u.hp = Math.round(u.maxHp * 0.65); u.cp = Math.round(u.maxCp * 0.7);
  const b = enemyStats(c.level), foes = [0, 1].map(() => mkUnit({name:'Foe', side:'enemy', controller:'ai', el:null, level:c.level, maxHp:Math.round(b.hp), maxCp:Math.round(b.cp), agi:Math.round(b.agi), atk:b.atk, crit:5, dodge:0, skills:[], kind:'ninja', look:{}}));
  const saved = B; B = {allies:[u], enemies:foes, over:false, active:u, target:foes[0].uid, meta:{}, log:[], queue:[]};
  const W = {};
  try{ for(const s of SKILLS) if(!s.enemyOnly && !s.petOnly) W[s.id] = moveValue(u, s, foes[0], foes); } finally { B = saved; }
  return W;
}
// The best MAX_LOADOUT of a pool of technique ids: top value, but with sane variety (a couple of buffs, a couple of heals, one cheap attack).
function bestLoadout(c, pool, W){
  W = W || worthMap(c);
  const rows = [...new Set(pool)].map(id => SKILL[id]).filter(Boolean).map(s => ({s, v:W[s.id] == null ? 0 : W[s.id]})).sort((a, b) => b.v - a.v);
  const isBuff = s => !s.power && !s.heal && !s.cpRestore && s.target === 'self', isHeal = s => s.heal || s.cpRestore;
  const pick = [], n = f => pick.filter(r => f(r.s)).length;
  for(const r of rows){
    if(pick.length >= MAX_LOADOUT) break;
    if(r.v <= 0.15) continue;
    if(isBuff(r.s) && n(isBuff) >= 2) continue;
    if(isHeal(r.s) && n(isHeal) >= 2) continue;
    pick.push(r);
  }
  const swapIn = r => { if(!r || pick.includes(r)) return; if(pick.length < MAX_LOADOUT) pick.push(r); else { const i = pick.reduce((w, x, k) => x.v < pick[w].v && !(isHeal(x.s) || (x.s.power && x.s.cp <= 12)) ? k : w, pick.length - 1); pick[i] = r; } };
  if(!pick.some(r => r.s.power && r.s.cp <= 12)) swapIn(rows.find(r => r.s.power && r.s.cp <= 12));
  if(!pick.some(r => isHeal(r.s))) swapIn(rows.find(r => isHeal(r.s) && r.v > 0));
  pick.sort((a, b) => a.s.lvl - b.s.lvl);
  return {ids:pick.map(r => r.s.id), score:pick.reduce((a, r) => a + Math.max(0, r.v), 0)};
}
const autoLoadout = c => { c.loadout = bestLoadout(c, c.skills).ids; return c.loadout; };
// Spend up to `budget` gold on techniques. First work out the best loadout from everything the ninja could learn, and buy the missing
// parts of it (best value per gold first); only then fall back to the best marginal affordable buy. Never buys techniques that
// would just be replaced later.
function autoLearn(c, budget){
  const W = worthMap(c), bought = [], eligible = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && c.level >= s.lvl); let spent = 0;
  for(let guard = 0; guard < 16; guard++){
    const ideal = bestLoadout(c, eligible.map(s => s.id), W);
    const missing = ideal.ids.filter(id => !c.skills.includes(id)).map(id => SKILL[id]).filter(s => spent + skillPrice(s, c) <= budget);
    let pick = null;
    if(missing.length) pick = missing.sort((a, b) => W[b.id] / skillPrice(b, c) - W[a.id] / skillPrice(a, c))[0];
    else{
      const base = bestLoadout(c, c.skills, W).score; let best = null;
      for(const s of eligible){
        if(c.skills.includes(s.id)) continue;
        const price = skillPrice(s, c); if(spent + price > budget) continue;
        const gain = bestLoadout(c, [...c.skills, s.id], W).score - base; if(gain < Math.max(0.3, base * 0.08)) continue;
        const eff = gain / Math.sqrt(price); if(!best || eff > best.eff) best = {s, eff};
      }
      pick = best && best.s;
    }
    if(!pick) break;
    c.skills.push(pick.id); spent += skillPrice(pick, c); bought.push(pick.name);
  }
  return {bought, spent};
}

/* ---------------- gear ---------------- */
// What a stat point is worth to this build, in "Power equivalents".
function gearWeights(c){
  const w = {hp:.25, cp:.3, agi:2, atk:2.5, crit:1.5, dodge:1.5};
  const m = {fire:{atk:1.1, crit:1.1}, wind:{agi:1.2, dodge:1.1}, lightning:{crit:1.25, agi:1.1}, earth:{hp:1.4, dodge:.9}, water:{cp:1.25, hp:1.1}}[c.element] || {};
  for(const k in m) w[k] *= m[k];
  const lo = c.loadout.map(id => SKILL[id]).filter(Boolean); if(lo.length){ const avg = lo.reduce((a, s) => a + s.cp, 0) / lo.length; w.cp *= 0.8 + avg / 40; }
  return w;
}
const gearScore = (it, c, w) => it ? Object.entries(it.bonus || {}).reduce((a, [k, v]) => a + v * (w[k] || 1), 0) : 0;
// A plan of upgrades for several ninja at once. Each (ninja, slot) gets at most one upgrade, and the set is chosen to maximise
// the total gain within the budget (a multiple-choice knapsack), so it never buys a cheap tier only to replace it.
function gearPlan(ninjas, budget){
  const unit = 10, cap = Math.max(0, Math.floor(budget / unit)), groups = [];
  for(const c of ninjas){
    const w = gearWeights(c);
    for(const sl of SLOTS){
      const cur = ITEM[c.equip[sl]], cs = gearScore(cur, c, w), opts = [];
      for(const it of ITEMS){
        if(it.slot !== sl || it.lvl > c.level || it.shards || it === cur) continue;
        const owned = (S.inventory[it.id] || 0) > 0; if(!owned && it.shop === false) continue;
        const price = owned ? 0 : it.price, gain = gearScore(it, c, w) - cs;
        if(gain < Math.max(0.5, cs * 0.03) || price > budget) continue;
        opts.push({c, sl, it, price, owned, gain, cost:Math.ceil(price / unit)});
      }
      if(opts.length) groups.push(opts);
    }
  }
  let dp = new Array(cap + 1).fill(0); const picks = [];
  for(const opts of groups){
    const nd = dp.slice(), pk = new Int16Array(cap + 1).fill(-1);
    opts.forEach((o, k) => { for(let b = o.cost; b <= cap; b++){ const v = dp[b - o.cost] + o.gain - o.price * 1e-6; if(v > nd[b]){ nd[b] = v; pk[b] = k; } } });
    picks.push(pk); dp = nd;
  }
  const plan = []; let b = cap;
  for(let g = groups.length - 1; g >= 0; g--){ const k = picks[g][b]; if(k >= 0){ plan.push(groups[g][k]); b -= groups[g][k].cost; } }
  plan.sort((x, y) => (y.gain / (y.price + 10)) - (x.gain / (x.price + 10)));
  return {plan, left:budget - plan.reduce((a, x) => a + x.price, 0)};
}
// Buys what's missing and equips it. Returns text lines.
function applyGearPlan(plan){
  const out = [];
  for(const st of plan){
    const {c, sl, it} = st; let paid = 0;
    if(!(S.inventory[it.id] > 0)){ if(it.shop === false || S.char.gold < it.price) continue; S.char.gold -= it.price; addInv(it.id, 1); paid = it.price; }
    if(isLeaderChar(c)){ const prev = c.equip[sl]; if(prev) addInv(prev, 1); addInv(it.id, -1); c.equip[sl] = it.id; }
    else equipRecruit(c, it.id);
    out.push(`${c.name}: ${it.name}${paid ? ` (🪙 ${paid})` : ''}`);
  }
  return out;
}
// Keep a few healing supplies on hand, up to `budget` gold.
function stockSupplies(budget){
  const L = S.char.level, want = [['salve', 4], ['pill', 3], ['g_salve', L >= 15 ? 3 : 0], ['spirit_pill', L >= 15 ? 2 : 0]], out = []; let spent = 0;
  for(const [id, n] of want){
    const it = ITEM[id]; if(!it || L < it.lvl) continue;
    const k = Math.min(n - (S.inventory[id] || 0), Math.floor((budget - spent) / it.price)); if(k <= 0) continue;
    S.char.gold -= k * it.price; addInv(id, k); spent += k * it.price; out.push(`${k}× ${it.name}`);
  }
  return out;
}

/* ---------------- put it together ---------------- */
// Optimizes one ninja: stat points, talents, techniques, loadout. `budget` is spent on techniques only (gear is planned for the whole team).
function optimizeNinja(c, budget){
  const out = [];
  if(c.points){ allocRecruit(c, autoAllocRecruit(c)); out.push('spent stat points'); }
  const before = JSON.stringify(c.talents);
  if(talentsUnpicked(c)){ c.talents = autoTalents(c, true); if(JSON.stringify(c.talents) !== before) out.push('picked talents'); }
  const L = autoLearn(c, budget); if(L.bought.length) out.push(`learned ${L.bought.join(', ')} (🪙 ${L.spent})`);
  S.char.gold -= L.spent;
  const lo = c.loadout.join(); autoLoadout(c); if(c.loadout.join() !== lo) out.push(`set ${c.loadout.length} techniques`);
  return out;
}
// The full treatment for the leader and the battle squad. Returns text lines describing what changed.
function optimizeTeam(who){
  const ninjas = who === 'all' || !who ? teamNinja() : [ninjaById(who)], lines = [];
  const reserve = Math.round(S.char.gold * 0.08);
  let pot = Math.max(0, S.char.gold - reserve);
  const techShare = Math.round(pot * 0.4 / ninjas.length);
  for(const c of ninjas){
    const gold0 = S.char.gold, r = optimizeNinja(c, Math.min(techShare, Math.max(0, S.char.gold - reserve)));
    if(r.length) lines.push(`${c.name}: ${r.join('; ')}`);
    pot -= gold0 - S.char.gold;
  }
  const g = gearPlan(ninjas, Math.max(0, Math.min(pot, S.char.gold - reserve)));
  const bought = applyGearPlan(g.plan);
  if(bought.length) lines.push('Gear: ' + bought.join(', '));
  const sup = stockSupplies(Math.max(0, Math.min(Math.round(S.char.gold * 0.5), S.char.gold - 0)));
  if(sup.length) lines.push('Supplies: ' + sup.join(', '));
  return lines;
}
