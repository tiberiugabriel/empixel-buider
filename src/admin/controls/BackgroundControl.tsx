import React, { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";
import { IconReset } from "./SpacingControl.js";
import { MediaPicker } from "./MediaPicker.js";
import type { MediaRef } from "./MediaPicker.js";
export type { MediaRef } from "./MediaPicker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundType = "color" | "gradient" | "image" | "video" | "slideshow";

export interface GradientStop {
  color: string;
  alpha: number;
  pos: number;
}

export interface BackgroundConfig {
  type?: BackgroundType;
  color?: string;
  colorAlpha?: number;
  gradAngle?: number;
  gradStops?: GradientStop[];
  image?: MediaRef;
  videoSrc?: "media" | "url";
  videoMedia?: MediaRef;
  videoUrl?: string;
  slides?: MediaRef[];
}

// ─── Parse / Serialize ────────────────────────────────────────────────────────

export function parseBackground(style: Record<string, unknown>): BackgroundConfig {
  const type = style.backgroundType as BackgroundType | undefined;
  if (!type) return {};
  const cfg: BackgroundConfig = { type };
  if (type === "color") {
    cfg.color      = (style.backgroundColor     as string) ?? "#ffffff";
    cfg.colorAlpha = (style.backgroundColorAlpha as number) ?? 1;
  } else if (type === "gradient") {
    cfg.gradAngle = (style.backgroundGradAngle as number) ?? 135;
    try { cfg.gradStops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); }
    catch { cfg.gradStops = []; }
  } else if (type === "image") {
    const id  = style.backgroundImageId         as string | undefined;
    const key = style.backgroundImageStorageKey as string | undefined;
    if (id && key) cfg.image = { id, storageKey: key, alt: style.backgroundImageAlt as string | undefined, filename: style.backgroundImageFilename as string | undefined };
  } else if (type === "video") {
    cfg.videoSrc = (style.backgroundVideoSrc as "media" | "url") ?? "media";
    const vid    = style.backgroundVideoMediaId           as string | undefined;
    const vkey   = style.backgroundVideoMediaStorageKey   as string | undefined;
    if (vid && vkey) cfg.videoMedia = { id: vid, storageKey: vkey, filename: style.backgroundVideoMediaFilename as string | undefined };
    cfg.videoUrl = style.backgroundVideoUrl as string | undefined;
  } else if (type === "slideshow") {
    try { cfg.slides = JSON.parse((style.backgroundSlides as string) ?? "[]"); }
    catch { cfg.slides = []; }
  }
  return cfg;
}

const CLEARED: Record<string, undefined> = {
  backgroundType: undefined,
  backgroundColor: undefined, backgroundColorAlpha: undefined,
  backgroundGradAngle: undefined, backgroundGradStops: undefined,
  backgroundImageId: undefined, backgroundImageStorageKey: undefined,
  backgroundImageAlt: undefined, backgroundImageFilename: undefined,
  backgroundVideoSrc: undefined, backgroundVideoMediaId: undefined,
  backgroundVideoMediaStorageKey: undefined, backgroundVideoMediaFilename: undefined,
  backgroundVideoUrl: undefined, backgroundSlides: undefined,
};

export function serializeBackground(cfg: BackgroundConfig): Record<string, unknown> {
  if (!cfg.type) return { ...CLEARED };
  const out: Record<string, unknown> = { ...CLEARED, backgroundType: cfg.type };
  if (cfg.type === "color") {
    out.backgroundColor     = cfg.color      ?? "#ffffff";
    out.backgroundColorAlpha = cfg.colorAlpha ?? 1;
  } else if (cfg.type === "gradient") {
    out.backgroundGradAngle = cfg.gradAngle ?? 135;
    out.backgroundGradStops = JSON.stringify(cfg.gradStops ?? []);
  } else if (cfg.type === "image" && cfg.image) {
    out.backgroundImageId         = cfg.image.id;
    out.backgroundImageStorageKey = cfg.image.storageKey;
    out.backgroundImageAlt        = cfg.image.alt;
    out.backgroundImageFilename   = cfg.image.filename;
  } else if (cfg.type === "video") {
    out.backgroundVideoSrc = cfg.videoSrc ?? "media";
    if (cfg.videoMedia) {
      out.backgroundVideoMediaId           = cfg.videoMedia.id;
      out.backgroundVideoMediaStorageKey   = cfg.videoMedia.storageKey;
      out.backgroundVideoMediaFilename     = cfg.videoMedia.filename;
    }
    out.backgroundVideoUrl = cfg.videoUrl;
  } else if (cfg.type === "slideshow") {
    out.backgroundSlides = JSON.stringify(cfg.slides ?? []);
  }
  return out;
}

