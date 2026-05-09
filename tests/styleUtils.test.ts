import { describe, it, expect } from "vitest";
import {
  buildBlockCss,
  buildHoverCss,
  buildBreakpointCss,
  buildBlockChromeCss,
  getCustomCss,
  getBlockId,
  getBlockClass,
} from "../src/components/styleUtils.js";

describe("buildBlockCss", () => {
  it("returns empty string when no blockId", () => {
    expect(buildBlockCss({ style: { paddingTop: "8px" } }, "")).toBe("");
  });

  it("emits a single rule under the block selector", () => {
    const css = buildBlockCss({ style: { paddingTop: "8px", paddingBottom: "12px" } }, "B1");
    expect(css.startsWith('[data-epx-block="B1"]{')).toBe(true);
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("padding-bottom:12px");
  });

  it("emits BOTH light and dark variants — dark scoped via the universal selector", () => {
    const css = buildBlockCss(
      { style: { color: "#000000" }, styleDark: { color: "#ffffff" } },
      "B1",
    );
    // Light rule on the bare attribute selector.
    expect(css).toContain('[data-epx-block="B1"]{');
    expect(css).toContain("color:#000000");
    // Dark rule on the compound :is(...) ancestor selector — matches when an
    // ancestor uses any of the supported theme conventions, OR when the
    // block element itself carries data-theme="dark" (canvas preview).
    expect(css).toContain(':is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="B1"]');
    expect(css).toContain('[data-epx-block="B1"][data-theme="dark"]');
    expect(css).toContain("color:#ffffff");
  });

  it("does not emit a dark rule when styleDark is empty", () => {
    const css = buildBlockCss({ style: { color: "#000000" } }, "B1");
    expect(css).toContain("color:#000000");
    expect(css).not.toContain('[data-theme="dark"]');
  });

  // F1.2 — universal dark selector. Plugin must adapt to whichever theme
  // convention the host site chose (EmDash core enforces none); see Section
  // 5 Q4 of raport-empixel-emdash.html.
  it("composes dark selector covering Tailwind, html data-theme, ancestor data-theme, data-mode, and self", () => {
    const css = buildBlockCss(
      { style: { color: "#000000" }, styleDark: { color: "#ffffff" } },
      "abc123",
    );
    const expectedDarkSelector =
      ':is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="abc123"],' +
      '[data-epx-block="abc123"][data-theme="dark"]';
    expect(css).toContain(`${expectedDarkSelector}{color:#ffffff}`);
  });
});

describe("buildHoverCss", () => {
  it("emits a :hover rule with !important", () => {
    const css = buildHoverCss({ styleHover: { borderTopWidth: "2px" } }, "B1");
    expect(css).toContain('[data-epx-block="B1"]:hover{');
    expect(css).toContain("border-top-width:2px !important");
  });

  it("returns empty string when nothing to emit", () => {
    expect(buildHoverCss({}, "B1")).toBe("");
  });
});

describe("buildBreakpointCss", () => {
  it("emits per-breakpoint @media rules sorted from largest to smallest px", () => {
    const css = buildBreakpointCss(
      {
        styleBreakpoints: {
          "tablet-portrait":  { _px: 992, fontSize: "16px" },
          "mobile-portrait":  { _px: 575, fontSize: "14px" },
        },
      },
      "B1",
    );
    const tabletIdx = css.indexOf("@media(max-width:992px)");
    const mobileIdx = css.indexOf("@media(max-width:575px)");
    expect(tabletIdx).toBeGreaterThanOrEqual(0);
    expect(mobileIdx).toBeGreaterThanOrEqual(0);
    expect(tabletIdx).toBeLessThan(mobileIdx);
    expect(css).toContain("font-size:16px");
    expect(css).toContain("font-size:14px");
  });

  it("skips breakpoints without _px", () => {
    const css = buildBreakpointCss(
      { styleBreakpoints: { foo: { fontSize: "20px" } } },
      "B1",
    );
    expect(css).toBe("");
  });
});

describe("getCustomCss", () => {
  it("substitutes the `selector` keyword and emits user CSS as-is when it has braces", () => {
    const css = getCustomCss({ advanced: { customCss: "selector h1 { color: red; }" } }, "B1");
    expect(css).toBe('[data-epx-block="B1"] h1 { color: red; }');
  });

  it("wraps bare declarations in a selector block", () => {
    const css = getCustomCss({ advanced: { customCss: "color: red; padding: 8px;" } }, "B1");
    expect(css).toBe('[data-epx-block="B1"]{color: red; padding: 8px;}');
  });

  it("returns empty string when no customCss", () => {
    expect(getCustomCss({ advanced: {} }, "B1")).toBe("");
  });
});

describe("getBlockId / getBlockClass", () => {
  it("reads advanced.cssId / advanced.cssClasses", () => {
    expect(getBlockId({ advanced: { cssId: "hero" } })).toBe("hero");
    expect(getBlockClass({ advanced: { cssClasses: "promo dark" } })).toBe("promo dark");
  });

  it("returns null / empty string when missing", () => {
    expect(getBlockId({ advanced: {} })).toBeNull();
    expect(getBlockClass({})).toBe("");
  });
});

describe("buildBlockChromeCss", () => {
  it("composes block + hover + breakpoint + custom into one string", () => {
    const css = buildBlockChromeCss(
      {
        style: { paddingTop: "8px" },
        styleHover: { borderTopWidth: "2px" },
        styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
        advanced: { customCss: "color: red;" },
      },
      "B1",
    );
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("border-top-width:2px !important");
    expect(css).toContain("@media(max-width:575px)");
    expect(css).toContain("color: red");
  });

  it("returns empty string when no blockId", () => {
    expect(buildBlockChromeCss({ style: { paddingTop: "8px" } }, undefined)).toBe("");
  });

  it("routes background storage keys through opts.resolveMediaUrl when provided (F2.2)", () => {
    const config = {
      style: {
        backgroundType: "image",
        backgroundImageSrc: "media",
        backgroundImageStorageKey: "bg-key.png",
      },
    };
    const css = buildBlockChromeCss(config, "B1", {
      resolveMediaUrl: (key) => `https://cdn.example.com/${key}`,
    });
    expect(css).toContain("background-image:url(https://cdn.example.com/bg-key.png)");
    // Legacy local route MUST NOT appear when a resolver is supplied.
    expect(css).not.toContain("/_emdash/api/media/file/");
  });

  it("falls back to the legacy local URL when no resolver is supplied (F2.2)", () => {
    const config = {
      style: {
        backgroundType: "image",
        backgroundImageSrc: "media",
        backgroundImageStorageKey: "bg-key.png",
      },
    };
    const css = buildBlockChromeCss(config, "B1");
    expect(css).toContain("background-image:url(/_emdash/api/media/file/bg-key.png)");
  });
});
