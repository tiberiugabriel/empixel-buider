# empixel-builder — Frontend Components (Astro)

## Role
Server-rendered Astro components that render blocks to HTML. Zero client-side JavaScript.

## Architecture

```
src/components/
├─ index.ts              # Exports: blockComponents map, getBuilderLayout, LayoutRenderer, BuilderWrapper
├─ BlockRenderer.astro   # Root block dispatcher (renders one block by type)
├─ LayoutRenderer.astro  # Iterates sections, calls BlockRenderer per block
├─ BuilderWrapper.astro  # Wrapper for builder-enabled pages
├─ styleUtils.ts         # CSS generation from block config
├─ db.ts                 # getBuilderLayout() database query
├─ Testimonials.astro    # testimonials block
├─ FaqSection.astro      # faq block
├─ PricingSection.astro  # pricing block
├─ SpacerSection.astro   # spacer block
└─ SectionContainer.astro # container block (renders children)
```

## blockComponents map (index.ts)

```ts
export const blockComponents: Record<string, unknown> = {
  testimonials: Testimonials,
  faq: FaqSection,
  pricing: PricingSection,
  spacer: SpacerSection,
};
```

Every `BlockType` must have an entry here.

## LayoutRenderer (root)

Iterates `layout.sections` and renders each block:

```astro
---
import type { PageLayout } from "../types";
import BlockRenderer from "./BlockRenderer.astro";

interface Props { layout: PageLayout; }
const { layout } = Astro.props;
---
{layout.sections.map((section) => (
  <BlockRenderer block={section} />
))}
```

## BlockRenderer (dispatcher)

Routes to the correct Astro component by `block.type`:

```astro
---
import type { SectionBlock } from "../types";
import Testimonials from "./Testimonials.astro";
import FaqSection from "./FaqSection.astro";
// ... etc

interface Props { block: SectionBlock; }
const { block } = Astro.props;
---
{block.type === "testimonials" && <Testimonials block={block} />}
{block.type === "faq" && <FaqSection block={block} />}
...
```

## Block Component Pattern

```astro
---
import type { SectionBlock, TestimonialsConfig } from "../types";
import { generateBlockStyles } from "./styleUtils";

interface Props { block: SectionBlock; }
const { block } = Astro.props;
const config = block.config as TestimonialsConfig;
const styles = generateBlockStyles(block);
---

<section data-epx-block={block.id} style={styles}>
  {/* Render using config values */}
</section>
```

### Props Pattern Rules
- Every block receives its full `SectionBlock`
- Config is typed via `as ConfigType`
- Inline styles from `generateBlockStyles(block)`
- `data-epx-block` attribute for CSS selectors / custom CSS targeting

## Nested Rendering

### Container block
```astro
{block.children?.map((child) => <BlockRenderer block={child} />)}
```

### Columns block (future)
```astro
{block.slots?.map((col) => (
  <div class="epx-column">
    {col.map((child) => <BlockRenderer block={child} />)}
  </div>
))}
```

## Style Utilities (styleUtils.ts)

### generateBlockStyles(block)
Returns inline style string from `block.config.style` + `block.config.advanced`.

Maps config keys to CSS:
- `paddingTop` → `padding-top: Xpx`
- `marginBottom` → `margin-bottom: Xpx`
- `borderTopLeftRadius` → `border-top-left-radius: Xpx`
- `boxShadow` → `box-shadow: ...`
- `backgroundColor` → `background-color: ...`
- etc.

Position/offset from `advanced`: `position`, `top`, `right`, `bottom`, `left`, `zIndex`
Dimensions from `style`: `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`

Custom CSS from `advanced.customCss` is injected as scoped `<style>` block.

### generateBreakpointStyles(block)
Returns `<style>` block with media queries from `block.config.styleBreakpoints`:

```css
@media (max-width: 992px) {
  [data-epx-block="<id>"] {
    padding-top: 8px;
    /* ... */
  }
}
```

Also handles hover breakpoints from `block.config.styleHoverBreakpoints`.

## Database Query (db.ts)

### getBuilderLayout(pageId, collection)
```ts
export async function getBuilderLayout(pageId: string, collection: string): Promise<PageLayout | null>
```
- Queries `empixel_builder_layouts` WHERE `collection = ? AND entry_id = ?`
- Resolves slug ↔ ULID same as backend API
- Deserializes `sections` JSON string → `SectionBlock[]`
- Returns `{ sections, updatedAt }` or `null`

## Image Fields

Image fields are objects: `{ src, alt }`.

Use EmDash `<Image>` component:
```astro
import { Image } from "emdash/ui";
<Image image={config.backgroundImage} />
```

Never use raw `<img>`. Never assume image is a string.

## Props Flow (Page → Blocks)

```astro
---
// In an Astro page:
import { getBuilderLayout, LayoutRenderer } from "empixel-builder/components";

const layout = await getBuilderLayout(entry.id, collection);
Astro.cache.set(cacheHint);
---

{layout && <LayoutRenderer layout={layout} />}
```

## BuilderWrapper

Wraps pages with builder-related metadata/attributes. Usage TBD.

## Rules

- All components are **server-rendered** (no client JS, no `client:*` directives)
- **Image fields** are objects `{ src, alt }`, not strings
- **Use `generateBlockStyles(block)`** for inline styles
- **Use `data-epx-block` attribute** on root element of each block
- **No duplicate logic** between admin previews and frontend components
- **Cache pages** that query layouts (`Astro.cache.set(cacheHint)`)

## TODO

- [ ] Add Astro components for all remaining block types (hero, features-grid, etc.)
- [ ] Register new components in `blockComponents` and `BlockRenderer.astro`
- [ ] Implement `generateBreakpointStyles()` for responsive rendering
- [ ] Apply hover CSS via `:hover` pseudo-selector from `styleHover`
- [ ] Apply theme CSS from `styleDark` / `styleAccent` (scoped via `data-theme` attribute)
- [ ] Add responsive image optimization
- [ ] Add SEO metadata (og:image, schema.org)
- [ ] Test nested containers (3+ levels deep)
