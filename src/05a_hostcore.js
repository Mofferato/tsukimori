
/* =====================================================================
   HOST CORE: the multiplayer server's rules, shared by two hosts:
   • server/server.js (Node, over WebSocket) requires this file directly;
   • "Host on this device" in the browser (over WebRTC), so a phone can run a village.
   It knows nothing about transports: a host calls core.connect(send, close) for each
   player and feeds their parsed messages to client.receive(msg).
   ===================================================================== */
function createHostCore(opts){
  const o = Object.assign({name:'Tsukimori village', motd:'', maxPlayers:200, maxDocs:{echoes:5000, hires:5000, raidhits:5000, saves:1000}, maxSave:400000,
    store:null, persist:() => {}, hashId:null, randomId:() => Math.random().toString(16).slice(2, 12)}, opts);
  const VERSION = 1, SNAP_LIMIT = 200, COLS = ['echoes', 'hires', 'raidhits'];
  const store = Object.assign({echoes:{}, hires:{}, raidhits:{}, saves:{}}, o.store || {});

  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
  const int = (v, lo, hi) => Math.round(num(v, lo, hi));
  const chars = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
  const small = (x, n) => { try{ const t = JSON.stringify(x); return t && t.length <= n ? JSON.parse(t) : {}; }catch(e){ return {}; } };
  const CLEAN = {
    echoes: d => ({name:str(d.name, 16), level:int(d.level, 1, 60), element:str(d.element, 12), rating:int(d.rating, 0, 1e6), power:int(d.power, 0, 1e9), squad:int(d.squad, 0, 2), build:str(d.build, 20000)}),
    hires: d => ({ids:(Array.isArray(d.ids) ? d.ids : []).slice(-50).map(x => str(x, 40)), name:str(d.name, 16)}),
    raidhits: d => ({week:int(d.week, 0, 1e7), bossId:str(d.bossId, 40), dmg:int(d.dmg, 0, 1e12), pct:num(d.pct, 0, 100), name:str(d.name, 16)}),
  };
  const cleanPresence = p => { p = p && typeof p === 'object' ? p : {};
    return {name:str(p.name, 16), level:int(p.level, 1, 60), element:str(p.element, 12), look:small(p.look, 600), screen:p.screen === 'battle' ? 'battle' : 'village', rank:str(p.rank, 30), squad:int(p.squad, 0, 2)}; };
  const EVENTS = {
    shout: d => ({name:str(d.name, 16), text:str(d.text, 140)}),
    emote: d => ({name:str(d.name, 16), emoji:chars(d.emoji, 4)}),
  };
  // "col/id" for shared docs, "data/users/<uid>/save" for a private save
  function parsePath(p){
    const parts = String(p || '').split('/');
    if(parts.length === 2 && COLS.includes(parts[0]) && /^[\w-]{1,64}$/.test(parts[1])) return {col:parts[0], id:parts[1]};
    if(parts.length === 4 && parts[0] === 'data' && parts[1] === 'users' && parts[3] === 'save') return {col:'saves', id:parts[2]};
    return null;
  }
  function trim(col){ // keep collections bounded: drop the least recently updated docs
    const m = store[col], ids = Object.keys(m), max = o.maxDocs[col]; if(ids.length <= max) return;
    ids.sort((a, b) => (m[a].updatedAt || 0) - (m[b].updatedAt || 0)).slice(0, ids.length - max).forEach(id => delete m[id]);
  }

  const clients = new Set();
  const peerList = () => [...clients].filter(c => c.presence).map(c => ({peer:c.peer, by:c.uid, presence:c.presence}));
  let peersTimer = null;
  const broadcastPeers = () => { if(peersTimer) return; peersTimer = setTimeout(() => { peersTimer = null; const m = {t:'peers', peers:peerList()}; for(const c of clients) if(c.uid) c.send(m); }, 150); };
  const snapTimers = {};
  // Newest-first (or highest `orderBy` first) view of a collection; `cache` shares the sort across subscribers.
  function snapshot(col, sub, cache){
    const key = sub.orderBy && /^\w{1,20}$/.test(sub.orderBy) ? sub.orderBy : 'updatedAt';
    const lim = Math.min(SNAP_LIMIT, Math.max(1, sub.limit | 0 || SNAP_LIMIT)), ck = key + ':' + lim;
    let docs = cache && cache[ck];
    if(!docs){ docs = Object.entries(store[col]).sort((a, b) => (+b[1][key] || 0) - (+a[1][key] || 0)).slice(0, lim).map(([id, data]) => ({id, data})); if(cache) cache[ck] = docs; }
    return {t:'snap', id:sub.id, docs};
  }
  const changed = col => { if(snapTimers[col]) return; snapTimers[col] = setTimeout(() => { snapTimers[col] = null; const cache = {}; for(const c of clients) for(const s of c.subs.values()) if(s.col === col) c.send(snapshot(col, s, cache)); }, 300); };

  async function handle(c, m){
    if(!m || typeof m !== 'object') return;
    const ack = (ok, extra) => c.send(Object.assign({t:'ack', rid:m.rid, ok}, extra));
    if(m.t === 'hello'){
      if(typeof m.token !== 'string' || m.token.length < 16 || m.token.length > 128) return c.close(1008, 'bad token');
      c.uid = 'u' + String(await o.hashId('tsukimori:' + m.token)).slice(0, 24);
      c.send({t:'welcome', v:VERSION, uid:c.uid, peer:c.peer, name:o.name, motd:o.motd, peers:peerList()});
      return;
    }
    if(!c.uid) return;
    if(m.t === 'ping') return c.send({t:'pong'});
    if(m.t === 'sub'){
      if(!COLS.includes(m.col) || c.subs.size > 10) return;
      const s = {id:m.id | 0, col:m.col, orderBy:m.orderBy, limit:m.limit}; c.subs.set(s.id, s); c.send(snapshot(m.col, s));
      return;
    }
    if(m.t === 'set'){
      const p = parsePath(m.path); if(!p) return ack(false, {err:'Unknown path'});
      if(p.id !== c.uid) return ack(false, {err:'You can only write your own documents'});
      const d = m.data && typeof m.data === 'object' ? m.data : {};
      if(p.col === 'saves'){
        const json = String(d.json || ''); if(json.length > o.maxSave) return ack(false, {err:'Save is too large for this server'});
        store.saves[p.id] = {json, savedAt:Date.now(), updatedAt:Date.now()}; trim('saves');
      } else { store[p.col][p.id] = Object.assign(CLEAN[p.col](d), {updatedAt:Date.now()}); trim(p.col); changed(p.col); }
      o.persist(store); return ack(true);
    }
    if(m.t === 'get'){
      const p = parsePath(m.path); if(!p) return ack(false, {err:'Unknown path'});
      if(p.col === 'saves' && p.id !== c.uid) return ack(false, {err:'That save is private'});
      return ack(true, {doc:Object.prototype.hasOwnProperty.call(store[p.col], p.id) ? store[p.col][p.id] : null});
    }
    if(m.t === 'presence'){ c.presence = cleanPresence(m.data); broadcastPeers(); return; }
    if(m.t === 'emit'){
      const clean = EVENTS[m.ev]; if(!clean) return ack(false, {err:'Unknown event'});
      const now = Date.now(); if(now - c.lastEmit < 800) return ack(false, {err:'Slow down a little'}); c.lastEmit = now;
      const out = {t:'ev', ev:m.ev, data:clean(m.data && typeof m.data === 'object' ? m.data : {}), peer:c.peer};
      for(const x of clients) if(x.uid) x.send(out);
      return ack(true);
    }
  }

  return {
    store, clients,
    full:() => clients.size >= o.maxPlayers,
    info:() => ({tsukimori:true, v:VERSION, name:o.name, motd:o.motd, players:[...clients].filter(c => c.presence).length, max:o.maxPlayers}),
    // send(obj) and close(code, reason) deliver to this one player; returns {receive(msg), drop()}.
    connect(send, close){
      const c = {peer:o.randomId(), uid:null, presence:null, subs:new Map(), lastEmit:0, tokens:40, last:Date.now(), send, close};
      clients.add(c);
      return {
        client:c,
        receive(msg){
          // token bucket: about 10 messages a second, bursts of 40
          const now = Date.now(); c.tokens = Math.min(40, c.tokens + (now - c.last) / 100); c.last = now;
          if(--c.tokens < 0) return c.close(1008, 'too many messages');
          Promise.resolve(handle(c, msg)).catch(e => console.error('Host handler error:', e));
        },
        drop(){ if(clients.delete(c) && c.presence) broadcastPeers(); },
      };
    },
  };
}
if(typeof module === 'object' && module.exports) module.exports = {createHostCore};
