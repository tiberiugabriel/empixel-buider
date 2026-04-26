import React, { memo } from "react";
import type { SectionBlock } from "../../types.js";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const ColumnsPreview = memo(function ColumnsPreview({ config, slots }: { config: Record<string, unknown>; slots?: SectionBlock[][] }) {
  const theme = THEMES[config.theme as string] ?? THEMES.light;
  const numCols = parseInt((config.columns as string) ?? "2", 10);

  return (
    <div style={{ ...theme, padding: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: 8 }}>
        {Array.from({ length: numCols }, (_, i) => {
          const hasSlotContent = slots && slots[i] && slots[i].length > 0;
          const legacyContent = config[`col${i + 1}Content`];
          return (
            <div key={i} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 4, padding: "8px", minHeight: 40, fontSize: 11 }}>
              {hasSlotContent ? (
                <div style={{ color: "#888", fontStyle: "italic" }}>{slots![i].length} block{slots![i].length !== 1 ? "s" : ""}</div>
              ) : legacyContent ? (
                <div style={{ opacity: 0.7 }}>{String(legacyContent).slice(0, 60)}</div>
              ) : (
                <div style={{ color: "#bbb", fontStyle: "italic" }}>Column {i + 1}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
