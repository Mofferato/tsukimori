#!/usr/bin/env node
/* =====================================================================
   Tsukimori multiplayer server. One file, no dependencies, Node 18+.

     node server/server.js                  # then open http://localhost:8787

   It serves the game at / and multiplayer over WebSocket (any path), so friends
   can simply open your address. The GitHub Pages build can join it too, as long
   as it is reachable over wss:// (put it behind HTTPS; see the README).

   Environment variables:
     PORT          port to listen on (default 8787)
     SERVER_NAME   shown in the in-game server list (default "Tsukimori village")
     MOTD          message of the day shown to players who join
     DATA_FILE     where echoes, raid damage and cloud saves persist (default server/data.json)
     MAX_PLAYERS   connections allowed at once (default 200)

   What it provides (mirrors the claude.ai runtime the game already uses):
     • shared documents: echoes (leaderboard, duels, hiring), hires, raidhits, per-player cloud saves
     • a village room: presence, shouts and emotes
   A player's identity is a random secret kept in their browser; the server only
   lets that player write their own documents and read their own save.
   ===================================================================== */
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const PORT = +process.env.PORT || 8787;
const NAME = String(process.env.SERVER_NAME || 'Tsukimori village').slice(0, 40);
const MOTD = String(process.env.MOTD || '').slice(0, 200);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 200;
const GAME_DIR = path.join(__dirname, '..');
const VERSION = 1, MAX_FRAME = 1 << 20, MAX_DOCS = {echoes:5000, hires:5000, raidhits:5000, saves:1000}, SNAP_LIMIT = 200;

/* ---------------- Storage ---------------- */
const COLS = ['echoes', 'hires', 'raidhits'];
let store = {echoes:{}, hires:{}, raidhits:{}, saves:{}};
try{ store = Object.assign(store, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); console.log(`Loaded ${DATA_FILE}`); }
catch(e){ if(e.code !== 'ENOENT') console.error('Could not read data file, starting fresh:', e.message); }
let saveTimer = null;
function persist(){
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DATA_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(store), err => {
      if(err) return console.error('Save failed:', err.message);
      fs.rename(tmp, DATA_FILE, e => { if(e) console.error('Save failed:', e.message); });
    });
  }, 2000);
}
function trim(col){ // keep collections bounded: drop the least recently updated docs
  const m = store[col], ids = Object.keys(m); if(ids.length <= MAX_DOCS[col]) return;
  ids.sort((a, b) => (m[a].updatedAt || 0) - (m[b].updatedAt || 0)).slice(0, ids.length - MAX_DOCS[col]).forEach(id => delete m[id]);
}

/* ---------------- Validation ---------------- */
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
const int = (v, lo, hi) => Math.round(num(v, lo, hi));
const chars = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
const small = (o, n) => { try{ const t = JSON.stringify(o); return t && t.length <= n ? JSON.parse(t) : {}; }catch(e){ return {}; } };
const CLEAN = {
  echoes: d => ({name:str(d.name, 16), level:int(d.level, 1, 60), element:str(d.element, 12), rating:int(d.rating, 0, 1e6), power:int(d.power, 0, 1e9), squad:int(d.squad, 0, 2), build:str(d.build, 20000)}),
  hires: d => ({ids:(Array.isArray(d.ids) ? d.ids : []).slice(-50).map(x => str(x, 40)), name:str(d.name, 16)}),
  raidhits: d => ({week:int(d.week, 0, 1e7), bossId:str(d.bossId, 40), dmg:int(d.dmg, 0, 1e12), pct:num(d.pct, 0, 100), name:str(d.name, 16)}),
};
function cleanPresence(p){
  p = p && typeof p === 'object' ? p : {};
  return {name:str(p.name, 16), level:int(p.level, 1, 60), element:str(p.element, 12), look:small(p.look, 600), screen:p.screen === 'battle' ? 'battle' : 'village', rank:str(p.rank, 30), squad:int(p.squad, 0, 2)};
}
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

