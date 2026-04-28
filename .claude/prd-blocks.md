# empixel-builder — Block System

## Role
Define all block types, their configuration schemas, and metadata. Single source of truth for editor UI and frontend rendering.

## Files
- `src/types.ts` — TypeScript interfaces for block configs
- `src/admin/blockDefinitions.ts` — BlockDef[] array with field schemas and defaults

## Block Definition Schema

### BlockDef interface
```ts
{
  type: BlockType;                          // "testimonials", "faq", etc.
  label: string;                            // "Testimonials"
  icon: string;                             // "💬"
  description: string;                      // User-facing description
  category: "core" | "general";             // Palette grouping
  defaultConfig: Record<string, any>;       // Initial config values
  fields: FieldDef[];                       // Content field schema
  styleFields?: FieldDef[];                 // Style-tab fields (optional)
}
```

### FieldDef interface
```ts
{
  key: string;                              // Block config key
  label: string;                            // UI label
  type: FieldType;                          // "text", "select", "json-array", etc.
  options?: Array<{value, label}>;          // For select only
  placeholder?: string;                     // Input hint
  required?: boolean;
  itemFields?: FieldDef[];                  // For json-array: item schema
}
```

### FieldType values
| Type | Rendered as | Stored in |
|------|-------------|-----------|
| `text` | `<input type="text">` | block.config[key] |
| `url` | `<input type="url">` | block.config[key] |
| `textarea` | `<textarea rows=3>` | block.config[key] |
| `number` | `<input type="number">` | block.config[key] |
| `select` | `<select>` with options | block.config[key] |
| `toggle` | Checkbox + inline label | block.config[key] (boolean) |
| `json-array` | Expandable item list | block.config[key] (array) |

## Current Blocks (v0.1.2)

### Defined
1. **testimonials** — Quote carousel/grid
   - Fields: headline, layout, theme, items (json-array)
   - Items: quote, author, role, company, avatarUrl

2. **faq** — Accordion
   - Fields: headline, subheadline, theme, items (json-array)
   - Items: question, answer

3. **pricing** — Pricing grid
   - Fields: headline, subheadline, theme, tiers (json-array)
   - Tiers: name, price, period, description, features, ctaLabel, ctaUrl, highlighted

4. **spacer** — Vertical spacing
   - Fields: height (sm/md/lg/xl), showDivider

5. **container** — Generic container
   - Fields: none (layout-only)
   - Contains: nested children blocks

### Planned (add definitions)
- **hero** — Hero section (headline, subheadline, cta button, background image)
- **features-grid** — Feature cards
- **image-text** — Side-by-side image + text
- **cta** — Call-to-action section
- **stats** — Statistics/metrics grid
- **gallery** — Image gallery
- **video** — Embedded video
- **columns** — Column grid (flex layout)
- **heading** — Semantic heading (h1-h6)
- **paragraph** — Rich paragraph text
- **rich-text** — Full Portable Text editor
- **html** — Raw HTML block
- **image** — Single image with captions

## Rules

- **Every block type in types.ts must have a matching BlockDef**
- **defaults must match type interface exactly** (no mismatches between field schema and config interface)
- **Shared fields** (like `THEME_FIELD`) should be reused, not duplicated
- **Preview components** must exist for every block (in `src/admin/previews/`)
- **Astro components** must exist for every block (in `src/components/`)

## Tree Structure

Blocks form a tree: `sections: SectionBlock[]` at root, containers hold `children`.

```ts
interface SectionBlock {
  id: string;                    // Unique per layout
  type: BlockType;
  config: Record<string, any>;   // Flat config object
  children?: SectionBlock[];     // For containers
  slots?: SectionBlock[][];      // For columns (col1, col2, ...)
}
```

## TODO

- [ ] Write remaining 9 BlockDef entries
- [ ] Add image field type + MediaPicker control
- [ ] Add rich-text field type
- [ ] Document block naming conventions
- [ ] Add block categories (core vs general vs experimental)
