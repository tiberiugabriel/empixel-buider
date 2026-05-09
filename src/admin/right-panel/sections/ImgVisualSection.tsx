import React from "react";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import {
  parseSide,
  serializeSide,
  type SideValue,
} from "../../controls/SpacingControl.js";
import {
  FieldGroup,
  SelectRow,
  DimensionControl,
  IconButtonRow,
} from "../../controls/FieldRow.js";

const OBJECT_FIT_OPTIONS = [
  { value: "",           label: "Default" },
  { value: "contain",    label: "Contain" },
  { value: "cover",      label: "Cover" },
  { value: "fill",       label: "Fill" },
  { value: "none",       label: "None" },
  { value: "scale-down", label: "Scale Down" },
];

const OBJECT_POSITION_OPTIONS = [
  { value: "",              label: "Default" },
  { value: "center",        label: "Center" },
  { value: "top",           label: "Top" },
  { value: "right",         label: "Right" },
  { value: "bottom",        label: "Bottom" },
  { value: "left",          label: "Left" },
  { value: "top left",      label: "Top Left" },
  { value: "top right",     label: "Top Right" },
  { value: "bottom left",   label: "Bottom Left" },
  { value: "bottom right",  label: "Bottom Right" },
];

const IMAGE_ALIGN_OPTIONS = [
  {
    value: "start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="2" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4.5" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="7" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
];

/**
 * Image-block visual section — Width/Height (DimensionControl on inner
 * `imgStyle`), Object Fit, Object Position, Align. Backs the
 * `kind: "imgVisual"` `StyleSection`.
 *
 * F3.5.3 — extracted from the `image` branch in `RightPanel.tsx`
 * (~lines 1489–1574) so the dispatcher stays under the 200 LOC
 * acceptance ceiling. Writes to `block.config.imgStyle.*` (W/H/fit/
 * position) and `block.config.style.textAlign` (Align — bp-aware via
 * `styleBreakpoints[bpId]` when active BP ≠ desktop). Opacity (also
 * image-only) is handled by `OpacitySection` under `kind: "opacity"`.
 */
export function ImgVisualSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpDefaultPx = BREAKPOINT_DEFS.find((b) => b.id === activeBreakpoint)?.defaultPx ?? 992;
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const imgStyle = (config.imgStyle ?? {}) as Record<string, unknown>;
  const styleBreakpoints = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};
  const typoSource = isNonDesktop ? { ...style, ...bpStyleRaw } : style;

  const imgWidthValues = {
    fix: parseSide(imgStyle.width),
    min: parseSide(imgStyle.minWidth),
    max: parseSide(imgStyle.maxWidth),
  };
  const imgHeightValues = {
    fix: parseSide(imgStyle.height),
    min: parseSide(imgStyle.minHeight),
    max: parseSide(imgStyle.maxHeight),
  };
  const IMG_KEYS = {
    width:  { fix: "width",  min: "minWidth",  max: "maxWidth"  },
    height: { fix: "height", min: "minHeight", max: "maxHeight" },
  } as const;

  const writeImgStyle = (patch: Record<string, unknown>) => onChange({ imgStyle: { ...imgStyle, ...patch } });
  const handleImgDim = (axis: "width" | "height", key: "fix" | "min" | "max", sv: SideValue) =>
    writeImgStyle({ [IMG_KEYS[axis][key]]: serializeSide(sv) });

  const objectFit = (imgStyle.objectFit as string) || "";
  const objectPosition = (imgStyle.objectPosition as string) || "";
  const imgAlign = (typoSource.textAlign as string) || "";

  const handleImgAlign = (v: string) => {
    if (isNonDesktop) {
      const current = styleBreakpoints[activeBreakpoint] ?? {};
      onChange({ styleBreakpoints: { ...styleBreakpoints, [activeBreakpoint]: { ...current, _px: bpDefaultPx, textAlign: v } } });
    } else {
      onChange({ style: { ...style, textAlign: v } });
    }
  };

  return (
    <>
      <DimensionControl
        label="Width"
        values={imgWidthValues}
        onChange={(key, v) => handleImgDim("width", key, v)}
        onReset={() => writeImgStyle({ width: "", minWidth: "", maxWidth: "" })}
      />
      <DimensionControl
        label="Height"
        values={imgHeightValues}
        onChange={(key, v) => handleImgDim("height", key, v)}
        onReset={() => writeImgStyle({ height: "", minHeight: "", maxHeight: "" })}
      />
      <FieldGroup isDirty={!!objectFit} onReset={() => writeImgStyle({ objectFit: "" })}>
        <SelectRow
          label="Fit"
          value={objectFit}
          onChange={(v) => writeImgStyle({ objectFit: v })}
          options={OBJECT_FIT_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      <FieldGroup isDirty={!!objectPosition} onReset={() => writeImgStyle({ objectPosition: "" })}>
        <SelectRow
          label="Position"
          value={objectPosition}
          onChange={(v) => writeImgStyle({ objectPosition: v })}
          options={OBJECT_POSITION_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      <FieldGroup isDirty={!!imgAlign} onReset={() => handleImgAlign("")}>
        <IconButtonRow
          label="Align"
          value={imgAlign}
          onChange={handleImgAlign}
          options={IMAGE_ALIGN_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
    </>
  );
}
