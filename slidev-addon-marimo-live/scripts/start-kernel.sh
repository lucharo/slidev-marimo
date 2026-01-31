#!/bin/bash
#
# Start Marimo Kernel for Slidev Integration
#
# This script starts a marimo server in headless mode with the correct
# configuration for Slidev integration.
#
# Usage:
#   ./scripts/start-kernel.sh [notebook.py] [port]
#
# Arguments:
#   notebook.py - Path to the marimo notebook (default: notebook.py)
#   port        - Port to run the server on (default: 2718)
#
# Example:
#   ./scripts/start-kernel.sh my_notebook.py 3000

set -e

NOTEBOOK="${1:-notebook.py}"
PORT="${2:-2718}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Marimo Kernel${NC}"
echo "========================="
echo ""
echo "Notebook: $NOTEBOOK"
echo "Port:     $PORT"
echo ""

# Check if marimo is installed
if ! command -v marimo &> /dev/null; then
    echo -e "${RED}Error: marimo is not installed${NC}"
    echo ""
    echo "Install marimo with:"
    echo "  pip install marimo"
    echo ""
    exit 1
fi

# Check if notebook exists
if [ ! -f "$NOTEBOOK" ]; then
    echo -e "${YELLOW}Warning: Notebook '$NOTEBOOK' not found${NC}"
    echo ""
    echo "Creating a new notebook..."
    echo ""

    # Create a simple starter notebook
    cat > "$NOTEBOOK" << 'EOF'
import marimo

__generated_with = "0.11.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def _(mo):
    mo.md("# Welcome to Marimo Live!")
    return


@app.cell
def _():
    # Your code here
    print("Hello from Marimo!")
    return


if __name__ == "__main__":
    app.run()
EOF

    echo -e "${GREEN}Created starter notebook: $NOTEBOOK${NC}"
    echo ""
fi

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port $PORT is already in use${NC}"
    echo ""
    echo "You can either:"
    echo "  1. Stop the existing process: lsof -ti :$PORT | xargs kill"
    echo "  2. Use a different port: ./start-kernel.sh $NOTEBOOK <new-port>"
    echo ""

    read -p "Kill existing process and continue? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti :$PORT | xargs kill 2>/dev/null || true
        sleep 1
    else
        exit 1
    fi
fi

echo -e "${GREEN}Starting marimo server...${NC}"
echo ""
echo "Connect your Slidev presentation to:"
echo "  WebSocket: ws://localhost:$PORT/ws"
echo "  HTTP API:  http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start marimo with the required flags for Slidev integration
# --headless: Don't open browser
# --port: Specify port
# --no-token: Disable authentication (for local dev)
# --allow-origins: Allow CORS from Slidev dev server
exec marimo edit "$NOTEBOOK" \
    --headless \
    --port "$PORT" \
    --no-token \
    --no-skew-protection \
    --allow-origins "*"