/* ---------------- Clients ---------------- */
const clients = new Set();
const peerList = () => [...clients].filter(c => c.presence).map(c => ({peer:c.peer, by:c.uid, presence:c.presence}));
let peersTimer = null;
function broadcastPeers(){
  if(peersTimer) return;
  peersTimer = setTimeout(() => { peersTimer = null; const m = {t:'peers', peers:peerList()}; for(const c of clients) if(c.uid) c.send(m); }, 150);
}
const snapTimers = {};
// Newest-first (or highest `orderBy` first) view of a collection; `cache` shares the sort across subscribers.
function snapshot(col, sub, cache){
  const key = sub.orderBy && /^\w{1,20}$/.test(sub.orderBy) ? sub.orderBy : 'updatedAt';
  const lim = Math.min(SNAP_LIMIT, Math.max(1, sub.limit | 0 || SNAP_LIMIT)), ck = key + ':' + lim;
  let docs = cache && cache[ck];
  if(!docs){ docs = Object.entries(store[col]).sort((a, b) => (+b[1][key] || 0) - (+a[1][key] || 0)).slice(0, lim).map(([id, data]) => ({id, data})); if(cache) cache[ck] = docs; }
  return {t:'snap', id:sub.id, docs};
}
function changed(col){
  if(snapTimers[col]) return;
  snapTimers[col] = setTimeout(() => { snapTimers[col] = null; const cache = {}; for(const c of clients) for(const s of c.subs.values()) if(s.col === col) c.send(snapshot(col, s, cache)); }, 300);
}

function handle(c, m){
  if(!m || typeof m !== 'object') return;
  const ack = (ok, extra) => c.send(Object.assign({t:'ack', rid:m.rid, ok}, extra));
  if(m.t === 'hello'){
    if(typeof m.token !== 'string' || m.token.length < 16 || m.token.length > 128) return c.close(1008, 'bad token');
    c.uid = 'u' + crypto.createHash('sha256').update('tsukimori:' + m.token).digest('hex').slice(0, 24);
    c.send({t:'welcome', v:VERSION, uid:c.uid, peer:c.peer, name:NAME, motd:MOTD, peers:peerList()});
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
      const json = str(d.json, 400000); if(json.length !== String(d.json || '').length) return ack(false, {err:'Save is too large'});
      store.saves[p.id] = {json, savedAt:Date.now(), updatedAt:Date.now()}; trim('saves');
    } else { store[p.col][p.id] = Object.assign(CLEAN[p.col](d), {updatedAt:Date.now()}); trim(p.col); changed(p.col); }
    persist(); return ack(true);
  }
  if(m.t === 'get'){
    const p = parsePath(m.path); if(!p) return ack(false, {err:'Unknown path'});
    if(p.col === 'saves' && p.id !== c.uid) return ack(false, {err:'That save is private'});
    return ack(true, {doc:store[p.col][p.id] || null});
  }
  if(m.t === 'presence'){ c.presence = cleanPresence(m.data); broadcastPeers(); return; }
  if(m.t === 'emit'){
    const clean = EVENTS[m.ev]; if(!clean) return ack(false, {err:'Unknown event'});
    const now = Date.now(); if(now - c.lastEmit < 800) return ack(false, {err:'Slow down a little'}); c.lastEmit = now;
    const out = {t:'ev', ev:m.ev, data:clean(m.data && typeof m.data === 'object' ? m.data : {}), peer:c.peer};
    for(const o of clients) if(o.uid) o.send(out);
    return ack(true);
  }
}

