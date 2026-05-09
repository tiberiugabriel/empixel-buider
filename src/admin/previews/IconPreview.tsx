import React, { memo } from "react";
import type { IconGroupValue } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
  const n = parseInt(full.padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function isSvgFile(filename: string | undefined): boolean {
  return /\.svg(\?|$)/i.test(filename ?? "");
}

export const IconPreview = memo(function IconPreview({ config }: PreviewProps) {
  const icon = (config.icon as IconGroupValue) ?? {};
  const iconSrc = icon.iconSrc?.storageKey
    ? `/_emdash/api/media/file/${icon.iconSrc.storageKey}`
    : undefined;
  const style = (config.style ?? {}) as Record<string, unknown>;

  // Match Icon.astro precedence: style.iconBlockSize takes the role of the
  // "block-level" size override, falling back to the icon group's own size.
  const size = icon.iconSize || (style.iconBlockSize as string) || "32px";
  const rotate = (config.rotate as string) || "";
  const align = (style.textAlign as string) || "";
  // Frontend reads `style.iconColor` first, then falls back to the icon
  // group's own color. Same precedence here so the canvas matches.
  const iconColor = (style.iconColor as string) || icon.iconColor;
  const iconColorAlpha = typeof style.iconColorAlpha === "number"
    ? (style.iconColorAlpha as number)
    : (icon.iconColorAlpha ?? 1);

  if (!iconSrc) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Icon block</span>;
  }

  const filename = icon.iconSrc?.filename;
  const isSvg = isSvgFile(filename);
  const renderAsSvgMask = isSvg && !!iconColor;

  const wrapStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: align === "center" ? "center" : align === "right" || align === "end" ? "flex-end" : "flex-start",
  };

  // Match Icon.astro's branching: SVG + iconColor → CSS mask span (tints the
  // silhouette); otherwise plain `<img>` (PNG / SVG without color override).
  // Mirroring this is what makes "tint an SVG icon red" actually look red on
  // canvas instead of showing the raw SVG colors.
  const innerNode = renderAsSvgMask ? (
    <span
      role="img"
      aria-label={icon.iconSrc?.alt ?? ""}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: hexToRgba(iconColor!, iconColorAlpha),
        WebkitMask: `url(${iconSrc}) no-repeat center/contain`,
        mask: `url(${iconSrc}) no-repeat center/contain`,
        transform: rotate ? `rotate(${rotate})` : undefined,
      }}
    />
  ) : (
    <img
      src={iconSrc}
      alt={icon.iconSrc?.alt ?? ""}
      style={{
        width: size,
        height: size,
        transform: rotate ? `rotate(${rotate})` : undefined,
      }}
    />
  );

  return <div style={wrapStyle}>{innerNode}</div>;
});
