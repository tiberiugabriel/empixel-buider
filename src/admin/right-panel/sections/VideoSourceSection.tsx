import React from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import { NumberWithUnits } from "../../controls/NumberWithUnits.js";
import {
  CssFiltersControl,
  parseFilter,
  serializeFilter,
  type CssFiltersValue,
} from "../../controls/CssFiltersControl.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

/**
 * Style-tab content for the `video` block — aspect ratio (with custom W/H
 * fallback) and CSS filter group.
 *
 * F3.5.2 — extracted as a standalone declarative renderer to back the
 * `{ kind: "custom", render: VideoSourceSection }` entry in `video`'s
 * `styleTab`. The original imperative branch in `RightPanel.tsx`
 * (~lines 1372–1425) stays in place until F3.5.6 deletes it.
 *
 * NOTE: this is the Style-tab "video source" section (aspect ratio +
 * filter). The Fields-tab `VideoSourceControl` (provider auto-detect,
 * media picker, autoplay/mute/etc.) keeps its own home in
 * `RightPanel.tsx`'s Fields branch — F3.5.6 will reroute it through
 * a separate Fields-tab custom hook.
 */
export function VideoSourceSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const aspect = (config.aspectRatio as string) || "16:9";
  const cssFilter = (style.filter as string) || "";
  const filterValue: CssFiltersValue = parseFilter(cssFilter);

  const handleFilter = (v: CssFiltersValue) => {
    const next = serializeFilter(v);
    onChange({ style: { ...style, filter: next || undefined } });
  };

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  // BREAKPOINT_DEFS only used for an indirect parity check — the existing
  // RightPanel.tsx branch writes filter to `style.filter` regardless of the
  // active breakpoint (filter is not bp-aware in v0.7).
  void BREAKPOINT_DEFS;

  return (
    <>
      <FieldGroup
        isDirty={aspect !== "16:9"}
        onReset={() => onChange({ aspectRatio: "16:9" })}
      >
        <SelectRow
          label="Aspect Ratio"
          value={aspect}
          onChange={(v) => onChange({ aspectRatio: v })}
          options={[
            { value: "1:1",    label: "1:1" },
            { value: "3:2",    label: "3:2" },
            { value: "4:3",    label: "4:3" },
            { value: "16:9",   label: "16:9" },
            { value: "21:9",   label: "21:9" },
            { value: "9:16",   label: "9:16 (vertical)" },
            { value: "custom", label: "Custom" },
          ]}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      {aspect === "custom" && (
        <>
          <NumberWithUnits
            label="Aspect W"
            value={(config.aspectRatioCustomW as string) || ""}
            onChange={(v) => onChange({ aspectRatioCustomW: v })}
            units={["px", "rem", "%"]}
          />
          <NumberWithUnits
            label="Aspect H"
            value={(config.aspectRatioCustomH as string) || ""}
            onChange={(v) => onChange({ aspectRatioCustomH: v })}
            units={["px", "rem", "%"]}
          />
        </>
      )}
      <CssFiltersControl
        value={filterValue}
        onChange={handleFilter}
        breakpointIndicator={breakpointIndicator}
      />
    </>
  );
}
