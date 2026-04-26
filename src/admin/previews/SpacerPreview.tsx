import React, { memo } from "react";

const HEIGHTS: Record<string, number> = { none: 8, sm: 16, md: 32, lg: 48, xl: 64 };

export const SpacerPreview = memo(function SpacerPreview({ config }: { config: Record<string, unknown> }) {
  const heightKey = (config.height as string) ?? "md";
  const h = HEIGHTS[heightKey] ?? 32;

  return (
    <div style={{ background: "#fafafa", height: h, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      {!!config.showDivider && (
        <div style={{ position: "absolute", left: 16, right: 16, top: "50%", height: 1, background: "#e0e0e0" }} />
      )}
      <span style={{ fontSize: 9, color: "#ccc", background: "#fafafa", padding: "0 6px", position: "relative", zIndex: 1 }}>
        {heightKey} spacer
      </span>
    </div>
  );
});
