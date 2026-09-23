# 🌙 Tsukimori — a cute moon-forest ninja RPG

A turn-based, chibi-style ninja RPG that runs entirely in the browser: one HTML file, vanilla JavaScript and hand-drawn SVG art. No build tools, no dependencies, no assets to download.

Create a ninja, master the five elements, take ranked missions, adopt pets, join a clan, duel AI echoes of other builds, and team up against a weekly world boss. Momo, a little lantern spirit, guides you and can do things for you.

**Play online:** https://mofferato.github.io/tsukimori/

**Play locally:** open `index.html` in any modern browser.

## Features

- **Character creation**: body, 4 hairstyles, hair, outfit, eye and skin colors, and a starting element.
- **Turn-based combat** for up to 3 vs 3: Agility-based turn order, Chakra and cooldowns, burn, bleed, stun, slow, weaken, expose, empower, guard, haste and regen, floating damage numbers, auto-battle and a 1–3× speed toggle.
- **Element wheel**: Fire > Wind > Lightning > Earth > Water > Fire (+25% / −25%).
- **Progression**: level cap 60, 3 stat points per level (spend them yourself or tap Auto-assign, also offered on the battle results screen), 5 ranks (Lantern Pupil to Eclipse Warden), 35 player techniques over 7 tiers.
- **22 missions** across D, C, B, A and S ranks, 32 enemies, boss enrage phases and first-clear rewards.
- **Shop and gear**: 40+ items that change how your ninja looks.
- **Squad Lodge**: recruit up to 6 ninja, bring 2 into every battle and command their turns yourself. Train them, give them gear and spend their stat points. When a squadmate levels up you get a notice with a shortcut to their stat page, and they learn each new technique of their element for free, swapping it in for their weakest one (or turn that off and choose yourself).
- **Beast Den**: 7 pets that fight beside you and grow with bond.
- **Clan Hall**: 6 clans with perks that scale with reputation rank.
- **Echo Arena**: PvP against AI ghosts of generated builds, your own build, friends' pasted builds, and real players online.
- **Crimson Moon**: a weekly rotating boss with shared HP, 3 tries a day, milestones and a Moon Shard shop.
- **Journal**: daily quests, a login streak and 15 achievements.
- **Momo the guide**: answers questions and acts for you (spend points, buy and equip gear, learn techniques, adopt pets, join clans, claim rewards, start battles), with undo.
- **Multiplayer servers**: join a server from the Village Square, host a village right from your phone with a code, or run a dedicated server with one command (see below).
- **Save/load**: up to 8 ninja per browser, each in its own save slot (create a new ninja or switch from the title or Save screen without losing anyone), autosave, JSON export/import (imports become a new slot), and cloud save when online.
- **Sound effects** from a tiny WebAudio synth, light and dark themes, mobile-first layout, keyboard support and reduced motion.

## AI guide and multiplayer: where they run

| Feature | claude.ai hosted artifact | A Tsukimori server | GitHub Pages / local file, offline |
|---|---|---|---|
| Momo guide | Claude, on the viewer's own account, with tools that act in the game | Offline helper, or Claude with your own API key | Offline rule-based helper with one-tap actions, or Claude with your own API key (stored only in your browser) |
| Village presence, waves, shouts | ✅ live | ✅ live | — |
| Echo leaderboard and duels vs real players | ✅ | ✅ | Paste a friend's build in the Echo Arena |
| Community raid totals | ✅ | ✅ | — |
| Hire echoes of real players into your squad | ✅ | ✅ | — |
| Cloud save | ✅ on your Claude account | ✅ on the server, tied to your browser | JSON export/import |

## Multiplayer servers

Open the **Village Square** and use the **Servers** panel to join one. The list shows servers from [`servers.json`](servers.json), any you've joined before, and the server you're on if it served the game. Type a village code (`9WX4MF`) or paste an address (`wss://ninja.example.com`) to join any other. You can leave at any time and keep playing offline.

### Host on your phone (no install)

In the Servers panel, tap **Start hosting**. Your device becomes the village and you get a code and an invite link to share. Friends open the link (or type the code) on the GitHub Pages site and connect straight to your device over WebRTC.

