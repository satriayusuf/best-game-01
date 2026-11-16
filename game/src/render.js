// Orbit Bloom's renderer: everything is drawn with canvas paths — a gradient sky with a fixed
// starfield, a glowing planet that grows flowers as seeds land, the player's shield ring,
// meteors, seeds and hearts, particles and score popups, the HUD, and the title / pause /
// game-over overlays. Decorations come from a deterministic hash, so a staged screenshot
// scene paints the same frame every time.

import {
  BLOOM_TARGET, CENTRE, FIELD, FONT, PALETTE, PLANET, SHIELD,
} from './config.js';
import { hash01 } from './random.js';
import { KIND_HEART, KIND_ROCK, KIND_SEED } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Pre-paint the sky once: vertical gradient, two soft nebulae, and 210 hashed stars. */
function paintBackdrop() {
  const c = document.createElement('canvas');
  c.width = FIELD.width;
  c.height = FIELD.height;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, PALETTE.spaceTop);
  grad.addColorStop(1, PALETTE.spaceBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD.width, FIELD.height);

  const blobs = [
    { x: 240, y: 150, r: 330, color: PALETTE.nebulaA },
    { x: 1080, y: 560, r: 380, color: PALETTE.nebulaB },
    { x: 1020, y: 110, r: 210, color: PALETTE.nebulaB },
    { x: 180, y: 620, r: 240, color: PALETTE.nebulaA },
  ];
  for (const b of blobs) {
    const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }

  for (let i = 0; i < 210; i += 1) {
    const x = hash01(i * 3 + 1) * FIELD.width;
    const y = hash01(i * 3 + 2) * FIELD.height;
    const r = 0.6 + hash01(i * 3 + 3) * 1.5;
    g.globalAlpha = 0.25 + hash01(i * 7 + 5) * 0.65;
    g.fillStyle = PALETTE.star;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const backdrop = paintBackdrop();
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let viewW = FIELD.width;
  let viewH = FIELD.height;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    scale = Math.min(viewW / FIELD.width, viewH / FIELD.height);
    offsetX = (viewW - FIELD.width * scale) / 2;
    offsetY = (viewH - FIELD.height * scale) / 2;
    return dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Convert a pointer event's client position to logical field coordinates. */
  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  function drawPlanet(state) {
    const pulse = 1 + Math.sin(state.time * 2) * 0.008;
    const r = PLANET.radius * pulse;
    // Atmosphere glow.
    const glow = ctx.createRadialGradient(CENTRE.x, CENTRE.y, r * 0.7, CENTRE.x, CENTRE.y, r * 2.1);
    glow.addColorStop(0, PALETTE.planetGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(CENTRE.x - r * 2.1, CENTRE.y - r * 2.1, r * 4.2, r * 4.2);
    // Sphere.
    const body = ctx.createRadialGradient(
      CENTRE.x - r * 0.38, CENTRE.y - r * 0.42, r * 0.15,
      CENTRE.x, CENTRE.y, r * 1.05,
    );
    body.addColorStop(0, PALETTE.planetLand);
    body.addColorStop(0.55, PALETTE.planetOcean);
    body.addColorStop(1, PALETTE.planetOceanDeep);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(CENTRE.x, CENTRE.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Land patches, fixed by hash so the planet looks the same in every paint.
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTRE.x, CENTRE.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(87, 199, 133, 0.5)';
    for (let i = 0; i < 7; i += 1) {
      const a = hash01(i * 13 + 4) * Math.PI * 2;
      const d = hash01(i * 13 + 9) * r * 0.62;
      const pr = r * (0.16 + hash01(i * 13 + 21) * 0.2);
      ctx.beginPath();
      ctx.arc(CENTRE.x + Math.cos(a) * d, CENTRE.y + Math.sin(a) * d, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Rim light.
    ctx.strokeStyle = 'rgba(190, 255, 220, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTRE.x, CENTRE.y, r - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFlower(flower) {
    const a = flower.angle;
    const bx = CENTRE.x + Math.cos(a) * (PLANET.radius - 1);
    const by = CENTRE.y + Math.sin(a) * (PLANET.radius - 1);
    const tip = PLANET.radius + 9 * flower.size;
    const tx = CENTRE.x + Math.cos(a) * tip;
    const ty = CENTRE.y + Math.sin(a) * tip;
    ctx.strokeStyle = '#3f9e57';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const petal = flower.variant === 1 ? PALETTE.flowerPetalAlt : PALETTE.flowerPetal;
    ctx.fillStyle = petal;
    for (let k = 0; k < 5; k += 1) {
      const pa = a + (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(tx + Math.cos(pa) * 4.4 * flower.size, ty + Math.sin(pa) * 4.4 * flower.size, 3.6 * flower.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.flowerCore;
    ctx.beginPath();
    ctx.arc(tx, ty, 2.8 * flower.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShield(state) {
    // The faint guide ring the shield rides on.
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTRE.x, CENTRE.y, SHIELD.radius, 0, Math.PI * 2);
    ctx.stroke();

    const flash = state.shieldFlash;
    ctx.save();
    ctx.shadowColor = PALETTE.shield;
    ctx.shadowBlur = 16 + flash * 22;
    ctx.strokeStyle = flash > 0.4 ? PALETTE.shieldHot : PALETTE.shield;
    ctx.lineWidth = SHIELD.thickness + flash * 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(CENTRE.x, CENTRE.y, SHIELD.radius, state.shieldAngle - SHIELD.halfAngle, state.shieldAngle + SHIELD.halfAngle);
    ctx.stroke();
    ctx.restore();
    // End caps.
    ctx.fillStyle = PALETTE.shieldHot;
    for (const s of [-1, 1]) {
      const a = state.shieldAngle + s * SHIELD.halfAngle;
      ctx.beginPath();
      ctx.arc(CENTRE.x + Math.cos(a) * SHIELD.radius, CENTRE.y + Math.sin(a) * SHIELD.radius, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRock(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    const points = 8;
    for (let k = 0; k < points; k += 1) {
      const a = (k / points) * Math.PI * 2;
      const rr = p.radius * (0.78 + hash01(p.variant * 101 + k * 17) * 0.38);
      if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.rock;
    ctx.fill();
    ctx.strokeStyle = PALETTE.rockDark;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Glowing cracks: this rock is hot from re-entry.
    ctx.strokeStyle = PALETTE.rockCrack;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-p.radius * 0.5, -p.radius * 0.2);
    ctx.lineTo(-p.radius * 0.05, p.radius * 0.1);
    ctx.lineTo(p.radius * 0.42, -p.radius * 0.05);
    ctx.moveTo(p.radius * 0.1, p.radius * 0.55);
    ctx.lineTo(-p.radius * 0.05, p.radius * 0.1);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawSeed(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = PALETTE.seed;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.seed;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.seedCore;
    ctx.beginPath();
    ctx.arc(-p.radius * 0.25, -p.radius * 0.25, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // A tiny sprout on top, so it reads as a seed, not a bullet.
    ctx.strokeStyle = '#3f9e57';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -p.radius * 0.8);
    ctx.quadraticCurveTo(1, -p.radius * 1.35, 5, -p.radius * 1.45);
    ctx.stroke();
    ctx.restore();
  }

  function drawHeart(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = PALETTE.heart;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.heart;
    const s = p.radius / 10;
    ctx.beginPath();
    ctx.moveTo(0, 8 * s);
    ctx.bezierCurveTo(-11 * s, -2 * s, -6 * s, -10 * s, 0, -4.5 * s);
    ctx.bezierCurveTo(6 * s, -10 * s, 11 * s, -2 * s, 0, 8 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.heartCore;
    ctx.beginPath();
    ctx.arc(-3.4 * s, -3.4 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups(state) {
    ctx.textAlign = 'center';
    ctx.font = `700 21px ${FONT}`;
    for (const p of state.popups) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
  }

  function drawHud(state) {
    ctx.textBaseline = 'middle';
    // Score, top-left.
    panel(18, 16, 252, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('SCORE', 36, 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(String(state.score).padStart(6, '0'), 36, 63);
    if (state.multiplier > 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 19px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`x${state.multiplier}`, 252, 62);
    }
    // Planet health pips, under the score.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('PLANET', 36, 100);
    for (let i = 0; i < PLANET.maxHealth; i += 1) {
      ctx.beginPath();
      ctx.arc(96 + i * 24, 100, 8, 0, Math.PI * 2);
      ctx.fillStyle = i < state.health ? '#5eeaa9' : 'rgba(120,130,160,0.35)';
      ctx.fill();
    }
    if (state.combo >= 3) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(`COMBO ${state.combo}`, 216, 100);
    }

    // Bloom progress, top-centre.
    panel(490, 16, 300, 64);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('BLOOM', 640, 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(`${Math.min(state.blooms, BLOOM_TARGET)} / ${BLOOM_TARGET}`, 640, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, 520, 70, 240, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = PALETTE.flowerPetal;
    roundRect(ctx, 520, 70, 240 * Math.min(1, state.blooms / BLOOM_TARGET), 5, 2.5);
    ctx.fill();

    // Level, top-right.
    panel(1010, 16, 252, 64);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('LEVEL', 1244, 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(String(state.level), 1244, 63);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('DEFLECTED', 1028, 100);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(String(state.deflected), 1120, 100);
  }

  function drawWinBanner(state) {
    const a = Math.min(1, state.winBanner);
    ctx.globalAlpha = a;
    panel(440, 108, 400, 58);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 27px ${FONT}`;
    ctx.fillText('FULL BLOOM!', 640, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText('The garden is complete — keep guarding it!', 640, 154);
    ctx.globalAlpha = 1;
  }

  function veil(alpha) {
    ctx.fillStyle = `rgba(4, 6, 16, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    veil(0.42);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = PALETTE.seed;
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#eaffd6';
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText('ORBIT BLOOM', 640, 168);
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 21px ${FONT}`;
    ctx.fillText('Guard the little planet. Grow its garden.', 640, 214);

    panel(340, 470, 600, 150);
    ctx.font = `600 19px ${FONT}`;
    ctx.fillStyle = '#aee9ff';
    ctx.fillText('Bounce the grey METEORS off your shield', 640, 508);
    ctx.fillStyle = '#b6ff9e';
    ctx.fillText('Let green SEEDS through — each one grows a flower', 640, 540);
    ctx.fillStyle = '#ffc2d4';
    ctx.fillText('Let pink HEARTS through to mend the planet', 640, 572);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(`Grow ${BLOOM_TARGET} flowers to win. Five meteors through, and it falls.`, 640, 604 - 8);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    const pulse = 0.72 + Math.sin(state.time * 4) * 0.28;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE or click to play', 640, 664);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('Swing the shield with the mouse, or hold  A / D  and  \u2190 / \u2192', 640, 692 - 4);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(`Best score: ${best}`, 640, 442);
    }
  }

  function drawOver(state, best) {
    veil(0.55);
    panel(390, 196, 500, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText('THE GARDEN FALLS', 640, 252);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('The last meteor got through.', 640, 288);

    ctx.font = `700 22px ${FONT}`;
    const rows = [
      ['Score', String(state.score)],
      ['Best', String(Math.max(best, state.score))],
      ['Flowers grown', String(state.blooms)],
      ['Meteors deflected', String(state.deflected)],
      ['Level reached', String(state.level)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 336 + i * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, 448, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(value, 832, y);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 21px ${FONT}`;
    const pulse = 0.72 + Math.sin(state.time * 4) * 0.28;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE or click to try again', 640, 566);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    veil(0.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText('PAUSED', 640, 340);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('Press P or SPACE to resume', 640, 382);
  }

  function draw(state, screen, best) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.spaceBottom;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    if (state.shake > 0.2) {
      const s = state.shake;
      ctx.translate((hash01(Math.floor(state.time * 47)) - 0.5) * s, (hash01(Math.floor(state.time * 47) + 9) - 0.5) * s);
    }
    ctx.drawImage(backdrop, 0, 0);
    drawPlanet(state);
    for (const f of state.flowers) drawFlower(f);
    drawShield(state);
    for (const p of state.projectiles) {
      if (!p.active) continue;
      if (p.kind === KIND_ROCK) drawRock(p);
      else if (p.kind === KIND_SEED) drawSeed(p);
      else drawHeart(p);
    }
    drawParticles(state);
    drawPopups(state);

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state);
      if (state.winBanner > 0) drawWinBanner(state);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) {
      drawHud(state);
      drawOver(state, best);
    } else if (screen === SCREEN_PAUSED) drawPaused();

    if (state.flash > 0) {
      const rg = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
      rg.addColorStop(0, 'rgba(255,40,40,0)');
      rg.addColorStop(1, `rgba(255,40,40,${(state.flash * 0.5).toFixed(3)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw, toLogical, resize };
}
