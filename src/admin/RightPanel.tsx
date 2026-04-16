import React, { useState } from "react";
import type { SectionBlock } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";
import type { FieldDef } from "./blockDefinitions.js";

interface Props {
  block: SectionBlock | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
}

// ─── Style fields (universale, stocate în block.config.style) ─────────────────

const STYLE_FIELDS: FieldDef[] = [
  {
    key: "paddingTop",
    label: "Padding Top",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "sm", label: "Small (16px)" },
      { value: "md", label: "Medium (32px)" },
      { value: "lg", label: "Large (64px)" },
      { value: "xl", label: "Extra Large (96px)" },
    ],
  },
  {
    key: "paddingBottom",
    label: "Padding Bottom",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "sm", label: "Small (16px)" },
      { value: "md", label: "Medium (32px)" },
      { value: "lg", label: "Large (64px)" },
      { value: "xl", label: "Extra Large (96px)" },
    ],
  },
  {
    key: "marginTop",
    label: "Margin Top",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "sm", label: "Small (8px)" },
      { value: "md", label: "Medium (16px)" },
      { value: "lg", label: "Large (32px)" },
      { value: "xl", label: "Extra Large (64px)" },
    ],
  },
  {
    key: "marginBottom",
    label: "Margin Bottom",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "sm", label: "Small (8px)" },
      { value: "md", label: "Medium (16px)" },
      { value: "lg", label: "Large (32px)" },
      { value: "xl", label: "Extra Large (64px)" },
    ],
  },
  {
    key: "background",
    label: "Background",
    type: "select",
    options: [
      { value: "transparent", label: "Transparent" },
      { value: "white", label: "White" },
      { value: "light-gray", label: "Light Gray" },
      { value: "dark", label: "Dark" },
      { value: "accent", label: "Accent" },
    ],
  },
  {
    key: "borderRadius",
    label: "Border Radius",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "sm", label: "Small (4px)" },
      { value: "md", label: "Medium (8px)" },
      { value: "lg", label: "Large (16px)" },
      { value: "full", label: "Full (rounded)" },
    ],
  },
  {
    key: "maxWidth",
    label: "Max Width",
    type: "select",
    options: [
      { value: "sm", label: "Small (640px)" },
      { value: "md", label: "Medium (768px)" },
      { value: "lg", label: "Large (1140px)" },
      { value: "full", label: "Full width" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RightPanel({ block, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"fields" | "style">("fields");

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

  const style = (block.config.style ?? {}) as Record<string, unknown>;

  return (
    <aside className="epx-right-panel">
      <div className="epx-right-panel__header">
        <span className="epx-right-panel__icon">{def.icon}</span>
        <h2 className="epx-right-panel__title">{def.label}</h2>
      </div>
      <p className="epx-right-panel__description">{def.description}</p>

      <div className="epx-right-panel__tabs">
        <button
          className={`epx-right-panel__tab${activeTab === "fields" ? " is-active" : ""}`}
          onClick={() => setActiveTab("fields")}
          type="button"
        >
          Fields
        </button>
        <button
          className={`epx-right-panel__tab${activeTab === "style" ? " is-active" : ""}`}
          onClick={() => setActiveTab("style")}
          type="button"
        >
          Style
        </button>
      </div>

      {activeTab === "fields" && (
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
      )}

      {activeTab === "style" && (
        <div className="epx-right-panel__fields">
          {STYLE_FIELDS.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={style[field.key]}
              onChange={(val) => onChange({ style: { ...style, [field.key]: val } })}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
