# empixel-builder — Block Previews

## Role
Live preview components in the admin UI Canvas. Show real-time feedback as users edit block properties.

## Architecture

```
src/admin/previews/
├─ index.ts                    # PREVIEW_COMPONENTS map export (9 entries)
├─ ContainerPreview.tsx
├─ TextPreview.tsx
├─ ImagePreview.tsx
├─ TextEditorPreview.tsx       # v0.6 — column-count + drop cap, plain-text fallback
├─ VideoPreview.tsx            # v0.6 — aspect-ratio framed; image overlay if set
├─ ButtonPreview.tsx           # v0.6 — flex direction follows iconPosition
├─ IconPreview.tsx             # v0.6 — img w/ size + rotate transform
├─ HtmlPreview.tsx             # v0.6 — dangerouslySetInnerHTML mirrors frontend
└─ DividerSpacerPreview.tsx    # v0.6 — fixed-height block + optional divider line + icon
```

## Preview Registration (index.ts)

```ts
export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
  activeBreakpoint?: BreakpointId; // v0.6+ — Canvas passes this so previews can bp-merge config
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  container: ContainerPreview,
  text: TextPreview,
  image: ImagePreview,
  "text-editor": TextEditorPreview,
  video: VideoPreview,
  button: ButtonPreview,
  icon: IconPreview,
  html: HtmlPreview,
  "divider-spacer": DividerSpacerPreview,
};
```

Every `BlockType` in `types.ts` must have an entry here.

## Preview Pattern

Each preview receives `PreviewProps` (not the full `SectionBlock`):

```tsx
export function TextPreview({ config }: PreviewProps) {
  return (
    <div className="epx-preview-text">
      {(config.content as string) || "Empty text block"}
    </div>
  );
}
```

## Key Principles

### Live Updates
Previews **must reflect config changes in real time**. No hardcoded values.

❌ Bad:
```tsx
<h2>Default CTA Title</h2>
```

✅ Good:
```tsx
<h2>{(config.headline as string) || "CTA Section"}</h2>
```

### Minimal Component
- Only render what matters for preview (structure, not full HTML)
- Omit business logic
- No data fetching, no side effects

### Props (PreviewProps)
- `config` — `block.config` (flat object)
- `children` — child blocks (for container)
- `slots` — slot arrays (for columns)

## Current Previews (9)

1. **ContainerPreview** — Renders children recursively via PREVIEW_COMPONENTS
2. **TextPreview** — Renders `config.content` inside the configured `htmlTag` (whitelist `p, div, span, h1–h6`; defaults to `<p>`). Inline `margin:0` so spacing comes from chrome CSS. (F3.6.6 — was `<span>`.)
3. **ImagePreview** — Renders `config.image` (via `/_emdash/api/media/file/<storageKey>`) with caption + link
4. **TextEditorPreview** (v0.6) — Joins Portable Text content as plain text, applies column-count + optional drop cap
5. **VideoPreview** (v0.6) — Aspect-ratio framed div; renders overlay image if set; centered ▶ marker
6. **ButtonPreview** (v0.6) — Inline-flex `<button>` with text + optional icon; `flex-direction` follows `iconPosition`
7. **IconPreview** (v0.6 / F3.6.6) — Aligned wrapper `<div>` with size + rotate transform. SVG icons with `style.iconColor` (or icon-group `iconColor`) render as `<span>` with CSS `mask: url(...)` and `background-color:` so the silhouette recolors; PNG and uncolored SVG render as plain `<img>`. (F3.6.6 — was raw `<img color=...>`, which is a no-op on `<img>`.)
8. **HtmlPreview** (v0.6) — `dangerouslySetInnerHTML` mirrors frontend trusted-input behavior
9. **DividerSpacerPreview** (v0.6) — Fixed-height block; if divider active, inline-flex line(s) + optional centered icon

(SpacerPreview removed in v0.6 — replaced by DividerSpacerPreview after one-time DB migration.)
(TestimonialsPreview / FaqPreview / PricingPreview removed post-v0.6 — variant B, no DB migration. Old layouts that still contain those types render no preview and show "Unknown block" placeholder.)

## F3.6.6 — Preview / Astro DOM parity audit

