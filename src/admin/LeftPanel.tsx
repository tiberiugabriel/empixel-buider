import React from "react";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";
import type { BlockType } from "../types.js";

interface Props {
  onAddBlock: (type: BlockType) => void;
}

export function LeftPanel({ onAddBlock }: Props) {
  return (
    <aside className="epx-left-panel">
      <div className="epx-left-panel__header">
        <h2 className="epx-left-panel__title">Blocks</h2>
        <p className="epx-left-panel__hint">Click to add to page</p>
      </div>
      <div className="epx-left-panel__list">
        {BLOCK_DEFINITIONS.map((def) => (
          <button
            key={def.type}
            className="epx-block-card"
            onClick={() => onAddBlock(def.type)}
            title={def.description}
          >
            <span className="epx-block-card__icon">{def.icon}</span>
            <span className="epx-block-card__label">{def.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
