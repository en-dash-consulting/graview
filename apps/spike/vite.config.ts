import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@graview/render/gpu": fileURLToPath(new URL("../../packages/render/src/gpu.ts", import.meta.url)),
      "@graview/render": fileURLToPath(new URL("../../packages/render/src/index.ts", import.meta.url)),
      "@graview/core/document": fileURLToPath(new URL("../../packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5187, strictPort: true },
});
