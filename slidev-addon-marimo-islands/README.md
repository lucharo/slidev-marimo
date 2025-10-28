# slidev-addon-marimo-islands

Embed interactive [marimo](https://marimo.io) Python code cells in your Slidev presentations using Pyodide/WASM. No server required!

## Features

- ✨ Run Python code directly in your slides using Pyodide (WASM)
- 🎨 Full marimo UI support (sliders, inputs, plots, etc.)
- 📦 Self-contained - works offline after initial load
- 📝 Ergonomic markdown code block syntax (` ```marimo `)
- 🔒 Control code visibility and hide specific lines
- 🚀 Easy to use with simple Vue component

## Installation

```bash
npm install slidev-addon-marimo-islands
```

## Usage

Add the addon to your `slides.md` frontmatter:

```yaml
---
addons:
  - slidev-addon-marimo-islands
---
```

Then use either the ergonomic **markdown code block syntax** or the `<MarimoIsland>` component in your slides:

### Markdown Code Block Syntax (Recommended)

The easiest way to add Python code to your slides:

`````markdown
# Interactive Python

Just use a code block with `marimo` language tag:

```marimo
import marimo as mo
slider = mo.ui.slider(0, 100)
slider
```

---

# Data Visualization

```marimo
import pandas as pd
import matplotlib.pyplot as plt

data = pd.DataFrame({'x': [1, 2, 3], 'y': [10, 20, 30]})
plt.plot(data['x'], data['y'])
plt.show()
```
`````

### Component Syntax (Alternative)

You can also use the `<MarimoIsland>` component directly for more control:

````markdown
# Interactive Python Demo

<MarimoIsland
  code="import marimo as mo; slider = mo.ui.slider(0, 10); slider"
  :display-code="false"
/>
````

## Component API

### `<MarimoIsland>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | **required** | Python code to execute |
| `displayCode` | `boolean` | `true` | Show the code in the slide |
| `hideLines` | `number[]` | `[]` | Array of line numbers to hide (1-based) |
| `reactive` | `boolean` | `true` | Enable Pyodide execution (false = static) |
| `appId` | `string` | `'slidev-app'` | App ID for grouping related cells |

### Examples

**Simple Interactive Widget:**
```vue
<MarimoIsland
  code="import marimo as mo; mo.ui.slider(0, 100, value=50)"
  :display-code="false"
/>
```

**Hide Import Statements:**
```vue
<MarimoIsland
  :hide-lines="[1, 2]"
  code="
import pandas as pd
import numpy as np
df = pd.DataFrame({'a': [1, 2, 3]})
df.head()
  "
/>
```

**Static Code Display (No Execution):**
```vue
<MarimoIsland
  :reactive="false"
  code="print('This code is not executed, just displayed')"
/>
```

## How It Works

1. The addon loads marimo islands JavaScript bundle from CDN
2. Custom web components (`<marimo-island>`) are registered with Vue
3. Python code runs in Pyodide (Python compiled to WebAssembly)
4. Marimo's reactive runtime manages cell dependencies

## Limitations

- **Startup time**: Pyodide takes 2-5 seconds to initialize
- **Package support**: Only packages available in Pyodide
- **Performance**: Slower than native Python
- **State isolation**: Each slide has its own kernel by default

## Tips & Tricks

**Share state across slides:** Use the same `appId`:

```vue
<!-- Slide 1 -->
<MarimoIsland
  app-id="my-app"
  code="x = 42"
/>

<!-- Slide 2 -->
<MarimoIsland
  app-id="my-app"
  code="print(f'x from previous slide: {x}')"
/>
```

**Preload heavy computations:** Put expensive imports on an early slide:

```vue
<MarimoIsland
  :display-code="false"
  code="import pandas as pd; import numpy as np; import matplotlib.pyplot as plt"
/>
```

## Troubleshooting

**Islands not loading:**
- Check browser console for errors
- Ensure internet connection (CDN required on first load)
- Try refreshing the page

**Pyodide timeout:**
- Pyodide can take time to load. Wait 5-10 seconds on first slide with islands

**Package not found:**
- Check if package is available in Pyodide: https://pyodide.org/en/stable/usage/packages-in-pyodide.html
- Use `micropip` to install additional packages: `import micropip; await micropip.install('package-name')`

## Known Issues

**Hot Module Reload (HMR):**
- When adding or removing `<MarimoIsland>` components during development, you'll need to **manually refresh** the page (Cmd+R / Ctrl+R)
- This is by design for simplicity and to avoid infinite reload loops
- Changing props (like `:display-code` or `code` content) without changing the number of islands uses Vite's HMR automatically
- This only affects development; production builds are not impacted

## License

MIT

## Related

- [marimo](https://marimo.io) - Reactive Python notebooks
- [Slidev](https://sli.dev) - Presentation slides for developers
- [slidev-addon-marimo-notebook](../slidev-addon-marimo-notebook) - Connect to running marimo notebooks
