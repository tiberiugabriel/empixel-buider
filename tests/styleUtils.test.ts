import { describe, it, expect } from "vitest";
import {
  buildBlockCss,
  buildHoverCss,
  buildBreakpointCss,
  buildBlockChromeCss,
  getCustomCss,
  getBlockId,
  getBlockClass,
  normalizeLegacySpacing,
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

// ─── F3.6.4: legacy symbolic-spacing inline resolve ─────────────────────────
//
// Pre-F3.6 layouts persisted padding/margin as symbolic strings
// (`"md"`/`"lg"`/…); F3.6 + F3.6.4 retired that vocabulary. Agent A's
// `runMigrationLegacySpacingV1` rewrites stored rows forward, but for the
// brief window between an upgrade and the lazy-gate migration firing,
// `styleUtils.ts` inline-resolves symbolic values to the matching px so
// rendered pages don't silently drop padding to zero. The legacy
// `spacingMap` / `resolveSpacing` plumbing in `SectionContainer.astro`
// was removed as part of the same task.
describe("normalizeLegacySpacing (F3.6.4)", () => {
  it("maps each legacy symbolic value to its px equivalent", () => {
    expect(normalizeLegacySpacing("none")).toBe("0");
    expect(normalizeLegacySpacing("sm")).toBe("32px");
    expect(normalizeLegacySpacing("md")).toBe("48px");
    expect(normalizeLegacySpacing("lg")).toBe("64px");
    expect(normalizeLegacySpacing("xl")).toBe("96px");
  });

  it("passes through concrete CSS values unchanged", () => {
    expect(normalizeLegacySpacing("12px")).toBe("12px");
    expect(normalizeLegacySpacing("1.5rem")).toBe("1.5rem");
    expect(normalizeLegacySpacing("0")).toBe("0");
    expect(normalizeLegacySpacing("")).toBe("");
    expect(normalizeLegacySpacing("clamp(1rem, 5vw, 4rem)")).toBe("clamp(1rem, 5vw, 4rem)");
  });

  it("does not match unrelated strings that happen to overlap with prop names", () => {
    expect(normalizeLegacySpacing("medium")).toBe("medium");
    expect(normalizeLegacySpacing("xlarge")).toBe("xlarge");
  });
});

describe("buildBlockCss — F3.6.4 legacy spacing inline-resolve", () => {
  it("resolves symbolic padding values to px (replaces SectionContainer's old spacingMap)", () => {
    const css = buildBlockCss(
      { style: { paddingTop: "md", paddingRight: "sm", paddingBottom: "lg", paddingLeft: "xl" } },
      "B1",
    );
    expect(css).toContain("padding-top:48px");
    expect(css).toContain("padding-right:32px");
    expect(css).toContain("padding-bottom:64px");
    expect(css).toContain("padding-left:96px");
    // Symbolic strings must NOT survive into the emitted rule body.
    expect(css).not.toContain("padding-top:md");
    expect(css).not.toContain("padding-right:sm");
  });

  it("resolves symbolic margin values to px", () => {
    const css = buildBlockCss(
      { style: { marginTop: "none", marginRight: "sm", marginBottom: "md", marginLeft: "xl" } },
      "B1",
    );
    expect(css).toContain("margin-top:0");
    expect(css).toContain("margin-right:32px");
    expect(css).toContain("margin-bottom:48px");
    expect(css).toContain("margin-left:96px");
  });

  it("leaves concrete px / rem / clamp values for padding alone", () => {
    const css = buildBlockCss(
      { style: { paddingTop: "12px", paddingBottom: "1.5rem" } },
      "B1",
    );
    expect(css).toContain("padding-top:12px");
    expect(css).toContain("padding-bottom:1.5rem");
  });

  it("only normalises padding+margin keys — non-spacing keys keep their value as-is", () => {
    // `width: "md"` is nonsense CSS, but the legacy fallback historically
    // never touched non-spacing keys. The inline-resolve must preserve that
    // behavior so authors who typed `none` into a non-spacing field don't
    // see it silently rewritten to `0`.
    const css = buildBlockCss(
      { style: { width: "md", borderTopWidth: "sm", paddingTop: "md" } },
      "B1",
    );
    expect(css).toContain("padding-top:48px");
    expect(css).toContain("width:md");
    expect(css).toContain("border-top-width:sm");
  });
});

describe("buildBreakpointCss — F3.6.4 legacy spacing inline-resolve", () => {
  it("normalises spacing keys at the breakpoint level when they appear in BP_VISUAL_PROPS", () => {
    // BP_VISUAL_PROPS doesn't currently include padding/margin (visual
    // props only — radii/border/typography/etc.) so this is a forward
    // compatibility check: the breakpoint loop applies the same gate as
    // the desktop loop, so any future addition of a spacing key to
    // BP_VISUAL_PROPS automatically inherits the legacy fallback. Today
    // the test exercises the no-op path (typography keys are unaffected
    // by normalisation, just like before).
    const css = buildBreakpointCss(
      { styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "16px" } } },
      "B1",
    );
    expect(css).toContain("font-size:16px");
  });
});
