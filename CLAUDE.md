# Eric Da Red: notes for working on this project

Vanilla-JS canvas RPG (1920x1080 logical, DPR-scaled). No build step and no dependencies: `index.html` loads `js/*` in order.
It's live on GitHub Pages: https://marklentz333.github.io/Eric_Da_Red/ (repo MarkLentz333/Eric_Da_Red, branch `main`).
Pushing to `main` redeploys the site in about a minute.

## Run / test
- Local: `python tools/serve.py --no-browser` serves on http://127.0.0.1:8642 (it also rewrites `js/music_manifest.js`).
- Debug URLs: `?battle=<enc>&level=N&mad=N`, `?map` (walkable world; add `&clear=docks,boat,...` and `&at=x,y`), `?oldmap` (v2 node map),
  `?hall` (mead hall), `?axes` (axe range), `?ending`, `?tavern`, `?cut=<name>`, `?nosplash`, `?auto` (perfect QTEs/blocks).
- Verify visually with headless Chrome via puppeteer-core (Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`).
  Take screenshots and check for console errors after every change.

## Flow of the game
Splash (`splash.js`) → Title → World (`world.js`, the walkable overworld; story NODES from `data.js` are placed by `WORLD_NODES`) → `Game.runNode` (banner → cutscene → dialog → battle → dialog)
→ final Kraken battle → `EndingScene` (cut_ending video + dialog) → `TavernScene` (cut_tavern_1..4 videos, or the in-engine
fallback) → ledger roll / THE END.
- Story text, enemies, encounters and speakers are all in `js/data.js` (`SCRIPTS`, `ENEMIES`, `ENCOUNTERS`, `SPEAKERS`, `NODES`, `IMAGES`).
- Cutscenes: `Cutscene.play(name | [names])` plays `assets/video/cut_<name>.mp4` and resolves `true` if anything played.
  Missing files fall back gracefully. Node→clip map is `NODE_CUTSCENES` in `main.js`.
- Overlays (dialog/banner/notice/cutscene) live in `js/scenes/dialog.js`. `Dialog.play(key, onLine)` has a per-line callback.
- Audio: `AudioSys.playMusic(intro|background|battle|boss|kraken)`, `AudioSys.sfx(name, { x | pan, pitch })` (synthesized, panned),
  `AudioSys.sting(name)` (musical transitions: battleStart, victory, defeat, levelup, chapter, rest, treasure), and `AudioSys.duck(v, instant)`.
- `js/music.js` (v2): an original adaptive score synthesized with WebAudio. The battle/boss/kraken slots use it unless config.js names a file.
  Layers: base, lead, rage (Madness >= 70), and fury. Battle sets them with `Music.intensity({ rage, fury })`.
- v2 battle systems: enemy intents (`planIntents`/`intentInfo`), parry (press within 0.09 s of the `!`, or a hair early, for a counter),
  Rhythm combo (+8% damage per stack, max 5), and S/A/B/C ratings (`ENCOUNTERS[].par`, best grade per fight in `Game.save.ratings`).
  There's also camera punch, `slowmo()`, and `goto(scene, t, 'slash')` for the battle wipe.
- v3 overworld (`js/world_data.js` + `js/scenes/world.js`): 5200x3200 world, camera follows Eric, WASD/arrows/click-to-move, E to interact,
  M big map with fast travel, minimap, objective arrow. Terrain is drawn procedurally (WATER polygons, ROADS splines, seeded trees).
  Props come from `assets/world/` (map props with the diorama soil base stripped). The east tree-line has a gate that opens when the
  Forest Road is unlocked, and the river is crossed by the bridge once it's cleared. Also: villagers (`WORLD_NPCS`, recolored placeholders
  until real art arrives; `npc_<id>` images override them), roaming skirmishes (`SKIRMISHES`, `sk_*` encounters), hidden `CACHES`.
- Side content: `axethrow.js` (Bjarni's range, best score + prizes) and `meadhall.js` (The Drunken Goat, an interactive tavern with the
  user's real-life coworkers as characters: Darrell = Eric's boss, gives `DISPATCH` side quests; Thomas = VP of Ops, negative, ends
  lines with "huh?" and says "Make it happen"; Nichole = office manager, always helpful: heals, gifts, hints, reveals caches).
  First visit plays `cut_crew.mp4`. Their sprites/portraits were cut from turnaround sheets in `source_art/Character/` (`Create_3D_*.jpg`).
- Save fields added in v3: `pos`, `skirm`, `found`, `axeBest`, `axePrize`, `q` (mead hall quest state), `revealCaches`.
- v1 = tag `v1.0` / branch `backup/v1`; v2 = branch `v2`. Art/video/music wishlist: `docs/ASSET_PROMPTS.txt`. New art drops into
  `NewCharactersAdded/` (gitignored). Turnaround sheets on a dark-gray background cut out well (see the cut script approach:
  smooth-background fit + GrabCut).

## Art pipeline (Python + OpenCV)
- Source art is in `source_art/` (Character, Objects, Backgrounds). Game-ready cutouts are in `assets/`.
- Read files whose names contain unicode with `cv2.imdecode(np.fromfile(path, np.uint8), 1)`.
- WolfZtnel (the user's own character) is cut from `source_art/Character/Character_Wolfztnel.jpg` with GrabCut.
  - Arms are separate sprites (`wolf_armL/R`, `eric_armR`), and `wolf_noL/noR` / `eric_noR` are the bodies with that arm painted out.
  - Arms rotate about the shoulder pivot (`TAV.ARMS` in `tavern.js`). Use real cutouts like these, not procedural limbs: hand-drawn arms looked cartoonish.
- Kraken: `kraken_head` / `kraken_tentacle` sprites, drawn in `art.js`.

## Cutscene videos (Google Flow)
- Prompts are in `docs/flow_prompts/`. The user generates each shot in Flow and every shot comes in 2 takes.
- Raw downloads go in `Cutscenes/` (gitignored). Pick the best take, copy it to `assets/video/cut_<name>.mp4`, and move the other take to `Cutscenes/Archive/`.

## Trailer
`tools/trailer/` produces `Trailer/Eric_Da_Red_Trailer.mp4` (62 s, cut to "Viking Hip-Hop Rap Cover"):
1. `cap.js` records deterministic 30 fps gameplay. It fakes `performance.now`/`requestAnimationFrame`, then steps frames and saves the canvas as JPEGs.
2. `cards.js` renders the title cards as PNGs using the game fonts and logo.
3. `trailer.py` composites everything (timeline in `SEGS` / `CARDS` / `FLASH`) and uses ffmpeg from `pip imageio-ffmpeg`.

These scripts expect `node_modules` (puppeteer-core) and `frames/` / `cards/` folders next to them. Run `npm i puppeteer-core` there first.
