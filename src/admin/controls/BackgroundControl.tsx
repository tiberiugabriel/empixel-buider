import React, { useState } from "react";
import { ColorPicker, type ColorFormat } from "./ColorPicker.js";
import { IconReset } from "./SpacingControl.js";
import { MediaPicker } from "./MediaPicker.js";
import type { MediaRef } from "./MediaPicker.js";
import type { GradientStop } from "./colorUtils.js";
import { ColorSub } from "./background/ColorSub.js";
import { GradientSub } from "./background/GradientSub.js";
import { ImageSub } from "./background/ImageSub.js";
import { VideoSub } from "./background/VideoSub.js";
import { SlideshowSub } from "./background/SlideshowSub.js";
import { TypeTabs } from "./background/TypeTabs.js";
import { type BackgroundConfig, type BackgroundType } from "./background/serialize.js";

// Public API re-exports — preserve the existing surface so
// `BackgroundSection`, tests, and downstream plugins keep working.
export { hexToRgba, hexToRgbVals } from "./colorUtils.js";
export type { GradientStop } from "./colorUtils.js";
export type { MediaRef } from "./MediaPicker.js";
export {
  parseBackground,
  serializeBackground,
  buildBackgroundCss,
  type BackgroundConfig,
  type BackgroundType,
} from "./background/serialize.js";

/**
 * Thin mode-switcher + dispatcher. Each `BackgroundType` mode body
 * lives in `background/<Mode>Sub.tsx`. The color-picker popup (used
 * by Color + Gradient) and the media-picker modal (Image / Video /
 * Slideshow / video-fallback) stay here so they can be dispatched
 * against any mode without round-tripping through the sub-files.
 *
 * F4.7 split this from a 939-LOC component. F4.3's lazy boundary at
 * `SectionRenderer.tsx` still wraps the entire control via
 * `BackgroundSection`, so the per-mode sub-files load as part of the
 * same deferred chunk.
 */

type PickerKey = "main" | `stop-${number}`;
type MediaPickerKey = "image" | "video" | "slideshow" | "video-fallback";

export function BackgroundControl({ value, onChange, allowedTypes }: {
  value: BackgroundConfig;
  onChange: (v: BackgroundConfig) => void;
  allowedTypes?: BackgroundType[];
}) {
  const [pickerKey, setPickerKey]     = useState<PickerKey | null>(null);
  const [pickerPos, setPickerPos]     = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const [mediaPicker, setMediaPicker] = useState<MediaPickerKey | null>(null);

  const isDirty = !!value.type;
  const stops   = value.gradStops ?? [];
  const slides  = value.slides   ?? [];

  const setType = (type: BackgroundType) => {
    if (value.type === type) return;
    const next: BackgroundConfig = { type };
    if (type === "color")     { next.color = "#ffffff"; next.colorAlpha = 1; }
    if (type === "gradient")  { next.gradAngle = 135; next.gradStops = [{ color: "#000000", alpha: 1, pos: 0 }, { color: "#ffffff", alpha: 1, pos: 100 }]; }
    if (type === "image")     { next.imageSrc = "media"; }
    if (type === "video")     { next.videoSrc = "media"; }
    if (type === "slideshow") { next.slides = []; }
    onChange(next);
  };

  // ── Color picker plumbing (shared by Color + Gradient subs) ────────────────
  const openPicker = (key: PickerKey, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPickerPos({ top: r.bottom + 4, left: r.left - 180 });
    setPickerKey(prev => prev === key ? null : key);
  };
  const stopIdx = pickerKey?.startsWith("stop-") ? parseInt(pickerKey.slice(5), 10) : -1;
  const activeColor = pickerKey === "main" ? (value.color ?? "#ffffff") : (stops[stopIdx]?.color ?? "#000000");
  const activeAlpha = pickerKey === "main" ? (value.colorAlpha ?? 1)    : (stops[stopIdx]?.alpha ?? 1);
  const handleColorChange = (hex: string, alpha: number) => {
    if (pickerKey === "main") {
      onChange({ ...value, color: hex, colorAlpha: alpha });
    } else if (stopIdx >= 0) {
      onChange({ ...value, gradStops: stops.map((s: GradientStop, idx) => idx === stopIdx ? { ...s, color: hex, alpha } : s) });
    }
  };

  // ── Media picker dispatch ──────────────────────────────────────────────────
  const closeMedia = () => setMediaPicker(null);
  const setSingleMedia = (key: "image" | "videoMedia" | "videoFallback") => ([ref]: MediaRef[]) => {
    onChange({ ...value, [key]: ref });
    closeMedia();
  };
  const addSlides = (refs: MediaRef[]) => {
    const seen = new Set(slides.map(s => s.id));
    onChange({ ...value, slides: [...slides, ...refs.filter(r => !seen.has(r.id))] });
    closeMedia();
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      <div className="epx-bg-ctrl__card">
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

        <TypeTabs active={value.type} allowedTypes={allowedTypes} onSelect={setType} />

        {value.type && (
          <div className="epx-bg-ctrl__body">
            {value.type === "color" && (
              <ColorSub value={value} onChange={onChange} colorFormat={colorFormat} openPicker={openPicker} />
            )}
            {value.type === "gradient" && (
              <GradientSub value={value} onChange={onChange} colorFormat={colorFormat} openPicker={openPicker} />
            )}
            {value.type === "image" && (
              <ImageSub value={value} onChange={onChange} openMediaPicker={() => setMediaPicker("image")} />
            )}
            {value.type === "video" && (
              <VideoSub
                value={value}
                onChange={onChange}
                openMainPicker={() => setMediaPicker("video")}
                openFallbackPicker={() => setMediaPicker("video-fallback")}
              />
            )}
            {value.type === "slideshow" && (
              <SlideshowSub value={value} onChange={onChange} openMediaPicker={() => setMediaPicker("slideshow")} />
            )}
          </div>
        )}
      </div>

      {pickerKey && (
        <ColorPicker
          value={activeColor}
          alpha={activeAlpha}
          onChange={handleColorChange}
          onClose={() => setPickerKey(null)}
          position={pickerPos}
          format={colorFormat}
          onFormatChange={setColorFormat}
        />
      )}

      {mediaPicker === "image" && (
        <MediaPicker
          title="Select Image" mimeTypeFilter="image/"
          onSelect={setSingleMedia("image")} onClose={closeMedia}
          selectedIds={value.image ? [value.image.id] : []}
        />
      )}
      {mediaPicker === "video" && (
        <MediaPicker
          title="Select Video" mimeTypeFilter="video/" accept="video/*"
          onSelect={setSingleMedia("videoMedia")} onClose={closeMedia}
          selectedIds={value.videoMedia ? [value.videoMedia.id] : []}
        />
      )}
      {mediaPicker === "video-fallback" && (
        <MediaPicker
          title="Select Fallback Image" mimeTypeFilter="image/"
          onSelect={setSingleMedia("videoFallback")} onClose={closeMedia}
          selectedIds={value.videoFallback ? [value.videoFallback.id] : []}
        />
      )}
      {mediaPicker === "slideshow" && (
        <MediaPicker
          multi title="Select Images" mimeTypeFilter="image/"
          onSelect={addSlides} onClose={closeMedia}
          selectedIds={slides.map(s => s.id)}
        />
      )}
    </div>
  );
}
