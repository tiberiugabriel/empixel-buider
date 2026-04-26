import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#2563eb", color: "#fff" },
};

export const CtaPreview = memo(function CtaPreview({ config }: { config: Record<string, unknown> }) {
  const theme = THEMES[config.theme as string] ?? THEMES.accent;

  return (
    <div style={{ ...theme, padding: "20px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        {(config.headline as React.ReactNode) || <span style={{ fontStyle: "italic", opacity: 0.5 }}>Headline...</span>}
      </div>
      {config.body && <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 10 }}>{(config.body as string).slice(0, 80)}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {config.ctaLabel && (
          <span style={{ background: config.theme === "accent" ? "#fff" : "#2563eb", color: config.theme === "accent" ? "#2563eb" : "#fff", padding: "5px 14px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
            {config.ctaLabel as React.ReactNode}
          </span>
        )}
      </div>
    </div>
  );
});
