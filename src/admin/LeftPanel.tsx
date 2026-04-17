import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";
import type { BlockType } from "../types.js";

interface Props {
  onAddBlock: (type: BlockType) => void;
}

function DraggableBlockCard({
  def,
  onAddBlock,
}: {
  def: (typeof BLOCK_DEFINITIONS)[number];
  onAddBlock: (type: BlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-${def.type}`,
    data: { kind: "new-block", blockType: def.type },
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="epx-block-card"
      onClick={() => onAddBlock(def.type)}
      title={def.description}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: isDragging ? "grabbing" : "grab" }}
      type="button"
    >
      <span className="epx-block-card__icon">{def.icon}</span>
      <span className="epx-block-card__label">{def.label}</span>
    </button>
  );
}

export function LeftPanel({ onAddBlock }: Props) {
  return (
    <aside className="epx-left-panel">
      <div className="epx-left-panel__header">
        <h2 className="epx-left-panel__title">Blocks</h2>
        <p className="epx-left-panel__hint">Click to add · Drag to position</p>
      </div>
      <div className="epx-left-panel__list">
        {BLOCK_DEFINITIONS.map((def) => (
          <DraggableBlockCard key={def.type} def={def} onAddBlock={onAddBlock} />
        ))}
      </div>
    </aside>
  );
}
