# slidev-marimo

Slidev addons for embedding interactive Python ([marimo](https://marimo.io)) cells in your presentations.

## Installation

```bash
# npm
npm install @slidev/cli slidev-marimo-islands

# pnpm
pnpm add @slidev/cli slidev-marimo-islands

# bun
bun add @slidev/cli slidev-marimo-islands

# yarn
yarn add @slidev/cli slidev-marimo-islands
```

## Usage

Add to your slidev frontmatter:

```yaml
---
addons:
  - slidev-marimo-islands
---
```

Then use marimo code blocks:

````markdown
```marimo
import marimo as mo
slider = mo.ui.slider(0, 100)
slider
```
````

Run your presentation:

```bash
npx slidev slides.md
```

For detailed documentation, component props, and limitations, see the [slidev-marimo-islands README](./slidev-addon-marimo-islands/README.md).

## License

MIT
