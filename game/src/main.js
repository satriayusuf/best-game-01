// Orbit Bloom's shell: boot, the screen flow (title, play, paused, game over), the fixed-step
// loop, and the mapping from world events to sound and announcements.
//
// ?seed=N fixes the flight pattern. ?shot=start|play|end|bloom (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BLOOM, EVENT_BLOCKED, EVENT_DAMAGE, EVENT_DEFLECT, EVENT_HEART,
  EVENT_LEVEL, EVENT_OVER, EVENT_WIN, KIND_ROCK,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Attract mode steering for the title screen: guard the nearest meteor, like a player would. */
function demoTarget(state) {
  let bestDist = Infinity;
  let angle = -Math.PI / 2 + Math.sin(state.time * 0.35) * 1.1;
  for (const p of state.projectiles) {
    if (!p.active || p.deflected || p.kind !== KIND_ROCK) continue;
    const d = Math.hypot(p.x - 640, p.y - 372);
    if (d < bestDist) {
      bestDist = d;
      angle = Math.atan2(p.y - 372, p.x - 640);
    }
  }
  return angle;
}

function runGame() {
  const input = createInput(canvas, (event) => renderer.toLogical(event));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Bounce the meteors, let the seeds and hearts through.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playEvents(events) {
    const s = world.state;
    if (events & EVENT_DEFLECT) audio.deflect(s.combo);
    if (events & EVENT_BLOOM) audio.bloom();
    if (events & EVENT_HEART) audio.heart();
    if (events & EVENT_BLOCKED) audio.blocked();
    if (events & EVENT_DAMAGE) audio.damage();
    if (events & EVENT_LEVEL) audio.levelUp();
    if (events & EVENT_WIN) {
      audio.win();
      announce('Full bloom! The garden is complete. Keep guarding it.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, demoTarget(world.state), true);
      return;
    }
    const events = world.step(STEP, input.pollTarget(STEP), false);
    playEvents(events);
    if (events & EVENT_DAMAGE && world.state.health > 0) {
      announce(world.state.health === 1 ? 'Hit. The planet has one heart left.' : `Hit. ${world.state.health} hearts left.`);
    }
    if (events & EVENT_OVER) {
      audio.gameOver();
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting meteors fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Orbit Bloom. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
