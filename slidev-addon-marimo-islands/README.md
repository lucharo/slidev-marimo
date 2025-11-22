# slidev-marimo-islands

> Bring interactive Python notebooks into your presentations

Share live, executable Python code in your Slidev slides. Built on [marimo](https://marimo.io)'s reactive notebook cells and powered by Pyodide/WASM - no external server needed. Perfect for technical talks, data science presentations, and teaching.

## Installation

```bash
npm install slidev-marimo-islands
```

## Quick Start

Add the add-on to your `slidev` markdown file:

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

The Python code runs directly in the browser - fully interactive, no backend required.

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
  :display-code="false"
  code="import marimo as mo; mo.ui.slider(0, 100)"
/>
```

## Limitations

- **Startup time**: Pyodide initialization takes 2-5 seconds
- **Package support**: Limited to [Pyodide-compatible packages](https://pyodide.org/en/stable/usage/packages-in-pyodide.html) — use 
- **Performance**: Runs slower than native Python
- **Interactivity**: Basic marimo widgets work; complex React-based components may not
- **Marimo version**: Currently pinned to v0.11.6 (last stable version before CSS regression)

## License

MIT
