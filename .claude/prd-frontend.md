# empixel-builder — Frontend Components (Astro)

## Role
Server-rendered Astro components that render blocks to HTML. Zero client-side JavaScript.

## Architecture

```
src/components/
├─ index.ts              # Exports: blockComponents map (12 entries), getBuilderLayout, LayoutRenderer, BuilderWrapper
├─ BlockRenderer.astro   # Leaf-block dispatcher (12 leaves)
├─ LayoutRenderer.astro  # Iterates sections; routes containers to SectionContainer, leaves to BlockRenderer
├─ SectionContainer.astro # container block (renders children, handles layout/video/link)
├─ BuilderWrapper.astro  # Wrapper for builder-enabled pages
├─ styleUtils.ts         # CSS generation from block config (selector-based)
├─ db.ts                 # getBuilderLayout() database query
├─ Text.astro            # text block
├─ Image.astro           # image block
├─ TextEditor.astro      # v0.6 — Portable Text via emdash/ui (lazy import, plain-text fallback)
├─ Video.astro           # v0.6 — YT/Vimeo/HTML5 embed + image overlay click-to-play
├─ Button.astro          # v0.6 — <a> | <button>, icon flex order
├─ Icon.astro            # v0.6 — SVG mask color or <img> for PNG, optional rotate + drop-shadow filter
├─ Html.astro            # v0.6 — raw set:html (trusted input, not sanitized)
└─ DividerSpacer.astro   # v0.6 — fixed-height block + optional decorative divider (solid/dashed/.../wavy/zigzag/gradient)
```

## blockComponents map (index.ts)

```ts
export const blockComponents: Record<string, unknown> = {
  text: Text,
  image: ImageBlock,
  "text-editor": TextEditor,
  video: Video,
  button: Button,
  icon: Icon,
  html: Html,
  "divider-spacer": DividerSpacer,
};
```

Every leaf `BlockType` must have an entry here. `container` is rendered by `SectionContainer.astro` directly (not via `blockComponents`).

## LayoutRenderer (root)

Iterates `layout.sections`. Containers go through `SectionContainer.astro` (which handles its own children recursively); leaves go to `BlockRenderer`.

### CSS coalescing — single `<style>` per page (F4.1)

Pre-F4.1 every leaf block component emitted its own
`<style is:global>` at template position; a 30-block page shipped
30+ inline `<style>` tags, each repeating its own `@media` block.
F4.1 collapses the lot into **one** coalesced `<style>` per page.

Mechanism:
1. `LayoutRenderer.astro` initialises `Astro.locals.empixelLayoutCss = []`
   in its frontmatter, BEFORE any children render. The plugin-scoped
   reset (the rule that used to be emitted as its own `<style>` —
   see "Plugin-scoped reset (F1.3)" below) is the first entry pushed
   into the array, so it ends up at the very top of the coalesced
   bundle.
2. Each block component (`Text.astro` / `Image.astro` /
   `Button.astro` / `Icon.astro` / `Video.astro` / `Html.astro` /
   `DividerSpacer.astro` / `TextEditor.astro` /
   `SectionContainer.astro`) computes its CSS string the same way it
   used to, but **pushes** the string into
   `Astro.locals.empixelLayoutCss` in its frontmatter instead of
   emitting a `<style is:global>` JSX expression at template
   position. The push is gated on the array being initialised
   (`Array.isArray(epxLocals.empixelLayoutCss)`) so a block rendered
   outside a `LayoutRenderer` (test fixture, manual usage) silently
   degrades — no crash, no duplicate `<style>`, just the missing
   rule. (This shouldn't happen in practice — the public surface
   only renders blocks via `LayoutRenderer`.)
3. After the `{sections.map(...)}` expression returns,
   `LayoutRenderer` reads `Astro.locals.empixelLayoutCss`, runs it
   through `coalesceLayoutCss(strings)` (see `styleUtils.ts`), and
   emits a single `<style is:global>` whose body is the coalesced
   bundle. Astro semantics: child component frontmatter executes
   synchronously when the parent template encounters the component,
   so by the time the parent's later JSX expressions evaluate the
   array is fully populated. Astro creates a fresh `Astro.locals`
   per request, so the array is naturally request-scoped — no
   cleanup needed.

`coalesceLayoutCss(strings)` (in `styleUtils.ts`) is the merge step:
- Concatenates all input strings.
- Walks the buffer at top-level brace depth — each chunk is either a
  bare rule (`<selector> { … }`) or an `@media (...) { … }` block.
- Bare rules accumulate into a base-rules string in input order
  (cascade-preserving).
- `@media` blocks bucket by trimmed query string. Two blocks
  emitting `@media(max-width:992px){…}` and `@media (max-width: 992px) {…}`
  merge into the same bucket — query is `(max-width:992px)` after
  trim (no internal whitespace fold; CSS is whitespace-tolerant
  inside parens anyway). The bucket's body is the concatenation of
  all matching `@media` bodies in input order.
- Output: base rules first, then `@media${query}{merged-body}` per
  unique query in first-seen insertion order.

