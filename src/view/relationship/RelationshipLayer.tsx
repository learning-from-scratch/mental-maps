import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Relationship, TopicId, Vec2 } from '@/core/model/types';
import type { NodeLayout, Rect } from '@/layout/types';
import {
  controlsForDirectedAnchor,
  snapAnchorToDirectedSide,
  relationshipMidpoint,
  relationshipPath,
  resolveRelationshipGeometry,
  draftRelationshipGeometry,
  findNodeAtPoint,
  type RelationshipGeometry,
} from '@/layout/relationshipGeometry';
import { DEFAULT_RELATIONSHIP_COLOR, DEFAULT_RELATIONSHIP_LABEL, hasOfficialRelationshipLabel } from '@/core/model/relationships';

export type RelationshipDraft = {
  fromId: TopicId;
  cursor: Vec2;
};

const RELATIONSHIP_ARROW_SIZE = 5;

function relationshipArrowMarkerPath(): string {
  const tip = RELATIONSHIP_ARROW_SIZE;
  const mid = tip / 2;
  return `M 0 0 L ${tip} ${mid} L 0 ${tip} z`;
}

interface RelationshipLayerProps {
  relationships: Relationship[];
  nodes: Map<TopicId, NodeLayout>;
  bounds: Rect;
  draft: RelationshipDraft | null;
  selectedRelationshipId: string | null;
  zoom: number;
  onSelectRelationship: (relationshipId: string | null) => void;
  onUpdateRelationship: (relationshipId: string, patch: Partial<Relationship>) => void;
}

