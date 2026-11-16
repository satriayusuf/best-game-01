// Orbit Bloom — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales and centres it in the
// window, so nothing below depends on the real screen size.

export const FIELD = { width: 1280, height: 720 };

/** The planet sits at the centre of the field; everything is aimed at it or orbits it. */
export const CENTRE = { x: 640, y: 372 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLANET = {
  radius: 56,
  maxHealth: 5,
};

export const SHIELD = {
  radius: 98,          // distance of the shield arc from the planet's centre
  halfAngle: 0.64,     // the arc covers this many radians to either side of its heading
  keyTurn: 3.6,        // radians per second when steered with the keyboard
  chaseTurn: 9.0,      // radians per second when chasing the pointer (snappier)
  thickness: 10,
};

export const SPAWN = {
  distance: 730,       // projectiles appear this far from the centre, just off-screen
  firstDelay: 0.9,     // seconds before the first projectile of a run
  interval: 1.02,      // seconds between spawns at level 1
  intervalPerLevel: 0.93, // each level multiplies the interval by this
  minInterval: 0.40,
  aimJitter: 30,       // projectiles aim at the centre, off by up to this many px sideways
};

export const FLIGHT = {
  baseSpeed: 118,      // px per second at level 1, before per-projectile jitter
  speedPerLevel: 15,
  speedJitter: 46,
  rockRadiusMin: 14,
  rockRadiusMax: 22,
  seedRadius: 11,
  heartRadius: 12,
  seedChance: 0.30,    // of spawns; hearts take a slice of the rest when the planet is hurt
  heartChance: 0.10,
};

export const SCORE = {
  deflect: 10,         // a meteor bounced off the shield, times the multiplier
  bloom: 25,           // a seed let through to the planet, times the multiplier
  heart: 15,           // a heart let through, times the multiplier
  winBonus: 500,       // once, when the garden reaches full bloom
  comboPerStep: 10,    // correct plays in a row per +1 multiplier
  maxMultiplier: 5,
};

/** Grow this many flowers to win (the garden is in full bloom); play may continue after. */
export const BLOOM_TARGET = 30;

/** Seconds of survival per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL = { seconds: 18, max: 12 };

/** How many projectiles and particles can exist at once; pools are allocated once, at boot. */
export const MAX_PROJECTILES = 96;
export const MAX_PARTICLES = 420;
export const MAX_POPUPS = 24;
/** Flowers stay drawn forever, but past this many the oldest is replaced (the count still grows). */
export const MAX_FLOWERS_DRAWN = 72;

export const PALETTE = {
  spaceTop: '#0a0e27',
  spaceBottom: '#05060f',
  nebulaA: 'rgba(64, 48, 140, 0.55)',
  nebulaB: 'rgba(16, 92, 110, 0.45)',
  star: '#dfe8ff',
  planetOcean: '#2e9e6b',
  planetOceanDeep: '#14663f',
  planetLand: '#57c785',
  planetGlow: 'rgba(94, 234, 170, 0.35)',
  shield: '#59e3ff',
  shieldHot: '#d8fbff',
  rock: '#8d7d6b',
  rockDark: '#5d5044',
  rockCrack: '#ffb347',
  seed: '#8dff6e',
  seedCore: '#eaffd6',
  heart: '#ff6e9a',
  heartCore: '#ffd3e2',
  flowerPetal: '#ff9de2',
  flowerPetalAlt: '#ffd166',
  flowerCore: '#fff3b0',
  text: '#f2f6ff',
  muted: '#9aa7c7',
  danger: '#ff5d5d',
  gold: '#ffd166',
  panel: 'rgba(10, 14, 34, 0.72)',
  panelEdge: 'rgba(120, 160, 255, 0.35)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'orbit-bloom.best';