Plugin-emitted CSS is predictable: every helper above
(`buildBlockCss`, `buildHoverCss`, `buildBreakpointCss`,
`buildBreakpointHoverCss`, `getCustomCss`, plus the per-component
scoped rules like `Image.astro`'s `epx-img-frame` flex,
`SectionContainer.astro`'s video controls override, etc.) emits flat
rules and at most one level of `@media` nesting. Nested at-rules
(`@supports` / `@layer` / `@container`) are not emitted, so a
regex-driven scan with brace-depth tracking is sufficient — no full
CSS parser needed (KISS).

**Result.** A 5-block page emits exactly 1 `<style>` tag (was 5+).
A 30-block page emits exactly 1 `<style>` tag (was 30+). Each
unique breakpoint opens exactly one `@media` block instead of one
per block × per bp.

### Plugin-scoped reset (F1.3)

Before any block-specific CSS, the coalesced bundle starts with a
minimal reset scoped to `[data-epx-block]` (and its descendants):

```
[data-epx-block]{box-sizing:border-box;margin:0;}
[data-epx-block] *,[data-epx-block] *::before,[data-epx-block] *::after{box-sizing:border-box;}
```

Why: many host themes ship a global `* { box-sizing: border-box }` plus
margin/padding resets that bleed into plugin blocks (`<figure>`, `<button>`,
`<a>`, etc.) and produce inconsistent visual output across sites. The
plugin defends itself with its own predictable starting point. The reset
lives in the layout root — not in each block component — so it ships once
per rendered page rather than N copies for N blocks. It is **skipped when
`sections.length === 0`** so empty layouts stay zero-emit. F4.1 folded
it into the F4.1 coalesced bundle so the reset + every block's CSS ship
under one `<style>` tag instead of two.

```astro
---
import type { SectionBlock } from "../types.js";
import BlockRenderer from "./BlockRenderer.astro";
import SectionContainer from "./SectionContainer.astro";

interface Props { sections: SectionBlock[]; }
const { sections } = Astro.props;
---
{sections.map((block) => block.type === "container"
  ? <SectionContainer value={block.config} children={block.children ?? []} blockId={block.id} />
  : <BlockRenderer block={block} />
)}
```

## BlockRenderer (leaf dispatcher)

Routes to the correct Astro component by `block.type`. Builds CSS via `buildBlockCss` / `buildHoverCss` / `getCustomCss` and injects a single global `<style>` block.

- `text` → `<Text value={block.config} blockId={block.id} />`
- `image` → `<ImageBlock value={block.config} blockId={block.id} />`

## SectionContainer.astro

Owns the full container rendering pipeline:
- Spreads `value.style` straight through `buildBlockStyle` — no template-level
  spacing fallback. Legacy `none/sm/md/lg/xl` values for padding/margin are
  inline-resolved by `styleUtils.ts § normalizeLegacySpacing` (F3.6.4 — see
  "Legacy symbolic-spacing inline resolve" below). The post-hoc
  `paddingCss` / `styleWithoutPadding` regex dance and the local
  `spacingMap` / `resolveSpacing` helpers were retired in F3.6.4.
- Renders flex or grid layout (mode from `value.layout`)
- Composes block CSS via `wrapBlockCss(buildBlockStyle + layoutStyle, blockId)`
- Renders hover, breakpoint, breakpoint-hover, and custom CSS in a single `<style is:global>`
- Renders video backgrounds: HTML5 `<video>`, YouTube iframe, Vimeo iframe (with start/end time, loop, fallback poster)
- HTML tag from `value.htmlTag` (default `section`); when tag = `a`, applies `linkHref`/`linkTarget`/`linkRel` and parses `linkCustomAttr`
- Recursively renders children — nested containers re-enter via `<Astro.self>`

## Block Component Pattern (leaves)

```astro
---
import type { TextConfig } from "../types.js";
import { buildBlockChromeCss } from "./styleUtils.js";
import { resolveMediaUrl } from "./media.js";

interface Props { value: TextConfig; blockId?: string; }
const { value, blockId } = Astro.props;
const Tag = ((value.htmlTag || "p") as astroHTML.JSX.HTMLTag);

const config = value as Record<string, unknown>;
const resolver = (key: string) => resolveMediaUrl(key, { locals: Astro.locals });
const allCss = buildBlockChromeCss(config, blockId, { resolveMediaUrl: resolver });

// F4.1 — push per-block CSS into the shared layout buffer; LayoutRenderer
// drains, coalesces, and emits exactly one <style> per page.
const epxLocals = Astro.locals as unknown as { empixelLayoutCss?: string[] };
if (allCss && Array.isArray(epxLocals.empixelLayoutCss)) {
  epxLocals.empixelLayoutCss.push(allCss);
}
---

<Tag data-epx-block={blockId}>{value.content}</Tag>
```

### Props Pattern Rules
- Leaves take `{ value: ConfigType, blockId?: string }` (not the full `SectionBlock`)
- Container takes `{ value, children, blockId }`
- `data-epx-block="<id>"` is the canonical CSS hook on the root element
- All CSS is **selector-based**, pushed into
  `Astro.locals.empixelLayoutCss` (F4.1) — `LayoutRenderer.astro` emits one
  coalesced `<style is:global>` per page. Block components never emit
  their own `<style>` element. (Pre-F4.1 they did.)

## Nested Rendering

### Container
Handled by `SectionContainer.astro` — recurses via `<Astro.self>` for nested containers.

### Image block
Renders as `<figure>` (when caption present) or `<a>` (when link present, no caption) or `<div>`. Inner `<img>` carries `imgStyle` inline plus visual CSS (border/radius/shadow) from `buildImgVisualCss` scoped to `[data-epx-block="<id>"] img{…}`.

## Style Utilities (styleUtils.ts)

All exports return CSS **strings** (selector-based rules), not inline declarations. Caller is responsible for wrapping them in `<style is:global>`.

| Function | Purpose |
|----------|---------|
| `buildBlockStyle(config, opts?)` | Inline-ready CSS body (no selector) for the block — combines background, border, text color, all `STYLE_PROPS`, box-shadow, text-stroke, text-shadow, position/offset, z-index, opacity, auto `overflow:hidden` heuristic |
| `buildBlockCss(config, blockId, opts?)` | Same as above wrapped in `[data-epx-block="<id>"]{…}` |
| `wrapBlockCss(styleStr, blockId)` | Selector wrapper helper |
| `buildBackgroundCss(style)` | Color / gradient / image / slideshow background CSS (video handled separately) |
| `buildHoverCss(config, blockId, opts?)` | `:hover` selector with `!important` declarations from `styleHover` |
| `buildBreakpointCss(config, blockId, layoutSelector?)` | Media-query rules from `styleBreakpoints` (visual props on root, layout/gap props on `layoutSelector`) |
| `buildBreakpointHoverCss(config, blockId)` | `@media + :hover` rules from `styleHoverBreakpoints` |
| `buildImgVisualCss(config, blockId)` | `[data-epx-block="<id>"] img{…}` — border/radius/shadow scoped to inner `<img>` |
| `buildImgVisualHoverCss(config, blockId)` | Same as above for `:hover img` |
| `getEffectiveStyle(config)` | Returns `config.style` (light variant). Dark emits as a separate scoped rule via `buildDarkBlockStyle`. |
| `getVideoBackground(config)` | Resolves video URL from storage key or external URL |
| `getVideoInfo(config)` | Detects YouTube / Vimeo / HTML5 from URL pattern |
| `buildYouTubeEmbedUrl(id, opts)` / `buildVimeoEmbedUrl(id, opts)` | Embed URL construction with autoplay/mute/loop/start/end |
| `getBlockId(config)` / `getBlockClass(config)` | Reads `advanced.cssId` / `advanced.cssClasses` |
| `getCustomCss(config, blockId)` | Wraps `advanced.customCss` in `[data-epx-block="<id>"]{…}` |
| `coalesceLayoutCss(strings)` (F4.1) | Merges per-block CSS strings into one bundle. Groups identical `@media` queries (each breakpoint opens exactly one `@media` block instead of one per block × per bp). Base rules emit first in input order; `@media` blocks emit in first-seen-query order. Whitespace-tolerant on query strings. Powers `LayoutRenderer.astro`'s single-`<style>` emission. |
| `buildBlockChromeCss(config, blockId, opts?)` — memoized (F4.2) | Wraps the underlying chrome builder in an in-process LRU (capacity 500). Cache key fingerprint is `JSON.stringify(config) + "\|" + blockId + "\|" + (opts.imgScoped ? "1" : "0")`. On hit, the cached string is returned and the entry is reinserted at the tail (LRU). The wrap **falls through to the direct call when `opts.resolveMediaUrl` is set** because the resolver is a closure built per-request from `Astro.locals` — structurally-identical configs would still need different resolved URLs, and `JSON.stringify` cannot fingerprint a function. Test-only `_resetBuildBlockChromeCssCache()` / `_buildBlockChromeCssCacheSize()` are exported for unit coverage. |

### `buildBlockChromeCss` memoization (v0.9.7 — F4.2)

`buildBlockChromeCss` runs five sub-helpers (block / hover / per-bp /
per-bp-hover / customCss) plus the optional img-scoped pair on every
render of every block in the layout. The output is deterministic per
`(config, blockId, opts)`, so F4.2 wraps the helper in an LRU `Map`:

- **Capacity** — 500 entries. Eviction on overflow drops the
  insertion-order head; on a hit, `delete` + `set` reinserts at the
  tail so insertion order tracks recency.
- **Fingerprint** —
  `${JSON.stringify(config)}|${blockId}|${opts?.imgScoped ? "1" : "0"}`.
  `JSON.stringify(config)` is the dominant cost of the key build
  but is still cheaper than running all five sub-helpers (each of
  which runs its own nested `JSON.stringify` on `styleBreakpoints`).
- **Skip path — `opts.resolveMediaUrl` set.** The resolver is a
  closure built per-request from `Astro.locals` and is non-fingerprintable
  by `JSON.stringify`. Memoizing across requests would silently
  serve a different host's resolved URL. KISS: when a resolver is
  passed, the wrap calls the direct builder unconditionally. Astro
  pages typically only call the helper once per block per request
  anyway.
- **Behaviour invariants** — output is byte-identical to the
  unmemoized v0.9.6 helper. The wrap is purely a performance lever;
  no public-API change.

## Database Query (db.ts)

### getBuilderLayout — v0.9 (F3.4 + F3.5 + fix/F3.4-backcompat-3arg)
```ts
export interface BuilderLayoutContext {
  locals?: {
    emdash?: {
      db?: unknown; // Kysely instance from Astro.locals.emdash.db
      getPublicMediaUrl?: (storageKey: string) => string | undefined;
    };
  };
}

export interface BuilderLayoutResult {
  sections: SectionBlock[] | null;
  cacheHint: { tags?: string[]; lastModified?: Date };
}

// Polymorphic — accepts both call shapes.
export function getBuilderLayout(
  collection: string,
  entryId: string,
  enabled?: boolean,
): Promise<BuilderLayoutResult>;
export function getBuilderLayout(
  astro: BuilderLayoutContext, // Astro itself, or any { locals } shape
  collection: string,
  entryId: string,
  enabled?: boolean,
): Promise<BuilderLayoutResult>;
```

**Async + polymorphic over two call shapes** (post-fix/F3.4-backcompat-3arg):

- **4-arg (recommended)** — `getBuilderLayout(astro, collection, entryId, enabled?)`.
  The F3.4 shape. `astro` is `Astro` itself or any
  `BuilderLayoutContext`. Resolves the Kysely handle through
  `Astro.locals.emdash.db` first, then falls back to `getDb()` from
  `emdash/runtime`. Hosts that want `Astro.cache.set(cacheHint)`
  plumbing should pick this shape — only the 4-arg form has the
  `Astro` to call into.
- **3-arg legacy** — `getBuilderLayout(collection, entryId, enabled?)`.
  The pre-F3.4 / v0.8 signature. Host pages scaffolded by older
  `npx empixel-builder add` runs (and any host pinned to v0.8, e.g.
  Novapera at the time of writing) still emit this shape. The reader
  resolves the Kysely handle exclusively through `getDb()` from
  `emdash/runtime` — there's no `Astro.locals` to consult — and
  returns the same `Promise<BuilderLayoutResult>`. The `cacheHint` is
  still computed and returned, but the legacy host-page frontmatter
  doesn't pass it to `Astro.cache.set` (the wrapper has no `Astro` to
  call into). Updating to the 4-arg form is recommended but not
  required.

