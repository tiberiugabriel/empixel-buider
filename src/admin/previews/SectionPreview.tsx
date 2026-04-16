import React, { memo } from "react";
import type { SectionBlock } from "../../types.js";

const BG_STYLES: Record<string, React.CSSProperties> = {
  transparent: { background: "transparent" },
  white: { background: "#fff" },
  "light-gray": { background: "#f3f4f6" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const SectionPreview = memo(function SectionPreview({ config, children }: { config: Record<string, any>; children?: SectionBlock[] }) {
  const bg = BG_STYLES[config.background ?? "white"] ?? BG_STYLES.white;
  const count = children?.length ?? 0;

  return (
    <div style={{ ...bg, border: "2px dashed #93c5fd", borderRadius: 6, padding: "12px", minHeight: 48 }}>
      <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 600, marginBottom: count > 0 ? 8 : 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Section Container
      </div>
      {count > 0 ? (
        <div style={{ fontSize: 11, color: "#888" }}>{count} block{count !== 1 ? "s" : ""} inside</div>
      ) : (
        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>Drop blocks here</div>
      )}
    </div>
  );
});
