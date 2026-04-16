import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const GalleryPreview = memo(function GalleryPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;
  const cols = parseInt(config.columns ?? "3", 10);
  const images: any[] = Array.isArray(config.images) ? config.images.slice(0, cols) : [];

  return (
    <div style={{ ...theme, padding: "14px" }}>
      {config.headline && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>{config.headline}</div>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
        {images.length > 0 ? images.map((img, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", background: "#e5e7eb" }}>
            <img src={img.url} alt={img.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )) : Array.from({ length: cols }, (_, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#9ca3af" }}>🖼️</div>
        ))}
      </div>
    </div>
  );
});