- A free public [PeerJS](https://peerjs.com) service helps players find your device; after that, game traffic goes directly between devices (or through PeerJS's relay when networks block direct connections).
- The village is open only while the page is open. The game keeps your screen awake while hosting; if you switch apps or lock the phone, the browser may pause the page and players get disconnected until you come back.
- Up to 12 players. The leaderboard and raid totals are kept on your device for the next time you host, under the same code.

For a village that is always open, run a dedicated server instead.

### Run a dedicated server

The server is a single file with no dependencies ([`server/server.js`](server/server.js)). It serves the game and multiplayer on one port.

```sh
git clone https://github.com/Mofferato/tsukimori
cd tsukimori
node server/server.js          # Node.js 18 or newer
```

Open `http://localhost:8787`. Friends on your network open `http://<your-ip>:8787` and join automatically.

On an Android phone you can run the same server in [Termux](https://termux.dev): `pkg install nodejs git`, then the commands above. Keep Termux running (its notification has a wake-lock option).

To open it to everyone, run it somewhere with HTTPS so the GitHub Pages build can connect over `wss://`. A page on HTTPS can't join a plain `ws://` server, so HTTPS is required for that.

- **Docker**: `docker build -t tsukimori . && docker run -p 8787:8787 -v tsukimori-data:/data tsukimori`
- **Render, Railway, Fly.io or similar**: deploy this repo with the included `Dockerfile`, or as a Node service with root directory `server` and start command `npm start`. These hosts give you HTTPS, so players join with `wss://your-app.example.com`.
- **Your own VPS**: run it behind Caddy or nginx with a TLS certificate and proxy WebSocket upgrades to port 8787.

Settings (environment variables):

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `SERVER_NAME` | `Tsukimori village` | Name shown in the server list |
| `MOTD` | none | Message of the day shown to players |
| `DATA_FILE` | `server/data.json` | Where echoes, raid damage and cloud saves are stored |
| `MAX_PLAYERS` | `200` | Connections allowed at once |

To list your server for everyone, open a pull request adding it to `servers.json`:

```json
{ "servers": [ { "name": "Moonlit Grove", "url": "wss://ninja.example.com", "description": "EU, friendly" } ] }
```

**How it works.** Both kinds of host run the same rules from [`src/05a_hostcore.js`](src/05a_hostcore.js). Players get a random secret stored in their browser. The server derives their ID from it and only lets them write their own leaderboard entry, raid damage and hires, and read their own cloud save. Shouts and emotes are length-limited and rate-limited, and each connection has a message budget. Stats come from the player's browser, so a determined player could fake their own numbers; treat the leaderboard as friendly competition.

## Project layout

```
index.html        the built game (what GitHub Pages serves)
servers.json      public server list shown in the Village Square
server/server.js  the dedicated multiplayer server (no dependencies)
Dockerfile        container for the server
build.sh          concatenates src/ into index.html
src/01_head.html  markup and all CSS (theme tokens for light and dark)
src/02_data.js    content tables: elements, statuses, skills, enemies, items, missions, pets, clans, event
src/03_art.js     SVG sprites (chibi ninja, beasts, spirits, puppets, serpents, birds) and the village map
src/04_engine.js  state, saves, stats, units, battle engine, runs (missions, arena, event)
src/05a_hostcore.js  multiplayer host rules, shared by server/server.js and "Host on this device"
src/05_extra.js   quests, achievements, sound, auto-battle, Momo the guide, multiplayer (claude.ai and server backends)
src/06_squad.js   recruiting, training and managing squadmates
src/07_ui.js      screens, battle view and input actions
```

Edit files in `src/`, run `./build.sh`, then open `index.html`.

## Adding content

Everything is data. Add an entry and it shows up in the game:

- **Mission**: push to `MISSIONS` with `rank`, `lvl` and `stages: [{foes: [['enemyId', level], ...]}]`. XP and gold scale automatically.
- **Enemy**: push to `ENEMIES` with a sprite `kind` (`ninja`, `serpent`, `bird`, `puppet`, `beast` or `spirit`), an `el` element and `hpM`/`atkM`/`agiM` multipliers.
- **Technique**: push to `SKILLS` (`power`, `hits`, `target`, `apply: [{s: 'burn', dur, pow, chance}]`, `heal` and so on).
- **Item, pet or clan**: push to `ITEMS`, `PETS` or `CLANS`.
- **Guide tool**: add to `GUIDE_TOOLS` with a `name`, a `description`, a JSON `schema` and a `run(input)` function.

## Contributing

Pull requests are welcome. Keep it one self-contained file with no external runtime dependencies, keep all art original, and test on a phone-sized screen.

## License

MIT. See [LICENSE](LICENSE). All names, characters and art are original to this project.
