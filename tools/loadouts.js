'use strict';
/* Prints what the auto-loadout picks at several levels (a quick way to eyeball the value model). node tools/loadouts.js */
const {loadGame} = require('./simcore');
const g = loadGame('src');
g.run(`
function ldo(el, L){
  S = defaultState(); const c = newCharacter({name:'x', gender:'m', hairStyle:'spiky', hair:'#222', outfit:'#335', eyes:'#333', skin:'#eec', element:el});
  c.level = L; c.points = (L - 1) * 3; allocRecruit(c, autoAllocRecruit(c));
  for(const sl of SLOTS){ const items = ITEMS.filter(i => i.slot === sl && i.shop !== false && !i.shards && i.lvl <= L).sort((a, b) => a.price - b.price); c.equip[sl] = items.length ? items[items.length - 1].id : null; }
  c.skills = SKILLS.filter(s => !s.enemyOnly && !s.petOnly && s.lvl <= L).map(s => s.id); S.char = c;
  const W = worthMap(c), r = bestLoadout(c, c.skills, W);
  return r.ids.map(id => SKILL[id].name + ' ' + W[id].toFixed(1)).join(' | ');
}`);
for(const L of [10, 20, 30, 45, 58]) for(const el of ['fire', 'water']) console.log(`L${L} ${el}: ` + g.run(`ldo("${el}", ${L})`));
