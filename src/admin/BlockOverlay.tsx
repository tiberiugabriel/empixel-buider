import React from "react";
import type { BlockType } from "../types.js";

interface BlockOverlayProps {
  visible: boolean;
  onAdd: (type: BlockType) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners: Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes: Record<string, any> | undefined;
  onDelete: () => void;
  onSelect?: () => void;
}

export function BlockOverlay({
  visible,
  onAdd,
  dragListeners,
  dragAttributes,
  onDelete,
  onSelect,
}: BlockOverlayProps) {
  return (
    <div
      className={`epx-block-overlay${visible ? " is-visible" : ""}`}
      onClick={() => onSelect?.()}
    >
      {/* + Add sibling container */}
      <button
        className="epx-block-overlay__btn"
        onClick={(e) => {
          e.stopPropagation();
          onAdd("container");
        }}
        title="Add container below"
        type="button"
      >
        +
      </button>

      {/* Drag handle */}
      <div
        className="epx-block-overlay__handle"
        {...dragListeners}
        {...dragAttributes}
        title="Drag to reorder"
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
      >
        ⠿
      </div>

      {/* Delete */}
      <button
        className="epx-block-overlay__btn epx-block-overlay__btn--delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Remove block"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
