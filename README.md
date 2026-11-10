# Eric Da Red — A Saga of Axes & Invoices

A short story-driven RPG about a red-bearded Viking quartermaster who has three days to deliver
forty barrels of mead, two hundred cod and one golden goat to the Jarl. Most problems need a form.
Some need an axe.

*A WolfZtnel Game.*

## ▶ Play in your browser
**https://marklentz333.github.io/Eric_Da_Red/** (no install, works in Chrome, Edge or Firefox; about 2 minutes to load on a slow connection)

🎬 **Trailer:** [`Trailer/Eric_Da_Red_Trailer.mp4`](Trailer/Eric_Da_Red_Trailer.mp4)

## Play offline
Download the repo (green **Code** button → **Download ZIP**), unzip, and double-click **play.bat**
(needs Python). It starts a tiny local server and opens the game in your browser.

## Music
The soundtrack is in `Music_Tracks/`. To swap songs, put them in the `Music/` folder and relaunch with `play.bat`. Files are matched by name:
`intro`/`title`/`theme` → title song · `battle`/`fight` → battles · `boss`/`final` → Kraken · anything else → map music.
See `Music/README.txt`, or set exact file names in `js/config.js`.

## Cutscenes
Video cutscenes live in `assets/video/cut_*.mp4` (intro, docks, warehouse, bridge, kraken, ending) and play
the first time you reach each story point. Click or Esc skips. A missing file just falls back to the dialogue.
The final tavern scene plays `cut_tavern_1..4.mp4` back-to-back, with an in-engine version as the fallback (`?tavern`).

## Controls
| Action | Keys |
|---|---|
| Menus | Mouse, or Arrows + Enter (Esc = back) |
| Timed hits / stamps | **Space** or click when the ring meets the gold circle / the quill is in the zone |
| Block enemy attacks | **Space** the moment the **!** lights up over Eric |
| Red Fury (at 100 Madness) | **R** or the glowing button |
| Pack / Menu on the map | **I** / **Esc** |
| Fullscreen | **F** |

## How it works
- **Axes** are great vs. ropes, timber, cargo and tentacles, and they *lower* Madness.
- **Paperwork** crushes living forms and people, but every form *raises* Madness. Chopping paperwork only makes copies.
- At **70 Madness** Eric is *Seeing Red*: axes hit harder, but his stamping hand shakes.
- At **100** he can unleash **RED FURY**.
- Progress saves automatically after every location.

## Project layout
```
index.html, play.bat     the game (open in a browser) and the offline launcher
js/                      engine, audio, procedural art, data (enemies, skills, story), scenes
css/                     page + font styles
assets/                  game-ready sprites, props, portraits, backgrounds, cutscene videos, fonts
Music_Tracks/            soundtrack
Trailer/                 the 62-second game trailer
source_art/              original character, object and background art the assets were cut from
docs/flow_prompts/       the Google Flow prompts used to generate the cutscenes
tools/serve.py           the local launcher used by play.bat
tools/trailer/           scripts that recorded gameplay and cut the trailer
```
- Debug shortcuts: `index.html?battle=fjord&level=5`, `?map`, `?ending`, `?tavern`, `?cut=kraken`
