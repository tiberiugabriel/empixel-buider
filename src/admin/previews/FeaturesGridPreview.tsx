import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const FeaturesGridPreview = memo(function FeaturesGridPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;
  const cols = parseInt(config.columns ?? "3", 10);
  const items: any[] = Array.isArray(config.items) && config.items.length > 0
    ? config.items.slice(0, cols)
    : Array.from({ length: cols }, (_, i) => ({ icon: "⭐", title: `Feature ${i + 1}`, body: "" }));

  return (
    <div style={{ ...theme, padding: "16px 14px" }}>
      {config.headline && <div style={{ fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>{config.headline}</div>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{item.icon || "⭐"}</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{item.title || <span style={{ fontStyle: "italic", color: "#bbb" }}>Title</span>}</div>
            {item.body && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{item.body.slice(0, 40)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
});
