import type { NodeSide } from '@/layout/types';
import { getBranchTheme } from '@/layout/theme';

interface CollapseHandleProps {
   collapsed: boolean;
   descendantCount: number;
   side: NodeSide;
   top: number;
   left: number;
   width: number;
   height: number;
   branchIndex: number;
   onToggle: () => void;
}

export function CollapseHandle({
   collapsed,
   descendantCount,
   side,
   top,
   left,
   width,
   height,
   branchIndex,
   onToggle,
}: CollapseHandleProps) {
   const branch = getBranchTheme(branchIndex);
   const handleSize = collapsed ? 26 : 18;
   const offset = collapsed ? 8 : 10;

   let x = left + width + offset;
   if (side === 'left') {
      x = left - offset - handleSize;
   } else if (side === 'center') {
      x = left + width + offset;
   }

   const y = top + height / 2 - handleSize / 2;

   return (
      <button
         type="button"
         className={`collapse-handle${collapsed ? ' collapse-handle--count' : ''}`}
         style={{ left: x, top: y, width: handleSize, height: handleSize }}
         aria-label={collapsed ? `Expand branch (${descendantCount} hidden)` : 'Collapse branch'}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={(event) => {
            event.stopPropagation();
            onToggle();
         }}
      >
         {collapsed && descendantCount > 0 ? (
            <span
               className="collapse-handle__count"
               style={{ borderColor: branch.color, color: branch.color }}
            >
               {descendantCount}
            </span>
         ) : (
            <span className="collapse-handle__symbol">−</span>
         )}
      </button>
   );
}
