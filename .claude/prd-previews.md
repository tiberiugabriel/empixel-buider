# empixel-builder — Block Previews

## Role
Live preview components in the admin UI Canvas. Show real-time feedback as users edit block properties.

## Architecture

```
src/admin/previews/
├─ index.ts                    # Export all previews
├─ [BlockName]Preview.tsx      # Individual preview components
└─ internal/
   └─ [BlockName]PreviewUI.tsx (optional reusable preview UI)
```

## Preview Pattern

Each block has a matching preview component (React):

```tsx
import type { SectionBlock, TestimonialsConfig } from "../../types";

interface Props {
  block: SectionBlock & { type: "testimonials" };
  selected: boolean;
  isDirty: boolean;
}

export function TestimonialsPreview({ block, selected, isDirty }: Props) {
  const config = block.config as TestimonialsConfig;

  return (
    <div className={`epx-preview ${selected ? "is-selected" : ""}`}>
      <div className="epx-testimonials-preview">
        {/* Render preview based on config */}
      </div>
    </div>
  );
}
```

## Key Principles

### Live Updates
Previews **must reflect config changes in real time**. No hardcoded values.

❌ Bad:
```tsx
<div className="epx-cta">
  <h2>Default CTA Title</h2>  // Hardcoded, ignores config
  <button>Learn More</button>
</div>
```

✅ Good:
```tsx
<div className="epx-cta">
  <h2>{config.headline || "CTA Section"}</h2>  // Uses config
  <button>{config.ctaLabel || "Learn More"}</button>
</div>
```

### Minimal Component
Keep previews **small and focused**:
- Only render what matters for preview
- Omit business logic
- Show layout/structure, not full HTML

### Props
- `block` — Full SectionBlock with type and config
- `selected` — Whether block is currently selected
- `isDirty` — Whether block differs from defaults (for visual feedback)

### Selection Styling
```tsx
<div className={`epx-preview-container ${selected ? "is-selected" : ""}`}>
```

CSS applies selection outline via `is-selected` class.

## Current Previews (5 Defined)

1. **TestimonialsPreview** — Shows sample testimonials in grid/carousel
2. **FaqPreview** — Shows accordion items collapsed
3. **PricingPreview** — Shows pricing tiers grid
4. **ContainerPreview** — Shows nested children (recursively renders blocks)
5. **SpacerPreview** — Shows vertical spacing height indicator

### Missing (8 blocks, need previews)
- HeroPreview
- FeaturesPreview
- ImageTextPreview
- CtaPreview
- StatsPreview
- GalleryPreview
- VideoPreview
- ColumnsPreview

## Nested Rendering in Previews

Containers and columns render child blocks:

```tsx
export function ContainerPreview({ block }: Props) {
  return (
    <div className="epx-container-preview">
      {block.children?.map((child) => {
        const ChildPreview = PREVIEW_MAP[child.type];
        return <ChildPreview key={child.id} block={child} selected={false} isDirty={false} />;
      })}
    </div>
  );
}
```

Use `PREVIEW_MAP` (from index.ts) to look up preview components by type.

## Preview Registration (index.ts)

```ts
import { TestimonialsPreview } from "./TestimonialsPreview";
import { FaqPreview } from "./FaqPreview";
// ... etc

export const PREVIEW_MAP: Record<BlockType, React.ComponentType<any>> = {
  testimonials: TestimonialsPreview,
  faq: FaqPreview,
  pricing: PricingPreview,
  container: ContainerPreview,
  spacer: SpacerPreview,
  // TODO: Add remaining previews
};
```

Every block type in `types.ts` must have an entry in `PREVIEW_MAP`.

## Usage in Canvas

Canvas renders blocks via:

```tsx
{sections.map((block) => {
  const Preview = PREVIEW_MAP[block.type];
  return (
    <div key={block.id} data-block-id={block.id}>
      <Preview
        block={block}
        selected={selectedId === block.id}
        isDirty={isDirty(block)}
      />
    </div>
  );
})}
```

## Styling Previews

Previews can read theme/style from `block.config.style` and `block.config.advanced`:

```tsx
const styles: React.CSSProperties = {
  padding: config.style?.padding || "0",
  backgroundColor: config.style?.backgroundColor || "transparent",
  // ... etc
};

return <div style={styles}>{/* content */}</div>;
```

Or use `generateBlockStyles()` utility (same as frontend):

```ts
import { generateBlockStyles } from "../components/styleUtils";

const inlineStyles = generateBlockStyles(block);
```

## Theming in Previews

If block has `config.theme` (light/dark/accent), apply via class:

```tsx
<div className={`epx-testimonials-preview theme-${config.theme || "light"}`}>
  {/* content */}
</div>
```

CSS handles theme colors via custom properties.

## TODO

- [ ] Create remaining 8 preview components
- [ ] Add preview CSS + theming (create previews.css)
- [ ] Make previews respond to style changes in real time
- [ ] Add preview placeholder for image blocks (show image icon if missing)
- [ ] Test nested preview rendering (containers 3+ levels deep)
- [ ] Add animation/transition previews (fade, slide, etc.)
