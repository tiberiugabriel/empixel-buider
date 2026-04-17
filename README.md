# empixel-builder

Page builder plugin for [EmDash](https://emdash.dev) — drag-and-drop sections with custom styles, saved as JSON.

## Installation

```bash
npm install empixel-builder
```

Then register the plugin automatically:

```bash
npx empixel-builder add
```

This command does two things:

1. Adds the import and registers the plugin in your `astro.config.mjs`
2. Creates the `empixel_builder_layouts` table in `data.db` (EmDash's SQLite database)

> **Note:** Run `npx emdash dev` at least once before running `npx empixel-builder add` so that `data.db` exists. If the database is not found, the table will be created automatically on the first server start.

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

## Usage

Once registered, the **Page Editor** appears in the EmDash admin sidebar at `/_emdash/admin`.

Open the editor, build your page layout with drag-and-drop sections, and save. The layout is stored as JSON in the database and rendered on the frontend via EmDash.

## Requirements

- `emdash` >= 0.4.0
- `astro` >= 6.0.0
- `react` >= 19.0.0
- `better-sqlite3` >= 9.0.0 (included with EmDash)
