---
theme: default
addons:
  - slidev-marimo-islands
---

# Marimo Islands Demo

Basic Python code execution in Slidev with HMR support.

```marimo
import marimo as mo
```

---

# Hello World

```marimo
mo.md('Hello from Python!')
```

---

# Interactive Widget

Self-contained slider with markdown output:

```marimo
slider = mo.ui.slider(0, 100)
slider
```

```marimo
mo.md(f'Slider value: **{slider.value}**')
```

---

# DataFrame component

Using marimo's built-in dataframe explorer

```marimo
import pandas as pd
data = pd.DataFrame({
  "a": [1, 4, 2, 8, 5],
  "b": [-1,2,-3,-4,10]
})
data
```

---

# Markdown Block Options

You can pass options directly in marimo code blocks:

```marimo displayCode=false
mo.md('Hidden code, visible output')
```

---

# Component Advanced Options

Using the `<MarimoIsland>` component with props:

- `code` - Python code to execute (required)
- `displayCode` - Show/hide source code (default: `true`)  
- `hideLines` - Hide specific lines by index (1-indexed)

Hide specific lines:

```marimo hideLines=1
# this comment won't show
setup_result = 42
mo.md(f'Result: {setup_result}')
```

Hide all code, show output only:

<MarimoIsland
  code="mo.md('📊 Output only - no code visible')"
  :display-code="false"
/>
