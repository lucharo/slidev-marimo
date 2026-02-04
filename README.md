# slidev-marimo

Slidev addons for embedding interactive Python ([marimo](https://marimo.io)) cells in your presentations.

[Check the live demo](https://lucharo.github.io/slidev-marimo/)

All cells share state just like in a normal marimo notebook - variables defined in one cell are available in all others.

## Quick Start

```bash
# Clone and run the example
git clone https://github.com/lucharo/slidev-marimo.git
cd slidev-marimo
npm install
npx slidev islands-example.md
```

## Installation

```bash
# npm
npm install @slidev/cli slidev-addon-marimo

# pnpm
pnpm add @slidev/cli slidev-addon-marimo

# bun
bun add @slidev/cli slidev-addon-marimo

# yarn
yarn add @slidev/cli slidev-addon-marimo
```

## Usage

Add to your slidev frontmatter:

```yaml
---
addons:
  - slidev-addon-marimo
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

For detailed documentation, component props, and limitations, see the [slidev-addon-marimo README](./slidev-addon-marimo/README.md).

## License

MIT
