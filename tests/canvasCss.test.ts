import { describe, it, expect } from "vitest";
import { buildCanvasBlockCss } from "../src/admin/Canvas.js";
import { buildBlockChromeCss } from "../src/components/styleUtils.js";
import type { BlockType, SectionBlock } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBlock(
  type: BlockType,
  config: Record<string, unknown>,
  id = "B1",
): SectionBlock {
  return {
    id,
    type,
    config: { theme: "light", ...config },
  };
}

// F3.6.3 — Canvas's per-block CSS path is the same path the frontend Astro
// components use, plus an active-breakpoint preview overlay layered on top.
//
// Drift is the bug: a config with hover + breakpoint + dark variants used to
// render one way on Canvas (only `buildBlockCss + buildHoverCss + getCustomCss`)
// and another way on the host site (`buildBlockChromeCss` — full chain).
// These tests pin the unification.

describe("buildCanvasBlockCss — frontend parity", () => {
  it("on desktop, output equals the frontend's buildBlockChromeCss output", () => {
    const block = makeBlock("text", {
      style: { paddingTop: "8px", color: "#111111" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
      advanced: { customCss: "color: red;" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    expect(canvasCss).toBe(frontendCss);
  });

  it("emits the FULL frontend bundle — block + hover + breakpoint + breakpoint-hover + custom", () => {
    const block = makeBlock("text", {
      style: { paddingTop: "8px" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
      advanced: { customCss: "color: red;" },
    });

    const css = buildCanvasBlockCss(block, "desktop");

    // Block + hover (from buildBlockCss + buildHoverCss).
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("border-top-width:2px !important");
    // Breakpoint @media (from buildBreakpointCss).
    expect(css).toContain("@media(max-width:575px)");
    expect(css).toContain("font-size:14px");
    // Breakpoint hover @media (from buildBreakpointHoverCss).
    expect(css).toContain("border-top-width:4px !important");
    // Custom CSS (from getCustomCss).
    expect(css).toContain("color: red");
  });

  it("emits dark variants identical to the frontend (drift fix)", () => {
    const block = makeBlock("text", {
      style: { color: "#111111" },
      styleDark: { color: "#eeeeee" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");

    expect(canvasCss).toContain("color:#111111");
    expect(canvasCss).toContain("color:#eeeeee");
    expect(canvasCss).toContain(":is(html.dark");
  });

  it("respects imgScoped: true for image blocks (mirrors Image.astro)", () => {
    const block = makeBlock("image", {
      style: { borderTopWidth: "2px", borderStyle: "solid", borderColor: "#000" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id, { imgScoped: true });

    expect(canvasCss).toBe(frontendCss);
    // Image visual props target the inner <img>, not the root.
    expect(canvasCss).toContain('[data-epx-block="B1"] img{');
    expect(canvasCss).toContain("border-top-width:2px");
  });

  it("returns empty string when block has no styling at all", () => {
    const block = makeBlock("text", {});
    expect(buildCanvasBlockCss(block, "desktop")).toBe("");
  });
});

describe("buildCanvasBlockCss — active-breakpoint preview overlay", () => {
  it("on non-desktop, layers a non-@media overlay on top of the frontend bundle", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // Frontend bundle still emitted — drift dies.
    expect(canvasCss.startsWith(frontendCss)).toBe(true);

    // Frontend's @media rule fires only at <=575px viewport.
    expect(frontendCss).toContain("@media(max-width:575px)");
    expect(frontendCss).toContain("font-size:14px");

    // Canvas adds an overlay AFTER the bundle that wins in cascade order.
    // The overlay declares `font-size:14px` directly on the block selector
    // with no @media gate.
    const overlay = canvasCss.slice(frontendCss.length);
    expect(overlay).toContain('[data-epx-block="B1"]{');
    expect(overlay).toContain("font-size:14px");
    expect(overlay).not.toContain("@media");
  });

  it("overlays the active bp's hover declarations when styleHoverBreakpoints is set", () => {
    const block = makeBlock("text", {
      styleHover: { borderTopWidth: "1px" },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);
    const overlay = canvasCss.slice(frontendCss.length);

    // Overlay :hover rule with no @media gate.
    expect(overlay).toContain('[data-epx-block="B1"]:hover{');
    expect(overlay).toContain("border-top-width:4px !important");
    expect(overlay).not.toContain("@media");
  });

  it("emits no overlay when the active bp has no override on this block", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "16px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // No overlay because mobile-portrait has nothing in styleBreakpoints —
    // the frontend bundle is the entire output.
    expect(canvasCss).toBe(frontendCss);
  });

  it("overlay routes image blocks through imgScoped (mirrors Image.astro)", () => {
    const block = makeBlock("image", {
      style: { borderTopWidth: "1px", borderStyle: "solid", borderColor: "#000" },
      styleBreakpoints: {
        "mobile-portrait": { _px: 575, borderTopWidth: "4px" },
      },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id, { imgScoped: true });
    const overlay = canvasCss.slice(frontendCss.length);

    // Frontend bundle emits the @media rule on the root.
    expect(frontendCss).toContain("@media(max-width:575px)");
    // Overlay re-emits the visual override on `<img>` (imgScoped).
    expect(overlay).toContain('[data-epx-block="B1"] img{');
    expect(overlay).toContain("border-top-width:4px");
  });

  it("desktop overlay is empty regardless of breakpoint data", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // Desktop = no overlay; canvas == frontend exactly.
    expect(canvasCss).toBe(frontendCss);
  });

  it("active-bp overlay wins in cascade order over the frontend bundle", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");

    // Two `font-size` declarations exist: 20px (desktop, in the frontend
    // bundle's base rule) and 14px (overlay). The overlay must come AFTER
    // the 20px declaration so cascade order picks 14px when both selectors
    // match (selector specificity is equal; later rule wins).
    const idx20 = canvasCss.indexOf("font-size:20px");
    const idxOverlay14 = canvasCss.lastIndexOf("font-size:14px");
    expect(idx20).toBeGreaterThanOrEqual(0);
    expect(idxOverlay14).toBeGreaterThan(idx20);
  });
});
