# empixel-builder — Frontend Components (Astro)

## Role
Server-rendered Astro components that render blocks to HTML. Zero client-side JavaScript.

## Architecture

```
src/components/
├─ index.ts              # Exports all block components
├─ BlockRenderer.astro   # Root layout renderer + style injection
├─ styleUtils.ts         # CSS generation from config
├─ db.ts                 # Database queries
├─ [BlockName].astro     # Individual block components (13 total)
└─ internal/
   └─ [BlockName]UI.astro (optional internal components)
```

## BlockRenderer (root)

Receives `PageLayout` and renders all sections:

```astro
---
import { PageLayout, SectionBlock } from "../types";
import * as Blocks from "./index";

export interface Props {
  layout: PageLayout;
}

const { layout } = Astro.props;
---

<div class="epx-layout">
  {layout.sections.map((section) => (
    <Blocks[section.type] block={section} />
  ))}
</div>

<style define:vars={generateCSSVars(layout)}>
  /* Global CSS for layout + theme */
</style>
```

## Block Components

Each block is an Astro component receiving a `SectionBlock`:

```astro
---
import type { TestimonialsConfig, SectionBlock } from "../types";

interface Props {
  block: SectionBlock & { type: "testimonials" };
}

const { block } = Astro.props;
const config = block.config as TestimonialsConfig;
const styles = generateBlockStyles(block);
---

<section [data-epx-block]={block.id} [style]={styles}>
  {/* Render testimonials */}
</section>

<style define:vars={generateThemeVars(config.theme)}>
  /* Component CSS */
</style>
```

### Props Pattern
- Every block receives its full `SectionBlock`
- Config is strongly typed (via `as ConfigType`)
- Styles are injected via `define:vars`
- Use `data-epx-block` attribute for CSS selectors

## Current Components (13)

1. **Testimonials.astro** — Quote carousel/grid
2. **Faq.astro** — Accordion
3. **Pricing.astro** — Pricing grid
4. **Spacer.astro** — Vertical spacing
5. **Container.astro** — Generic container (renders children)
6. **Section.astro** — Section wrapper
7. **Columns.astro** — Column grid (renders slots)
8. **Hero.astro** — Hero section
9. **Features.astro** — Feature cards
10. **ImageText.astro** — Side-by-side
11. **Cta.astro** — Call-to-action
12. **Stats.astro** — Statistics grid
13. **Gallery.astro** — Image gallery

(Also: Video.astro)

## Nested Rendering

### Container block
Has `children: SectionBlock[]`. Render via:
```astro
{block.children.map((child) => (
  <Blocks[child.type] block={child} />
))}
```

### Columns block
Has `slots: SectionBlock[][]`. Render via:
```astro
{block.slots.map((col, i) => (
  <div class="epx-column">
    {col.map((child) => (
      <Blocks[child.type] block={child} />
    ))}
  </div>
))}
```

## Style Utilities (styleUtils.ts)

### generateBlockStyles(block)
Returns inline style string from `block.config.style` + `block.config.advanced`.

Maps config keys to CSS:
- `paddingTop` → `padding-top`
- `marginBottom` → `margin-bottom`
- `borderRadius` → `border-radius`
- Custom CSS from `advanced.customCss` (scoped to block selector)

### generateThemeVars(theme)
CSS custom properties for theme colors (light/dark/accent).

## Database Query (db.ts)

### getBuilderLayout(pageId)
Fetch layout for a page from `empixel_builder_layouts` table.

```ts
import type { PageLayout } from "../types";

export async function getBuilderLayout(pageId: string): Promise<PageLayout | null> {
  // Query SQLite, deserialize layout JSON, return
}
```

Called by pages that use builder-enabled content.

## Image Fields

Image fields are objects: `{ src, alt }`.

Use EmDash `<Image>` component:

```astro
import { Image } from "emdash/ui";

<Image image={config.backgroundImage} />
```

Never use raw `<img>` tag.

## Props Flow

1. Page queries content entry
2. Entry has `layout: PageLayout` field (stored as JSON)
3. Page renders `<BlockRenderer layout={layout} />`
4. BlockRenderer recursively renders all blocks
5. Block components read `block.config`, type as ConfigType, render

Example:
```astro
---
const entry = await getEntry(collection, slug);
---

<BlockRenderer layout={entry.data.layout} />
```

## Rules

- All components are **server-rendered** (no client JS)
- **Image fields** are objects `{ src, alt }`, not strings
- **Props come directly from block.config** — no prop mapping logic
- **Use define:vars for theming** (CSS custom properties injected into `<style>`)
- **No duplicate logic** between admin previews and frontend components
- **Use data-epx-block attribute** for styling/identification
- **Cache pages** that query layouts (call `Astro.cache.set()`)

## TODO

- [ ] Audit all components — verify all type fields are wired
- [ ] Add responsive image optimization
- [ ] Add lazy loading for off-screen blocks
- [ ] Add SEO metadata (og:image, schema.org markup)
- [ ] Add analytics tracking hooks
- [ ] Test nested containers (3+ levels deep)
