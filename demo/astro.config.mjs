import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import astroAgentAnnotate from "astro-agent-annotate";

// The package lives in the sibling directory (`file:..` in package.json).
// Astro's dev toolbar loads its entrypoint via `/@fs/<absolute-path>`, which
// Vite blocks unless the file is inside server.fs.allow. Add the parent dir.
const PARENT = fileURLToPath(new URL("..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  integrations: [astroAgentAnnotate()],
  vite: {
    server: {
      fs: {
        allow: [HERE, PARENT],
      },
    },
  },
});
