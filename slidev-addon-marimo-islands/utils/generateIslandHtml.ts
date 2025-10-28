/**
 * Pure function to generate marimo island HTML
 * No side effects - easily testable
 */

export interface IslandConfig {
  code: string
  cellId: string
  cellIdx: number
  appId: string
  reactive: boolean
  displayCode: boolean
}

/**
 * Generates the HTML for a marimo island element
 *
 * @param config - Island configuration
 * @returns HTML string ready to be inserted into DOM
 *
 * @example
 * const html = generateIslandHtml({
 *   code: 'print("hello")',
 *   cellId: 'abc123',
 *   appId: 'main',
 *   reactive: true,
 *   displayCode: true
 * })
 */
export function generateIslandHtml(config: IslandConfig): string {
  const { code, cellId, cellIdx, appId, reactive, displayCode } = config

  // URL-encode the code for marimo's format
  const encodedCode = encodeURIComponent(code)

  // Generate code element with proper attributes
  const codeElement = displayCode
    ? `<marimo-cell-code>${encodedCode}</marimo-cell-code>`
    : `<marimo-cell-code hidden>${encodedCode}</marimo-cell-code>`

  // CRITICAL: data-reactive MUST be JSON string ("true"/"false"), not boolean
  // Marimo's parser expects JSON.parse() compatible values
  const reactiveValue = JSON.stringify(reactive)

  // Generate the complete island HTML
  // Structure must match what marimo expects:
  // <marimo-island> with data attributes
  //   <marimo-cell-output> - where output will be rendered
  //   <marimo-cell-code> - contains URL-encoded Python code
  // IMPORTANT: data-cell-idx is normally added by parseMarimoIslandApps()
  // but we're adding islands dynamically so we set it manually
  return `
<marimo-island
  data-app-id="${appId}"
  data-cell-id="${cellId}"
  data-cell-idx="${cellIdx}"
  data-reactive="${reactiveValue}"
>
  <marimo-cell-output></marimo-cell-output>
  ${codeElement}
</marimo-island>
  `.trim()
}

/**
 * Validates island HTML structure
 * Useful for debugging
 */
export function validateIslandHtml(html: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!html.includes('<marimo-island')) {
    errors.push('Missing <marimo-island> element')
  }

  if (!html.includes('data-app-id')) {
    errors.push('Missing data-app-id attribute')
  }

  if (!html.includes('data-cell-id')) {
    errors.push('Missing data-cell-id attribute')
  }

  if (!html.includes('data-reactive')) {
    errors.push('Missing data-reactive attribute')
  }

  if (!html.includes('<marimo-cell-output>')) {
    errors.push('Missing <marimo-cell-output> element')
  }

  if (!html.includes('<marimo-cell-code')) {
    errors.push('Missing <marimo-cell-code> element')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
