// Orbit Bloom's simulation: a planet, a shield ring the player swings around it, and a stream
// of meteors, seeds and hearts flying in from deep space. Bounce the meteors off the shield;
// let the seeds and hearts through to the planet. The world knows nothing about screens or
// sound — step() advances it one fixed tick and reports what happened as event bits, and the
// shell (main.js) turns those into noise and announcements.

import {
  BLOOM_TARGET, CENTRE, FLIGHT, LEVEL, MAX_FLOWERS_DRAWN, MAX_PARTICLES, MAX_POPUPS,
  MAX_PROJECTILES, PLANET, SCORE, SHIELD, SPAWN,
} from './config.js';
import { wrapAngle } from './input.js';

export const KIND_ROCK = 'rock';
export const KIND_SEED = 'seed';
export const KIND_HEART = 'heart';

export const EVENT_DEFLECT = 1;
export const EVENT_BLOOM = 2;
export const EVENT_HEART = 4;
export const EVENT_DAMAGE = 8;
export const EVENT_BLOCKED = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;
export const EVENT_LEVEL = 128;

function makeProjectile() {
  return {
    active: false, kind: KIND_ROCK, x: 0, y: 0, vx: 0, vy: 0, radius: 16,
    rot: 0, spin: 0, variant: 0, deflected: false,
  };
}

function makeParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' };
}

