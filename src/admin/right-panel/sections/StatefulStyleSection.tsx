import React, { useState } from "react";
import type { ReactNode } from "react";
import type { BreakpointId } from "../../../types.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import type { SectionRenderProps } from "../../blockDefinitions.js";
import {
  BorderRadiusControl,
  parseRadius,
  serializeRadius,
  type RadiusValue,
} from "../../controls/BorderRadiusControl.js";
import {
  BorderControl,
  parseBorder,
  serializeBorder,
  type BorderConfig,
} from "../../controls/BorderControl.js";
import {
  BoxShadowControl,
  parseShadow,
  serializeShadow,
  type BoxShadowConfig,
} from "../../controls/BoxShadowControl.js";
import { getThemeStyleKey } from "../../controls/ThemeStyleToggle.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";
import { IconStateNormal, IconStateHover } from "../icons.js";

/**
 * Shared scaffold for `kind: "borderRadius" | "border" | "boxShadow"`.
 *
 * F3.5.3 — extracted so `SectionRenderer.tsx` stays under the 200 LOC
 * acceptance ceiling. Mirrors the three near-identical imperative
 * branches in `RightPanel.tsx` (~lines 1618–1650): Normal/Hover state
 * toggle, bp-aware merged source, writes routed to `style` /
 * `styleHover` / `styleBreakpoints[bpId]` / `styleHoverBreakpoints[bpId]`
 * based on `activeBreakpoint` + state.
 */

function bpDefaultPx(bp: BreakpointId): number {
  return BREAKPOINT_DEFS.find((b) => b.id === bp)?.defaultPx ?? 992;
}

function buildBp(activeBreakpoint: BreakpointId, config: Record<string, unknown>) {
  const isNonDesktop = activeBreakpoint !== "desktop";
  const styleBreakpoints = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const styleHoverBreakpoints = (config.styleHoverBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};
  const bpHoverRaw = isNonDesktop ? (styleHoverBreakpoints[activeBreakpoint] ?? {}) : {};
  return { isNonDesktop, styleBreakpoints, styleHoverBreakpoints, bpStyleRaw, bpHoverRaw };
}

interface BaseProps extends SectionRenderProps {
  children: (ctx: {
    mode: "normal" | "hover";
    setMode: (m: "normal" | "hover") => void;
    breakpointIndicator: ReactNode;
  }) => ReactNode;
}

function StatefulShell({ activeBreakpoint, children }: BaseProps) {
  const [mode, setMode] = useState<"normal" | "hover">("normal");
  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );
  return (
    <div className="epx-stateful-ctrl">
      <div className="epx-state-toggle">
        <button type="button" className={`epx-state-toggle__btn${mode === "normal" ? " is-active" : ""}`} onClick={() => setMode("normal")} data-tooltip="Normal">
          <IconStateNormal />
        </button>
        <button type="button" className={`epx-state-toggle__btn${mode === "hover" ? " is-active" : ""}`} onClick={() => setMode("hover")} data-tooltip="Hover">
          <IconStateHover />
        </button>
      </div>
      {children({ mode, setMode, breakpointIndicator })}
    </div>
  );
}

function buildHandlers<T>(
  block: SectionRenderProps["block"],
  onChange: SectionRenderProps["onChange"],
  activeBreakpoint: BreakpointId,
  mode: "normal" | "hover",
  parse: (s: Record<string, unknown>) => T,
  serialize: (v: T) => Record<string, unknown>,
): { value: T; onChange: (val: T) => void } {
  const config = block.config as Record<string, unknown>;
  const theme = (config.theme as string) || "light";
  const activeStyleKey = getThemeStyleKey(theme);
  const activeStyle = (config[activeStyleKey] ?? {}) as Record<string, unknown>;
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const { isNonDesktop, styleBreakpoints, styleHoverBreakpoints, bpStyleRaw, bpHoverRaw } = buildBp(activeBreakpoint, config);

  const source = isNonDesktop
    ? (mode === "hover" ? { ...styleHover, ...bpHoverRaw } : { ...activeStyle, ...bpStyleRaw })
    : (mode === "hover" ? styleHover : activeStyle);

  const value = parse(source);
  const handle = (val: T) => {
    const px = bpDefaultPx(activeBreakpoint);
    if (isNonDesktop && mode === "hover") {
      const current = styleHoverBreakpoints[activeBreakpoint] ?? {};
      onChange({ styleHoverBreakpoints: { ...styleHoverBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...serialize(val) } } });
    } else if (isNonDesktop) {
      const current = styleBreakpoints[activeBreakpoint] ?? {};
      onChange({ styleBreakpoints: { ...styleBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...serialize(val) } } });
    } else if (mode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serialize(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serialize(val) } });
    }
  };
  return { value, onChange: handle };
}

export function BorderRadiusSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  return (
    <StatefulShell block={block} onChange={onChange} activeBreakpoint={activeBreakpoint}>
      {({ mode, breakpointIndicator }) => {
        const h = buildHandlers<RadiusValue>(block, onChange, activeBreakpoint, mode, parseRadius, serializeRadius);
        return <BorderRadiusControl value={h.value} onChange={h.onChange} breakpointIndicator={breakpointIndicator} />;
      }}
    </StatefulShell>
  );
}

export function BorderSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  return (
    <StatefulShell block={block} onChange={onChange} activeBreakpoint={activeBreakpoint}>
      {({ mode, breakpointIndicator }) => {
        const h = buildHandlers<BorderConfig>(block, onChange, activeBreakpoint, mode, parseBorder, serializeBorder);
        return <BorderControl value={h.value} onChange={h.onChange} breakpointIndicator={breakpointIndicator} />;
      }}
    </StatefulShell>
  );
}

export function BoxShadowSection({ block, onChange, activeBreakpoint }: SectionRenderProps) {
  return (
    <StatefulShell block={block} onChange={onChange} activeBreakpoint={activeBreakpoint}>
      {({ mode, breakpointIndicator }) => {
        const h = buildHandlers<BoxShadowConfig>(block, onChange, activeBreakpoint, mode, parseShadow, serializeShadow);
        return <BoxShadowControl value={h.value} onChange={h.onChange} breakpointIndicator={breakpointIndicator} />;
      }}
    </StatefulShell>
  );
}
