import React from "react";
import { getColorDisplay, type ColorFormat } from "../ColorPicker.js";
import { hexToRgbVals } from "../colorUtils.js";
import type { BackgroundConfig } from "./serialize.js";

/**
 * Color mode body — single swatch + hex display + alpha %.
 *
 * Extracted in F4.7 from `BackgroundControl.tsx`. The popup
 * `<ColorPicker>` lives in the parent so it can also serve the
 * gradient stops; this sub-file only renders the trigger row.
 */
interface Props {
  value: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
  colorFormat: ColorFormat;
  openPicker: (key: "main", el: HTMLElement) => void;
}

export function ColorSub({ value, colorFormat, openPicker }: Props) {
  const color = value.color ?? "#ffffff";
  const alpha = value.colorAlpha ?? 1;
  return (
    <div className="epx-bg-ctrl__color-row">
      <button
        type="button"
        className="epx-bg-ctrl__swatch"
        onClick={e => openPicker("main", e.currentTarget)}
        title="Pick color"
      >
        <div
          className="epx-bg-ctrl__swatch-fill"
          style={{ background: `rgba(${hexToRgbVals(color).join(",")},${alpha})` }}
        />
      </button>
      <span className="epx-bg-ctrl__hex">{getColorDisplay(color, colorFormat)}</span>
      <span className="epx-bg-ctrl__alpha-label">{Math.round(alpha * 100)}%</span>
    </div>
  );
}
