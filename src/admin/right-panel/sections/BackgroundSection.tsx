import React, { useState } from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import type { BackgroundType } from "../../controls/BackgroundControl.js";
import {
  BackgroundControl,
  parseBackground,
  serializeBackground,
} from "../../controls/BackgroundControl.js";
import { ThemeStyleToggle, getThemeStyleKey } from "../../controls/ThemeStyleToggle.js";
import { IconStateNormal, IconStateHover } from "../icons.js";

/**
 * Background section wrapper used by `SectionRenderer` for
 * `kind: "background"`. Mirrors the imperative branch in
 * `RightPanel.tsx` (~lines 1602–1617) — Normal/Hover state toggle +
 * `ThemeStyleToggle` row sitting above `BackgroundControl`.
 *
 * Hover writes are restricted to `["color", "gradient", "image"]` to
 * match the existing panel behavior. The section accepts an optional
 * `modes` filter that further narrows the Normal-state allowed types
 * (declared via `{ kind: "background", modes: [...] }`).
 */
interface Props extends SectionRenderProps {
  modes?: BackgroundType[];
}

export function BackgroundSection({ block, onChange, modes }: Props) {
  const [bgMode, setBgMode] = useState<"normal" | "hover">("normal");
  const config = block.config as Record<string, unknown>;
  const theme = (config.theme as string) || "light";
  const activeStyleKey = getThemeStyleKey(theme);
  const activeStyle = (config[activeStyleKey] ?? {}) as Record<string, unknown>;
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;

  const bgValue = parseBackground(bgMode === "hover" ? styleHover : activeStyle);
  const handleBackground = (val: ReturnType<typeof parseBackground>) => {
    if (bgMode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serializeBackground(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serializeBackground(val) } });
    }
  };

  const allowedTypes = bgMode === "hover" ? (["color", "gradient", "image"] as BackgroundType[]) : modes;

  return (
    <div className="epx-stateful-ctrl">
      <div className="epx-state-header">
        <div className="epx-state-toggle">
          <button type="button" className={`epx-state-toggle__btn${bgMode === "normal" ? " is-active" : ""}`} onClick={() => setBgMode("normal")} data-tooltip="Normal">
            <IconStateNormal />
          </button>
          <button type="button" className={`epx-state-toggle__btn${bgMode === "hover" ? " is-active" : ""}`} onClick={() => setBgMode("hover")} data-tooltip="Hover">
            <IconStateHover />
          </button>
        </div>
        <ThemeStyleToggle theme={theme} onChange={(v) => onChange({ theme: v })} />
      </div>
      <BackgroundControl value={bgValue} onChange={handleBackground} allowedTypes={allowedTypes} />
    </div>
  );
}
