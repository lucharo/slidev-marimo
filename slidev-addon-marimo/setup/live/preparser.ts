/**
 * Preparser for marimo-live code blocks
 *
 * Transforms markdown code blocks with 'marimo-live' language tag into <MarimoLive> components
 *
 * Example 1: Reference a notebook cell by name
 * ```marimo-live cell=plot_chart
 * ```
 *
 * Example 2: Reference a notebook cell by index
 * ```marimo-live cell=2
 * ```
 *
 * Example 3: Inline code (less recommended)
 * ```marimo-live
 * import pandas as pd
 * df = pd.read_csv('data.csv')
 * df.head()
 * ```
 *
 * Supported flags:
 * - cell=name: Reference a notebook cell by name, ID, or index
 * - displayCode=false: Hide the code editor
 * - autoRun=true: Run code automatically on mount
 * - codePosition=top: Show code above output
 * - cellId=my_cell: Use a specific cell ID (only with inline code)
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

          // Check if this line starts a marimo-live code block (with optional flags)
          const marimoMatch = line.trim().match(/^```marimo-live\s*(.*)$/);
          if (marimoMatch) {
            const flagsString = marimoMatch[1];

            // Collect all lines until we find the closing ```
            const codeLines: string[] = [];
            i++; // Skip the opening ```marimo-live

            while (i < lines.length && lines[i].trim() !== "```") {
              codeLines.push(lines[i]);
              i++;
            }

            // i now points to the closing ```, skip it
            i++;

            // Parse flags first to check for cell reference
            const flags: Record<string, string> = {};
            if (flagsString.trim()) {
              const flagMatches = flagsString.match(/(\w+)=([^\s]+)/g) || [];
              flagMatches.forEach((flag) => {
                const [key, value] = flag.split("=");
                flags[key] = value;
              });
            }

            // Build component tag
            let componentTag = "<MarimoLive";

            // If cell reference is provided, use it instead of inline code
            if (flags.cell) {
              componentTag += ` cell="${flags.cell}"`;

              // If there's also inline code, include it as fallback
              const code = codeLines.join("\n").trimEnd();
              if (code) {
                const escapedCode = code
                  .replace(/"/g, "&quot;")
                  .replace(/\n/g, "&#10;");
                componentTag += ` code="${escapedCode}"`;
              }
            } else {
              // No cell reference - use inline code
              const code = codeLines.join("\n").trimEnd();
              const escapedCode = code
                .replace(/"/g, "&quot;")
                .replace(/\n/g, "&#10;");
              componentTag += ` code="${escapedCode}"`;
            }

            // Add other flags
            for (const [key, value] of Object.entries(flags)) {
              if (key === "cell") continue; // Already handled

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

            // Add the MarimoLive component
            result.push(componentTag);
          } else {
            // Regular line, keep as-is
            result.push(line);
            i++;
          }
        }

        // Replace the original lines array contents
        lines.length = 0;
        lines.push(...result);
      },
    },
  ];
});
