import React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaRef } from "../MediaPicker.js";
import { IconClose, IconDragDots, IconMedia } from "./common.js";
import type { BackgroundConfig } from "./serialize.js";

/**
 * Slideshow mode body — "+ Add Images" trigger + sortable list of
 * selected slides with drag handles, thumbnails, and per-slide
 * remove buttons.
 *
 * Extracted in F4.7 from `BackgroundControl.tsx`. The media-picker
 * modal lives in the parent — this sub calls `openMediaPicker()`
 * to surface it.
 */
function SortableSlide({ slide, onRemove }: { slide: MediaRef; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  return (
    <div
      ref={setNodeRef}
      className="epx-bg-ctrl__slide"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="epx-bg-ctrl__slide-drag" {...attributes} {...listeners} title="Drag to reorder">
        <IconDragDots />
      </span>
      {slide.storageKey ? (
        <img className="epx-bg-ctrl__thumb" src={`/_emdash/api/media/file/${slide.storageKey}`} alt={slide.alt ?? slide.filename ?? ""} />
      ) : (
        <div className="epx-bg-ctrl__thumb-placeholder"><IconMedia /></div>
      )}
      <span className="epx-bg-ctrl__slide-name">{slide.filename ?? slide.id}</span>
      <button type="button" className="epx-bg-ctrl__slide-remove" onClick={onRemove} title="Remove">
        <IconClose />
      </button>
    </div>
  );
}

interface Props {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
  openMediaPicker: () => void;
}

export function SlideshowSub({ value, onChange, openMediaPicker }: Props) {
  const slides = value.slides ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSlideDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = slides.findIndex(s => s.id === active.id);
      const newIdx = slides.findIndex(s => s.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) onChange({ ...value, slides: arrayMove(slides, oldIdx, newIdx) });
    }
  };

  return (
    <>
      <button type="button" className="epx-bg-ctrl__add-btn epx-bg-ctrl__add-btn--media" onClick={openMediaPicker}>
        + Add Images
      </button>
      {slides.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleSlideDragEnd}>
          <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="epx-bg-ctrl__slides">
              {slides.map((slide, i) => (
                <SortableSlide
                  key={slide.id}
                  slide={slide}
                  onRemove={() => onChange({ ...value, slides: slides.filter((_, idx) => idx !== i) })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
