
/* ============================ UTIL ============================ */
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shade(hex, p){
  let h = String(hex || '#888888').replace('#','');
  if(h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const t = p < 0 ? 0 : 255, a = Math.abs(p);
  r = Math.round((t - r) * a + r); g = Math.round((t - g) * a + g); b = Math.round((t - b) * a + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function fmtBonus(b){ return Object.entries(b || {}).map(([k, v]) => `+${v} ${STAT_NAMES[k] || k}`).join(', '); }

/* ============================ ART (SVG) ============================
   All sprites face right in a 120×170 box; enemies are mirrored with CSS. */
function eyeSVG(cx, cy, c, f){
  return `<ellipse cx="${cx}" cy="${cy}" rx="5.4" ry="7" fill="#fff"/>
  <ellipse cx="${cx+1}" cy="${cy+1}" rx="3.9" ry="5.4" fill="${c}"/>
  <ellipse cx="${cx+1.2}" cy="${cy+1.6}" rx="2" ry="3" fill="#111"/>
  <circle cx="${cx+2.4}" cy="${cy-1.6}" r="1.9" fill="#fff"/><circle cx="${cx-0.8}" cy="${cy+3.4}" r="0.9" fill="#fff" opacity=".9"/>
  <path d="M${cx-5.8} ${cy-6} Q${cx} ${cy-9.5} ${cx+5.8} ${cy-6}" stroke="#1d1a22" stroke-width="${f?2.4:1.7}" fill="none" stroke-linecap="round"/>
  ${f?`<path d="M${cx+5.2} ${cy-6} l3 -2.4" stroke="#1d1a22" stroke-width="1.6" stroke-linecap="round"/>`:''}`;
}
function hairBack(st, c){
  if(st === 'ponytail') return `<path d="M36 30 Q6 34 12 86 Q20 66 24 60 Q26 74 31 78 Q30 56 39 44Z" fill="${c}"/><circle cx="36" cy="37" r="4.5" fill="#c43d4b"/>`;
  if(st === 'long') return `<path d="M34 28 Q14 62 22 108 Q34 100 44 106 Q42 82 56 64 L60 28Z" fill="${c}"/>`;
  return '';
}
function hairCap(st, c){
  if(st === 'spiky') return `<path d="M30 47 L23 30 L36 32 L33 13 L48 24 L54 3 L64 20 L77 5 L78 24 L93 16 L88 32 L97 40 L90 47 Q60 22 30 47Z" fill="${c}"/>`;
  return `<path d="M31 49 Q27 19 60 18 Q93 19 89 49 Q86 34 60 32 Q34 34 31 49Z" fill="${c}"/>`;
}
function hairBangs(st, c){
  const side = `<path d="M32 44 Q29 58 35 63 L38 46Z" fill="${c}"/>`;
  if(st === 'spiky') return side + `<path d="M37 44 L41 55 L47 45 L53 57 L59 45 L65 55 L71 45 L78 53 L85 44Z" fill="${c}"/>`;
  if(st === 'short') return side + `<path d="M35 44 Q52 43 67 57 Q66 48 87 44Z" fill="${c}"/>`;
  if(st === 'ponytail') return side + `<path d="M37 44 L44 54 L52 45 L60 53 L68 45 L76 52 L85 44Z" fill="${c}"/>`;
  return `<path d="M33 44 Q39 60 35 74 Q46 62 48 46 L73 46 Q74 60 85 71 Q80 56 87 44Z" fill="${c}"/>`;
}
function backSVG(b){
  if(!b) return '';
  if(b.b === 'scroll') return `<g transform="rotate(-38 60 100)"><rect x="26" y="94" width="68" height="13" rx="6.5" fill="#efe3c6" stroke="#a88f5a" stroke-width="1.5"/><rect x="22" y="92.5" width="7" height="16" rx="2" fill="#8a2f2f"/><rect x="91" y="92.5" width="7" height="16" rx="2" fill="#8a2f2f"/></g>`;
  if(b.b === 'kite') return `<path d="M50 90 L4 56 L18 104Z" fill="#f6f1e4" stroke="#b8412f" stroke-width="2"/><path d="M50 98 L8 118 L30 130Z" fill="#f6f1e4" stroke="#b8412f" stroke-width="2"/><circle cx="24" cy="80" r="5" fill="#b8412f"/>`;
  if(b.b === 'quiver') return `<g transform="rotate(-22 40 96)"><rect x="35" y="50" width="3" height="14" fill="#6a4630"/><rect x="40" y="46" width="3" height="18" fill="#6a4630"/><rect x="32" y="62" width="14" height="62" rx="6" fill="#8fae5a" stroke="#5f7a36" stroke-width="1.5"/><path d="M32 80 h14 M32 100 h14" stroke="#5f7a36" stroke-width="2"/></g>`;
  return '';
}
function weaponSVG(w){
  if(!w) return '';
  const g = (inner, rot) => `<g transform="translate(86 113) rotate(${rot})">${inner}</g>`;
  switch(w.w){
    case 'kunai':  return g(`<rect x="-1.6" y="0" width="3.2" height="11" fill="#4a3526"/><circle cx="0" cy="13.5" r="2.6" fill="none" stroke="#777" stroke-width="1.4"/><path d="M-3.6 0 L0 -18 L3.6 0Z" fill="${w.c||'#9aa3ad'}" stroke="#555" stroke-width=".6"/>`, 35);
    case 'sword':  return g(`<rect x="-2" y="0" width="4" height="13" fill="#2b2b33"/><rect x="-5.5" y="-2.5" width="11" height="3" rx="1" fill="#b89a3a"/><path d="M-2.2 -2.5 L-2.2 -46 L0 -51 L2.2 -46 L2.2 -2.5Z" fill="#e3e9ef" stroke="#8d98a4" stroke-width=".7"/>`, 40);
    case 'sickle': return g(`<rect x="-1.8" y="-6" width="3.6" height="22" rx="1.5" fill="#6a4a2a"/><path d="M0 -6 Q22 -18 8 -38 Q15 -18 -1 -12Z" fill="#d4dde6" stroke="#8d98a4" stroke-width=".7"/>`, 20);
    case 'tanto':  return g(`<rect x="-1.8" y="0" width="3.6" height="10" fill="#3a1f1f"/><rect x="-4" y="-2" width="8" height="2.5" fill="#c43d2b"/><path d="M-2 -2 L-2 -24 L1 -28 L2 -22 L2 -2Z" fill="#ffd9c2" stroke="#e8553a" stroke-width=".9"/>`, 38);
  }
  return '';
}
function clothingSVG(cl, tx, tw){
  if(!cl) return '';
  if(cl.o === 'vest') return `<path d="M${tx+1} 88 L${tx+12} 87 L${tx+12} 122 L${tx-1} 122Z M${tx+tw-12} 87 L${tx+tw-1} 88 L${tx+tw+1} 122 L${tx+tw-12} 122Z" fill="${cl.c}"/><rect x="${tx+3}" y="100" width="7" height="6" rx="1" fill="${shade(cl.c,-.25)}"/><rect x="${tx+tw-10}" y="100" width="7" height="6" rx="1" fill="${shade(cl.c,-.25)}"/>`;
  if(cl.o === 'sash') return `<path d="M${tx} 93 L${tx+7} 87 L${tx+tw+1} 116 L${tx+tw-4} 123Z" fill="${cl.c}"/>`;
  if(cl.o === 'silk') return `<path d="M${tx} 86 Q60 80 ${tx+tw} 86 L${tx+tw+2} 124 Q60 128 ${tx-2} 124Z" fill="${cl.c}" opacity=".9"/><path d="M${tx+4} 96 L60 106 L${tx+tw-4} 96 M${tx+4} 106 L60 116 L${tx+tw-4} 106" stroke="#6a6a88" stroke-width=".8" fill="none"/>`;
  return '';
}
function ninjaSVG(L, gear, opt){
  L = L || {}; gear = gear || {}; opt = opt || {};
  const skin = L.skin || '#f3d2b3', hair = L.hair || '#2b2b3a', eye = L.eyes || '#3b6fd6';
  const scarf = opt.scarf || L.scarf || '#c43d2b', out = L.outfit || '#3a5a8c', f = L.gender === 'f';
  const dark = shade(out, -0.3), pants = shade(out, -0.5), band = L.bandColor || '#27305e', st = L.hairStyle || 'spiky';
  const tw = f ? 33 : 37, tx = 60 - tw / 2, acc = gear.accessory && gear.accessory.a;
  // Chibi proportions: the body is squashed toward the feet and the head is scaled up around the neck.
  const BODY = 'translate(60 162) scale(.84 .72) translate(-60 -162)', HEAD = 'translate(60 104) scale(1.32) translate(-60 -80)';
  let s = `<svg viewBox="${opt.viewBox || '0 0 120 170'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  if(!opt.viewBox) s += `<ellipse cx="60" cy="164" rx="28" ry="5" fill="rgba(40,20,80,.22)"/>`;
  s += `<g transform="${HEAD}">${hairBack(st, hair)}</g><g transform="${BODY}">` + backSVG(gear.back);
  s += `<path d="M50 86 Q30 88 14 104 Q26 102 30 110 Q38 96 52 94Z" fill="${scarf}"/>`;
  s += `<rect x="46" y="120" width="12" height="36" rx="5" fill="${pants}"/><rect x="62" y="120" width="12" height="36" rx="5" fill="${pants}"/>`;
  s += `<rect x="46" y="140" width="12" height="9" fill="#ece5d6"/><rect x="62" y="140" width="12" height="9" fill="#ece5d6"/>`;
  s += `<path d="M44 155 h16 v5 h-18z" fill="#3a2a22"/><path d="M61 155 h16 l3 5 h-19z" fill="#3a2a22"/>`;
  s += `<rect x="38" y="88" width="11" height="30" rx="5.5" fill="${dark}" transform="rotate(14 44 90)"/><circle cx="37.5" cy="117" r="5" fill="${skin}"/>`;
  s += `<path d="M${tx} 86 Q60 80 ${tx+tw} 86 L${tx+tw+2} 124 Q60 128 ${tx-2} 124Z" fill="${out}"/>`;
  s += clothingSVG(gear.clothing, tx, tw);
  s += `<path d="M53 86 L60 99 L67 86" fill="none" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`;
  s += `<rect x="${tx-1}" y="111" width="${tw+2}" height="6" rx="2" fill="${shade(out,-0.6)}"/>`;
  if(acc === 'bell') s += `<circle cx="${tx+tw-6}" cy="121" r="3.2" fill="#e3e8ee" stroke="#8a95a3"/>`;
  s += `<path d="M45 83 Q60 91 75 83 L75 92 Q60 99 45 92Z" fill="${scarf}"/>`;
  if(acc === 'beads') s += `<path d="M47 94 Q60 104 73 94" fill="none" stroke="#3f9a5a" stroke-width="3.4" stroke-dasharray="0.1 4.2" stroke-linecap="round"/>`;
  s += `<rect x="69" y="88" width="11" height="28" rx="5.5" fill="${out}" transform="rotate(-28 74 90)"/>`;
  s += weaponSVG(gear.weapon);
  s += `<circle cx="86" cy="113" r="5.5" fill="${skin}"/>`;
  s += `<rect x="55" y="72" width="10" height="14" fill="${shade(skin,-0.12)}"/></g><g transform="${HEAD}">`;
  s += `<ellipse cx="60" cy="50" rx="27" ry="26.5" fill="${skin}"/>`;
  s += `<ellipse cx="36" cy="54" rx="4" ry="6" fill="${shade(skin,-0.08)}"/>`;
  if(acc === 'earring') s += `<circle cx="36" cy="62" r="2.4" fill="#bfe3ff" stroke="#fff" stroke-width=".8"/>`;
  s += eyeSVG(53, 54, eye, f) + eyeSVG(72, 54, eye, f);
  if(L.mask) s += `<path d="M33 58 Q60 64 87 58 L85 70 Q60 84 35 70Z" fill="${L.mask}"/>`;
  else s += `<path d="M59 66 Q61.5 69 64 66 Q66.5 69 69 66" fill="none" stroke="#8a4a3a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="45" cy="63" rx="5" ry="2.8" fill="#ff8fa3" opacity=".55"/><ellipse cx="79" cy="63" rx="5" ry="2.8" fill="#ff8fa3" opacity=".55"/>`;
  if(L.scar) s += `<path d="M67 41 L77 64" stroke="#a24a3a" stroke-width="2" stroke-linecap="round"/>`;
  s += hairCap(st, hair);
  if(L.horns) s += `<path d="M40 32 Q28 16 34 3 Q40 18 49 27Z" fill="${L.horns}"/><path d="M80 27 Q89 13 87 1 Q80 16 72 25Z" fill="${L.horns}"/>`;
  if(L.band !== 'none'){
    s += `<path d="M33 40 Q20 42 11 53 Q22 50 26 55 Q28 46 34 45Z" fill="${band}"/>`;
    s += `<path d="M32 38 Q60 30 88 38 L88 46 Q60 38 32 46Z" fill="${band}"/>`;
    s += `<rect x="53" y="32" width="18" height="10" rx="2" fill="#d7dde4" stroke="#8a95a3" stroke-width="1"/><path d="M64.5 34 a3.8 3.8 0 1 0 0 6 a3 3 0 1 1 0 -6z" fill="#56616f"/>`;
    if(L.bandSlash) s += `<path d="M53 41 L71 33" stroke="#7a1f1f" stroke-width="1.8"/>`;
  }
  s += hairBangs(st, hair);
  return s + '</g></svg>';
}
function serpentSVG(L){
  const b = L.body, be = L.belly, d = shade(b, -0.3);
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="60" cy="163" rx="42" ry="6" fill="rgba(0,0,0,.28)"/>
  <path d="M14 152 Q10 132 46 130 Q96 128 102 146 Q104 162 60 161 Q18 161 14 152Z" fill="${d}"/>
  <path d="M26 142 Q24 116 58 114 Q92 112 88 130 Q84 146 50 144" fill="none" stroke="${b}" stroke-width="18" stroke-linecap="round"/>
  <path d="M76 124 Q98 92 78 66" fill="none" stroke="${b}" stroke-width="16" stroke-linecap="round"/>
  <path d="M84 118 Q100 92 84 72" fill="none" stroke="${be}" stroke-width="5" stroke-linecap="round" stroke-dasharray="4 4"/>
  <circle cx="40" cy="120" r="3" fill="${d}"/><circle cx="62" cy="116" r="3" fill="${d}"/><circle cx="30" cy="148" r="3" fill="${b}"/><circle cx="80" cy="150" r="3" fill="${b}"/>
  <ellipse cx="84" cy="58" rx="19" ry="12.5" fill="${b}" transform="rotate(-12 84 58)"/>
  <path d="M70 52 Q84 44 100 52" fill="none" stroke="${d}" stroke-width="2"/>
  <circle cx="90" cy="53" r="6" fill="#fff"/><circle cx="91" cy="53.5" r="4.4" fill="#2a2240"/><circle cx="92.4" cy="51.6" r="1.7" fill="#fff"/><ellipse cx="96" cy="62" rx="4" ry="2" fill="#ff8fa3" opacity=".6"/>
  <path d="M101 63 L112 61 M108 61 L114 57 M108 61 L114 65" stroke="#d63b3b" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
function birdSVG(L){
  const b = L.body, w = L.wing;
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><style>.wing{transform-origin:54px 100px;animation:flap .5s ease-in-out infinite alternate}@keyframes flap{to{transform:rotate(-16deg)}}</style>
  <ellipse cx="60" cy="163" rx="22" ry="4" fill="rgba(0,0,0,.2)"/>
  <path d="M40 108 L4 122 L10 110 L2 102 L38 98Z" fill="${w}"/>
  <path d="M56 118 L54 134 M64 118 L66 134" stroke="#e0a030" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="60" cy="102" rx="27" ry="19" fill="${b}"/>
  <circle cx="86" cy="82" r="14" fill="${b}"/>
  <path d="M97 78 L116 84 L97 90Z" fill="#e0a030"/>
  <circle cx="90" cy="79" r="5.4" fill="#fff"/><circle cx="90.8" cy="79.6" r="4" fill="${L.eye}"/><circle cx="90.8" cy="79.6" r="2" fill="#1a1430"/><circle cx="92.2" cy="77.8" r="1.4" fill="#fff"/>
  <ellipse cx="84" cy="88" rx="3.6" ry="1.8" fill="#ff8fa3" opacity=".6"/>
  <path class="wing" d="M54 96 Q30 48 10 60 Q26 72 18 84 Q34 82 28 96 Q42 92 56 106Z" fill="${w}"/></svg>`;
}
function puppetSVG(L){
  const w = L.wood, d = L.dark, g = L.glow;
  const seg = (x, y, h, r) => `<rect x="${x}" y="${y}" width="9" height="${h}" rx="4" fill="${w}" stroke="${d}" stroke-width="1.6" transform="rotate(${r} ${x+4.5} ${y})"/>`;
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="60" cy="164" rx="28" ry="5" fill="rgba(0,0,0,.28)"/>
  <path d="M34 0 L34 76 M86 0 L86 76 M60 0 L60 20" stroke="#c9c9d9" stroke-width=".8" opacity=".6"/>
  ${seg(48,116,22,6)}${seg(46,138,20,-4)}${seg(63,116,22,-6)}${seg(65,138,20,4)}
  <circle cx="52" cy="138" r="4" fill="${d}"/><circle cx="68" cy="138" r="4" fill="${d}"/>
  ${seg(30,72,22,12)}${seg(26,93,20,-8)}${seg(81,72,22,-12)}${seg(85,93,20,8)}
  <rect x="42" y="66" width="36" height="50" rx="8" fill="${w}" stroke="${d}" stroke-width="2"/>
  <path d="M56 76 L64 84 L56 92 L64 100" stroke="${g}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="60" cy="64" r="4" fill="${d}"/>
  <circle cx="60" cy="40" r="22" fill="${w}" stroke="${d}" stroke-width="2"/>
  <path d="M49 20 L54 31 L48 38" stroke="${d}" stroke-width="1.5" fill="none"/>
  <circle cx="53" cy="41" r="9" fill="${g}" opacity=".25"/><circle cx="70" cy="41" r="9" fill="${g}" opacity=".25"/>
  <circle cx="53" cy="41" r="5.5" fill="#1a1410"/><circle cx="53" cy="41" r="2.8" fill="${g}"/><circle cx="54.5" cy="39.5" r="1.2" fill="#fff"/>
  <circle cx="70" cy="41" r="5.5" fill="#1a1410"/><circle cx="70" cy="41" r="2.8" fill="${g}"/><circle cx="71.5" cy="39.5" r="1.2" fill="#fff"/>
  <ellipse cx="46" cy="49" rx="3.5" ry="1.8" fill="#ff8fa3" opacity=".5"/><ellipse cx="77" cy="49" rx="3.5" ry="1.8" fill="#ff8fa3" opacity=".5"/>
  <path d="M49 53 L73 53 M52 50 v6 M57 50 v6 M62 50 v6 M67 50 v6" stroke="${d}" stroke-width="1.6"/></svg>`;
}
function beastSVG(L){
  const b = L.body, be = L.belly, d = shade(b, -0.3), e = L.eye || '#ffd23a';
  const tail = L.tail === 'thin' ? `<path d="M32 116 Q10 112 8 94" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round"/>`
    : `<path d="M30 118 Q2 104 8 74 Q20 94 38 108Z" fill="${b}"/><path d="M12 84 Q6 76 8 72 Q14 80 18 90Z" fill="${be}"/>`;
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="60" cy="163" rx="40" ry="5" fill="rgba(0,0,0,.28)"/>
  ${tail}
  <rect x="34" y="122" width="10" height="36" rx="4" fill="${d}"/><rect x="48" y="124" width="10" height="34" rx="4" fill="${d}"/>
  <ellipse cx="58" cy="116" rx="31" ry="17" fill="${b}"/><ellipse cx="62" cy="125" rx="20" ry="7" fill="${be}"/>
  <rect x="70" y="122" width="10" height="36" rx="4" fill="${b}"/><rect x="82" y="120" width="10" height="38" rx="4" fill="${b}"/>
  <path d="M68 156 h13 v4 h-13z M80 156 h13 v4 h-13z" fill="${d}"/>
  <ellipse cx="88" cy="96" rx="18" ry="15" fill="${b}"/>
  <path d="M77 88 L79 64 L92 82Z" fill="${b}"/><path d="M80 84 L81 70 L88 81Z" fill="${L.ear || d}"/>
  <path d="M88 82 L97 61 L103 85Z" fill="${b}"/><path d="M91 81 L97 68 L100 83Z" fill="${L.ear || d}"/>
  <path d="M97 92 Q117 96 113 106 Q103 111 93 104Z" fill="${be}"/><circle cx="113" cy="99.5" r="2.8" fill="#111"/>
  <path d="M100 106 Q106 108 111 105" stroke="#222" stroke-width="1.4" fill="none"/>
  ${L.tusks ? `<path d="M104 107 Q111 101 108 94" stroke="#f3ead7" stroke-width="3" fill="none" stroke-linecap="round"/>` : ''}
  <circle cx="95" cy="91" r="5" fill="#fff"/><circle cx="95.8" cy="91.6" r="3.8" fill="${e}"/><circle cx="95.8" cy="91.6" r="1.9" fill="#1a1430"/><circle cx="97.2" cy="89.8" r="1.3" fill="#fff"/>
  <ellipse cx="90" cy="101" rx="3.8" ry="2" fill="#ff8fa3" opacity=".6"/></svg>`;
}
function spiritSVG(L){
  const f = L.flame, c = L.core;
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="60" cy="163" rx="20" ry="4" fill="rgba(0,0,0,.2)"/>
  <circle cx="60" cy="90" r="46" fill="${f}" opacity=".16"/>
  <path d="M44 116 Q38 140 26 152 Q48 144 54 122Z M76 116 Q84 140 94 150 Q72 142 66 122Z" fill="${f}" opacity=".7"/>
  <path d="M60 18 Q70 34 78 30 Q90 54 86 88 Q86 120 60 130 Q34 120 34 88 Q30 58 44 40 Q50 46 54 40 Q54 28 60 18Z" fill="${f}"/>
  <ellipse cx="61" cy="92" rx="18" ry="22" fill="${c}"/>
  <ellipse cx="55" cy="88" rx="3.2" ry="4.8" fill="#1a1430"/><ellipse cx="69" cy="88" rx="3.2" ry="4.8" fill="#1a1430"/>
  <circle cx="56" cy="86" r="1.3" fill="#fff"/><circle cx="70" cy="86" r="1.3" fill="#fff"/>
  <ellipse cx="50" cy="96" rx="3.5" ry="1.8" fill="#ff8fa3" opacity=".6"/><ellipse cx="74" cy="96" rx="3.5" ry="1.8" fill="#ff8fa3" opacity=".6"/>
  <path d="M58 100 Q62 104 66 100" stroke="#1a1430" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
}
function spriteSVG(u){
  switch(u.kind){
    case 'serpent': return serpentSVG(u.look);
    case 'bird':    return birdSVG(u.look);
    case 'puppet':  return puppetSVG(u.look);
    case 'beast':   return beastSVG(u.look);
    case 'spirit':  return spiritSVG(u.look);
    default:        return ninjaSVG(u.look, u.gear || {}, {scarf:u.look.scarf});
  }
}
function miniSprite(id){ const d = ENEMY[id]; return spriteSVG({kind:d.kind, look:d.look, gear:d.gear}); }
function petSprite(id){ const p = PET[id]; return spriteSVG({kind:p.kind, look:p.look}); }
function gearLooks(c){ const g = {}; for(const sl of SLOTS){ const it = ITEM[c.equip[sl]]; if(it && it.look) g[sl] = it.look; } return g; }
function playerSprite(){ return ninjaSVG(S.char.look, gearLooks(S.char), {scarf:ELEMENTS[S.char.element].color}); }

function wheelSVG(hl){
  const cx = 110, cy = 105, R = 72;
  const P = EL_ORDER.map((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  let s = `<svg viewBox="0 0 220 212" class="wheel" role="img" aria-label="Element wheel: Fire beats Wind, Wind beats Lightning, Lightning beats Earth, Earth beats Water, Water beats Fire"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10Z" class="ah"/></marker></defs>`;
  EL_ORDER.forEach((e, i) => {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 5], dx = x2 - x1, dy = y2 - y1, k = 25 / Math.hypot(dx, dy);
    s += `<line x1="${(x1+dx*k).toFixed(1)}" y1="${(y1+dy*k).toFixed(1)}" x2="${(x2-dx*k).toFixed(1)}" y2="${(y2-dy*k).toFixed(1)}" class="wl" marker-end="url(#ah)"/>`;
  });
  EL_ORDER.forEach((e, i) => {
    const [x, y] = P[i], E = ELEMENTS[e];
    s += `<g class="wn ${hl===e?'hl':''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="${E.color}"/><text x="${x.toFixed(1)}" y="${(y+6).toFixed(1)}" text-anchor="middle" font-size="17">${E.icon}</text><text x="${x.toFixed(1)}" y="${(y+(y>cy?34:-25)).toFixed(1)}" text-anchor="middle" class="wt">${E.name}</text></g>`;
  });
  return s + `<text x="${cx}" y="${cy+4}" text-anchor="middle" class="wc">beats</text></svg>`;
}

function villageSVG(){
  const tag = (x, y, t) => { const w = t.length * 13 + 30; return `<g class="vtag"><rect x="${x-w/2}" y="${y-18}" width="${w}" height="32" rx="16"/><text x="${x}" y="${y+6}" text-anchor="middle">${t}</text></g>`; };
  const roof = (x, y, w, h) => `<path d="M${x-16} ${y+8} Q${x+10} ${y+2} ${x+w*0.18} ${y-h} L${x+w*0.82} ${y-h} Q${x+w-10} ${y+2} ${x+w+16} ${y+8}Z" class="roof"/>`;
  const lantern = (x, y) => `<circle cx="${x}" cy="${y}" r="16" fill="url(#vglow)"/><rect x="${x-5}" y="${y-7}" width="10" height="14" rx="4" class="lanb"/>`;
  const tree = (x, y, h) => `<path d="M${x} ${y-h} L${x+h*0.32} ${y} L${x-h*0.32} ${y}Z" class="tree"/>`;
  const stars = [[60,40],[140,90],[230,30],[300,70],[420,40],[520,95],[700,160],[760,40],[480,20],[180,150],[590,30],[40,120]];
  const ffs = [[110,300,0],[250,330,1.2],[520,320,2.1],[700,300,.6],[450,380,3],[160,410,1.8]];
  return `<svg viewBox="0 0 800 470" class="village" role="img" aria-label="Map of Tsukimori village. Tap a building to enter.">
  <defs><linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s1"/><stop offset=".55" class="s2"/><stop offset="1" class="s3"/></linearGradient>
  <radialGradient id="vglow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
  <rect width="800" height="470" fill="url(#vsky)"/>
  <g class="stars">${stars.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.7"/>`).join('')}</g>

  <path d="M0 250 L110 150 L210 220 L330 110 L450 225 L560 150 L690 240 L800 180 L800 470 L0 470Z" class="mtn1"/>
  <path d="M0 290 L140 215 L270 285 L410 205 L550 285 L680 225 L800 270 L800 470 L0 470Z" class="mtn2"/>
  ${tree(20,330,90)}${tree(55,320,70)}${tree(245,318,60)}${tree(520,322,64)}${tree(760,330,96)}${tree(790,318,70)}${tree(730,322,56)}
  <g class="bld" data-act="go" data-arg="clan" tabindex="0" role="button" aria-label="Clan Hall">
    <rect x="182" y="196" width="76" height="40" class="wall"/><rect x="210" y="210" width="20" height="26" class="door"/>
    <circle cx="198" cy="212" r="6" class="emblem"/><circle cx="242" cy="212" r="6" class="emblem"/>
    ${roof(182,196,76,16)}
    ${tag(220,158,'Clan Hall')}
  </g>
  <g class="bld" data-act="go" data-arg="den" tabindex="0" role="button" aria-label="Beast Den">
    <path d="M505 224 Q508 178 545 174 Q582 178 585 224Z" class="wood"/>
    <path d="M530 224 Q545 196 560 224Z" fill="#1a1410"/>
    <circle cx="545" cy="186" r="4" class="emblem"/><circle cx="537" cy="180" r="2.2" class="emblem"/><circle cx="553" cy="180" r="2.2" class="emblem"/>
    ${tag(545,152,'Beast Den')}
  </g>
  <path d="M0 322 Q400 292 800 322 L800 470 L0 470Z" class="ground"/>
  <path d="M345 470 Q382 400 392 322 L408 322 Q420 400 468 470Z" class="vpath"/>
  <path d="M190 262 Q380 302 570 252" class="string"/>
  ${lantern(250,276)}${lantern(318,288)}${lantern(476,284)}${lantern(534,268)}
  <g class="bld" data-act="go" data-arg="event" tabindex="0" role="button" aria-label="Crimson Moon boss event">
    <circle cx="640" cy="86" r="58" fill="#e8553a" opacity=".18"/><circle cx="640" cy="86" r="46" class="moon-red"/>
    <circle cx="624" cy="74" r="8" fill="#000" opacity=".08"/><circle cx="656" cy="100" r="11" fill="#000" opacity=".08"/>
    ${tag(505,86,'Crimson Moon')}
  </g>
  <g class="bld" data-act="go" data-arg="academy" tabindex="0" role="button" aria-label="Academy: learn techniques">
    <rect x="325" y="228" width="150" height="92" class="wall"/>
    <rect x="340" y="248" width="22" height="30" class="win"/><rect x="438" y="248" width="22" height="30" class="win"/>
    <rect x="382" y="262" width="36" height="58" class="door"/>
    ${roof(325,228,150,26)}
    <rect x="352" y="170" width="96" height="44" class="wall"/>
    <rect x="366" y="182" width="16" height="20" class="win"/><rect x="418" y="182" width="16" height="20" class="win"/>
    <circle cx="400" cy="192" r="9" class="emblem"/>
    ${roof(352,170,96,22)}
    <path d="M400 116 L406 148 L394 148Z" class="roof"/>
    ${tag(400,348,'Academy')}
  </g>
  <g class="bld" data-act="go" data-arg="missions" tabindex="0" role="button" aria-label="Mission Board: take missions">
    <rect x="68" y="262" width="9" height="96" class="wood"/><rect x="175" y="262" width="9" height="96" class="wood"/>
    <rect x="56" y="258" width="140" height="76" rx="5" class="board"/>
    <rect x="66" y="268" width="32" height="26" class="note" transform="rotate(-5 82 281)"/><text x="82" y="287" text-anchor="middle" class="notet">D</text>
    <rect x="108" y="266" width="32" height="26" class="note" transform="rotate(4 124 279)"/><text x="124" y="285" text-anchor="middle" class="notet">D</text>
    <rect x="150" y="270" width="32" height="26" class="note" transform="rotate(-3 166 283)"/><text x="166" y="289" text-anchor="middle" class="notet">D</text>
    <rect x="84" y="300" width="32" height="26" class="note" transform="rotate(3 100 313)"/><text x="100" y="319" text-anchor="middle" class="notet">C</text>
    <rect x="130" y="302" width="32" height="26" class="note" transform="rotate(-4 146 315)"/><text x="146" y="321" text-anchor="middle" class="notet">?</text>
    ${roof(52,258,148,18)}
    ${tag(126,384,'Missions')}
  </g>
  <g class="bld" data-act="go" data-arg="shop" tabindex="0" role="button" aria-label="Shop: buy gear and supplies">
    <rect x="575" y="252" width="160" height="94" class="wall"/>
    <path d="M588 262 h134 v36 h-134z" class="noren"/>
    <path d="M615 262 v36 M642 262 v36 M669 262 v36 M696 262 v36" stroke="var(--wall)" stroke-width="3"/>
    <circle cx="655" cy="280" r="9" class="emblem"/>
    <rect x="585" y="306" width="140" height="12" class="wood"/>
    <rect x="590" y="320" width="26" height="26" class="wood" opacity=".8"/><rect x="620" y="326" width="20" height="20" class="wood" opacity=".6"/>
    ${roof(575,252,160,22)}
    ${lantern(748,276)}
    ${tag(655,374,'Shop')}
  </g>
  <g class="bld" data-act="go" data-arg="squad" tabindex="0" role="button" aria-label="Squad Lodge">
    <path d="M40 426 L85 384 L130 426Z" class="roof"/><rect x="52" y="408" width="66" height="22" class="wall"/>
    <path d="M78 430 L85 414 L92 430Z" class="door"/><path d="M85 384 L85 368 L100 374 L85 379" fill="#e8553a" stroke="var(--wood)" stroke-width="1.5"/>
    ${tag(85,452,'Squad')}
  </g>
  <g class="bld" data-act="go" data-arg="home" tabindex="0" role="button" aria-label="Home: inventory and equipment">
    <rect x="222" y="362" width="110" height="70" class="wall"/>
    <circle cx="252" cy="394" r="13" class="win"/>
    <rect x="288" y="388" width="28" height="44" class="door"/>
    ${roof(222,362,110,20)}
    ${tag(277,452,'Home')}
  </g>
  <g class="bld" data-act="go" data-arg="arena" tabindex="0" role="button" aria-label="Echo Arena">
    <ellipse cx="660" cy="414" rx="74" ry="18" class="vpath" stroke="var(--wood)" stroke-width="4"/>
    <ellipse cx="660" cy="414" rx="50" ry="10" fill="none" stroke="var(--wood)" stroke-width="2" stroke-dasharray="6 5"/>
    <rect x="584" y="392" width="7" height="26" class="wood"/><rect x="729" y="392" width="7" height="26" class="wood"/>
    <path d="M588 392 l0 -10 l14 5z M733 392 l0 -10 l-14 5z" fill="#e8553a"/>
    ${tag(660,452,'Echo Arena')}
  </g>
  ${ffs.map(([x,y,d]) => `<circle cx="${x}" cy="${y}" r="2.6" class="ff" style="animation-delay:${d}s"/>`).join('')}
  </svg>`;
}