/* ---------------- Minimal WebSocket (RFC 6455) ---------------- */
function frame(op, payload){
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.alloc(10);
  if(n >= 65536){ head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(n, 6); }
  return Buffer.concat([head, payload]);
}
function upgrade(req, socket){
  const key = req.headers['sec-websocket-key'];
  if(!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') return socket.destroy();
  if(clients.size >= MAX_PLAYERS){ socket.end('HTTP/1.1 503 Server Full\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);

  const c = {peer:crypto.randomBytes(5).toString('hex'), uid:null, presence:null, subs:new Map(), alive:true, lastEmit:0, tokens:40, last:Date.now()};
  c.send = o => { if(!socket.destroyed) socket.write(frame(1, Buffer.from(JSON.stringify(o)))); };
  c.ping = () => { if(!socket.destroyed) socket.write(frame(9, Buffer.alloc(0))); };
  c.close = (code, why) => { if(socket.destroyed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); socket.end(frame(8, Buffer.concat([b, Buffer.from(why || '')]))); };
  clients.add(c);

  let buf = Buffer.alloc(0), frags = [], fragLen = 0;
  socket.on('data', chunk => {
    c.alive = true; buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    while(buf.length >= 2){
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if(!masked) return c.close(1002, 'unmasked');
      if(len === 126){ if(buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if(len === 127){ if(buf.length < 10) return; if(buf.readUInt32BE(2)) return c.close(1009, 'too big'); len = buf.readUInt32BE(6); off = 10; }
      if(len > MAX_FRAME) return c.close(1009, 'too big');
      if(buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for(let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if(op === 8) return c.close(1000);
      if(op === 9){ socket.write(frame(10, data)); continue; }
      if(op === 10){ c.alive = true; continue; }
      if(op === 2) return c.close(1003, 'text only');
      if(op === 1 || op === 0){
        frags.push(data); fragLen += data.length;
        if(fragLen > MAX_FRAME) return c.close(1009, 'too big');
        if(!fin) continue;
        const text = Buffer.concat(frags).toString('utf8'); frags = []; fragLen = 0;
        // token bucket: about 10 messages a second, bursts of 40
        const now = Date.now(); c.tokens = Math.min(40, c.tokens + (now - c.last) / 100); c.last = now;
        if(--c.tokens < 0) return c.close(1008, 'too many messages');
        let msg; try{ msg = JSON.parse(text); }catch(e){ continue; }
        try{ handle(c, msg); }catch(e){ console.error('Handler error:', e); }
      }
    }
  });
  const drop = () => { if(!clients.delete(c)) return; if(c.presence) broadcastPeers(); };
  socket.on('close', drop); socket.on('error', drop); socket.on('end', drop);
}
setInterval(() => { // heartbeat: ping every 30s (browsers answer automatically) and drop anyone who went silent
  for(const c of clients){ if(!c.alive){ c.close(1001, 'timeout'); continue; } c.alive = false; c.ping(); }
}, 30000).unref();

/* ---------------- HTTP: the game, the server list and /api/info ---------------- */
const STATIC = {'/':'index.html', '/index.html':'index.html', '/servers.json':'servers.json'};
const TYPES = {'.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8'};
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if(url === '/api/info'){
    res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
    return res.end(JSON.stringify({tsukimori:true, v:VERSION, name:NAME, motd:MOTD, players:[...clients].filter(c => c.presence).length, max:MAX_PLAYERS}));
  }
  const file = STATIC[url];
  if(!file || req.method !== 'GET'){ res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
  fs.readFile(path.join(GAME_DIR, file), (err, data) => {
    if(err){ res.writeHead(404, {'Content-Type':'text/plain'}); return res.end(file === 'index.html' ? 'Game file not found. Run the server from the Tsukimori repo.' : 'Not found'); }
    res.writeHead(200, {'Content-Type':TYPES[path.extname(file)], 'Cache-Control':'no-cache'}); res.end(data);
  });
});
server.on('upgrade', upgrade);
server.listen(PORT, () => console.log(`🌙 ${NAME} is open on http://localhost:${PORT}  (players join with ws://<your-address>:${PORT})`));
const shutdown = () => { if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; try{ fs.writeFileSync(DATA_FILE, JSON.stringify(store)); }catch(e){} } process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
