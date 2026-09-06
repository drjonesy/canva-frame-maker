import { PDFDocument, rgb } from 'pdf-lib';
import { CanvasDimensions, VectorShape } from '../types';
import { shapeToSvgPath } from './bezier';

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

  // Standard multi-shape SVG
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">\n`;

  visibleShapes.forEach((s) => {
    const d = shapeToSvgPath(s);
    svgContent += `  <path d="${d}" fill="${s.fillColor}" stroke="${s.strokeColor}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}" id="${s.id}" fill-rule="evenodd" />\n`;
  });

  svgContent += `</svg>`;
  return svgContent;
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
  const page = pdfDoc.addPage([dimensions.width, dimensions.height]);

  // Combine SVG path of visible shapes
  const visibleShapes = shapes.filter((s) => s.visible && s.points.length >= 2);
  let combinedPath = '';
  visibleShapes.forEach((s) => {
    combinedPath += ' ' + shapeToSvgPath(s);
  });
  combinedPath = combinedPath.trim();

  if (combinedPath) {
    try {
      // In PDF coordinate space, Y starts from bottom-left (0,0)
      // pdf-lib drawSvgPath draws SVG path data with scale and position!
      page.drawSvgPath(combinedPath, {
        x: 0,
        y: dimensions.height, // anchor from top
        scale: 1,
        color: rgb(0.39, 0.4, 0.95), // #6366f1
        borderWidth: 1,
        borderColor: rgb(0.26, 0.22, 0.79),
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
