'use strict';
// ============================================================================
//  DATA — stats, skills, items, enemies, encounters, map, dialogue
// ============================================================================

const IMAGES = {
  eric: 'assets/sprites/eric_q34.png',
  eric_front: 'assets/sprites/eric_front.png',
  eric_back: 'assets/sprites/eric_back.png',
  wolf: 'assets/sprites/wolf.png',          // WolfZtnel (cut from source_art/Character/Character_Wolfztnel.jpg)
  wolf_noL: 'assets/sprites/wolf_noL.png',
  wolf_noR: 'assets/sprites/wolf_noR.png',
  wolf_armL: 'assets/sprites/wolf_armL.png',
  wolf_armR: 'assets/sprites/wolf_armR.png',
  eric_noR: 'assets/sprites/eric_noR.png',
  eric_armR: 'assets/sprites/eric_armR.png',
  wolf_tag: 'assets/ui/wolf_tag.png',
  bg_tavern: 'assets/bg/tavern.jpg',
  smuggler: 'assets/sprites/smuggler.png',
  sven: 'assets/sprites/sven.png',
  en_crate: 'assets/sprites/en_crate.png',
  en_barrel: 'assets/sprites/en_barrel.png',
  en_cart: 'assets/sprites/en_cart.png',
  en_nets: 'assets/sprites/en_nets.png',
  en_oak: 'assets/sprites/en_oak.png',
  p_calm: 'assets/portraits/eric_calm.jpg',
  p_shout: 'assets/portraits/eric_shout.jpg',
  p_smirk: 'assets/portraits/eric_smirk.jpg',
  p_fury: 'assets/portraits/eric_fury.jpg',
  bg_docks: 'assets/bg/docks.jpg',
  bg_forest: 'assets/bg/forest.jpg',
  bg_night: 'assets/bg/night.jpg',
  bg_storm: 'assets/bg/storm.jpg',
  bg_map: 'assets/bg/map.jpg',
  bg_hall: 'assets/bg/hall.jpg',
  kraken_head: 'assets/sprites/kraken_head.png',
  kraken_tentacle: 'assets/sprites/kraken_tentacle.png',
  p_sven: 'assets/portraits/sven.jpg',
};
for (const p of ['stilt_house', 'cottage', 'barn', 'workshop', 'fish_shed', 'rowboat_water', 'fishing_boat', 'pier', 'well', 'willow', 'oak', 'pines',
  'fish_rack', 'crate_barrel', 'canoe_sand', 'crates', 'handcart', 'ladder_wood', 'stone_wall', 'canoe_sand2', 'bridge', 'nets', 'hearth',
  'small_rowboat', 'sampan', 'willow2', 'oak2', 'pine2', 'reeds', 'bonsai', 'shrub', 'grass1', 'grass2', 'grass3']) IMAGES['prop_' + p] = `assets/props/${p}.png`;

// ---------------------------------------------------------------- player
const MAX_LEVEL = 6;
function statsFor(L) {
  return { maxHp: 110 + 30 * (L - 1), maxFocus: 40 + 10 * (L - 1), atk: 18 + 6 * (L - 1), wit: 17 + 6 * (L - 1) };
}
const xpToNext = L => 40 * L;
function newPlayer() {
  const s = statsFor(1);
  return {
    level: 1, xp: 0, hp: s.maxHp, focus: s.maxFocus, madness: 0,
    items: { mead: 2, herring: 1, ink: 1 },
    tally: { chopped: 0, filed: 0, furies: 0, blocks: 0, perfect: 0 },
  };
}

