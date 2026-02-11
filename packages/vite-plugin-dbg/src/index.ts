import type { Plugin } from "vite";

import path from "node:path";

import { transformSource } from "./utils";

export interface VitePluginDbgPluginOptions {
  /** Enable the macro (default: true). Set to false in prod builds. */
  enabled?: boolean;

  /** Optional file‑filter – only transform files that match the RegExp. */
  include?: RegExp;
}

/**
 * Vite plugin that rewrites `dbg$(…)` into a console‑logging IIFE.
 *
 * It is completely **framework‑agnostic** – you can drop it into any Vite
 * project (React, Vue, Svelte, Solid, plain JS, etc.).
 */
export default function VitePluginDbg(
  opts: VitePluginDbgPluginOptions = {},
): Plugin {
  const { enabled = true, include = /\.(js|ts|jsx|tsx|mjs|cjs|vue)$/ } = opts;

  // If a custom logger is supplied, we replace the generated `console.error`
  // with a call to that function at build‑time.
  // (The implementation lives in `dbg‑transform.ts`; we just pass the name.)
  // For simplicity, we keep the generated code using `console.error`.
  // You can extend `buildDbgIife` to inject a different identifier if you wish.

  return {
    enforce: "pre",
    name: "vite-plugin-dbg$",

    async transform(code, id) {
      if (!enabled) return null;
      if (!include.test(id)) return null;

      const relPath = path.relative(process.cwd(), id);

      const { code: transformed, map } = transformSource(code, relPath, true);

      return {
        code: transformed,
        map,
      };
    },
  };
}
