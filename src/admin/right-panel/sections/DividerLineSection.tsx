import React, { useRef, useState } from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import type {
  DividerConfig,
  DividerStyle,
  DividerGradient,
  DividerGradientStop,
} from "../../../types.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import { NumberWithUnits } from "../../controls/NumberWithUnits.js";
import { IconGroup } from "../../controls/IconGroup.js";
import {
  ColorPicker,
  getColorDisplay,
  type ColorFormat,
} from "../../controls/ColorPicker.js";

// Local stand-in for `RightPanel.PanelDivider` so this file has no
// import-cycle with `RightPanel.tsx` during the F3.5 transition.
function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

/**
 * Divider line picker for the `divider-spacer` block — style / width /
 * length / color (or gradient editor) / align / IconGroup.
 *
 * F3.5.2 — extracted as a standalone declarative renderer to back the
 * `{ kind: "custom", render: DividerLineSection }` entry in
 * `divider-spacer`'s `styleTab`. The schema already has a built-in
 * `{ kind: "dividerLine" }` variant; F3.5.3 may swap this custom
 * renderer for that built-in once `SectionRenderer.tsx` lands.
 *
 * The original imperative branch in `RightPanel.tsx` (~lines 958–1267)
 * lives on the Fields tab today; F3.5.6 will reroute it to the Style
 * tab via this declarative section + delete the inline copy.
 */
