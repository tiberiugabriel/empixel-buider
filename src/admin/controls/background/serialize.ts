/**
 * Background serialize / parse helpers + the canonical
 * `BackgroundConfig` type. Lives outside the React component so the
 * per-mode sub-files (`ColorSub`, `GradientSub`, …) can import the
 * type without pulling in their siblings, and so the helpers are
 * reachable from the lazy-loaded boundary in
 * `BackgroundSection.tsx` without re-importing `BackgroundControl`.
 *
 * Extracted in F4.7 from `BackgroundControl.tsx` (no behavior change).
 */
import { hexToRgba, type GradientStop } from "../colorUtils.js";
import type { MediaRef } from "../MediaPicker.js";
import { resolveMediaUrl } from "../../../components/media.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundType = "color" | "gradient" | "image" | "video" | "slideshow";

export interface BackgroundConfig {
  type?: BackgroundType;
  color?: string;
  colorAlpha?: number;
  gradAngle?: number;
  gradStops?: GradientStop[];
  imageSrc?: "media" | "url";
  image?: MediaRef;
  imageUrl?: string;
  imageSize?: string;
  imagePosition?: string;
  imageRepeat?: string;
  imageAttachment?: string;
  videoSrc?: "media" | "url";
  videoMedia?: MediaRef;
  videoUrl?: string;
  videoSize?: string;
  videoPosition?: string;
  videoStartTime?: number;
  videoEndTime?: number;
  videoPlayOnce?: boolean;
  videoFallback?: MediaRef;
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
    cfg.imageSrc       = (style.backgroundImageSrc        as "media" | "url") ?? "media";
    const id  = style.backgroundImageId         as string | undefined;
    const key = style.backgroundImageStorageKey as string | undefined;
    if (id && key) cfg.image = { id, storageKey: key, alt: style.backgroundImageAlt as string | undefined, filename: style.backgroundImageFilename as string | undefined };
    cfg.imageUrl        = (style.backgroundImageUrl        as string) ?? "";
    cfg.imageSize       = (style.backgroundImageSize       as string) ?? "";
    cfg.imagePosition   = (style.backgroundImagePosition   as string) ?? "";
    cfg.imageRepeat     = (style.backgroundImageRepeat     as string) ?? "";
    cfg.imageAttachment = (style.backgroundImageAttachment as string) ?? "";
  } else if (type === "video") {
    cfg.videoSrc = (style.backgroundVideoSrc as "media" | "url") ?? "media";
    const vid    = style.backgroundVideoMediaId           as string | undefined;
    const vkey   = style.backgroundVideoMediaStorageKey   as string | undefined;
    if (vid && vkey) cfg.videoMedia = { id: vid, storageKey: vkey, filename: style.backgroundVideoMediaFilename as string | undefined };
    cfg.videoUrl      = style.backgroundVideoUrl      as string | undefined;
    cfg.videoSize     = (style.backgroundVideoSize     as string) ?? "";
    cfg.videoPosition = (style.backgroundVideoPosition as string) ?? "";
    if (style.backgroundVideoStartTime !== undefined) cfg.videoStartTime = style.backgroundVideoStartTime as number;
    if (style.backgroundVideoEndTime   !== undefined) cfg.videoEndTime   = style.backgroundVideoEndTime   as number;
    cfg.videoPlayOnce  = (style.backgroundVideoPlayOnce as boolean) ?? false;
    const fid  = style.backgroundVideoFallbackId         as string | undefined;
    const fkey = style.backgroundVideoFallbackStorageKey as string | undefined;
    if (fid && fkey) cfg.videoFallback = { id: fid, storageKey: fkey, filename: style.backgroundVideoFallbackFilename as string | undefined };
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
  backgroundImageSrc: undefined,
  backgroundImageId: undefined, backgroundImageStorageKey: undefined,
  backgroundImageAlt: undefined, backgroundImageFilename: undefined,
  backgroundImageUrl: undefined,
  backgroundImageSize: undefined, backgroundImagePosition: undefined,
  backgroundImageRepeat: undefined, backgroundImageAttachment: undefined,
  backgroundVideoSrc: undefined, backgroundVideoMediaId: undefined,
  backgroundVideoMediaStorageKey: undefined, backgroundVideoMediaFilename: undefined,
  backgroundVideoUrl: undefined, backgroundVideoSize: undefined, backgroundVideoPosition: undefined,
  backgroundVideoStartTime: undefined, backgroundVideoEndTime: undefined,
  backgroundVideoPlayOnce: undefined,
  backgroundVideoFallbackId: undefined, backgroundVideoFallbackStorageKey: undefined,
  backgroundVideoFallbackFilename: undefined,
  backgroundSlides: undefined,
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
  } else if (cfg.type === "image") {
    out.backgroundImageSrc = cfg.imageSrc ?? "media";
    if (cfg.image) {
      out.backgroundImageId         = cfg.image.id;
      out.backgroundImageStorageKey = cfg.image.storageKey;
      out.backgroundImageAlt        = cfg.image.alt;
      out.backgroundImageFilename   = cfg.image.filename;
    }
    out.backgroundImageUrl        = cfg.imageUrl        ?? "";
    out.backgroundImageSize       = cfg.imageSize       ?? "";
    out.backgroundImagePosition   = cfg.imagePosition   ?? "";
    out.backgroundImageRepeat     = cfg.imageRepeat     ?? "";
    out.backgroundImageAttachment = cfg.imageAttachment ?? "";
  } else if (cfg.type === "video") {
    out.backgroundVideoSrc = cfg.videoSrc ?? "media";
    if (cfg.videoMedia) {
      out.backgroundVideoMediaId           = cfg.videoMedia.id;
      out.backgroundVideoMediaStorageKey   = cfg.videoMedia.storageKey;
      out.backgroundVideoMediaFilename     = cfg.videoMedia.filename;
    }
    out.backgroundVideoUrl      = cfg.videoUrl;
    out.backgroundVideoSize     = cfg.videoSize     ?? "";
    out.backgroundVideoPosition = cfg.videoPosition ?? "";
    if (cfg.videoStartTime !== undefined) out.backgroundVideoStartTime = cfg.videoStartTime;
    if (cfg.videoEndTime   !== undefined) out.backgroundVideoEndTime   = cfg.videoEndTime;
    out.backgroundVideoPlayOnce  = cfg.videoPlayOnce ?? false;
    if (cfg.videoFallback) {
      out.backgroundVideoFallbackId           = cfg.videoFallback.id;
      out.backgroundVideoFallbackStorageKey   = cfg.videoFallback.storageKey;
      out.backgroundVideoFallbackFilename     = cfg.videoFallback.filename;
    }
  } else if (cfg.type === "slideshow") {
    out.backgroundSlides = JSON.stringify(cfg.slides ?? []);
  }
  return out;
}

// ─── Exported CSS helper (used by preview + SectionContainer) ─────────────────

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
    const src  = style.backgroundImageSrc as string | undefined;
    const imgUrl = src === "url"
      ? (style.backgroundImageUrl as string | undefined)
      : (resolveMediaUrl(style.backgroundImageStorageKey as string | undefined) ?? undefined);
    if (!imgUrl) return "";
    const size       = (style.backgroundImageSize       as string) || "cover";
    const position   = (style.backgroundImagePosition   as string) || "center";
    const repeat     = (style.backgroundImageRepeat     as string) || "no-repeat";
    const attachment = (style.backgroundImageAttachment as string) || "";
    return [
      `background-image:url(${imgUrl})`,
      `background-size:${size}`,
      `background-position:${position}`,
      `background-repeat:${repeat}`,
      ...(attachment && attachment !== "scroll" ? [`background-attachment:${attachment}`] : []),
    ].join(";");
  }
  return "";
}
