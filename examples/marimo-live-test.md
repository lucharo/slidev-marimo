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

```marimo-live cell=slider_demo
```

```marimo-live cell=slider_output
```

---

# Load Data

First, let's load the Titanic dataset (shared across slides).

```marimo-live cell=load_titanic
```

---

# Dropdown + Altair Chart

Select a column to visualize.

```marimo-live cell=dropdown_demo
```

```marimo-live cell=chart_demo
```

---

# Data Explorer

Browse and filter the Titanic dataset interactively.

```marimo-live cell=data_explorer_demo
```

---

# Checkbox & Switch

Toggle states that react immediately.

```marimo-live cell=checkbox_demo
```

```marimo-live cell=checkbox_output
```

---

# Text Input

Type your name and see a greeting.

```marimo-live cell=text_input_demo
```

```marimo-live cell=text_output
```

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

Reference cells by name:

~~~markdown
```marimo-live cell=plot_chart
```
~~~

---

# Thanks!

**slidev-addon-marimo-live**

Live Python notebooks in your presentations.
