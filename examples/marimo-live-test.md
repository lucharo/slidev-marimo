---
theme: default
addons:
  - slidev-addon-marimo
---

# Marimo Live Bug Fix Validation

Testing the 5 bug fixes in slidev-addon-marimo

---

# Test 1: Double Execution Prevention

Click the Run button multiple times rapidly. Should only execute once.

```marimo-live autoRun=false
import time
print(f"Executed at: {time.time()}")
```

**Expected:** Console shows single execution, not multiple.

---

# Test 2: Plain Text Output

Basic text output with auto-run.

```marimo-live
print("Hello from marimo!")
print("Plain text output works!")
```

---

# Test 3: Markdown Mimetype Support

Tests that markdown content renders correctly.

```marimo-live
import marimo as mo
mo.md("""
# Markdown Test

This is **bold** and this is *italic*.

- Item 1
- Item 2
- Item 3
""")
```

**Expected:** Rendered markdown with headings, bold, italic, and list.

---

# Test 4: JSON Output Handling

Tests valid JSON formatting.

```marimo-live
import json
data = {"name": "test", "values": [1, 2, 3], "nested": {"a": 1, "b": 2}}
print(json.dumps(data))
```

**Expected:** Pretty-printed JSON output.

---

# Test 5: Inline Code with Manual Run

Inline code (not from notebook) to test auto-run=false.

```marimo-live autoRun=false
print("Manual run test")
import json
# This outputs invalid JSON-like string to test error handling
print("{not valid json")
```

**Expected:** Click Run to execute. Invalid JSON shows as raw text.

---

# Test 6: Interactive Slider

Interactive widget to test UI element communication.

```marimo-live
import marimo as mo
slider = mo.ui.slider(0, 100, value=50, label="Value")
slider
```

```marimo-live
import marimo as mo
mo.md(f"Slider interaction test")
```

---

# Test 7: Timeout Cleanup Test

Navigate away from this slide and back.
No console errors should appear about unmounted components.

```marimo-live autoRun=true
print("Timeout cleanup test cell")
```

**Instructions:**
1. Navigate to next slide
2. Come back
3. Check browser console for cleanup errors

---

# Test 8: Reconnection Test

Test that reconnection works after disconnect.

```marimo-live autoRun=false
import time
print(f"Reconnection test: {time.time()}")
```

**Instructions:**
1. Stop the marimo kernel (Ctrl+C in terminal)
2. Wait for "Not connected" warning
3. Restart kernel
4. Click Reconnect button
5. Verify it reconnects and works

---

# Summary

| Bug Fix | Test Method |
|---------|-------------|
| Double execution race | Rapid click Run button on slide 2 |
| Timeout cleanup | Navigate between slides 7-8, check console |
| reconnectAttempts reset | Disconnect/reconnect on slide 8 |
| JSON parse error | Run invalid JSON code on slide 5 |
| Markdown mimetype | View rendered markdown on slide 3 |

---

# End

All tests completed!
