// ---------------------------------------------------------------------------
//  ERIC DA RED — configuration
// ---------------------------------------------------------------------------
//  MUSIC
//  Drop audio files (mp3 / ogg / wav / m4a) into the  Music/  folder.
//  When you launch with play.bat the folder is scanned automatically and files
//  are matched by name:
//     intro / title / theme / menu / opening   -> title-screen song
//     battle / fight / combat / war            -> battle music
//     boss / final / kraken                    -> final-boss music
//     anything else (background, bg, map ...)  -> exploration / map music
//  Missing tracks fall back sensibly (battle -> background -> intro).
//
//  If you'd rather pick the files yourself, put the exact file names below
//  (e.g. intro: 'My Viking Song.mp3'). These override auto-detection.
// ---------------------------------------------------------------------------
window.CONFIG = {
  musicDir: 'Music/',
  music: {
    intro: 'Music_Tracks/Viking Hip-Hop Rap Cover.mp3',
    background: 'Music_Tracks/Viking Techno Remix.mp3',
    battle: null,
    boss: null,
  },
  musicVolume: 0.55,
  sfxVolume: 0.8,
};
