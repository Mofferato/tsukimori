'use strict';
/* =====================================================================
   TSUKIMORI — a turn-based ninja RPG in one file (vanilla JS, SVG art)
   ---------------------------------------------------------------------
   EXTENSION GUIDE
   • All content is data: ELEMENTS, STATUSES, SKILLS, ENEMIES, ITEMS,
     MISSIONS, RANKS. Add an entry and it shows up in the Academy, Shop
     or Mission Board automatically (C/B/A/S ranks just need missions).
   • Battles are side-vs-side arrays: startBattle(allies, enemies, meta).
     A "unit" is a plain object from mkUnit(). controller:'player' waits
     for input; controller:'ai' runs aiAct(). Up to 3v3 is supported by
     layout, AoE skills ('allEnemies') and targeting already.
       - Pets:      push unitFromPet(def) into allies in startStage().
       - PvP ghosts: unitFromGhost(savedChar) = any build as an AI foe.
       - Clans:     add a passive bonus in clanBonus() (merged in charStats).
       - Boss event: an EVENTS entry is a mission with a schedule/window.
   • HOOKS: subscribe to 'battleStart' | 'battleEnd' | 'levelUp'.
   • Save format: the whole S object as JSON (versioned; see migrate()).
   ===================================================================== */

const MAX_LEVEL = 60, POINTS_PER_LEVEL = 3, MAX_LOADOUT = 6;

const ELEMENTS = {
  fire:      {name:'Fire',      icon:'🔥', color:'#e8553a', beats:'wind',      style:'Burst damage and lingering burns.'},
  wind:      {name:'Wind',      icon:'🍃', color:'#2fa37a', beats:'lightning', style:'Speed, flurries and bleeding cuts.'},
  lightning: {name:'Lightning', icon:'⚡', color:'#d4a012', beats:'earth',     style:'Stuns, chain strikes, huge single hits.'},
  earth:     {name:'Earth',     icon:'⛰️', color:'#9c6b36', beats:'water',     style:'Guards, crushing blows, staying power.'},
  water:     {name:'Water',     icon:'💧', color:'#3a8fd9', beats:'fire',      style:'Healing, slows and weakening.'},
};
const EL_ORDER = ['fire','wind','lightning','earth','water'];
function elemMult(a, d){
  if(!a || !d || !ELEMENTS[a] || !ELEMENTS[d]) return 1;
  if(ELEMENTS[a].beats === d) return 1.25;
  if(ELEMENTS[d].beats === a) return 0.75;
  return 1;
}

const RANKS = [
  {min:1,  name:'Lantern Pupil',  desc:'An academy student learning the basics.'},
  {min:10, name:'Reedblade',      desc:'A sworn ninja trusted with village errands.'},
  {min:25, name:'Moonhawk',       desc:'A squad leader cleared for dangerous work.'},
  {min:45, name:'Shadowcrest',    desc:'An elite operative of Tsukimori.'},
  {min:60, name:'Eclipse Warden', desc:'Guardian of the village. The summit.'},
];
const MISSION_RANKS = [
  {id:'D', lvl:1,  color:'#4f8a4a'},
  {id:'C', lvl:10, color:'#2f6ed8'},
  {id:'B', lvl:20, color:'#8a4fc4'},
  {id:'A', lvl:35, color:'#d9822b'},
  {id:'S', lvl:50, color:'#c2352c'},
];

// scale: 'atk' = value is a share of the caster's power (DoTs); 'maxhp' = share of the target's max HP
const STATUSES = {
  burn:    {name:'Burn',    icon:'🔥', kind:'debuff', scale:'atk',   desc:'Fire damage at the start of each turn.'},
  bleed:   {name:'Bleed',   icon:'🩸', kind:'debuff', scale:'atk',   desc:'Loses HP at the start of each turn.'},
  stun:    {name:'Stun',    icon:'💫', kind:'debuff', desc:'Loses the next turn.'},
  slow:    {name:'Slow',    icon:'🐌', kind:'debuff', desc:'Agility −40%.'},
  weaken:  {name:'Weaken',  icon:'🥀', kind:'debuff', desc:'Deals 25% less damage.'},
  expose:  {name:'Expose',  icon:'🎯', kind:'debuff', desc:'Takes 25% more damage.'},
  empower: {name:'Empower', icon:'💪', kind:'buff',   desc:'Deals 30% more damage.'},
  guard:   {name:'Guard',   icon:'🛡️', kind:'buff',   desc:'Takes 35% less damage.'},
  haste:   {name:'Haste',   icon:'💨', kind:'buff',   desc:'Agility +40% and +10% dodge.'},
  regen:   {name:'Regen',   icon:'🌿', kind:'buff',   scale:'maxhp', desc:'Heals part of max HP each turn.'},
};

/* SKILLS — target: 'enemy' (default) | 'self' | 'allEnemies'
   power = multiplier of the user's Power per hit, hits = number of hits
   apply = [{s:status, dur, pow, chance, on:'self'}], heal/cpRestore = share of max */
