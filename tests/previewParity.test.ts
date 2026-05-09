import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TextPreview } from "../src/admin/previews/TextPreview.js";
import { IconPreview } from "../src/admin/previews/IconPreview.js";
import { HtmlPreview } from "../src/admin/previews/HtmlPreview.js";

// F3.6.6 — preview / Astro DOM parity audit.
//
// Canvas wraps every preview in `<div data-epx-block={id}>`. The preview
// emits the inner DOM that goes inside that wrapper, mirroring what the
// matching `*.astro` component would emit underneath its own root.
//
// These tests pin the three drift fixes from F3.6.6:
//   1. TextPreview honors `htmlTag` (was hardcoded `<span>`).
//   2. IconPreview applies CSS-mask coloring for SVG icons.
//   3. HtmlPreview matches Html.astro's iframe override CSS keys
//      (display:block; width:100%; box-sizing:border-box; border:0).

describe("F3.6.6 — TextPreview honors htmlTag", () => {
  it("renders <p> when htmlTag is 'p'", () => {
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "Hello", htmlTag: "p" } }),
    );
    expect(html).toMatch(/^<p[ >]/);
    expect(html).toContain(">Hello</p>");
  });

  it("renders <h1> when htmlTag is 'h1'", () => {
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "Hello", htmlTag: "h1" } }),
    );
    expect(html).toMatch(/^<h1[ >]/);
    expect(html).toContain(">Hello</h1>");
  });

  it("renders <h2> / <h3> / <h4> / <h5> / <h6> as configured", () => {
    for (const tag of ["h2", "h3", "h4", "h5", "h6"]) {
      const html = renderToStaticMarkup(
        createElement(TextPreview, { config: { content: "T", htmlTag: tag } }),
      );
      expect(html).toMatch(new RegExp(`^<${tag}[ >]`));
    }
  });

  it("renders <span> / <div> when configured", () => {
    for (const tag of ["span", "div"]) {
      const html = renderToStaticMarkup(
        createElement(TextPreview, { config: { content: "T", htmlTag: tag } }),
      );
      expect(html).toMatch(new RegExp(`^<${tag}[ >]`));
    }
  });

  it("falls back to <p> when htmlTag is missing", () => {
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "T" } }),
    );
    expect(html).toMatch(/^<p[ >]/);
  });

  it("falls back to <p> when htmlTag is not whitelisted", () => {
    // Anti-XSS guard — a corrupted/legacy config can't render `<script>`
    // or `<iframe>` on canvas via this prop.
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "T", htmlTag: "script" } }),
    );
    expect(html).toMatch(/^<p[ >]/);
    expect(html).not.toContain("<script");
  });

  it("zeros browser-default margin so spacing comes from buildBlockChromeCss", () => {
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "T", htmlTag: "h1" } }),
    );
    expect(html).toContain("margin:0");
  });

  it("renders empty-state placeholder when content is empty", () => {
    const html = renderToStaticMarkup(
      createElement(TextPreview, { config: { content: "", htmlTag: "p" } }),
    );
    expect(html).toContain("Text block");
  });
});

describe("F3.6.6 — IconPreview SVG mask coloring", () => {
  it("renders a <span> with CSS mask when icon is SVG and iconColor is set", () => {
    const html = renderToStaticMarkup(
      createElement(IconPreview, {
        config: {
          icon: {
            iconSrc: { storageKey: "ic-1", filename: "x.svg", alt: "X" },
            iconSize: "32px",
            iconColor: "#ff0000",
          },
          style: {},
        },
      }),
    );
    // Mask is the load-bearing assertion — without it, the SVG renders in
    // its native colors.
    expect(html).toContain("mask:");
    expect(html).toMatch(/url\(\/_emdash\/api\/media\/file\/ic-1\)/);
    // Coloring goes via background-color + mask, not <img color> (which is
    // a no-op).
    expect(html).toContain("background-color:");
    // Marked as a role=img element (spans aren't otherwise accessible).
    expect(html).toContain('role="img"');
  });

  it("renders <img> for PNG icons (no mask)", () => {
    const html = renderToStaticMarkup(
      createElement(IconPreview, {
        config: {
          icon: {
            iconSrc: { storageKey: "ic-2", filename: "x.png", alt: "X" },
            iconSize: "32px",
            iconColor: "#ff0000", // ignored on PNG (frontend matches)
          },
          style: {},
        },
      }),
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("mask:");
  });

  it("renders <img> for SVG icons without iconColor (no mask needed)", () => {
    const html = renderToStaticMarkup(
      createElement(IconPreview, {
        config: {
          icon: {
            iconSrc: { storageKey: "ic-3", filename: "x.svg", alt: "X" },
            iconSize: "32px",
          },
          style: {},
        },
      }),
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("mask:");
  });

  it("style.iconColor takes precedence over icon group's own iconColor (frontend parity)", () => {
    const html = renderToStaticMarkup(
      createElement(IconPreview, {
        config: {
          icon: {
            iconSrc: { storageKey: "ic-4", filename: "x.svg" },
            iconColor: "#0000ff",
          },
          style: { iconColor: "#ff0000" },
        },
      }),
    );
    // Style-level color wins.
    expect(html).toContain("background-color:rgba(255,0,0");
  });
});

describe("F3.6.6 — HtmlPreview iframe sizing", () => {
  it("emits display:block, width:100%, box-sizing:border-box, border:0", () => {
    const html = renderToStaticMarkup(
      createElement(HtmlPreview, { config: { code: "<p>Hi</p>" } }),
    );
    // Mirror Html.astro's `iframeOverrideCss`. Drops `flex` / `align-self`
    // / `min-width` because canvas's `epx-canvas-block-host` is always a
    // `display:block` parent (F3.6.5).
    expect(html).toContain("display:block");
    expect(html).toContain("width:100%");
    expect(html).toContain("box-sizing:border-box");
    expect(html).toMatch(/border:0|border:none/);
  });

  it("renders the empty-state placeholder when code is empty", () => {
    const html = renderToStaticMarkup(
      createElement(HtmlPreview, { config: { code: "   " } }),
    );
    expect(html).toContain("HTML block");
  });
});
