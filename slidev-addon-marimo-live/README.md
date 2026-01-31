# slidev-marimo-live

Slidev addon for live marimo kernel integration via WebSocket.

Unlike `slidev-marimo-islands` which runs Python in the browser using WASM/Pyodide, this addon connects to a real marimo Python kernel running on your machine. This provides:

- **Full Python ecosystem** - Use any pip package (pandas, numpy, torch, etc.)
- **File system access** - Read/write files from your local machine
- **Faster execution** - No WASM overhead, native Python speed
- **Interactive UI elements** - Sliders, dropdowns, buttons sync with the kernel

## Prerequisites

- [marimo](https://marimo.io/) installed (`pip install marimo`)
- A running marimo server in headless mode

## Quick Start

### 1. Install the addon

Add to your presentation's `package.json`:

```json
{
  "dependencies": {
    "slidev-marimo-live": "file:slidev-addon-marimo-live"
  }
}
```

### 2. Start the marimo server

```bash
# With sandbox mode (recommended - auto-installs deps from notebook)
marimo edit notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*"

# Or without sandbox (requires deps pre-installed)
marimo edit notebook.py --headless --port 2718 --no-token --allow-origins "*"
```

For sandbox mode, add a PEP 723 header to your notebook:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["marimo", "polars", "altair"]
# ///
```

### 3. Use in your slides

```markdown
---
# My Slide

<MarimoCell cell="plot_chart" />
---
```

## Usage

### Referencing Notebook Cells

Use `<MarimoCell>` to embed cells from your notebook:

```markdown
<!-- Reference by cell name (function name in marimo) -->
<MarimoCell cell="plot_chart" />

<!-- Reference by index (0-based) -->
<MarimoCell cell="2" />

<!-- Hide code display -->
<MarimoCell cell="chart_demo" :displayCode="false" />

<!-- Disable auto-run -->
<MarimoCell cell="expensive_computation" :autoRun="false" />
```

Cell names come from the function names in your marimo notebook:

```python
# In notebook.py
@app.cell
def plot_chart():  # <- This becomes the cell name
    import matplotlib.pyplot as plt
    plt.plot([1, 2, 3], [1, 4, 9])
    return plt.gcf()
```

### MarimoCell Props

| Prop | Default | Description |
|------|---------|-------------|
| `cell` | required | Cell name, ID, or index from the notebook |
| `displayCode` | `true` | Show the code editor |
| `autoRun` | `true` | Auto-execute on slide load |

**Note:** For boolean `false` values, use the `:` prefix (Vue binding syntax): `:displayCode="false"`. Props default to `true` so you can omit them entirely when you want the default behavior.

### Vue Component (Advanced)

You can also use the components directly in Vue:

```vue
<template>
  <!-- Recommended: MarimoCell for notebook cells -->
  <MarimoCell cell="plot_chart" />

  <!-- MarimoLive for more options -->
  <MarimoLive
    cell="plot_chart"
    :display-code="true"
    :auto-run="true"
    code-position="top"
  />
</template>

<script setup>
import { MarimoCell, MarimoLive } from 'slidev-marimo-live'
</script>
```

### MarimoLive Props (Advanced)

| Prop | Default | Description |
|------|---------|-------------|
| `cell` | - | Reference a notebook cell by name, ID, or index |
| `code` | - | Inline Python code (only if `cell` not provided) |
| `displayCode` | `true` | Show the code editor |
| `autoRun` | `true` | Auto-execute on slide load |
| `codePosition` | `bottom` | Position of code: `top` or `bottom` |
| `cellId` | auto | Custom cell ID (only for inline code) |
| `hideLines` | `[]` | Line numbers to hide (e.g., `[1,2,3]`) |

## Configuration

### Custom Server URL

Set custom kernel configuration via window global (in your slidev setup):

```ts
// setup/main.ts
if (typeof window !== 'undefined') {
  window.__MARIMO_LIVE_CONFIG__ = {
    wsUrl: 'ws://localhost:3000/ws',
    httpUrl: 'http://localhost:3000',
    autoReconnect: true,
    maxReconnectAttempts: 10,
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `wsUrl` | `ws://localhost:2718/ws` | WebSocket URL |
| `httpUrl` | `http://localhost:2718` | HTTP API URL |
| `sessionId` | auto-generated | Session ID for persistence |
| `autoInstantiate` | `true` | Auto-instantiate notebook on connect |
| `autoReconnect` | `true` | Reconnect on disconnect |
| `maxReconnectAttempts` | `5` | Max reconnection attempts |
| `reconnectDelay` | `1000` | Base delay between reconnects (ms) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   SLIDEV PRESENTATION                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           MarimoCell / MarimoLive.vue              │ │
│  │  - Read-only code display                          │ │
│  │  - Run button / keyboard shortcuts                 │ │
│  │  - Output rendering                                │ │
│  └─────────────────────────┬──────────────────────────┘ │
│                            │                             │
│  ┌─────────────────────────┴──────────────────────────┐ │
│  │             useMarimoKernel (composable)           │ │
│  │  - runCell(code)                                   │ │
│  │  - interrupt()                                     │ │
│  │  - setUIValue(objectId, value)                     │ │
│  └─────────────────────────┬──────────────────────────┘ │
│                            │                             │
│  ┌─────────────────────────┴──────────────────────────┐ │
│  │           Kernel Connection Manager                │ │
│  │  - WebSocket: ws://localhost:2718/ws               │ │
│  │  - HTTP API: /api/kernel/run, /api/kernel/interrupt│ │
│  └─────────────────────────┬──────────────────────────┘ │
└────────────────────────────┼────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│                    MARIMO SERVER                        │
│                                                         │
│  - Full Python kernel                                   │
│  - All pip packages available                           │
│  - File system access                                   │
│  - Reactive cell execution                              │
└────────────────────────────────────────────────────────┘
```

## Composables

### useMarimoKernel

Main composable for kernel operations:

```ts
import { useMarimoKernel } from 'slidev-marimo-live'

const kernel = useMarimoKernel()

// Check connection
console.log(kernel.isConnected.value)
console.log(kernel.isKernelReady.value)

// Run code
const cellId = await kernel.runCell('print("Hello!")')

// Get cell output
const state = kernel.getCellState(cellId)
console.log(state?.output)

// Interrupt execution
await kernel.interrupt()
```

### useKernelState

Access reactive kernel state:

```ts
import { useKernelState } from 'slidev-marimo-live'

const { cellStates, variables, isKernelReady } = useKernelState()
```

## Comparison with slidev-marimo-islands

| Feature | marimo-live | marimo-islands |
|---------|-------------|----------------|
| Execution | Native Python kernel | WASM/Pyodide in browser |
| Startup time | ~100ms | 2-5 seconds |
| Package support | Full pip ecosystem | ~100 Pyodide packages |
| File access | Full filesystem | None |
| Server required | Yes (marimo) | No |
| Offline capable | No | Yes |
| State persistence | Across sessions | Lost on refresh |

## Development

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Format code
npm run format

# Start kernel for testing
npm run start-marimo
```

## License

MIT
