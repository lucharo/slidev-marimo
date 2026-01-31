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

# Interactive Widgets

Multiple widgets in a horizontal stack:

```marimo
slider = mo.ui.slider(0, 100, label="Slider")
dropdown = mo.ui.dropdown(["Apple", "Banana", "Cherry"], label="Fruit")
date = mo.ui.date(label="Date")
mo.hstack([slider, dropdown, date])
```

```marimo displayCode=false
mo.md(f'''
**Values:** Slider: {slider.value} | Dropdown: {dropdown.value} | Date: {date.value}
''')
```

---

# DrawData by wigglystuff

Draw your data, see it plotted! Built with [wigglystuff](https://github.com/koaning/wigglystuff) by Vincent Warmerdam.

<div class="grid grid-cols-2 gap-8">
<div>

```marimo hideLines=1,2
import micropip
await micropip.install(['drawdata']);
from drawdata import ScatterWidget
widget = mo.ui.anywidget(ScatterWidget())
widget
```

</div>
<div>

```marimo displayCode=false
import altair as alt
df = widget.data_as_pandas
if df is not None and len(df) > 0:
    chart = alt.Chart(df).mark_circle(size=60).encode(
        x='x', y='y', color='color'
    ).properties(width=350, height=280)
    mo.output.replace(chart)
else:
    mo.md("*Draw some points to see them plotted!*")
```

</div>
</div>

---

# DataFrame component

Using marimo's built-in dataframe explorer - try sorting by clicking column headers!

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
