import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionBlock } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";

interface CanvasProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (sections: SectionBlock[]) => void;
}

export function Canvas({ sections, selectedId, onSelect, onRemove, onReorder }: CanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      onReorder(arrayMove(sections, oldIndex, newIndex));
    }
  };

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="epx-canvas__list">
            {sections.map((section) => (
              <SortableBlock
                key={section.id}
                section={section}
                isSelected={section.id === selectedId}
                onSelect={() => onSelect(section.id)}
                onRemove={() => onRemove(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </main>
  );
}

interface SortableBlockProps {
  section: SectionBlock;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableBlock({ section, isSelected, onSelect, onRemove }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const def = getBlockDef(section.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`epx-section-row ${isSelected ? "is-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="epx-section-row__drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </div>

      <div className="epx-section-row__info">
        <span className="epx-section-row__icon">{def?.icon ?? "📦"}</span>
        <div className="epx-section-row__text">
          <span className="epx-section-row__label">{def?.label ?? section.type}</span>
          <span className="epx-section-row__preview">{getSectionPreview(section)}</span>
        </div>
      </div>

      <button
        className="epx-icon-btn epx-icon-btn--danger epx-section-row__remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove block"
        aria-label="Remove block"
      >
        ×
      </button>
    </div>
  );
}

function getSectionPreview(section: SectionBlock): string {
  const cfg = section.config;
  if (cfg.headline) return cfg.headline as string;
  if (cfg.url) return cfg.url as string;
  if (cfg.height) return `Height: ${cfg.height as string}`;
  return "Click to configure...";
}
