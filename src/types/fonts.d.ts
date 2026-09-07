/**
 * Hand-written declarations for `opentype.js`, which ships none.
 *
 * `@types/opentype.js` exists but tracks the 1.3 line and knows nothing of the
 * `variation` manager that arrived in 2.0 — the part this app leans on hardest,
 * since Google serves one variable file for every weight of a family and the
 * weight only takes effect through it. Rather than pull stale types in and
 * patch around them, this covers exactly the surface `utils/googleFonts.ts` and
 * `utils/textToShape.ts` use.
 */

declare module 'opentype.js' {
  /** A single drawing command in an `opentype` path — SVG's own alphabet. */
  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | {
        type: 'C';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' };

  export interface Path {
    commands: PathCommand[];
  }

  export interface Glyph {
    index: number;
    name: string | null;
    unicode?: number;
    advanceWidth: number;
    /**
     * `font` is optional in the signature but required in practice for a
     * variable font: the variation deltas live on the font, not the glyph.
     */
    getPath(
      x: number,
      y: number,
      fontSize: number,
      options?: Record<string, unknown>,
      font?: Font
    ): Path;
  }

  export interface VariationAxis {
    tag: string;
    minValue: number;
    defaultValue: number;
    maxValue: number;
  }

  export interface VariationManager {
    /** Axis tag → value, e.g. `{ wght: 700 }`. */
    set(coordinates: Record<string, number> | number): void;
    get(): Record<string, number>;
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    variation?: VariationManager;
    tables: {
      fvar?: { axes: VariationAxis[] };
      os2?: { sxHeight?: number; sTypoAscender?: number; sTypoDescender?: number };
      post?: { underlinePosition?: number; underlineThickness?: number };
      [table: string]: unknown;
    };
    charToGlyph(char: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  }

  /**
   * Named only: the ESM build (`dist/opentype.mjs`, which is what a bundler
   * resolves) exports no default, whatever the README's CommonJS examples do.
   */
  export function parse(buffer: ArrayBuffer): Font;
}
