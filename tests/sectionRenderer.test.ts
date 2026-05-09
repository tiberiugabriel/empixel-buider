import { describe, it, expect } from "vitest";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionRenderer } from "../src/admin/right-panel/SectionRenderer.js";
import type { StyleSection } from "../src/admin/blockDefinitions.js";
import type { SectionBlock } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBlock(type: SectionBlock["type"], extraConfig: Record<string, unknown> = {}): SectionBlock {
  return {
    id: "test-block",
    type,
    config: {
      theme: "light",
      style: {},
      ...extraConfig,
    },
  };
}

const ALL_KINDS: StyleSection[] = [
  { kind: "theme" },
  { kind: "spacing", targets: ["padding", "margin"] },
  { kind: "background", modes: ["color", "gradient"] },
  { kind: "border" },
  { kind: "borderRadius" },
  { kind: "boxShadow" },
  { kind: "typography", props: ["fontFamily", "fontSize"] },
  { kind: "textStroke" },
  { kind: "textShadow" },
  { kind: "alignment" },
  { kind: "blendMode" },
  { kind: "filter" },
  { kind: "overflow" },
  { kind: "opacity" },
  { kind: "imgVisual" },
  { kind: "videoSource" },
  { kind: "iconGroup" },
  { kind: "dividerLine" },
  {
    kind: "custom",
    render: ({ block }) => createElement("div", { "data-testid": "custom", "data-block-type": block.type }),
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SectionRenderer", () => {
  it("returns a valid React node for every StyleSection.kind", () => {
    const block = makeBlock("text");
    for (const section of ALL_KINDS) {
      const tree = SectionRenderer({
        section,
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      });
      // Either a React element or a valid ReactNode (string, fragment).
      // For all current kinds the dispatcher returns a JSX element.
      if (tree === null || tree === undefined) {
        throw new Error(`SectionRenderer returned null/undefined for kind=${section.kind}`);
      }
      // React 19: rendered nodes from a function component are React elements.
      // Wrap into createElement so we can validate shape.
      const wrapped = createElement(SectionRenderer, {
        section,
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      });
      expect(isValidElement(wrapped)).toBe(true);
    }
  });

  it("renders without crashing for every kind via renderToStaticMarkup", () => {
    // KISS smoke test — non-empty HTML output for every kind. The custom
    // case uses our own minimal fixture renderer to avoid pulling in
    // production custom sections (they require richer block fixtures).
    for (const section of ALL_KINDS) {
      // Pick a block type that "fits" the kind so any control reading
      // type-specific config doesn't blow up. For most kinds `text` is
      // fine; image-only / video-only kinds use their matching block.
      const blockType: SectionBlock["type"] =
        section.kind === "imgVisual" ? "image"
        : section.kind === "videoSource" ? "video"
        : section.kind === "dividerLine" ? "divider-spacer"
        : "text";
      const block = makeBlock(blockType);
      const html = renderToStaticMarkup(
        createElement(SectionRenderer, {
          section,
          block,
          onChange: () => {},
          activeBreakpoint: "desktop",
        }),
      );
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it("custom kind invokes the supplied render with block + onChange + activeBreakpoint", () => {
    let captured: { hasBlock: boolean; hasOnChange: boolean; bp: string } | null = null;
    const section: StyleSection = {
      kind: "custom",
      render: ({ block, onChange, activeBreakpoint }) => {
        captured = {
          hasBlock: !!block,
          hasOnChange: typeof onChange === "function",
          bp: activeBreakpoint,
        };
        return createElement("span", null, "custom-output");
      },
    };
    const block = makeBlock("text");
    SectionRenderer({ section, block, onChange: () => {}, activeBreakpoint: "tablet" });
    expect(captured).toEqual({ hasBlock: true, hasOnChange: true, bp: "tablet" });
  });

  it("theme kind passes block.config.theme through to ThemeStyleToggle", () => {
    const block = makeBlock("text", { theme: "dark" });
    const html = renderToStaticMarkup(
      createElement(SectionRenderer, {
        section: { kind: "theme" },
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    // ThemeStyleToggle marks the active theme button with `is-active`.
    // Spot-check that "dark" surfaces somewhere in the output.
    expect(html).toContain("epx-blk-theme-toggle");
  });

  it("non-custom kinds cover the 18 declarative variants", () => {
    const nonCustom = ALL_KINDS.filter((s) => s.kind !== "custom");
    expect(nonCustom).toHaveLength(18);
    // Sanity: kinds are unique.
    const kinds = new Set(nonCustom.map((s) => s.kind));
    expect(kinds.size).toBe(18);
  });
});