Both shapes return `Promise<BuilderLayoutResult>`. `BuilderWrapper.astro`
accepts both the resolved value and the unawaited Promise on its
`sections` prop, so `<BuilderWrapper sections={getBuilderLayout(...)}>`
works without an explicit `await` at the page level under either
signature.

**Migration story.** Hosts upgrading from v0.8 to v0.9 don't have to
edit their pages — the 3-arg call keeps working and renders builder
content correctly. Adopting the 4-arg form is optional and only
necessary if you want `Astro.cache.set` plumbing through
`BuilderWrapper` (the wrapper auto-plumbs the cacheHint when the
result lands on its `sections` prop).

Read path (post-F3.5 — storage-only, with the post-fix/F3.4-frontend-empty handle resolution):

1. **Storage path (only).** The reader queries the shared
   `_plugin_storage` table partitioned under
   `plugin_id = "empixel-builder" AND collection = "layouts"` — the
   same partitioning EmDash's internal `PluginStorageRepository` uses
   for the typed `ctx.storage.layouts` handle. Rows live there once
   F3.2 (route handlers) and F3.3 (one-shot migration) ship.
   `PluginStorageRepository` itself is not exported from `emdash`
   today, so the frontend reader queries the table directly via
   Kysely. The lookup uses the **canonical composite doc id**
   `${collection}::${entryId}` (mirrored locally from
   `src/plugin.ts § layoutDocId` — the same key the plugin runtime
   writes rows under). Single-row deterministic — no scan, no
   orphan-row collision.