// ---------------------------------------------------------------- skills
// kind: 'axe' or 'paper'. qte: 'ring' | 'bar' | null
const SKILLS = {
  chop: { name: 'Chop', kind: 'axe', lvl: 1, focus: 0, mad: -8, power: 1.0, target: 'one', qte: 'ring', speed: 1.0,
    desc: 'A good honest axe swing. Soothing. Lowers Madness.' },
  whirl: { name: 'Whirling Axes', kind: 'axe', lvl: 2, focus: 10, mad: -10, power: 0.7, target: 'all', qte: 'ring', speed: 1.0,
    desc: 'Spin with both axes and hit every problem at once.' },
  verdict: { name: "Lumberjack's Verdict", kind: 'axe', lvl: 4, focus: 14, mad: -16, power: 2.0, target: 'one', qte: 'ring', speed: 1.35,
    desc: 'An overhead double-axe slam. Faster timing ring.' },
  stamp: { name: 'Stamp of Rejection', kind: 'paper', lvl: 1, focus: 5, mad: 12, power: 1.15, target: 'one', qte: 'bar',
    desc: 'REJECTED. Crushing vs. paperwork. Raises Madness.' },
  inspect: { name: 'Quality Inspection', kind: 'paper', lvl: 1, focus: 4, mad: 6, power: 0.35, target: 'one', qte: null,
    desc: 'Flag a target: it takes +40% damage for 3 turns. Reveals its weakness.' },
  claim: { name: 'File a Claim', kind: 'paper', lvl: 1, focus: 10, mad: 16, power: 0, target: 'self', qte: 'bar',
    desc: 'Insurance payout! Restores HP. Paperwork raises Madness.' },
  reconcile: { name: 'Reconcile the Ledger', kind: 'paper', lvl: 3, focus: 16, mad: 22, power: 1.3, target: 'all', qte: 'bar',
    desc: 'Balance the books against every enemy. Devastating vs. paperwork.' },
};
const AXE_SKILLS = ['chop', 'whirl', 'verdict'];
const PAPER_SKILLS = ['stamp', 'inspect', 'claim', 'reconcile'];
const UNLOCKS = { 2: 'Whirling Axes', 3: 'Reconcile the Ledger', 4: "Lumberjack's Verdict" };

// type multipliers: [axe, paper]
const TYPE_MOD = {
  cargo: { axe: 1.2, paper: 1.0, label: 'Cargo', weak: 'Axes (a little)' },
  rope: { axe: 1.5, paper: 0.6, label: 'Rope', weak: 'Axes' },
  tree: { axe: 1.6, paper: 0.5, label: 'Timber', weak: 'Axes' },
  paper: { axe: 0.5, paper: 1.7, label: 'Paperwork', weak: 'Paperwork (axes just make copies!)' },
  people: { axe: 1.0, paper: 1.25, label: 'Person', weak: 'Paperwork (bureaucracy hurts)' },
  tentacle: { axe: 1.5, paper: 0.6, label: 'Tentacle', weak: 'Axes' },
  kraken: { axe: 0.8, paper: 1.6, label: 'Eldritch Backorder', weak: 'Paperwork — CANCEL THE ORDER' },
};

// ---------------------------------------------------------------- items
const ITEMS = {
  mead: { name: 'Horn of Mead', desc: 'Restores 70 HP and calms 15 Madness.', hp: 70, mad: -15 },
  herring: { name: 'Smoked Herring', desc: 'Restores 45 HP. Smells like victory.', hp: 45 },
  ink: { name: 'Ink & Quill', desc: 'Restores 25 Focus.', focus: 25 },
  tea: { name: 'Pine-Needle Tea', desc: 'Calms 45 Madness. Very Zen. Very bitter.', mad: -45 },
  rune: { name: 'Berserker Rune', desc: 'Adds 50 Madness. For emergencies.', mad: 50 },
};