export function DividerLineSection({ block, onChange }: SectionRenderProps) {
  const config = block.config as Record<string, unknown>;
  const divider = (config.divider ?? {}) as DividerConfig;

  const [divColorOpen, setDivColorOpen] = useState(false);
  const [divColorPos, setDivColorPos] = useState({ top: 0, left: 0 });
  const [divColorFormat, setDivColorFormat] = useState<ColorFormat>("HEX");
  const divColorSwatchRef = useRef<HTMLButtonElement>(null);
  const [divGradPickerKey, setDivGradPickerKey] = useState<number | null>(null);
  const [divGradPickerPos, setDivGradPickerPos] = useState({ top: 0, left: 0 });
  const [divGradColorFormat, setDivGradColorFormat] = useState<ColorFormat>("HEX");

  const setDivider = (patch: Partial<DividerConfig>) =>
    onChange({ divider: { ...divider, ...patch } });

  const dividerActive = divider.style && divider.style !== "none";
  const isGradient = divider.style === "gradient";
  const gradient: DividerGradient = divider.gradient ?? {
    angle: 0,
    stops: [
      { color: "#000000", alpha: 1, pos: 0 },
      { color: "#000000", alpha: 0, pos: 100 },
    ],
  };
  const gradStops: DividerGradientStop[] = gradient.stops ?? [];

  const setGradient = (patch: Partial<DividerGradient>) =>
    setDivider({ gradient: { ...gradient, ...patch } });
  const updateStop = (i: number, patch: Partial<DividerGradientStop>) =>
    setGradient({ stops: gradStops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStop = () =>
    setGradient({
      stops: [
        ...gradStops,
        { color: "#888888", alpha: 1, pos: Math.min(100, (gradStops[gradStops.length - 1]?.pos ?? 50) + 10) },
      ],
    });
  const removeStop = (i: number) => {
    if (gradStops.length <= 2) return;
    setGradient({ stops: gradStops.filter((_, idx) => idx !== i) });
  };
  const openDivColor = () => {
    if (divColorSwatchRef.current) {
      const r = divColorSwatchRef.current.getBoundingClientRect();
      setDivColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setDivColorOpen((o) => !o);
  };
  const openGradStop = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setDivGradPickerPos({ top: r.bottom + 4, left: r.left - 180 });
    setDivGradPickerKey((prev) => (prev === i ? null : i));
  };

  const startAngleScrub = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startAngle = gradient.angle ?? 0;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = ((Math.round(startAngle + (ev.clientX - startX)) % 360) + 360) % 360;
      setGradient({ angle: next });
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
  const startStopPosScrub = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPos = gradStops[i].pos;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(100, Math.max(0, Math.round(startPos + (ev.clientX - startX) / 2)));
      updateStop(i, { pos: next });
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

  // CSS-mapped angle for visual fidelity (UI 0=top→bottom, CSS 0=bottom→top).
  const cssAngle = (((gradient.angle ?? 0) + 180) % 360);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <PanelDivider />
      <span
        className="epx-row-label--section"
        style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        Divider
      </span>
      <FieldGroup
        isDirty={!!divider.style && divider.style !== "none"}
        onReset={() => setDivider({ style: "none" })}
      >
        <SelectRow
          label="Style"
          value={divider.style ?? "none"}
          onChange={(v) => setDivider({ style: v as DividerStyle })}
          options={[
            { value: "none",     label: "None" },
            { value: "solid",    label: "Solid" },
            { value: "dashed",   label: "Dashed" },
            { value: "dotted",   label: "Dotted" },
            { value: "double",   label: "Double" },
            { value: "groove",   label: "Groove" },
            { value: "ridge",    label: "Ridge" },
            { value: "gradient", label: "Gradient" },
            { value: "wavy",     label: "Wavy" },
            { value: "zigzag",   label: "Zigzag" },
          ]}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      {dividerActive && (
        <>
          <NumberWithUnits
            label="Width"
            value={divider.width}
            onChange={(v) => setDivider({ width: v || undefined })}
            units={["px", "rem", "em"]}
          />
          <NumberWithUnits
            label="Length"
            value={divider.length}
            onChange={(v) => setDivider({ length: v || undefined })}
            units={["%", "px", "rem", "em", "vw"]}
          />
          {!isGradient && (
            <FieldGroup
              isDirty={!!divider.color || (divider.colorAlpha !== undefined && divider.colorAlpha < 1)}
              onReset={() => setDivider({ color: undefined, colorAlpha: undefined })}
            >
              <div className="epx-side-input">
                <span className="epx-side-input__label epx-side-input__label--row">Color</span>
                <div className="epx-border-color-cell" style={{ flex: 1 }}>
                  <button
                    ref={divColorSwatchRef}
                    type="button"
                    className="epx-border-color-swatch"
                    style={{ background: divider.color || "#000000", opacity: divider.colorAlpha ?? 1 }}
                    onClick={openDivColor}
                  />
                  <span className="epx-border-color-hex">{getColorDisplay(divider.color || "#000000", divColorFormat)}</span>
                  {divColorOpen && (
                    <ColorPicker
                      value={divider.color || "#000000"}
                      alpha={divider.colorAlpha ?? 1}
                      onChange={(hex, a) => setDivider({ color: hex, colorAlpha: a })}
                      onClose={() => setDivColorOpen(false)}
                      position={divColorPos}
                      format={divColorFormat}
                      onFormatChange={setDivColorFormat}
                    />
                  )}
                </div>
              </div>
            </FieldGroup>
          )}
          {isGradient && (
            <div className="epx-bg-ctrl__card" style={{ marginTop: 4 }}>
              <div className="epx-spacing-ctrl__exp-header">
                <span className="epx-spacing-ctrl__label">Gradient</span>
              </div>
              <div className="epx-bg-ctrl__body">
                <div className="epx-bg-ctrl__stop" style={{ borderTopColor: "transparent", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <span
                    className="epx-bg-ctrl__stop-label"
                    style={{ cursor: "ew-resize" }}
                    title="Drag to adjust"
                    onMouseDown={startAngleScrub}
                  >
                    Angle
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <input
                      type="number"
                      className="epx-bg-ctrl__stop-pos"
                      style={{ width: 46 }}
                      value={gradient.angle ?? 0}
                      min={0}
                      max={360}
                      onChange={(e) => setGradient({ angle: Number(e.target.value) })}
                    />
                    <span className="epx-bg-ctrl__stop-unit">°</span>
                  </div>
                </div>
                {[...gradStops]
                  .map((stop, i) => ({ stop, i }))
                  .sort((a, b) => a.stop.pos - b.stop.pos)
                  .map(({ stop, i }) => (
                    <div key={i} className="epx-bg-ctrl__stop">
                      <button
                        type="button"
                        className="epx-bg-ctrl__swatch"
                        onClick={(e) => openGradStop(i, e.currentTarget)}
                        title="Pick color"
                      >
                        <div className="epx-bg-ctrl__swatch-fill" style={{ background: stop.color, opacity: stop.alpha }} />
                      </button>
                      <span className="epx-bg-ctrl__hex" style={{ flex: 1 }}>{getColorDisplay(stop.color, divGradColorFormat)}</span>
                      <input
                        type="number"
                        className="epx-bg-ctrl__stop-pos"
                        value={stop.pos}
                        min={0}
                        max={100}
                        onChange={(e) => updateStop(i, { pos: Number(e.target.value) })}
                      />
                      <span
                        className="epx-bg-ctrl__stop-unit"
                        style={{ cursor: "ew-resize" }}
                        onMouseDown={startStopPosScrub(i)}
                        title="Drag to adjust"
                      >
                        %
                      </span>
                      <button
                        type="button"
                        className="epx-bg-ctrl__stop-remove"
                        onClick={() => removeStop(i)}
                        disabled={gradStops.length <= 2}
                        title="Remove stop"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  className="epx-bg-ctrl__add-btn"
                  onClick={addStop}
                  disabled={gradStops.length >= 8}
                >
                  + Add Color Stop
                </button>
                {gradStops.length >= 2 && (() => {
                  const sortedStops = [...gradStops].sort((a, b) => a.pos - b.pos);
                  const previewBg = `linear-gradient(${cssAngle}deg, ${sortedStops.map((s) => {
                    const c = s.color.replace("#", "");
                    const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
                    const n = parseInt(full.padEnd(6, "0"), 16);
                    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${s.alpha}) ${s.pos}%`;
                  }).join(",")})`;
                  const onMarkerDown = (i: number) => (e: React.MouseEvent) => {
                    e.preventDefault();
                    const bar = (e.currentTarget as HTMLElement).parentElement!;
                    const rect = bar.getBoundingClientRect();
                    document.body.style.cursor = "ew-resize";
                    document.body.style.userSelect = "none";
                    const onMove = (ev: MouseEvent) => {
                      const pct = Math.min(100, Math.max(0, Math.round(((ev.clientX - rect.left) / rect.width) * 100)));
                      updateStop(i, { pos: pct });
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
                    <div
                      className="epx-bg-ctrl__grad-preview"
                      style={{ background: previewBg }}
                    >
                      {gradStops.map((stop, i) => (
                        <div
                          key={i}
                          className="epx-bg-ctrl__grad-marker"
                          style={{ left: `${stop.pos}%`, color: stop.color }}
                          onMouseDown={onMarkerDown(i)}
                        >
                          <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--top" />
                          <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--bottom" />
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {divGradPickerKey !== null && gradStops[divGradPickerKey] && (
                  <ColorPicker
                    value={gradStops[divGradPickerKey].color}
                    alpha={gradStops[divGradPickerKey].alpha}
                    onChange={(hex, a) => updateStop(divGradPickerKey, { color: hex, alpha: a })}
                    onClose={() => setDivGradPickerKey(null)}
                    position={divGradPickerPos}
                    format={divGradColorFormat}
                    onFormatChange={setDivGradColorFormat}
                  />
                )}
              </div>
            </div>
          )}
          <FieldGroup
            isDirty={!!divider.align && divider.align !== "center"}
            onReset={() => setDivider({ align: "center" })}
          >
            <SelectRow
              label="Align"
              value={divider.align ?? "center"}
              onChange={(v) => setDivider({ align: v as DividerConfig["align"] })}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
              labelClassName="epx-row-label--section"
            />
          </FieldGroup>
          <IconGroup
            label="Divider Icon"
            value={divider.icon}
            onChange={(v) => setDivider({ icon: v })}
            showPosition={true}
          />
        </>
      )}
    </div>
  );
}
