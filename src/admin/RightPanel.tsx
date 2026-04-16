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

// ─── SpacingControl ────────────────────────────────────────────────────────────

type SpacingKeys = "top" | "right" | "bottom" | "left";
type SpacingValue = Partial<Record<SpacingKeys, number>>;

const SIDE_LABELS: Record<SpacingKeys, string> = {
  top: "T",
  right: "R",
  bottom: "B",
  left: "L",
};

function SpacingControl({
  label,
  value,
  onChange,
  sides,
  linkIcon,
}: {
  label: string;
  value: SpacingValue;
  onChange: (v: SpacingValue) => void;
  sides: SpacingKeys[];
  linkIcon: string;
}) {
  const [linked, setLinked] = useState(false);

  const handleChange = (side: SpacingKeys, px: number) => {
    if (linked) {
      const next: SpacingValue = {};
      sides.forEach((s) => (next[s] = px));
      onChange({ ...value, ...next });
    } else {
      onChange({ ...value, [side]: px });
    }
  };

  return (
    <div className="epx-spacing-group">
      <div className="epx-spacing-group__header">
        <span className="epx-spacing-group__label">{label}</span>
        <button
          className={`epx-spacing-group__link${linked ? " is-linked" : ""}`}
          onClick={() => setLinked(!linked)}
          title={linked ? "Unlink sides" : "Link all sides"}
          type="button"
        >
          {linkIcon}
        </button>
      </div>

      {sides.map((side) => {
        const px = value[side] ?? 0;
        return (
          <div key={side} className="epx-spacing-row">
            <div className="epx-spacing-row__side">{SIDE_LABELS[side]}</div>
            <input
              type="range"
              min={0}
              max={120}
              step={4}
              value={px}
              onChange={(e) => handleChange(side, Number(e.target.value))}
              className="epx-spacing-row__slider"
              style={{
                background: `linear-gradient(to right, #2563eb ${(px / 120) * 100}%, #e0e0e0 ${(px / 120) * 100}%)`,
              }}
            />
            <span className="epx-spacing-row__value">{px}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Style fields (misc selects) ──────────────────────────────────────────────

const MISC_STYLE_FIELDS: FieldDef[] = [
  {
    key: "background",
    label: "Background",
    type: "select",
    options: [
      { value: "transparent", label: "Transparent" },
      { value: "white", label: "White" },
      { value: "light-gray", label: "Light Gray" },
      { value: "dark", label: "Dark" },
      { value: "accent", label: "Accent Blue" },
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
      { value: "full", label: "Pill (9999px)" },
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

  const paddingValue: SpacingValue = {
    top: (style.paddingTop as number) ?? 0,
    right: (style.paddingRight as number) ?? 0,
    bottom: (style.paddingBottom as number) ?? 0,
    left: (style.paddingLeft as number) ?? 0,
  };

  const marginValue: SpacingValue = {
    top: (style.marginTop as number) ?? 0,
    bottom: (style.marginBottom as number) ?? 0,
  };

  const handleSpacing = (key: string, val: SpacingValue) => {
    const prefix = key === "padding" ? "padding" : "margin";
    const next: Record<string, unknown> = { ...style };
    Object.entries(val).forEach(([side, px]) => {
      const cssKey = `${prefix}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      next[cssKey] = px;
    });
    onChange({ style: next });
  };

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
          <SpacingControl
            label="Padding"
            value={paddingValue}
            onChange={(v) => handleSpacing("padding", v)}
            sides={["top", "right", "bottom", "left"]}
            linkIcon="⊙"
          />
          <SpacingControl
            label="Margin"
            value={marginValue}
            onChange={(v) => handleSpacing("margin", v)}
            sides={["top", "bottom"]}
            linkIcon="↕"
          />
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12, marginTop: 4 }}>
            {MISC_STYLE_FIELDS.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={style[field.key]}
                onChange={(val) => onChange({ style: { ...style, [field.key]: val } })}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
