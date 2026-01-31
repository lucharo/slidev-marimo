import marimo

__generated_with = "0.11.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def plain_text():
    """Cell that outputs plain text"""
    print("Hello from marimo!")
    return


@app.cell
def valid_json():
    """Cell that outputs valid JSON"""
    import json
    data = {"name": "test", "values": [1, 2, 3], "nested": {"a": 1, "b": 2}}
    print(json.dumps(data))
    return


@app.cell
def markdown_output(mo):
    """Cell that outputs markdown content"""
    mo.md("""
# Markdown Test

This is **bold** and this is *italic*.

- Item 1
- Item 2
- Item 3

```python
print("code block")
```
""")
    return


@app.cell
def counter_demo(mo):
    """Interactive counter for testing multiple executions"""
    import time

    # Add a small delay to make double-execution visible
    time.sleep(0.1)

    result = f"Executed at: {time.strftime('%H:%M:%S.%f' if hasattr(time, 'strftime') else '%H:%M:%S')}"
    print(result)
    mo.md(f"**Execution timestamp:** {time.time()}")
    return


@app.cell
def interactive_slider(mo):
    """Interactive slider widget"""
    slider = mo.ui.slider(0, 100, value=50, label="Value")
    slider
    return (slider,)


@app.cell
def slider_output(mo, slider):
    """Shows slider value"""
    mo.md(f"Slider value: **{slider.value}**")
    return


if __name__ == "__main__":
    app.run()
