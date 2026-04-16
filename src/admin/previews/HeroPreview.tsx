import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const HeroPreview = memo(function HeroPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;
  const headline = config.headline || <span style={{ fontStyle: "italic", color: "#bbb" }}>Headline...</span>;
  const subheadline = config.subheadline;

  return (
    <div style={{ ...theme, padding: "24px 20px", textAlign: config.layout === "left" ? "left" : "center", minHeight: 80 }}>
      {config.backgroundImageUrl && (
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${config.backgroundImageUrl})`, backgroundSize: "cover", opacity: 0.15 }} />
      )}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{headline}</div>
        {subheadline && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>{subheadline}</div>}
        {(config.ctaLabel || config.ctaSecondaryLabel) && (
          <div style={{ display: "flex", gap: 8, justifyContent: config.layout === "left" ? "flex-start" : "center", flexWrap: "wrap" }}>
            {config.ctaLabel && (
              <span style={{ background: "#2563eb", color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {config.ctaLabel}
              </span>
            )}
            {config.ctaSecondaryLabel && (
              <span style={{ border: "1px solid #2563eb", color: "#2563eb", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {config.ctaSecondaryLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
