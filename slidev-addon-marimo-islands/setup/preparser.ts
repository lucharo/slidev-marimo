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

import { definePreparserSetup } from '@slidev/types'

export default definePreparserSetup(() => {
  return [
    {
      transformRawLines(lines: string[]) {
        const result: string[] = []
        let i = 0

        while (i < lines.length) {
          const line = lines[i]

          // Check if this line starts a marimo code block
          if (line.trim() === '```marimo') {
            // Collect all lines until we find the closing ```
            const codeLines: string[] = []
            i++ // Skip the opening ```marimo

            while (i < lines.length && lines[i].trim() !== '```') {
              codeLines.push(lines[i])
              i++
            }

            // i now points to the closing ```, skip it
            i++

            // Join the code lines and escape quotes
            const code = codeLines.join('\n').trimEnd()
            const escapedCode = code.replace(/"/g, '&quot;')

            // Add the MarimoIsland component
            result.push(`<MarimoIsland code="${escapedCode}" />`)
          } else {
            // Regular line, keep as-is
            result.push(line)
            i++
          }
        }

        // Replace the original lines array contents
        lines.length = 0
        lines.push(...result)
      }
    }
  ]
})
