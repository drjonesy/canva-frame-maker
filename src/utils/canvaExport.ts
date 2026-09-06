import { PDFDocument, rgb } from 'pdf-lib';
import { CanvasDimensions, VectorShape } from '../types';
import { shapeToSvgPath } from './bezier';
import svgPath from 'svgpath';

/**
 * Standard Canva Frame placeholder graphic (the classic rolling hills and cloud SVG)
 */
export function generateCanvaPlaceholderSvg(
  width: number,
  height: number,
  clipPathId: string,
  pathData: string
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <clipPath id="${clipPathId}" clipRule="evenodd">
      <path d="${pathData}" />
    </clipPath>
    <!-- Canva Frame Characteristic Sky Gradient -->
    <linearGradient id="canvaSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4ea8de" />
      <stop offset="40%" stop-color="#72efdd" />
      <stop offset="70%" stop-color="#9bf6ff" />
      <stop offset="100%" stop-color="#bdf0e4" />
    </linearGradient>
    <!-- Canva Frame Grass Gradient -->
    <linearGradient id="canvaGrassGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#55a630" />
      <stop offset="100%" stop-color="#2b9348" />
    </linearGradient>
    <linearGradient id="canvaGrassGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#80b918" />
      <stop offset="100%" stop-color="#38b000" />
    </linearGradient>
  </defs>

  <g clip-path="url(#${clipPathId})">
    <!-- Sky Background -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#canvaSkyGrad)" />
    
    <!-- Sun -->
    <circle cx="${width * 0.8}" cy="${height * 0.25}" r="${Math.min(width, height) * 0.08}" fill="#ffd166" opacity="0.9" />

    <!-- Clouds -->
    <g fill="#ffffff" opacity="0.85">
      <ellipse cx="${width * 0.35}" cy="${height * 0.28}" rx="${width * 0.12}" ry="${height * 0.06}" />
      <ellipse cx="${width * 0.45}" cy="${height * 0.25}" rx="${width * 0.14}" ry="${height * 0.07}" />
      <ellipse cx="${width * 0.55}" cy="${height * 0.28}" rx="${width * 0.1}" ry="${height * 0.05}" />
    </g>

    <!-- Back Hill -->
    <path d="M -${width * 0.2} ${height} Q ${width * 0.3} ${height * 0.45} ${width * 0.9} ${height} Z" fill="url(#canvaGrassGrad1)" />

    <!-- Front Hill -->
    <path d="M ${width * 0.1} ${height} Q ${width * 0.65} ${height * 0.4} ${width * 1.3} ${height} Z" fill="url(#canvaGrassGrad2)" />

    <!-- Overlay hint for Canva Frame drag and drop -->
    <text x="${width / 2}" y="${height / 2}" font-family="system-ui, sans-serif" font-size="${Math.max(14, Math.min(width, height) * 0.04)}" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.6" style="text-shadow: 0 1px 3px rgba(0,0,0,0.3)">
      Canva Frame
    </text>
  </g>
</svg>`;
}

/**
 * Bounding box of path data, control points included. There is no artboard any
 * more, so the export is framed by the artwork itself. Control points make the
 * box a conservative superset of the curve, which cannot clip the shape.
 */
function pathBounds(d: string): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  svgPath(d)
    .unarc()
    .unshort()
    .abs()
    .iterate((seg) => {
      for (let i = 1; i + 1 < seg.length; i += 2) {
        const x = seg[i] as number;
        const y = seg[i + 1] as number;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    });

  if (!isFinite(minX) || !isFinite(minY)) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Generate full SVG string for exporting
 */
export function exportShapesToSvg(
  shapes: VectorShape[],
  dimensions: CanvasDimensions,
  asCanvaFramePlaceholder = true
): string {
  const visibleShapes = shapes.filter((s) => s.visible && s.points.length >= 2);
  const clipId = 'canva_frame_clip_' + Date.now();

  // Combine paths
  let combinedPath = '';
  visibleShapes.forEach((s) => {
    combinedPath += ' ' + shapeToSvgPath(s);
  });
  combinedPath = combinedPath.trim();

  if (asCanvaFramePlaceholder && combinedPath) {
    return generateCanvaPlaceholderSvg(
      dimensions.width,
      dimensions.height,
      clipId,
      combinedPath
    );
  }

  if (!combinedPath) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}"></svg>`;
  }

  // Everything visible on the canvas as ONE object, cropped to the artwork:
  // a single compound path, no background rect, no stroke and no artboard box.
  const bounds = pathBounds(combinedPath);
  const framed = svgPath(combinedPath).translate(-bounds.minX, -bounds.minY).round(3).toString();
  const w = Math.max(1, Math.round(bounds.width));
  const h = Math.max(1, Math.round(bounds.height));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <path d="${framed}" fill="#000000" fill-rule="evenodd" id="canva_frame" />
</svg>`;
}

/**
 * Export to Canva Frame PDF format
 * In Canva, vector clipping paths in PDFs are parsed and automatically transformed into Canva Frames!
 */
export async function exportToCanvaPdf(
  shapes: VectorShape[],
  dimensions: CanvasDimensions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Combine SVG path of visible shapes
  const visibleShapes = shapes.filter((s) => s.visible && s.points.length >= 2);
  let combinedPath = '';
  visibleShapes.forEach((s) => {
    combinedPath += ' ' + shapeToSvgPath(s);
  });
  combinedPath = combinedPath.trim();

  // Size the page to the artwork rather than to a canvas that no longer exists.
  const bounds = combinedPath
    ? pathBounds(combinedPath)
    : { minX: 0, minY: 0, width: dimensions.width, height: dimensions.height };
  const pageW = Math.max(1, Math.round(bounds.width));
  const pageH = Math.max(1, Math.round(bounds.height));
  const page = pdfDoc.addPage([pageW, pageH]);

  if (combinedPath) {
    try {
      const framed = svgPath(combinedPath)
        .translate(-bounds.minX, -bounds.minY)
        .round(3)
        .toString();
      // In PDF coordinate space, Y starts from bottom-left (0,0)
      // pdf-lib drawSvgPath draws SVG path data with scale and position!
      page.drawSvgPath(framed, {
        x: 0,
        y: pageH, // anchor from top
        scale: 1,
        color: rgb(0, 0, 0),
        borderWidth: 0,
      });
    } catch (e) {
      console.warn('drawSvgPath in pdf-lib warning, fallback to shapes:', e);
    }
  }

  // Set PDF metadata for Canva parser recognition
  pdfDoc.setTitle('Canva Frame Custom Export');
  pdfDoc.setAuthor('Canva Frame Maker');
  pdfDoc.setSubject('Canva Vector Frame Clipping Path');
  pdfDoc.setProducer('Canva Frame Maker Web Tool');

  return await pdfDoc.save();
}

/**
 * Triggers file download in the browser
 */
export function downloadFile(
  content: BlobPart,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
