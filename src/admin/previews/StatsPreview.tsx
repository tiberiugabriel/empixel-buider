import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

interface StatItem { value?: string; label?: string }

export const StatsPreview = memo(function StatsPreview({ config }: { config: Record<string, unknown> }) {
  const theme = THEMES[config.theme as string] ?? THEMES.light;
  const items: StatItem[] = Array.isArray(config.items) && config.items.length > 0
    ? (config.items as StatItem[]).slice(0, 4)
    : [{ value: "10k+", label: "Users" }, { value: "99%", label: "Uptime" }];

  return (
    <div style={{ ...theme, padding: "14px" }}>
      {config.headline && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>{config.headline as React.ReactNode}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {items.map((item, i) => (
          <div key={i} style={{ textAlign: "center", minWidth: 60 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb" }}>{item.value}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
