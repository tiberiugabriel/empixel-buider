[![npm](https://img.shields.io/npm/v/empixel-builder)](https://www.npmjs.com/package/empixel-builder) [![EmDash](https://img.shields.io/badge/EmDash-v0.9.0%20✅-90EE90)](https://github.com/emdash-cms/emdash)

# EmPixel Builder

> **Work in progress** — this plugin is in active development and may contain bugs. Contributions are welcome!

> **Native plugin only** — empixel-builder uses a custom React admin page and relies on Node.js APIs. It cannot be used in Cloudflare Workers or other edge/serverless environments.

Page builder plugin for [EmDash](https://github.com/emdash-cms/emdash) — drag-and-drop sections with custom styles, saved as JSON.

## Installation

```bash
npm install empixel-builder
```

Then register the plugin automatically:

```bash
npx empixel-builder add
```

This command adds the import and registers the plugin in your `astro.config.mjs`, then patches your `[slug].astro` page files to render layouts via `<BuilderWrapper>`.

Restart your dev server after running the command.

### Manual registration

If you prefer to register manually, add the following to `astro.config.mjs`:

```js
import { empixelBuilder } from "empixel-builder";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [empixelBuilder()],
    }),
  ],
});
```

### Database driver

As of v0.9.0, the plugin no longer opens its own SQLite handle. All
reads + writes go through EmDash's `ctx.storage` multi-driver storage
abstraction — your layouts are persisted in whichever back-end you
configure at the EmDash root in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import { emdash, database } from "emdash";
import { empixelBuilder } from "empixel-builder";

export default defineConfig({
  integrations: [
    emdash({
      database: database.sqlite("./data.db"),  // or .postgres(...) / .libsql(...)
      plugins: [empixelBuilder()],
    }),
  ],
});
```

The plugin works on any driver EmDash supports — SQLite (default),
Postgres, libSQL/Turso, and Cloudflare D1.

## Usage

Once registered, the **Page Editor** appears in the EmDash admin sidebar at `/_emdash/admin`.

Open the editor, build your page layout with drag-and-drop sections, and save. The layout is stored as JSON in the database and rendered on the frontend via EmDash.

## Caching builder layouts

`getBuilderLayout` returns `Promise<{ sections, cacheHint }>`. The
`cacheHint` carries the layout-scoped tag
`empixel:layout:<collection>:<entryId>` plus a `lastModified` derived
from the storage row's `updatedAt`. Pass it to `Astro.cache.set(...)`
and admin layout saves invalidate the host page automatically.

### Automatic — recommended

`<BuilderWrapper>` reads the (resolved or unawaited) result object and
calls `Astro.cache.set` for you:

```astro
---
import { getBuilderLayout, BuilderWrapper } from "empixel-builder/astro";

const builderLayout = getBuilderLayout(
  Astro,
  "posts",
  post.data.id,
  post.data.empixel_builder,
);
---

<BuilderWrapper sections={builderLayout}>
  <!-- your fallback page goes here when no layout exists -->
</BuilderWrapper>
```

(`npx empixel-builder add` scaffolds this pattern.)

### Manual — for pages that don't use `<BuilderWrapper>`

`await` the call, destructure the result, and call `Astro.cache.set`
yourself:

```astro
---
import { getBuilderLayout, LayoutRenderer } from "empixel-builder/astro";

const { sections, cacheHint } = await getBuilderLayout(
  Astro,
  "posts",
  post.data.id,
  post.data.empixel_builder,
);
Astro.cache.set(cacheHint);
---

{sections && <LayoutRenderer sections={sections} />}
```

The cache hint is always returned (even when there's no layout row), so
you can call `Astro.cache.set(cacheHint)` unconditionally — a future save
that creates the row still busts the host page's cache by tag.

## Requirements

- **Node.js >= 20** (required by EmDash core)
- `emdash` >= 0.9.0
- `astro` >= 6.0.0
- `react` >= 19.0.0

---

_This plugin was built with the help of [Claude AI](https://claude.ai)._
