import React from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import { ColorNormalHover } from "../../controls/ColorNormalHover.js";
import { NumberWithUnits } from "../../controls/NumberWithUnits.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

/**
 * Style-tab content for the `icon` block — icon color (Normal/Hover),
 * size, and rotate. None of these map to a built-in `StyleSection`
 * variant (the built-in `kind: "iconGroup"` is for the full IconGroup
 * picker that lives on the Fields tab of icon/button/divider-spacer).
 *
 * F3.5.2 — extracted as a standalone declarative renderer to back the
 * `{ kind: "custom", render: IconBlockStyleSection }` entry in `icon`'s
 * `styleTab`. The original imperative branch in `RightPanel.tsx`
 * (~lines 1427–1461) stays in place until F3.5.6 deletes it.
 *
 * The Align row (which RightPanel renders above this) is declared
 * separately as a `kind: "alignment"` entry in the icon block's
 * `styleTab` so the future SectionRenderer can share the alignment
 * widget with text/text-editor.
 */
export function IconBlockStyleSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;

  const normalColor = {
    color: style.iconColor as string | undefined,
    alpha: typeof style.iconColorAlpha === "number" ? (style.iconColorAlpha as number) : undefined,
  };
  const hoverColor = {
    color: styleHover.iconColor as string | undefined,
    alpha: typeof styleHover.iconColorAlpha === "number" ? (styleHover.iconColorAlpha as number) : undefined,
  };

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  return (
    <>
      <ColorNormalHover
        label="Icon Color"
        normal={normalColor}
        hover={hoverColor}
        onNormalChange={(v) => onChange({ style: { ...style, iconColor: v.color, iconColorAlpha: v.alpha } })}
        onHoverChange={(v) => onChange({ styleHover: { ...styleHover, iconColor: v.color, iconColorAlpha: v.alpha } })}
        breakpointIndicator={breakpointIndicator}
      />
      <NumberWithUnits
        label="Size"
        value={(style.iconBlockSize as string) || ""}
        onChange={(v) => onChange({ style: { ...style, iconBlockSize: v } })}
        units={["px", "rem", "em", "%"]}
        breakpointIndicator={breakpointIndicator}
      />
      <NumberWithUnits
        label="Rotate"
        value={(config.rotate as string) || ""}
        onChange={(v) => onChange({ rotate: v })}
        units={["deg", "turn"]}
        allowNegative
      />
    </>
  );
}
