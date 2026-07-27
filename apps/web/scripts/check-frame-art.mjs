#!/usr/bin/env node
/**
 * Frame-art guard (story 5.2 code review, 2026-07-27).
 *
 * The shipped `panel-frame.png` twice reached production carrying its source
 * white matte: 19 pure-white rows along the top and 11 down the right edge.
 * Phaser's NineSlice paints those border regions along EVERY framed panel, so
 * the defect showed as a white band across the Home plaque, the Draft detail
 * panel and the Battle log. It survived two device passes because the crop was
 * eyeballed against image viewers that render PNGs on a white page — white on
 * white is invisible.
 *
 * This is the mechanical check that eye can't do: for every 9-slice chrome
 * texture, decode the pixels and fail if any of the eight border regions
 * (the parts NineSlice stretches along the panel edges) contains near-white.
 *
 * Run: `pnpm --filter web check:art` (also runs as part of `pnpm --filter web build`).
 *
 * Plain Node + `sips` (macOS) for decoding — apps/web is browser-pure with no
 * @types/node, so this deliberately lives OUTSIDE the typechecked/vitest source
 * (see apps/web/test/attribution.test.ts for the same no-node:fs constraint).
 * On a non-macOS host `sips` is absent; the check skips with a warning rather
 * than failing the build, so Linux CI stays green while the art (which only
 * ever changes on Danilo's Mac) is verified where it is produced.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'src', 'assets');

/** Must mirror the slice constants in src/config/constants.ts. */
const FRAMES = [
  { file: 'button-frame.png', slice: 36, constant: 'BUTTON_FRAME_SLICE' },
  { file: 'panel-frame.png', slice: 30, constant: 'PANEL_FRAME_SLICE' },
];

/** A pixel light enough to read as the source matte rather than as art. */
const isNearWhite = ([r, g, b]) => r > 200 && g > 200 && b > 200;
/** Tolerance: a few stray light pixels are highlights; a band is a matte. */
const MAX_NEAR_WHITE_PCT = 2;

function decode(pngPath) {
  const bmpPath = `${pngPath}.check.bmp`;
  try {
    execFileSync('sips', ['-s', 'format', 'bmp', pngPath, '--out', bmpPath], { stdio: 'ignore' });
  } catch {
    return null; // no sips (non-macOS) — caller skips
  }
  const b = readFileSync(bmpPath);
  unlinkSync(bmpPath);
  const off = b.readUInt32LE(10);
  const width = b.readInt32LE(18);
  const rawHeight = b.readInt32LE(22);
  const bpp = b.readUInt16LE(28);
  const height = Math.abs(rawHeight);
  const bottomUp = rawHeight > 0;
  const bytesPerPx = bpp / 8;
  const rowSize = Math.floor((bpp * width + 31) / 32) * 4;
  const at = (x, y) => {
    const row = bottomUp ? height - 1 - y : y;
    const i = off + row * rowSize + x * bytesPerPx;
    return [b[i + 2], b[i + 1], b[i]]; // BMP is BGR
  };
  return { width, height, at };
}

/** The eight regions NineSlice repeats along a panel's edges (everything but the centre). */
function borderRegions(width, height, slice) {
  return {
    'top-left': [0, slice, 0, slice],
    top: [slice, width - slice, 0, slice],
    'top-right': [width - slice, width, 0, slice],
    left: [0, slice, slice, height - slice],
    right: [width - slice, width, slice, height - slice],
    'bottom-left': [0, slice, height - slice, height],
    bottom: [slice, width - slice, height - slice, height],
    'bottom-right': [width - slice, width, height - slice, height],
  };
}

let failed = false;
let skipped = false;

for (const { file, slice, constant } of FRAMES) {
  const path = join(ASSETS, file);
  const img = decode(path);
  if (img === null) {
    skipped = true;
    console.warn(`⚠️  ${file}: skipped (no \`sips\` on this host — macOS-only decode)`);
    continue;
  }
  const { width, height, at } = img;
  if (width <= slice * 2 || height <= slice * 2) {
    console.error(`❌ ${file}: ${width}x${height} is too small for ${constant}=${slice} (borders would overlap)`);
    failed = true;
    continue;
  }
  const offenders = [];
  for (const [name, [x0, x1, y0, y1]] of Object.entries(borderRegions(width, height, slice))) {
    let white = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        total++;
        if (isNearWhite(at(x, y))) white++;
      }
    }
    const pct = (100 * white) / total;
    if (pct > MAX_NEAR_WHITE_PCT) offenders.push(`${name} ${pct.toFixed(0)}%`);
  }
  if (offenders.length > 0) {
    console.error(`❌ ${file} (${width}x${height}, ${constant}=${slice}): near-white in border regions — ${offenders.join(', ')}`);
    console.error('   NineSlice stretches these along every panel edge; this ships as a white band. Re-crop the source to its content bbox.');
    failed = true;
  } else {
    console.log(`✅ ${file} (${width}x${height}, ${constant}=${slice}): borders clean`);
  }
}

if (failed) process.exit(1);
if (skipped) console.warn('Frame-art check incomplete (decode unavailable on this host).');
