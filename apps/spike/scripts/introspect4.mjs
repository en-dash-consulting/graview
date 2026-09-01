import { chromium } from "playwright";
import { createServer } from "node:http";
const HTML = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#222}</style>
<canvas id="c" layoutsubtree width="600" height="400">
  <div id="p0" style="position:absolute;left:0;top:0;width:180px;height:120px;background:#fbfaf8;font:14px system-ui">
    <h3>Panel 0</h3><button id="b0">Act</button>
  </div>
</canvas>
<script>
  window.__hits = [];
  document.addEventListener("click", (e) => window.__hits.push(e.target.tagName + "#" + (e.target.id||"")), true);
</script>`;
const server = createServer((_q, r) => { r.writeHead(200, {"content-type":"text/html"}); r.end(HTML); });
await new Promise((r) => server.listen(5188, r));
// A GPU-capture probe: Canary genuinely required, GRAVIEW_BROWSER overrides.
const browser = await chromium.launch({
  executablePath:
    process.env["GRAVIEW_BROWSER"] ??
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  headless: true, args: ["--enable-blink-features=CanvasDrawElement", "--enable-unsafe-webgpu"] });
const page = await browser.newPage();
page.on("pageerror", e => console.error("PAGEERROR", e.message));
await page.goto("http://localhost:5188/", { waitUntil: "load" });

const setup = await page.evaluate(async () => {
  const canvas = document.getElementById("c"), p0 = document.getElementById("p0");
  const device = await (await navigator.gpu.requestAdapter()).requestDevice();
  const ctx = canvas.getContext("webgpu");
  ctx.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: "premultiplied" });
  const tex = device.createTexture({ size: [180,120], format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
  window.__paints = 0;
  canvas.addEventListener("paint", () => {
    window.__paints++;
    device.queue.drawElementImageToTexture({source: p0}, {destination: {texture: tex}});
    canvas.updateElementGeometry(p0, { canvasTransform: new DOMMatrix().translate(300, 200) });
  });
  canvas.requestPaint();
  const arities = {};
  for (const n of ["getElementTransform","updateElementGeometry","captureElementImage","clearElementGeometry","requestPaint"]) {
    arities[n] = HTMLCanvasElement.prototype[n]?.length;
  }
  let zeroArg = "n/a";
  try { zeroArg = String(canvas.getElementTransform()); } catch (e) { zeroArg = String(e).slice(0,140); }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const rect = canvas.getBoundingClientRect();
  return { arities, zeroArg, paints: window.__paints, canvasLeft: rect.left, canvasTop: rect.top };
});

// A real synthesized click, not elementFromPoint: this is what a user does.
await page.mouse.click(setup.canvasLeft + 300 + 40, setup.canvasTop + 200 + 40);
await page.mouse.click(setup.canvasLeft + 40, setup.canvasTop + 40);
const hits = await page.evaluate(() => window.__hits);
console.log(JSON.stringify({ ...setup, clickAtDrawn: hits[0] ?? null, clickAtLayout: hits[1] ?? null, hits }, null, 2));
await browser.close(); server.close();