// ---------------------------------------------------------------- enemies
const ENEMIES = {
  crate: {
    name: 'Damaged Crate', type: 'cargo', draw: 'sprite', img: 'en_crate', h: 230, hp: 46, atk: 9, xp: 15, idle: 'hop',
    eyes: { x1: 0.31, y1: 0.40, x2: 0.47, y2: 0.40, s: 13, glow: 'rgba(255,170,60,1)' },
    moves: [
      { name: 'Splinter Spray', w: 3, dmg: 1.0, fx: 'proj', proj: 'splinter' },
      { name: 'Spills Its Contents', w: 2, dmg: 0.5, mad: 12, fx: 'lunge', line: 'Quality issue!' },
    ],
    info: 'Water-damaged, splintered, and furious about it. Shipped from Hedeby. Signed for by nobody.',
  },
  barrel: {
    name: 'Leaky Mead Barrel', type: 'cargo', draw: 'sprite', img: 'en_barrel', h: 210, hp: 58, atk: 10, xp: 18, idle: 'wobble',
    eyes: { x1: 0.36, y1: 0.46, x2: 0.62, y2: 0.46, s: 12, glow: 'rgba(255,200,60,1)' },
    moves: [
      { name: 'Barrel Roll', w: 3, dmg: 1.1, fx: 'roll' },
      { name: 'Leaks Mead Everywhere', w: 2, dmg: 0.3, mad: 15, fx: 'proj', proj: 'mead', line: 'Wasted mead!' },
    ],
    info: 'Forty barrels were ordered. This one has opinions.',
  },
  nets: {
    name: 'Tangled Net', type: 'rope', draw: 'sprite', img: 'en_nets', h: 240, hp: 72, atk: 8, xp: 20, idle: 'sway',
    eyes: { x1: 0.54, y1: 0.46, x2: 0.68, y2: 0.48, s: 12, glow: 'rgba(120,255,220,1)' },
    moves: [
      { name: 'Entangle', w: 3, dmg: 0.9, mad: 8, fx: 'lunge' },
      { name: 'Knots Itself Again', w: 2, heal: 0.18, mad: 10, fx: 'self', line: 'It re-knotted itself!' },
    ],
    info: 'A fishing net so knotted it achieved sentience. Ropes. Need. Chopping.',
  },
  manifest: {
    name: 'Missing Manifest', type: 'paper', draw: 'paper', sheet: 'manifest', h: 190, hp: 56, atk: 7, xp: 20, idle: 'float', copies: true,
    moves: [
      { name: 'Demands a Signature', w: 3, dmg: 0.2, mad: 18, fx: 'proj', proj: 'paper', line: 'Sign here. And here. And here.' },
      { name: 'Paper Cut', w: 2, dmg: 1.1, fx: 'lunge' },
    ],
    info: 'Lists cargo that does not exist, and omits cargo that does. Chopping it only makes copies.',
  },
  triplicate: {
    name: 'Form in Triplicate', type: 'paper', draw: 'paper', sheet: 'triplicate', h: 220, hp: 84, atk: 8, xp: 26, idle: 'float', copies: true,
    moves: [
      { name: 'Red Tape', w: 3, dmg: 0.35, mad: 20, fx: 'proj', proj: 'paper', line: 'Please resubmit.' },
      { name: 'Bureaucratic Slam', w: 2, dmg: 1.2, fx: 'lunge' },
    ],
    info: 'Three copies: white, yellow, pink. All wrong. Weak to proper paperwork.',
  },
  duplicate: {
    name: 'Duplicate Form', type: 'paper', draw: 'paper', sheet: 'duplicate', h: 140, hp: 26, atk: 6, xp: 6, idle: 'float', copies: false,
    moves: [{ name: 'Needless Copy', w: 1, dmg: 0.6, mad: 10, fx: 'proj', proj: 'paper' }],
    info: 'An unnecessary copy of an unnecessary form.',
  },
  oak: {
    name: 'Obstinate Oak', type: 'tree', draw: 'sprite', img: 'en_oak', h: 470, hp: 150, atk: 14, xp: 45, idle: 'tree',
    eyes: { x1: 0.43, y1: 0.42, x2: 0.60, y2: 0.42, s: 10, glow: 'rgba(200,255,120,0.55)' },
    moves: [
      { name: 'Branch Slam', w: 3, dmg: 1.15, fx: 'slam' },
      { name: 'Blocks the Road', w: 2, dmg: 0.5, mad: 14, fx: 'slam', line: 'Delivery delayed!' },
    ],
    info: 'Fell across the Forest Road. Refuses to move. Has never met an axe it liked.',
  },
  cart: {
    name: 'Runaway Handcart', type: 'cargo', draw: 'sprite', img: 'en_cart', h: 220, hp: 82, atk: 15, xp: 40, idle: 'rock',
    eyes: { x1: 0.40, y1: 0.44, x2: 0.52, y2: 0.40, s: 12, glow: 'rgba(255,120,60,1)' },
    moves: [
      { name: 'Ram', w: 3, dmg: 1.25, fx: 'roll' },
      { name: 'Dumps the Load', w: 1, dmg: 0.5, mad: 14, fx: 'proj', proj: 'crate', line: 'Cargo everywhere!' },
    ],
    info: 'Loaded with the Jarl\'s cod. Rolling downhill. Toward you.',
  },
  smuggler: {
    name: 'Fjord Smuggler', type: 'people', draw: 'person', img: 'smuggler', h: 560, hp: 78, atk: 13, xp: 30, idle: 'breathe',
    moves: [
      { name: 'Shiv', w: 3, dmg: 1.1, fx: 'lunge' },
      { name: 'Pilfer', w: 2, dmg: 0.5, steal: true, fx: 'lunge', line: 'Hey! That\'s inventory!' },
      { name: 'Forged Receipt', w: 1, dmg: 0.2, mad: 16, fx: 'proj', proj: 'paper' },
    ],
    info: 'Moves untaxed goods by night. Owns no paperwork whatsoever. Disgusting.',
  },
  sven: {
    name: 'Cousin Sven Strawbeard', type: 'people', draw: 'person', img: 'sven', h: 600, hp: 330, atk: 16, xp: 130, idle: 'breathe', boss: true,
    moves: [
      { name: 'Red Tape', w: 3, dmg: 0.3, mad: 22, fx: 'proj', proj: 'paper', line: 'Form 27-B. Notarized. By a goat.' },
      { name: 'Audit', w: 3, dmg: 1.0, audit: true, fx: 'lunge', line: 'Your madness is... noted.' },
      { name: 'Axe of Superior Logistics', w: 2, dmg: 1.4, fx: 'lunge' },
      { name: 'Counter-Signed', w: 1, heal: 0.14, fx: 'self', line: 'Approved. By me. For me.' },
    ],
    info: 'Eric\'s cousin. Quartermaster (Superior), self-titled. Weak to paperwork — he hates being out-filed.',
  },
  tentacle: {
    name: 'Tentacle of Backorders', type: 'tentacle', draw: 'tentacle', h: 480, hp: 140, atk: 13, xp: 30, idle: 'none',
    moves: [
      { name: 'Slam', w: 3, dmg: 1.2, fx: 'tentacle' },
      { name: 'Return to Sender', w: 2, dmg: 1.0, fx: 'proj', proj: 'crate' },
      { name: 'Squeeze', w: 1, dmg: 0.7, mad: 14, fx: 'tentacle', line: 'Out of stock!' },
    ],
    info: 'Each tentacle clutches an unpaid invoice. They shield the Kraken. Chop them!',
  },
  kraken: {
    name: 'The Backorder Kraken', type: 'kraken', draw: 'kraken', h: 600, hp: 560, atk: 18, xp: 0, idle: 'none', boss: true, shielded: true,
    moves: [
      { name: 'Inked Invoice', w: 3, dmg: 0.8, mad: 18, fx: 'proj', proj: 'ink', line: 'PAYMENT... OVERDUE...' },
      { name: 'Tidal Delay', w: 2, dmg: 1.35, fx: 'wave', line: 'YOUR SHIPMENT... IS LATE...' },
      { name: 'Endless Hold Music', w: 1, dmg: 0, mad: 26, fx: 'self', line: '...your call is important to us...' },
    ],
    info: 'An eldritch horror made of every delayed order in history. Shielded while its tentacles stand.',
  },
};

