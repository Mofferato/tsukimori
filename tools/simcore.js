'use strict';
/* Headless loader for the game's real source (src/*.js) so combat can be simulated in Node.
   Dev-only: nothing here ships in index.html. Usage: const g = loadGame('src'); g.run('...'). */
const fs = require('fs'), path = require('path'), vm = require('vm');

const FILES = ['02_data.js', '03_art.js', '04_engine.js', '05a_hostcore.js', '05_extra.js', '06_squad.js', '06a_auto.js', '07_ui.js'];

// Stubs so the browser-facing code is inert. Anything that paints or talks to the network does nothing.
const STUBS = `
later = fn => fn();                       // run the turn loop synchronously
float = () => 0; anim = () => {}; sfx = () => {}; updateBattle = () => {}; render = () => {};
renderBattle = () => {}; toast = () => {}; showModal = () => {}; closeModal = () => {}; go = () => {};
renderGuide = () => {}; presence = () => {}; netChanged = () => {}; publishEcho = () => {}; publishRaid = () => {};
persist = () => {}; checkAchievements = () => [];
`;

function loadGame(srcDir){
  let code = FILES.map(f => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
  code = code.replace(/\/\/ Boot[\s\S]*$/, '');
  const store = {};
  const el = () => ({style:{}, classList:{add(){}, remove(){}, toggle(){}}, appendChild(){}, remove(){}, setAttribute(){}, querySelector:() => null, innerHTML:'', textContent:''});
  const sandbox = {
    console, Math, JSON, Date, Number, String, Array, Object, Set, Map, Promise, Error, parseInt, parseFloat, isFinite, Uint8Array,
    document:{querySelector:() => null, querySelectorAll:() => [], getElementById:() => null, addEventListener(){}, createElement:el},
    window:{addEventListener(){}, scrollTo(){}},
    localStorage:{getItem:k => (k in store ? store[k] : null), setItem:(k, v) => { store[k] = String(v); }, removeItem:k => { delete store[k]; }},
    location:{protocol:'http:'}, navigator:{}, performance:{now:() => Date.now()},
    setTimeout:() => 0, clearTimeout(){}, setInterval:() => 0, clearInterval(){},
    crypto:{getRandomValues:a => a},
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, {filename:'game'});
  vm.runInContext(STUBS, ctx);
  return {ctx, run:c => vm.runInContext(c, ctx), get:n => vm.runInContext(n, ctx)};
}
module.exports = {loadGame};
