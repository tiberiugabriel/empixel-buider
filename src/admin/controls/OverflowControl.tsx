import React, { useState } from "react";
import { IconReset } from "./SpacingControl.js";
import { SelectRow } from "./FieldRow.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OverflowValue = { x?: string; y?: string };

export function parseOverflow(style: Record<string, unknown>): OverflowValue {
  return {
    x: (style.overflowX as string) || "",
    y: (style.overflowY as string) || "",
  };
}

export function serializeOverflow(val: OverflowValue): Record<string, string> {
  return {
    overflowX: val.x ?? "",
    overflowY: val.y ?? "",
  };
}

// ─── Options ─────────────────────────────────────────────────────────────────

const OVERFLOW_OPTIONS = [
  { value: "",       label: "Default" },
  { value: "hidden", label: "Hidden"  },
  { value: "auto",   label: "Auto"    },
  { value: "scroll", label: "Scroll"  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconOverflowX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="11" y1="6" x2="1" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <polyline points="3.5,3.5 1,6 3.5,8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polyline points="8.5,3.5 11,6 8.5,8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="0" y1="2" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <line x1="12" y1="2" x2="12" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function IconOverflowY() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="11" x2="6" y2="1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <polyline points="3.5,3.5 6,1 8.5,3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polyline points="3.5,8.5 6,11 8.5,8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="2" y1="0" x2="10" y2="0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <line x1="2" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverflowControl({ value, onChange }: {
  value: OverflowValue;
  onChange: (v: OverflowValue) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const x = value.x ?? "";
  const y = value.y ?? "";

  const isMixed = x !== y;
  const isDirty = x !== "" || y !== "";

  const handleReset = () => onChange({ x: "", y: "" });

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            {isMixed ? (
              <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>Overflow</span>
            ) : (
              <SelectRow
                label="Overflow"
                value={x}
                onChange={(v) => onChange({ x: v, y: v })}
                options={OVERFLOW_OPTIONS}
                labelClassName="epx-row-label--section"
              />
            )}
            {isMixed && <span className="epx-border-mixed">Mixed</span>}
            <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(true)}>▾</button>
          </div>
          {isDirty && (
            <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
              <IconReset />
            </button>
          )}
        </div>
      ) : (
        <div className="epx-spacing-ctrl__expanded">
          <div className="epx-spacing-ctrl__exp-header">
            <span className="epx-spacing-ctrl__label">Overflow</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>
          <SelectRow
            label=""
            value={x}
            onChange={(v) => onChange({ ...value, x: v })}
            options={OVERFLOW_OPTIONS}
            icon={<IconOverflowX />}
          />
          <SelectRow
            label=""
            value={y}
            onChange={(v) => onChange({ ...value, y: v })}
            options={OVERFLOW_OPTIONS}
            icon={<IconOverflowY />}
          />
        </div>
      )}
    </div>
  );
}