// ---------------------------------------------------------------- encounters
const ENCOUNTERS = {
  docks: { title: 'Quality Control', bg: 'bg_docks', amb: 'embers', enemies: ['crate', 'crate'], xp: 30, drops: { herring: 1 } },
  boat: { title: 'The Leaky Longboat', bg: 'bg_docks', amb: 'embers', enemies: ['nets', 'barrel'], xp: 45, drops: { mead: 1 } },
  warehouse: { title: 'The Living Paperwork', bg: 'bg_night', amb: 'snow', enemies: ['manifest', 'triplicate'], xp: 60, drops: { ink: 2 } },
  road: { title: 'The Forest Road', bg: 'bg_forest', amb: 'leaves', enemies: ['oak', 'cart'], xp: 90, drops: { mead: 1, tea: 1 } },
  woodpile: { title: 'Smugglers!', bg: 'bg_forest', amb: 'leaves', enemies: ['smuggler', 'crate', 'smuggler'], xp: 95, drops: { herring: 2, rune: 1 } },
  bridge: { title: 'The Toll Bridge', bg: 'bg_night', amb: 'snow', enemies: ['manifest', 'sven'], xp: 150, drops: { mead: 2, ink: 1 }, boss: true },
  fjord: { title: 'The Backorder Kraken', bg: 'bg_storm', amb: 'storm', enemies: ['tentacle', 'kraken', 'tentacle'], xp: 0, drops: {}, boss: true, final: true, kraken: true },
};