**Wrapping context.** For non-container blocks Canvas wraps every preview
in `<div data-epx-block={section.id} class="epx-theme--<x>">…</div>`
(`Canvas.tsx` lines 436–450). The chrome CSS emitted by
`buildBlockChromeCss` (F3.6.3) targets `[data-epx-block="<id>"]` so the
preview should emit only the **inner DOM** that goes inside that wrapper
— mirroring what the matching `*.astro` component would emit underneath
its own root tag. Previews must NOT render their own `data-epx-block`.

**Container exception.** For `block.type === "container"`, Canvas routes
through `ContainerBlock` (line 300), not `ContainerPreview`. Container
chrome is rendered as `<div data-epx-block class="epx-container-block
epx-theme--<x>">…<div class="epx-container-block__children">{recurse}</div></div>`.
`ContainerPreview` itself is dead code in the canvas path — kept in
`PREVIEW_COMPONENTS` for symmetry / fallback.

**HTML exception.** `Html.astro` makes the `<iframe>` itself the
`data-epx-block` element (no wrapper `<div>`). The preview iframe sits
inside Canvas's wrapper instead — that's a one-element duplication, but
it's the cheapest way to keep the host wrapper logic uniform.

### Audit table

| # | Block | Astro DOM (root → children, with `data-epx-block` on root) | Preview DOM (inner — Canvas wraps in `<div data-epx-block>`) | Diff intentional? | Notes |
|---|-------|------------------------------------------------------------|--------------------------------------------------------------|-------------------|-------|
| 1 | container | `<Tag(htmlTag\|"section") class="epx-section-container epx-theme--<x>" data-epx-block>{video?}{children…}</Tag>` (children render via `BlockRenderer` for leaves, `<Astro.self>` for nested containers) | n/a — Canvas routes containers to `ContainerBlock`, not `ContainerPreview`. The dead-code preview returns `<div style={{border:dashed,padding:12px,minHeight:48}}><div>Container</div><div>{N} blocks inside</div></div>` | yes (intentional + dead code) | Documented. `ContainerPreview` exists in `PREVIEW_COMPONENTS` for symmetry; canvas never invokes it because of `isContainerType` short-circuit. |
| 2 | text | `<Tag(htmlTag\|"p") data-epx-block id class href? target? rel?>{content}</Tag>` | `<Tag(htmlTag\|"p") style={{margin:0,whiteSpace:"pre-wrap"}}>{content}</Tag>` (whitelist: `p, div, span, h1–h6`) | no — F3.6.6 fix | **Was**: hardcoded `<span>`. Now mirrors `htmlTag`. `margin:0` neutralises browser default so spacing comes from `buildBlockChromeCss`. No `data-epx-block` on the inner tag — Canvas owns it. |
| 3 | image | Outer is `<figure\|<a>\|<div> data-epx-block id class href? target? rel?>` (figure when caption set; `<a>` when link + no caption; else `<div>`). Inner: `<div class="epx-img-frame">[<a>?]<img src=resolveMediaUrl(…) loading="lazy" decoding="async">[</a>]?</div>{caption ? <figcaption>{caption}</figcaption> : ''}` | `<figure style={{margin:0}}><div class="epx-img-frame" style={justify?}><img src="/_emdash/api/media/file/<key>" style={imgVisualStyle+imgInline}>{caption ? <figcaption>{caption}</figcaption> : ''}</figure>` | yes | Three documented intentional differences: **(a)** preview always uses `<figure>` rather than picking `figure\|a\|div` per caption/link. The frontend root tag carries `data-epx-block`; on canvas the equivalent is the wrapping `<div data-epx-block>` Canvas emits, so the preview's outer `<figure>` is just a margin-zeroed wrapper for the image+caption pair. Dropping the figure would require duplicating the figcaption layout logic. **(b)** preview uses hand-built `/_emdash/api/media/file/<key>` URL; frontend uses `resolveMediaUrl(key, { locals })` (F2.2). Tracked debt — see "admin resolveMediaUrl migration" in `.claude/coordination/status` (orchestrator task #9). All 9 previews share this URL drift. **(c)** preview computes `imgVisualStyle` (border / radius / shadow) inline via `buildImgVisualReactStyle`; frontend emits the same declarations via `buildBlockChromeCss({…, imgScoped:true})` scoped to `[data-epx-block="<id>"] img`. Output equivalent at runtime; the preview duplicates the math because Canvas only just (F3.6.3) started emitting the scoped img CSS — the inline-style version is left in for safety until a parity test pins them as equivalent. |
| 4 | text-editor | `<div data-epx-block id class>{Renderer ? <PortableText value={content} components={ptComponents}/> : <div white-space:pre-wrap set:html={fallbackText}/>}</div>` (column-count + drop-cap + paragraph-spacing + link-color CSS emitted via `<style is:global>`) | `<div class="epx-textedit-preview" style={{columnCount,columnGap}}>{renderPortableText(content)}{scoped <style/> for drop-cap+paraSpacing+linkColor}</div>` | yes | Two intentional differences: **(a)** preview uses an internal `epx-textedit-preview` class because the scoped `<style>` (drop-cap on `::first-letter`, `p+p` margin, `a` color) needs a stable selector. Canvas wraps the preview in `<div data-epx-block>` but the preview can't safely emit a `[data-epx-block="<id>"]` rule (it doesn't receive `block.id`). **(b)** preview implements its own mini-PortableText renderer (paragraph / heading / marks / image type) instead of calling `emdash/ui`'s `PortableText` because `emdash/ui` is an Astro/SSR target, not a React-in-React target. Output coverage is the same six block styles + four marks + image-type. |
| 5 | video | `<div data-epx-block id class>{overlay? <button class="epx-video-overlay"><img/></button>}{provider==="youtube"? <iframe data-epx-video-iframe src? data-epx-src? title="YouTube video" loading? allow allowfullscreen/>}{provider==="vimeo"? <iframe …/>}{provider==="custom"? <video data-epx-video-iframe src? data-epx-src? autoplay? muted? controls? playsinline preload/>}</div>` (wrapper CSS sets `aspect-ratio` + `position:relative`; iframe/video pinned to inset:0 via scoped CSS) | `<div style={{position:"relative",paddingTop:RATIO_PADDING[aspect],background:#0f172a,overflow:hidden,borderRadius:4}}><div absolute inset center>{overlay? <img/> : <span>{hasSource ? "▶" : "Video block"}</span>}<div centered ▶ marker/></div></div>` | yes | Three intentional differences: **(a)** preview uses the `padding-top: <ratio>%` hack to size; frontend uses `aspect-ratio` CSS. Canvas's `buildBlockChromeCss` doesn't emit `aspect-ratio` for the video block (Video.astro's per-block `wrapperCss` does it locally), so canvas chrome leaves the wrapper unsized — the preview must size itself. **(b)** preview replaces real iframe/video with a placeholder `▶` marker. Loading 3-rd-party YouTube/Vimeo iframes during edit would mean every drag-rerender pulls a 1MB+ player; placeholder keeps the canvas snappy. The host page renders the real embed. **(c)** preview hardcodes `background:#0f172a` + `borderRadius:4` for visual contrast; frontend emits no such defaults (the user's `style.background` / `style.borderRadius` win via `buildBlockChromeCss`). Authoring-only chrome. |
| 6 | button | `<button\|a data-epx-block id class href? target? rel? type? {…linkCustomAttrs}>{iconSrc? <img src=resolveMediaUrl(…) style={width,height,color?}/>}<span>{text}</span></Tag>` (display:inline-flex, gap, flex-direction from iconPosition, text-decoration:none) | `<button type="button" style={{display:"inline-flex",flexDirection,…,padding:"8px 14px",background:#111827,color:#ffffff,borderRadius:"6px",fontSize:"13px",fontWeight:"500",cursor:"pointer"}}>{iconSrc? <img/>}<span>{text}</span></button>` | yes | Two intentional differences: **(a)** preview hardcodes `<button>` even when `linkHref` is set; frontend renders `<a>`. Click handling on canvas is owned by Canvas's overlay (drag handle, selection, etc.), so an `<a>` here would trigger a navigation when the user clicks to select. KISS. **(b)** preview hardcodes default visual chrome (background, color, padding, borderRadius, fontSize, fontWeight). Frontend emits these only when `style.*` is set. The default values match the F3.6.1 `defaultConfig.style` for buttons so the user sees a populated button immediately after drop, before configuring it. Once the user sets any of those keys, `buildBlockChromeCss` emits the override which CASCADES OVER the inline preview defaults (last-rule-wins because the inline style is `style="…"` and the chrome CSS is via `<style id="epx-canvas-block-css">`, but inline style normally wins specificity-wise — fortunately every `buildBlockChromeCss` declaration is unmarked, so the inline defaults persist for unconfigured keys, and the chrome CSS supplies any configured key on top via the cascade for keys not in the inline blob). |
| 7 | icon | `<div data-epx-block id class>{iconSrcUrl? <Tag(linkHref?"a":"span") href? target? rel?>{isSvg && iconColor ? <span class="epx-icon-svg" role="img"/> : <img src=resolveMediaUrl(…) style={width,height,transform,filter?}/>}</Tag>}</div>` (svgWrapperCss applies `mask:url(…)` + `background-color:` + opacity + transform when SVG+color path is taken) | `<div style={{display:"flex",justifyContent}}>{renderAsSvgMask ? <span role="img" style={{display,width,height,backgroundColor:hexToRgba(iconColor,iconColorAlpha),mask:url(…),transform}}/> : <img src style={{width,height,transform}}/>}</div>` | no — F3.6.6 fix | **Was**: preview rendered raw `<img>` with `color: <iconColor>` — `color` is a no-op on `<img>`, so SVG icons stayed in their native colors regardless of the user's color picker. Now mirrors Icon.astro's SVG-vs-PNG branch (CSS mask for SVG+color, plain `<img>` otherwise). Two intentional remaining differences: **(a)** no `<a>` link wrapper — same KISS reason as button. **(b)** preview applies `mask`/`background-color` inline; frontend emits them via the scoped `[data-epx-block="<id>"] .epx-icon-svg{…}` rule. Output equivalent. |
| 8 | html | `<iframe data-epx-block id class data-epx-html-frame={frameId} sandbox="allow-scripts allow-same-origin" scrolling="no" srcdoc={srcdoc} frameborder="0" style="display:block;width:100%;border:none;height:0;"/>` (also `<script is:inline>` for auto-resize). Iframe IS the `data-epx-block` element; chrome CSS targets the iframe directly. | `<iframe ref sandbox="allow-scripts allow-same-origin" scrolling="no" srcDoc={srcdoc} style={{display:"block",width:"100%",height,border:0,boxSizing:"border-box"}}/>` (auto-resize via `useEffect`) | partial — F3.6.6 partial fix | **Was**: preview style was `{width:"100%",height,border:0,display:"block"}`. F3.6.6 added `box-sizing:border-box` to match Html.astro's `iframeOverrideCss`. Intentional remaining differences: **(a)** the `data-epx-block` lives on Canvas's wrapper `<div>` (one element above the iframe) instead of on the iframe itself — duplicating the wrapper logic just for HTML to make the iframe IS the data-epx-block element would complicate Canvas's drag/select chrome. The downside is one extra wrapper div on canvas, harmless visually. **(b)** preview drops `flex:1 1 100%; align-self:stretch; min-width:0` from frontend's `iframeOverrideCss` — those keys defend against flex/grid parents on the host page; canvas's `epx-canvas-block-host` is always `display:block`, so they're no-ops. **(c)** preview's auto-resize is a `useEffect` (React); frontend's auto-resize is an inline `<script>`. Same observed-element set (`load`, `ResizeObserver`, `MutationObserver`, `<img load>`). |
| 9 | divider-spacer | `<div data-epx-block id class aria-hidden?>{dividerActive ? <…> : ''}</div>` where `<…>` = layout-matrix-driven combination of `<span class="epx-divider-line"/>` + `<span class="epx-divider-icon" role="img"/>` (SVG mask) or `<img class="epx-divider-icon-raw"/>` (PNG / SVG without color). Wrapper CSS sets `display:flex; flex-direction; align-items:center; justify-content; gap:8px; min-height:<space>` when divider active; `height:<space>; display:block` when not. | `<div style={{minHeight,display:"flex",flexDirection,alignItems:"center",justifyContent,gap:8}}>{layout-matrix}</div>` (or `<div style={{height:space}}/>` when no divider) | yes | Structural match — same SVG-mask vs `<img>` branch, same layout matrix, same gradient/wavy/zigzag SVG generation. Intentional differences: **(a)** preview renders `mask`/`background-color` inline; frontend uses scoped `.epx-divider-icon{…}`. **(b)** preview renders the line-style (wavy/zigzag/gradient/border) inline; frontend uses the scoped `.epx-divider-line{…}` rule. Output equivalent. |

