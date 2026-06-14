import { useId, useMemo } from 'react';
import type { Sheet } from '@/core/model/types';
import { layoutSheet } from '@/layout';
import { getBranchTheme, getMapCanvasStyle, resolveSheetThemeId } from '@/layout/theme';

const THUMB_WIDTH = 180;
const THUMB_HEIGHT = 120;
const THUMB_PADDING = 10;
/** Dot grid in thumbnail pixel space (scaled down from editor's 22px). */
const THUMB_DOT_SPACING = 10;
const THUMB_DOT_RADIUS = 0.9;

interface MapThumbnailProps {
  sheet: Sheet;
}

export function MapThumbnail({ sheet }: MapThumbnailProps) {
  const patternId = useId().replace(/:/g, '');
  const themeId = resolveSheetThemeId(sheet.theme);
  const canvasStyle = getMapCanvasStyle(themeId);
  const showDots = sheet.canvasDotsEnabled ?? true;
  const layout = useMemo(() => layoutSheet(sheet, undefined, themeId), [sheet, themeId]);

  const contentPadding = 24;
  const contentX = layout.bounds.x - contentPadding;
  const contentY = layout.bounds.y - contentPadding;
  const contentWidth = Math.max(layout.bounds.width + contentPadding * 2, 1);
  const contentHeight = Math.max(layout.bounds.height + contentPadding * 2, 1);

  const innerWidth = THUMB_WIDTH - THUMB_PADDING * 2;
  const innerHeight = THUMB_HEIGHT - THUMB_PADDING * 2;
  const scale = Math.min(innerWidth / contentWidth, innerHeight / contentHeight);
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const offsetX = (THUMB_WIDTH - scaledWidth) / 2;
  const offsetY = (THUMB_HEIGHT - scaledHeight) / 2;
  const mapTransform = `translate(${offsetX} ${offsetY}) scale(${scale}) translate(${-contentX} ${-contentY})`;

  const nodes = Array.from(layout.nodes.entries());

  return (
    <svg
      className="map-thumbnail__svg"
      viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        {showDots ? (
          <pattern
            id={patternId}
            x={0}
            y={0}
            width={THUMB_DOT_SPACING}
            height={THUMB_DOT_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={THUMB_DOT_SPACING / 2}
              cy={THUMB_DOT_SPACING / 2}
              r={THUMB_DOT_RADIUS}
              fill={canvasStyle.dotColor}
            />
          </pattern>
        ) : null}
      </defs>

      <rect x={0} y={0} width={THUMB_WIDTH} height={THUMB_HEIGHT} fill={canvasStyle.background} />
      {showDots ? (
        <rect x={0} y={0} width={THUMB_WIDTH} height={THUMB_HEIGHT} fill={`url(#${patternId})`} />
      ) : null}

      <g transform={mapTransform}>
        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            stroke={edge.color}
            strokeWidth={edge.strokeWidth ?? 2}
            fill="none"
          />
        ))}
        {nodes.map(([topicId, node]) => {
          const isRoot = node.depth === 0;
          const isMain = node.depth === 1;
          const isLevel2 = node.depth === 2;
          const isDeepChild = node.depth >= 3;
          const branch = getBranchTheme(node.branchIndex, themeId);

          let fill: string | 'none' = 'none';
          let textColor = '#2d2d2d';
          let fontWeight: number | undefined;

          if (isMain) {
            fill = branch.color;
            textColor = branch.textOnMain;
          } else if (isLevel2) {
            fill = branch.light;
            textColor = '#2d2d2d';
          } else if (isRoot) {
            fill = 'none';
            textColor = '#1a1a1a';
            fontWeight = 700;
          } else if (isDeepChild) {
            fill = 'none';
            textColor = '#2d2d2d';
          }

          const label = node.lines[0] ?? '';
          const truncated = label.length > 14 ? `${label.slice(0, 13)}…` : label;

          return (
            <g key={topicId}>
              {fill !== 'none' ? (
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={isMain ? 8 : isLevel2 ? 6 : 5}
                  fill={fill}
                />
              ) : null}
              {truncated ? (
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={textColor}
                  fontWeight={fontWeight}
                  fontSize={Math.max(node.fontSize * 0.75, 8)}
                  fontFamily="system-ui, sans-serif"
                >
                  {truncated}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