const TIER_PRICE = {1:40, 3:90, 6:180, 10:320, 15:520, 22:850, 35:1400};
const SKILLS = [
  // FIRE
  {id:'fire_spark',   el:'fire', lvl:1,  name:'Spark Palm',      icon:'✋', cp:8,  cd:1, power:1.35, desc:'A palm strike wrapped in sparks.'},
  {id:'fire_cinder',  el:'fire', lvl:3,  name:'Cinder Bloom',    icon:'🌺', cp:12, cd:3, power:0.8, apply:[{s:'burn',dur:3,pow:0.35}], desc:'Scatters embers that cling and burn.'},
  {id:'fire_resolve', el:'fire', lvl:6,  name:'Kindled Resolve', icon:'🕯️', cp:14, cd:4, target:'self', apply:[{s:'empower',dur:3}], desc:'Stoke your inner flame to hit harder.'},
  {id:'fire_hearth',  el:'fire', lvl:10, name:'Hearthfire Mend', icon:'♨️', cp:18, cd:4, target:'self', heal:0.22, apply:[{s:'regen',dur:2,pow:0.05}], desc:'Warmth knits your wounds closed.'},
  {id:'fire_flare',   el:'fire', lvl:15, name:'Flare Burst',     icon:'💥', cp:22, cd:3, power:1.8, apply:[{s:'weaken',dur:2}], desc:'A blinding blast that rattles the foe.'},
  {id:'fire_sunfall', el:'fire', lvl:22, name:'Crimson Sunfall', icon:'☀️', cp:32, cd:5, power:2.6, apply:[{s:'burn',dur:3,pow:0.5}], desc:'Call down a falling sun of flame.'},
  // WIND
  {id:'wind_razor',   el:'wind', lvl:1,  name:'Razor Breeze',    icon:'🍃', cp:8,  cd:1, power:1.15, apply:[{s:'bleed',dur:2,pow:0.25,chance:0.6}], desc:'A thin gust sharp enough to cut.'},
  {id:'wind_tail',    el:'wind', lvl:3,  name:'Tailwind Step',   icon:'💨', cp:10, cd:4, target:'self', apply:[{s:'haste',dur:3}], desc:'Ride the wind: faster and harder to hit.'},
  {id:'wind_cyclone', el:'wind', lvl:6,  name:'Cyclone Kick',    icon:'🌀', cp:14, cd:2, power:0.8, hits:2, desc:'Two spinning kicks in one breath.'},
  {id:'wind_whisper', el:'wind', lvl:10, name:'Whisper Cut',     icon:'🗡️', cp:18, cd:3, power:1.3, critBonus:40, apply:[{s:'bleed',dur:3,pow:0.3}], desc:'A silent slash aimed at weak points.'},
  {id:'wind_snare',   el:'wind', lvl:15, name:'Vacuum Snare',    icon:'🫧', cp:20, cd:4, power:0.6, apply:[{s:'slow',dur:2},{s:'expose',dur:2}], desc:'Steal the air around the foe.'},
  {id:'wind_tempest', el:'wind', lvl:22, name:'Thousand-Leaf Tempest', icon:'🌪️', cp:32, cd:5, power:0.9, hits:3, apply:[{s:'bleed',dur:3,pow:0.3}], desc:'A storm of razor leaves.'},
  // LIGHTNING
  {id:'ltn_jab',      el:'lightning', lvl:1,  name:'Static Jab',      icon:'👊', cp:8,  cd:1, power:1.2, apply:[{s:'stun',dur:1,chance:0.2}], desc:'A charged jab that can lock muscles.'},
  {id:'ltn_arc',      el:'lightning', lvl:3,  name:'Arc Chain',       icon:'🔗', cp:14, cd:3, power:1.0, target:'allEnemies', desc:'Lightning leaps between every foe.'},
  {id:'ltn_surge',    el:'lightning', lvl:6,  name:'Nerve Surge',     icon:'🧠', cp:14, cd:4, target:'self', apply:[{s:'empower',dur:2},{s:'haste',dur:2}], desc:'Overclock your reflexes.'},
  {id:'ltn_needle',   el:'lightning', lvl:10, name:'Thunder Needle',  icon:'📍', cp:18, cd:3, power:1.6, apply:[{s:'slow',dur:2}], desc:'A bolt that numbs on impact.'},
  {id:'ltn_coil',     el:'lightning', lvl:15, name:'Paralysis Coil',  icon:'🌩️', cp:22, cd:5, power:0.7, apply:[{s:'stun',dur:1}], desc:'Wrap the foe in crackling wire.'},
  {id:'ltn_spear',    el:'lightning', lvl:22, name:"Heaven's Spear",  icon:'⚡', cp:34, cd:6, power:3.0, desc:'One spear of pure thunder.'},
  // EARTH
  {id:'earth_pebble', el:'earth', lvl:1,  name:'Pebble Barrage',   icon:'🪨', cp:8,  cd:1, power:0.48, hits:3, desc:'Flick a volley of hardened stones.'},
  {id:'earth_skin',   el:'earth', lvl:3,  name:'Stone Skin',       icon:'🛡️', cp:10, cd:4, target:'self', apply:[{s:'guard',dur:3}], desc:'Harden your body like granite.'},
  {id:'earth_quake',  el:'earth', lvl:6,  name:'Quake Stomp',      icon:'🦶', cp:16, cd:3, power:0.9, target:'allEnemies', apply:[{s:'slow',dur:2,chance:0.5}], desc:'Shake the ground under every foe.'},
  {id:'earth_root',   el:'earth', lvl:10, name:'Iron Root',        icon:'🌳', cp:18, cd:5, target:'self', heal:0.2, apply:[{s:'guard',dur:2}], desc:'Draw strength up from the earth.'},
  {id:'earth_boulder',el:'earth', lvl:15, name:'Boulder Crush',    icon:'🗿', cp:22, cd:3, power:1.9, apply:[{s:'stun',dur:1,chance:0.3}], desc:'Heave a boulder onto the foe.'},
  {id:'earth_wrath',  el:'earth', lvl:22, name:"Mountain's Wrath", icon:'🏔️', cp:32, cd:5, power:2.4, apply:[{s:'expose',dur:2},{s:'guard',dur:2,on:'self'}], desc:'The mountain rises to crush and shelter.'},
  // WATER
  {id:'water_whip',     el:'water', lvl:1,  name:'Tide Whip',       icon:'🌊', cp:8,  cd:1, power:1.25, apply:[{s:'slow',dur:2,chance:0.2}], desc:'Lash out with a rope of water.'},
  {id:'water_mend',     el:'water', lvl:3,  name:'Mist Mend',       icon:'🌫️', cp:12, cd:4, target:'self', heal:0.28, desc:'Cool mist that closes wounds.'},
  {id:'water_undertow', el:'water', lvl:6,  name:'Undertow',        icon:'🫗', cp:14, cd:3, power:1.0, apply:[{s:'slow',dur:2},{s:'weaken',dur:2}], desc:'Drag the foe down and sap their strength.'},
  {id:'water_needles',  el:'water', lvl:10, name:'Rain of Needles', icon:'🌧️', cp:20, cd:3, power:0.95, target:'allEnemies', apply:[{s:'bleed',dur:2,pow:0.2}], desc:'Raindrops frozen into needles.'},
  {id:'water_well',     el:'water', lvl:15, name:'Wellspring',      icon:'⛲', cp:0,  cd:5, target:'self', cpRestore:0.35, cleanse:true, apply:[{s:'regen',dur:3,pow:0.07}], desc:'Cleanse, restore Chakra and regenerate.'},
  {id:'water_leviathan',el:'water', lvl:22, name:'Leviathan Surge', icon:'🐉', cp:32, cd:5, power:2.5, apply:[{s:'weaken',dur:2}], desc:'A serpent of seawater crashes down.'},
  // ULTIMATES (tier 7)
  {id:'fire_phoenix',   el:'fire',      lvl:35, name:'Vermilion Phoenix', icon:'🦅', cp:40, cd:6, power:3.2, apply:[{s:'burn',dur:3,pow:0.6}], desc:'A burning phoenix dives through the foe.'},
  {id:'wind_eye',       el:'wind',      lvl:35, name:'Eye of the Gale',   icon:'👁️', cp:38, cd:6, power:0.75, hits:4, apply:[{s:'haste',dur:2,on:'self'}], desc:'Four strikes from the calm center of a storm.'},
  {id:'ltn_sovereign',  el:'lightning', lvl:35, name:'Storm Sovereign',   icon:'👑', cp:42, cd:6, power:1.6, target:'allEnemies', apply:[{s:'stun',dur:1,chance:0.35}], desc:'Crown the battlefield in lightning.'},
  {id:'earth_colossus', el:'earth',     lvl:35, name:'Worldroot Colossus',icon:'🗻', cp:40, cd:6, power:2.4, heal:0.15, apply:[{s:'guard',dur:3,on:'self'}], desc:'Become the mountain: strike, mend and endure.'},
  {id:'water_tsunami',  el:'water',     lvl:35, name:'Moonlit Tsunami',   icon:'🌕', cp:42, cd:6, power:1.7, target:'allEnemies', apply:[{s:'weaken',dur:2},{s:'slow',dur:2}], desc:'The tide rises under a full moon.'},
  // PET-ONLY (target 'ally' = the most wounded ally)
  {id:'pet_ember_bite', el:'fire',      lvl:1, petOnly:true, name:'Ember Bite',   icon:'🦊', cp:6, cd:2, power:1.1, apply:[{s:'burn',dur:2,pow:0.3}], desc:'A bite with smoldering fangs.'},
  {id:'pet_dive',       el:'wind',      lvl:1, petOnly:true, name:'Talon Dive',   icon:'🪶', cp:6, cd:2, power:0.7, hits:2, desc:'Two diving strikes.'},
  {id:'pet_spark',      el:'lightning', lvl:1, petOnly:true, name:'Spark Pounce', icon:'⚡', cp:6, cd:3, power:1.0, apply:[{s:'stun',dur:1,chance:0.3}], desc:'A crackling pounce that can stun.'},
  {id:'pet_tusk',       el:'earth',     lvl:1, petOnly:true, name:'Tusk Charge',  icon:'🐗', cp:6, cd:2, power:1.2, apply:[{s:'expose',dur:2}], desc:'Knocks the foe off balance.'},
  {id:'pet_bulwark',    el:'earth',     lvl:1, petOnly:true, name:'Bulwark',      icon:'🛡️', cp:8, cd:5, target:'ally', apply:[{s:'guard',dur:2}], desc:'Shields the most wounded ally.'},
  {id:'pet_coil',       el:'water',     lvl:1, petOnly:true, name:'Mist Coil',    icon:'🌀', cp:6, cd:2, power:1.0, apply:[{s:'slow',dur:2}], desc:'Wraps the foe in cold mist.'},
  {id:'pet_mist',       el:'water',     lvl:1, petOnly:true, name:'Healing Mist', icon:'💧', cp:8, cd:4, target:'ally', heal:0.15, desc:'Mends the most wounded ally.'},
  {id:'pet_moonlight',  el:'wind',      lvl:1, petOnly:true, name:'Moonlight',    icon:'🌙', cp:8, cd:3, target:'ally', heal:0.18, apply:[{s:'regen',dur:2,pow:0.04}], desc:'Soft light that heals over time.'},
  {id:'pet_shadow_fang',el:'wind',      lvl:1, petOnly:true, name:'Shadow Fang',  icon:'🌑', cp:6, cd:2, power:1.3, apply:[{s:'bleed',dur:2,pow:0.3}], desc:'A bite from the dark.'},
  // ENEMY-ONLY
  {id:'en_maul', el:'earth', lvl:1, enemyOnly:true, name:'Maul',          icon:'🐺', cp:8,  cd:2, power:1.1, apply:[{s:'bleed',dur:2,pow:0.25}], desc:'Tearing claws.'},
  {id:'en_howl', el:'fire',  lvl:1, enemyOnly:true, name:'Blood Howl',    icon:'📢', cp:10, cd:5, target:'self', apply:[{s:'empower',dur:3}], desc:'A howl that stirs bloodlust.'},
  {id:'en_wail', el:'water', lvl:1, enemyOnly:true, name:'Mournful Wail', icon:'👻', cp:12, cd:4, power:0.6, target:'allEnemies', apply:[{s:'weaken',dur:2}], desc:'A cry that saps the will.'},
  {id:'en_venom', el:'water', lvl:1, enemyOnly:true, name:'Venom Fang', icon:'🐍', cp:8,  cd:2, power:1.0, apply:[{s:'bleed',dur:3,pow:0.3}], desc:'A poisoned bite.'},
  {id:'en_gust',  el:'wind',  lvl:1, enemyOnly:true, name:'Wing Gust',  icon:'🪶', cp:10, cd:3, power:0.7, apply:[{s:'slow',dur:2}], desc:'A buffeting blast of wings.'},
];
SKILLS.forEach(s => { s.target = s.target || 'enemy'; s.hits = s.hits || 1; if(s.price == null) s.price = TIER_PRICE[s.lvl] || 100; });
const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));