### Drift fixes summary (F3.6.6)

Three unintentional drifts fixed:

1. **TextPreview** — was `<span>`, now `<Tag(htmlTag)>` with whitelist
   `[p, div, span, h1, h2, h3, h4, h5, h6]`. Headings now look heading-sized
   on canvas; paragraphs look paragraph-sized.
2. **IconPreview** — was raw `<img color=...>` (no-op on `<img>`). Now
   mirrors Icon.astro's SVG/PNG branch: `<span style="mask:url(...);
   background-color:...">` for SVG + `iconColor` set, plain `<img>`
   otherwise.
3. **HtmlPreview** — added `box-sizing:border-box` and `display:block` to
   the inline iframe style to match `Html.astro`'s `iframeOverrideCss`.
   The `flex:1 1 100%; align-self:stretch; min-width:0` keys remain
   absent on canvas — they're no-ops because `epx-canvas-block-host` is
   always `display:block`.

Six intentional differences documented above (container = dead code,
image URL = tracked debt, image figure-only outer, text-editor scope
class, video aspect-padding hack, button hardcoded defaults, html
data-epx-block placement).

Tests added: `tests/previewParity.test.ts` (14 cases: TextPreview tag
honoring, IconPreview SVG mask, HtmlPreview iframe sizing).

## v0.6+ — TextEditorPreview / HtmlPreview

