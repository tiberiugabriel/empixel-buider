import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const ImageTextPreview = memo(function ImageTextPreview({ config }: { config: Record<string, unknown> }) {
  const theme = THEMES[config.theme as string] ?? THEMES.light;
  const isRight = config.layout === "image-right";

  return (
    <div style={{ ...theme, padding: "14px", display: "flex", gap: 12, flexDirection: isRight ? "row-reverse" : "row", alignItems: "center" }}>
      <div style={{ width: 64, height: 48, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "#e5e7eb" }}>
        {config.imageUrl
          ? <img src={config.imageUrl as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#9ca3af" }}>🖼️</div>
        }
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          {(config.headline as React.ReactNode) || <span style={{ fontStyle: "italic", color: "#bbb" }}>Headline...</span>}
        </div>
        {config.body && <div style={{ fontSize: 11, opacity: 0.7 }}>{(config.body as string).slice(0, 80)}</div>}
      </div>
    </div>
  );
});
