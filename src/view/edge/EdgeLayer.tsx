import { useId } from 'react';
import { ROOT_MASK_RADIUS } from '@/layout/edges';
import type { EdgeLayout, Rect } from '@/layout/types';

interface EdgeLayerProps {
   edges: EdgeLayout[];
   bounds: Rect;
   rootExclusion?: Rect;
}

function EdgePaths({ edges }: { edges: EdgeLayout[] }) {
   return (
      <>
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
      </>
   );
}

export function EdgeLayer({ edges, bounds, rootExclusion }: EdgeLayerProps) {
   const maskId = useId().replace(/:/g, '');
   const width = Math.max(bounds.width, 1);
   const height = Math.max(bounds.height, 1);
   const rootPadding = 8;
   const maskedEdges = edges.filter((edge) => !edge.maskExempt);
   const unmaskedEdges = edges.filter((edge) => edge.maskExempt);

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
                     rx={ROOT_MASK_RADIUS}
                     ry={ROOT_MASK_RADIUS}
                     fill="black"
                  />
               </mask>
            </defs>
         )}
         <g mask={rootExclusion ? `url(#${maskId})` : undefined}>
            <EdgePaths edges={maskedEdges} />
         </g>
         <EdgePaths edges={unmaskedEdges} />
      </svg>
   );
}