2. **Kysely handle resolution.** `Astro.locals.emdash.db` first
   (present on authenticated/admin requests). When it's absent —
   which is the common case on anonymous public page renders, since
   the EmDash middleware short-circuits the locals payload to
   `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }`
   for non-authenticated requests — the reader falls back to
   `getDb()` from `emdash/runtime`, the public accessor for the same
   singleton EmDash uses internally. Without the runtime fallback,
   builder-enabled host pages would render the host theme's static
   template instead of builder content (the bug fixed by
   `fix/F3.4-frontend-empty`).
3. **No legacy fallback.** F3.5 dropped the legacy
   `empixel_builder_layouts` SQLite read path together with
   `src/dbShared.ts` and the `better-sqlite3` peer dependency. Hosts
   on a pre-0.9 EmDash that exposes neither `locals.emdash.db` nor
   `getDb()` get `{ sections: null, cacheHint }` — the page renders
   without a layout but the cache tag is still emitted so a future
   EmDash upgrade busts cleanly. The plugin runtime's lazy
   `runMigrationToStorageV1` migration takes care of copying any
   legacy SQLite rows into `ctx.storage.layouts` on the first request
   after upgrade, so by the time host pages render the storage side
   is populated.

Returns `{ sections, cacheHint }` (v0.8 — F2.4 contract preserved);
`sections` is `null` when no row, builder disabled, input rejected, or
neither `locals.emdash.db` nor the `emdash/runtime` `getDb()` accessor
yields a Kysely instance. The `cacheHint.tags` always carries
`empixel:layout:<collection>:<entryId>` so admin saves can invalidate
the host page by tag. `cacheHint.lastModified` is parsed from the
storage row's `updatedAt`; skipped when no row exists or parsing
fails. The hint is returned on every code path so host pages can call
`Astro.cache.set(cacheHint)` unconditionally.

