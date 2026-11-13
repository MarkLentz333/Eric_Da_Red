# Eric Da Red: notes for working on this project

Vanilla-JS canvas RPG (1920x1080 logical, DPR-scaled). No build step and no dependencies: `index.html` loads `js/*` in order.
It's live on GitHub Pages: https://marklentz333.github.io/Eric_Da_Red/ (repo MarkLentz333/Eric_Da_Red, branch `main`).
Pushing to `main` redeploys the site in about a minute.

## Where things stand (resume here) — last updated 2026-11-13
- **Live site = original v1** (`main` @ 521f8a3) until the user approves a v3 release. The user had v1 restored after an
  unrequested push. NEVER push, merge to `main`, or touch GitHub/the live site without asking the user first, every time.
  Never put the user's real email in commits.
- **Active work = branch `v3`** (v3.4). Commit locally freely, push only when asked.
- **What v3 has now:** v2 combat (intents, parry, rhythm, ratings, adaptive score); walkable perspective overworld with the
  full Fjordheim village from the user's building art; real art + portraits for every villager; filmed walk cycles for Eric
  and the townsfolk; shieldmaidens + Brynja; mead hall with the real-life crew and side quests; axe range; dragon SQI quest;
  skirmishes and hidden caches; big map with fast travel + minimap. v3.4 (the user's "looks a lot better" round): pulled-back
  strategy-RPG camera, people at door height (ERIC_H 92) with buildings at full size so their detail shows, silhouette instead of
  see-through houses, A* click-to-move with hover rings, conversation stage with large characters, art-accurate collision.
- **Still planned / wanted:** filmed animal clips to replace the procedural animals (1h dog, 1e chicken, 1f sheep first, then
  goat/pig/horse), 1k Eric walking away (his walk-up is a mirrored single step), 1c old man + 1d kid walk clips (more townsfolk:
  the user notes more background walkers are coming, so keep the street count modest, currently 5), 2f jarl, 3f signpost,
  4x portraits, 5a-5c backgrounds, 6x cutscenes, 7x music. Ideas floated, not requested: chapter 2 starring WolfZtnel,
  Flow-clip audio in the trailer.
- The user's image/video credits reset on **2026-11-19**. Wishlist: `docs/ASSET_PROMPTS.txt` (every prompt self-contained,
  copy between >>> and <<<); `docs/TOP_PROMPTS.txt` = the current short list. New files arrive in
  `C:/Users/ronin/Downloads/New Assets/` (named like `3h  longhouse_small.png.jpg`); copy into source_art/ before cutting.
- Done from the wishlist: 1a/1b (villager walk clips), 2a-2e (villagers), 3a-3e, 3g, 3h, 5d (open items: see "Still planned").
- Known rough spots: procedural animals are cartoonier than the art; the diorama grass tiles under buildings show faint edges;
  townsfolk use only side-view sheets (they slide a bit when walking straight up/down a road); headless perf ~7-9 ms/frame.
- Pipelines: buildings `tools/cut/diorama_cut.py <img> <name> 620` → add to NAMES in `tools/rig/blend_bases.py` → register
  `w_`/`b_` in world_data.js → place in `VILLAGE` (world_life.js). Characters: `tools/cut/isnet_cut.py` on the 3/4 view of a
  turnaround sheet (model = scratchpad isnet.onnx; re-download rembg's isnet-general-use.onnx if gone), trim, 820 px tall →
  `assets/sprites/npc_<id>.png`; front-view head 4:5 → `assets/portraits/<id>.jpg`. Walk clips: add a `CYCLES` entry in
  `tools/walk/extract_walk.py` (find the loop by matching leg silhouettes; avoid frames where they turn their head).

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
- Overworld look (v3.2): Eric walks with FILMED cycles cut from the user's green-screen Flow clips (`tools/walk/extract_walk.py` →
  `assets/sprites/walk/*.webp` sheets + `js/walk_data.js`): `eric_down`/`eric_side` (mirrored for left)/`eric_up` (one step + mirror;
  the clip has no clean walk-away) and `eric_hall` (eye-level side walk used in the mead hall; dull-green backdrop → `SMOOTH_KEY`).
  Cycle playback is tied to ground speed (one cycle per ~body-height stride); movement eases in/out; camera leads the walk direction.
  The old `eric_side.png` has its boots on backwards (source sheet error): don't use it. Villagers still use the paper-doll rig
  (`tools/rig/rig_eric.py`, `RIG` in world.js). Props use `b_*` versions with the diorama grass island dissolved
  (`tools/rig/blend_bases.py`), falling back to `w_*`. Trees use tile-free `t_*` sprites. Everything casts a skewed silhouette shadow.
