import React, { memo, useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SectionBlock, BlockType } from "../types.js";
import { isContainerType } from "../types.js";
import { PREVIEW_COMPONENTS } from "./previews/index.js";
import { BlockOverlay } from "./BlockOverlay.js";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";

export const CANVAS_DROP_ID = "canvas-drop";

// ─── Drag data types (exported for BuilderPage) ───────────────────────────────

export type BlockDragData = {
  kind: "block";
  containerId: string | null;
  slotIndex: number | null;
  isContainer: boolean;
};

export type EmptyZoneData = {
  kind: "empty-zone";
  containerId: string;
  slotIndex: number | null;
};

// ─── Leaf block defs (no containers) ─────────────────────────────────────────

const LEAF_BLOCK_DEFS = BLOCK_DEFINITIONS.filter((d) => !isContainerType(d.type));

// ─── Style helpers ────────────────────────────────────────────────────────────

const BORDER_RADIUS_MAP: Record<string, string> = {
  none: "0", sm: "4px", md: "8px", lg: "16px", full: "9999px",
};

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: "640px", md: "768px", lg: "1140px", full: "100%",
};

function css(v: unknown): string | number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return v.startsWith("@@") ? v.slice(2) || undefined : v;
  return undefined;
}

function resolveBlockStyle(style: Record<string, unknown> | undefined): {
  outerStyle: React.CSSProperties;
  innerStyle: React.CSSProperties;
} {
  if (!style) return { outerStyle: {}, innerStyle: {} };
  const outerStyle: React.CSSProperties = {};
  if (css(style.marginTop) !== undefined)    outerStyle.marginTop    = css(style.marginTop)    as string | number;
  if (css(style.marginRight) !== undefined)  outerStyle.marginRight  = css(style.marginRight)  as string | number;
  if (css(style.marginBottom) !== undefined) outerStyle.marginBottom = css(style.marginBottom) as string | number;
  if (css(style.marginLeft) !== undefined)   outerStyle.marginLeft   = css(style.marginLeft)   as string | number;
  const innerStyle: React.CSSProperties = {};
  if (css(style.width) !== undefined)     innerStyle.width     = css(style.width)     as string;
  if (css(style.minWidth) !== undefined)  innerStyle.minWidth  = css(style.minWidth)  as string;
  if (css(style.height) !== undefined)    innerStyle.height    = css(style.height)    as string;
  if (css(style.minHeight) !== undefined) innerStyle.minHeight = css(style.minHeight) as string;
  if (css(style.maxHeight) !== undefined) innerStyle.maxHeight = css(style.maxHeight) as string;
  if (css(style.paddingTop) !== undefined) innerStyle.paddingTop = css(style.paddingTop) as string | number;
  if (css(style.paddingRight) !== undefined) innerStyle.paddingRight = css(style.paddingRight) as string | number;
  if (css(style.paddingBottom) !== undefined) innerStyle.paddingBottom = css(style.paddingBottom) as string | number;
  if (css(style.paddingLeft) !== undefined) innerStyle.paddingLeft = css(style.paddingLeft) as string | number;
  if (style.borderRadius && BORDER_RADIUS_MAP[style.borderRadius as string]) {
    innerStyle.borderRadius = BORDER_RADIUS_MAP[style.borderRadius as string];
  }
  if (css(style.borderTopLeftRadius))     innerStyle.borderTopLeftRadius     = css(style.borderTopLeftRadius)     as string;
  if (css(style.borderTopRightRadius))    innerStyle.borderTopRightRadius    = css(style.borderTopRightRadius)    as string;
  if (css(style.borderBottomRightRadius)) innerStyle.borderBottomRightRadius = css(style.borderBottomRightRadius) as string;
  if (css(style.borderBottomLeftRadius))  innerStyle.borderBottomLeftRadius  = css(style.borderBottomLeftRadius)  as string;
  if (css(style.borderTopWidth))    innerStyle.borderTopWidth    = css(style.borderTopWidth)    as string;
  if (css(style.borderRightWidth))  innerStyle.borderRightWidth  = css(style.borderRightWidth)  as string;
  if (css(style.borderBottomWidth)) innerStyle.borderBottomWidth = css(style.borderBottomWidth) as string;
  if (css(style.borderLeftWidth))   innerStyle.borderLeftWidth   = css(style.borderLeftWidth)   as string;
  if (css(style.borderStyle))       innerStyle.borderStyle       = css(style.borderStyle)       as string;
  if (css(style.borderColor)) {
    const color = css(style.borderColor) as string;
    const alpha = typeof style.borderAlpha === "number" ? style.borderAlpha : 1;
    if (alpha < 1) {
      const hex = color.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      innerStyle.borderColor = `rgba(${r},${g},${b},${alpha})`;
    } else {
      innerStyle.borderColor = color;
    }
  }
  if (style.maxWidth) {
    const mw = style.maxWidth as string;
    if (MAX_WIDTH_MAP[mw]) {
      innerStyle.maxWidth = MAX_WIDTH_MAP[mw];
      innerStyle.marginLeft = "auto";
      innerStyle.marginRight = "auto";
    } else if (css(mw) !== undefined) {
      innerStyle.maxWidth = css(mw) as string;
    }
  }
  return { outerStyle, innerStyle };
}

