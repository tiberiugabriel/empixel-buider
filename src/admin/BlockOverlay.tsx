import React, { useEffect, useRef, useState } from "react";
import type { BlockType } from "../types.js";
import { isContainerType } from "../types.js";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";

interface BlockOverlayProps {
  visible: boolean;
  onAdd: (type: BlockType) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners: Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes: Record<string, any> | undefined;
  onDelete: () => void;
  onSelect?: () => void;
  allowedBlockTypes?: "all" | "leaf-only";
}

export function BlockOverlay({
  visible,
  onAdd,
  dragListeners,
  dragAttributes,
  onDelete,
  onSelect,
  allowedBlockTypes = "all",
}: BlockOverlayProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Close picker when overlay hides
  useEffect(() => {
    if (!visible) setPickerOpen(false);
  }, [visible]);

  const defs = BLOCK_DEFINITIONS.filter((d) =>
    allowedBlockTypes === "leaf-only" ? !isContainerType(d.type) : true
  );

  return (
    <div
      className={`epx-block-overlay${visible ? " is-visible" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* + Add button */}
      <div style={{ position: "relative" }} ref={pickerRef}>
        <button
          className="epx-block-overlay__btn"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((o) => !o);
          }}
          title="Add block"
          type="button"
        >
          +
        </button>

        {pickerOpen && (
          <div className="epx-block-overlay__picker">
            <div className="epx-block-overlay__picker-title">Add Block</div>
            {defs.map((def) => (
              <button
                key={def.type}
                className="epx-block-card"
                onClick={() => {
                  onAdd(def.type);
                  setPickerOpen(false);
                }}
                type="button"
              >
                <span className="epx-block-card__icon">{def.icon}</span>
                <span className="epx-block-card__label">{def.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
