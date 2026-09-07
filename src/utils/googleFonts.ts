import { Font, parse as parseFont } from 'opentype.js';
import { FONT_BY_FAMILY, GoogleFontEntry } from '../data/googleFonts';

/**
 * Fetching Google Fonts as *outlines*, entirely in the browser.
 *
 * The app draws type as vector geometry, not as `<text>`, so it needs the glyph
 * contours rather than a face the browser can paint. That takes three hops:
 *
 *   1. `css2` for the family → a stylesheet naming one file per subset.
 *   2. The `latin` subset's file from `fonts.gstatic.com`.
 *   3. WOFF2 → TTF → `opentype.js`.
 *
 * Both Google endpoints answer `Access-Control-Allow-Origin: *`, so all of it
 * runs client-side with no backend and no API key. What is *not* fetchable is
 * the family list — `fonts.google.com/metadata/fonts` sends no CORS headers at
 * all — which is why `data/googleFonts.ts` is generated ahead of time.
 *
 * Step 3 needs a decompressor: a modern browser sends a modern `User-Agent`, so
 * `css2` always answers with WOFF2, and WOFF2 is Brotli — which `opentype.js`
 * cannot read and `DecompressionStream` does not implement. `woff2-encoder` is
 * Google's `woff2` library built to WASM with its own decompress-only bundle,
 * and it is `import()`ed on the first font so a session that never sets any
 * type never pays for it.
 *
 * (`wawoff2`, which `opentype.js`'s own README points at, is not usable here:
 * its Emscripten glue only assigns `module.exports` inside its
 * `ENVIRONMENT_IS_NODE` branch, so bundled for a browser it resolves to an
 * empty object and its decompress promise simply never settles.)
 */

/** Where the app asks for a stylesheet. Only the `latin` face is ever used. */
const CSS2 = 'https://fonts.googleapis.com/css2';

/**
 * The Latin subset's `unicode-range`, as `css2` writes it. Every family's Latin
 * face declares this exact block, so it is what picks the right one out of the
 * dozen subsets a stylesheet lists.
 */
const LATIN_RANGE = /U\+0000-00FF/;

export interface FontKey {
  family: string;
  weight: number;
  italic: boolean;
}

const cache = new Map<string, Promise<Font>>();

function fontCacheKey({ family, weight, italic }: FontKey): string {
  return `${family}|${weight}|${italic ? 'i' : 'n'}`;
}

/* ------------------------------------------------------------------ */
/* Catalogue queries                                                   */
/* ------------------------------------------------------------------ */

export function fontEntry(family: string): GoogleFontEntry | null {
  return FONT_BY_FAMILY.get(family) ?? null;
}

/** The weight nearest `wanted` that this family will actually serve. */
function nearestWeight(entry: GoogleFontEntry, wanted: number): number {
  return entry.weights.reduce((best, w) =>
    Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best
  );
}

/**
 * Which weight Bold should ask for.
 *
 * 700 where the family has it. Otherwise the heaviest weight that is genuinely
 * heavier than the regular one — a display face topping out at 500 still has a
 * usable "bolder", and refusing to bold it would be pedantry. A family with a
 * single weight has no bold at all, and says so by returning null so the toggle
 * can be disabled rather than quietly doing nothing.
 */
export function boldWeight(entry: GoogleFontEntry): number | null {
  if (entry.weights.includes(700)) return 700;
  const regular = regularWeight(entry);
  const heavier = entry.weights.filter((w) => w > regular);
  return heavier.length > 0 ? heavier[heavier.length - 1] : null;
}

export function regularWeight(entry: GoogleFontEntry): number {
  return entry.weights.includes(400) ? 400 : nearestWeight(entry, 400);
}

/** What a family can do, for greying out the toggles that would do nothing. */
export function fontCapabilities(family: string): {
  canBold: boolean;
  canItalic: boolean;
} {
  const entry = fontEntry(family);
  if (!entry) return { canBold: false, canItalic: false };
  return { canBold: boldWeight(entry) !== null, canItalic: entry.italic };
}