function RelationshipLabel({
  label,
  left,
  top,
  bounds,
  selected,
  onSelect,
  onCommit,
  onDeselect,
}: {
  label: string;
  left: number;
  top: number;
  bounds: Rect;
  selected: boolean;
  onSelect: () => void;
  onCommit: (label: string) => void;
  onDeselect: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLSpanElement>(null);

  const commit = useCallback(() => {
    if (!isEditing) return;
    const next = editorRef.current?.textContent?.trim() ?? '';
    onCommit(next);
    setIsEditing(false);
  }, [isEditing, onCommit]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = label;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, label]);

  useLayoutEffect(() => {
    if (!isEditing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapRef.current?.contains(target)) return;
      commit();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isEditing, commit]);

  return (
    <div
      ref={wrapRef}
      className={`relationship-layer__label-wrap${selected ? ' relationship-layer__label-wrap--selected' : ''}`}
      style={{ left: left - bounds.x, top: top - bounds.y, transform: 'translate(-50%, -50%)' }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {isEditing ? (
        <span
          ref={editorRef}
          className="relationship-layer__label relationship-layer__label--editing"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
              onDeselect();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <span
          className="relationship-layer__label"
          onDoubleClick={(event) => {
            event.stopPropagation();
            onSelect();
            setIsEditing(true);
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

type DragKind = 'from-anchor' | 'to-anchor' | 'from-control' | 'to-control';

function RelationshipEditor({
  relationship,
  geometry,
  nodes,
  zoom,
  onUpdate,
}: {
  relationship: Relationship;
  geometry: RelationshipGeometry;
  nodes: Map<TopicId, NodeLayout>;
  zoom: number;
  onUpdate: (patch: Partial<Relationship>) => void;
}) {
  const dragRef = useRef<{
    kind: DragKind;
    pointerId: number;
    startWorld: Vec2;
    startGeometry: RelationshipGeometry;
  } | null>(null);

  const beginDrag = (kind: DragKind, event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      pointerId: event.pointerId,
      startWorld: { x: event.clientX, y: event.clientY },
      startGeometry: geometry,
    };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = (event.clientX - drag.startWorld.x) / zoom;
    const dy = (event.clientY - drag.startWorld.y) / zoom;
    const fromNode = nodes.get(relationship.fromId);
    const toNode = nodes.get(relationship.toId);
    if (!fromNode || !toNode) return;

    const start = drag.startGeometry;

    if (drag.kind === 'from-anchor') {
      const point = { x: start.from.x + dx, y: start.from.y + dy };
      const { anchor: fromAnchor, side: fromSide } = snapAnchorToDirectedSide(fromNode, point);
      const toAnchor = relationship.toAnchor ?? start.toAnchor;
      onUpdate(
        controlsForDirectedAnchor(
          fromNode,
          toNode,
          fromAnchor,
          toAnchor,
          fromSide,
          relationship.toSide,
        ),
      );
      return;
    }

    if (drag.kind === 'to-anchor') {
      const point = { x: start.to.x + dx, y: start.to.y + dy };
      const { anchor: toAnchor, side: toSide } = snapAnchorToDirectedSide(toNode, point);
      const fromAnchor = relationship.fromAnchor ?? start.fromAnchor;
      onUpdate(
        controlsForDirectedAnchor(
          fromNode,
          toNode,
          fromAnchor,
          toAnchor,
          relationship.fromSide,
          toSide,
        ),
      );
      return;
    }

    if (drag.kind === 'from-control') {
      onUpdate({
        controlOffsets: [
          { x: start.controlOffsets[0].x + dx, y: start.controlOffsets[0].y + dy },
          start.controlOffsets[1],
        ],
        fromAnchor: relationship.fromAnchor ?? start.fromAnchor,
        toAnchor: relationship.toAnchor ?? start.toAnchor,
      });
      return;
    }

    onUpdate({
      controlOffsets: [
        start.controlOffsets[0],
        { x: start.controlOffsets[1].x + dx, y: start.controlOffsets[1].y + dy },
      ],
      fromAnchor: relationship.fromAnchor ?? start.fromAnchor,
      toAnchor: relationship.toAnchor ?? start.toAnchor,
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    (event.currentTarget as SVGElement).releasePointerCapture(event.pointerId);
  };

  return (
    <g className="relationship-layer__handles" pointerEvents="auto">
      <line
        className="relationship-layer__handle-stalk"
        x1={geometry.from.x}
        y1={geometry.from.y}
        x2={geometry.control1.x}
        y2={geometry.control1.y}
      />
      <line
        className="relationship-layer__handle-stalk"
        x1={geometry.to.x}
        y1={geometry.to.y}
        x2={geometry.control2.x}
        y2={geometry.control2.y}
      />
      <circle
        className="relationship-layer__handle relationship-layer__handle--anchor"
        cx={geometry.from.x}
        cy={geometry.from.y}
        r={5}
        onPointerDown={(event) => beginDrag('from-anchor', event)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      />
      <circle
        className="relationship-layer__handle relationship-layer__handle--anchor"
        cx={geometry.to.x}
        cy={geometry.to.y}
        r={5}
        onPointerDown={(event) => beginDrag('to-anchor', event)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      />
      <rect
        className="relationship-layer__handle relationship-layer__handle--control"
        x={geometry.control1.x - 4}
        y={geometry.control1.y - 4}
        width={8}
        height={8}
        onPointerDown={(event) => beginDrag('from-control', event)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      />
      <rect
        className="relationship-layer__handle relationship-layer__handle--control"
        x={geometry.control2.x - 4}
        y={geometry.control2.y - 4}
        width={8}
        height={8}
        onPointerDown={(event) => beginDrag('to-control', event)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      />
    </g>
  );
}

function RelationshipPath({
  id,
  path,
  color,
  dashed,
  selected,
  onSelect,
}: {
  id: string;
  path: string;
  color: string;
  dashed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <g className={`relationship-layer__path-group${selected ? ' relationship-layer__path-group--selected' : ''}`}>
      <path
        d={path}
        className="relationship-layer__path-hit"
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        pointerEvents="stroke"
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
      {selected ? (
        <path
          d={path}
          className="relationship-layer__path-glow"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={dashed ? '6 5' : undefined}
          fill="none"
          opacity={0.18}
          pointerEvents="none"
        />
      ) : null}
      <path
        d={path}
        className="relationship-layer__path"
        stroke={color}
        strokeWidth={selected ? 2.5 : 2}
        strokeDasharray={dashed ? '6 5' : undefined}
        fill="none"
        markerEnd={`url(#relationship-arrow-${id})`}
        pointerEvents="none"
      />
    </g>
  );
}

export function RelationshipLayer({
  relationships,
  nodes,
  bounds,
  draft,
  selectedRelationshipId,
  zoom,
  onSelectRelationship,
  onUpdateRelationship,
}: RelationshipLayerProps) {
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);

  const resolved = relationships
    .map((relationship) => {
      const fromNode = nodes.get(relationship.fromId);
      const toNode = nodes.get(relationship.toId);
      if (!fromNode || !toNode) return null;
      const geometry = resolveRelationshipGeometry(relationship, fromNode, toNode);
      const midpoint = relationshipMidpoint(geometry);
      return { relationship, geometry, midpoint };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  let draftGeometry: RelationshipGeometry | null = null;
  if (draft) {
    const fromNode = nodes.get(draft.fromId);
    if (fromNode) {
      const hoverNode = findNodeAtPoint(nodes, draft.cursor, draft.fromId);
      draftGeometry = draftRelationshipGeometry(fromNode, draft.cursor, hoverNode ?? undefined);
    }
  }

  return (
    <div
      className="relationship-layer"
      style={{ left: 0, top: 0, width, height } as CSSProperties}
    >
      <svg
        className="relationship-layer__svg"
        viewBox={`${bounds.x} ${bounds.y} ${width} ${height}`}
        style={{ left: 0, top: 0, width, height }}
      >
        <defs>
          {resolved.map(({ relationship }) => (
            <marker
              key={relationship.id}
              id={`relationship-arrow-${relationship.id}`}
              markerWidth={RELATIONSHIP_ARROW_SIZE}
              markerHeight={RELATIONSHIP_ARROW_SIZE}
              refX={RELATIONSHIP_ARROW_SIZE - 0.5}
              refY={RELATIONSHIP_ARROW_SIZE / 2}
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d={relationshipArrowMarkerPath()}
                fill={relationship.style?.color ?? DEFAULT_RELATIONSHIP_COLOR}
              />
            </marker>
          ))}
          {draftGeometry ? (
            <marker
              id="relationship-arrow-draft"
              markerWidth={RELATIONSHIP_ARROW_SIZE}
              markerHeight={RELATIONSHIP_ARROW_SIZE}
              refX={RELATIONSHIP_ARROW_SIZE - 0.5}
              refY={RELATIONSHIP_ARROW_SIZE / 2}
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d={relationshipArrowMarkerPath()} fill={DEFAULT_RELATIONSHIP_COLOR} />
            </marker>
          ) : null}
        </defs>

        {resolved.map(({ relationship, geometry }) => (
          <RelationshipPath
            key={relationship.id}
            id={relationship.id}
            path={relationshipPath(geometry)}
            color={relationship.style?.color ?? DEFAULT_RELATIONSHIP_COLOR}
            dashed={relationship.style?.lineStyle !== 'solid'}
            selected={relationship.id === selectedRelationshipId}
            onSelect={() => onSelectRelationship(relationship.id)}
          />
        ))}

        {draftGeometry ? (
          <path
            d={relationshipPath(draftGeometry)}
            className="relationship-layer__path relationship-layer__path--draft"
            stroke={DEFAULT_RELATIONSHIP_COLOR}
            strokeWidth={2}
            strokeDasharray="6 5"
            fill="none"
            markerEnd="url(#relationship-arrow-draft)"
            pointerEvents="none"
          />
        ) : null}

        {resolved
          .filter(({ relationship }) => relationship.id === selectedRelationshipId)
          .map(({ relationship, geometry }) => (
            <RelationshipEditor
              key={`${relationship.id}-editor`}
              relationship={relationship}
              geometry={geometry}
              nodes={nodes}
              zoom={zoom}
              onUpdate={(patch) => onUpdateRelationship(relationship.id, patch)}
            />
          ))}
      </svg>

      {resolved.map(({ relationship, midpoint }) => {
        const selected = relationship.id === selectedRelationshipId;
        const official = hasOfficialRelationshipLabel(relationship.label);
        if (!selected && !official) return null;

        const label = official
          ? relationship.label!.trim()
          : DEFAULT_RELATIONSHIP_LABEL;

        return (
          <RelationshipLabel
            key={`${relationship.id}-label`}
            label={label}
            left={midpoint.x}
            top={midpoint.y}
            bounds={bounds}
            selected={selected}
            onSelect={() => onSelectRelationship(relationship.id)}
            onCommit={(nextLabel) =>
              onUpdateRelationship(relationship.id, { label: nextLabel || undefined })
            }
            onDeselect={() => onSelectRelationship(null)}
          />
        );
      })}
    </div>
  );
}