The `BuilderLayoutContext` interface is purposefully a structural
subset of Astro: tests mock the `db` handle with a tiny stub, and a
non-Astro consumer (e.g. a custom render path inside an EmDash
plugin) can build the same context from any source that exposes
the Kysely instance. Production passes `Astro` directly.

#### `BuilderWrapper.astro` — automatic cacheHint plumbing (F2.4)

`BuilderWrapper` accepts the full `BuilderLayoutResult` (or the legacy
`SectionBlock[] | null` shape for backwards compatibility) on its
`sections` prop. When passed the result object it calls
`Astro.cache.set(cacheHint)` itself, so the host page only writes:

```astro
---
import { getBuilderLayout, BuilderWrapper } from "empixel-builder/astro";
const builderLayout = getBuilderLayout("posts", post.data.id, post.data.empixel_builder);
---

<BuilderWrapper sections={builderLayout}>
  <slot />
</BuilderWrapper>
```

Manual (non-wrapper) consumers destructure and call set themselves —
see README's "Caching builder layouts" section for both patterns.

## Image Fields

Image fields are `ImageMediaRef` objects: `{ id, storageKey, alt?, filename? }`.

To turn a `storageKey` into a fetchable URL, use `resolveMediaUrl` from
`empixel-builder/components` (or `./media.js` from inside the package):

```astro
---
import { resolveMediaUrl } from "./media.js";
const src = resolveMediaUrl(image?.storageKey, { locals: Astro.locals });
---
<img src={src ?? undefined} alt={image?.alt ?? ""} />
```

The host's storage adapter (`local()` / `s3()` / `r2()` / …) determines the
final URL. Never construct `/_emdash/api/media/file/<key>` by hand — that
pattern only works for the local-runtime adapter and is the exact bug F2.2
fixes. See "Storage-agnostic media URL resolution (F2.2)" above.

EmDash also ships an `<Image image={...} />` component in `emdash/ui` for
fields shaped as the EmDash `MediaValue` type (`{ id, src, meta?, … }`).
Plugin layouts persist the older `ImageMediaRef` shape (no `src`/`meta`),
so swapping `<img>` for `<Image>` directly would require a normalization
pass. Pending that, every block component uses raw `<img>` driven by
`resolveMediaUrl` — same end result, fewer moving parts.

Never use raw hand-built `/_emdash/api/...` URLs. Never assume image is a string.

## Props Flow (Page → Blocks)

```astro
---
// Recommended (4-arg form, v0.9 — F3.4):
import { getBuilderLayout, LayoutRenderer } from "empixel-builder/components";

const { sections, cacheHint } = await getBuilderLayout(
  Astro,
  collection,
  entry.data.id,
  entry.data.empixel_builder,
);
Astro.cache.set(cacheHint);
---

{sections && <LayoutRenderer sections={sections} />}
```

```astro
---
// Legacy 3-arg form (still supported post-fix/F3.4-backcompat-3arg —
// hosts pinned to the v0.8 shape don't have to migrate):
import { getBuilderLayout, BuilderWrapper } from "empixel-builder/components";
const builderLayout = getBuilderLayout(
  collection,
  entry.data.id,
  entry.data.empixel_builder,
);
---
<BuilderWrapper sections={builderLayout}>
  <slot />
</BuilderWrapper>
```

(Or use `<BuilderWrapper sections={getBuilderLayout(Astro, collection, entry.data.id, entry.data.empixel_builder)}>`
and skip both the explicit `await` and the manual
`Astro.cache.set` call — the wrapper accepts the unawaited Promise,
resolves it, and plumbs the hint automatically.)

## BuilderWrapper

Wraps a host page so the builder layout (when present) replaces the
page's normal `<slot />` content. Pass the value returned by
`getBuilderLayout` (or the unawaited Promise — see below) and the wrapper:

