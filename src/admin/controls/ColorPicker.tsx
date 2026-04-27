import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function hsvToHsl(h: number, s: number, v: number): [number, number, number] {
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [h, sl, l];
}

function hslToHsv(h: number, sl: number, l: number): [number, number, number] {
  const v = l + sl * Math.min(l, 1 - l);
  const s = v === 0 ? 0 : 2 * (1 - l / v);
  return [h, s, v];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  const d = 1 - k;
  return [
    Math.round((1 - r - k) / d * 100),
    Math.round((1 - g - k) / d * 100),
    Math.round((1 - b - k) / d * 100),
    Math.round(k * 100),
  ];
}

function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return [
    Math.round(255 * (1 - c) * (1 - k)),
    Math.round(255 * (1 - m) * (1 - k)),
    Math.round(255 * (1 - y) * (1 - k)),
  ];
}

function linSrgb(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  const rl = linSrgb(r / 255), gl = linSrgb(g / 255), bl = linSrgb(b / 255);
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bOk = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(a * a + bOk * bOk);
  let H = Math.atan2(bOk, a) * 180 / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const h = H * Math.PI / 180;
  const a = C * Math.cos(h), bOk = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bOk;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bOk;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bOk;
  const ll = l_ ** 3, mm = m_ ** 3, ss = s_ ** 3;
  return [
    Math.round(Math.max(0, Math.min(255, delinSrgb( 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss) * 255))),
    Math.round(Math.max(0, Math.min(255, delinSrgb(-1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss) * 255))),
    Math.round(Math.max(0, Math.min(255, delinSrgb(-0.0041960863 * ll - 0.7034186147 * mm + 1.7076147010 * ss) * 255))),
  ];
}

