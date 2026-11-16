// The screenshot scenes behind ?shot=start|play|end|bloom. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot (guard
// the angle of the most urgent meteor; step aside for seeds and hearts), so the frame is what
// a real game looks like and the same seed always gives the same frame.

import { BLOOM_TARGET, PLANET, STEP } from './config.js';
import { createRandom } from './random.js';
import { wrapAngle } from './input.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_OVER, KIND_ROCK } from './world.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const BLOOM_LIMIT_SECONDS = 300;
const END_LIMIT_SECONDS = 600;

/** Seconds until this projectile reaches the planet, or Infinity if it is not coming in. */
function timeToPlanet(p) {
  const dx = p.x - 640;
  const dy = p.y - 372;
  const dist = Math.hypot(dx, dy);
  const inward = -(p.vx * dx + p.vy * dy) / (dist || 1);
  if (inward <= 1) return Infinity;
  return Math.max(0, (dist - PLANET.radius) / inward);
}

/**
 * Where a decent player would send the shield: onto the angle of the soonest meteor — unless
 * the soonest arrival is a seed or heart, in which case well away from its angle so it slips
 * through (a meteor arriving just after it still gets guarded).
 */
function autopilot(state) {
  let rockTime = Infinity;
  let rockAngle = 0;
  let giftTime = Infinity;
  let giftAngle = 0;
  for (const p of state.projectiles) {
    if (!p.active || p.deflected) continue;
    const t = timeToPlanet(p);
    if (t === Infinity) continue;
    const angle = Math.atan2(p.y - 372, p.x - 640);
    if (p.kind === KIND_ROCK) {
      if (t < rockTime) {
        rockTime = t;
        rockAngle = angle;
      }
    } else if (t < giftTime) {
      giftTime = t;
      giftAngle = angle;
    }
  }
  if (giftTime < rockTime && giftTime < 1.6 && rockTime > giftTime + 0.45) {
    return wrapAngle(giftAngle + 2.3); // step aside and let the gift through
  }
  if (rockTime !== Infinity) return rockAngle;
  if (giftTime !== Infinity) return wrapAngle(giftAngle + 2.3);
  return -Math.PI / 2 + Math.sin(state.time * 0.4) * 0.9;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score to
 * show. Unknown names stage the title scene.
 */
export function stageShot(name, world, seed) {
  const { state } = world;
  world.reset();

  if (name === 'play' || name === 'bloom') {
    const limit = name === 'bloom' ? BLOOM_LIMIT_SECONDS : PLAY_SECONDS;
    for (let i = 0; i < limit / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (name === 'bloom' && state.blooms >= BLOOM_TARGET - 3) break;
      if (state.over) break;
    }
    if (name === 'bloom') {
      // Top the garden up to full bloom deterministically and raise the banner: this scene is
      // the victory moment, whether or not the autopilot's luck quite got there.
      const rng = createRandom(seed * 7 + 11);
      while (state.flowers.length < BLOOM_TARGET) {
        state.flowers.push({ angle: rng() * Math.PI * 2, size: 0.8 + rng() * 0.5, variant: Math.floor(rng() * 3) });
      }
      state.blooms = Math.max(state.blooms, BLOOM_TARGET);
      state.won = true;
      state.winBanner = 4;
      if (state.score === 0) state.score = 12750;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }

  if (name === 'end') {
    // A real run that turns: the keeper plays properly for a while, building a garden and a
    // score, then tires and stops moving — and the meteors get through.
    for (let i = 0; i < 22 / STEP; i += 1) world.step(STEP, autopilot(state), false);
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (world.step(STEP, -Math.PI / 2, false) & EVENT_OVER) break;
    }
    // The killing blow leaves the damage flash and shake frozen mid-frame in a still: clear
    // them so the game-over panel paints clean.
    state.flash = 0;
    state.shake = 0;
    return { screen: SCREEN_OVER, best: state.score };
  }

  // Title: a few seconds of the attract mode drifting by behind the menu.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(state), true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
