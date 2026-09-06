# Canva Frame Maker

A browser-only React app for building importable Canva Frames from images and custom
vector shapes. No backend, no API keys — everything runs client-side.

## Package manager: pnpm only

npm and yarn are blocked by a `npx only-allow pnpm` preinstall guard. Lockfile is
`pnpm-lock.yaml`; foreign lockfiles are gitignored.

```bash
pnpm install     # install deps
pnpm dev         # vite dev server on :3000
pnpm build       # production build to dist/
pnpm preview     # serve the built output
pnpm lint        # tsc --noEmit (there is no ESLint config)
pnpm clean       # rm -rf dist
```

`esbuild` needs its postinstall script; that is allowed via `pnpm-workspace.yaml`
(`allowBuilds`). On pnpm 10 the equivalent key is `pnpm.onlyBuiltDependencies` in
`package.json`.

## Architecture

Single-page app, no router. State lives in [src/App.tsx](src/App.tsx) (~700 lines) and is
passed down by props; the only context is theme.

- [src/App.tsx](src/App.tsx) — root state: shapes, selection, active tool, canvas dims, history
- [src/context/ThemeContext.tsx](src/context/ThemeContext.tsx) — light/dark theme
- [src/types.ts](src/types.ts) — shared model: `PathPoint`, `VectorShape`, `CanvasDimensions`.
  Shapes are bezier point lists (`cp1`/`cp2` handles, `type: straight | rounded | break`)
  with optional `subPaths` for compound paths/holes.

### Components ([src/components/](src/components/))

- `CanvasArea.tsx` — the SVG canvas: rendering, pen tool, drag/transform, marquee, guides
- `Toolbar.tsx`, `PropertiesPanel.tsx`, `LayersPanel.tsx`, `PenInspector.tsx` — chrome
- `TabbedSection.tsx` — the right column's Align / Merge / Guides tab block;
  `AlignTab.tsx` and `MergeTab.tsx` are two of its bodies, `GuidesPanel.tsx` the third
- `Rulers.tsx`, `GuidesPanel.tsx` — rulers along the canvas edges and the guide controls
- `ExportModal.tsx`, `ImageTraceModal.tsx`, `NewProjectModal.tsx`, `CanvaGuideModal.tsx`

### Utils ([src/utils/](src/utils/))

- `vectorTrace.ts` — raster → vector tracing (largest module)
- `bezier.ts` — curve math, point/handle manipulation
- `booleanOps.ts` — union/subtract/intersect via `polygon-clipping`
- `shapePresets.ts` — built-in shape library
- `alignment.ts` — align/distribute, including aligning a selection to a guide
- `guides.ts` — guide creation, ruler tick spacing, snapping a box to guides
- `overlayDetector.ts` — validates a frame against Canva's overlay rules
- `canvaExport.ts` — emits Canva-importable output (`pdf-lib` for PDF)

## Changelog

Read [CHANGELOG.md](CHANGELOG.md) at the start of each session and add an entry for the
work done before finishing. Group by date under `## [Unreleased]` using Keep a Changelog
headings. There is no test suite, so the changelog is the running record of what changed.

## Conventions

- Tailwind CSS 4 via `@tailwindcss/vite` — no `tailwind.config.js`, no PostCSS config.
  Theme tokens live in [src/index.css](src/index.css).
- `@/*` path alias maps to the repo root (see `tsconfig.json` and `vite.config.ts`).
- Google Fonts (Plus Jakarta Sans, JetBrains Mono) are loaded from `index.html`. Keep them.
- No test framework is configured.

## History

This repo was exported from Google AI Studio. The Gemini SDK, server proxy scaffold
(`express`/`dotenv`/`tsx`), `DISABLE_HMR` vite hack, and AI Studio branding have all been
removed — do not reintroduce them. `metadata.json` is kept as inert app metadata.
