/**
 * Preparser for marimo code blocks
 *
 * Transforms markdown code blocks with 'marimo' language tag into <MarimoIsland> components
 *
 * Example:
 * ```marimo
 * import marimo as mo
 * mo.md('Hello from Python!')
 * ```
 *
 * Becomes:
 * <MarimoIsland code="import marimo as mo
 * mo.md('Hello from Python!')" />
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

          // Check if this line starts a marimo code block (with optional flags)
          const marimoMatch = line.trim().match(/^```marimo\s*(.*)$/);
          if (marimoMatch) {
            const flagsString = marimoMatch[1];
            // Collect all lines until we find the closing ```
            const codeLines: string[] = [];
            i++; // Skip the opening ```marimo

            while (i < lines.length && lines[i].trim() !== "```") {
              codeLines.push(lines[i]);
              i++;
            }

            // i now points to the closing ```, skip it
            i++;

            // Join the code lines and escape for HTML attribute
            const code = codeLines.join("\n").trimEnd();
            const escapedCode = code
              .replace(/"/g, "&quot;")
              .replace(/\n/g, "&#10;");

            // Parse flags if present
            let componentTag = `<MarimoIsland code="${escapedCode}"`;

            if (flagsString.trim()) {
              // Parse key=value pairs separated by spaces
              const flags = flagsString.match(/(\w+)=([^\s]+)/g) || [];
              flags.forEach((flag) => {
                const [key, value] = flag.split("=");
                // Convert string values to proper types
                if (value === "true" || value === "false") {
                  componentTag += ` :${key}="${value}"`;
                } else if (key === "hideLines") {
                  // Parse hideLines as JSON array
                  componentTag += ` :hide-lines="${value}"`;
                } else {
                  componentTag += ` ${key}="${value}"`;
                }
              });
            }

            componentTag += " />";

            // Add the MarimoIsland component
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
