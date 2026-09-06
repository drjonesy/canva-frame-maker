import React from 'react';
import { GuideAxis, Point2D } from '../types';
import { rulerStep } from '../utils/guides';
import { useTheme } from '../context/ThemeContext';

/** Thickness of each ruler band, in screen pixels. */
export const RULER_SIZE = 22;

interface Props {
  /** Viewport size in screen pixels. */
  width: number;
  height: number;
  zoom: number;
  /** Canvas coordinate sitting at viewport pixel 0, per axis. */
  originX: number;
  originY: number;
  /** Pointer position in canvas coordinates, tracked by a marker on each ruler. */
  mouse: Point2D;
  /** Pressing a ruler pulls out a guide: the top ruler a horizontal one ('y'). */
  onStartGuideDrag: (axis: GuideAxis, e: React.MouseEvent) => void;
}

interface Tick {
  /** Screen offset along the ruler. */
  pos: number;
  /** Canvas coordinate, shown as the label. */
  value: number;
  major: boolean;
}

/**
 * Ticks covering one axis of the viewport.
 *
 * Minor ticks subdivide the labelled step into five, which `rulerStep` keeps
 * at 12px or more on screen — close enough to read as a scale, far enough
 * apart not to smear into a solid band.
 */
function buildTicks(origin: number, lengthPx: number, zoom: number): Tick[] {
  const step = rulerStep(zoom);
  const minor = step / 5;
  const end = origin + lengthPx / zoom;
  const first = Math.floor(origin / minor) * minor;

  const ticks: Tick[] = [];
  for (let v = first; v <= end; v += minor) {
    // Fold away the drift that repeated float addition accumulates, so the
    // major test below stays exact.
    const value = Math.round(v * 1000) / 1000;
    ticks.push({
      pos: (value - origin) * zoom,
      value,
      major: Math.abs(value % step) < 1e-6,
    });
  }
  return ticks;
}

export const Rulers: React.FC<Props> = ({
  width,
  height,
  zoom,
  originX,
  originY,
  mouse,
  onStartGuideDrag,
}) => {
  const { isDark } = useTheme();

  const bg = isDark ? '#1A1A1A' : '#FFFFFF';
  const border = isDark ? '#2A2A2A' : '#E5E7EB';
  const tickColor = isDark ? '#4B4B4B' : '#C9CDD3';
  const majorTickColor = isDark ? '#6B6B6B' : '#9CA3AF';
  const labelColor = isDark ? '#8A8A8A' : '#6B7280';

  const hTicks = buildTicks(originX, width, zoom);
  const vTicks = buildTicks(originY, height, zoom);

  const mouseX = (mouse.x - originX) * zoom;
  const mouseY = (mouse.y - originY) * zoom;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Corner block, where the two rulers meet */}
      <div
        className="absolute top-0 left-0 border-r border-b"
        style={{
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: bg,
          borderColor: border,
        }}
      />

      {/* Top ruler — drag down for a horizontal guide */}
      <div
        className="absolute top-0 border-b pointer-events-auto cursor-ns-resize"
        style={{
          left: RULER_SIZE,
          right: 0,
          height: RULER_SIZE,
          background: bg,
          borderColor: border,
        }}
        onMouseDown={(e) => onStartGuideDrag('y', e)}
        title="Drag down to place a horizontal guide"
      >
        <svg
          width={Math.max(0, width - RULER_SIZE)}
          height={RULER_SIZE}
          className="block pointer-events-none"
        >
          {hTicks.map((t) => {
            const x = t.pos - RULER_SIZE + 0.5;
            if (x < 0 || x > width) return null;
            return (
              <g key={`h_${t.value}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={t.major ? RULER_SIZE - 9 : RULER_SIZE - 4}
                  y2={RULER_SIZE}
                  stroke={t.major ? majorTickColor : tickColor}
                  strokeWidth={1}
                />
                {t.major && (
                  <text
                    x={x + 3}
                    y={9}
                    fill={labelColor}
                    fontSize={9}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    {t.value}
                  </text>
                )}
              </g>
            );
          })}

          {/* Pointer marker */}
          <line
            x1={mouseX - RULER_SIZE + 0.5}
            x2={mouseX - RULER_SIZE + 0.5}
            y1={0}
            y2={RULER_SIZE}
            stroke="#F43F5E"
            strokeWidth={1}
          />
        </svg>
      </div>

      {/* Left ruler — drag right for a vertical guide */}
      <div
        className="absolute left-0 border-r pointer-events-auto cursor-ew-resize"
        style={{
          top: RULER_SIZE,
          bottom: 0,
          width: RULER_SIZE,
          background: bg,
          borderColor: border,
        }}
        onMouseDown={(e) => onStartGuideDrag('x', e)}
        title="Drag right to place a vertical guide"
      >
        <svg
          width={RULER_SIZE}
          height={Math.max(0, height - RULER_SIZE)}
          className="block pointer-events-none"
        >
          {vTicks.map((t) => {
            const y = t.pos - RULER_SIZE + 0.5;
            if (y < 0 || y > height) return null;
            return (
              <g key={`v_${t.value}`}>
                <line
                  y1={y}
                  y2={y}
                  x1={t.major ? RULER_SIZE - 9 : RULER_SIZE - 4}
                  x2={RULER_SIZE}
                  stroke={t.major ? majorTickColor : tickColor}
                  strokeWidth={1}
                />
                {t.major && (
                  // Rotated so the numbers read bottom-to-top, the convention
                  // every editor uses on a vertical ruler. Anchoring at the end
                  // makes the label hang below its tick rather than above it,
                  // which would clip the topmost one against the corner block.
                  <text
                    x={9}
                    y={y + 3}
                    fill={labelColor}
                    fontSize={9}
                    textAnchor="end"
                    fontFamily="'JetBrains Mono', monospace"
                    transform={`rotate(-90 9 ${y + 3})`}
                  >
                    {t.value}
                  </text>
                )}
              </g>
            );
          })}

          <line
            y1={mouseY - RULER_SIZE + 0.5}
            y2={mouseY - RULER_SIZE + 0.5}
            x1={0}
            x2={RULER_SIZE}
            stroke="#F43F5E"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
};
