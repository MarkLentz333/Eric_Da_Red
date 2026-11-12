'use strict';
// ============================================================================
//  WORLD DATA (v3) — the walkable 3/4 overworld: terrain, locations, NPCs,
//  roaming skirmishes, hidden caches.  World units are logical pixels.
// ============================================================================
const WORLD = { w: 5200, h: 3200 };

// Water bodies (impassable). Polygons in world coords.
const WATER = [
  // western sea + harbor
  [[0, 0], [620, 0], [700, 380], [600, 760], [760, 1120], [720, 1480], [600, 1720], [760, 1980], [980, 2240], [1080, 2560], [1440, 2860], [1900, 3000], [2200, 3200], [0, 3200]],
  // the river (flows north → south, the toll bridge crosses it)
  [[4020, 0], [4250, 0], [4230, 420], [4290, 860], [4250, 1300], [4330, 1800], [4300, 2300], [4400, 2800], [4440, 3200], [4190, 3200], [4150, 2800], [4060, 2300], [4090, 1800], [4010, 1300], [4050, 860], [3990, 420]],
  // the fjord mouth (far east)
  [[5200, 0], [4900, 0], [4860, 500], [4980, 900], [4880, 1350], [4950, 1800], [4880, 2300], [4960, 2800], [4920, 3200], [5200, 3200]],
];
// Toll-bridge deck: walkable across the river once the bridge is cleared
const BRIDGE_DECK = { x: 3960, y: 780, w: 380, h: 120 };

// Dirt roads (Catmull-Rom smoothed)
const ROADS = [
  [[1250, 2500], [1090, 2330], [1000, 2120], [1080, 1900], [1250, 1780], [1500, 1700], [1760, 1640]],          // home → docks → town
  [[1000, 2120], [860, 1900], [820, 1700]],                                                                   // docks → longboat jetty
  [[1760, 1640], [1720, 1400], [1650, 1180], [1400, 1000]],                                                   // town → warehouse → lost & found
  [[1760, 1640], [2050, 1700], [2320, 1660], [2620, 1700], [2880, 1720], [3150, 1780], [3420, 1900], [3640, 2140]], // town → workshop → east gate → oak → woodpile
  [[1760, 1640], [1880, 1900], [2060, 2080]],                                                                 // town → axe range
  [[3150, 1780], [3050, 2100], [2960, 2420]],                                                                 // oak → well
  [[3640, 2140], [3700, 1700], [3560, 1300], [3480, 1060]],                                                   // woodpile → camp
  [[1650, 1180], [1800, 960], [2020, 780], [2250, 640], [2380, 560]],                                       // town → Dragon Ridge (north woods)
  [[3480, 1060], [3700, 900], [3960, 840], [4340, 840], [4560, 960], [4700, 1300], [4760, 1560]],              // camp → bridge → fjord
];

// Map NODES (data.js) placed in the world. ix/iy = where Eric stands to interact; r = solid radius at the base.
const WORLD_NODES = {
  home: { x: 1350, y: 2650, h: 400, ix: 1250, iy: 2500, r: 120, mark: null },
  docks: { x: 830, y: 2180, h: 230, ix: 1000, iy: 2120, r: 0, mark: 'en_crate', mx: 920, my: 2080 },
  boat: { x: 620, y: 1720, h: 330, ix: 820, iy: 1700, r: 0, mark: 'en_nets', mx: 760, my: 1640 },
  warehouse: { x: 1640, y: 1150, h: 360, ix: 1660, iy: 1210, r: 150, mark: '_invoice', mx: 1520, my: 1210 },
  lostcargo: { x: 1340, y: 980, h: 170, ix: 1400, iy: 1020, r: 60, mark: null },
  workshop: { x: 2340, y: 1560, h: 330, ix: 2320, iy: 1640, r: 140, mark: null },
  road: { prop: 'oak', x: 3170, y: 1650, h: 420, ix: 3150, iy: 1780, r: 70, mark: 'en_oak', mx: 3060, my: 1800 },
  well: { x: 2960, y: 2470, h: 200, ix: 2960, iy: 2420, r: 60, mark: null },
  woodpile: { x: 3760, y: 2150, h: 220, ix: 3640, iy: 2140, r: 90, mark: 'smuggler', mx: 3600, my: 2060 },
  camp: { x: 3440, y: 1010, h: 190, ix: 3480, iy: 1080, r: 70, mark: null },
  bridge: { x: 4140, y: 900, h: 260, ix: 3930, iy: 845, r: 0, mark: 'sven', mx: 3920, my: 840 },
  fjord: { x: 4880, y: 1640, h: 380, ix: 4760, iy: 1560, r: 0, mark: 'kraken_tentacle', mx: 4790, my: 1500 },
};

