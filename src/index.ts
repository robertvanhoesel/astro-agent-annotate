import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import { aaaVitePlugin } from "./vite-plugin.js";

export interface AstroAgentAnnotateOptions {
  /** Disable the integration entirely. Defaults to false. */
  disabled?: boolean;
}

export default function astroAgentAnnotate(
  options: AstroAgentAnnotateOptions = {},
): AstroIntegration {
  return {
    name: "astro-agent-annotate",
    hooks: {
      "astro:config:setup": ({ command, addDevToolbarApp, updateConfig, config }) => {
        if (options.disabled || command !== "dev") return;

        const projectRoot = fileURLToPath(config.root);

        updateConfig({
          vite: {
            plugins: [aaaVitePlugin({ projectRoot })],
          },
        });

        addDevToolbarApp({
          id: "astro-agent-annotate",
          name: "Agent Annotate",
          icon: ICON,
          entrypoint: fileURLToPath(new URL("./app.js", import.meta.url)),
        });
      },
    },
  };
}

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l6-6a2 2 0 0 0 0-2.828l-8-8A2 2 0 0 0 11 3Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>`;
