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

This command adds the import and registers the plugin in your `astro.config.mjs`. Restart your dev server after running it.

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