// ---------------------------------------------------------------- dialogue
// speakers: eric (with mood), gunnhild, sven, jarl, kraken, narr, tip, decree
const SPEAKERS = {
  eric: { name: 'Eric Da Red', side: 'left' },
  sven: { name: 'Cousin Sven', side: 'right' },
  gunnhild: { name: 'Gunnhild, Harbormaster', side: 'right', emblem: ['G', '#24435a', '#0c1a24', 'ᚷ'] },
  jarl: { name: 'Jarl Bjorn the Thirsty', side: 'right', emblem: ['J', '#5a2424', '#240c0c', 'ᛃ'] },
  kraken: { name: 'The Backorder Kraken', side: 'right', emblem: ['K', '#3a1a4a', '#12061a', '◉'] },
  olaf: { name: 'Olaf the Dockhand', side: 'right', emblem: ['O', '#3a4a24', '#141a0c', 'ᛟ'] },
  crowd: { name: 'The Whole Tavern', side: 'right', emblem: ['!', '#5a3a14', '#24160a', 'ᛋ'] },
  growl: { name: '???', side: 'right', emblem: ['?', '#1a1a1a', '#050505', 'ᚹ'] },
  wolf: { name: 'WolfZtnel', side: 'right', portrait: 'wolf_tag' },
};