// The east gate (Jarl's barricade) opens once the Forest Road is unlocked
const GATE = { x: 2700, y: 1590, w: 130, h: 270, unlock: 'road' };
// A dense pine tree-line runs north–south at x≈2760, closed except for the gate gap
const TREELINE = { x: 2765, gap: [1560, 1880] };

// Town & landmark props (non-interactive). s = target height.
const WORLD_PROPS = [
  { p: 'fish_shed', x: 760, y: 1420, h: 300, r: 110 },
  { p: 'fish_rack', x: 1220, y: 1960, h: 170, r: 50 },
  { p: 'canoe_sand', x: 1010, y: 2420, h: 110, r: 0 },
  { p: 'canoe_sand2', x: 1180, y: 2050, h: 100, r: 40 },
  { p: 'rowboat_water', x: 560, y: 2000, h: 130, r: 0 },
  { p: 'crates', x: 1880, y: 1520, h: 120, r: 40 },
  { p: 'crate_barrel', x: 2180, y: 1460, h: 110, r: 40 },
  { p: 'handcart', x: 2520, y: 1580, h: 120, r: 40 },
  { p: 'nets', x: 2230, y: 2010, h: 160, r: 60 },
  { p: 'ladder_wood', x: 1530, y: 1460, h: 150, r: 55 },
  { p: 'stone_wall', x: 1440, y: 1330, h: 100, r: 0 },
  { p: 'well', x: 2010, y: 1790, h: 0, r: 0, skip: true },
  { p: 'canoe_sand', x: 4700, y: 1760, h: 110, r: 0 },
  { p: 'crates', x: 4560, y: 1180, h: 110, r: 40 },
];

// The Axe Range — a fun spot in town (opens the axe-throwing side game)
const AXE_RANGE = { x: 2060, y: 2140, ix: 2000, iy: 2110 };

