# Justfile for slidev-marimo development

# Clear all caches and reinstall dependencies
clear-cache:
    @echo "Clearing Vite cache..."
    rm -rf node_modules/.vite 2>/dev/null || true
    @echo "Reinstalling local packages..."
    bun install
    @echo "Cache cleared!"

# Restart slidev with fresh cache
restart-slidev: clear-cache
    @echo "Killing existing slidev..."
    pkill -f "slidev examples/marimo-live-test.md" 2>/dev/null || true
    sleep 1
    @echo "Starting slidev..."
    (sleep 86400 | bun run slidev examples/marimo-live-test.md --port 3033) &
    sleep 5
    @echo "Slidev running at http://localhost:3033"

# Restart marimo kernel with sandbox
restart-kernel:
    @echo "Killing existing kernel..."
    lsof -i :2718 -t | xargs kill 2>/dev/null || true
    sleep 1
    @echo "Starting marimo kernel..."
    (sleep 86400 | uv run marimo edit examples/notebook.py --sandbox --headless --port 2718 --no-token --allow-origins "*") &
    sleep 8
    @echo "Kernel running at http://localhost:2718"

# Restart both kernel and slidev
restart-all: restart-kernel restart-slidev

# Check if services are running
status:
    @echo "Marimo kernel (port 2718):"
    @lsof -i :2718 -sTCP:LISTEN 2>/dev/null || echo "  Not running"
    @echo "Slidev (port 3033):"
    @lsof -i :3033 -sTCP:LISTEN 2>/dev/null || echo "  Not running"
