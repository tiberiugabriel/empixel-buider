import React, { memo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionBlock, BlockType } from "../types.js";
import { isContainerType } from "../types.js";
import { PREVIEW_COMPONENTS } from "./previews/index.js";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";
import { findBlockById } from "./treeUtils.js";

// ─── Drag data types ──────────────────────────────────────────────────────────

type BlockDragData = {
  kind: "block";
  containerId: string | null;
  slotIndex: number | null;
  isContainer: boolean;
};

type EmptyZoneData = {
  kind: "empty-zone";
  containerId: string;
  slotIndex: number | null;
};

// ─── Canvas Props ─────────────────────────────────────────────────────────────

interface CanvasProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (sections: SectionBlock[]) => void;
  onMoveBlock: (sourceId: string, targetContainerId: string | null, targetSlotIndex: number | null, targetIndex: number) => void;
  onReorderInContainer: (containerId: string, slotIndex: number | null, newOrder: SectionBlock[]) => void;
  onAddToContainer: (containerId: string, slotIndex: number | null, type: BlockType) => void;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas({
  sections,
  selectedId,
  onSelect,
  onRemove,
  onReorder,
  onMoveBlock,
  onReorderInContainer,
  onAddToContainer,
}: CanvasProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeData = active.data.current as BlockDragData | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overRaw = over.data.current as any;

    // Drop on an empty-zone droppable
    if (overRaw?.kind === "empty-zone") {
      const zone = overRaw as EmptyZoneData;
      if (activeData?.isContainer) return; // no nesting containers
      onMoveBlock(String(active.id), zone.containerId, zone.slotIndex, 0);
      return;
    }

    const overData = overRaw as BlockDragData | undefined;

    // Prevent containers from being dropped into other containers
    if (activeData?.isContainer && overData?.containerId !== null) return;

    // Dropping a leaf onto a container block itself → append to its children
    if (overData?.isContainer && overData.containerId === null) {
      const targetContainer = sections.find((s) => s.id === over.id);
      if (!targetContainer) return;
      const targetLen =
        targetContainer.type === "columns"
          ? (targetContainer.slots?.[0]?.length ?? 0)
          : (targetContainer.children?.length ?? 0);
      const slotIndex = targetContainer.type === "columns" ? 0 : null;
      onMoveBlock(String(active.id), String(over.id), slotIndex, targetLen);
      return;
    }

    const sourceContainerId = activeData?.containerId ?? null;
    const sourceSlotIndex = activeData?.slotIndex ?? null;
    const targetContainerId = overData?.containerId ?? null;
    const targetSlotIndex = overData?.slotIndex ?? null;

    const isSameLocation =
      sourceContainerId === targetContainerId && sourceSlotIndex === targetSlotIndex;

    if (isSameLocation) {
      if (sourceContainerId === null) {
        // Top-level reorder
        const oldIdx = sections.findIndex((s) => s.id === active.id);
        const newIdx = sections.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          onReorder(arrayMove(sections, oldIdx, newIdx));
        }
      } else {
        // In-container reorder
        const container = findBlockById(sourceContainerId, sections);
        if (!container) return;
        const items =
          sourceSlotIndex === null
            ? (container.children ?? [])
            : (container.slots?.[sourceSlotIndex] ?? []);
        const oldIdx = items.findIndex((s) => s.id === active.id);
        const newIdx = items.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          onReorderInContainer(sourceContainerId, sourceSlotIndex, arrayMove(items, oldIdx, newIdx));
        }
      }
    } else {
      // Cross-container move
      let targetItems: SectionBlock[];
      if (targetContainerId === null) {
        targetItems = sections;
      } else {
        const targetContainer = findBlockById(targetContainerId, sections);
        targetItems =
          targetSlotIndex === null
            ? (targetContainer?.children ?? [])
            : (targetContainer?.slots?.[targetSlotIndex] ?? []);
      }
      const targetIndex = targetItems.findIndex((s) => s.id === over.id);
      onMoveBlock(
        String(active.id),
        targetContainerId,
        targetSlotIndex,
        targetIndex >= 0 ? targetIndex : targetItems.length
      );
    }
  };

  const activeBlock = activeDragId ? findBlockById(activeDragId, sections) : null;

  if (sections.length === 0) {
    return (
      <main className="epx-canvas epx-canvas--empty">
        <div className="epx-canvas__empty-state">
          <div className="epx-canvas__empty-icon">🏗️</div>
          <h3>Start building your page</h3>
          <p>Click a block from the left panel to add it to your page</p>
        </div>
      </main>
    );
  }

  return (
    <main className="epx-canvas">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
                />
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeBlock ? (
            <div
              style={{
                opacity: 0.85,
                background: "#fff",
                borderRadius: 8,
                border: "2px solid #2563eb",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "#2563eb",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                cursor: "grabbing",
              }}
            >
              {activeBlock.type}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── SortableBlock ─────────────────────────────────────────────────────────────

function SortableBlock({
  section,
  containerId,
  slotIndex,
  isSelected,
  onSelect,
  onRemove,
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
      <div
        className="epx-block-preview__handle"
        style={{ opacity: hovered || isSelected ? 1 : 0 }}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </div>
      <button
        className="epx-block-preview__delete"
        style={{ opacity: hovered || isSelected ? 1 : 0 }}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove block"
        type="button"
      >
        ×
      </button>
      <div style={innerStyle}>
        {Preview ? (
          <Preview config={section.config} children={section.children} slots={section.slots} />
        ) : (
          <div style={{ padding: "12px 14px", color: "#888", fontSize: 12 }}>
            Unknown block: {section.type}
          </div>
        )}
      </div>
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
}

const ContainerBlock = memo(function ContainerBlock({
  section,
  selectedId,
  onSelect,
  onRemove,
  onAddToContainer,
}: ContainerBlockProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`epx-container-block${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
    >
      <div className="epx-container-block__header">
        <span
          className="epx-container-block__handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span className="epx-container-block__label">📦 Section Container</span>
        <button
          className="epx-container-block__delete"
          onClick={(e) => { e.stopPropagation(); onRemove(section.id); }}
          title="Remove section"
          type="button"
        >
          ×
        </button>
      </div>

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
              />
            ))
          ) : (
            <EmptyDropZone containerId={section.id} slotIndex={null} />
          )}
        </div>
      </SortableContext>

      <AddBlockButton
        containerId={section.id}
        slotIndex={null}
        onAdd={onAddToContainer}
      />
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
}: ContainerBlockProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`epx-columns-block${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
    >
      <div className="epx-columns-block__header">
        <span
          className="epx-columns-block__handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span className="epx-columns-block__label">📐 Columns ({numCols})</span>
        <button
          className="epx-columns-block__delete"
          onClick={(e) => { e.stopPropagation(); onRemove(section.id); }}
          title="Remove columns"
          type="button"
        >
          ×
        </button>
      </div>

      <div
        className="epx-columns-block__grid"
        style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}
      >
        {Array.from({ length: numCols }, (_, si) => {
          const slotItems = slots[si] ?? [];
          return (
            <div key={si} className="epx-columns__slot">
              <div className="epx-columns__slot-label">Col {si + 1}</div>
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
                    />
                  ))
                ) : (
                  <EmptyDropZone containerId={section.id} slotIndex={si} />
                )}
              </SortableContext>
              <AddBlockButton
                containerId={section.id}
                slotIndex={si}
                onAdd={onAddToContainer}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── EmptyDropZone ────────────────────────────────────────────────────────────

function EmptyDropZone({
  containerId,
  slotIndex,
}: {
  containerId: string;
  slotIndex: number | null;
}) {
  const id = `empty:${containerId}:${slotIndex ?? "c"}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: "empty-zone", containerId, slotIndex } satisfies EmptyZoneData,
  });

  return (
    <div ref={setNodeRef} className={`epx-container__empty-zone${isOver ? " is-over" : ""}`}>
      Drop blocks here
    </div>
  );
}

// ─── AddBlockButton ───────────────────────────────────────────────────────────

const LEAF_BLOCK_DEFS = BLOCK_DEFINITIONS.filter((d) => !isContainerType(d.type));

function AddBlockButton({
  containerId,
  slotIndex,
  onAdd,
}: {
  containerId: string;
  slotIndex: number | null;
  onAdd: (containerId: string, slotIndex: number | null, type: BlockType) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="epx-add-block-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        type="button"
      >
        + Add Block
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="epx-add-block-picker">
        <div className="epx-add-block-picker__title">Add Block</div>
        {LEAF_BLOCK_DEFS.map((def) => (
          <button
            key={def.type}
            className="epx-block-card"
            onClick={() => { onAdd(containerId, slotIndex, def.type); setOpen(false); }}
            type="button"
          >
            <span className="epx-block-card__icon">{def.icon}</span>
            <span className="epx-block-card__label">{def.label}</span>
          </button>
        ))}
        <button
          style={{ marginTop: 4, padding: "5px 8px", background: "none", border: "1px solid #d0d0d0", borderRadius: 5, fontSize: 12, color: "#888", cursor: "pointer", width: "100%" }}
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
