import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const FaqPreview = memo(function FaqPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;
  const items: any[] = Array.isArray(config.items) ? config.items.slice(0, 3) : [];

  return (
    <div style={{ ...theme, padding: "14px" }}>
      {config.headline && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{config.headline}</div>}
      {items.length > 0 ? items.map((item, i) => (
        <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "6px 0", fontSize: 11 }}>
          <div style={{ fontWeight: 600 }}>{item.question}</div>
        </div>
      )) : (
        <div style={{ fontStyle: "italic", fontSize: 11, color: "#bbb" }}>No questions yet</div>
      )}
    </div>
  );
});
