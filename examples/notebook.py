# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "polars",
#     "altair",
#     "pyarrow",
#     "pandas",
# ]
# ///

import marimo

__generated_with = "0.11.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def imports():
    """Load data libraries"""
    import polars as pl
    import altair as alt
    return pl, alt


@app.cell
def load_titanic(pl):
    """Load Titanic dataset"""
    url = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"
    titanic = pl.read_csv(url)
    titanic
    return (titanic,)


@app.cell
def slider_demo(mo):
    """Interactive slider"""
    slider = mo.ui.slider(1, 100, value=50, label="Select a number")
    slider
    return (slider,)


@app.cell
def slider_output(mo, slider):
    """Show slider value with calculation"""
    squared = slider.value ** 2
    return mo.md(f"""
**Value:** {slider.value}
**Squared:** {squared}
""")


@app.cell
def dropdown_demo(mo):
    """Dropdown selector"""
    dropdown = mo.ui.dropdown(
        options=["Survived", "Pclass", "Sex", "Age", "Fare"],
        value="Survived",
        label="Select column"
    )
    dropdown
    return (dropdown,)


@app.cell
def chart_demo(mo, alt, titanic, dropdown):
    """Altair chart based on dropdown selection"""
    col = dropdown.value

    if col in ["Age", "Fare"]:
        chart = alt.Chart(titanic.to_pandas()).mark_bar().encode(
            alt.X(f"{col}:Q", bin=True),
            y="count()"
        ).properties(width=400, height=200)
    else:
        chart = alt.Chart(titanic.to_pandas()).mark_bar().encode(
            x=f"{col}:N",
            y="count()"
        ).properties(width=400, height=200)

    return mo.ui.altair_chart(chart)


@app.cell
def data_explorer_demo(mo, titanic):
    """Data explorer for Titanic dataset"""
    return mo.ui.dataframe(titanic)


@app.cell
def checkbox_demo(mo):
    """Checkbox and switch demo"""
    check = mo.ui.checkbox(label="Enable feature")
    switch = mo.ui.switch(label="Dark mode")
    mo.hstack([check, switch])
    return check, switch


@app.cell
def checkbox_output(mo, check, switch):
    """Show checkbox/switch state"""
    return mo.md(f"Checkbox: **{check.value}** | Switch: **{switch.value}**")


@app.cell
def text_input_demo(mo):
    """Text input demo"""
    text = mo.ui.text(placeholder="Type something...", label="Name")
    text
    return (text,)


@app.cell
def text_output(mo, text):
    """Greet the user"""
    return mo.md(f"Hello, **{text.value}**!" if text.value else "_Enter your name above_")


@app.cell
def greeting_input(mo):
    """Text input for greeting"""
    name_input = mo.ui.text(value="marimonaut 🧑‍🚀", label="Enter your name")
    name_input
    return (name_input,)


@app.cell
def greeting_output(mo, name_input):
    """Display personalized greeting"""
    # Use the UI element's value with a fallback
    name = name_input.value if name_input.value else "World"
    mo.md(f"# Hello, {name}!")
    return


if __name__ == "__main__":
    app.run()
