# empixel-builder — Theme × State × Breakpoint Model

> Source of truth for the theme/dark-mode + hover/state + breakpoint
> matrix. Closes REMAINING.md item 1 (Standardizare completă
> funcționalitate theme dark / light) and audit T1 (Section 4 +
> Section 5 Q4 of `raport-empixel-emdash.html`).
>
> Owner: F4.5 (1.0.0 prep). Cross-references:
> [`prd-frontend.md`](prd-frontend.md) for the rendering pipeline,
> [`prd-blocks.md`](prd-blocks.md) for the BlockDef schema,
> [`prd-rightpanel.md`](prd-rightpanel.md) for the editor surface,
> [`prd-breakpoints.md`](prd-breakpoints.md) for the per-bp dispatch.

## TL;DR

Two orthogonal axes: **state** (`normal` | `hover`) × **theme**
(`light` | `dark`). Plus per-breakpoint on top. Authors edit any
combination explicitly; the renderer emits all combinations as
distinct CSS rules with selector specificity guaranteeing the right
one wins on the cascade. **No `!important` anywhere on hover** —
selector specificity does the work.

## The four base variants

For a block with id `<id>`, `buildBlockChromeCss` emits up to four
base rules in the following source order (lowest → highest
specificity):

| # | Variant | Stored on `config.*` | Selector | Specificity |
|---|---------|----------------------|----------|-------------|
| 1 | light / normal | `style` | `[data-epx-block="<id>"]` | (0,1,0) |
| 2 | dark / normal | `styleDark` | `darkBlockSelector(<id>)` | (0,2,0)\* |
| 3 | light / hover | `styleHover` | `[data-epx-block="<id>"]:hover` | (0,2,0) |
| 4 | dark / hover (F4.5) | `styleHoverDark` | `darkBlockHoverSelector(<id>)` | (0,3,0)\* |

\* `darkBlockSelector` is a compound `:is(...) [data-epx-block]`
matching one of (`html.dark`, `html[data-theme="dark"]`,
`[data-theme="dark"]`, `[data-mode="dark"]`) plus the self-attribute
fallback. `:is(...)` keeps specificity stable regardless of which
clause matches. The compound `:is(...) [data-epx-block]` adds one
attribute selector worth of specificity over the bare
`[data-epx-block]`. Adding `:hover` adds one pseudo-class.

Net result: for any property set on multiple variants, the cascade
picks the highest-specificity matching rule. Source order resolves
ties (later wins).

### Concrete selectors

```
[data-epx-block="abc"]                              { /* light/normal */ }
:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="abc"],
[data-epx-block="abc"][data-theme="dark"]           { /* dark/normal */ }
[data-epx-block="abc"]:hover                        { /* light/hover */ }
:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="abc"]:hover,
[data-epx-block="abc"][data-theme="dark"]:hover     { /* dark/hover — F4.5 */ }
```

## Per-breakpoint variants

Each base variant has a per-breakpoint counterpart. Per-bp rules wrap
the base selector inside `@media (max-width:<px>)`. Largest px first
(matches the historical descending sort in `buildBreakpointCss`).

| # | Variant | Stored on `config.*` | Selector inside `@media` |
|---|---------|----------------------|--------------------------|
| 5 | light / normal / per-bp | `styleBreakpoints[bpId]` | `[data-epx-block="<id>"]` |
| 6 | dark / normal / per-bp | `styleBreakpoints[bpId]` ※ | `darkBlockSelector(<id>)` |
| 7 | light / hover / per-bp | `styleHoverBreakpoints[bpId]` | `[data-epx-block="<id>"]:hover` |
| 8 | dark / hover / per-bp (F4.5) | `styleBreakpointsHoverDark[bpId]` | `darkBlockHoverSelector(<id>)` |

※ Per-bp dark/normal does NOT have a separate slot. The dark variant
inside a media query falls out automatically: when the host is in dark
theme AND the viewport is below the bp width, both rules (5 + dark
selector matching) cascade — and the bp rule wins on specificity.
Adding a `styleBreakpointsDark` slot would be possible but is
out-of-scope for F4.5; the cascade gets there for the common case via
existing rules. (Tracked as a follow-up if real authoring need
surfaces.)

### Cascade order inside a single `@media` block

```
@media (max-width: 575px) {
  [data-epx-block="abc"]                                              { /* per-bp light/normal */ }
  :is(...) [data-epx-block="abc"], [data-epx-block="abc"][data-theme="dark"]   { /* per-bp dark/normal — derived */ }
  [data-epx-block="abc"]:hover                                        { /* per-bp light/hover */ }
  :is(...) [data-epx-block="abc"]:hover, [data-epx-block="abc"][data-theme="dark"]:hover   { /* per-bp dark/hover — F4.5 */ }
}
```

## Total CSS rule count per block

For a single block with **all** variants populated, an emit looks
like:

| Stage | Rule count |
|-------|------------|
| Base 4 variants (rules 1–4) | 4 |
| Per-bp 4 variants × N breakpoints (rules 5–8) | 4N |
| Custom CSS (`advanced.customCss`) | up to many (passthrough) |
| **Total** | 4 + 4N + custom |