/* ENEMIES — stats come from enemyStats(level) × role multipliers (hpM, atkM, agiM, xpM, goldM).
   Spawn at any level with unitFromEnemy(id, level). kind picks the sprite: ninja | serpent | bird | puppet | beast | spirit. */
const NIN = (o) => Object.assign({gender:'m',hairStyle:'short',hair:'#2b2b3a',outfit:'#444',eyes:'#2b2b2b',skin:'#e0b48e'}, o);
const ENEMIES = [
  // D-rank
  {id:'bandit', name:'Reed Road Bandit', kind:'ninja', el:'earth', lvl:1, hpM:.87, atkM:1, agiM:1, skills:['earth_pebble'], xpM:1.2,
   look:NIN({hair:'#3b2f2a',outfit:'#7a6446',eyes:'#5a3b1f',mask:'#3a3030',scarf:'#5c4a33',band:'none'}), gear:{weapon:{w:'kunai',c:'#8b9099'}}},
  {id:'viper', name:'Paddy Viper', kind:'serpent', el:'water', lvl:2, hpM:.8, atkM:.85, agiM:1.55, skills:['en_venom'], look:{body:'#4f8f6a',belly:'#d9d08a'}},
  {id:'crow', name:'Ashwing Crow', kind:'bird', el:'wind', lvl:3, hpM:.65, atkM:.8, agiM:2.1, skills:['en_gust','wind_razor'], look:{body:'#3a3548',wing:'#262233',eye:'#ff5a4a'}},
  {id:'puppet', name:'Hollow Puppet', kind:'puppet', el:'lightning', lvl:4, hpM:.82, atkM:.8, agiM:.92, skills:['ltn_jab','ltn_arc'], look:{wood:'#b98a58',dark:'#6e4c2e',glow:'#ffe066'}},
  {id:'deserter', name:'Rensai the Deserter', kind:'ninja', el:'fire', lvl:5, boss:true, hpM:1.4, atkM:.8, agiM:1.18, skills:['fire_spark','fire_cinder','fire_resolve'], xpM:2.2, goldM:2,
   look:NIN({hairStyle:'spiky',hair:'#c9c9d4',outfit:'#3d2a2e',eyes:'#d23b2b',skin:'#e9c3a0',scarf:'#e8553a',scar:true,bandSlash:true}), gear:{weapon:{w:'sword'},back:{b:'scroll'}}},
  {id:'marsh_wolf', name:'Marsh Wolf', kind:'beast', el:'earth', lvl:6, hpM:.8, atkM:.85, agiM:1.3, skills:['en_maul'], look:{body:'#6b6048',belly:'#a89a7a',ear:'#3a3226',tail:'bushy'}},
  {id:'ember_wisp', name:'Ember Wisp', kind:'spirit', el:'fire', lvl:7, hpM:.6, atkM:.85, agiM:1.4, skills:['fire_spark','fire_cinder'], look:{core:'#ffe2a0',flame:'#e8553a'}},
  {id:'kunoichi', name:'Suzume the Rogue', kind:'ninja', el:'wind', lvl:8, boss:true, hpM:1.3, atkM:.85, agiM:1.4, skills:['wind_razor','wind_tail','wind_cyclone'], xpM:2.2, goldM:2,
   look:NIN({gender:'f',hairStyle:'long',hair:'#5a2a4a',outfit:'#2f4a3a',eyes:'#3f9a5a',skin:'#f3d2b3',scarf:'#2fa37a',mask:'#1f2a24',bandSlash:true}), gear:{weapon:{w:'kunai'}}},
  // C-rank
  {id:'salt_hawk', name:'Stormcrest Hawk', kind:'bird', el:'lightning', lvl:10, hpM:.7, atkM:.85, agiM:1.8, skills:['ltn_jab','en_gust'], look:{body:'#dfe3ea',wing:'#7a8aa6',eye:'#ffd23a'}},
  {id:'sentinel', name:'Moss Sentinel', kind:'puppet', el:'earth', lvl:12, hpM:1.3, atkM:.8, agiM:.7, skills:['earth_skin','earth_quake','earth_pebble'], look:{wood:'#8a8f7a',dark:'#4f5a44',glow:'#9fe07a'}},
  {id:'ferry_merc', name:'Ironmask Mercenary', kind:'ninja', el:'earth', lvl:13, hpM:.8, atkM:.8, agiM:1, skills:['earth_pebble','earth_skin'],
   look:NIN({hair:'#1f1f24',outfit:'#5a5f6a',skin:'#c68b5e',mask:'#8a95a3',scarf:'#3a3f4a',band:'none'}), gear:{weapon:{w:'sword'}}},
  {id:'river_serpent', name:'River Serpent', kind:'serpent', el:'water', lvl:14, hpM:.9, atkM:.85, agiM:1.3, skills:['en_venom','water_undertow'], look:{body:'#2f6f8f',belly:'#bfe6f2'}},
  {id:'ashfang', name:'Ashfang Wolf', kind:'beast', el:'fire', lvl:15, hpM:.8, atkM:.85, agiM:1.4, skills:['en_maul','fire_cinder','en_howl'], look:{body:'#4a3a3a',belly:'#a07060',ear:'#e8553a',tail:'bushy',eye:'#ff8a3a'}},
  {id:'kagerou', name:'Kagerou the Mirage Blade', kind:'ninja', el:'wind', lvl:18, boss:true, hpM:1.5, atkM:.9, agiM:1.5, skills:['wind_cyclone','wind_whisper','wind_snare','wind_tail'], xpM:2.5, goldM:2.5,
   look:NIN({gender:'f',hairStyle:'ponytail',hair:'#d8d8e4',outfit:'#3a2f5a',eyes:'#8a3fbf',skin:'#fbe0c8',scarf:'#2fa37a',bandSlash:true}), gear:{weapon:{w:'sword'},back:{b:'kite'}}},
  // B-rank
  {id:'thunder_oni', name:'Thunder Oni', kind:'ninja', el:'lightning', lvl:21, hpM:1.1, atkM:.9, agiM:.9, skills:['ltn_needle','ltn_jab','en_howl'],
   look:NIN({hairStyle:'spiky',hair:'#e6b422',outfit:'#5a2a2a',eyes:'#ffd23a',skin:'#c9584a',horns:'#f3ead7',band:'none'}), gear:{weapon:{w:'sickle'}}},
  {id:'drowned_monk', name:'Drowned Monk', kind:'spirit', el:'water', lvl:23, hpM:.95, atkM:.85, agiM:1.1, skills:['water_mend','water_needles','en_wail'], look:{core:'#e6f6ff',flame:'#3a8fd9'}},
  {id:'night_crow', name:'Nightcrow', kind:'bird', el:'wind', lvl:24, hpM:.6, atkM:.8, agiM:1.8, skills:['en_gust','wind_razor','wind_cyclone'], look:{body:'#1c1a2a',wing:'#0f0e18',eye:'#9fe0ff'}},
  {id:'war_puppet', name:'Iron War-Puppet', kind:'puppet', el:'earth', lvl:26, hpM:1.15, atkM:.85, agiM:.7, skills:['earth_boulder','earth_skin','earth_pebble'], look:{wood:'#7a7f8a',dark:'#3a3f4a',glow:'#ff6a4a'}},
  {id:'cinder_hound', name:'Cinder Hound', kind:'beast', el:'fire', lvl:28, hpM:.55, atkM:.7, agiM:1.4, skills:['en_maul','fire_spark'], look:{body:'#2a1a1a',belly:'#6a2a1a',ear:'#ff6a3a',tail:'thin',eye:'#ffd23a'}},
  {id:'oborozuki', name:'Oborozuki, the Veiled Envoy', kind:'ninja', el:'water', lvl:32, boss:true, hpM:1.5, atkM:.95, agiM:1.2, skills:['water_undertow','water_leviathan','water_mend','water_needles'], xpM:2.5, goldM:2.5,
   look:NIN({gender:'f',hairStyle:'long',hair:'#2a2a4a',outfit:'#e7e3f0',eyes:'#3a8fd9',skin:'#fbe0c8',mask:'#cfd2e6',scarf:'#3a8fd9',bandSlash:true}), gear:{weapon:{w:'tanto'},back:{b:'scroll'}}},
  // A-rank
  {id:'lantern_wraith', name:'Lantern Wraith', kind:'spirit', el:'fire', lvl:36, hpM:.85, atkM:.9, agiM:1.3, skills:['fire_flare','fire_cinder','en_wail'], look:{core:'#fff2c2',flame:'#b8363a'}},
  {id:'sky_serpent', name:'Sky Serpent', kind:'serpent', el:'lightning', lvl:38, hpM:1.1, atkM:.9, agiM:1.4, skills:['ltn_needle','ltn_arc','en_venom'], look:{body:'#e6c24a',belly:'#fff4c2'}},
  {id:'hunter_nin', name:'Hunter-Nin', kind:'ninja', el:'lightning', lvl:40, hpM:.85, atkM:.85, agiM:1.3, skills:['ltn_jab','ltn_needle','ltn_surge'],
   look:NIN({hair:'#3a3a4a',outfit:'#2a2f3a',eyes:'#6b4226',mask:'#e3e3ea',scarf:'#d4a012'}), gear:{weapon:{w:'sword'}}},
  {id:'colossus', name:'Granite Colossus', kind:'puppet', el:'earth', lvl:42, hpM:1.6, atkM:.9, agiM:.6, skills:['earth_quake','earth_boulder','earth_root'], look:{wood:'#9a948a',dark:'#4a4640',glow:'#ffb940'}},
  {id:'tengetsu', name:'Tengetsu, the Exiled Master', kind:'ninja', el:'fire', lvl:46, boss:true, hpM:1.7, atkM:1, agiM:1.2, skills:['fire_flare','fire_sunfall','fire_resolve','fire_hearth'], xpM:2.5, goldM:2.5,
   look:NIN({hairStyle:'long',hair:'#f0f0f5',outfit:'#6a1f1f',eyes:'#e8553a',skin:'#e9c3a0',scarf:'#e8553a',scar:true,bandSlash:true}), gear:{weapon:{w:'sword'},back:{b:'quiver'}}},
  // S-rank
  {id:'eclipse_raven', name:'Eclipse Raven', kind:'bird', el:'wind', lvl:52, hpM:.6, atkM:.72, agiM:1.7, skills:['wind_whisper','wind_snare','en_gust'], look:{body:'#2a1030',wing:'#12061a',eye:'#ff3a6a'}},
  {id:'abyss_naga', name:'Abyssal Naga', kind:'serpent', el:'water', lvl:54, hpM:1.2, atkM:.9, agiM:1.2, skills:['water_undertow','water_leviathan','en_venom'], look:{body:'#1a2f4f',belly:'#5ad0c8'}},
  {id:'black_guard', name:'Black Moon Sentinel', kind:'ninja', el:'earth', lvl:55, hpM:1, atkM:.9, agiM:1.1, skills:['earth_wrath','earth_skin','earth_boulder'],
   look:NIN({hairStyle:'spiky',hair:'#15152a',outfit:'#15152a',eyes:'#d4a012',mask:'#2a2a44',scarf:'#8a3fbf',bandSlash:true}), gear:{weapon:{w:'sickle'}}},
  {id:'kurotsuki', name:'Kurotsuki, Lord of the Black Moon', kind:'ninja', el:'lightning', lvl:58, boss:true, hpM:2, atkM:1, agiM:1.3, skills:['ltn_spear','ltn_coil','ltn_sovereign','ltn_surge'], xpM:3, goldM:3,
   look:NIN({hairStyle:'spiky',hair:'#1a1a2a',outfit:'#15152a',eyes:'#d4a012',scarf:'#8a3fbf',horns:'#d4a012',bandSlash:true}), gear:{weapon:{w:'sickle'},back:{b:'kite'}}},
  // CRIMSON MOON event bosses (level set by the event)
  {id:'akaboshi', name:'Akaboshi, the Blood-Moon Oni', kind:'ninja', el:'fire', lvl:1, boss:true, event:true, hpM:1.6, atkM:.95, agiM:1, skills:['fire_flare','fire_cinder','fire_resolve','fire_spark'],
   look:NIN({hairStyle:'long',hair:'#1a1a1a',outfit:'#2a0f14',eyes:'#ffd23a',skin:'#b8363a',horns:'#f3ead7',scarf:'#e8553a',band:'none'}), gear:{weapon:{w:'sword'}}},
  {id:'drowned_king', name:'The Drowned Shrine King', kind:'serpent', el:'water', lvl:1, boss:true, event:true, hpM:1.7, atkM:.9, agiM:1, skills:['water_needles','water_undertow','en_venom','water_mend'], look:{body:'#3a2f6f',belly:'#e8553a'}},
  {id:'hollow_shogun', name:'The Hollow Shogun', kind:'puppet', el:'lightning', lvl:1, boss:true, event:true, hpM:1.8, atkM:.9, agiM:.9, skills:['ltn_arc','ltn_needle','ltn_coil','ltn_surge'], look:{wood:'#3a2a2a',dark:'#140c0c',glow:'#ff3a3a'}},
];
const ENEMY = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

