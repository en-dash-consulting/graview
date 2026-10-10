import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@graview/render/gpu": fileURLToPath(new URL("../../packages/render/src/gpu.ts", import.meta.url)),
      "@graview/render": fileURLToPath(new URL("../../packages/render/src/index.ts", import.meta.url)),
      "@graview/core/blocks": fileURLToPath(new URL("../../packages/core/src/blocks.ts", import.meta.url)),
      "@graview/core/arrange": fileURLToPath(new URL("../../packages/core/src/arrange.ts", import.meta.url)),
      "@graview/core/lines": fileURLToPath(new URL("../../packages/core/src/lines.ts", import.meta.url)),
      "@graview/core/check": fileURLToPath(new URL("../../packages/core/src/check.ts", import.meta.url)),
      "@graview/core/scene": fileURLToPath(new URL("../../packages/core/src/scene.ts", import.meta.url)),
      "@graview/core/figures": fileURLToPath(new URL("../../packages/core/src/figures.ts", import.meta.url)),
      "@graview/core/describe": fileURLToPath(new URL("../../packages/core/src/describe.ts", import.meta.url)),
      "@graview/core/retry": fileURLToPath(new URL("../../packages/core/src/retry.ts", import.meta.url)),
      "@graview/core/document": fileURLToPath(new URL("../../packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5187, strictPort: true },
});
