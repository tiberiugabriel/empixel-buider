import React, { useEffect, useRef, useState } from "react";
import type { SectionBlock } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";
import type { FieldDef } from "./blockDefinitions.js";

interface Props {
  block: SectionBlock | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
}

// ─── Tab icons (inline SVG) ───────────────────────────────────────────────────

function IconFields() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="10.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconStyle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 1.5C7.5 1.5 11.5 4.5 11.5 7.5C11.5 9.71 9.71 11.5 7.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconAdvanced() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.93 2.93l1.06 1.06M11.01 11.01l1.06 1.06M2.93 12.07l1.06-1.06M11.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
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

// ─── Advanced Tab ─────────────────────────────────────────────────────────────

type AdvancedConfig = {
  position?: string;
  zIndex?: number | string;
  cssId?: string;
  cssClasses?: string;
  customCss?: string;
};

// ─── CodeEditor ───────────────────────────────────────────────────────────────

function CodeEditor({
  value,
  onChange,
  selector,
}: {
  value: string;
  onChange: (v: string) => void;
  selector: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumsRef = useRef<HTMLDivElement>(null);
  const lineCount = value === "" ? 1 : value.split("\n").length;

  // Sync line numbers scroll with textarea scroll
  const handleScroll = () => {
    if (lineNumsRef.current && textareaRef.current) {
      lineNumsRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Tab key → insert 4 spaces (no focus jump)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = textareaRef.current!;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.substring(0, start) + "    " + value.substring(end);
    onChange(next);
    // Restore caret after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 4;
    });
  };

  // Keep cursor position stable across onChange re-renders
  const selStart = useRef(0);
  const selEnd = useRef(0);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.selectionStart = selStart.current;
    ta.selectionEnd = selEnd.current;
  });

  const placeholder = `color: red;\nfont-size: 18px;`;

  return (
    <div className="epx-code-editor">
      <div className="epx-code-editor__header">
        <span className="epx-code-editor__selector-kw">selector</span>
        <span className="epx-code-editor__selector-eq"> = </span>
        <span className="epx-code-editor__selector-val">{selector}</span>
      </div>
      <div className="epx-code-editor__body">
        <div ref={lineNumsRef} className="epx-code-editor__line-nums" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="epx-code-editor__line-num">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="epx-code-editor__textarea"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={(e) => {
            selStart.current = (e.target as HTMLTextAreaElement).selectionStart;
            selEnd.current = (e.target as HTMLTextAreaElement).selectionEnd;
          }}
          onChange={(e) => {
            selStart.current = e.target.selectionStart;
            selEnd.current = e.target.selectionEnd;
            onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

function AdvancedTab({
  value,
  onChange,
  blockId,
}: {
  value: AdvancedConfig;
  onChange: (v: AdvancedConfig) => void;
  blockId: string;
}) {
  const set = (key: keyof AdvancedConfig, val: unknown) =>
    onChange({ ...value, [key]: val });

  const selector = value.cssId
    ? `#${value.cssId}`
    : `[data-epx-block="${blockId}"]`;

  return (
    <div className="epx-right-panel__fields">
      {/* Position */}
      <div className="epx-field">
        <label className="epx-field__label">Position</label>
        <select
          className="epx-field__select"
          value={value.position ?? ""}
          onChange={(e) => set("position", e.target.value)}
        >
          <option value="">Default</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>

      {/* Z-Index */}
      <div className="epx-field">
        <label className="epx-field__label">Z-Index</label>
        <input
          type="number"
          className="epx-field__input"
          value={value.zIndex ?? ""}
          placeholder="e.g. 10"
          onChange={(e) => set("zIndex", e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>

      {/* CSS ID */}
      <div className="epx-field">
        <label className="epx-field__label">CSS ID</label>
        <input
          type="text"
          className="epx-field__input"
          value={value.cssId ?? ""}
          placeholder="my-section"
          onChange={(e) => set("cssId", e.target.value)}
        />
      </div>

      {/* CSS Classes */}
      <div className="epx-field">
        <label className="epx-field__label">CSS Classes</label>
        <input
          type="text"
          className="epx-field__input"
          value={value.cssClasses ?? ""}
          placeholder="class-a class-b"
          onChange={(e) => set("cssClasses", e.target.value)}
        />
      </div>

      {/* Custom CSS */}
      <div className="epx-field">
        <label className="epx-field__label">Custom CSS</label>
        <CodeEditor
          value={value.customCss ?? ""}
          onChange={(v) => set("customCss", v)}
          selector={selector}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = "fields" | "style" | "advanced";

export function RightPanel({ block, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("fields");

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
  const advanced = (block.config.advanced ?? {}) as AdvancedConfig;

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

  const TABS: { id: Tab; icon: React.ReactNode; title: string }[] = [
    { id: "fields", icon: <IconFields />, title: "Fields" },
    { id: "style", icon: <IconStyle />, title: "Style" },
    { id: "advanced", icon: <IconAdvanced />, title: "Advanced" },
  ];

  return (
    <aside className="epx-right-panel">
      <div className="epx-right-panel__header">
        <span className="epx-right-panel__icon">{def.icon}</span>
        <h2 className="epx-right-panel__title">{def.label}</h2>
      </div>
      <p className="epx-right-panel__description">{def.description}</p>

      <div className="epx-right-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`epx-right-panel__tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
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

      {activeTab === "advanced" && (
        <AdvancedTab
          value={advanced}
          onChange={(val) => onChange({ advanced: val })}
          blockId={block.id}
        />
      )}
    </aside>
  );
}