/* ITEMS — slot: weapon | clothing | back | accessory | consumable. bonus keys: hp cp agi atk crit dodge */
const ITEMS = [
  {id:'kunai_train', slot:'weapon', name:'Training Kunai',     icon:'🔪', lvl:1,  price:30,  bonus:{atk:3}, look:{w:'kunai',c:'#9aa3ad'}},
  {id:'kunai_iron',  slot:'weapon', name:'Iron-Ring Kunai',    icon:'🔪', lvl:3,  price:120, bonus:{atk:6,crit:3}, look:{w:'kunai',c:'#6f7c8c'}},
  {id:'reed_blade',  slot:'weapon', name:'Reedsteel Ninjato',  icon:'🗡️', lvl:6,  price:320, bonus:{atk:10,agi:2}, look:{w:'sword'}},
  {id:'moon_sickle', slot:'weapon', name:'Crescent Sickle',    icon:'🌙', lvl:12, price:720, bonus:{atk:16,crit:5}, look:{w:'sickle'}},
  {id:'ember_tanto', slot:'weapon', name:'Ember-Kissed Tanto', icon:'🔥', lvl:4,  price:400, shop:false, bonus:{atk:9,crit:6}, look:{w:'tanto'}, desc:"Rensai's blade, still warm."},
  {id:'vest_pupil',  slot:'clothing', name:"Pupil's Quilted Vest", icon:'🦺', lvl:1, price:40,  bonus:{hp:20}, look:{o:'vest',c:'#5f7a4a'}},
  {id:'garb_reed',   slot:'clothing', name:'Reedweave Garb',       icon:'🥋', lvl:3, price:150, bonus:{hp:45,agi:1}, look:{o:'sash',c:'#b8412f'}},
  {id:'silk_shadow', slot:'clothing', name:'Shadow-Silk Suit',     icon:'🥷', lvl:7, price:420, bonus:{hp:70,dodge:4}, look:{o:'silk',c:'#23222e'}},
  {id:'satchel',     slot:'back', name:'Scroll Satchel',      icon:'📜', lvl:1, price:50,  bonus:{cp:15}, look:{b:'scroll'}},
  {id:'kite_wings',  slot:'back', name:'Paper Kite Harness',  icon:'🪁', lvl:5, price:220, bonus:{agi:3,dodge:3}, look:{b:'kite'}},
  {id:'quiver',      slot:'back', name:'Bamboo Blade Quiver', icon:'🎋', lvl:8, price:380, bonus:{atk:3,crit:4}, look:{b:'quiver'}},
  {id:'bell',        slot:'accessory', name:'Silver Bell Charm', icon:'🔔', lvl:1, price:60,  bonus:{crit:3}, look:{a:'bell'}},
  {id:'jade',        slot:'accessory', name:'Jade Prayer Beads', icon:'📿', lvl:3, price:140, bonus:{hp:15,cp:15}, look:{a:'beads'}},
  {id:'moonstone',   slot:'accessory', name:'Moonstone Earring', icon:'💎', lvl:6, price:300, bonus:{dodge:5,agi:2}, look:{a:'earring'}},
  // higher tiers
  {id:'storm_kunai',    slot:'weapon', name:'Stormglass Kunai',  icon:'🔪', lvl:15, price:1200, bonus:{atk:20,crit:4}, look:{w:'kunai',c:'#7fb2ff'}},
  {id:'moonsteel_blade',slot:'weapon', name:'Moonsteel Ninjato', icon:'🗡️', lvl:25, price:2600, bonus:{atk:30,agi:4}, look:{w:'sword'}},
  {id:'tide_sickle',    slot:'weapon', name:'Tidebreaker Sickle',icon:'🌙', lvl:35, price:4800, bonus:{atk:40,crit:6}, look:{w:'sickle'}},
  {id:'eclipse_tanto',  slot:'weapon', name:'Eclipse Tanto',     icon:'🔥', lvl:45, price:8000, bonus:{atk:52,crit:9}, look:{w:'tanto'}},
  {id:'lantern_coat',   slot:'clothing', name:'Lantern Guard Coat',  icon:'🦺', lvl:15, price:1100, bonus:{hp:120}, look:{o:'vest',c:'#8a6a2a'}},
  {id:'hawk_harness',   slot:'clothing', name:'Moonhawk Harness',    icon:'🥋', lvl:25, price:2400, bonus:{hp:190,agi:3}, look:{o:'sash',c:'#2a4a8c'}},
  {id:'shade_raiment',  slot:'clothing', name:'Shadowcrest Raiment', icon:'🥷', lvl:40, price:6000, bonus:{hp:300,dodge:6}, look:{o:'silk',c:'#15152a'}},
  {id:'warden_robe',    slot:'clothing', name:'Eclipse Warden Robe', icon:'👘', lvl:52, price:11000, bonus:{hp:420,cp:40,dodge:4}, look:{o:'vest',c:'#e7e3f0'}},
  {id:'storm_kite',     slot:'back', name:'Storm Kite',        icon:'🪁', lvl:18, price:1500, bonus:{agi:6,dodge:5}, look:{b:'kite'}},
  {id:'twin_scrolls',   slot:'back', name:'Twin Scroll Pack',  icon:'📜', lvl:30, price:3400, bonus:{cp:60,atk:6}, look:{b:'scroll'}},
  {id:'owl_charm',      slot:'accessory', name:'Owl-Eye Charm',  icon:'🦉', lvl:15, price:1000, bonus:{crit:7}, look:{a:'bell'}},
  {id:'tidepearl',      slot:'accessory', name:'Tidepearl Beads',icon:'📿', lvl:30, price:3200, bonus:{hp:80,cp:40}, look:{a:'beads'}},
  {id:'eclipse_bead',   slot:'accessory', name:'Eclipse Earring',icon:'💎', lvl:45, price:7500, bonus:{crit:10,dodge:6}, look:{a:'earring'}},
  // boss first-clear rewards (not sold)
  {id:'swallow_pin',    slot:'accessory', name:"Suzume's Swallow Pin", icon:'🐦', lvl:8,  price:600,  shop:false, bonus:{agi:3,crit:4}, look:{a:'bell'}},
  {id:'mirage_veil',    slot:'back',      name:'Mirage Veil',          icon:'🌫️', lvl:18, price:2000, shop:false, bonus:{agi:6,dodge:6}, look:{b:'kite'}},
  {id:'envoy_pearl',    slot:'accessory', name:"Envoy's Moon Pearl",   icon:'🔮', lvl:30, price:4000, shop:false, bonus:{hp:90,cp:50}, look:{a:'beads'}},
  {id:'exile_blade',    slot:'weapon',    name:"Exile's Sunblade",     icon:'⚔️', lvl:44, price:9000, shop:false, bonus:{atk:50,crit:10,agi:4}, look:{w:'sword'}},
  {id:'black_crown',    slot:'accessory', name:'Black Moon Circlet',   icon:'🌑', lvl:58, price:15000, shop:false, bonus:{crit:12,dodge:8,agi:6}, look:{a:'earring'}},
  // Crimson Moon event shop (paid in Moon Shards)
  {id:'crimson_fang',   slot:'weapon', name:'Crimson Moon Fang', icon:'🩸', lvl:1,  price:1000, shop:false, bonus:{atk:18,crit:8,agi:3}, look:{w:'tanto'}},
  {id:'crimson_mantle', slot:'back',   name:'Crimson Mantle',    icon:'🧣', lvl:10, price:1000, shop:false, shards:80, bonus:{cp:40,dodge:4,crit:3}, look:{b:'scroll'}},
  {id:'eclipse_tag',    slot:'consumable', name:'Eclipse Tag',  icon:'🎴', lvl:1, price:80, shop:false, shards:4, use:{damage:80,scale:6}, desc:'Heavy neutral damage to your target.'},
  {id:'moon_elixir',    slot:'consumable', name:'Moon Elixir',  icon:'🧪', lvl:1, price:100, shop:false, shards:6, use:{healPct:1,cpPct:0.5}, desc:'Restore all HP and half your Chakra.'},
  {id:'g_salve', slot:'consumable', name:'Greater Salve', icon:'🧴', lvl:15, price:60, use:{healPct:0.6}, desc:'Restore 60% HP.'},
  {id:'spirit_pill', slot:'consumable', name:'Spirit Pill', icon:'🔵', lvl:15, price:70, use:{cpPct:0.7}, desc:'Restore 70% Chakra.'},
  {id:'salve', slot:'consumable', name:'Reed Salve',    icon:'🩹', lvl:1, price:15, use:{healPct:0.35}, desc:'Restore 35% HP.'},
  {id:'pill',  slot:'consumable', name:'Chakra Pill',   icon:'💊', lvl:1, price:20, use:{cpPct:0.4},    desc:'Restore 40% Chakra.'},
  {id:'tea',   slot:'consumable', name:'Clarity Tea',   icon:'🍵', lvl:1, price:25, use:{cleanse:true,healPct:0.1}, desc:'Remove debuffs and restore 10% HP.'},
  {id:'tag',   slot:'consumable', name:'Explosive Tag', icon:'🧨', lvl:2, price:35, use:{damage:28,scale:3,el:'fire'}, desc:'Fire damage to your target. Scales with level.'},
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const SLOTS = ['weapon','clothing','back','accessory'];
const SLOT_INFO = {weapon:{name:'Weapon',icon:'🗡️'}, clothing:{name:'Clothing',icon:'🥋'}, back:{name:'Back',icon:'🎒'}, accessory:{name:'Accessory',icon:'📿'}, consumable:{name:'Supplies',icon:'🧪'}};
const STAT_NAMES = {hp:'HP', cp:'Chakra', agi:'Agility', atk:'Power', crit:'Crit %', dodge:'Dodge %'};

/* MISSIONS — stages run in order; HP/Chakra carry over with a short rest. Omitted xp/gold are auto-scaled by level. */
const MISSIONS = [
  {id:'d1', rank:'D', name:'Bandits on the Reed Road', lvl:1, client:'Merchant guild', xp:40, gold:40,
   desc:'Masked thieves are robbing carts on the reed road. Drive them off before the next caravan.',
   stages:[{foes:[['bandit',1]]},{foes:[['bandit',2]]}], drops:[{item:'salve',chance:0.6}]},
  {id:'d2', rank:'D', name:'Serpents in the Paddies', lvl:2, client:'South terrace farmers', xp:70, gold:60,
   desc:'Venomous vipers have nested in the flooded rice fields. Clear them out so planting can start.',
   stages:[{foes:[['viper',2]]},{foes:[['viper',3]]}], drops:[{item:'tea',chance:0.5},{item:'pill',chance:0.4}]},
  {id:'d3', rank:'D', name:"The Deserter's Trail", lvl:4, client:'Village council', xp:150, gold:140,
   desc:'A runaway ninja sold our secrets. Follow his trail past his crows and puppets, then bring him home.',
   stages:[{foes:[['crow',4]]},{foes:[['puppet',4]]},{foes:[['deserter',5]],boss:true}], drops:[{item:'tag',chance:0.7}], firstClear:['ember_tanto']},
  {id:'d4', rank:'D', name:"Wolves at the Woodcutters' Camp", lvl:6, client:'Woodcutters of the east ridge',
   desc:'A marsh wolf pack has started circling the camp at night. Two of them hunt as a pair.',
   stages:[{foes:[['marsh_wolf',6]]},{foes:[['marsh_wolf',6],['marsh_wolf',7]]}], drops:[{item:'salve',chance:0.7}]},
  {id:'d5', rank:'D', name:'Lights in the Old Graveyard', lvl:8, client:'The shrine keeper',
   desc:'Burning wisps drift between the graves, and someone is herding them. Find out who.',
   stages:[{foes:[['ember_wisp',8]]},{foes:[['ember_wisp',8],['ember_wisp',8]]},{foes:[['kunoichi',9]],boss:true}], drops:[{item:'tag',chance:0.6}], firstClear:['swallow_pin']},
  {id:'c1', rank:'C', name:'Hawks over the Salt Pass', lvl:10, client:'Salt traders',
   desc:'Storm-charged hawks dive at every caravan crossing the pass.',
   stages:[{foes:[['salt_hawk',10]]},{foes:[['salt_hawk',11],['salt_hawk',11]]}], drops:[{item:'pill',chance:0.6}]},
  {id:'c2', rank:'C', name:'The Sentinel Awakens', lvl:12, client:'Temple archivists',
   desc:'A moss-covered guardian in the old ruins has started moving again.',
   stages:[{foes:[['salt_hawk',12]]},{foes:[['sentinel',13]]}], drops:[{item:'salve',chance:0.8}]},
  {id:'c3', rank:'C', name:'Mercenaries at the Ferry', lvl:14, client:'River ferry guild',
   desc:'Hired blades have seized the ferry. Something in the river is helping them.',
   stages:[{foes:[['ferry_merc',14],['ferry_merc',14]]},{foes:[['river_serpent',15]]}], drops:[{item:'tea',chance:0.7}]},
  {id:'c4', rank:'C', name:'Ash in the Cedar Grove', lvl:16, client:'Forest wardens',
   desc:'Fire-maned wolves are scorching the sacred cedars.',
   stages:[{foes:[['ashfang',16]]},{foes:[['ashfang',16],['ashfang',17]]}], drops:[{item:'g_salve',chance:0.5}]},
  {id:'c5', rank:'C', name:'The Mirage Blade', lvl:18, client:'Village council',
   desc:'A swordswoman who fights like heat haze is recruiting mercenaries. End it.',
   stages:[{foes:[['ferry_merc',18],['salt_hawk',18]]},{foes:[['kagerou',19]],boss:true}], drops:[{item:'g_salve',chance:0.7}], firstClear:['mirage_veil']},
  {id:'b1', rank:'B', name:'Oni of the Thunder Shrine', lvl:20, client:'Mountain monks',
   desc:'A thunder oni has claimed the shrine bell, and crows gather at its call.',
   stages:[{foes:[['thunder_oni',20]]},{foes:[['thunder_oni',21],['night_crow',21]]}], drops:[{item:'spirit_pill',chance:0.6}]},
  {id:'b2', rank:'B', name:'The Drowned Temple', lvl:23, client:'Fishing villages',
   desc:'Monks who drowned in the flood still chant beneath the lake.',
   stages:[{foes:[['drowned_monk',23]]},{foes:[['drowned_monk',24],['river_serpent',24]]}], drops:[{item:'tea',chance:0.8}]},
  {id:'b3', rank:'B', name:'Foundry of Puppets', lvl:26, client:'Iron district',
   desc:'Someone is mass-producing war puppets in an abandoned foundry.',
   stages:[{foes:[['war_puppet',26]]},{foes:[['war_puppet',26],['war_puppet',27]]}], drops:[{item:'g_salve',chance:0.7}]},
  {id:'b4', rank:'B', name:'Hounds of Cinder Ridge', lvl:29, client:'Ridge miners',
   desc:'Packs of cinder hounds hunt in threes. Bring area techniques.',
   stages:[{foes:[['cinder_hound',29],['cinder_hound',29]]},{foes:[['cinder_hound',30],['cinder_hound',30],['cinder_hound',30]]}], drops:[{item:'tag',chance:1}]},
  {id:'b5', rank:'B', name:'The Veiled Envoy', lvl:32, client:'Village council',
   desc:'A foreign envoy has been turning our allies. Intercept her at the lake shrine.',
   stages:[{foes:[['night_crow',32],['drowned_monk',32]]},{foes:[['oborozuki',33]],boss:true}], drops:[{item:'spirit_pill',chance:0.8}], firstClear:['envoy_pearl']},
  {id:'a1', rank:'A', name:'Wraiths of the Lantern Road', lvl:35, client:'Pilgrims',
   desc:'The festival lanterns have become wraiths that burn anyone who walks the road.',
   stages:[{foes:[['lantern_wraith',35],['lantern_wraith',36]]},{foes:[['lantern_wraith',37]]}], drops:[{item:'g_salve',chance:0.8}]},
  {id:'a2', rank:'A', name:'Serpent in the Storm', lvl:38, client:'Coastal watch',
   desc:'A golden serpent rides the thunderclouds, calling crows to feed.',
   stages:[{foes:[['sky_serpent',38]]},{foes:[['sky_serpent',39],['night_crow',39]]}], drops:[{item:'spirit_pill',chance:0.8}]},
  {id:'a3', rank:'A', name:'The Hunter-Nin', lvl:41, client:'Village council',
   desc:'Foreign hunter-nin are tracking Tsukimori scouts. Their colossus guards the retreat.',
   stages:[{foes:[['hunter_nin',41],['hunter_nin',41]]},{foes:[['colossus',42]]}], drops:[{item:'g_salve',chance:1}]},
  {id:'a4', rank:'A', name:'The Exiled Master', lvl:45, client:'The village elders',
   desc:'Tengetsu, once the finest blade of Tsukimori, is marching home with an army.',
   stages:[{foes:[['hunter_nin',45],['lantern_wraith',45]]},{foes:[['colossus',46]]},{foes:[['tengetsu',47]],boss:true}], drops:[{item:'spirit_pill',chance:1}], firstClear:['exile_blade']},
  {id:'s1', rank:'S', name:'Wings of the Eclipse', lvl:50, client:'The moon observatory',
   desc:'Ravens that swallow light have blotted out the observatory. They attack in flocks.',
   stages:[{foes:[['eclipse_raven',50],['eclipse_raven',50]]},{foes:[['eclipse_raven',51],['eclipse_raven',51],['eclipse_raven',51]]}], drops:[{item:'g_salve',chance:1}]},
  {id:'s2', rank:'S', name:'The Abyssal Gate', lvl:54, client:'The moon observatory',
   desc:'A gate has opened beneath the sea. Its keepers must not reach land.',
   stages:[{foes:[['abyss_naga',54]]},{foes:[['black_guard',55],['abyss_naga',55]]}], drops:[{item:'spirit_pill',chance:1}]},
  {id:'s3', rank:'S', name:'Lord of the Black Moon', lvl:57, client:'All of Tsukimori',
   desc:'Kurotsuki means to swallow the moon itself. This is the final mission.',
   stages:[{foes:[['black_guard',57],['black_guard',57]]},{foes:[['eclipse_raven',58],['abyss_naga',58]]},{foes:[['kurotsuki',60]],boss:true}], drops:[{item:'g_salve',chance:1}], firstClear:['black_crown']},
];
const MISSION = Object.fromEntries(MISSIONS.map(m => [m.id, m]));

/* PETS — fight beside you under AI control. Stats scale from your own stats; bond grows with every win. */
const PETS = [
  {id:'ember_fox',  name:'Ember Fox',     kind:'beast',   el:'fire',      lvl:3,  price:250,  hpM:.9,  atkM:1,   agiM:1.3, skills:['pet_ember_bite'], look:{body:'#e0702e',belly:'#ffe2c4',ear:'#3a2418',tail:'bushy'}, desc:'Quick and fiery. Leaves burns.'},
  {id:'gale_hawk',  name:'Gale Hawk',     kind:'bird',    el:'wind',      lvl:6,  price:500,  hpM:.75, atkM:1.1, agiM:1.6, skills:['pet_dive'], look:{body:'#8a6a4a',wing:'#5a4230',eye:'#ffd23a'}, desc:'Strikes twice from above.'},
  {id:'static_ferret', name:'Static Ferret', kind:'beast', el:'lightning', lvl:10, price:900, hpM:.7, atkM:1,  agiM:1.8, skills:['pet_spark'], look:{body:'#e9d27a',belly:'#fff6d6',ear:'#7a5a1a',tail:'thin'}, desc:'Very fast; its pounce can stun.'},
  {id:'moss_boar',  name:'Mossback Boar', kind:'beast',   el:'earth',     lvl:15, price:1500, hpM:1.3, atkM:1,   agiM:.8, skills:['pet_tusk','pet_bulwark'], look:{body:'#6b5a44',belly:'#9c8a6a',ear:'#3a2e22',tail:'thin',tusks:true}, desc:'Sturdy. Exposes foes and guards you.'},
  {id:'mist_serpent', name:'Mist Serpent', kind:'serpent', el:'water',    lvl:20, price:2400, hpM:1,   atkM:.9,  agiM:1.1, skills:['pet_coil','pet_mist'], look:{body:'#5aa8c8',belly:'#d6f2ff'}, desc:'Slows foes and heals the team.'},
  {id:'shadow_wolf', name:'Shadow Wolf',  kind:'beast',   el:'wind',      lvl:30, price:4200, hpM:1.1, atkM:1.25,agiM:1.3, skills:['pet_shadow_fang','pet_dive'], look:{body:'#2a2a3a',belly:'#4a4a5a',ear:'#1a1a24',tail:'bushy',eye:'#9fe0ff'}, desc:'A hard-hitting hunter that causes bleeding.'},
  {id:'moon_wisp',  name:'Moon Wisp',     kind:'spirit',  el:'lightning', lvl:5,  shards:120, hpM:.8, atkM:.8, agiM:1.4, skills:['pet_moonlight','pet_spark'], look:{core:'#eef4ff',flame:'#8fb3ff'}, desc:'Crimson Moon exclusive. Heals and stuns.'},
];
const PET = Object.fromEntries(PETS.map(p => [p.id, p]));
const bondLevel = b => Math.min(10, 1 + Math.floor((b || 0) / 5));

/* CLANS — passive perks that grow stronger as you earn clan reputation. */
const CLAN_TIERS = [{rep:0,name:'Initiate'},{rep:60,name:'Member'},{rep:200,name:'Veteran'},{rep:500,name:'Elder'},{rep:1000,name:'Clan head'}];
const CLANS = [
  {id:'hibana',    name:'Hibana Clan',    crest:'🔥', color:'#e8553a', lvl:5,  motto:'Sparks that never die.',   perk:{atkPct:.05, elem:'fire', elemPct:.08}},
  {id:'kazaori',   name:'Kazaori Clan',   crest:'🍃', color:'#2fa37a', lvl:5,  motto:'We weave the wind.',       perk:{agiPct:.08, dodge:2}},
  {id:'shiden',    name:'Shiden Clan',    crest:'⚡', color:'#8a3fbf', lvl:5,  motto:'Strike before thunder.',   perk:{crit:4, elem:'lightning', elemPct:.08}},
  {id:'iwakura',   name:'Iwakura Clan',   crest:'⛰️', color:'#9c6b36', lvl:5,  motto:'The mountain does not kneel.', perk:{hpPct:.08}},
  {id:'mizuchi',   name:'Mizuchi Clan',   crest:'🐉', color:'#3a8fd9', lvl:5,  motto:'Still water runs deep.',   perk:{cpPct:.10, elem:'water', elemPct:.08}},
  {id:'tsukikage', name:'Tsukikage Clan', crest:'🌙', color:'#27347f', lvl:30, motto:'Shadow of the moon.',      perk:{hpPct:.04, cpPct:.04, agiPct:.04, atkPct:.04}},
];
const CLAN = Object.fromEntries(CLANS.map(c => [c.id, c]));
const CLAN_REP = {D:5, C:12, B:25, A:45, S:80};
function clanTier(rep){ let t = 0; CLAN_TIERS.forEach((x, i) => { if(rep >= x.rep) t = i; }); return t; }
function clanPerkText(cl, tier){
  const m = 1 + 0.25 * tier, p = cl.perk, t = [], pc = v => Math.round(v * m * 100) + '%';
  if(p.hpPct) t.push(`+${pc(p.hpPct)} HP`); if(p.cpPct) t.push(`+${pc(p.cpPct)} Chakra`);
  if(p.agiPct) t.push(`+${pc(p.agiPct)} Agility`); if(p.atkPct) t.push(`+${pc(p.atkPct)} Power`);
  if(p.crit) t.push(`+${(p.crit * m).toFixed(1)}% crit`); if(p.dodge) t.push(`+${(p.dodge * m).toFixed(1)}% dodge`);
  if(p.elem) t.push(`+${pc(p.elemPct)} ${ELEMENTS[p.elem].name} damage`);
  return t.join(', ');
}

/* ECHO ARENA — AI ghosts of other builds */
const ARENA_TIERS = [{r:0,name:'Pebble Echo'},{r:1100,name:'Reed Echo'},{r:1250,name:'Lantern Echo'},{r:1450,name:'Crescent Echo'},{r:1700,name:'Eclipse Echo'}];
const arenaTier = r => { let t = ARENA_TIERS[0]; ARENA_TIERS.forEach(x => { if(r >= x.r) t = x; }); return t; };
const GHOST_ARCHETYPES = [
  {id:'glass', name:'Glass cannon', w:{hp:1, cp:3, agi:2}},
  {id:'wall',  name:'Iron wall',    w:{hp:4, cp:1, agi:1}},
  {id:'storm', name:'Tempest',      w:{hp:1, cp:1, agi:4}},
  {id:'even',  name:'Balanced',     w:{hp:2, cp:2, agi:2}},
];

/* CRIMSON MOON — weekly rotating world boss with a shared HP pool */
const EVENT_BOSSES = ['akaboshi', 'drowned_king', 'hollow_shogun'];
const EVENT_TRIES = 3, EVENT_ROUNDS = 8, EVENT_POOL = 12;
const EVENT_MILESTONES = [
  {pct:25,  label:'Gold cache',          reward:{goldPerLvl:25}},
  {pct:50,  label:'Supply crate',        reward:{items:{salve:4, pill:3}}},
  {pct:75,  label:'Moon Shards ×30',     reward:{shards:30}},
  {pct:100, label:'Crimson Moon Fang + 60 shards', reward:{item:'crimson_fang', shards:60}},
];
const EVENTS = [{id:'crimson_moon', name:'Crimson Moon', lvl:5}];
const HOOKS = {battleStart:[], battleEnd:[], levelUp:[]};
function emit(name, payload){ (HOOKS[name] || []).forEach(f => { try{ f(payload); }catch(e){ console.error(e); } }); }

const HAIR_COLORS   = ['#2b2b3a','#5a3a22','#c98a3a','#e8d27a','#d8d8e4','#c43d4b','#3a6fd0','#e27fb0','#4fa67a'];
const OUTFIT_COLORS = ['#3a5a8c','#c9612e','#3d7a4f','#6b4a8c','#2c2c38','#b8363a','#d9a22b','#4c8c99'];
const EYE_COLORS    = ['#3b6fd6','#6b4226','#3f9a5a','#8a3fbf','#c43d2b','#2b2b2b'];
const SKIN_TONES    = ['#fbe0c8','#f3d2b3','#e0b48e','#c68b5e','#8d5a3b'];
const HAIR_STYLES   = [{id:'spiky',name:'Spiky'},{id:'short',name:'Tidy'},{id:'ponytail',name:'Ponytail'},{id:'long',name:'Long'}];
