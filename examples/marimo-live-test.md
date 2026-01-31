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

<MarimoCell cell="slider_demo" />

<MarimoCell cell="slider_output" />

---

# Load Data

First, let's load the Titanic dataset (shared across slides).

<MarimoCell cell="load_titanic" />

---

# Dropdown + Altair Chart

Select a column to visualize.

<MarimoCell cell="dropdown_demo" />

<MarimoCell cell="chart_demo" />

---

# Data Explorer

Browse and filter the Titanic dataset interactively.

<MarimoCell cell="data_explorer_demo" />

---

# Checkbox & Switch

Toggle states that react immediately.

<MarimoCell cell="checkbox_demo" />

<MarimoCell cell="checkbox_output" />

---

# Text Input

Type your name and see a greeting.

<MarimoCell cell="text_input_demo" />

<MarimoCell cell="text_output" />

---

# How It Works

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Slidev        │◄──────────────────►│  Marimo Kernel  │
│   (Browser)     │                    │  (Python)       │
└─────────────────┘                    └─────────────────┘
```

- Write code in your marimo notebook
- Reference cells by name in slides
- Full Python kernel running locally
- UI elements sync bidirectionally

---

# Get Started

```bash
# Start the marimo kernel
marimo edit notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*"

# Start slidev
slidev slides.md
```

Reference cells with the `<MarimoCell>` component:

```markdown
<MarimoCell cell="plot_chart" />
<MarimoCell cell="2" :displayCode="false" />
```

---

# Thanks!

**slidev-addon-marimo-live**

Live Python notebooks in your presentations.