const SCRIPTS = {
  intro: [
    { s: 'narr', t: 'Fjordheim. Three days before the Midwinter Feast.' },
    { s: 'decree', t: 'By order of JARL BJORN THE THIRSTY:\n\nForty (40) barrels of mead, two hundred (200) salted cod, and one (1) ceremonial GOLDEN GOAT shall arrive at the Great Hall before the Feast.\n\nResponsibility: the Quartermaster.' },
    { s: 'eric', m: 'calm', t: 'Forty barrels. Two hundred cod. One goat. Simple.' },
    { s: 'eric', m: 'shout', t: 'Nothing is EVER simple.' },
    { s: 'eric', m: 'smirk', t: 'Ledger on my belt. Quill behind my ear. Axes on my back. Let\'s ship it.' },
    { s: 'tip', t: 'PAPERWORK solves problems properly — but every form pushes Eric\'s MADNESS higher.\n\nAXES relieve the madness. Swinging them is very therapeutic.\n\nWhen Madness hits 100, unleash RED FURY.' },
  ],
  docks_pre: [
    { s: 'gunnhild', t: 'Eric! The shipment from Hedeby arrived. Mostly.' },
    { s: 'eric', m: 'calm', t: '"Mostly."' },
    { s: 'gunnhild', t: 'The crates are... unhappy. Splintered. Water-damaged. One of them bit Olaf.' },
    { s: 'eric', m: 'shout', t: 'Who SIGNED for these?! ...Fine. Quality inspection. Eric style.' },
    { s: 'tip', t: 'When the timing ring closes on the golden circle, press SPACE (or click) for a PERFECT hit.\n\nWhen an enemy attacks, press SPACE right as the  !  appears to BLOCK half the damage.' },
  ],
  docks_post: [
    { s: 'eric', m: 'smirk', t: 'Inspected. Rejected. Reclassified as firewood.' },
    { s: 'olaf', t: 'Uh, boss? The cod\'s on the longboat. And the longboat is... sinking.' },
  ],
  boat_pre: [
    { s: 'gunnhild', t: 'The nets are knotted so badly the boat is going under — and the mead barrels have sprung leaks!' },
    { s: 'eric', m: 'shout', t: 'Leaking MEAD? That\'s not a quality issue. That\'s a CRIME.' },
  ],
  boat_post: [
    { s: 'eric', m: 'calm', t: 'Two hundred cod, accounted for. One hundred ninety-eight. Olaf ate two.' },
    { s: 'eric', m: 'smirk', t: 'I\'ll file the variance. Now — the golden goat should be in the Royal Warehouse. Bay Seven.' },
  ],
  warehouse_pre: [
    { s: 'narr', t: 'The Royal Warehouse. Night falls. Snow begins.' },
    { s: 'eric', m: 'calm', t: 'The manifest says the goat is in Bay Seven. Bay Seven says it never received the manifest.' },
    { s: 'eric', m: 'calm', t: 'And the manifest is... floating. Glaring at me.' },
    { s: 'eric', m: 'shout', t: 'The paperwork is ALIVE. Of course it is.' },
    { s: 'tip', t: 'Paperwork shrugs off axes — chopping it just makes COPIES.\n\nFight forms with forms: use the PAPERWORK menu. Try Quality Inspection first to flag a target for extra damage.' },
  ],
  warehouse_post: [
    { s: 'eric', m: 'calm', t: 'Reconciled. Signed. Filed. Cross-referenced.' },
    { s: 'eric', m: 'shout', t: 'My eye is twitching. Bay Seven is EMPTY. The goat\'s been moved by cart up the Forest Road.' },
  ],
  lostcargo: [
    { s: 'narr', t: 'Behind the warehouse sits a "Lost & Found" pile, unclaimed for three winters.' },
    { s: 'eric', m: 'smirk', t: 'Finders, quartermasters.' },
  ],
  workshop: [
    { s: 'narr', t: 'Eric\'s workshop. He sharpens his axes, refills his ink, and drinks something that is not mead.' },
    { s: 'eric', m: 'calm', t: 'Deep breaths. Inventory is a state of mind.' },
  ],
  workshop_again: [
    { s: 'narr', t: 'Eric rests at the workshop. HP, Focus and composure restored.' },
  ],
  road_pre: [
    { s: 'narr', t: 'The Forest Road to the Great Hall.' },
    { s: 'eric', m: 'calm', t: 'A tree. Across the road. And the cart with the Jarl\'s cod is rolling downhill... on its own.' },
    { s: 'eric', m: 'fury', t: 'Some problems need a form. These need an AXE.' },
  ],
  road_post: [
    { s: 'eric', m: 'smirk', t: 'Road cleared. Timber invoiced to the Jarl. Never waste a fallen tree.' },
    { s: 'eric', m: 'calm', t: 'But the goat crate isn\'t on the cart. Wheel tracks lead into the woods... toward that woodpile.' },
  ],
  well: [
    { s: 'narr', t: 'The Old Wishing Well. Eric tosses in a silver coin and wishes for an organized supply chain.' },
    { s: 'narr', t: 'The well gurgles sympathetically. Something floats up.' },
  ],
  woodpile_pre: [
    { s: 'eric', m: 'calm', t: 'Smugglers. Hiding behind the woodpile. Wearing my goat crate as a TABLE.' },
    { s: 'eric', m: 'shout', t: 'That is Jarl property! Unstamped! Untaxed! And UNWISE!' },
  ],
  woodpile_post: [
    { s: 'eric', m: 'smirk', t: 'Golden goat recovered. Slightly scuffed. I\'ll log it under "acceptable wear."' },
  ],
  camp: [
    { s: 'narr', t: 'A campfire by the road. Eric rests his feet and his nerves.' },
    { s: 'narr', t: 'A fresh sign is nailed to a tree: "TOLL BRIDGE — NOW UNDER NEW MANAGEMENT. S. Strawbeard, Quartermaster (Superior)."' },
    { s: 'eric', m: 'shout', t: 'SVEN.' },
  ],
  camp_again: [
    { s: 'narr', t: 'Eric rests by the fire. HP, Focus and composure restored.' },
  ],
  bridge_pre: [
    { s: 'sven', t: 'Well, well. Cousin Eric "Da Red." Your paperwork is NOT in order.' },
    { s: 'eric', m: 'calm', t: 'My paperwork is ALWAYS in order.' },
    { s: 'sven', t: 'Form 27-B: Cargo Crossing Permit. In triplicate. Notarized by a goat.' },
    { s: 'eric', m: 'smirk', t: '...I have a goat.' },
    { s: 'sven', t: 'A GOLDEN goat doesn\'t count. Toll is ten barrels of mead.' },
    { s: 'eric', m: 'fury', t: 'I also have two axes.' },
  ],
  bridge_post: [
    { s: 'sven', t: 'Fine! FINE! Cross! But the fjord crossing is worse than my bridge...' },
    { s: 'sven', t: 'Something\'s been eating the shipping lanes. Something with... backorders.' },
    { s: 'eric', m: 'calm', t: 'Every quartermaster\'s nightmare.' },
  ],
  fjord_pre: [
    { s: 'narr', t: 'At the mouth of the fjord the sea boils. Tentacles rise, each clutching an unpaid invoice.' },
    { s: 'kraken', t: 'RETURNS... REFUNDS... BACKORDERS...' },
    { s: 'kraken', t: 'YOUR SHIPMENT... HAS BEEN DELAYED... INDEFINITELY.' },
    { s: 'eric', m: 'fury', t: 'No. My shipments arrive ON TIME.' },
    { s: 'tip', t: 'The Kraken is SHIELDED while its tentacles stand. Chop the tentacles with AXES...\n\n...then CANCEL ITS ORDER with PAPERWORK.' },
  ],
  tavern_cheers: [
    { s: 'narr', t: 'Later that night. The Drunken Goat tavern.' },
    { s: 'olaf', t: 'To ERIC DA RED! Forty barrels! Two hundred cod!' },
    { s: 'gunnhild', t: '...minus two.' },
    { s: 'olaf', t: 'And one GOLDEN GOAT! On TIME!' },
    { s: 'crowd', m: 'shout', t: 'SKÅL!!!' },
    { s: 'gunnhild', t: 'I’ve never seen a kraken cancelled in triplicate before. Masterful work, quartermaster.' },
    { s: 'jarl', t: 'Best quartermaster in the North! Eat! Drink! It’s all on the Jarl!' },
    { s: 'eric', m: 'smirk', t: 'Just doing my job.' },
    { s: 'eric', m: 'calm', t: 'Although... all that chopping does work up an appetite.' },
  ],
  tavern_growl: [
    { s: 'growl', m: 'shout', t: 'The Apples are MINE!' },
  ],
  tavern_reveal: [
    { s: 'wolf', m: 'shout', t: 'Nobody touches the apples, little red man.' },
    { s: 'eric', m: 'calm', t: '...It’s ONE apple—' },
  ],
  tavern_toast: [
    { s: 'wolf', m: 'shout', t: 'HAHAHAHA! SKÅL! To Eric Da Red — finest quartermaster in the North!' },
    { s: 'crowd', m: 'shout', t: 'SKÅL!!!' },
    { s: 'wolf', t: '...and to MY apples.' },
    { s: 'eric', m: 'fury', t: '(from under a table) Note to self. File a complaint. In TRIPLICATE.' },
  ],
  ending: [
    { s: 'narr', t: 'The Great Hall. Midwinter Feast. Right on time.' },
    { s: 'jarl', t: 'Forty barrels of mead! Two hundred cod — minus two! And the GOLDEN GOAT!' },
    { s: 'eric', m: 'smirk', t: 'Signed. Stamped. Delivered.' },
    { s: 'jarl', t: 'Splendid! Next week I\'m ordering an ELEPHANT. From Miklagard.' },
    { s: 'eric', m: 'calm', t: '...' },
    { s: 'eric', m: 'shout', t: 'I\'m going to need a bigger axe.' },
  ],
};