For 3 breakpoints (`tablet-portrait`, `mobile-portrait`, `mobile-small`)
that's 4 + 12 = **16 rules** per fully-styled block, plus customCss.
Acceptable — `coalesceLayoutCss` (F4.1) merges every block's
`@media` blocks into one `@media` per query for the page bundle.

## Why `!important` is gone

Pre-F4.5, `buildHoverCss` + `buildBreakpointHoverCss` +
`buildImgVisualHoverCss` emitted every declaration with `!important`.
The reason was: hover (rule 3, specificity 0,2,0) needed to beat
dark/normal (rule 2, specificity 0,2,0) when both set the same
property. With matching specificity, the historical workaround was
`!important` to force hover to win.

F4.5 changes the picture by introducing rule 4 (dark/hover) at
specificity 0,3,0. Now:

- Hover (rule 3) cleanly outranks light/normal (rule 1) — no tie.
- Dark/normal (rule 2) cleanly outranks light/normal (rule 1).
- **Dark/hover (rule 4)** cleanly outranks dark/normal (rule 2),
  light/hover (rule 3), and light/normal (rule 1) on every property
  it sets.
- The previous tie between dark/normal (rule 2) and light/hover
  (rule 3) is broken by source order — light/hover comes after
  dark/normal in the emit, so light/hover wins on the cascade
  (later wins) for any tied property.

This matches CSS-author intuition: hover wins over normal regardless
of theme, and dark/hover wins over light/hover when the host is in
dark mode. The escape-hatch `!important` is no longer needed and was
removed from `buildHoverCss`, `buildBreakpointHoverCss`, and
`buildImgVisualHoverCss` in the same commit.

### Tie-break audit

Two declarations on the same property at matching specificity tie on
the cascade — source order resolves the tie. The emit order is
locked in `buildBlockChromeCssDirect`:

```
1. buildBlockCss          → rules 1 + 2 (light/normal, dark/normal)
2. buildHoverCss          → rule 3      (light/hover)
3. buildHoverDarkCss      → rule 4      (dark/hover)            — F4.5
4. buildBreakpointCss     → rule 5      (per-bp light/normal)
5. buildBreakpointHoverCss → rule 7     (per-bp light/hover)
6. buildBreakpointHoverDarkCss → rule 8 (per-bp dark/hover)     — F4.5
7. getCustomCss           → author overrides (highest priority)
```

Only realistic tie: dark/normal (rule 2, specificity 0,2,0) vs
light/hover (rule 3, specificity 0,2,0). Source order: rule 3 comes
later, so on a hover event in dark mode, light/hover wins UNLESS
rule 4 (dark/hover, specificity 0,3,0) is set for the same property
— which is precisely the case the F4.5 keys are for.

If you don't want light/hover to "leak" into dark mode, populate
`styleHoverDark` for the property. Otherwise the cascade falls back
to light/hover on dark, which preserves byte-identical behavior with
pre-F4.5 layouts (modulo the `!important` drop, which is invisible
because no other plugin-emitted rule set the same property at the
same specificity).

## Authoring workflows

### "Same hover on light and dark"

Set `styleHover` only. Don't populate `styleHoverDark`. The cascade
fallback applies the light hover on dark mode automatically. This is
the common case — most blocks don't need a different hover treatment
on dark.

### "Different hover on dark"

Set both `styleHover` (for light) and `styleHoverDark` (for dark).
The dark/hover rule (rule 4) outranks dark/normal AND light/hover by
specificity, so it wins for every declared property when the host is
in dark mode and the user hovers.

### "Same hover everywhere except a single property"

Set `styleHover` for the shared properties. Set `styleHoverDark` for
just the property that differs. The light/hover rule applies
property-by-property on the cascade — properties not redeclared in
`styleHoverDark` stay light/hover; properties redeclared in
`styleHoverDark` switch to the dark/hover value.

### "Different hover per breakpoint, same per theme"

Set `styleHoverBreakpoints[bpId]` per bp. Don't populate
`styleBreakpointsHoverDark`. Cascade falls back to the light/hover
bp rule on dark.

### "Different hover per breakpoint, different per theme"

Set both `styleHoverBreakpoints[bpId]` (light) and
`styleBreakpointsHoverDark[bpId]` (dark) for that bp. Same property-
by-property override semantics as above.

## customCss interaction

`advanced.customCss` is the highest-specificity escape hatch. The
plugin:

- Substitutes the keyword `selector` with `[data-epx-block="<id>"]`
  (whole-word, regex `\bselector\b`).
- If the input contains `{` it's emitted as-is (multi-rule block).
- If the input has no `{` it's wrapped in `selector { ... }`.

**No `styleHoverDark` equivalent for customCss.** Authors who want
per-theme custom CSS for hover hand-write it:

```css
/* Light hover, dark hover, etc. */
selector:hover { color: red; }
[data-theme="dark"] selector:hover { color: orange; }
:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) selector:hover { color: orange; }
```