- v3.3 perspective + village (`CAM3` in world.js, `js/scenes/world_life.js`): the overworld is a tilted ground plane seen
  through a pinhole camera. `this.cam` is the FOCUS ground point (not a corner); use `proj(x,y)` → {x,y,s} / `unproj(sx,sy)`,
  `bb(c,x,y,fn)` draws fn in a depth-scaled billboard frame, `view` = visible ground rect. Static ground is baked into
  512px world tiles (`paintStatic`, `paintVillage` adds cobbles/plots/pen/beds; delete `this.tiles` to rebuild), the per-frame
  ground (water anim, shadows, dust, clouds) is composed in `groundLayer()` and projected in strips by `projectGround()`.
  Fences/walls/bunting are drawn in screen space (`add(x,y,f,true)`). Village layout = `VILLAGE`/`TOWN` in world_life.js;
  animals (chicken, sheep, pig, goat, dog, cat, duck, crow, gulls, butterflies) are procedural `_a_<type>` painters.
  Buildings from the user's dioramas: `longhouse`, `goat_hall` (= the Drunken Goat, MEAD_HALL.p), `goat_inn`, `stall1/2`,
  `blacksmith`, cut with `tools/cut/diorama_cut.py <img> <name> 620` (auto-finds the soil edge) then `blend_bases.py`.
  Mead hall interior uses `bg_meadhall` (assets/bg/meadhall.jpg). Prompts: `docs/ASSET_PROMPTS.txt` (every prompt
  self-contained) and `docs/TOP_PROMPTS.txt` (the current short list for the user's limited credits).
- v3.4 view/controls (after the user's "character too big / see-through houses is clunky" feedback; references: Tyranny,
  Pillars-style isometric RPGs): camera pulled back (`CAM3` pitch 1.0, zoom 0.66), people sized to the buildings' doors (`ERIC_H` 92, ERIC_R 12, WALK 290, animals x0.55, 5 strollers;
  buildings stay full size (x1.25, trees x1.22): the user wants their detail visible; west cluster thinned, 3rd stall removed),
  so the whole village fits on screen. NO fading of buildings: when something stands in front of Eric, `drawOccluded` redraws
  the hidden part of him as a warm silhouette with a rim (mask = the occluding sprites). Gold ring under Eric. Click-to-move
  uses A* on a 32px grid (`navGrid`/`findPath`/`clearLine`, string-pulled) with a dotted route; hovering a person/door shows a
  ring + pointer cursor (`pickAt`). Labels/bubbles grow with `uiScale` to stay readable. Ground layer is rendered at
  `CAM3.gs` 0.72 resolution for speed. Talking opens a conversation stage (`drawConvo`): world dims, Eric and the villager
  stand large above the dialogue box (the speaker lit, the listener dimmed).
- Collision (v3.4): buildings/props get footprint polygons read from their own art (`footprintQuad`/`makeFootprints`:
  lowest non-grass opaque pixels = base corners, mapped to the ground plane), fences/walls are capsules (`seg`), trees stay
  circles. `tryMove` glides along walls (tries the step turned 30/60 deg). Click paths: A* grid padded ERIC_R+1, start-cell
  escape only toward cells Eric can walk straight to, each step also tests its midpoint (lanterns fit between cell centres), 0.7 s no-progress watchdog re-plans once then stops. Debug view:
  add `&solids` to the URL to draw every collision shape. Robot test (80 random town trips) = 80/80 arrivals.
- Shieldmaidens (Astrid/Sigrid/Freydis/Runa, `maiden1..4` in `WORLD_NPCS`, art from `source_art/Character/Viking_women.jpg`) stand
  around the world and always greet Eric with playful flirty `barks` (speech bubble, one at a time, 30 s cooldown); E = short chat.
  Brynja the barmaid (`npc_barmaid`, cut off at the knees, so she always stands behind a counter/table) greets Eric in the mead hall
  (`BRYNJA_HI`/`BRYNJA_TALK` in world_data.js, pours a free mead once per visit) and toasts him in the finale tavern.
  People on busy photo backgrounds are cut with `tools/cut/isnet_cut.py` (ISNet ONNX via onnxruntime; model = rembg's
  isnet-general-use.onnx, download it, it isn't in the repo). `rembg` itself won't import here (Windows app-control blocks skimage).
- Cutscene sound: if the browser blocks autoplay audio, the clip plays muted with "Click for sound"; the first click unmutes (no skip).
- Side content: `axethrow.js` (Bjarni's range, best score + prizes) and `meadhall.js` (The Drunken Goat, an interactive tavern with the
  user's real-life coworkers as characters: Darrell = Eric's boss, gives `DISPATCH` side quests; Thomas = VP of Ops, negative, ends
  lines with "huh?" and says "Make it happen"; Nichole = office manager, always helpful: heals, gifts, hints, reveals caches).
  First visit plays `cut_crew.mp4`. Order #2 "Close the SQI" sends Eric to DRAGON_RIDGE (north woods), which plays `cut_dragon.mp4`. Their sprites/portraits were cut from turnaround sheets in `source_art/Character/` (`Create_3D_*.jpg`).
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