/** Resolve a family plus the two style toggles to a concrete face to fetch. */
export function resolveFace(
  family: string,
  bold: boolean,
  italic: boolean
): FontKey {
  const entry = fontEntry(family);
  if (!entry) return { family, weight: bold ? 700 : 400, italic };

  const weight = (bold ? boldWeight(entry) : null) ?? regularWeight(entry);
  return { family, weight, italic: italic && entry.italic };
}

/* ------------------------------------------------------------------ */
/* Loading outlines                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build the `css2` query for one face.
 *
 * The `ital` axis is only named when an italic is actually wanted: asking a
 * family that has none for `ital,wght@1,400` is a 400 from the API, not an
 * empty stylesheet.
 */
function css2Url({ family, weight, italic }: FontKey): string {
  const spec = italic
    ? `ital,wght@1,${weight}`
    : `wght@${weight}`;
  return `${CSS2}?family=${encodeURIComponent(family).replace(
    /%20/g,
    '+'
  )}:${spec}&display=swap`;
}

/**
 * Pick the Latin face's file out of a `css2` stylesheet.
 *
 * A modern browser gets one `@font-face` per subset — latin, latin-ext,
 * cyrillic, greek and so on — each with its own `unicode-range`. The Latin one
 * is what this app draws from. A response with no `unicode-range` at all is the
 * legacy single-file form, which some clients still get; there the only face
 * present is the right one.
 */
function latinFaceUrl(css: string): string | null {
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  if (faces.length === 0) return null;

  const latin = faces.find((f) => LATIN_RANGE.test(f)) ?? faces[0];
  return /url\((https:[^)]+)\)/.exec(latin)?.[1] ?? null;
}

/** The four-byte tag every font file opens with. */
function sniffFormat(bytes: Uint8Array): 'woff2' | 'other' {
  return bytes[0] === 0x77 && // w
    bytes[1] === 0x4f && // O
    bytes[2] === 0x46 && // F
    bytes[3] === 0x32 // 2
    ? 'woff2'
    : 'other';
}

/**
 * Pin a variable font to the weight that was asked for.
 *
 * Google serves one file for every weight of a variable family — asking `css2`
 * for 400 and for 700 hands back the *same* URL — and leaves it to the renderer
 * to move the `wght` axis. Nothing does that for us here, so without this a
 * bold Playfair Display would come back drawn at 400.
 *
 * The same applies to the slant axes: a family whose italic lives on `ital` or
 * `slnt` inside the upright file needs the axis set rather than a second file.
 */
function applyVariation(font: Font, { weight, italic }: FontKey): void {
  const axes = font.tables.fvar?.axes;
  if (!axes || !font.variation) return;

  const coords: Record<string, number> = {};
  for (const axis of axes) {
    if (axis.tag === 'wght') {
      coords.wght = Math.min(axis.maxValue, Math.max(axis.minValue, weight));
    } else if (italic && axis.tag === 'ital') {
      coords.ital = axis.maxValue;
    } else if (italic && axis.tag === 'slnt') {
      // `slnt` is signed degrees and runs negative for a forward lean.
      coords.slnt = Math.min(axis.minValue, axis.maxValue);
    }
  }

  if (Object.keys(coords).length > 0) font.variation.set(coords);
}

