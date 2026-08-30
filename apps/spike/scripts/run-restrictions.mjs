#!/usr/bin/env node
/**
 * Probes the capture exclusion list ONE CASE PER PAGE.
 *
 * Isolation is not fussiness: at least one of these cases brings the renderer
 * process down, and a shared page would attribute the crash to whichever case
 * happened to run next. A crash is itself an answer, so it has to be
 * attributable.
 *
 *   node apps/spike/scripts/run-restrictions.mjs
 *
 * Writes docs/platform-restrictions.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const FLAGS = [
  "--enable-blink-features=CanvasDrawElement",
  "--enable-unsafe-webgpu",
  "--use-angle=metal",
];

/** Each case is the innerHTML of one immediate child of the canvas. */
const CASES = {
  "plain-div": '<div style="width:64px;height:64px;background:#cdd">control</div>',
  "styled-text": '<div style="width:64px;height:64px;font:12px system-ui">text &amp; <b>bold</b></div>',
  "inline-svg": '<div><svg width="64" height="64"><circle cx="32" cy="32" r="24" fill="#c33"/></svg></div>',
  "img-data-uri":
    '<div><img width="64" height="64" alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjM2M5Ii8+PC9zdmc+"></div>',
  "nested-canvas": '<div><canvas width="32" height="32"></canvas></div>',
  "cross-origin-iframe": '<div><iframe src="https://example.com/" width="64" height="64"></iframe></div>',
};

const PAGE = (markup) => `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>
<canvas id="c" layoutsubtree width="200" height="200"></canvas>
<script type="module">
  const canvas = document.getElementById("c");
  const host = document.createElement("div");
  host.id = "subject";
  host.style.cssText = "position:absolute;left:0;top:0";
  host.innerHTML = ${JSON.stringify(markup)};
  canvas.appendChild(host);
  (async () => {
    try {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const ctx = canvas.getContext("webgpu");
      ctx.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: "premultiplied" });
      const texture = device.createTexture({
        size: [64, 64], format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      // "No error" is not "content appeared": read the pixels back and say
      // which it was. A cross-origin frame that captures blank is a silent
      // hole in a view, which is worse than a thrown error.
      const readback = device.createBuffer({ size: 64 * 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const onPaint = () => {
        canvas.removeEventListener("paint", onPaint);
        try {
          device.queue.drawElementImageToTexture({ source: host }, { destination: { texture } });
        } catch (error) {
          window.__result = String(error);
          return;
        }
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: 256 }, [64, 64]);
        device.queue.submit([encoder.finish()]);
        readback.mapAsync(GPUMapMode.READ).then(() => {
          const pixels = new Uint8Array(readback.getMappedRange().slice(0));
          readback.unmap();
          let opaque = 0;
          const seen = new Set();
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 8) opaque++;
            // Alpha belongs in the key: antialiased text over a transparent
            // background varies only in alpha, and calling that "no content"
            // would be wrong.
            seen.add(pixels[i] + "," + pixels[i + 1] + "," + pixels[i + 2] + "," + pixels[i + 3]);
          }
          const total = pixels.length / 4;
          const pct = Math.round((opaque / total) * 100);
          if (opaque === 0) {
            window.__result = "captured but fully transparent - nothing was drawn";
          } else if (seen.size <= 1) {
            window.__result = "captured, but a single flat colour - a fill, or a solid image";
          } else {
            window.__result =
              "captured with content (" + seen.size + " distinct colours, " + pct + "% opaque)";
          }
        });
      };
      canvas.addEventListener("paint", onPaint);
      canvas.requestPaint();
      setTimeout(() => { window.__result ??= "no paint event"; }, 1500);
    } catch (error) {
      window.__result = "setup failed: " + String(error);
    }
  })();
</script>`;

async function serve(markup) {
  const { createServer } = await import("node:http");
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(PAGE(markup));
  });
  await new Promise((ready) => server.listen(5189, ready));
  return server;
}

const results = {};
for (const [name, markup] of Object.entries(CASES)) {
  const server = await serve(markup);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: FLAGS });
    const page = await browser.newPage();
    await page.goto("http://localhost:5189/", { waitUntil: "load" });
    await page.waitForFunction(() => "__result" in window, undefined, { timeout: 20_000 });
    results[name] = await page.evaluate(() => window.__result);
  } catch (error) {
    const message = String(error);
    results[name] = message.includes("crash")
      ? "RENDERER CRASH — capturing this brings the process down"
      : message;
  } finally {
    await browser?.close();
    await new Promise((closed) => server.close(closed));
  }
  process.stdout.write(`${name}: ${results[name]}\n`);
}

const out = resolve(repoRoot, "docs/platform-restrictions.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify({ browser: BROWSER, flags: FLAGS, at: new Date().toISOString(), results }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`\nwrote ${out}\n`);
