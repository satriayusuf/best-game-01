// Steering for the shield ring. The world only ever asks one question — "what angle should the
// shield head for?" — and this module keeps that target angle: the arrow / A,D keys walk it
// around at a steady rate, and moving the pointer snaps it to the pointer's bearing from the
// planet (the last device touched wins). One-shot presses (start, restart, pause) are queued
// as bit flags and taken once by the loop, so a press between frames is never lost or doubled.

import { CENTRE, SHIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * @param target the canvas element (pointer events land here)
 * @param toLogical converts a pointer event to logical field coordinates {x, y}
 */
export function createInput(target, toLogical) {
  let targetAngle = -Math.PI / 2; // shield starts at the top of the planet
  let left = false;
  let right = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });

  function aimAt(event) {
    const p = toLogical(event);
    const dx = p.x - CENTRE.x;
    const dy = p.y - CENTRE.y;
    if (dx * dx + dy * dy > 24 * 24) targetAngle = Math.atan2(dy, dx); // ignore jitter at the centre
  }
  target.addEventListener('pointermove', aimAt);
  target.addEventListener('pointerdown', (event) => {
    aimAt(event);
    actions |= ACTION_CONFIRM;
  });

  return {
    /**
     * Advance the target angle by one frame of keyboard steering and return it.
     * dt is in seconds; the pointer simply overwrites the target when it moves.
     */
    pollTarget(dt) {
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (dir !== 0) targetAngle = wrapAngle(targetAngle + dir * SHIELD.keyTurn * dt);
      return targetAngle;
    },
    /** Set the target outright (the staged screenshot scenes steer this way). */
    setTarget(angle) {
      targetAngle = wrapAngle(angle);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
