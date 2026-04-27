import React, { useEffect, useRef, useState } from "react";

// ─── Color utilities ──────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r: number, g: number, b: number;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map(x => x + x).join("") : c.slice(0, 6);
  const n = parseInt(full.padEnd(6, "0"), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const v = max, s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

function clamp01(n: number) { return Math.min(1, Math.max(0, n)); }

function parseColorValue(v: string): { h: number; s: number; val: number; a: number } {
  let hex = "#000000", alpha = 1;
  if (v && v.startsWith("rgba")) {
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) { hex = rgbToHex(+m[1], +m[2], +m[3]); alpha = m[4] !== undefined ? parseFloat(m[4]) : 1; }
  } else if (v && v.startsWith("#")) {
    hex = v;
  }
  const [r, g, b] = hexToRgb(hex);
  const [h, s, val] = rgbToHsv(r, g, b);
  return { h, s, val, a: alpha };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ColorPickerProps {
  value: string;
  alpha?: number;
  onChange: (hex: string, alpha: number) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function ColorPicker({ value, alpha: alphaProp = 1, onChange, onClose, position }: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const [hsva, setHsva] = useState(() => ({ ...parseColorValue(value), a: alphaProp }));
  const hsvaRef = useRef(hsva);
  useEffect(() => { hsvaRef.current = hsva; });

  const [hexInput, setHexInput] = useState(() => rgbToHex(...hsvToRgb(hsva.h, hsva.s, hsva.val)).slice(1).toUpperCase());

  const currentHex = rgbToHex(...hsvToRgb(hsva.h, hsva.s, hsva.val));

  const emit = (h: number, s: number, v: number, a: number) => {
    const hex = rgbToHex(...hsvToRgb(h, s, v));
    setHexInput(hex.slice(1).toUpperCase());
    onChange(hex, a);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  // ── 2D gradient drag ───────────────────────────────────────────────────────
  const startPickerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const { h, a } = hsvaRef.current;
    const move = (ev: MouseEvent) => {
      const rect = pickerRef.current!.getBoundingClientRect();
      const s = clamp01((ev.clientX - rect.left) / rect.width);
      const val = 1 - clamp01((ev.clientY - rect.top) / rect.height);
      setHsva(p => ({ ...p, s, val }));
      emit(h, s, val, a);
    };
    move(e.nativeEvent);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── Hue drag ───────────────────────────────────────────────────────────────
  const startHueDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const { s, val, a } = hsvaRef.current;
    const move = (ev: MouseEvent) => {
      const rect = hueRef.current!.getBoundingClientRect();
      const h = clamp01((ev.clientX - rect.left) / rect.width) * 360;
      setHsva(p => ({ ...p, h }));
      emit(h, s, val, a);
    };
    move(e.nativeEvent);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── Alpha drag ─────────────────────────────────────────────────────────────
  const startAlphaDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const { h, s, val } = hsvaRef.current;
    const move = (ev: MouseEvent) => {
      const rect = alphaRef.current!.getBoundingClientRect();
      const a = clamp01((ev.clientX - rect.left) / rect.width);
      setHsva(p => ({ ...p, a }));
      emit(h, s, val, a);
    };
    move(e.nativeEvent);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── Hex input ──────────────────────────────────────────────────────────────
  const commitHex = (raw: string) => {
    const clean = raw.replace("#", "").trim();
    if (clean.length !== 6 && clean.length !== 3) return;
    const [r, g, b] = hexToRgb("#" + clean);
    const [h, s, val] = rgbToHsv(r, g, b);
    setHsva(p => ({ ...p, h, s, val }));
    onChange("#" + clean.toLowerCase().padEnd(6, "0"), hsvaRef.current.a);
  };

  // ── Eyedropper ─────────────────────────────────────────────────────────────
  const eyedrop = async () => {
    if (!("EyeDropper" in window)) return;
    try {
      type EyeDropperInstance = { open(): Promise<{ sRGBHex: string }> };
      const EyeDropperCtor = (window as unknown as { EyeDropper: new () => EyeDropperInstance }).EyeDropper;
      const { sRGBHex } = await new EyeDropperCtor().open();
      const clean = sRGBHex.replace("#", "").slice(0, 6);
      setHexInput(clean.toUpperCase());
      commitHex(clean);
    } catch { /* cancelled */ }
  };

  // ── Left bound clamp ───────────────────────────────────────────────────────
  const left = Math.min(position.left, window.innerWidth - 228);

  return (
    <div ref={panelRef} className="epx-colorpicker" style={{ top: position.top, left }}>
      {/* Gradient field */}
      <div
        ref={pickerRef}
        className="epx-colorpicker__field"
        style={{ background: `hsl(${hsva.h},100%,50%)` }}
        onMouseDown={startPickerDrag}
      >
        <div className="epx-colorpicker__field-white" />
        <div className="epx-colorpicker__field-black" />
        <div
          className="epx-colorpicker__field-handle"
          style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.val) * 100}%`, background: currentHex }}
        />
      </div>

      {/* Hue + Alpha sliders */}
      <div className="epx-colorpicker__sliders">
        <div ref={hueRef} className="epx-colorpicker__hue" onMouseDown={startHueDrag}>
          <div className="epx-colorpicker__slider-thumb" style={{ left: `${(hsva.h / 360) * 100}%` }} />
        </div>
        <div ref={alphaRef} className="epx-colorpicker__alpha-track" onMouseDown={startAlphaDrag}>
          <div className="epx-colorpicker__alpha-fill" style={{ background: `linear-gradient(to right, transparent, ${currentHex})` }} />
          <div className="epx-colorpicker__slider-thumb" style={{ left: `${hsva.a * 100}%` }} />
        </div>
      </div>

      {/* Inputs row */}
      <div className="epx-colorpicker__inputs">
        <button type="button" className="epx-colorpicker__eyedrop" onClick={eyedrop} title="Pick from screen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.41-1.42-1.42 1.42 1.41 1.41-6.6 6.6A2 2 0 0 0 5 15.83V19h3.17a2 2 0 0 0 1.42-.59l6.6-6.6 1.41 1.42 1.42-1.42-1.42-1.41 3.12-3.12a1 1 0 0 0-.01-1.65Z"/>
          </svg>
        </button>
        <label className="epx-colorpicker__hex-field">
          <span>#</span>
          <input
            className="epx-colorpicker__hex-input"
            value={hexInput}
            maxLength={6}
            spellCheck={false}
            onChange={e => setHexInput(e.target.value)}
            onBlur={e => commitHex(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitHex(hexInput); }}
          />
        </label>
        <label className="epx-colorpicker__alpha-field">
          <input
            className="epx-colorpicker__alpha-input"
            type="number" min={0} max={100}
            value={Math.round(hsva.a * 100)}
            onChange={e => {
              const a = clamp01(Number(e.target.value) / 100);
              setHsva(p => ({ ...p, a }));
              emit(hsva.h, hsva.s, hsva.val, a);
            }}
          />
          <span>%</span>
        </label>
      </div>
    </div>
  );
}
