import type { Plugin } from "vite";

/**
 * Rewrites `data-astro-source-file="/abs/path/to/Foo.astro"` into a
 * project-root-relative path, so the runtime can show clean `src/.../Foo.astro:line:col`
 * references without needing to know the project root at runtime.
 *
 * Astro's compiler runs before user Vite plugins, so by the time we see a
 * `.astro` file in `transform()`, the source attribute is already injected
 * as a literal string in the compiled JS — we just do a string replace.
 */
export function aaaVitePlugin({ projectRoot }: { projectRoot: string }): Plugin {
  const root = projectRoot.replace(/\/+$/, "");
  // Escape regex meta chars in the project root.
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const absRe = new RegExp(`(data-astro-source-file=\\\\?")(?:${escaped})/?`, "g");

  return {
    name: "astro-agent-annotate:source-attrs",
    enforce: "post",
    transform(code, id) {
      if (!id.endsWith(".astro")) return null;
      if (!code.includes("data-astro-source-file=")) return null;
      const replaced = code.replace(absRe, "$1");
      if (replaced === code) return null;
      return { code: replaced, map: null };
    },
  };
}