// Villagers you can walk up to and talk to.  body: base sprite + canvas filter (placeholder until real art arrives).
// talk: list of line-sets; Eric cycles through them.  stage(n) picks lines based on story progress.
const WORLD_NPCS = [
  { id: 'gunnhild', name: 'Gunnhild', x: 860, y: 1540, wander: 0, body: null, office: true, talk: [
    [{ s: 'gunnhild', t: 'Harbor office is open. Complaints go in the barrel. The barrel is also full of complaints.' }],
    [{ s: 'gunnhild', t: 'Olaf says a crate bit him. Olaf also says the moon follows him home.' }, { s: 'eric', m: 'smirk', t: 'The crate DID bite him. I have it in writing.' }],
    [{ s: 'gunnhild', t: 'If you see Bjarni at the axe range, tell him the target is not a "mood board".' }],
  ] },
  { id: 'olaf', name: 'Olaf', x: 1500, y: 1820, wander: 160, body: ['sven', 'sepia(0.6) saturate(1.25) brightness(1.3) contrast(0.92)'], talk: [
    [{ s: 'olaf', t: 'Eric! I counted the cod. Twice. Got two different numbers.' }, { s: 'eric', m: 'calm', t: 'Then count a third time and take the average.' }, { s: 'olaf', t: '...That\'s allowed?' }],
    [{ s: 'olaf', t: 'My hand still hurts from the crate. Do crates have teeth? Is that in the manifest?' }],
    [{ s: 'olaf', t: 'I heard there\'s a well in the forest that grants wishes. I wished for fewer crates.' }, { s: 'eric', m: 'shout', t: 'DON\'T WISH FOR FEWER CRATES. WE NEED FORTY.' }],
  ] },
  { id: 'haldor', name: 'Old Haldor', x: 1320, y: 2080, wander: 60, body: ['sven', 'grayscale(0.9) brightness(1.6) contrast(0.8)'], talk: [
    [{ s: 'haldor', t: 'Sixty winters I\'ve fished this fjord. Never seen a squid with a monocle. Until Tuesday.' }],
    [{ s: 'haldor', t: 'Herring calms the blood, lad. Eat one before you go red. Or after. Or during.' }],
    [{ s: 'haldor', t: 'The big beast at the fjord mouth hates paperwork. Funny. So does everyone.' }],
  ] },
  { id: 'bjarni', name: 'Bjarni the Axe-Master', x: 1930, y: 2200, wander: 40, body: ['smuggler', 'brightness(1.9) sepia(0.55) saturate(1.5) contrast(0.88)'], range: true, talk: [
    [{ s: 'bjarni', t: 'Quartermaster! Fancy a throw? Five axes. Bullseye is fifty. Wind is free.' }],
  ] },
  { id: 'ulf', name: 'Little Ulf', x: 2150, y: 1720, wander: 260, fast: true, body: ['sven', 'hue-rotate(-20deg) saturate(1.5) brightness(1.35)'], scale: 0.72, talk: [
    [{ s: 'ulf', t: 'Are you a REAL Viking? You have glasses.' }, { s: 'eric', m: 'smirk', t: 'The glasses are how I see who to chop.' }],
    [{ s: 'ulf', t: 'I found a shiny thing behind the barn! Then I lost it! It\'s probably still there!' }],
    [{ s: 'ulf', t: 'When I grow up I want to be a quartermaster. Or a goat.' }],
  ] },
  // Shieldmaidens (user's art: source_art/Character/Viking_women.jpg). They stand around the world and always
  // greet Eric as he passes (barks: a speech bubble, no dialog box); E opens a short flirty chat.
  { id: 'maiden1', name: 'Astrid', x: 1460, y: 2390, wander: 0, maiden: true, barks: [
    "Well, well. Eric Da Red. Is that beard regulation, or just showing off?",
    "Hi, Eric! Walk slower. I'm admiring the axes.",
    "Oh, it's the handsome quartermaster. Dispatch yourself over here sometime.",
    "Careful, Red. Keep strolling like that and I'll need a herring to calm down.",
  ], talk: [
    [{ s: 'maiden1', t: "Eric! Finally. I've been 'guarding' this exact spot for an hour. Waiting for nobody. Definitely not you." }, { s: 'eric', m: 'smirk', t: 'I can log that as a security detail.' }, { s: 'maiden1', t: 'Log me under "priority shipment", then.' }],
    [{ s: 'maiden1', t: 'Heard you yelled at a crate until it apologised. That is SO attractive.' }, { s: 'eric', m: 'calm', t: 'It had it coming. It was mislabelled.' }],
  ] },
  { id: 'maiden2', name: 'Sigrid', x: 1760, y: 1630, wander: 0, maiden: true, barks: [
    "Eric! Save me a seat at the Drunken Goat. Right next to yours.",
    "Hello, handsome. Your manifest isn't the only thing that's well organized.",
    "There goes Eric. Somebody fetch me a shield, my heart needs one.",
    "Hi Eric~ The winged helmet is new. Thanks for noticing. You didn't, but thanks.",
  ], talk: [
    [{ s: 'maiden2', t: 'Eric Da Red. I keep hearing your name in the mead hall. Mostly from Darrell, mostly with the word "now".' }, { s: 'eric', m: 'smirk', t: 'He has a lot of "nows".' }, { s: 'maiden2', t: "Well, if you ever have a free moment... I'd make it happen. No 'huh?' required." }],
    [{ s: 'maiden2', t: 'Shield, sword, helmet with wings. And still, you are the most dangerous thing on this road.' }, { s: 'eric', m: 'calm', t: "...I'm going to go count some barrels." }],
  ] },
  { id: 'maiden3', name: 'Freydis', x: 3430, y: 1830, wander: 0, maiden: true, barks: [
    "Oh look, it's Eric. Fought anything interesting today, or just paperwork?",
    "Hey, Red! Two axes, one Freydis. I'd still let you win.",
    "Hi Eric. That glare you do at invoices? Do it at me sometime.",
    "Mmm. Smells like pine, mead and a man who closed his SQIs.",
  ], talk: [
    [{ s: 'maiden3', t: "I painted my face for battle. Then you walked by and now I've forgotten which battle." }, { s: 'eric', m: 'smirk', t: 'The smugglers are that way.' }, { s: 'maiden3', t: "Ugh. Practical AND bearded. Unfair." }],
    [{ s: 'maiden3', t: 'If you ever need someone to hold your axes while you shout at a kraken... I volunteer.' }],
  ] },
  { id: 'maiden4', name: 'Runa', x: 3660, y: 1190, wander: 0, maiden: true, barks: [
    "Hi Eric! I never miss a target. Just so you know.",
    "Eric! You're blushing. Or is that just the beard?",
    "There's my favourite quartermaster. Don't tell the others. Fine, tell them.",
    "Hello, Red. Want an escort through the woods? I'm very good with my bow.",
  ], talk: [
    [{ s: 'maiden4', t: 'I could hit an apple off your head from a hundred paces.' }, { s: 'eric', m: 'shout', t: 'THE APPLES ARE MINE.' }, { s: 'maiden4', t: 'Ha! Fine. Keep your apples. I was aiming for your heart anyway.' }],
    [{ s: 'maiden4', t: 'Quiet out here. Just birds, smugglers, and me waiting to say hi to Eric.' }, { s: 'eric', m: 'calm', t: 'Hi, Runa.' }, { s: 'maiden4', t: 'Worth the wait.' }],
  ] },
];

