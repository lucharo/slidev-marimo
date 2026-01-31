---
theme: default
addons:
  - slidev-marimo-live
highlighter: shiki
---

# Marimo Live

Interactive Python notebooks embedded in your slides

---

# Interactive Slider

Drag the slider and watch the output update in real-time.

```marimo-live
import marimo as mo
slider = mo.ui.slider(1, 100, value=50, label="Select a number")
slider
```

```marimo-live
squared = slider.value ** 2
mo.md(f"**Value:** {slider.value} | **Squared:** {squared}")
```

---

# Load Data

First, let's load the Titanic dataset (shared across slides).

```marimo-live
import polars as pl

url = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"
titanic = pl.read_csv(url)
titanic.head()
```

---

# Dropdown + Altair Chart

Select a column to visualize.

```marimo-live
dropdown = mo.ui.dropdown(
    options=["Survived", "Pclass", "Sex", "Age", "Fare"],
    value="Survived",
    label="Select column"
)
dropdown
```

```marimo-live
import altair as alt

col = dropdown.value or "Survived"

if col in ["Age", "Fare"]:
    chart = alt.Chart(titanic.to_pandas()).mark_bar().encode(
        alt.X(f"{col}:Q", bin=True), y="count()"
    ).properties(width=500, height=250)
else:
    chart = alt.Chart(titanic.to_pandas()).mark_bar().encode(
        x=f"{col}:N", y="count()"
    ).properties(width=500, height=250)

mo.ui.altair_chart(chart)
```

---

# Data Explorer

Browse and filter the Titanic dataset interactively.

```marimo-live
mo.ui.dataframe(titanic)
```

---

# Checkbox & Switch

Toggle states that react immediately.

```marimo-live
check = mo.ui.checkbox(label="Enable feature")
switch = mo.ui.switch(label="Dark mode")
mo.hstack([check, switch])
```

```marimo-live
mo.md(f"Checkbox: **{check.value}** | Switch: **{switch.value}**")
```

---

# Text Input

Type your name and see a greeting.

```marimo-live
text = mo.ui.text(placeholder="Type something...", label="Name")
text
```

```marimo-live
mo.md(f"# Hello, {text.value}!" if text.value else "_Enter your name above_")
```

---

# How It Works

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Slidev        │◄──────────────────►│  Marimo Kernel  │
│   (Browser)     │                    │  (Python)       │
└─────────────────┘                    └─────────────────┘
```

- Full Python kernel running locally
- Any package: polars, altair, scikit-learn...
- UI elements sync bidirectionally
- Cells react to each other automatically

---

# Get Started

```bash
# Start the marimo kernel
marimo edit notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*"

# Start slidev
slidev slides.md
```

Add the addon to your slides:

```yaml
---
addons:
  - slidev-marimo-live
---
```

---

# Thanks!

**slidev-addon-marimo-live**

Live Python notebooks in your presentations.
