/**
 * Unified Preparser for marimo code blocks
 *
 * Transforms markdown code blocks into marimo components:
 *
 * 1. ```marimo blocks → <MarimoIsland> (Pyodide/WASM execution)
 * 2. ```marimo-live blocks → <MarimoLive> (WebSocket kernel execution)
 *
 * Islands Example:
 * ```marimo
 * import marimo as mo
 * mo.md('Hello from Python!')
 * ```
 *
 * Live Example:
 * ```marimo-live cell=plot_chart
 * ```
 */

import { definePreparserSetup } from "@slidev/types";

export default definePreparserSetup(() => {
  return [
    {
      transformRawLines(lines: string[]) {
        const result: string[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];

          // Check for marimo-live code block first (more specific match)
          const liveMatch = line.trim().match(/^```marimo-live\s*(.*)$/);
          if (liveMatch) {
            const flagsString = liveMatch[1];
            const codeLines: string[] = [];
            i++; // Skip the opening ```marimo-live

            while (i < lines.length && lines[i].trim() !== "```") {
              codeLines.push(lines[i]);
              i++;
            }
            i++; // Skip the closing ```

            // Parse flags
            const flags: Record<string, string> = {};
            if (flagsString.trim()) {
              const flagMatches = flagsString.match(/(\w+)=([^\s]+)/g) || [];
              for (const flag of flagMatches) {
                const [key, value] = flag.split("=");
                flags[key] = value;
              }
            }

            // Build MarimoLive component tag
            let componentTag = "<MarimoLive";

            if (flags.cell) {
              componentTag += ` cell="${flags.cell}"`;
              const code = codeLines.join("\n").trimEnd();
              if (code) {
                const escapedCode = code
                  .replace(/"/g, "&quot;")
                  .replace(/\n/g, "&#10;");
                componentTag += ` code="${escapedCode}"`;
              }
            } else {
              const code = codeLines.join("\n").trimEnd();
              const escapedCode = code
                .replace(/"/g, "&quot;")
                .replace(/\n/g, "&#10;");
              componentTag += ` code="${escapedCode}"`;
            }

            // Add other flags
            for (const [key, value] of Object.entries(flags)) {
              if (key === "cell") continue;
              if (value === "true" || value === "false") {
                componentTag += ` :${key}="${value}"`;
              } else if (key === "hideLines") {
                componentTag += ` :hide-lines="${value}"`;
              } else if (key === "codePosition") {
                componentTag += ` code-position="${value}"`;
              } else if (key === "cellId") {
                componentTag += ` cell-id="${value}"`;
              } else {
                componentTag += ` ${key}="${value}"`;
              }
            }

            componentTag += " />";
            result.push(componentTag);
            continue;
          }

          // Check for marimo (islands) code block
          const islandsMatch = line.trim().match(/^```marimo\s*(.*)$/);
          if (islandsMatch) {
            const flagsString = islandsMatch[1];
            const codeLines: string[] = [];
            i++; // Skip the opening ```marimo

            while (i < lines.length && lines[i].trim() !== "```") {
              codeLines.push(lines[i]);
              i++;
            }
            i++; // Skip the closing ```

            // Join the code lines and escape for HTML attribute
            const code = codeLines.join("\n").trimEnd();
            const escapedCode = code
              .replace(/"/g, "&quot;")
              .replace(/\n/g, "&#10;");

            // Build MarimoIsland component tag
            let componentTag = `<MarimoIsland code="${escapedCode}"`;

            if (flagsString.trim()) {
              const flags = flagsString.match(/(\w+)=([^\s]+)/g) || [];
              for (const flag of flags) {
                const [key, value] = flag.split("=");
                if (value === "true" || value === "false") {
                  componentTag += ` :${key}="${value}"`;
                } else if (key === "hideLines") {
                  const normalized = value.startsWith("[") ? value : `[${value}]`;
                  componentTag += ` :hide-lines="${normalized}"`;
                } else if (key === "codePosition") {
                  componentTag += ` code-position="${value}"`;
                } else {
                  componentTag += ` ${key}="${value}"`;
                }
              }
            }

            componentTag += " />";
            result.push(componentTag);
            continue;
          }

          // Regular line, keep as-is
          result.push(line);
          i++;
        }

        // Replace the original lines array contents
        lines.length = 0;
        lines.push(...result);
      },
    },
  ];
});
