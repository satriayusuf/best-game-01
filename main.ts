// Orbit Bloom — hand-in program for the make.fun "best game" bounty.
//
// Running this file assembles the finished entry in one place: the playable
// game (everything under game/), the staged screenshots, and a dossier.json
// manifest produced by the vendored make.fun library. What this program
// writes is exactly what the judges receive, so the entry is measured
// against the bounty's size limits before anything is copied, and a short
// receipt is printed at the end so a human can see what went out the door.
//
//   node main.ts                             hand in to /output
//   MAKEFUN_OUTPUT_DIR=some/dir node main.ts hand in to some/dir instead
//
// Node 22 or newer, standard library only. The game itself is plain static
// files; serve the repo root with `node serve.ts` to play it locally.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// ---------------------------------------------------------------------------
// The bounty's limits, written down once so the checks below and the dossier
// caps at the end can never drift apart.

const LIMITS = {
  gameEntries: 993, // most entries (files and folders) allowed under game/
  gameBytes: 48 * 1024 * 1024, // most bytes under game/ in total: 48 MiB
  gamePathBytes: 1000, // longest allowed path under game/, in UTF-8 bytes
  shotCount: 4, // most images allowed in screenshots/
  shotBytes: 256 * 1024, // largest allowed screenshot: 256 KiB
  dossierTextBytes: 163840, // source text the dossier may quote, in bytes
};

// ---------------------------------------------------------------------------
// Small helpers of my own.

/** Give up on the hand-in, with a message that says whose fault it is. */
function refuse(reason: string): never {
  throw new Error(`orbit-bloom hand-in refused: ${reason}`);
}

interface FolderStats {
  entries: number;
  files: number;
  bytes: number;
  longestPathBytes: number;
}

/**
 * Walk a folder tree and measure it: how many entries it holds, how many of
 * them are files, how many bytes the files add up to, and the longest path
 * beneath the root measured the way the bounty counts it (UTF-8 bytes, with
 * forward slashes).
 */
function measureFolder(root: string): FolderStats {
  const stats: FolderStats = { entries: 0, files: 0, bytes: 0, longestPathBytes: 0 };
  const waiting: string[] = [root];
  while (waiting.length > 0) {
    const dir = waiting.pop() as string;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      stats.entries += 1;
      const rel = relative(root, full).split(sep).join('/');
      const pathBytes = Buffer.byteLength(rel, 'utf8');
      if (pathBytes > stats.longestPathBytes) stats.longestPathBytes = pathBytes;
      const info = statSync(full);
      if (info.isDirectory()) {
        waiting.push(full);
      } else if (info.isFile()) {
        stats.files += 1;
        stats.bytes += info.size;
      }
    }
  }
  return stats;
}

/** Copy a folder tree file by file, growing the target folders as met. */
function copyFolder(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    const from = join(source, name);
    const to = join(target, name);
    if (statSync(from).isDirectory()) copyFolder(from, to);
    else copyFileSync(from, to);
  }
}

// ---------------------------------------------------------------------------
// Pre-flight inspection: fail here, in my own words, rather than letting the
// bounty's scorer refuse the entry later in its words.

function inspectGame(gameDir: string): FolderStats {
  if (!existsSync(gameDir)) {
    refuse(`there is no game folder at ${gameDir}, so there is nothing to hand in`);
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    refuse('game/index.html is missing; an entry without a front door cannot be played');
  }
  const stats = measureFolder(gameDir);
  if (stats.entries > LIMITS.gameEntries) {
    refuse(`game/ holds ${stats.entries} entries, over the limit of ${LIMITS.gameEntries}`);
  }
  if (stats.bytes > LIMITS.gameBytes) {
    refuse(`game/ weighs ${stats.bytes} bytes, over the limit of ${LIMITS.gameBytes}`);
  }
  if (stats.longestPathBytes > LIMITS.gamePathBytes) {
    refuse(
      `game/ has a path of ${stats.longestPathBytes} UTF-8 bytes, over the limit of ${LIMITS.gamePathBytes}`,
    );
  }
  return stats;
}

function inspectShots(shotsDir: string): { count: number; bytes: number } {
  if (!existsSync(shotsDir)) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  for (const name of readdirSync(shotsDir)) {
    const full = join(shotsDir, name);
    const info = statSync(full);
    if (!info.isFile()) continue;
    count += 1;
    bytes += info.size;
    if (info.size > LIMITS.shotBytes) {
      refuse(`screenshot ${name} is ${info.size} bytes, over the ${LIMITS.shotBytes}-byte limit`);
    }
  }
  if (count > LIMITS.shotCount) {
    refuse(`screenshots/ holds ${count} images; at most ${LIMITS.shotCount} may be handed in`);
  }
  return { count, bytes };
}

// ---------------------------------------------------------------------------
// The hand-in itself.

function handIn(): void {
  const entryRoot = dirname(fileURLToPath(import.meta.url));
  const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const gameSource = join(entryRoot, 'game');
  const shotsSource = join(entryRoot, 'screenshots');

  // Measure first, copy second: a refusal above leaves no half-built entry.
  const gameStats = inspectGame(gameSource);
  const shotStats = inspectShots(shotsSource);

  mkdirSync(destination, { recursive: true });
  copyFolder(gameSource, join(destination, 'game'));
  if (existsSync(shotsSource)) {
    copyFolder(shotsSource, join(destination, 'screenshots'));
  }

  const dossier = buildDossier(destination, {
    text_max_bytes: LIMITS.dossierTextBytes,
    screenshots: { max: LIMITS.shotCount, max_bytes: LIMITS.shotBytes },
    game_max_files: LIMITS.gameEntries,
    game_max_bytes: LIMITS.gameBytes,
    game_path_max_bytes: LIMITS.gamePathBytes,
  });
  const dossierPath = join(destination, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  console.log('Orbit Bloom handed in:');
  console.log(`  game        ${gameStats.files} files, ${gameStats.bytes} bytes`);
  console.log(`  screenshots ${shotStats.count} images, ${shotStats.bytes} bytes`);
  console.log(`  dossier     ${dossier.length} bytes, written to ${dossierPath}`);
}

try {
  handIn();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
