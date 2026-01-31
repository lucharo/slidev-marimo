/**
 * Preparser for marimo-live code blocks
 *
 * Transforms markdown code blocks with 'marimo-live' language tag into <MarimoLive> components.
 * This is only for INLINE CODE - not recommended. Use <MarimoCell> component instead.
 *
 * Example: Inline code (not recommended - prefer <MarimoCell> component)
 * ```marimo-live
 * import pandas as pd
 * df = pd.read_csv('data.csv')
 * df.head()
 * ```
 *
 * For referencing notebook cells, use the <MarimoCell> component syntax:
 * <MarimoCell cell="plot_chart" />
 * <MarimoCell cell="2" :displayCode="false" />
 */

import { definePreparserSetup } from "@slidev/types";

/**
 * Format a flag key-value pair for use in a Vue component tag.
 * Handles special cases like boolean values and kebab-case conversions.
 */
function formatFlag(key: string, value: string): string {
  if (value === "true" || value === "false") {
    return ` :${key}="${value}"`;
  }
  if (key === "hideLines") {
    return ` :hide-lines="${value}"`;
  }
  if (key === "codePosition") {
    return ` code-position="${value}"`;
  }
  if (key === "cellId") {
    return ` cell-id="${value}"`;
  }
  return ` ${key}="${value}"`;
}

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

            // Parse flags
            const flags: Record<string, string> = {};
            if (flagsString.trim()) {
              const flagMatches = flagsString.match(/(\w+)=([^\s]+)/g) || [];
              flagMatches.forEach((flag) => {
                const [key, value] = flag.split("=");
                flags[key] = value;
              });
            }

            const code = codeLines.join("\n").trimEnd();
            let componentTag: string;

            // Handle cell references (deprecated - prefer <MarimoCell> component)
            if (flags.cell) {
              // Log deprecation warning at build time
              console.warn(
                `[slidev-marimo-live] Deprecated: Use <MarimoCell cell="${flags.cell}" /> instead of \`\`\`marimo-live cell=${flags.cell}\`\`\``
              );

              // Backward compatibility: convert to MarimoCell component
              componentTag = `<MarimoCell cell="${flags.cell}"`;

              // Add other flags (excluding cell which is already handled)
              for (const [key, value] of Object.entries(flags)) {
                if (key === "cell") continue;
                componentTag += formatFlag(key, value);
              }
              componentTag += " />";
            } else if (code) {
              // Inline code - use MarimoLive
              const escapedCode = code
                .replace(/"/g, "&quot;")
                .replace(/\n/g, "&#10;");
              componentTag = `<MarimoLive code="${escapedCode}"`;

              // Add flags
              for (const [key, value] of Object.entries(flags)) {
                componentTag += formatFlag(key, value);
              }
              componentTag += " />";
            } else {
              // Empty code block with no cell reference - skip
              continue;
            }

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
