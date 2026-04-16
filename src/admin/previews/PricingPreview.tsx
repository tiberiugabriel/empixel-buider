import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const PricingPreview = memo(function PricingPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;
  const tiers: any[] = Array.isArray(config.tiers) ? config.tiers.slice(0, 3) : [];

  return (
    <div style={{ ...theme, padding: "14px" }}>
      {config.headline && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>{config.headline}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        {tiers.length > 0 ? tiers.map((tier, i) => (
          <div key={i} style={{ flex: 1, border: tier.highlighted ? "2px solid #2563eb" : "1px solid #e0e0e0", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{tier.name}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{tier.price}</div>
            {tier.period && <div style={{ fontSize: 9, opacity: 0.6 }}>{tier.period}</div>}
          </div>
        )) : (
          <div style={{ fontStyle: "italic", fontSize: 11, color: "#bbb" }}>No tiers yet</div>
        )}
      </div>
    </div>
  );
});
