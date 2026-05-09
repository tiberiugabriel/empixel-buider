import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ColorSub } from "../src/admin/controls/background/ColorSub.js";
import { GradientSub } from "../src/admin/controls/background/GradientSub.js";
import { ImageSub } from "../src/admin/controls/background/ImageSub.js";
import { VideoSub } from "../src/admin/controls/background/VideoSub.js";
import { SlideshowSub } from "../src/admin/controls/background/SlideshowSub.js";
import { TypeTabs } from "../src/admin/controls/background/TypeTabs.js";
import {
  parseBackground,
  serializeBackground,
  buildBackgroundCss,
  type BackgroundConfig,
} from "../src/admin/controls/background/serialize.js";

/**
 * F4.7 — smoke coverage for the per-mode `<Mode>Sub` files extracted
 * from `BackgroundControl.tsx`. Each test SSRs the sub directly with
 * a representative `BackgroundConfig` and asserts the visible markup
 * matches what the merged control used to emit. The shared helpers
 * (`parseBackground` / `serializeBackground` / `buildBackgroundCss`)
 * also get a round-trip test here so a regression in
 * `background/serialize.ts` surfaces immediately.
 */

describe("F4.7 — ColorSub renders the swatch + hex + alpha row", () => {
  it("emits the swatch trigger and the hex display", () => {
    const value: BackgroundConfig = { type: "color", color: "#ff0000", colorAlpha: 0.5 };
    const html = renderToStaticMarkup(
      createElement(ColorSub, {
        value,
        onChange: () => {},
        colorFormat: "HEX",
        openPicker: () => {},
      }),
    );
    expect(html).toContain("epx-bg-ctrl__swatch");
    expect(html).toContain("epx-bg-ctrl__hex");
    expect(html).toContain("epx-bg-ctrl__alpha-label");
    expect(html).toContain("50%");
  });
});