// ---------------------------------------------------------------- world map
// type: story | battle | rest | treasure
const NODES = [
  { id: 'home', name: "Eric's Cottage", prop: 'cottage', x: 230, y: 905, h: 200, type: 'story', script: 'intro', links: ['docks'],
    blurb: 'Home. Ledgers, axes, and a decree from the Jarl.' },
  { id: 'docks', name: 'Harbor Docks', prop: 'pier', x: 520, y: 790, h: 130, type: 'battle', enc: 'docks', links: ['boat'],
    chapter: ['CHAPTER I', 'The Harbor'], blurb: 'The Hedeby shipment has arrived. Mostly.' },
  { id: 'boat', name: 'The Leaky Longboat', prop: 'fishing_boat', x: 300, y: 600, h: 200, type: 'battle', enc: 'boat', links: ['warehouse'],
    blurb: 'Two hundred cod. Sinking.' },
  { id: 'warehouse', name: 'Royal Warehouse', prop: 'barn', x: 600, y: 455, h: 180, type: 'battle', enc: 'warehouse', links: ['lostcargo', 'workshop'],
    chapter: ['CHAPTER II', 'The Paper Trail'], blurb: 'Bay Seven. The golden goat should be here.' },
  { id: 'lostcargo', name: 'Lost & Found', prop: 'crate_barrel', x: 370, y: 380, h: 115, type: 'treasure', script: 'lostcargo', optional: true, links: [],
    reward: { mead: 1, ink: 1, tea: 1 }, blurb: 'Unclaimed cargo. Optional.' },
  { id: 'workshop', name: "Quartermaster's Workshop", prop: 'workshop', x: 880, y: 560, h: 175, type: 'rest', script: 'workshop', again: 'workshop_again', links: ['road'],
    reward: { mead: 1, herring: 1 }, blurb: 'Rest: restore HP, Focus and calm.' },
  { id: 'road', name: 'Forest Road', prop: 'oak2', x: 1110, y: 830, h: 210, type: 'battle', enc: 'road', links: ['well', 'woodpile'],
    chapter: ['CHAPTER III', 'Timber & Thieves'], blurb: 'The road to the Great Hall. Blocked.' },
  { id: 'well', name: 'Old Wishing Well', prop: 'well', x: 860, y: 980, h: 130, type: 'treasure', script: 'well', optional: true, links: [],
    reward: { tea: 1, rune: 1, mead: 1 }, heal: true, blurb: 'Make a wish. Optional.' },
  { id: 'woodpile', name: "Smugglers' Woodpile", prop: 'ladder_wood', x: 1400, y: 720, h: 130, type: 'battle', enc: 'woodpile', links: ['camp'],
    blurb: 'Wheel tracks lead here.' },
  { id: 'camp', name: 'Roadside Campfire', prop: 'hearth', x: 1260, y: 470, h: 130, type: 'rest', script: 'camp', again: 'camp_again', links: ['bridge'],
    reward: { herring: 1 }, blurb: 'Rest: restore HP, Focus and calm.' },
  { id: 'bridge', name: 'The Toll Bridge', prop: 'bridge', x: 1540, y: 330, h: 125, type: 'battle', enc: 'bridge', links: ['fjord'],
    chapter: ['CHAPTER IV', 'Toll & Trouble'], blurb: 'Under new management.' },
  { id: 'fjord', name: 'Mouth of the Fjord', prop: 'sampan', x: 1730, y: 640, h: 230, type: 'battle', enc: 'fjord', links: [],
    chapter: ['FINAL CHAPTER', 'The Backorder Kraken'], blurb: 'The last crossing to the Great Hall.' },
];
const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
const DECOR = [
  { prop: 'willow2', x: 790, y: 300, h: 160 }, { prop: 'pines', x: 1010, y: 340, h: 180 }, { prop: 'fish_shed', x: 560, y: 1060, h: 130 },
  { prop: 'rowboat_water', x: 110, y: 730, h: 70 }, { prop: 'reeds', x: 700, y: 940, h: 95 }, { prop: 'stone_wall', x: 1310, y: 1010, h: 70 },
  { prop: 'willow', x: 1870, y: 450, h: 170 }, { prop: 'pine2', x: 1620, y: 520, h: 150 }, { prop: 'shrub', x: 1010, y: 700, h: 70 },
  { prop: 'bonsai', x: 1870, y: 960, h: 100 }, { prop: 'canoe_sand', x: 1560, y: 1000, h: 70 }, { prop: 'grass2', x: 420, y: 700, h: 45 },
  { prop: 'grass3', x: 1220, y: 640, h: 45 }, { prop: 'fish_rack', x: 130, y: 1010, h: 75 }, { prop: 'stilt_house', x: 110, y: 470, h: 130 },
];
