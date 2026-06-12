import type { NodeSide } from '@/layout/types';
import { DEFAULT_MAP_THEME_ID, getBranchTheme } from '@/layout/theme';

interface CollapseHandleProps {
   topicId: string;
   collapsed: boolean;
   descendantCount: number;
   side: NodeSide;
   top: number;
   height: number;
   centerX: number;
   branchIndex: number;
   themeId?: string;
   visible?: boolean;
   onHoverChange?: (hovered: boolean) => void;
   onToggle: () => void;
}

export function CollapseHandle({
   topicId,
   collapsed,
   descendantCount,
   top,
   height,
   centerX,
   branchIndex,
   themeId = DEFAULT_MAP_THEME_ID,
   visible = false,
   onHoverChange,
   onToggle,
}: CollapseHandleProps) {
   const branch = getBranchTheme(branchIndex, themeId);
   const handleSize = collapsed ? 20 : 18;

   const midY = top + height / 2;
   const handleX = centerX - handleSize / 2;
   const handleY = midY - handleSize / 2;
   const wrapHeight = Math.max(height, 40);
   const wrapTop = midY - wrapHeight / 2;
   const wrapWidth = Math.max(handleSize + 32, 48);
   const wrapX = centerX - wrapWidth / 2;

   const showsCount = collapsed && descendantCount > 0;

   return (
      <div
         className={[
            'collapse-handle-wrap',
            visible && 'collapse-handle-wrap--visible',
            showsCount && 'collapse-handle-wrap--count',
         ]
            .filter(Boolean)
            .join(' ')}
         data-collapse-topic={topicId}
         style={{
            left: wrapX,
            top: wrapTop,
            width: wrapWidth,
            height: wrapHeight,
         }}
         onPointerEnter={() => onHoverChange?.(true)}
         onPointerLeave={() => onHoverChange?.(false)}
      >
         <button
            type="button"
            className={`collapse-handle${showsCount ? ' collapse-handle--count' : ''}`}
            style={{
               left: handleX - wrapX,
               top: handleY - wrapTop,
               width: handleSize,
               height: handleSize,
            }}
            aria-label={collapsed ? `Expand branch (${descendantCount} hidden)` : 'Collapse branch'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
               event.stopPropagation();
               onToggle();
            }}
         >
            {showsCount ? (
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
      </div>
   );
}