export function createWorld(random) {
  const projectiles = Array.from({ length: MAX_PROJECTILES }, makeProjectile);
  const particles = Array.from({ length: MAX_PARTICLES }, makeParticle);
  const popups = Array.from({ length: MAX_POPUPS }, () => ({ active: false, x: 0, y: 0, text: '', color: '#fff', life: 0 }));
  const flowers = [];

  const state = {
    time: 0,
    level: 1,
    score: 0,
    combo: 0,
    multiplier: 1,
    health: PLANET.maxHealth,
    blooms: 0,
    deflected: 0,
    won: false,
    over: false,
    shieldAngle: -Math.PI / 2,
    shieldFlash: 0,   // 0..1, set to 1 the moment the shield takes a hit, decays
    shake: 0,         // px of screen shake left to play out
    flash: 0,         // 0..1 red damage vignette
    winBanner: 0,     // seconds the FULL BLOOM banner still shows
    projectiles,
    particles,
    popups,
    flowers,
  };

  let spawnIn = SPAWN.firstDelay;
  let overAnnounced = false;

  function reset() {
    state.time = 0;
    state.level = 1;
    state.score = 0;
    state.combo = 0;
    state.multiplier = 1;
    state.health = PLANET.maxHealth;
    state.blooms = 0;
    state.deflected = 0;
    state.won = false;
    state.over = false;
    state.shieldAngle = -Math.PI / 2;
    state.shieldFlash = 0;
    state.shake = 0;
    state.flash = 0;
    state.winBanner = 0;
    for (const p of projectiles) p.active = false;
    for (const p of particles) p.active = false;
    for (const p of popups) p.active = false;
    flowers.length = 0;
    spawnIn = SPAWN.firstDelay;
    overAnnounced = false;
  }

  function burst(x, y, count, color, speed, size, life) {
    let placed = 0;
    for (const p of particles) {
      if (placed >= count) break;
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = life * (0.6 + random() * 0.8);
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
      placed += 1;
    }
  }

  function popup(x, y, text, color) {
    for (const p of popups) {
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.text = text;
      p.color = color;
      p.life = 0.9;
      return;
    }
  }

  function spawn(level) {
    for (const p of projectiles) {
      if (p.active) continue;
      const roll = random();
      let kind = KIND_ROCK;
      if (roll < FLIGHT.seedChance) kind = KIND_SEED;
      else if (state.health < PLANET.maxHealth && roll < FLIGHT.seedChance + FLIGHT.heartChance) kind = KIND_HEART;

      const theta = random() * Math.PI * 2;
      const sx = CENTRE.x + Math.cos(theta) * SPAWN.distance;
      const sy = CENTRE.y + Math.sin(theta) * SPAWN.distance;
      // Aim at the centre, missed sideways by a little: most flights threaten the planet,
      // a few sail past its edge and are nobody's fault.
      const offset = (random() * 2 - 1) * SPAWN.aimJitter;
      const ax = CENTRE.x - Math.sin(theta) * offset;
      const ay = CENTRE.y + Math.cos(theta) * offset;
      const dx = ax - sx;
      const dy = ay - sy;
      const len = Math.hypot(dx, dy) || 1;
      const speed = FLIGHT.baseSpeed + (level - 1) * FLIGHT.speedPerLevel + random() * FLIGHT.speedJitter;

      p.active = true;
      p.kind = kind;
      p.x = sx;
      p.y = sy;
      p.vx = (dx / len) * speed;
      p.vy = (dy / len) * speed;
      p.radius = kind === KIND_ROCK
        ? FLIGHT.rockRadiusMin + random() * (FLIGHT.rockRadiusMax - FLIGHT.rockRadiusMin)
        : kind === KIND_SEED ? FLIGHT.seedRadius : FLIGHT.heartRadius;
      p.rot = random() * Math.PI * 2;
      p.spin = (random() * 2 - 1) * 2.4;
      p.variant = Math.floor(random() * 4);
      p.deflected = false;
      return;
    }
  }

  function correctPlay() {
    state.combo += 1;
    state.multiplier = Math.min(SCORE.maxMultiplier, 1 + Math.floor(state.combo / SCORE.comboPerStep));
  }

  /**
   * Advance one tick. targetAngle is where the shield should head; demo runs the title-screen
   * attract mode, where things bounce and bloom on the planet but nothing scores or hurts.
   * Returns the EVENT_* bits for everything that happened this tick.
   */
  function step(dt, targetAngle, demo) {
    let events = 0;
    state.time += dt;
    const level = demo ? 1 : Math.min(LEVEL.max, 1 + Math.floor(state.time / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
    }

    // Swing the shield toward its target the short way round.
    const diff = wrapAngle(targetAngle - state.shieldAngle);
    const maxTurn = SHIELD.chaseTurn * dt;
    state.shieldAngle = wrapAngle(state.shieldAngle + Math.max(-maxTurn, Math.min(maxTurn, diff)));

    // Spawning.
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn(state.level);
      const interval = Math.max(SPAWN.minInterval, SPAWN.interval * Math.pow(SPAWN.intervalPerLevel, state.level - 1));
      spawnIn = interval * (0.75 + random() * 0.5);
    }

    for (const p of projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const dx = p.x - CENTRE.x;
      const dy = p.y - CENTRE.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;
      const inward = p.vx * nx + p.vy * ny < 0;

      // Shield contact: crossing the ring, inside the arc, still travelling inward.
      if (!p.deflected && inward && dist <= SHIELD.radius + p.radius && dist > PLANET.radius + p.radius * 0.5) {
        const gap = Math.abs(wrapAngle(Math.atan2(dy, dx) - state.shieldAngle));
        const slack = SHIELD.halfAngle + Math.asin(Math.min(1, p.radius / SHIELD.radius));
        if (gap <= slack) {
          // Reflect the velocity in the ring's radial direction and send it back out.
          const dot = p.vx * nx + p.vy * ny;
          p.vx = (p.vx - 2 * dot * nx) * 1.04;
          p.vy = (p.vy - 2 * dot * ny) * 1.04;
          p.deflected = true;
          state.shieldFlash = 1;
          if (p.kind === KIND_ROCK) {
            burst(p.x, p.y, 14, '#ffd166', 190, 3, 0.5);
            burst(p.x, p.y, 8, '#59e3ff', 140, 2.5, 0.4);
            if (!demo) {
              correctPlay();
              state.deflected += 1;
              const gained = SCORE.deflect * state.multiplier;
              state.score += gained;
              popup(p.x, p.y - 14, `+${gained}`, '#aee9ff');
            }
            events |= EVENT_DEFLECT;
          } else {
            // A seed or heart wasted on the shield: it bounces off and is lost.
            burst(p.x, p.y, 8, '#c9d4e8', 110, 2.5, 0.4);
            if (!demo) {
              state.combo = 0;
              state.multiplier = 1;
              popup(p.x, p.y - 14, 'Blocked!', '#ffb3c1');
            }
            events |= EVENT_BLOCKED;
          }
          continue;
        }
      }

      // Planet impact.
      if (dist <= PLANET.radius + p.radius * 0.6) {
        const angle = Math.atan2(dy, dx);
        const ix = CENTRE.x + Math.cos(angle) * PLANET.radius;
        const iy = CENTRE.y + Math.sin(angle) * PLANET.radius;
        p.active = false;
        if (p.kind === KIND_ROCK) {
          burst(ix, iy, 22, '#ff9a5c', 230, 3.5, 0.6);
          burst(ix, iy, 10, '#5d5044', 150, 4, 0.7);
          if (!demo) {
            state.health -= 1;
            state.combo = 0;
            state.multiplier = 1;
            state.shake = 13;
            state.flash = 0.55;
            popup(ix, iy - 16, 'Hit!', '#ff8f8f');
            if (state.health <= 0 && !overAnnounced) {
              state.over = true;
              overAnnounced = true;
              events |= EVENT_OVER;
            }
          }
          events |= EVENT_DAMAGE;
        } else if (p.kind === KIND_SEED) {
          flowers.push({ angle, size: 0.8 + random() * 0.5, variant: Math.floor(random() * 3) });
          if (flowers.length > MAX_FLOWERS_DRAWN) flowers.shift();
          state.blooms += 1;
          burst(ix, iy, 12, '#8dff6e', 120, 2.5, 0.55);
          if (!demo) {
            correctPlay();
            const gained = SCORE.bloom * state.multiplier;
            state.score += gained;
            popup(ix, iy - 16, `+${gained}`, '#b6ff9e');
            if (state.blooms >= BLOOM_TARGET && !state.won) {
              state.won = true;
              state.winBanner = 4;
              state.score += SCORE.winBonus;
              popup(CENTRE.x, CENTRE.y - PLANET.radius - 34, `FULL BLOOM! +${SCORE.winBonus}`, '#ffd166');
              events |= EVENT_WIN;
            }
          }
          events |= EVENT_BLOOM;
        } else {
          burst(ix, iy, 12, '#ff6e9a', 120, 2.5, 0.55);
          if (!demo) {
            correctPlay();
            state.health = Math.min(PLANET.maxHealth, state.health + 1);
            const gained = SCORE.heart * state.multiplier;
            state.score += gained;
            popup(ix, iy - 16, `+${gained}`, '#ffc2d4');
          }
          events |= EVENT_HEART;
        }
        continue;
      }

      // Anything that has flown well past the planet is gone for good.
      if (dist > SPAWN.distance + 140) p.active = false;
    }

    // Particles drift and fade; popups float up and fade.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      p.y -= 34 * dt;
      if (p.life <= 0) p.active = false;
    }

    if (state.shieldFlash > 0) state.shieldFlash = Math.max(0, state.shieldFlash - dt * 3.2);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
    if (state.winBanner > 0) state.winBanner = Math.max(0, state.winBanner - dt);
    return events;
  }

  reset();
  return { state, reset, step };
}
