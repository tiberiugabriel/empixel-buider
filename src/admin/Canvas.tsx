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

function resolveBlockStyle(style: Record<string, unknown> | undefined): {
  outerStyle: React.CSSProperties;
  innerStyle: React.CSSProperties;
} {
  if (!style) return { outerStyle: {}, innerStyle: {} };
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  const outerStyle: React.CSSProperties = {};
  if (num(style.marginTop) !== undefined) outerStyle.marginTop = num(style.marginTop);
  if (num(style.marginBottom) !== undefined) outerStyle.marginBottom = num(style.marginBottom);
  const innerStyle: React.CSSProperties = {};
  if (num(style.paddingTop) !== undefined) innerStyle.paddingTop = num(style.paddingTop);
  if (num(style.paddingRight) !== undefined) innerStyle.paddingRight = num(style.paddingRight);
  if (num(style.paddingBottom) !== undefined) innerStyle.paddingBottom = num(style.paddingBottom);
  if (num(style.paddingLeft) !== undefined) innerStyle.paddingLeft = num(style.paddingLeft);
  if (style.borderRadius && BORDER_RADIUS_MAP[style.borderRadius as string]) {
    innerStyle.borderRadius = BORDER_RADIUS_MAP[style.borderRadius as string];
  }
  if (style.maxWidth && MAX_WIDTH_MAP[style.maxWidth as string]) {
    innerStyle.maxWidth = MAX_WIDTH_MAP[style.maxWidth as string];
    innerStyle.marginLeft = "auto";
    innerStyle.marginRight = "auto";
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
  if (sections.length === 0) {
    return (
      <main className="epx-canvas epx-canvas--empty">
        <div className="epx-canvas__empty-state">
          <div className="epx-canvas__empty-icon">🏗️</div>
          <h3>Start building your page</h3>
          <p>Click or drag a block from the left panel</p>
        </div>
      </main>
    );
  }

  return (
    <main className="epx-canvas">
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="epx-canvas__list">
          {sections.map((section) => {
            if (section.type === "section") {
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
            if (section.type === "columns") {
              return (
                <ColumnsBlock
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
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BlockOverlay
        visible={hovered || isSelected}
        onAdd={onAddAfter}
        dragListeners={listeners}
        dragAttributes={attributes}
        onDelete={onRemove}
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

// ─── ContainerBlock (section) ─────────────────────────────────────────────────

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

// ─── ColumnsBlock ─────────────────────────────────────────────────────────────

const ColumnsBlock = memo(function ColumnsBlock({
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
  const numCols = parseInt(section.config.columns ?? "2", 10);
  const slots: SectionBlock[][] = section.slots ?? Array.from({ length: numCols }, () => []);

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
      className={`epx-columns-block${isSelected ? " is-selected" : ""}`}
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
        allowedBlockTypes="all"
      />

      <div
        className="epx-columns-block__grid"
        style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}
      >
        {Array.from({ length: numCols }, (_, si) => {
          const slotItems = slots[si] ?? [];
          return (
            <div key={si} className="epx-columns__slot">
              <SortableContext
                items={slotItems.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {slotItems.length > 0 ? (
                  slotItems.map((child) => (
                    <SortableBlock
                      key={child.id}
                      section={child}
                      containerId={section.id}
                      slotIndex={si}
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
                    slotIndex={si}
                    onAdd={(type) => onAddToContainer(section.id, si, type)}
                  />
                )}
              </SortableContext>
              <ContainerAddButton onAdd={(type) => onAddToContainer(section.id, si, type)} />
            </div>
          );
        })}
      </div>

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
