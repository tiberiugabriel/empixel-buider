import React, { useCallback, useState } from "react";
import { useDraggable, useDroppable, useDndContext } from "@dnd-kit/core";
import type { SectionBlock } from "../types.js";
import { isContainerType } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StructureDropTarget = {
  id: string;
  position: "before" | "after" | "inside";
} | null;

interface StructurePanelProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  dropTarget: StructureDropTarget;
  style?: React.CSSProperties;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconChevronDown() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1.5L6 4.5L3 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevronDown10() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevronUp10() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── StructureRow ─────────────────────────────────────────────────────────────

interface StructureRowProps {
  block: SectionBlock;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dropTarget: StructureDropTarget;
}

function StructureRow({ block, depth, selectedId, onSelect, dropTarget }: StructureRowProps) {
  const def = getBlockDef(block.type);
  const isContainer = isContainerType(block.type);
  const isSelected = block.id === selectedId;
  const [isExpanded, setIsExpanded] = useState(true);

  const { active } = useDndContext();
  const activeDragBlockId = (active?.data.current as { blockId?: string } | undefined)?.blockId;
  const isActiveDrag = activeDragBlockId === block.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `struct-drag:${block.id}`,
    data: { kind: "structure-block", blockId: block.id },
  });

  // Single droppable per row — position (before/after/inside) computed from pointer Y in handleDragOver
  const { setNodeRef: setDropRef } = useDroppable({
    id: `struct-row:${block.id}`,
    data: { kind: "struct-row", blockId: block.id, isContainer },
  });

  const rowRef = useCallback((el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  }, [setDragRef, setDropRef]);

  const children = block.children ?? [];
  const slotChildren = block.slots ? block.slots.flat() : [];
  const allChildren = [...children, ...slotChildren];

  const zoneIndent = depth * 16 + 8;
  const isDropBefore = !isActiveDrag && dropTarget?.id === block.id && dropTarget.position === "before";
  const isDropAfter  = !isActiveDrag && dropTarget?.id === block.id && dropTarget.position === "after";
  const isDropInside = !isActiveDrag && dropTarget?.id === block.id && dropTarget.position === "inside";

  return (
    <div className="epx-structure-row-wrapper">
      {isDropBefore && (
        <div className="epx-structure-drop-line" style={{ marginLeft: zoneIndent }} />
      )}

      <div
        ref={rowRef}
        className={`epx-structure-row${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isDropInside ? " is-drop-inside" : ""}`}
        style={{ paddingLeft: zoneIndent }}
        onClick={() => onSelect(block.id)}
      >
        {isContainer && (
          <button
            className="epx-structure-row__expand-btn"
            onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}
            type="button"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
          </button>
        )}
        <span className="epx-structure-row__icon">{def?.icon ?? "□"}</span>
        <span className="epx-structure-row__label" {...listeners} {...attributes}>
          {def?.label ?? block.type}
        </span>
      </div>

      {isExpanded && allChildren.map((child) => (
        <StructureRow
          key={child.id}
          block={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          dropTarget={dropTarget}
        />
      ))}

      {isDropAfter && (
        <div className="epx-structure-drop-line" style={{ marginLeft: zoneIndent }} />
      )}
    </div>
  );
}

// ─── StructurePanel ───────────────────────────────────────────────────────────

export function StructurePanel({ sections, selectedId, onSelect, isCollapsed, onToggleCollapse, dropTarget, style }: StructurePanelProps) {
  return (
    <div className="epx-structure-panel" style={style}>
      <div className="epx-structure-panel__header">
        <span className="epx-structure-panel__title">Structure</span>
        <button
          className="epx-structure-panel__collapse-btn"
          onClick={onToggleCollapse}
          type="button"
          title={isCollapsed ? "Expand structure" : "Collapse structure"}
          aria-label={isCollapsed ? "Expand structure" : "Collapse structure"}
        >
          {isCollapsed ? <IconChevronUp10 /> : <IconChevronDown10 />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="epx-structure-panel__body">
          {sections.length === 0 ? (
            <div className="epx-structure-panel__empty">No blocks yet</div>
          ) : (
            sections.map((block) => (
              <StructureRow
                key={block.id}
                block={block}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
                dropTarget={dropTarget}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