// ─── Exported CSS helper (used by preview + SectionContainer) ─────────────────

export function hexToRgbVals(hex: string): [number, number, number] {
  const c    = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map(x => x + x).join("") : c.slice(0, 6);
  const n    = parseInt(full.padEnd(6, "0"), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbVals(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function buildBackgroundCss(style: Record<string, unknown>): string {
  const type = style.backgroundType as BackgroundType | undefined;
  if (!type) return "";
  if (type === "color") {
    const color = (style.backgroundColor     as string) ?? "#ffffff";
    const alpha = (style.backgroundColorAlpha as number) ?? 1;
    return `background:${hexToRgba(color, alpha)}`;
  }
  if (type === "gradient") {
    const angle = (style.backgroundGradAngle as number) ?? 135;
    let stops: GradientStop[] = [];
    try { stops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); } catch { /**/ }
    if (stops.length < 2) return "";
    const parts = stops.map(s => `${hexToRgba(s.color, s.alpha)} ${s.pos}%`).join(",");
    return `background:linear-gradient(${angle}deg,${parts})`;
  }
  if (type === "image") {
    const key = style.backgroundImageStorageKey as string | undefined;
    if (!key) return "";
    return `background:url(/_emdash/api/media/file/${key}) center/cover no-repeat`;
  }
  return "";
}

// ─── Tab icons ────────────────────────────────────────────────────────────────

function IconColor()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor"/></svg>; }
function IconGradient()  {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <defs>
        <linearGradient id="epx-ig" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="currentColor"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="12" height="12" rx="2" fill="url(#epx-ig)"/>
    </svg>
  );
}
function IconImage()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/><path d="M1.5 9.5l3-3 2 2 2.5-3 3 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>; }
function IconVideo()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="currentColor"/></svg>; }
function IconSlideshow() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0.5" y="3.5" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="3.5" y="1" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none"/></svg>; }
function IconDragDots()  { return <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>; }
function IconClose()     { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconMedia()     { return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/></svg>; }

const TYPE_TABS: { type: BackgroundType; icon: React.ReactNode; title: string }[] = [
  { type: "color",     icon: <IconColor />,     title: "Solid Color" },
  { type: "gradient",  icon: <IconGradient />,  title: "Gradient" },
  { type: "image",     icon: <IconImage />,     title: "Image" },
  { type: "video",     icon: <IconVideo />,     title: "Video" },
  { type: "slideshow", icon: <IconSlideshow />, title: "Slideshow" },
];

// ─── SortableSlide ────────────────────────────────────────────────────────────

function SortableSlide({ slide, onRemove }: { slide: MediaRef; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  return (
    <div
      ref={setNodeRef}
      className="epx-bg-ctrl__slide"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="epx-bg-ctrl__slide-drag" {...attributes} {...listeners} title="Drag to reorder">
        <IconDragDots />
      </span>
      {slide.storageKey ? (
        <img className="epx-bg-ctrl__thumb" src={`/_emdash/api/media/file/${slide.storageKey}`} alt={slide.alt ?? slide.filename ?? ""} />
      ) : (
        <div className="epx-bg-ctrl__thumb-placeholder"><IconMedia /></div>
      )}
      <span className="epx-bg-ctrl__slide-name">{slide.filename ?? slide.id}</span>
      <button type="button" className="epx-bg-ctrl__slide-remove" onClick={onRemove} title="Remove">
        <IconClose />
      </button>
    </div>
  );
}

// ─── BackgroundControl ────────────────────────────────────────────────────────

type PickerKey = "main" | `stop-${number}`;

export function BackgroundControl({ value, onChange }: {
  value: BackgroundConfig;
  onChange: (v: BackgroundConfig) => void;
}) {
  const [pickerKey, setPickerKey]       = useState<PickerKey | null>(null);
  const [pickerPos, setPickerPos]       = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat]   = useState<ColorFormat>("HEX");
  const [mediaPicker, setMediaPicker]   = useState<"image" | "video" | "slideshow" | null>(null);

  const isDirty = !!value.type;
  const stops   = value.gradStops ?? [];
  const slides  = value.slides   ?? [];

  // ── Type switch ────────────────────────────────────────────────────────────
  const setType = (type: BackgroundType) => {
    if (value.type === type) return;
    const next: BackgroundConfig = { type };
    if (type === "color")     { next.color = "#ffffff"; next.colorAlpha = 1; }
    if (type === "gradient")  { next.gradAngle = 135; next.gradStops = [{ color: "#000000", alpha: 1, pos: 0 }, { color: "#ffffff", alpha: 1, pos: 100 }]; }
    if (type === "video")     { next.videoSrc = "media"; }
    if (type === "slideshow") { next.slides = []; }
    onChange(next);
  };

  // ── Color picker ───────────────────────────────────────────────────────────
  const openPicker = (key: PickerKey, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPickerPos({ top: r.bottom + 4, left: r.left - 180 });
    setPickerKey(prev => prev === key ? null : key);
  };

  const activeColor = (): string => {
    if (pickerKey === "main") return value.color ?? "#ffffff";
    if (pickerKey?.startsWith("stop-")) {
      const i = parseInt(pickerKey.slice(5), 10);
      return stops[i]?.color ?? "#000000";
    }
    return "#000000";
  };

  const activeAlpha = (): number => {
    if (pickerKey === "main") return value.colorAlpha ?? 1;
    if (pickerKey?.startsWith("stop-")) {
      const i = parseInt(pickerKey.slice(5), 10);
      return stops[i]?.alpha ?? 1;
    }
    return 1;
  };

  const handleColorChange = (hex: string, alpha: number) => {
    if (pickerKey === "main") {
      onChange({ ...value, color: hex, colorAlpha: alpha });
    } else if (pickerKey?.startsWith("stop-")) {
      const i = parseInt(pickerKey.slice(5), 10);
      onChange({ ...value, gradStops: stops.map((s, idx) => idx === i ? { ...s, color: hex, alpha } : s) });
    }
  };

  // ── Gradient helpers ───────────────────────────────────────────────────────
  const updateStop = (i: number, patch: Partial<GradientStop>) =>
    onChange({ ...value, gradStops: stops.map((s, idx) => idx === i ? { ...s, ...patch } : s) });

  const addStop    = () => onChange({ ...value, gradStops: [...stops, { color: "#888888", alpha: 1, pos: Math.round(stops.length > 0 ? (stops[stops.length - 1].pos + 50) / 2 : 50) }] });
  const removeStop = (i: number) => { if (stops.length <= 2) return; onChange({ ...value, gradStops: stops.filter((_, idx) => idx !== i) }); };

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

  // ── Slideshow DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSlideDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = slides.findIndex(s => s.id === active.id);
      const newIdx = slides.findIndex(s => s.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) onChange({ ...value, slides: arrayMove(slides, oldIdx, newIdx) });
    }
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>

      <div className="epx-bg-ctrl__card">

        {/* ── Header ── */}
        <div className="epx-spacing-ctrl__exp-header">
          <span className="epx-spacing-ctrl__label">Background</span>
          {isDirty && (
            <div className="epx-spacing-ctrl__exp-actions">
              <button type="button" className="epx-reset-btn" onClick={() => onChange({})} title="Reset">
                <IconReset />
              </button>
            </div>
          )}
        </div>

        {/* ── Type tabs ── */}
        <div className="epx-bg-ctrl__type-tabs">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.type}
              type="button"
              className={`epx-bg-ctrl__type-tab${value.type === tab.type ? " is-active" : ""}`}
              onClick={() => setType(tab.type)}
              title={tab.title}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        {value.type && (
          <div className="epx-bg-ctrl__body">

            {/* ── COLOR ── */}
          {value.type === "color" && (
            <div className="epx-bg-ctrl__color-row">
              <button
                type="button"
                className="epx-bg-ctrl__swatch"
                onClick={e => openPicker("main", e.currentTarget)}
                title="Pick color"
              >
                <div className="epx-bg-ctrl__swatch-fill" style={{ background: `rgba(${hexToRgbVals(value.color ?? "#ffffff").join(",")},${value.colorAlpha ?? 1})` }} />
              </button>
              <span className="epx-bg-ctrl__hex">{getColorDisplay(value.color ?? "#ffffff", colorFormat)}</span>
              <span className="epx-bg-ctrl__alpha-label">{Math.round((value.colorAlpha ?? 1) * 100)}%</span>
            </div>
          )}

          {/* ── GRADIENT ── */}
          {value.type === "gradient" && (
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
          )}

          {/* ── IMAGE ── */}
          {value.type === "image" && (
            <div className="epx-bg-ctrl__media-row">
              {value.image?.storageKey ? (
                <img
                  className="epx-bg-ctrl__thumb"
                  src={`/_emdash/api/media/file/${value.image.storageKey}`}
                  alt={value.image.alt ?? value.image.filename ?? ""}
                />
              ) : (
                <div className="epx-bg-ctrl__thumb-placeholder"><IconImage /></div>
              )}
              <span className="epx-bg-ctrl__media-name">{value.image?.filename ?? (value.image ? "Image selected" : "No image")}</span>
              <button type="button" className="epx-bg-ctrl__media-btn" onClick={() => setMediaPicker("image")}>
                {value.image ? "Change" : "Select"}
              </button>
              {value.image && (
                <button type="button" className="epx-bg-ctrl__stop-remove" onClick={() => onChange({ ...value, image: undefined })} title="Clear">
                  <IconClose />
                </button>
              )}
            </div>
          )}

          {/* ── VIDEO ── */}
          {value.type === "video" && (
            <>
              <div className="epx-bg-ctrl__src-toggle">
                <button
                  type="button"
                  className={`epx-bg-ctrl__src-btn${(value.videoSrc ?? "media") === "media" ? " is-active" : ""}`}
                  onClick={() => onChange({ ...value, videoSrc: "media" })}
                >
                  Media
                </button>
                <button
                  type="button"
                  className={`epx-bg-ctrl__src-btn${value.videoSrc === "url" ? " is-active" : ""}`}
                  onClick={() => onChange({ ...value, videoSrc: "url" })}
                >
                  URL
                </button>
              </div>

              {(value.videoSrc ?? "media") === "media" && (
                <div className="epx-bg-ctrl__media-row">
                  <div className="epx-bg-ctrl__thumb-placeholder"><IconVideo /></div>
                  <span className="epx-bg-ctrl__media-name">{value.videoMedia?.filename ?? "No video selected"}</span>
                  <button type="button" className="epx-bg-ctrl__media-btn" onClick={() => setMediaPicker("video")}>
                    {value.videoMedia ? "Change" : "Select"}
                  </button>
                  {value.videoMedia && (
                    <button type="button" className="epx-bg-ctrl__stop-remove" onClick={() => onChange({ ...value, videoMedia: undefined })} title="Clear">
                      <IconClose />
                    </button>
                  )}
                </div>
              )}

              {value.videoSrc === "url" && (
                <div className="epx-bg-ctrl__url-row">
                  <span className="epx-bg-ctrl__stop-label">URL</span>
                  <input
                    type="url"
                    className="epx-bg-ctrl__url-input"
                    value={value.videoUrl ?? ""}
                    placeholder="https://youtube.com/watch?v=..."
                    onChange={e => onChange({ ...value, videoUrl: e.target.value })}
                  />
                </div>
              )}
            </>
          )}

          {/* ── SLIDESHOW ── */}
          {value.type === "slideshow" && (
            <>
              <button type="button" className="epx-bg-ctrl__add-btn epx-bg-ctrl__add-btn--media" onClick={() => setMediaPicker("slideshow")}>
                + Add Images
              </button>
              {slides.length > 0 && (
                <DndContext sensors={sensors} onDragEnd={handleSlideDragEnd}>
                  <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="epx-bg-ctrl__slides">
                      {slides.map((slide, i) => (
                        <SortableSlide
                          key={slide.id}
                          slide={slide}
                          onRemove={() => onChange({ ...value, slides: slides.filter((_, idx) => idx !== i) })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}

          </div>
        )}

      </div>{/* end epx-bg-ctrl__card */}

      {/* ── Color picker popup ── */}
      {pickerKey && (
        <ColorPicker
          value={activeColor()}
          alpha={activeAlpha()}
          onChange={handleColorChange}
          onClose={() => setPickerKey(null)}
          position={pickerPos}
          format={colorFormat}
          onFormatChange={setColorFormat}
        />
      )}

      {/* ── Media picker modal ── */}
      {mediaPicker === "image" && (
        <MediaPicker
          title="Select Image"
          mimeTypeFilter="image/"
          onSelect={([ref]) => { onChange({ ...value, image: ref }); setMediaPicker(null); }}
          onClose={() => setMediaPicker(null)}
          selectedIds={value.image ? [value.image.id] : []}
        />
      )}
      {mediaPicker === "video" && (
        <MediaPicker
          title="Select Video"
          mimeTypeFilter="video/"
          accept="video/*"
          onSelect={([ref]) => { onChange({ ...value, videoMedia: ref }); setMediaPicker(null); }}
          onClose={() => setMediaPicker(null)}
          selectedIds={value.videoMedia ? [value.videoMedia.id] : []}
        />
      )}
      {mediaPicker === "slideshow" && (
        <MediaPicker
          multi
          title="Select Images"
          mimeTypeFilter="image/"
          onSelect={refs => {
            const existing = new Set(slides.map(s => s.id));
            const newSlides = refs.filter(r => !existing.has(r.id));
            onChange({ ...value, slides: [...slides, ...newSlides] });
            setMediaPicker(null);
          }}
          onClose={() => setMediaPicker(null)}
          selectedIds={slides.map(s => s.id)}
        />
      )}
    </div>
  );
}
