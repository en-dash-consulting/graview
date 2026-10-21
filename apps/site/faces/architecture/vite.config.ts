import { defineConfig } from "vite";

/*
 * THE STORE IS THE PREVIEW'S; THE PAGE IS YOURS.
 *
 * `graview preview ../app.json --seed ../seed.json --port 4800` serves the
 * store at /graview/ beside its own page. This dev server serves your face,
 * and hands every /graview/ request — the socket too — to the preview.
 *
 * The preview answers only its own page: a request whose Origin is another
 * site is refused, so a page on another port cannot sit in its seat. Here
 * the page is yours on purpose, so the proxy says the request comes from
 * the preview's own origin, on the HTTP calls and on the socket's upgrade.
 */
const PREVIEW = process.env["GRAVIEW_PREVIEW"] ?? "http://localhost:4800";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Where the preview's own page is, for a record's link into its scene.
  define: { "import.meta.env.GRAVIEW_PREVIEW": JSON.stringify(PREVIEW) },
  // main.tsx awaits the store at the top level.
  build: { target: "es2022" },
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
  server: {
    port: Number(process.env["PORT"] ?? 5173),
    strictPort: true,
    proxy: {
      "/graview": {
        target: PREVIEW,
        ws: true,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (request) => request.setHeader("origin", PREVIEW));
          proxy.on("proxyReqWs", (request) => request.setHeader("origin", PREVIEW));
        },
      },
    },
  },
});
