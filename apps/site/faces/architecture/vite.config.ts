import { defineConfig } from "vite";

/*
 * THE STORE IS THE PREVIEW'S; THE PAGE IS YOURS.
 *
 * `graview preview ../app.json --seed ../seed.json --port 4800` serves the
 * store at /graview/ beside its own page, and prints the address to open:
 * `http://localhost:4800/?graview_key=…`, which carries that run's key. Hand
 * this dev server that address (`GRAVIEW_PREVIEW="…" npm run dev`): it
 * serves your face, and hands every /graview/ request — the socket too —
 * to the preview, with the key.
 *
 * The preview answers only its own page: a request whose Origin is another
 * site is refused, so a page on another port cannot sit in its seat, and
 * nothing without the key is answered at all. Here the page is yours on
 * purpose, so the proxy says the request comes from the preview's own
 * origin, and carries the key, on the HTTP calls and on the socket's
 * upgrade. The key stays here: the page is handed only where the preview is.
 */
const printed = new URL(process.env["GRAVIEW_PREVIEW"] ?? "http://localhost:4800");
const KEY = printed.searchParams.get("graview_key") ?? "";
const PREVIEW = printed.origin;

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
          proxy.on("proxyReq", (request) => {
            request.setHeader("origin", PREVIEW);
            if (KEY) request.setHeader("x-graview-key", KEY);
          });
          proxy.on("proxyReqWs", (request) => {
            request.setHeader("origin", PREVIEW);
            if (KEY) request.setHeader("x-graview-key", KEY);
          });
        },
      },
    },
  },
});