// Roaming enemies: optional fights for XP & loot. area = wander circle. need = node that must be unlocked first.
const SKIRMISHES = [
  { id: 'sk_harbor', enc: 'sk_crate', img: 'en_crate', x: 1700, y: 2330, area: 150, h: 120 },
  { id: 'sk_town', enc: 'sk_paper', img: '_invoice', x: 2420, y: 1960, area: 200, h: 90, need: 'warehouse' },
  { id: 'sk_forest1', enc: 'sk_barrels', img: 'en_barrel', x: 3300, y: 2350, area: 220, h: 120, need: 'road' },
  { id: 'sk_forest2', enc: 'sk_smuggler', img: 'smuggler', x: 3150, y: 1250, area: 220, h: 150, need: 'road' },
  { id: 'sk_east', enc: 'sk_nets', img: 'en_nets', x: 4600, y: 2200, area: 200, h: 120 },
];

// Hidden caches: sparkle on the ground, walk over to collect once.
const CACHES = [
  { id: 'c_barn', x: 1840, y: 1060, reward: { tea: 1 } },          // "behind the barn" (Little Ulf hints at it)
  { id: 'c_beach', x: 1500, y: 2700, reward: { herring: 1 } },
  { id: 'c_reeds', x: 860, y: 1100, reward: { ink: 1 } },
  { id: 'c_forest', x: 3460, y: 2700, reward: { mead: 1 } },
  { id: 'c_north', x: 2700, y: 700, reward: { rune: 1 } },
  { id: 'c_east', x: 4550, y: 2700, reward: { tea: 1, mead: 1 } },
];

// skirmish encounters (small optional fights)
Object.assign(ENCOUNTERS, {
  sk_crate: { par: 3, title: 'Loose Cargo', bg: 'bg_docks', amb: 'embers', enemies: ['crate'], xp: 18, drops: { herring: 1 } },
  sk_paper: { par: 3, title: 'Stray Paperwork', bg: 'bg_night', amb: 'snow', enemies: ['manifest'], xp: 25, drops: { ink: 1 } },
  sk_barrels: { par: 4, title: 'Runaway Barrels', bg: 'bg_forest', amb: 'leaves', enemies: ['barrel', 'barrel'], xp: 40, drops: { mead: 1 } },
  sk_smuggler: { par: 4, title: 'A Lone Smuggler', bg: 'bg_forest', amb: 'leaves', enemies: ['smuggler'], xp: 45, drops: { tea: 1 } },
  sk_nets: { par: 4, title: 'Washed Ashore', bg: 'bg_docks', amb: 'embers', enemies: ['nets', 'crate'], xp: 50, drops: { rune: 1 } },
});
Object.assign(SPEAKERS, {
  haldor: { name: 'Old Haldor', side: 'right', emblem: ['H', '#3a3f48', '#14161a', 'ᚺ'] },
  bjarni: { name: 'Bjarni the Axe-Master', side: 'right', emblem: ['B', '#5a3a14', '#24160a', 'ᛒ'] },
  ulf: { name: 'Little Ulf', side: 'right', emblem: ['U', '#2a4a5a', '#0c1a24', 'ᚢ'] },
});
for (const p of ['stilt_house', 'cottage', 'barn', 'workshop', 'fish_shed', 'rowboat_water', 'fishing_boat', 'pier', 'well', 'willow', 'oak', 'pines',
  'fish_rack', 'crate_barrel', 'canoe_sand', 'crates', 'handcart', 'ladder_wood', 'stone_wall', 'canoe_sand2', 'bridge', 'nets', 'hearth',
  'sampan', 'willow2', 'oak2', 'pine2', 'reeds', 'bonsai', 'grass1', 'grass2']) IMAGES['w_' + p] = `assets/world/${p}.png`;

