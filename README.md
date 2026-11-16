# Orbit Bloom

A 2D arcade game for the browser, built for the make.fun **best-game-01** bounty.

You are the keeper of a little planet. Meteors, seeds and hearts rain in from deep space:

- **Bounce the grey meteors** off your shield ring — if five get through, the planet falls.
- **Let the green seeds through** — each one that reaches the soil grows a flower. Grow
  **30 flowers** to reach Full Bloom and win (then keep guarding the garden for score).
- **Let the pink hearts through** — they mend the planet.

Correct plays build a combo that raises the score multiplier (up to x5); mistakes reset it.
Every 18 seconds the storm steps up a level: faster flights, tighter spawns.

## Controls

- **Mouse** — the shield swings to the pointer's bearing from the planet.
- **A / D or ← / →** — walk the shield around the ring.
- **Space / Enter / click** — start, restart, resume.
- **P / Esc** — pause.

## Running it

The game is plain static files under `game/` — no build step, no network requests, all art
drawn with canvas and all sound synthesised with WebAudio. Serve the folder and open it:

```
node serve.ts        # then open http://localhost:8080
```

`main.ts` is the hand-in program: it copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the vendored make.fun library.

## Screenshots

The scenes in `screenshots/` are real renders of the game, staged deterministically with
`?shot=start|play|bloom|end&seed=1` (see `shots.json`): mid-action play (cover), the title
screen, the Full Bloom victory moment, and the game-over screen.
