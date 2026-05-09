import React from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import { NumberWithUnits } from "../../controls/NumberWithUnits.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

// Local stand-in for `RightPanel.PanelDivider` so the section file has no
// import-cycle with `RightPanel.tsx` (F3.5.6 inverts the dependency).
function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

/**
 * Style-tab "Paragraph Spacing + Drop Cap" subsection for the
 * `text-editor` block.
 *
 * F3.5.2 — extracted as a standalone declarative renderer to back the
 * `{ kind: "custom", render: TextEditorDropCapSection }` entry in
 * `text-editor`'s `styleTab`. The original imperative branch in
 * `RightPanel.tsx` (~lines 1317–1368) stays in place until F3.5.6
 * deletes it; this component is the parallel declaration.
 *
 * The component:
 * - Always renders a `Paragraph Spacing` row (NumberWithUnits) writing
 *   to `style.paragraphSpacing` (or the bp override).
 * - Reads the effective `dropCap` from `block.config.dropCap` merged
 *   with `block.config.configBreakpoints[activeBreakpoint].dropCap`,
 *   and renders the drop-cap subgroup only when ON.
 * - Writes drop-cap CSS keys (`dropCapSize`, `dropCapLines`,
 *   `dropCapMarginRight`) to `style` on desktop or
 *   `styleBreakpoints[bpId]` on non-desktop breakpoints, using
 *   `BREAKPOINT_DEFS` defaults for `_px` since `SectionRenderProps`
 *   doesn't yet carry `breakpointsConfig` overrides. F3.5.4 may extend
 *   the prop shape if host-customised breakpoints need to flow in.
 */
export function TextEditorDropCapSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpDefaultPx = BREAKPOINT_DEFS.find((b) => b.id === activeBreakpoint)?.defaultPx ?? 992;

  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const styleBreakpoints = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const configBreakpoints = (config.configBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};
  const bpConfigRaw = isNonDesktop ? (configBreakpoints[activeBreakpoint] ?? {}) : {};
  const typoSource = isNonDesktop ? { ...style, ...bpStyleRaw } : style;

  const writeBpStyle = (patch: Record<string, unknown>) => {
    const current = styleBreakpoints[activeBreakpoint] ?? {};
    onChange({
      styleBreakpoints: {
        ...styleBreakpoints,
        [activeBreakpoint]: { ...current, _px: bpDefaultPx, ...patch },
      },
    });
  };

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  const dropCapBpOverride = bpConfigRaw.dropCap as boolean | undefined;
  const dropCapEff = isNonDesktop && typeof dropCapBpOverride === "boolean"
    ? dropCapBpOverride
    : !!config.dropCap;

  // Drop-cap settings — reads from the same merged source the panel uses
  // (style + bp override), writes to the right key based on bp.
  const dcSize = (typoSource.dropCapSize as string) || "";
  const dcLines = (typoSource.dropCapLines as string) || "";
  const dcMR = (typoSource.dropCapMarginRight as string) || "";

  const writeDc = (key: string, v: string) => {
    if (isNonDesktop) writeBpStyle({ [key]: v });
    else onChange({ style: { ...style, [key]: v } });
  };

  return (
    <>
      <NumberWithUnits
        label="Paragraph Spacing"
        value={(typoSource.paragraphSpacing as string) || ""}
        onChange={(v) => {
          if (isNonDesktop) writeBpStyle({ paragraphSpacing: v });
          else onChange({ style: { ...style, paragraphSpacing: v } });
        }}
        units={["px", "rem", "em", "%"]}
        breakpointIndicator={breakpointIndicator}
      />
      {dropCapEff && (
        <>
          <PanelDivider />
          <span
            className="epx-row-label--section"
            style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            Drop Cap
          </span>
          <NumberWithUnits
            label="Size"
            value={dcSize}
            onChange={(v) => writeDc("dropCapSize", v)}
            units={["em", "rem", "px"]}
            breakpointIndicator={breakpointIndicator}
          />
          <NumberWithUnits
            label="Lines"
            value={dcLines}
            onChange={(v) => writeDc("dropCapLines", v)}
            units={["em", "rem"]}
            breakpointIndicator={breakpointIndicator}
          />
          <NumberWithUnits
            label="Margin Right"
            value={dcMR}
            onChange={(v) => writeDc("dropCapMarginRight", v)}
            units={["px", "rem", "em"]}
            breakpointIndicator={breakpointIndicator}
          />
        </>
      )}
    </>
  );
}