// The Drunken Goat mead hall (interactive tavern: Darrell, Thomas & Nichole)
const MEAD_HALL = { p: 'stilt_house', x: 1960, y: 1330, h: 360, r: 120, ix: 1990, iy: 1420 };
Object.assign(SPEAKERS, {
  darrell: { name: 'Darrell, The Boss', side: 'right', portrait: 'p_darrell' },
  thomas: { name: 'Thomas, VP of Operations', side: 'right', portrait: 'p_thomas' },
  nichole: { name: 'Nichole, Office Manager', side: 'right', portrait: 'p_nichole' },
});
for (const n of ['maiden1', 'maiden2', 'maiden3', 'maiden4', 'barmaid']) { IMAGES['npc_' + n] = `assets/sprites/npc_${n}.png`; IMAGES['p_' + n] = `assets/portraits/${n}.jpg`; }
Object.assign(SPEAKERS, {
  maiden1: { name: 'Astrid the Shieldmaiden', side: 'right', portrait: 'p_maiden1' },
  maiden2: { name: 'Sigrid of the Winged Helm', side: 'right', portrait: 'p_maiden2' },
  maiden3: { name: 'Freydis Two-Axes', side: 'right', portrait: 'p_maiden3' },
  maiden4: { name: 'Runa the Archer', side: 'right', portrait: 'p_maiden4' },
  barmaid: { name: 'Brynja the Barmaid', side: 'right', portrait: 'p_barmaid' },
});
for (const n of ['darrell', 'thomas', 'nichole']) { IMAGES['npc_' + n] = `assets/sprites/npc_${n}.png`; IMAGES['p_' + n] = `assets/portraits/${n}.jpg`; }
IMAGES.eric_side = 'assets/sprites/eric_side.png';

// Dragon Ridge: a scorched clearing in the north woods (Darrell's "Close the SQI" order plays cut_dragon.mp4 here)
const DRAGON_RIDGE = { x: 2420, y: 520, ix: 2380, iy: 590 };
// v3.1: rig parts for the walk cycle (tools/rig/rig_eric.py) and tile-free trees (tools/rig/untile_trees.py)
for (const r of ['front', 'back', 'q34', 'sven_front', 'smuggler_q34'])
  for (const k of ['body', 'armL', 'armR', 'legL', 'legR']) IMAGES[`rig_${r}_${k}`] = `assets/sprites/rig/${r}_${k}.png`;
for (const t of ['pines', 'pine2', 'oak', 'willow', 'willow2']) IMAGES['t_' + t] = `assets/world/t_${t}.png`;
// props with their diorama grass island dissolved (tools/rig/blend_bases.py): preferred over w_* when present
for (const p of ['barn', 'cottage', 'stilt_house', 'workshop', 'fish_shed', 'well', 'hearth', 'crates', 'crate_barrel', 'handcart',
  'fish_rack', 'nets', 'ladder_wood', 'stone_wall', 'canoe_sand', 'canoe_sand2', 'bonsai', 'shrub', 'oak2']) IMAGES['b_' + p] = `assets/world/b_${p}.png`;

// Brynja the barmaid (Drunken Goat + the finale tavern): greets Eric whenever he's in a tavern.
const BRYNJA_HI = [
  "Eric! There's my favourite customer. Your usual seat is still warm.",
  "Well hello, Red. I saved the good mead for you. Don't tell Thomas.",
  "Look who walked in! Handsome, bearded and exhausted. My type.",
  "Eric! Sit, sit. Whatever Darrell gave you today, the first horn's on me.",
];
const BRYNJA_TALK = [
  [{ s: 'barmaid', t: "Long day, sweetheart? You've got 'dispatcher' written all over that frown." }, { s: 'eric', m: 'calm', t: 'Darrell sent me after a dragon. Over a survey.' }, { s: 'barmaid', t: 'Then you deserve a horn of mead and a girl who doesn\'t send you anywhere. Here.' }],
  [{ s: 'barmaid', t: "I keep a tally of everyone who makes me smile in this hall. You're the whole list, Eric." }, { s: 'eric', m: 'smirk', t: 'And Thomas?' }, { s: 'barmaid', t: "Thomas makes me check the till twice. Huh?" }],
  [{ s: 'barmaid', t: 'Careful with the tray, I just had these mugs polished. Unlike that beard. Which is perfect.' }, { s: 'eric', m: 'smirk', t: "It's regulation length." }, { s: 'barmaid', t: 'Mm-hmm. I checked.' }],
];
