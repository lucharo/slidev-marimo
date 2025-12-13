# slidev-marimo-islands

> Bring interactive Python notebooks into your presentations

Share live, executable Python code in your Slidev slides. Built on [marimo](https://marimo.io)'s reactive notebook cells and powered by Pyodide/WASM - no external server needed. Perfect for technical talks, data science presentations, and teaching.

## Overview

[marimo](https://marimo.io) provides `marimo-islands` which enable you to embed reactive python cells within HTML documents — you can read more about them in their [documentation](https://docs.marimo.io/api/islands/). In this [`slidev`](https://sli.dev/) add-on we
wrap `marimo-islands` as Vue components for compatibility with [`slidev`](https://sli.dev/) slides. The python code actually runs in [`pyodide`](https://pyodide.org/) workers in the browser via [`WASM`](https://webassembly.org/).

All the [marimo](https://marimo.io) cells share the same context so all the conventional [marimo](https://marimo.io) rules apply: do not duplicate variables, the last variable of a cell gets displayed, etc.

## Installation

```bash
npm install slidev-marimo-islands
```

## Quick Start

Try the marimo islands example: https://docs.marimo.io/guides/island_example/

```sh
npx slidev islands-example.md
```

Add the add-on to your [`slidev`](https://sli.dev/) markdown file:

```yaml
---
addons:
  - slidev-marimo-islands
---
```

Use `marimo` code blocks in your slides:

````markdown
# Interactive Python Demo

```marimo
import marimo as mo

slider = mo.ui.slider(0, 100, value=50)
mo.md(f"Value: {slider.value}")
```
````

## Component Props

For advanced control, use the `<MarimoIsland>` component:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | required | Python code to execute |
| `displayCode` | `boolean` | `true` | Show source code |
| `hideLines` | `number[]` | `[]` | Hide specific lines (1-indexed) |

**Example:**

```vue
<MarimoIsland
  code="import marimo as mo&#10;mo.ui.slider(0, 100)"
  :display-code="true"
/>
```

## Limitations

- **Startup time**: Pyodide initialization takes 2-5 seconds
- **Package support**: Limited to [Pyodide-compatible packages](https://pyodide.org/en/stable/usage/packages-in-pyodide.html) — use `micropip.install` to install missing dependencies, e.g:

````

```marimo
import micropip
micropip.install("plotly")
```

````

- **Performance**: Runs slower than native Python
- **Interactivity**: Basic marimo widgets work; complex React-based components may not
- **Marimo version**: Currently pinned to `0.11.6` (last stable version before CSS regression)

## License

MIT

## Contributions

I am not a full stack or front end person. I know enough about `marimo` internals to get a project like this one going but this is by no means production level code. For its inception I've relied heavily on tools such as `claude` code and sane software principles like linting with `biome` and some unit tests. vibecoded contributions are welcome but I expect you to please read the code that you submit at least once. non vibe coded contributions from fullstack people and audits are very very welcome!
