# Eric Da Red: notes for working on this project

Vanilla-JS canvas RPG (1920x1080 logical, DPR-scaled). No build step and no dependencies: `index.html` loads `js/*` in order.
It's live on GitHub Pages: https://marklentz333.github.io/Eric_Da_Red/ (repo MarkLentz333/Eric_Da_Red, branch `main`).
Pushing to `main` redeploys the site in about a minute.

## Where things stand (resume here)
- **Live site = original v1** (`main` @ 521f8a3). The user had v1 restored after an unrequested push. NEVER push, merge to `main`,
  or touch GitHub/the live site without asking the user first, every time. Never put the user's real email in commits.
- **Active work = branch `v3`** (local, ahead of `origin/v3` which is at c8ae67d). Commit locally freely, push only when asked.
- v3.3 (this round): perspective camera, dense village with the user's new building art, animals, mead hall background.
  All villagers (Olaf, Bjarni, Haldor, Ulf, Gunnhild) now use the user's turnaround art (3/4 view → npc_<id>, front head →
  p_<id> portrait). New buildings: axe_range (replaces the drawn target), dispatch_office (Gunnhild's harbor office),
  jarls_hall (landmark NE of town) — `VILLAGE.landmarks`. Still missing: townsfolk/animal walk clips (prompts 1a-1j).
- v3.2 (b57fbd4) added: filmed walk cycles, `b_*` grounded props, decluttered town, 4 shieldmaidens with flirty barks,
  Brynja the barmaid (mead hall + finale tavern), "Click for sound" cutscene fix, fixed backwards boots in the mead hall.
- Known gaps / likely next asks:
  - The walk-away (`eric_up`) cycle is weak: the clips have no clean straight walk-away. A dedicated clip would fix it.
  - Villagers Olaf/Haldor/Bjarni/Ulf are still recolored Eric clones on the paper-doll rig (need real art).
  - Stone-wall gate props still show some diorama base.
  - Unused source in `NewCharactersAdded/`: `Woman_serving_ale_in_tavern_*.mp4` (Brynja clip, could become a mead-hall cutscene)
    and walk clip `8e513d1a` (not used by `extract_walk.py`).
- The user's bar: "the world view walking around needs much improvement, you can do much better". Keep raising overworld quality.

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
