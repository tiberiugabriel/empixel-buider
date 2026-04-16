import React from "react";
import type { SectionBlock } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";

interface Props {
  block: SectionBlock | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
}

export function RightPanel({ block, onChange }: Props) {
  if (!block) {
    return (
      <aside className="epx-right-panel epx-right-panel--empty">
        <div className="epx-right-panel__placeholder">
          <div className="epx-right-panel__placeholder-icon">👈</div>
          <p>Select a block on the canvas to edit its settings</p>
        </div>
      </aside>
    );
  }

  const def = getBlockDef(block.type);
  if (!def) return null;

  return (
    <aside className="epx-right-panel">
      <div className="epx-right-panel__header">
        <span className="epx-right-panel__icon">{def.icon}</span>
        <h2 className="epx-right-panel__title">{def.label}</h2>
      </div>
      <p className="epx-right-panel__description">{def.description}</p>

      <div className="epx-right-panel__fields">
        {def.fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={block.config[field.key]}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        ))}
      </div>
    </aside>
  );
}
