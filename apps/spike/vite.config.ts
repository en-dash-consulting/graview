import { sourceAliases } from "@graview/ship/dev";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Every export of every framework package, from its source: read from the
    // packages' own `exports`, so a new entry point needs no line here.
    alias: sourceAliases(),
  },
  server: { port: 5187, strictPort: true },
});
