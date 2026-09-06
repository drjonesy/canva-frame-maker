import { CanvasDimensions, ImportSizeCheckResult, VectorShape } from '../types';
import { getExportSize } from './canvaExport';

/**
 * Canva's minimum design size is 40 x 40 px, and an upload smaller than that is
 * rejected on import with "The dimensions of this document are too small to
 * import." — the file itself is valid, so nothing warns at export time.
 *
 * The export crops the page to the artwork's bounding box, so it is that box,
 * not the canvas, that Canva measures. A thin cut-off strip — an edge sliver
 * carved from a larger shape — is the usual way to trip this: the parent shape
 * imports, the sliver does not.
 *
 * Page units are PDF points, and Canva reads a point as at least a pixel
 * (1 pt = 1 px, or 1.33 px at 96 DPI), so comparing the box in points against
 * 40 is the conservative reading.
 */
export const CANVA_MIN_IMPORT_SIZE = 40;

/**
 * Above the hard minimum but still cramped: Canva accepts it, but the frame
 * arrives so small it is awkward to place, and any rounding on Canva's side
 * leaves no margin. Worth a caution, not a block.
 */
export const CANVA_SAFE_IMPORT_SIZE = 100;

/**
 * Measures what the export would actually write and reports whether Canva will
 * accept it. Both export formats size the page the same way, so one check
 * covers the PDF and the SVG.
 */
export function checkImportSize(
  shapes: VectorShape[],
  dimensions: CanvasDimensions
): ImportSizeCheckResult {
  const { width, height, hasArtwork } = getExportSize(shapes, dimensions);
  const smallestSide = Math.min(width, height);

  let status: ImportSizeCheckResult['status'];
  if (!hasArtwork) {
    status = 'empty';
  } else if (smallestSide < CANVA_MIN_IMPORT_SIZE) {
    status = 'tooSmall';
  } else if (smallestSide < CANVA_SAFE_IMPORT_SIZE) {
    status = 'tight';
  } else {
    status = 'ok';
  }

  // Scaling the artwork up is the fix, so offer the factor that clears the
  // comfortable size rather than the one that lands exactly on the minimum.
  const rawScale = CANVA_SAFE_IMPORT_SIZE / Math.max(1, smallestSide);
  const suggestedScale =
    status === 'tooSmall' || status === 'tight'
      ? Math.ceil(rawScale * 10) / 10
      : 1;

  return {
    status,
    width,
    height,
    smallestSide,
    minimum: CANVA_MIN_IMPORT_SIZE,
    suggestedScale,
    suggestedWidth: Math.round(width * suggestedScale),
    suggestedHeight: Math.round(height * suggestedScale),
  };
}

/**
 * The same check for one layer on its own — what Canva would measure if this
 * shape were the only thing in the file. The everyday export combines every
 * visible layer into one page, so this only bites when layers are exported
 * separately (one frame per shape); the Layers panel puts it behind a toggle
 * for that reason.
 *
 * Visibility is forced on so a hidden layer still reports its real size: hiding
 * a layer is not a statement about how big it is, and a layer that reads "fine"
 * only because it is hidden would be a trap on the way to exporting it.
 */
export function checkShapeImportSize(shape: VectorShape): ImportSizeCheckResult {
  // `dimensions` is only the fallback for artwork-free input, and a single
  // shape either has a path or is 'empty', so any size does here.
  return checkImportSize([{ ...shape, visible: true }], { width: 0, height: 0 });
}