- **TextEditorPreview** receives `activeBreakpoint` and bp-merges `dropCap`, `columns`, `columnsCustom`, `columnsGap` from `configBreakpoints[activeBreakpoint]`, plus drop-cap settings + paragraph spacing + link color from `styleBreakpoints[activeBreakpoint]`. Renders Portable Text via mini renderer (paragraph/heading/marks/image type) so canvas reflects actual formatting; no longer just plain text.
- **HtmlPreview** also renders inside iframe with `sandbox="allow-scripts allow-same-origin"`. Auto-resize via `useEffect` reads `iframe.contentDocument` after `load` + `ResizeObserver` + `MutationObserver` + img loads. Iframe collapsed to `0px` before measuring to defeat `vh`/`100%` body height feedback loops.

## Container Preview Pattern

```tsx
export function ContainerPreview({ config, children }: PreviewProps) {
  return (
    <div className="epx-container-preview" style={{ padding: "8px" }}>
      {children?.map((child) => {
        const ChildPreview = PREVIEW_COMPONENTS[child.type];
        if (!ChildPreview) return null;
        return (
          <ChildPreview
            key={child.id}
            config={child.config}
            children={child.children}
            slots={child.slots}
          />
        );
      })}
    </div>
  );
}
```

## How Canvas Uses Previews

Canvas looks up preview by `block.type`:

```tsx
const Preview = PREVIEW_COMPONENTS[block.type];
if (!Preview) return null;
return (
  <Preview
    config={block.config}
    children={block.children}
    slots={block.slots}
  />
);
```

## Styling Previews

Read theme/style from config:

```tsx
const bgColor = (config.style as Record<string, string>)?.backgroundColor || "transparent";
<div style={{ backgroundColor: bgColor }}>
```

Or use theme class:
```tsx
<div className={`theme-${(config.theme as string) || "light"}`}>
```

## TODO

- [ ] Create previews for all new blocks (1:1 with blockDefinitions additions):
  - HeroPreview
  - FeaturesGridPreview
  - ImageTextPreview
  - CtaPreview
  - StatsPreview
  - GalleryPreview
  - ColumnsPreview
  - HeadingPreview
  - ParagraphPreview
- [ ] Add preview CSS file (previews.css) for scoped preview styling
- [ ] Make previews respond to style changes (read from `config.style`)
- [ ] Test nested container preview rendering (3+ levels)