// ─── Canvas Props ─────────────────────────────────────────────────────────────

interface CanvasProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddToContainer: (containerId: string, slotIndex: number | null, type: BlockType) => void;
  dropIndicatorId: string | null;
  onAddAfter: (afterId: string, type: BlockType) => void;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas({
  sections,
  selectedId,
  onSelect,
  onRemove,
  onAddToContainer,
  dropIndicatorId,
  onAddAfter,
}: CanvasProps) {
  const { setNodeRef: setCanvasRef } = useDroppable({ id: CANVAS_DROP_ID });

  if (sections.length === 0) {
    return (
      <main ref={setCanvasRef} className="epx-canvas epx-canvas--empty">
        <div className="epx-canvas__empty-state">
          <h3>Start building your page</h3>
          <p>Click or drag a block from the left panel</p>
        </div>
      </main>
    );
  }

  return (
    <main ref={setCanvasRef} className="epx-canvas">
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="epx-canvas__list">
          {sections.map((section) => {
            if (section.type === "container") {
              return (
                <ContainerBlock
                  key={section.id}
                  section={section}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  onAddToContainer={onAddToContainer}
                  dropIndicatorId={dropIndicatorId}
                  onAddAfter={onAddAfter}
                />
              );
            }
            return (
              <SortableBlock
                key={section.id}
                section={section}
                containerId={null}
                slotIndex={null}
                isSelected={section.id === selectedId}
                onSelect={() => onSelect(section.id)}
                onRemove={() => onRemove(section.id)}
                isDropTarget={section.id === dropIndicatorId}
                onAddAfter={(type) => onAddAfter(section.id, type)}
              />
            );
          })}
        </div>
      </SortableContext>
    </main>
  );
}

// ─── SortableBlock ─────────────────────────────────────────────────────────────

interface SortableBlockProps {
  section: SectionBlock;
  containerId: string | null;
  slotIndex: number | null;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isDropTarget: boolean;
  onAddAfter: (type: BlockType) => void;
}

