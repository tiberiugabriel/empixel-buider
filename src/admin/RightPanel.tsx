import React, { useEffect, useRef, useState } from "react";
import type { SectionBlock } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";
import type { FieldDef } from "./blockDefinitions.js";
import { SpacingControl, parseSide, serializeSide, type SpacingValue, type SideValue, type SpacingKeys } from "./controls/SpacingControl.js";
import { BorderRadiusControl, parseRadius, serializeRadius, type RadiusValue } from "./controls/BorderRadiusControl.js";
import { BorderControl, parseBorder, serializeBorder, type BorderConfig } from "./controls/BorderControl.js";
import { FieldGroup, SelectRow, TextRow, NumberRow, DimensionControl } from "./controls/FieldRow.js";

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
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
      <path d="m22,13.25v-2.5l-2.318-.966c-.167-.581-.395-1.135-.682-1.654l.954-2.318-1.768-1.768-2.318.954c-.518-.287-1.073-.515-1.654-.682l-.966-2.318h-2.5l-.966,2.318c-.581.167-1.135.395-1.654.682l-2.318-.954-1.768,1.768.954,2.318c-.287.518-.515,1.073-.682,1.654l-2.318.966v2.5l2.318.966c.167.581.395,1.135.682,1.654l-.954,2.318,1.768,1.768,2.318-.954c.518.287,1.073.515,1.654.682l.966,2.318h2.5l.966-2.318c.581-.167,1.135-.395,1.654-.682l2.318.954,1.768-1.768-.954-2.318c.287-.518.515-1.073.682-1.654l2.318-.966Z" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
    </svg>
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
];

// ─── Advanced Tab ─────────────────────────────────────────────────────────────

type AdvancedConfig = {
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
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
  const [copied, setCopied] = useState(false);
  const copySelector = () => {
    navigator.clipboard.writeText(selector).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
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
        <button type="button" className="epx-code-editor__copy-btn" onClick={copySelector} title="Copy selector">
          {copied ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="3" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="var(--epx-surface-code)"/></svg>
          )}
        </button>
        <div className="epx-code-editor__selector-scroll">
          <span className="epx-code-editor__selector-kw">selector</span>
          <span className="epx-code-editor__selector-eq"> = </span>
          <span className="epx-code-editor__selector-val">{selector}</span>
        </div>
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

const POSITION_OPTIONS = [
  { value: "", label: "Default" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
];

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

  const selector = `[data-epx-block="${blockId}"]`;

  const zIndexNum = typeof value.zIndex === "number" ? value.zIndex : (value.zIndex ? Number(value.zIndex) : undefined);

  const hasPosition = !!value.position;

  const offsetValue: SpacingValue = {
    top:    parseSide(value.top),
    right:  parseSide(value.right),
    bottom: parseSide(value.bottom),
    left:   parseSide(value.left),
  };

  const handleOffset = (v: SpacingValue) => {
    const sides: SpacingKeys[] = ["top", "right", "bottom", "left"];
    const next: Partial<AdvancedConfig> = {};
    sides.forEach((s) => {
      next[s] = v[s] ? serializeSide(v[s] as SideValue) : undefined;
    });
    onChange({ ...value, ...next });
  };

  return (
    <div className="epx-right-panel__fields">
      <FieldGroup
        isDirty={!!value.position}
        onReset={() => onChange({ ...value, position: "", top: undefined, right: undefined, bottom: undefined, left: undefined })}
      >
        <SelectRow
          label="Position"
          value={value.position ?? ""}
          onChange={(v) => set("position", v)}
          options={POSITION_OPTIONS}
        />
      </FieldGroup>

      {hasPosition && (
        <SpacingControl
          label="Offset"
          value={offsetValue}
          onChange={handleOffset}
          sides={["top", "right", "bottom", "left"]}
          forceExpanded
        />
      )}

      <FieldGroup
        isDirty={zIndexNum !== undefined}
        onReset={() => set("zIndex", undefined)}
      >
        <NumberRow
          label="Z-Index"
          value={zIndexNum}
          onChange={(v) => set("zIndex", v)}
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!value.cssId}
        onReset={() => set("cssId", "")}
      >
        <TextRow
          label="CSS ID"
          value={value.cssId ?? ""}
          onChange={(v) => set("cssId", v)}
          placeholder="#"
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!value.cssClasses}
        onReset={() => set("cssClasses", "")}
      >
        <TextRow
          label="CSS Classes"
          value={value.cssClasses ?? ""}
          onChange={(v) => set("cssClasses", v)}
          placeholder="."
        />
      </FieldGroup>

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
    top:    parseSide(style.paddingTop),
    right:  parseSide(style.paddingRight),
    bottom: parseSide(style.paddingBottom),
    left:   parseSide(style.paddingLeft),
  };

  const marginValue: SpacingValue = {
    top:    parseSide(style.marginTop),
    right:  parseSide(style.marginRight),
    bottom: parseSide(style.marginBottom),
    left:   parseSide(style.marginLeft),
  };

  const handleSpacing = (key: string, val: SpacingValue) => {
    const prefix = key === "padding" ? "padding" : "margin";
    const next: Record<string, unknown> = { ...style };
    Object.entries(val).forEach(([side, sv]) => {
      const cssKey = `${prefix}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      next[cssKey] = serializeSide(sv as SideValue);
    });
    onChange({ style: next });
  };

  const widthValues = {
    fix: parseSide(style.width),
    min: parseSide(style.minWidth),
    max: parseSide(style.maxWidth),
  };
  const heightValues = {
    fix: parseSide(style.height),
    min: parseSide(style.minHeight),
    max: parseSide(style.maxHeight),
  };
  const CSS_KEYS = {
    width:  { fix: "width",  min: "minWidth",  max: "maxWidth"  },
    height: { fix: "height", min: "minHeight", max: "maxHeight" },
  } as const;
  const handleDimension = (axis: "width" | "height", key: "fix" | "min" | "max", sv: SideValue) => {
    onChange({ style: { ...style, [CSS_KEYS[axis][key]]: serializeSide(sv) } });
  };

  const radiusValue: RadiusValue = parseRadius(style);
  const handleRadius = (val: RadiusValue) => {
    onChange({ style: { ...style, ...serializeRadius(val) } });
  };

  const borderValue: BorderConfig = parseBorder(style);
  const handleBorder = (val: BorderConfig) => {
    onChange({ style: { ...style, ...serializeBorder(val) } });
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
          <DimensionControl
            label="Width"
            values={widthValues}
            onChange={(key, v) => handleDimension("width", key, v)}
            onReset={() => onChange({ style: { ...style, width: "", minWidth: "", maxWidth: "" } })}
          />
          <DimensionControl
            label="Height"
            values={heightValues}
            onChange={(key, v) => handleDimension("height", key, v)}
            onReset={() => onChange({ style: { ...style, height: "", minHeight: "", maxHeight: "" } })}
          />
          <SpacingControl
            label="Padding"
            value={paddingValue}
            onChange={(v) => handleSpacing("padding", v)}
            sides={["top", "right", "bottom", "left"]}
          />
          <SpacingControl
            label="Margin"
            value={marginValue}
            onChange={(v) => handleSpacing("margin", v)}
            sides={["top", "right", "bottom", "left"]}
          />
          <BorderRadiusControl value={radiusValue} onChange={handleRadius} />
          <BorderControl value={borderValue} onChange={handleBorder} />
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