The plugin's emitted dark-hover selector is documented above. We
recommend authors use the F4.5 `styleHoverDark` slot for declarative
per-property changes; customCss is for everything else (animations,
pseudo-element rules, sibling-relative rules, etc.).

## Migration: pre-F4.5 layouts

**Zero migration required.** Layouts saved before F4.5 don't carry
`styleHoverDark` / `styleBreakpointsHoverDark` keys. The renderer
treats absent keys identically to empty objects: the dark-hover rule
is not emitted, so the cascade falls back to the light/hover rule on
dark. Render output is byte-identical to pre-F4.5 modulo the
`!important` drop (which only mattered for the dark/normal vs
light/hover tie that F4.5 explicitly resolves).

`getDefaultBlockConfig(type)` (F3.6.2) backfills the new keys to
`{}` on load, so legacy rows hit the cache key normalisation
predictably. The backfill is in `BASE_DEFAULTS` — no per-BlockDef
opt-in.

`config.theme` (the authoring marker — `"light"` | `"dark"` set by
`ThemeStyleToggle`) keeps its existing meaning. It's NOT consulted at
render time; it only drives which key the editor writes to (`style`
vs `styleDark`, `styleHover` vs `styleHoverDark`). The rendering
pipeline always emits all variants.

## Editor surface (RightPanel)

The Style tab's stateful sections (Background, Border, BorderRadius,
BoxShadow, Opacity) carry a Normal/Hover toggle. F4.5's new keys plug
into the existing routing: when the active state is `hover` AND the
active theme (driven by `config.theme` via `ThemeStyleToggle`) is
`dark`, writes go to `styleHoverDark` (or
`styleBreakpointsHoverDark[bpId]` when a non-desktop bp is active).

Theme key resolution table:

| State | Theme | Active bp | Writes to |
|-------|-------|-----------|-----------|
| normal | light | desktop | `style` |
| normal | dark | desktop | `styleDark` |
| hover | light | desktop | `styleHover` |
| hover | dark | desktop | `styleHoverDark` (F4.5) |
| normal | light | non-desktop | `styleBreakpoints[bpId]` |
| normal | dark | non-desktop | `styleBreakpoints[bpId]` ※ |
| hover | light | non-desktop | `styleHoverBreakpoints[bpId]` |
| hover | dark | non-desktop | `styleBreakpointsHoverDark[bpId]` (F4.5) |

※ Per-bp dark/normal writes share the same slot as light/normal in
F4.5. Authors editing dark-mode bp overrides today don't have a
separate channel — the renderer derives the dark variant via the
existing `styleBreakpoints` rule cascading into the host's dark
ancestor selector. If a real need surfaces for "different per-bp
declaration on dark", a `styleBreakpointsDark[bpId]` slot can be
added in the same shape — the cascade ladder is already extensible.

## Files

| File | Role |
|------|------|
| `src/components/styleUtils.ts` | Cascade emit (`buildBlockCss`, `buildHoverCss`, `buildHoverDarkCss` (F4.5), `buildBreakpointCss`, `buildBreakpointHoverCss`, `buildBreakpointHoverDarkCss` (F4.5)) + `darkBlockSelector` + `darkBlockHoverSelector` (F4.5) + `buildBlockChromeCss` orchestrator. |
| `src/admin/blockDefinitions.ts` | `BASE_DEFAULTS` carries the new `styleHoverDark` + `styleBreakpointsHoverDark` empty-object slots; every BlockDef's `defaultConfig` mirrors them. |
| `src/admin/Canvas.tsx` | `buildCanvasBlockCss` reuses `buildBlockChromeCss` so canvas + frontend emit the same matrix. The canvas active-bp preview overlay also benefits from the `!important` drop (no longer needs the escape hatch to layer over the frontend rules). |
| `tests/parity/all.test.ts` | Snapshots lock the matrix output for every block. F4.5 added one fixture (`M1`) covering all 4 base + 4 per-bp variants populated, plus a fallback test (`M2`) confirming layouts without `styleHoverDark` still render the light/hover rule. |
| `tests/blockDefinitions.test.ts` | Asserts every BlockDef declares the new keys; asserts `BASE_DEFAULTS` shape includes them. |
| `tests/styleUtils.test.ts` | `buildHoverCss` no longer emits `!important`; `buildBlockChromeCss` composition test updated. |
| `tests/canvasCss.test.ts` | Canvas overlay test updated to reflect the `!important` drop. |

## TODO

- [ ] (Optional) `styleBreakpointsDark[bpId]` slot — per-bp dark/normal
  override. Out of scope for F4.5 because the cascade gets there via
  the host's dark ancestor signal cascading into the existing per-bp
  rule. Would close the matrix completely for authors who want
  per-bp dark-only overrides without relying on cascade-through.
- [ ] Editor UX: surface a "this hover applies to dark too" hint in
  the RightPanel when `styleHover` is set but `styleHoverDark` is
  empty — helps authors discover the new slot. Out of scope for the
  pure-CSS F4.5 PR.
