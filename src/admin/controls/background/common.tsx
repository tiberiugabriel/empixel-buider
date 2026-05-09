/**
 * Shared row components, dropdowns, icons, and option sets used by
 * the per-mode `<Mode>Sub.tsx` files. Extracted in F4.7 from
 * `BackgroundControl.tsx` so each sub-file can import only the
 * helpers it needs without duplicating the JSX.
 */
import React, { useEffect, useRef, useState } from "react";

// ─── Tiny inline icons used by image / video / slideshow modes ────────────────

export function IconImage()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/><path d="M1.5 9.5l3-3 2 2 2.5-3 3 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>; }
export function IconVideo()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="currentColor"/></svg>; }
export function IconDragDots() { return <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>; }
export function IconClose()    { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
export function IconMedia()    { return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/></svg>; }

function IconPenSm() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Image / video option sets (shared between Image + Video sub) ─────────────

export const IMG_SIZE_OPTIONS       = ["cover","contain","auto"].map(v => ({ value: v, label: v }));
export const IMG_POSITION_OPTIONS   = ["center","top","bottom","left","right","top left","top center","top right","center left","center right","bottom left","bottom center","bottom right"].map(v => ({ value: v, label: v }));
export const IMG_REPEAT_OPTIONS     = ["no-repeat","repeat","repeat-x","repeat-y","space","round"].map(v => ({ value: v, label: v }));
export const IMG_ATTACHMENT_OPTIONS = ["scroll","fixed","local"].map(v => ({ value: v, label: v }));

// ─── Row components ───────────────────────────────────────────────────────────

export function BgNumRow({ label, value, onChange }: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const handleScrub = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startVal = value ?? 0;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(0, Math.round(startVal + (ev.clientX - startX) / 2));
      onChange(next);
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="epx-side-input">
      <span
        className="epx-side-input__label epx-side-input__label--row epx-row-label--section epx-side-input__label--scrub"
        style={{ cursor: "ew-resize" }}
        onMouseDown={handleScrub}
        title="Drag to adjust"
      >{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto", paddingRight: 6 }}>
        <input
          type="number"
          className="epx-bg-ctrl__stop-pos"
          style={{ width: 44, textAlign: "right" }}
          min={0}
          value={value ?? ""}
          placeholder="—"
          onChange={e => onChange(e.target.value !== "" ? Number(e.target.value) : undefined)}
        />
        <span className="epx-bg-ctrl__stop-unit">s</span>
      </div>
    </div>
  );
}

export function BgToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="epx-side-input">
      <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">{label}</span>
      <label className="epx-toggle" style={{ marginLeft: "auto", paddingRight: 8 }}>
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
        <span className="epx-toggle__track"><span className="epx-toggle__thumb" /></span>
      </label>
    </div>
  );
}

function BgOptionDropdown({ options, value, onSelect, onClose, anchorRef }: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) &&
          !anchorRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  const isCustom = !!value && !options.some(o => o.value === value);

  return (
    <div ref={panelRef} className="epx-unit-dropdown">
      {options.map(opt => (
        <button key={opt.value} type="button"
          className={`epx-unit-dropdown__item${opt.value === value ? " is-active" : ""}`}
          onMouseDown={e => { e.preventDefault(); onSelect(opt.value); onClose(); }}
        >{opt.label}</button>
      ))}
      <div className="epx-unit-dropdown__sep" />
      <button type="button"
        className={`epx-unit-dropdown__item epx-unit-dropdown__item--pen${isCustom ? " is-active" : ""}`}
        onMouseDown={e => { e.preventDefault(); onSelect("__custom__"); onClose(); }}
      ><IconPenSm /></button>
    </div>
  );
}

export function BgOptionRow({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const predefined   = options.map(o => o.value);
  const isCustomVal  = !!value && !predefined.includes(value);
  const showInput    = isCustomVal || customMode;
  const displayLabel = options.find(o => o.value === value)?.label ?? (value || (options[0]?.label ?? ""));

  const handleSelect = (v: string) => {
    if (v === "__custom__") { setCustomMode(true); }
    else { setCustomMode(false); onChange(v); }
    setOpen(false);
  };

  return (
    <>
      <div className="epx-side-input">
        <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">{label}</span>
        <div ref={wrapRef} className="epx-field-row__select-wrap">
          <button type="button"
            className={`epx-field-row__select-btn${showInput ? " epx-field-row__select-btn--pen" : ""}`}
            onClick={() => setOpen(o => !o)}
          >
            {showInput
              ? <IconPenSm />
              : <><span>{displayLabel}</span><span className="epx-field-row__select-caret">▾</span></>
            }
          </button>
          {open && (
            <BgOptionDropdown
              options={options}
              value={value}
              onSelect={handleSelect}
              onClose={() => setOpen(false)}
              anchorRef={wrapRef as React.RefObject<HTMLDivElement>}
            />
          )}
        </div>
      </div>
      {showInput && (
        <div className="epx-bg-ctrl__url-row">
          <input
            type="text"
            className="epx-bg-ctrl__url-input"
            value={value}
            placeholder="e.g. 50% auto"
            onChange={e => { setCustomMode(false); onChange(e.target.value); }}
          />
        </div>
      )}
    </>
  );
}
