import React from "react";
import type { ReactNode } from "react";
import type { BreakpointId } from "../../../types.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import {
  AlignControl,
  parseAlign,
  serializeAlign,
  type AlignValue,
} from "../../controls/AlignControl.js";
import {
  TypographyControl,
  parseTypography,
  serializeTypography,
  type TypographyValue,
} from "../../controls/TypographyControl.js";
import {
  TextStrokeControl,
  parseTextStroke,
  serializeTextStroke,
  type TextStrokeValue,
} from "../../controls/TextStrokeControl.js";
import {
  TextShadowControl,
  parseTextShadow,
  serializeTextShadow,
  type TextShadowValue,
} from "../../controls/TextShadowControl.js";
import {
  BlendModeControl,
  parseBlendMode,
  serializeBlendMode,
  type BlendModeValue,
} from "../../controls/BlendModeControl.js";
import {
  CssFiltersControl,
  parseFilter,
  serializeFilter,
  type CssFiltersValue,
} from "../../controls/CssFiltersControl.js";
import {
  OverflowControl,
  parseOverflow,
  serializeOverflow,
  type OverflowValue,
} from "../../controls/OverflowControl.js";
import {
  SpacingControl,
  parseSide,
  serializeSide,
  type SpacingValue,
  type SpacingKeys,
  type SideValue,
} from "../../controls/SpacingControl.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

/**
 * Thin per-control wrappers for simple bp-aware style sections —
 * `alignment` / `typography` / `textStroke` / `textShadow` / `blendMode` /
 * `filter` / `overflow` / `spacing`.
 *
 * F3.5.3 — extracted into one file so the dispatcher stays under
 * 200 LOC. Each wrapper mirrors the corresponding inline branch in
 * `RightPanel.tsx`: parse from a merged `style + bpStyleRaw` source on
 * non-desktop breakpoints, serialize back into either `style` or
 * `styleBreakpoints[bpId]`.
 */

function bpDefaultPx(bp: BreakpointId): number {
  return BREAKPOINT_DEFS.find((b) => b.id === bp)?.defaultPx ?? 992;
}

function readBpStyle(block: SectionRenderProps["block"], activeBreakpoint: BreakpointId) {
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const styleBreakpoints = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};
  const merged = isNonDesktop ? { ...style, ...bpStyleRaw } : style;
  const breakpointIndicator: ReactNode = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );
  return { style, styleBreakpoints, isNonDesktop, merged, breakpointIndicator };
}

function writeStylePatch(
  block: SectionRenderProps["block"],
  onChange: SectionRenderProps["onChange"],
  activeBreakpoint: BreakpointId,
  patch: Record<string, unknown>,
) {
  const { style, styleBreakpoints, isNonDesktop } = readBpStyle(block, activeBreakpoint);
  if (isNonDesktop) {
    const current = styleBreakpoints[activeBreakpoint] ?? {};
    onChange({ styleBreakpoints: { ...styleBreakpoints, [activeBreakpoint]: { ...current, _px: bpDefaultPx(activeBreakpoint), ...patch } } });
  } else {
    onChange({ style: { ...style, ...patch } });
  }
}

export function AlignmentSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { merged, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const value: AlignValue = parseAlign(merged);
  return <AlignControl value={value} onChange={(v) => writeStylePatch(block, onChange, activeBreakpoint, serializeAlign(v))} breakpointIndicator={breakpointIndicator} />;
}

export function TypographySection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { merged, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const value: TypographyValue = parseTypography(merged);
  return <TypographyControl value={value} onChange={(v) => writeStylePatch(block, onChange, activeBreakpoint, serializeTypography(v))} breakpointIndicator={breakpointIndicator} />;
}

export function TextStrokeSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { merged, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const value: TextStrokeValue = parseTextStroke(merged);
  return <TextStrokeControl value={value} onChange={(v) => writeStylePatch(block, onChange, activeBreakpoint, serializeTextStroke(v))} breakpointIndicator={breakpointIndicator} />;
}

export function TextShadowSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { merged, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const value: TextShadowValue = parseTextShadow(merged);
  return <TextShadowControl value={value} onChange={(v) => writeStylePatch(block, onChange, activeBreakpoint, serializeTextShadow(v))} breakpointIndicator={breakpointIndicator} />;
}

export function BlendModeSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { merged, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const value: BlendModeValue = parseBlendMode(merged);
  return <BlendModeControl value={value} onChange={(v) => writeStylePatch(block, onChange, activeBreakpoint, serializeBlendMode(v))} breakpointIndicator={breakpointIndicator} />;
}

export function FilterSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  const { style, breakpointIndicator } = readBpStyle(block, activeBreakpoint);
  const cssFilter = (style.filter as string) || "";
  const value: CssFiltersValue = parseFilter(cssFilter);
  const handle = (v: CssFiltersValue) => {
    const next = serializeFilter(v);
    onChange({ style: { ...style, filter: next || undefined } });
  };
  return <CssFiltersControl value={value} onChange={handle} breakpointIndicator={breakpointIndicator} />;
}

export function OverflowSection({ block, onChange }: SectionRenderProps) {
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const value: OverflowValue = parseOverflow(style);
  return <OverflowControl value={value} onChange={(v) => onChange({ style: { ...style, ...serializeOverflow(v) } })} />;
}

export function SpacingSection({
  block,
  onChange,
  activeBreakpoint,
  targets,
}: SectionRenderProps & { targets?: ("padding" | "margin")[] }) {
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const which = targets ?? ["padding", "margin"];
  void activeBreakpoint;

  const make = (prefix: "padding" | "margin"): SpacingValue => ({
    top:    parseSide(style[`${prefix}Top`]),
    right:  parseSide(style[`${prefix}Right`]),
    bottom: parseSide(style[`${prefix}Bottom`]),
    left:   parseSide(style[`${prefix}Left`]),
  });

  const handle = (prefix: "padding" | "margin", val: SpacingValue) => {
    const next: Record<string, unknown> = { ...style };
    Object.entries(val).forEach(([side, sv]) => {
      const cssKey = `${prefix}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      next[cssKey] = serializeSide(sv as SideValue);
    });
    onChange({ style: next });
  };

  return (
    <>
      {which.map((prefix) => (
        <SpacingControl
          key={prefix}
          label={prefix === "padding" ? "Padding" : "Margin"}
          value={make(prefix)}
          onChange={(v) => handle(prefix, v)}
          sides={["top", "right", "bottom", "left"] as SpacingKeys[]}
        />
      ))}
    </>
  );
}