function SortableBlock({
  section,
  containerId,
  slotIndex,
  isSelected,
  onSelect,
  onRemove,
  isDropTarget,
  onAddAfter,
}: SortableBlockProps) {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: {
      kind: "block",
      containerId,
      slotIndex,
      isContainer: false,
    } satisfies BlockDragData,
  });

  const { outerStyle, innerStyle } = resolveBlockStyle(
    section.config.style as Record<string, unknown> | undefined
  );

  const adv = (section.config.advanced ?? {}) as Record<string, unknown>;
  if (adv.position) outerStyle.position = adv.position as React.CSSProperties["position"];
  if (adv.top)    outerStyle.top    = css(adv.top)    as string;
  if (adv.right)  outerStyle.right  = css(adv.right)  as string;
  if (adv.bottom) outerStyle.bottom = css(adv.bottom) as string;
  if (adv.left)   outerStyle.left   = css(adv.left)   as string;
  if (adv.zIndex !== undefined && adv.zIndex !== "") outerStyle.zIndex = Number(adv.zIndex);

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...outerStyle,
  };

  const Preview = PREVIEW_COMPONENTS[section.type];

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={`epx-block-preview${isSelected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BlockOverlay
        visible={hovered || isSelected}
        onAdd={onAddAfter}
        dragListeners={listeners}
        dragAttributes={attributes}
        onDelete={onRemove}
        onSelect={onSelect}
        allowedBlockTypes="all"
      />

      <div style={innerStyle}>
        {Preview ? (
          <Preview config={section.config} children={section.children} slots={section.slots} />
        ) : (
          <div style={{ padding: "12px 14px", color: "#888", fontSize: 12 }}>
            Unknown block: {section.type}
          </div>
        )}
      </div>

      {isDropTarget && <div className="epx-drop-indicator" />}
    </div>
  );
}

// ─── ContainerBlock ───────────────────────────────────────────────────────────

interface ContainerBlockProps {
  section: SectionBlock;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddToContainer: (containerId: string, slotIndex: number | null, type: BlockType) => void;
  dropIndicatorId: string | null;
  onAddAfter: (afterId: string, type: BlockType) => void;
}

const ContainerBlock = memo(function ContainerBlock({
  section,
  selectedId,
  onSelect,
  onRemove,
  onAddToContainer,
  dropIndicatorId,
  onAddAfter,
}: ContainerBlockProps) {
  const [hovered, setHovered] = useState(false);
  const isSelected = section.id === selectedId;
  const children = section.children ?? [];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: {
      kind: "block",
      containerId: null,
      slotIndex: null,
      isContainer: true,
    } satisfies BlockDragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`epx-container-block${isSelected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BlockOverlay
        visible={hovered || isSelected}
        onAdd={(type) => onAddAfter(section.id, type)}
        dragListeners={listeners}
        dragAttributes={attributes}
        onDelete={() => onRemove(section.id)}
        onSelect={() => onSelect(section.id)}
        allowedBlockTypes="all"
      />

      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="epx-container-block__children">
          {children.length > 0 ? (
            children.map((child) => (
              <SortableBlock
                key={child.id}
                section={child}
                containerId={section.id}
                slotIndex={null}
                isSelected={child.id === selectedId}
                onSelect={() => onSelect(child.id)}
                onRemove={() => onRemove(child.id)}
                isDropTarget={child.id === dropIndicatorId}
                onAddAfter={(type) => onAddAfter(child.id, type)}
              />
            ))
          ) : (
            <EmptyDropZone
              containerId={section.id}
              slotIndex={null}
              onAdd={(type) => onAddToContainer(section.id, null, type)}
            />
          )}
        </div>
      </SortableContext>

      {children.length > 0 && (
        <ContainerAddButton onAdd={(type) => onAddToContainer(section.id, null, type)} />
      )}

      {section.id === dropIndicatorId && <div className="epx-drop-indicator" />}
    </div>
  );
});

// ─── EmptyDropZone ────────────────────────────────────────────────────────────

function EmptyDropZone({
  containerId,
  slotIndex,
  onAdd,
}: {
  containerId: string;
  slotIndex: number | null;
  onAdd: (type: BlockType) => void;
}) {
  const id = `empty:${containerId}:${slotIndex ?? "c"}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: "empty-zone", containerId, slotIndex } satisfies EmptyZoneData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`epx-container__empty-zone${isOver ? " is-over" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <ContainerAddButton onAdd={onAdd} />
    </div>
  );
}

// ─── ContainerAddButton ────────────────────────────────────────────────────────

function ContainerAddButton({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="epx-container-block__add-btn" onClick={(e) => e.stopPropagation()}>
      {open ? (
        <div className="epx-block-overlay__picker" style={{ position: "static", width: "100%" }}>
          <div className="epx-block-overlay__picker-title">Add Block Inside</div>
          {LEAF_BLOCK_DEFS.map((def) => (
            <button
              key={def.type}
              className="epx-block-card"
              onClick={() => { onAdd(def.type); setOpen(false); }}
              type="button"
            >
              <span className="epx-block-card__icon">{def.icon}</span>
              <span className="epx-block-card__label">{def.label}</span>
            </button>
          ))}
          <button
            style={{ marginTop: 4, padding: "4px 8px", background: "none", border: "1px solid #d0d0d0", borderRadius: 5, fontSize: 11, color: "#888", cursor: "pointer", width: "100%" }}
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="epx-container__add-icon"
          onClick={() => setOpen(true)}
          type="button"
          title="Add block inside"
        >
          +
        </button>
      )}
    </div>
  );
}