describe("F4.7 — GradientSub renders angle, stops, and preview bar", () => {
  it("emits the angle row + 2 stops + Add Color Stop button", () => {
    const value: BackgroundConfig = {
      type: "gradient",
      gradAngle: 90,
      gradStops: [
        { color: "#000000", alpha: 1, pos: 0 },
        { color: "#ffffff", alpha: 1, pos: 100 },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(GradientSub, {
        value,
        onChange: () => {},
        colorFormat: "HEX",
        openPicker: () => {},
      }),
    );
    expect(html).toContain("Angle");
    expect(html).toContain("epx-bg-ctrl__add-btn");
    expect(html).toContain("Add Color Stop");
    expect(html).toContain("epx-bg-ctrl__grad-preview");
    // 2 swatch buttons (one per stop)
    const swatchMatches = html.match(/epx-bg-ctrl__swatch-fill/g) ?? [];
    expect(swatchMatches.length).toBe(2);
  });
});

describe("F4.7 — ImageSub renders the src toggle + 4 option rows", () => {
  it("emits Media/URL toggle and Size/Position/Repeat/Attachment rows", () => {
    const value: BackgroundConfig = { type: "image", imageSrc: "media" };
    const html = renderToStaticMarkup(
      createElement(ImageSub, {
        value,
        onChange: () => {},
        openMediaPicker: () => {},
      }),
    );
    expect(html).toContain("epx-bg-ctrl__src-toggle");
    expect(html).toContain("Media");
    expect(html).toContain("URL");
    expect(html).toContain("Size");
    expect(html).toContain("Position");
    expect(html).toContain("Repeat");
    expect(html).toContain("Attachment");
  });
});

describe("F4.7 — VideoSub renders the src toggle + size + start/end + fallback row", () => {
  it("emits the URL input branch when videoSrc=url", () => {
    const value: BackgroundConfig = { type: "video", videoSrc: "url", videoUrl: "https://example.com/x.mp4" };
    const html = renderToStaticMarkup(
      createElement(VideoSub, {
        value,
        onChange: () => {},
        openMainPicker: () => {},
        openFallbackPicker: () => {},
      }),
    );
    expect(html).toContain("epx-bg-ctrl__url-input");
    expect(html).toContain("Start Time");
    expect(html).toContain("End Time");
    expect(html).toContain("Play Once");
    expect(html).toContain("Fallback");
  });
});

describe("F4.7 — SlideshowSub renders the add button + slide list", () => {
  it("emits the + Add Images trigger and the slides container when populated", () => {
    const value: BackgroundConfig = {
      type: "slideshow",
      slides: [
        { id: "s1", storageKey: "k1", filename: "one.jpg" },
        { id: "s2", storageKey: "k2", filename: "two.jpg" },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(SlideshowSub, {
        value,
        onChange: () => {},
        openMediaPicker: () => {},
      }),
    );
    expect(html).toContain("Add Images");
    expect(html).toContain("epx-bg-ctrl__slides");
    expect(html).toContain("one.jpg");
    expect(html).toContain("two.jpg");
  });
});

describe("F4.7 — TypeTabs renders all 5 tabs by default and respects allowedTypes", () => {
  it("renders all 5 tabs when allowedTypes is undefined", () => {
    const html = renderToStaticMarkup(
      createElement(TypeTabs, { active: "color", allowedTypes: undefined, onSelect: () => {} }),
    );
    expect(html).toContain('data-tooltip="Solid Color"');
    expect(html).toContain('data-tooltip="Gradient"');
    expect(html).toContain('data-tooltip="Image"');
    expect(html).toContain('data-tooltip="Video"');
    expect(html).toContain('data-tooltip="Slideshow"');
  });

  it("filters out tabs not in allowedTypes", () => {
    const html = renderToStaticMarkup(
      createElement(TypeTabs, { active: "color", allowedTypes: ["color", "gradient", "image"], onSelect: () => {} }),
    );
    expect(html).toContain('data-tooltip="Solid Color"');
    expect(html).toContain('data-tooltip="Gradient"');
    expect(html).toContain('data-tooltip="Image"');
    expect(html).not.toContain('data-tooltip="Video"');
    expect(html).not.toContain('data-tooltip="Slideshow"');
  });
});

describe("F4.7 — serialize.ts round-trip", () => {
  it("color → serialize → parse round-trips the value", () => {
    const cfg: BackgroundConfig = { type: "color", color: "#abcdef", colorAlpha: 0.42 };
    const out = parseBackground(serializeBackground(cfg));
    expect(out).toEqual(cfg);
  });

  it("gradient stops survive a round-trip via JSON.stringify", () => {
    const cfg: BackgroundConfig = {
      type: "gradient",
      gradAngle: 200,
      gradStops: [
        { color: "#111111", alpha: 1, pos: 0 },
        { color: "#222222", alpha: 0.5, pos: 50 },
        { color: "#333333", alpha: 1, pos: 100 },
      ],
    };
    const out = parseBackground(serializeBackground(cfg));
    expect(out).toEqual(cfg);
  });

  it("image with media ref + URL fields round-trip", () => {
    const cfg: BackgroundConfig = {
      type: "image",
      imageSrc: "media",
      image: { id: "img-1", storageKey: "key-1", alt: "alt", filename: "f.jpg" },
      imageUrl: "",
      imageSize: "cover",
      imagePosition: "center",
      imageRepeat: "no-repeat",
      imageAttachment: "scroll",
    };
    const out = parseBackground(serializeBackground(cfg));
    expect(out).toEqual(cfg);
  });

  it("buildBackgroundCss emits a `background:` rule for color", () => {
    const css = buildBackgroundCss({ backgroundType: "color", backgroundColor: "#ff0000", backgroundColorAlpha: 1 });
    expect(css).toContain("background:rgba(255,0,0,1)");
  });

  it("buildBackgroundCss emits a `linear-gradient(...)` rule for gradient", () => {
    const css = buildBackgroundCss({
      backgroundType: "gradient",
      backgroundGradAngle: 135,
      backgroundGradStops: JSON.stringify([
        { color: "#000000", alpha: 1, pos: 0 },
        { color: "#ffffff", alpha: 1, pos: 100 },
      ]),
    });
    expect(css).toContain("linear-gradient(135deg");
    expect(css).toContain("rgba(0,0,0,1) 0%");
    expect(css).toContain("rgba(255,255,255,1) 100%");
  });

  it("buildBackgroundCss returns empty string when no type is set", () => {
    expect(buildBackgroundCss({})).toBe("");
  });
});
