# 🌙 Tsukimori — a cute moon-forest ninja RPG

A turn-based, chibi-style ninja RPG that runs entirely in the browser: one HTML file, vanilla JavaScript and hand-drawn SVG art. No build tools, no dependencies, no assets to download.

Create a ninja, master the five elements, take ranked missions, adopt pets, join a clan, duel AI echoes of other builds, and team up against a weekly world boss. Momo, a little lantern spirit, guides you and can do things for you.

**Play online:** https://mofferato.github.io/tsukimori/

**Play locally:** open `index.html` in any modern browser.

## Features

- **Character creation**: body, 4 hairstyles, hair, outfit, eye and skin colors, and a starting element.
- **Turn-based combat** for up to 3 vs 3: Agility-based turn order, Chakra and cooldowns, burn, bleed, stun, slow, weaken, expose, empower, guard, haste and regen, floating damage numbers, auto-battle and a 1–3× speed toggle.
- **Element wheel**: Fire > Wind > Lightning > Earth > Water > Fire (+25% / −25%).
- **Progression**: level cap 60, 3 stat points per level, 5 ranks (Lantern Pupil to Eclipse Warden), 35 player techniques over 7 tiers.
- **22 missions** across D, C, B, A and S ranks, 32 enemies, boss enrage phases and first-clear rewards.
- **Shop and gear**: 40+ items that change how your ninja looks.
- **Squad Lodge**: recruit up to 6 ninja, bring 2 into every battle and command their turns yourself. Train them, teach them techniques, give them gear and spend their stat points.
- **Beast Den**: 7 pets that fight beside you and grow with bond.
- **Clan Hall**: 6 clans with perks that scale with reputation rank.
- **Echo Arena**: PvP against AI ghosts of generated builds, your own build, friends' pasted builds, and real players online.
- **Crimson Moon**: a weekly rotating boss with shared HP, 3 tries a day, milestones and a Moon Shard shop.
- **Journal**: daily quests, a login streak and 15 achievements.
- **Momo the guide**: answers questions and acts for you (spend points, buy and equip gear, learn techniques, adopt pets, join clans, claim rewards, start battles), with undo.
- **Save/load**: autosave, JSON export/import, and cloud save when online.
- **Sound effects** from a tiny WebAudio synth, light and dark themes, mobile-first layout, keyboard support and reduced motion.

## AI guide and multiplayer: where they run

| Feature | claude.ai hosted artifact | GitHub Pages / local file |
|---|---|---|
| Momo guide | Claude, on the viewer's own account, with tools that act in the game | Offline rule-based helper with one-tap actions, or Claude with your own API key (stored only in your browser) |
| Village presence, waves, shouts | ✅ live | — |
| Echo leaderboard and duels vs real players | ✅ | Paste a friend's build in the Echo Arena |
| Community raid totals | ✅ | — |
| Hire echoes of real players into your squad, and your squad is part of your echo | ✅ | — |
| Cloud save | ✅ | JSON export/import |

Online features use the claude.ai artifact runtime (`window.claude.use("db" | "room" | "user" | "sample")`). Everywhere else those calls resolve to nothing and the game plays solo. To run multiplayer on your own host, replace the small `NET` layer in `src/05_extra.js` with your own backend (Firebase, Supabase or a WebSocket server): it only needs a shared document store (`echoes`, `raidhits`, `hires`) and a broadcast channel (`shout`, `emote`, presence).

## Project layout

```
index.html        the built game (what GitHub Pages serves)
build.sh          concatenates src/ into index.html
src/01_head.html  markup and all CSS (theme tokens for light and dark)
src/02_data.js    content tables: elements, statuses, skills, enemies, items, missions, pets, clans, event
src/03_art.js     SVG sprites (chibi ninja, beasts, spirits, puppets, serpents, birds) and the village map
src/04_engine.js  state, saves, stats, units, battle engine, runs (missions, arena, event)
src/05_extra.js   quests, achievements, sound, auto-battle, Momo the guide, multiplayer
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
