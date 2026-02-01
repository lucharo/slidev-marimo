---
theme: default
addons:
  - slidev-marimo-islands
---

# Marimo Islands Demo <img src="https://marimo.io/logo.png" style="height: 1em; vertical-align: middle; margin-left: 0.3em;" />

Basic Python code execution in Slidev.

<small style="opacity: 0.6;">Not affiliated with marimo — just a contributor to the project</small>

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

<div class="grid grid-cols-5 gap-8">
<div class="col-span-2">

```marimo displayOutput=false
import pandas as pd
data = pd.DataFrame({
  "a": [1, 4, 2, 8, 5],
  "b": [-1,2,-3,-4,10]
})
```

</div>
<div class="col-span-3">

```marimo displayCode=false
data
```

</div>
</div>

---

# Two Ways to Define Cells

<div class="grid grid-cols-2 gap-8">
<div>

**1. Markdown code fence** (recommended)

<pre><code>&#96;&#96;&#96;marimo
mo.md('Hello!')
&#96;&#96;&#96;</code></pre>

With options:

<pre><code>&#96;&#96;&#96;marimo displayCode=false
mo.md('Hidden code')
&#96;&#96;&#96;</code></pre>

</div>
<div>

**2. Vue component**

<pre><code>&lt;MarimoIsland
  code="mo.md('Hello!')"
  :display-code="false"
/&gt;</code></pre>

</div>
</div>

**Options:** `displayCode`, `displayOutput`, `hideLines`
