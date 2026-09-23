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
   The rules live in src/05a_hostcore.js, shared with "Host on this device" in the game.
   ===================================================================== */
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const PORT = +process.env.PORT || 8787;
const NAME = String(process.env.SERVER_NAME || 'Tsukimori village').slice(0, 40);
const MOTD = String(process.env.MOTD || '').slice(0, 200);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 200;
const GAME_DIR = path.join(__dirname, '..');
const MAX_FRAME = 1 << 20;
const {createHostCore} = require('../src/05a_hostcore.js');

/* ---------------- Storage ---------------- */
let saved = null;
try{ saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); console.log(`Loaded ${DATA_FILE}`); }
catch(e){ if(e.code !== 'ENOENT') console.error('Could not read data file, starting fresh:', e.message); }
let saveTimer = null;
function persist(){
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DATA_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(core.store), err => {
      if(err) return console.error('Save failed:', err.message);
      fs.rename(tmp, DATA_FILE, e => { if(e) console.error('Save failed:', e.message); });
    });
  }, 2000);
}
const core = createHostCore({name:NAME, motd:MOTD, maxPlayers:MAX_PLAYERS, store:saved, persist,
  hashId:t => crypto.createHash('sha256').update(t).digest('hex'), randomId:() => crypto.randomBytes(5).toString('hex')});

/* ---------------- Minimal WebSocket (RFC 6455) ---------------- */
function frame(op, payload){
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.alloc(10);
  if(n >= 65536){ head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(n, 6); }
  return Buffer.concat([head, payload]);
}
function upgrade(req, socket){
  const key = req.headers['sec-websocket-key'];
  if(!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') return socket.destroy();
  if(core.full()){ socket.end('HTTP/1.1 503 Server Full\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);

  const send = o => { if(!socket.destroyed) socket.write(frame(1, Buffer.from(JSON.stringify(o)))); };
  const close = (code, why) => { if(socket.destroyed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); socket.end(frame(8, Buffer.concat([b, Buffer.from(why || '')]))); };
  const conn = core.connect(send, close), c = {alive:true, close, ping:() => { if(!socket.destroyed) socket.write(frame(9, Buffer.alloc(0))); }};
  sockets.add(c);

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
        let msg; try{ msg = JSON.parse(text); }catch(e){ continue; }
        conn.receive(msg);
      }
    }
  });
  const drop = () => { sockets.delete(c); conn.drop(); };
  socket.on('close', drop); socket.on('error', drop); socket.on('end', drop);
}
const sockets = new Set();
setInterval(() => { // heartbeat: ping every 30s (browsers answer automatically) and drop anyone who went silent
  for(const c of sockets){ if(!c.alive){ c.close(1001, 'timeout'); continue; } c.alive = false; c.ping(); }
}, 30000).unref();

/* ---------------- HTTP: the game, the server list and /api/info ---------------- */
const STATIC = {'/':'index.html', '/index.html':'index.html', '/servers.json':'servers.json'};
const TYPES = {'.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8'};
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if(url === '/api/info'){
    res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
    return res.end(JSON.stringify(core.info()));
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
const shutdown = () => { if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; try{ fs.writeFileSync(DATA_FILE, JSON.stringify(core.store)); }catch(e){} } process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
