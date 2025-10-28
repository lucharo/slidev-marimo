---
theme: default
addons:
  - /Users/luischavesrodriguez/slidev-presentation/slidev-addon-marimo-islands
---

# Marimo Islands Demo

Basic Python code execution in Slidev with HMR support.

<MarimoIsland code="import marimo as mo; mo.md('Hello from Python!')" />

---

# Interactive Widget

Hidden code, showing only the interactive slider output.

<MarimoIsland
  code="slider = mo.ui.slider(0, 100); slider"
  :display-code="true"
/>

<MarimoIsland
  code="mo.md(f'Slider value: **{slider.value}**')"
  :display-code="true"
/>

---

# Markdown Code Block Syntax

The new ergonomic way to write marimo islands!

```marimo
mo.md('''
## Markdown Code Blocks
This island was created using ```marimo syntax!
''')
```

---

# Some `pandas` code

```marimo
import pandas as pd
df = pd.DataFrame({'a': [1,2,3], 'b': [0,9,8]})
df
```