async function fetchFont(key: FontKey): Promise<Font> {
  const cssRes = await fetch(css2Url(key));
  if (!cssRes.ok) {
    throw new Error(
      `Google Fonts has no "${key.family}" at weight ${key.weight}${
        key.italic ? ' italic' : ''
      }.`
    );
  }

  const url = latinFaceUrl(await cssRes.text());
  if (!url) throw new Error(`No Latin face listed for "${key.family}".`);

  const fileRes = await fetch(url);
  if (!fileRes.ok) {
    throw new Error(`Could not download "${key.family}" (${fileRes.status}).`);
  }

  let bytes = new Uint8Array(await fileRes.arrayBuffer());
  if (sniffFormat(bytes) === 'woff2') {
    // Imported here rather than at the top so the ~300KB WASM decompressor is
    // only fetched by a session that actually sets some type.
    // Imported here rather than at the top so the WASM decompressor is only
    // fetched by a session that actually sets some type.
    const { default: decompress } = await import('woff2-encoder/decompress');
    bytes = await decompress(bytes);
  }

  // `.buffer` on a subarray would hand over the whole backing store, so copy
  // out exactly the bytes of this font.
  const font = parseFont(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  applyVariation(font, key);
  return font;
}

/**
 * Load one face's outlines, at most once per session.
 *
 * The *promise* is cached rather than the result, so two panels asking for the
 * same face while it is still in flight share the one download.
 */
export function loadFontOutlines(key: FontKey): Promise<Font> {
  const id = fontCacheKey(key);
  const existing = cache.get(id);
  if (existing) return existing;

  const pending = fetchFont(key).catch((err) => {
    // A failed load must not be remembered as a failure for the rest of the
    // session — the next attempt should get to try the network again.
    cache.delete(id);
    throw err;
  });
  cache.set(id, pending);
  return pending;
}

/** The face if it is already in hand, for the synchronous geometry rebuild. */
export function peekFontOutlines(key: FontKey): Font | null {
  return loadedFonts.get(fontCacheKey(key)) ?? null;
}

const loadedFonts = new Map<string, Font>();

/** Same as `loadFontOutlines`, but also files the result for `peek`. */
export async function ensureFontOutlines(key: FontKey): Promise<Font> {
  const font = await loadFontOutlines(key);
  loadedFonts.set(fontCacheKey(key), font);
  return font;
}

/* ------------------------------------------------------------------ */
/* Preview faces for the DOM                                           */
/* ------------------------------------------------------------------ */

/**
 * Ask the browser to load a family the ordinary way, for the parts of the UI
 * that are real text: the picker's per-row previews, and the invisible textarea
 * the canvas types into — whose caret only lands in the right place if its own
 * metrics match the outlines drawn underneath it.
 *
 * One `<link>` covers however many families are handed over at once, and each
 * family is only ever requested once. `display=block` rather than `swap`: a
 * preview row briefly blank is honest, where one that flashes in the fallback
 * face and then reflows is actively misleading about what the font looks like.
 */
const requestedPreviews = new Set<string>();

export function ensurePreviewFaces(families: string[]): void {
  if (typeof document === 'undefined') return;

  const fresh = families.filter(
    (f) => f && !requestedPreviews.has(f) && FONT_BY_FAMILY.has(f)
  );
  if (fresh.length === 0) return;
  fresh.forEach((f) => requestedPreviews.add(f));

  const query = fresh
    .map((f) => {
      const entry = FONT_BY_FAMILY.get(f)!;
      // Both weights in one go: the picker previews at regular, but the canvas
      // may already be bold, and a second round trip for it would show the
      // caret sitting against the wrong metrics until it arrived.
      const weights = [...new Set([regularWeight(entry), boldWeight(entry) ?? regularWeight(entry)])];
      const spec = entry.italic
        ? `ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights
            .map((w) => `1,${w}`)
            .join(';')}`
        : `wght@${weights.join(';')}`;
      return `family=${encodeURIComponent(f).replace(/%20/g, '+')}:${spec}`;
    })
    .join('&');

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${CSS2}?${query}&display=block`;
  document.head.appendChild(link);
}

/** The CSS stack for a family, with a category-appropriate fallback behind it. */
export function fontStack(family: string): string {
  const category = fontEntry(family)?.category ?? 'Sans Serif';
  const fallback =
    category === 'Serif'
      ? 'serif'
      : category === 'Monospace'
      ? 'monospace'
      : category === 'Handwriting'
      ? 'cursive'
      : 'sans-serif';
  return `"${family}", ${fallback}`;
}
