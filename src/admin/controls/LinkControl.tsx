import React, { useState } from "react";
import { IconReset } from "./SpacingControl.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinkValue = {
  href?:       string;
  newTab?:     boolean;
  nofollow?:   boolean;
  customAttr?: string;
};

export function parseLink(config: Record<string, unknown>): LinkValue {
  return {
    href:       (config.linkHref       as string)  ?? "",
    newTab:     (config.linkNewTab     as boolean) ?? false,
    nofollow:   (config.linkNofollow   as boolean) ?? false,
    customAttr: (config.linkCustomAttr as string)  ?? "",
  };
}

export function serializeLink(v: LinkValue): Record<string, unknown> {
  return {
    linkHref:       v.href       ?? "",
    linkNewTab:     v.newTab     ?? false,
    linkNofollow:   v.nofollow   ?? false,
    linkCustomAttr: v.customAttr ?? "",
  };
}

export function linkIsDirty(v: LinkValue): boolean {
  return !!(v.href || v.newTab || v.nofollow || v.customAttr);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LinkControl({ value, onChange }: {
  value: LinkValue;
  onChange: (v: LinkValue) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isDirty = linkIsDirty(value);

  const handleReset = () => onChange({ href: "", newTab: false, nofollow: false, customAttr: "" });

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>URL</span>
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
            <span className="epx-spacing-ctrl__label">URL</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          {/* URL input */}
          <div className="epx-side-input">
            <span className="epx-side-input__label epx-side-input__label--row">URL</span>
            <input
              type="text"
              className="epx-side-input__num epx-side-input__num--custom"
              value={value.href ?? ""}
              placeholder="https://"
              onChange={(e) => onChange({ ...value, href: e.target.value })}
            />
          </div>

          {/* Checkboxes */}
          <div className="epx-link-ctrl__checks">
            <label className="epx-link-ctrl__check">
              <input
                type="checkbox"
                checked={value.newTab ?? false}
                onChange={(e) => onChange({ ...value, newTab: e.target.checked })}
              />
              <span>New Tab</span>
            </label>
            <label className="epx-link-ctrl__check">
              <input
                type="checkbox"
                checked={value.nofollow ?? false}
                onChange={(e) => onChange({ ...value, nofollow: e.target.checked })}
              />
              <span>Nofollow</span>
            </label>
          </div>

          {/* Custom Attr */}
          <div className="epx-side-input">
            <span className="epx-side-input__label epx-side-input__label--row">Attr</span>
            <input
              type="text"
              className="epx-side-input__num epx-side-input__num--custom"
              value={value.customAttr ?? ""}
              placeholder="key|value"
              onChange={(e) => onChange({ ...value, customAttr: e.target.value })}
            />
          </div>
          <p className="epx-link-ctrl__hint">
            Separate key and value with <code>|</code>, multiple attrs with <code>,</code>
            ‎ e.g. <code>data-id|123,aria-label|Home</code>
          </p>

        </div>
      )}
    </div>
  );
}
