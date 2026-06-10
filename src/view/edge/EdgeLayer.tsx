import { useId } from 'react';
import type { EdgeLayout, Rect } from '@/layout/types';

interface EdgeLayerProps {
  edges: EdgeLayout[];
  bounds: Rect;
  rootExclusion?: Rect;
}

export function EdgeLayer({ edges, bounds, rootExclusion }: EdgeLayerProps) {
  const maskId = useId().replace(/:/g, '');
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const rootPadding = 8;

  return (
    <svg
      className="edge-layer"
      style={{
        left: 0,
        top: 0,
        width,
        height,
      }}
      viewBox={`${bounds.x} ${bounds.y} ${width} ${height}`}
    >
      {rootExclusion && (
        <defs>
          <mask id={maskId}>
            <rect
              x={bounds.x}
              y={bounds.y}
              width={width}
              height={height}
              fill="white"
            />
            <rect
              x={rootExclusion.x - rootPadding}
              y={rootExclusion.y - rootPadding}
              width={rootExclusion.width + rootPadding * 2}
              height={rootExclusion.height + rootPadding * 2}
              rx={12}
              ry={12}
              fill="black"
            />
          </mask>
        </defs>
      )}
      <g mask={rootExclusion ? `url(#${maskId})` : undefined}>
        {edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            className="edge-layer__path"
            stroke={edge.color}
            strokeWidth={edge.strokeWidth ?? 2}
            fill="none"
          />
        ))}
      </g>
    </svg>
  );
}
