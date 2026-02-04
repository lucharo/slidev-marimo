/**
 * Shiki Syntax Highlighting Setup
 *
 * Registers "marimo" as a language alias for Python syntax highlighting.
 * This allows ```marimo code blocks to get proper Python syntax coloring.
 */

import { defineShikiSetup } from "@slidev/types";

export default defineShikiSetup(() => {
  return {
    langs: ["python"],
    langAlias: {
      marimo: "python",
    },
  };
});
