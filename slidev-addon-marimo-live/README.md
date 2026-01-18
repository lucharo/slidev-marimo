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
# Using the provided script
./slidev-addon-marimo-live/scripts/start-kernel.sh notebook.py

# Or manually
marimo edit notebook.py --headless --port 2718 --no-token --allow-origins "*"
```

### 3. Use in your slides

```markdown
---
# My Slide

```marimo-live
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'x': np.random.randn(100),
    'y': np.random.randn(100)
})
df.describe()
```
---
```

## Usage

### Referencing Notebook Cells (Recommended)

The best way to use marimo-live is to reference cells from your marimo notebook. This keeps your code in one place with full IDE support.

```markdown
# Reference by cell name (function name in marimo)
```marimo-live cell=plot_chart
```

# Reference by index (0-based)
```marimo-live cell=2
```

# With options
```marimo-live cell=plot_chart displayCode=false
```
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

### Inline Code (Alternative)

You can also write code directly in the slides, but this is less recommended:

```markdown
```marimo-live
import pandas as pd
df = pd.read_csv('data.csv')
df.head()
```
```

### Supported Flags

| Flag | Default | Description |
|------|---------|-------------|
| `cell` | - | Reference a notebook cell by name, ID, or index |
| `displayCode` | `true` | Show the code editor |
| `autoRun` | `true` | Auto-execute on slide load |
| `codePosition` | `bottom` | Position of code: `top` or `bottom` |
| `cellId` | auto | Custom cell ID (only for inline code) |
| `hideLines` | `[]` | Line numbers to hide (e.g., `[1,2,3]`) |

Example with flags:

```markdown
```marimo-live cell=data_viz displayCode=false autoRun=true
```
```

### Vue Component

You can also use the component directly:

```vue
<template>
  <!-- Reference a notebook cell -->
  <MarimoLive cell="plot_chart" />

  <!-- Or use inline code -->
  <MarimoLive
    :code="code"
    :display-code="true"
    :auto-run="true"
    code-position="top"
  />
</template>

<script setup>
import { MarimoLive } from 'slidev-marimo-live'

const code = `
import pandas as pd
df = pd.read_csv('data.csv')
df.head()
`
</script>
```

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
│  │                 MarimoLive.vue                      │ │
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