function clamp01(n: number) { return Math.min(1, Math.max(0, n)); }
function clampN(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

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

// ─── Format definitions ───────────────────────────────────────────────────────

type ColorFormat = "HEX" | "RGB" | "HSV" | "HSL" | "CMYK" | "OKLCH";
const FORMATS: ColorFormat[] = ["HEX", "RGB", "HSV", "HSL", "CMYK", "OKLCH"];

const FORMAT_LABELS: Record<ColorFormat, string[]> = {
  HEX:   [],
  RGB:   ["R", "G", "B"],
  HSV:   ["H", "S", "V"],
  HSL:   ["H", "S", "L"],
  CMYK:  ["C", "M", "Y", "K"],
  OKLCH: ["L", "C", "H"],
};

function getFormatVals(fmt: ColorFormat, h: number, s: number, v: number): string[] {
  const [r, g, b] = hsvToRgb(h, s, v);
  switch (fmt) {
    case "HEX":  return [rgbToHex(r, g, b).slice(1).toUpperCase()];
    case "RGB":  return [String(r), String(g), String(b)];
    case "HSV":  return [String(Math.round(h)), String(Math.round(s * 100)), String(Math.round(v * 100))];
    case "HSL": {
      const [, sl, l] = hsvToHsl(h, s, v);
      return [String(Math.round(h)), String(Math.round(sl * 100)), String(Math.round(l * 100))];
    }
    case "CMYK": {
      const [c, m, y, k] = rgbToCmyk(r, g, b);
      return [String(c), String(m), String(y), String(k)];
    }
    case "OKLCH": {
      const [L, C, H2] = rgbToOklch(r, g, b);
      return [L.toFixed(2), C.toFixed(3), String(Math.round(H2))];
    }
  }
}

function parseFormatVals(fmt: ColorFormat, vals: string[]): { h: number; s: number; val: number } | null {
  try {
    let r = 0, g = 0, b = 0;
    switch (fmt) {
      case "HEX": {
        const clean = vals[0].replace(/[^0-9a-fA-F]/g, "");
        if (clean.length !== 6 && clean.length !== 3) return null;
        [r, g, b] = hexToRgb("#" + clean);
        break;
      }
      case "RGB":
        r = clampN(Math.round(Number(vals[0])), 0, 255);
        g = clampN(Math.round(Number(vals[1])), 0, 255);
        b = clampN(Math.round(Number(vals[2])), 0, 255);
        break;
      case "HSV": {
        const hv = ((Number(vals[0]) % 360) + 360) % 360;
        [r, g, b] = hsvToRgb(hv, clamp01(Number(vals[1]) / 100), clamp01(Number(vals[2]) / 100));
        break;
      }
      case "HSL": {
        const hl = ((Number(vals[0]) % 360) + 360) % 360;
        const [, sv, vv] = hslToHsv(hl, clamp01(Number(vals[1]) / 100), clamp01(Number(vals[2]) / 100));
        [r, g, b] = hsvToRgb(hl, sv, vv);
        break;
      }
      case "CMYK":
        [r, g, b] = cmykToRgb(
          clampN(Number(vals[0]), 0, 100), clampN(Number(vals[1]), 0, 100),
          clampN(Number(vals[2]), 0, 100), clampN(Number(vals[3]), 0, 100)
        );
        break;
      case "OKLCH":
        [r, g, b] = oklchToRgb(
          clamp01(Number(vals[0])),
          Math.max(0, Number(vals[1])),
          ((Number(vals[2]) % 360) + 360) % 360
        );
        break;
    }
    const [hOut, sOut, vOut] = rgbToHsv(r, g, b);
    return { h: hOut, s: sOut, val: vOut };
  } catch { return null; }
}

// ─── Public helper ────────────────────────────────────────────────────────────

export { type ColorFormat };

export function getColorDisplay(hex: string, fmt: ColorFormat): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, v] = rgbToHsv(r, g, b);
  switch (fmt) {
    case "HEX":  return hex.toUpperCase();
    case "RGB":  return `${r} ${g} ${b}`;
    case "HSV":  return `${Math.round(h)} ${Math.round(s * 100)} ${Math.round(v * 100)}`;
    case "HSL": {
      const [, sl, l] = hsvToHsl(h, s, v);
      return `${Math.round(h)} ${Math.round(sl * 100)} ${Math.round(l * 100)}`;
    }
    case "CMYK": {
      const [c, m, y, k] = rgbToCmyk(r, g, b);
      return `${c} ${m} ${y} ${k}`;
    }
    case "OKLCH": {
      const [L, C, H2] = rgbToOklch(r, g, b);
      return `${L.toFixed(2)} ${C.toFixed(3)} ${Math.round(H2)}`;
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ColorPickerProps {
  value: string;
  alpha?: number;
  onChange: (hex: string, alpha: number) => void;
  onClose: () => void;
  position: { top: number; left: number };
  format?: ColorFormat;
  onFormatChange?: (f: ColorFormat) => void;
}

export function ColorPicker({ value, alpha: alphaProp = 1, onChange, onClose, position, format: formatProp, onFormatChange }: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef(false);

  const [hsva, setHsva] = useState(() => ({ ...parseColorValue(value), a: alphaProp }));
  const hsvaRef = useRef(hsva);
  useEffect(() => { hsvaRef.current = hsva; });

  const [format, setFormat] = useState<ColorFormat>(formatProp ?? "HEX");
  const formatRef = useRef<ColorFormat>(formatProp ?? "HEX");
  useEffect(() => { formatRef.current = format; });

  const [draftVals, setDraftVals] = useState<string[]>(() =>
    getFormatVals("HEX", hsva.h, hsva.s, hsva.val)
  );

  const currentHex = rgbToHex(...hsvToRgb(hsva.h, hsva.s, hsva.val));

  const emit = (h: number, s: number, v: number, a: number) => {
    if (!editingRef.current) {
      setDraftVals(getFormatVals(formatRef.current, h, s, v));
    }
    onChange(rgbToHex(...hsvToRgb(h, s, v)), a);
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

  // ── Commit typed values ────────────────────────────────────────────────────
  const commitFormat = (vals: string[]) => {
    const result = parseFormatVals(formatRef.current, vals);
    if (!result) return;
    const { h, s, val } = result;
    setHsva(p => ({ ...p, h, s, val }));
    setDraftVals(getFormatVals(formatRef.current, h, s, val));
    onChange(rgbToHex(...hsvToRgb(h, s, val)), hsvaRef.current.a);
  };

  // ── Cycle format ───────────────────────────────────────────────────────────
  const cycleFormat = () => {
    const next = FORMATS[(FORMATS.indexOf(formatRef.current) + 1) % FORMATS.length];
    setFormat(next);
    formatRef.current = next;
    onFormatChange?.(next);
    const { h, s, val } = hsvaRef.current;
    setDraftVals(getFormatVals(next, h, s, val));
  };

  // ── Eyedropper ─────────────────────────────────────────────────────────────
  const eyedrop = async () => {
    if (!("EyeDropper" in window)) return;
    try {
      type EyeDropperInstance = { open(): Promise<{ sRGBHex: string }> };
      const EyeDropperCtor = (window as unknown as { EyeDropper: new () => EyeDropperInstance }).EyeDropper;
      const { sRGBHex } = await new EyeDropperCtor().open();
      const clean = sRGBHex.replace("#", "").slice(0, 6);
      const [r, g, b] = hexToRgb("#" + clean);
      const [h, s, val] = rgbToHsv(r, g, b);
      setHsva(p => ({ ...p, h, s, val }));
      setDraftVals(getFormatVals(formatRef.current, h, s, val));
      onChange("#" + clean, hsvaRef.current.a);
    } catch { /* cancelled */ }
  };

  const left = Math.max(8, Math.min(position.left, window.innerWidth - 268));
  const labels = FORMAT_LABELS[format];

  return createPortal(
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

        <button type="button" className="epx-colorpicker__fmt-btn" onClick={cycleFormat} title="Switch format">
          {format}
        </button>

        <div className="epx-colorpicker__fmt-inputs">
          {format === "HEX" ? (
            <input
              className="epx-colorpicker__fmt-input"
              value={draftVals[0] ?? ""}
              maxLength={7}
              spellCheck={false}
              onFocus={() => { editingRef.current = true; }}
              onBlur={e => { editingRef.current = false; commitFormat([e.target.value]); }}
              onChange={e => setDraftVals([e.target.value])}
              onKeyDown={e => { if (e.key === "Enter") { commitFormat(draftVals); (e.target as HTMLInputElement).blur(); } }}
            />
          ) : (
            draftVals.map((val, i) => (
              <input
                key={i}
                title={labels[i]}
                className="epx-colorpicker__fmt-input"
                value={val}
                onFocus={() => { editingRef.current = true; }}
                onBlur={() => { editingRef.current = false; commitFormat(draftVals); }}
                onChange={e => setDraftVals(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                onKeyDown={e => { if (e.key === "Enter") { commitFormat(draftVals); (e.target as HTMLInputElement).blur(); } }}
              />
            ))
          )}
        </div>

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
    </div>,
    document.body
  );
}
