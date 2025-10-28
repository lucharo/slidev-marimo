// Setup for marimo islands integration
// This file is automatically loaded by Slidev

import { initializeMarimo, getIslandCount } from './island-registry'

export default ({ app }) => {
  // Register marimo custom elements so Vue doesn't try to compile them
  const originalIsCustomElement = app.config.compilerOptions.isCustomElement

  app.config.compilerOptions.isCustomElement = (tag) => {
    if (tag.startsWith('marimo-')) {
      return true
    }
    return originalIsCustomElement ? originalIsCustomElement(tag) : false
  }

  // Load marimo islands resources on client side only
  if (typeof window !== 'undefined') {
    // Check if already loaded
    if (!document.getElementById('marimo-islands-css')) {
      // Google Fonts (required by marimo)
      const preconnect1 = document.createElement('link')
      preconnect1.rel = 'preconnect'
      preconnect1.href = 'https://fonts.googleapis.com'
      document.head.appendChild(preconnect1)

      const preconnect2 = document.createElement('link')
      preconnect2.rel = 'preconnect'
      preconnect2.href = 'https://fonts.gstatic.com'
      preconnect2.crossOrigin = 'anonymous'
      document.head.appendChild(preconnect2)

      const fonts = document.createElement('link')
      fonts.rel = 'stylesheet'
      fonts.href = 'https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500;700&family=Lora&family=PT+Sans:wght@400;700&display=swap'
      document.head.appendChild(fonts)

      // KaTeX CSS (required for math rendering)
      const katex = document.createElement('link')
      katex.rel = 'stylesheet'
      katex.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css'
      katex.integrity = 'sha384-wcIxkf4k558AjM3Yz3BBFQUbk/zgIYC2R0QpeeYb+TwlBVMrlgLqwRjRtGZiK7ww'
      katex.crossOrigin = 'anonymous'
      document.head.appendChild(katex)

      // Load marimo islands CSS
      // Use version 0.11.6 - last known good version before CSS bug (0.11.7+)
      // See: https://github.com/marimo-team/marimo/issues/3964
      const MARIMO_VERSION = '0.11.6'
      const link = document.createElement('link')
      link.id = 'marimo-islands-css'
      link.rel = 'stylesheet'
      link.href = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/style.css`
      link.crossOrigin = 'anonymous'
      link.onerror = () => {
        console.error('Failed to load marimo islands stylesheet.')
      }
      document.head.appendChild(link)

      // Add required marimo-filename tag to HEAD
      const marimoFilename = document.createElement('marimo-filename')
      marimoFilename.hidden = true
      document.head.appendChild(marimoFilename)

      // Add marimo-mode tag to set the app mode to "read"
      // This may help initialize initialModeAtom correctly
      // See: https://github.com/marimo-team/marimo/issues/3964
      const marimoMode = document.createElement('marimo-mode')
      marimoMode.setAttribute('data-mode', 'read')
      marimoMode.hidden = true
      document.head.appendChild(marimoMode)

      // Initialize marimo after Vue components finish mounting
      // Use stability-based polling: wait for island count to be stable for 3 seconds
      // This gives Slidev enough time to preload adjacent slides
      let lastCount = 0
      let stableChecks = 0
      let totalChecks = 0
      const maxChecks = 50 // 5 seconds max (50 * 100ms)
      const requiredStableChecks = 30 // Must be stable for 30 checks (3000ms = 3 seconds)

      const checkForIslands = () => {
        totalChecks++
        const currentCount = getIslandCount()

        if (currentCount === lastCount) {
          // Count is stable - increment stability counter
          stableChecks++

          if (stableChecks >= requiredStableChecks && currentCount > 0) {
            // Count is stable AND we have islands - initialize!
            console.log(`⏰ Found ${currentCount} islands (stable for 3s), initializing marimo...`)
            initializeMarimo()
            return // Done
          }
          // If stable but count=0, keep checking (components may not have mounted yet)
        } else {
          // Count changed - reset stability counter
          stableChecks = 0
          lastCount = currentCount
        }

        // Keep checking if we haven't timed out
        if (totalChecks < maxChecks) {
          setTimeout(checkForIslands, 100)
        } else {
          // Timeout reached - initialize with whatever we have
          const finalCount = getIslandCount()
          if (finalCount > 0) {
            console.log(`⏰ Timeout: Initializing with ${finalCount} islands`)
            initializeMarimo()
          } else {
            console.log('⏰ Timeout: No islands found after 5 seconds')
          }
        }
      }

      // Start checking after a small initial delay to let Vue start mounting
      setTimeout(checkForIslands, 500)
    }
  }
}
