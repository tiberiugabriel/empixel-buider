import React, { useState } from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import { FieldGroup, NumberRow } from "../../controls/FieldRow.js";
import { IconStateNormal, IconStateHover } from "../icons.js";

/**
 * Style-tab "Opacity" section with Normal/Hover state toggle. Used by
 * the `image` block (`{ kind: "opacity" }`).
 *
 * F3.5.3 — extracted from the imperative `image` branch in
 * `RightPanel.tsx` (~lines 1575–1597) so the dispatcher stays under
 * the 200 LOC ceiling. Writes go to `style.opacity` /
 * `styleHover.opacity` via the same paths the panel uses today.
 *
 * Opacity is NOT bp-aware in v0.7 — the existing imperative branch
 * writes to top-level `style` regardless of `activeBreakpoint`. Mirrors
 * that behavior here.
 */
export function OpacitySection({ block, onChange }: SectionRenderProps) {
  const [opacityMode, setOpacityMode] = useState<"normal" | "hover">("normal");
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const opacityNormal = style.opacity as number | undefined;
  const opacityHover = styleHover.opacity as number | undefined;
  const opacityActive = opacityMode === "hover" ? opacityHover : opacityNormal;

  const handleOpacity = (v: number | undefined) => {
    if (opacityMode === "hover") onChange({ styleHover: { ...styleHover, opacity: v } });
    else onChange({ style: { ...style, opacity: v } });
  };

  return (
    <div className="epx-stateful-ctrl">
      <div className="epx-state-toggle">
        <button type="button" className={`epx-state-toggle__btn${opacityMode === "normal" ? " is-active" : ""}`} onClick={() => setOpacityMode("normal")} data-tooltip="Normal">
          <IconStateNormal />
        </button>
        <button type="button" className={`epx-state-toggle__btn${opacityMode === "hover" ? " is-active" : ""}`} onClick={() => setOpacityMode("hover")} data-tooltip="Hover">
          <IconStateHover />
        </button>
      </div>
      <FieldGroup
        isDirty={opacityActive !== undefined}
        onReset={() => handleOpacity(undefined)}
      >
        <NumberRow
          label="Opacity"
          value={opacityActive}
          onChange={handleOpacity}
          labelClassName="epx-row-label--section"
          step={0.1}
          min={0}
          max={1}
        />
      </FieldGroup>
    </div>
  );
}
