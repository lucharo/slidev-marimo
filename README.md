# Slidev + Marimo

How amazing would it be to have Python code running on slides? And what if those slides were interactive?

> **Enter `slidev` + `marimo`**

## Two implementations

This repo has two ways to run marimo notebooks as slides:

### 1. Marimo Islands

```bash
slidev islands-example.md
```

Powered by Pyodide and WebAssembly. Your slides run fully in the browser - no server, no kernel, just open and go. The tradeoff: you're limited to packages available in Pyodide, and compute happens in your browser.

### 2. Marimo Live

```bash
# Start the kernel (with sandbox for automatic deps)
marimo edit examples/notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*"

# Start slidev
slidev examples/marimo-live-test.md
```

A live marimo kernel runs on your machine. Instead of the traditional marimo notebook UI, your frontend is Slidev slides. This lets you use any Python package, any dependency, full compute power - no Pyodide limitations.

## Ergonomics

Since Slidev slides are just markdown files, we made it possible to write marimo cells as simple code blocks:

~~~markdown
```marimo
import matplotlib.pyplot as plt
plt.plot([1, 2, 3], [1, 4, 9])
```
~~~

These code blocks power the interactive cells you see on the slides.

For Marimo Live, you can reference cells from your notebook by name or index:

~~~markdown
```marimo-live cell=plot_chart
```

```marimo-live cell=2
```
~~~

This keeps your Python code in one place with full IDE support.

---

## Installation

```bash
# Clone the repo
git clone <repo-url>
cd slidev-marimo-nb-validation

# Install dependencies
bun install
```

## Usage

### Marimo Live (recommended for full Python)

1. **Start the marimo kernel** with sandbox mode (auto-installs deps from notebook):

```bash
marimo edit examples/notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*"
```

2. **Start Slidev**:

```bash
slidev examples/marimo-live-test.md
```

3. Open http://localhost:3030 (or the port shown in terminal)

### Marimo Islands (browser-only)

```bash
slidev islands-example.md
```

No kernel needed - runs entirely in the browser.

## Examples

See `examples/` directory:

- `marimo-live-test.md` - Demo slides with sliders, charts, data explorer
- `notebook.py` - Marimo notebook with polars, altair, and UI elements

## Adding dependencies to your notebook

For `--sandbox` mode to work, add a PEP 723 script header to your notebook:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "polars",
#     "altair",
# ]
# ///

import marimo
# ... rest of notebook
```
