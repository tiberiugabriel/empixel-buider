import React from "react";
import { getColorDisplay, type ColorFormat } from "../ColorPicker.js";
import { hexToRgba, hexToRgbVals, type GradientStop } from "../colorUtils.js";
import { IconClose } from "./common.js";
import type { BackgroundConfig } from "./serialize.js";

/**
 * Gradient mode body — angle scrubber, sortable stops list with
 * inline color swatches + position inputs, add-stop button, and the
 * preview bar with draggable markers.
 *
 * Extracted in F4.7 from `BackgroundControl.tsx`. The popup
 * `<ColorPicker>` lives in the parent and is dispatched via
 * `openPicker("stop-<i>", anchor)`; the parent then routes the
 * resulting `(hex, alpha)` back into the right stop.
 */
interface Props {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
  colorFormat: ColorFormat;
  openPicker: (key: `stop-${number}`, el: HTMLElement) => void;
}

export function GradientSub({ value, onChange, colorFormat, openPicker }: Props) {
  const stops = value.gradStops ?? [];

  const updateStop = (i: number, patch: Partial<GradientStop>) =>
    onChange({ ...value, gradStops: stops.map((s, idx) => idx === i ? { ...s, ...patch } : s) });

  const addStop = () =>
    onChange({
      ...value,
      gradStops: [
        ...stops,
        { color: "#888888", alpha: 1, pos: Math.round(stops.length > 0 ? (stops[stops.length - 1].pos + 50) / 2 : 50) },
      ],
    });

  const removeStop = (i: number) => {
    if (stops.length <= 2) return;
    onChange({ ...value, gradStops: stops.filter((_, idx) => idx !== i) });
  };

  const makePosScruber = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX   = e.clientX;
    const startPos = stops[i].pos;
    document.body.style.cursor    = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(100, Math.max(0, Math.round(startPos + (ev.clientX - startX) / 2)));
      updateStop(i, { pos: next });
    };
    const onUp = () => {
      document.body.style.cursor    = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {/* Angle */}
      <div className="epx-bg-ctrl__stop" style={{ borderTopColor: "transparent", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <span
          className="epx-bg-ctrl__stop-label"
          style={{ cursor: "ew-resize" }}
          title="Drag to adjust"
          onMouseDown={e => {
            e.preventDefault();
            const startX = e.clientX;
            const startAngle = value.gradAngle ?? 135;
            document.body.style.cursor = "ew-resize";
            document.body.style.userSelect = "none";
            const onMove = (ev: MouseEvent) => {
              const next = Math.min(360, Math.max(0, Math.round(startAngle + (ev.clientX - startX))));
              onChange({ ...value, gradAngle: next });
            };
            const onUp = () => {
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >Angle</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <input
            type="number"
            className="epx-bg-ctrl__stop-pos"
            style={{ width: 46 }}
            value={value.gradAngle ?? 135}
            min={0} max={360}
            onChange={e => onChange({ ...value, gradAngle: Number(e.target.value) })}
          />
          <span className="epx-bg-ctrl__stop-unit">°</span>
        </div>
      </div>

      {/* Stops — sorted by position so list order matches gradient order */}
      {stops.map((stop, i) => ({ stop, i })).sort((a, b) => a.stop.pos - b.stop.pos).map(({ stop, i }) => (
        <div key={i} className="epx-bg-ctrl__stop">
          <button
            type="button"
            className="epx-bg-ctrl__swatch"
            onClick={e => openPicker(`stop-${i}`, e.currentTarget)}
            title="Pick color"
          >
            <div className="epx-bg-ctrl__swatch-fill" style={{ background: `rgba(${hexToRgbVals(stop.color).join(",")},${stop.alpha})` }} />
          </button>
          <span className="epx-bg-ctrl__hex" style={{ flex: 1 }}>{getColorDisplay(stop.color, colorFormat)}</span>
          <input
            type="number"
            className="epx-bg-ctrl__stop-pos"
            value={stop.pos}
            min={0} max={100}
            onChange={e => updateStop(i, { pos: Number(e.target.value) })}
          />
          <span className="epx-bg-ctrl__stop-unit" style={{ cursor: "ew-resize" }} onMouseDown={makePosScruber(i)} title="Drag to adjust">%</span>
          <button
            type="button"
            className="epx-bg-ctrl__stop-remove"
            onClick={() => removeStop(i)}
            disabled={stops.length <= 2}
            title="Remove stop"
          >
            <IconClose />
          </button>
        </div>
      ))}

      {/* Add stop */}
      <button
        type="button"
        className="epx-bg-ctrl__add-btn"
        onClick={addStop}
        disabled={stops.length >= 8}
      >
        + Add Color Stop
      </button>

      {/* Gradient preview bar */}
      {stops.length >= 2 && (
        <div
          className="epx-bg-ctrl__grad-preview"
          style={{
            background: `linear-gradient(to right, ${[...stops].sort((a, b) => a.pos - b.pos).map(s => `rgba(${hexToRgbVals(s.color).join(",")},${s.alpha}) ${s.pos}%`).join(",")})`,
          }}
        >
          {stops.map((stop, i) => (
            <div
              key={i}
              className="epx-bg-ctrl__grad-marker"
              style={{ left: `${stop.pos}%`, color: hexToRgba(stop.color, stop.alpha) }}
              onMouseDown={e => {
                e.preventDefault();
                const bar = e.currentTarget.parentElement!;
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
              }}
            >
              <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--top" />
              <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--bottom" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