1. Renders `<LayoutRenderer sections={…}>` when sections exist.
2. Renders `<slot />` (the host page's normal content) when no layout
   exists or the builder is disabled for the entry.
3. Calls `Astro.cache.set(cacheHint)` itself so admin saves bust the
   host page's cache by tag — no manual call needed.

Three accepted shapes for the `sections` prop:

- `BuilderLayoutResult` — the resolved value of v0.9 (F3.4)
  `getBuilderLayout` AND the direct return of v0.8. Hosts that `await`
  the call and pass the result land here.
- `Promise<BuilderLayoutResult>` — convenience for hosts that omit the
  `await`. The wrapper resolves it for you. New scaffolds default to
  this shape so the host page never needs explicit `await`.
- Legacy `SectionBlock[] | null` — pre-v0.8 frontmatter from older
  `npx empixel-builder add` scaffolds. No `cacheHint` is plumbed because
  the legacy shape never carried one. Update to the new shape to wire
  caching correctly.

## Rules

- All components are **server-rendered** (no client JS, no `client:*` directives) — except a tiny inline `<script>` in `SectionContainer.astro` for HTML5 video start/end time control
- **Image fields** for the image block are `ImageMediaRef` objects with `storageKey`. URLs are produced by `resolveMediaUrl(key, { locals: Astro.locals })` from [`src/components/media.ts`](../src/components/media.ts) — never hand-built (see "Storage-agnostic media URL resolution (F2.2)" below).
- **Use `buildBlockChromeCss(config, blockId, opts)`** to compute the per-block CSS string, then **push it into `Astro.locals.empixelLayoutCss`** (F4.1). `LayoutRenderer.astro` emits exactly one `<style is:global>` per page. Block components never emit their own `<style>` element. Inline `style=""` is only for runtime overrides like image `imgStyle`.
- **Use `data-epx-block` attribute** on root element of each block
- **No duplicate logic** between admin previews and frontend components
- **Cache pages** that query layouts (`Astro.cache.set(cacheHint)`)

## Storage-agnostic media URL resolution (F2.2)

EmDash core does NOT hardcode a single storage backend. Sites can configure
`local()` (default), `s3()`, `r2()`, or any other adapter that implements
the storage interface; URLs differ across adapters. The plugin therefore
must NOT build `/_emdash/api/media/file/<key>` by hand — that path only
exists for the local-runtime adapter. Section 5 Q3 / Section 4 T4 of
`raport-empixel-emdash.html` calls this out as a P0 portability bug.

EmDash exposes a synchronous URL builder on the request locals:

```
Astro.locals.emdash.getPublicMediaUrl?(storageKey: string): string
```

The `resolveMediaUrl` helper (re-exported as
`empixel-builder/components`) wraps this:

```ts
export function resolveMediaUrl(
  key: string | undefined | null,
  opts?: { locals?: { emdash?: { getPublicMediaUrl?: (k: string) => string | undefined } } },
): string | null;
```

- `null` only when `key` is falsy.
- Adapter-resolved URL when `Astro.locals.emdash.getPublicMediaUrl` is wired.
- Otherwise falls back to the legacy `/_emdash/api/media/file/<key>` URL
  (with `encodeURIComponent`) so transitional setups don't break.

### Sync-vs-async decision in `styleUtils.ts`

`styleUtils.ts` is the only place that consumes a `storageKey` *during CSS
generation* (rather than from a single Astro frontmatter field). Two paths
are involved:
- `style.backgroundImageStorageKey` — image background URL embedded in
  `background-image:url(...)`.
- `backgroundSlides[*].storageKey` — first slide URL for slideshow.
- `style.backgroundVideoMediaStorageKey` — video src for `getVideoBackground`
  / `getVideoInfo`.

Making these helpers `async` would force every `*.astro` consumer to `await`
them and would cascade into the canvas (admin) which calls the same helpers
synchronously inside React render. KISS: keep the helpers **sync** and pass
a sync `resolveMediaUrl: (key) => string | null` callback through the opts
bag (`MediaUrlOptions`). Astro components build the closure from
`Astro.locals` once at the top of the frontmatter and thread it via
`buildBlockChromeCss(cfg, blockId, { resolveMediaUrl: resolver })`. When no
resolver is supplied (e.g. a unit test), the helpers fall through to the
legacy local route via the same `resolveMediaUrl` shipped in `media.ts` —
behavior is byte-identical to pre-F2.2 for hosts on the local adapter.

This was Option (b) from the F2.2 spec ("resolve URLs upfront at the call
site and pass them in"). The single threading point is `MediaUrlOptions`,
re-used by `buildBackgroundCss`, `buildBlockStyle`, `buildDarkBlockStyle`,
`buildBlockCss`, `buildHoverCss`, `buildBlockChromeCss`,
`getVideoBackground`, and `getVideoInfo`. `buildBreakpointCss` /
`buildBreakpointHoverCss` do NOT consult backgrounds, so they don't need
the option.

## v0.7 — Theme model

The `theme` field in a block's config is **purely an authoring marker** —
it tracks which variant the author was last editing in the canvas via
ThemeStyleToggle. Frontend rendering does NOT consult `config.theme`;
it always emits BOTH variants:

- light: `[data-epx-block="<id>"]{...config.style...}`
- dark (only if `config.styleDark` has any entry): one rule under the
  universal compound selector returned by `darkBlockSelector(blockId)` —
  see the "Universal dark selector (F1.2)" section below.

The host site is expected to flip a dark-mode signal on `<html>` (or
`<body>`) using whatever convention it prefers. The cascade then
promotes every block's dark variant. No re-render needed.

The compound selector also matches when `data-theme="dark"` is on the
block element itself — used by Canvas (admin) so the ThemeStyleToggle
preview can show one block in dark while the rest stay light.

Hover and per-breakpoint variants are theme-independent (one set of
hover / breakpoint declarations applies to both modes; further per-theme
overrides are not supported at this time).

### Universal dark selector (F1.2)

EmDash core does **not** enforce a single dark-mode convention on host
sites — different theme authors pick different idioms (Tailwind class,
HTML data-attribute, body data-attribute, etc.). The plugin must adapt
to all of them simultaneously rather than ask each host to standardise
on one. Rationale: Section 5 Q4 of `raport-empixel-emdash.html` — the
plugin adapts to the host, never the reverse.

`darkBlockSelector(blockId)` therefore emits a single compound selector
with a `:is(...)` ancestor list that covers the five common cases. For a
block with id `<id>` the selector is:

```
:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="<id>"],
[data-epx-block="<id>"][data-theme="dark"]
```

Cases covered:

1. `html.dark` — Tailwind / Novapera class-based switch.
2. `html[data-theme="dark"]` — `<html>` element carrying the attribute.
3. `[data-theme="dark"]` — any ancestor (e.g. `<body>`) with the attribute.
4. `[data-mode="dark"]` — EmDash admin convention (used by canvas chrome).
5. Self-on-the-block — `[data-epx-block][data-theme="dark"]`, set by the
   canvas so ThemeStyleToggle can preview one block in dark while
   siblings stay light.

`:is(...)` keeps specificity uniform regardless of which clause matches,
so author overrides in `customCss` cascade predictably. The dark variant
fires whenever any of the five matches, with no host-side configuration
required by the plugin user.

## Legacy symbolic-spacing inline resolve (F3.6.4)

Pre-F3.6 layouts persisted padding/margin as symbolic strings —
`"none"`, `"sm"`, `"md"`, `"lg"`, `"xl"` — which `SectionContainer.astro`
translated to px at render time via a local `spacingMap` +
`resolveSpacing` helper. F3.6 onwards the canvas writes concrete px
(e.g. `"12px"`), so the symbolic vocabulary is dead at write time. F3.6.4
retires it at read time too:

1. **Data migration (Agent A)** — `runMigrationLegacySpacingV1` rewrites
   stored values forward on first request after upgrade, lazily-gated by a
   KV flag (same one-shot pattern as `runMigrationToStorageV1`). Once it
   runs, no row in `_plugin_storage` carries a symbolic spacing value
   anymore.
2. **Inline-resolve in `styleUtils.ts` (Agent B — this section)** — the CSS
   builder defends the brief upgrade-to-migration window. Without this
   defence, rows where `style.paddingTop = "md"` would render with literal
   `"md"` as the CSS value (browser ignores → padding 0, silent visual
   regression).

**Decision (a vs b).** Two approaches were considered: (a) inline-resolve in
`styleUtils.ts` so the CSS builder is the single normalisation point;
(b) drop the fallback entirely and rely on Agent A's migration. Approach
(a) was chosen because the migration window is real and the plumbing is
small — one helper plus a prop-set gate inside the existing STYLE_PROPS
loop. The cost is one extra function call per spacing key per render;
the benefit is that any future caller of `buildBlockCss` /
`buildBlockChromeCss` (admin Canvas in F3.6.3, host pages, tests)
inherits the fallback automatically without needing to re-implement it.

**Mechanism.**
- `LEGACY_SPACING_MAP = { none:"0", sm:"32px", md:"48px", lg:"64px", xl:"96px" }`
  — verified against the original `spacingMap` in `SectionContainer.astro`
  pre-F3.6.4 (these are the canonical values; the migration uses the same
  table).
- `LEGACY_SPACING_PROP_SET` — padding{Top,Right,Bottom,Left} +
  margin{Top,Right,Bottom,Left}. Restricted to padding+margin so
  non-spacing keys don't get accidentally rewritten (an author who typed
  `none` into a `width` field, however unlikely, sees `width:none` not
  `width:0`).
- Public export: `normalizeLegacySpacing(value: string): string` —
  returns the input unchanged unless it matches a legacy key.
- Internal helper `spacingCssStr(v)` = `cssStr(v)` then
  `normalizeLegacySpacing`. Called inside `buildStyleBodyFromObject`'s
  STYLE_PROPS loop and `buildBreakpointCss`'s BP_VISUAL_PROPS loop, gated
  on the prop being in `LEGACY_SPACING_PROP_SET`. BP_VISUAL_PROPS doesn't
  currently include padding/margin, so the gate is a forward-compatibility
  measure — if a future change adds spacing to per-breakpoint visuals,
  the legacy fallback travels with it.

**SectionContainer cleanup.** The local `spacingMap` /
`resolveSpacing` helpers were removed. The post-hoc
`paddingCss` / `styleWithoutPadding` regex dance — which existed only
because `buildBlockStyle` and the local resolver were emitting
overlapping declarations — is also gone. The frontmatter now just
spreads `value.style` through the standard `buildBlockStyle(value, opts)`
call. Single source of truth for spacing CSS lives in `styleUtils.ts`.

## v0.6+ — frontend updates

- **Block removal: testimonials / faq / pricing (variant B, no migration)** —
  These three section-level blocks were removed after the audit. No DB
  migration ran; layouts that still contain entries of those types load
  without error but render nothing on the frontend (no matching dispatch
  in `BlockRenderer.astro`) and show "Unknown block" in the canvas. Re-saving
  the layout drops the orphan entries.
- **Single render path for all blocks (audit H2)** — `BlockRenderer.astro`
  no longer splits between an inline conditional path and a
  `LEAF_COMPONENTS` map + bespoke wrapper. Every block component is
  self-contained: it picks its own semantic root tag (`<p>` / `<button>` /
  `<iframe>` / etc.), sets `data-epx-block` and `advanced.cssId` /
  `advanced.cssClasses` on that root, and emits the full CSS bundle
  (block + hover + breakpoint + breakpoint-hover + custom) via the
  `buildBlockChromeCss(config, blockId, opts?)` helper from `styleUtils.ts`.
  Text and Image — previously skipping `buildBreakpointCss` /
  `buildBreakpointHoverCss` — now get parity with every other leaf via the
  helper.
- **HTML block** rendered inside a sandboxed iframe with `srcdoc` (`sandbox="allow-scripts allow-same-origin"`, `scrolling="no"`) so site CSS doesn't cross in and the block's `<style>`/`<script>` doesn't leak out. If user code already has `<html>`, srcdoc reuses it; else minimal shell wraps the fragment. Auto-resize via parent script (idempotent global flag) reads `iframe.contentDocument.documentElement.scrollHeight` after `load` + `ResizeObserver` + `MutationObserver` + img loads + 100ms polling for first 2s. Iframe collapsed to `0px` before measurement to neutralize `vh`/`100%` body height feedback. Iframe IS the `data-epx-block` element (no wrapper `<div>`); inline style + global rule force `width: 100%; border: none` regardless of flex/grid parent.
- **Text Editor block** (`TextEditor.astro`) emits per-breakpoint media queries by walking the union of `configBreakpoints` + `styleBreakpoints` for `column-count`, `column-gap`, and `::first-letter` rule (drop cap toggle + size/lines/margin-right). Image inserts inside PortableText render via custom `components.type.image` → [PortableTextImage.astro](../src/components/PortableTextImage.astro) which builds the URL from `node.asset.storageKey` / `node.storageKey` / `node.url`. Renderer pulled from `emdash/ui` lazily; falls back to plain text when unavailable.
- **`getCustomCss(config, blockId)`** in `styleUtils.ts` substitutes the `selector` keyword (`/\bselector\b/g`) with `[data-epx-block="<id>"]`. If user CSS contains `{` it's emitted as-is (full rules with selectors); else it's wrapped as bare declarations under the block's selector. Powers the Custom CSS editor + the same on canvas (Canvas.tsx walks tree and injects via `<style id="epx-canvas-custom-css">`).
- **Text shadow** on canvas + frontend now defaults missing `textShadowColor` to `#000000` (was inheriting `currentColor` → white-on-dark).
- **Image.astro** defensive guard — `value = rawValue ?? {}` so undefined props (e.g. PortableText image slot) don't throw at frontmatter destructure.

## v0.6 styleUtils additions

- `STYLE_PROPS` and `BP_VISUAL_PROPS` extended with `aspectRatio` and `filter` so the existing CSS pipeline emits them per-breakpoint and at desktop.
- `TextEditor.astro` injects scoped one-off rules for column-count/gap, paragraph spacing (`p + p { margin-top }`), drop cap (`> *:first-child::first-letter { ... }`), and link color (`a { color: var(...); opacity: ... }`).
- `DividerSpacer.astro` renders SVG mask data URIs for `wavy` and `zigzag` divider styles, `linear-gradient` for `gradient` style, and a regular CSS border for the rest.
- `Video.astro` sets `aspect-ratio` directly on the wrapper (resolved from preset or `aspectRatioCustomW/H`) and lazy-loads the embed by withholding `src` until the overlay is clicked (tiny inline script promotes `data-epx-src` → `src`).
- `Button.astro` sets `display:inline-flex` + `flex-direction` from `iconPosition`.
- `Icon.astro` for SVG sources renders an inner span with `mask: url(...)` so `iconColor` recolors the silhouette; for PNG it renders `<img>` (admin shows a "color ignored" note).

## peerDependencies (v0.6)

- `@emdash-cms/admin` is declared as **optional** peerDep so the plugin works without it; if installed, `RichTextField` lazy-imports `PortableTextEditor` for the `text-editor` block, and `TextEditor.astro` lazy-imports `PortableText` from `emdash/ui` for SSR rendering.
- Both fall back to a plain JSON textarea (admin) and plain-text rendering (frontend) when unavailable.

## TODO

- [ ] Add Astro components for all remaining block types (hero, features-grid, etc.)
- [ ] Register new components in `blockComponents` and `BlockRenderer.astro`
- [x] Implement breakpoint media queries (`buildBreakpointCss` / `buildBreakpointHoverCss`)
- [x] Apply hover CSS via `:hover` pseudo-selector from `styleHover`
- [x] Apply dark-theme CSS from `styleDark` (via `getEffectiveStyle`)
- [ ] Add responsive image optimization (`<picture>` / `srcset`)
- [ ] Add SEO metadata (og:image, schema.org)
- [ ] Test nested containers (3+ levels deep)
- [x] Add Astro components: text-editor, video, button, icon, html, divider-spacer (v0.6)
