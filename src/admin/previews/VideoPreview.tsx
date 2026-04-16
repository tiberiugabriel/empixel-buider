import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
  accent: { background: "#eff6ff", color: "#1e40af" },
};

export const VideoPreview = memo(function VideoPreview({ config }: { config: Record<string, any> }) {
  const theme = THEMES[config.theme] ?? THEMES.light;

  return (
    <div style={{ ...theme, padding: "14px" }}>
      <div style={{ background: "#000", borderRadius: 6, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 28, color: "#fff", opacity: 0.8 }}>▶</div>
        {config.url && (
          <div style={{ position: "absolute", bottom: 6, left: 8, right: 8, fontSize: 9, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {config.url}
          </div>
        )}
      </div>
      {config.caption && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "center" }}>{config.caption}</div>}
    </div>
  );
});
