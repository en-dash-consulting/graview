/**
 * A WHEEL, A PINCH AND A DRAG OVER A WORKER VIEW, IN A REAL BROWSER (0.1.42):
 * the gestures transport of `scripts/guest-sandbox.mjs`.
 *
 * TrueNorth's recon app in miniature (scripts/fixtures/map-app.ts): its
 * architecture map is the graview-worker-view skill's worked example
 * (`a-map-that-pans-and-zooms.js`), an SVG whose viewBox a wheel zooms
 * around the pointer, a pinch zooms and a drag pans, with `gestures: true`
 * in its manifest. The embed is mounted as a host mounts it, on a page
 * taller than the window, so a wheel the host leaves alone scrolls it.
 *
 * The claims: a wheel over the map zooms it and the page stays where it
 * was; a wheel with Control held — a trackpad's pinch — is heard as a pinch
 * and zooms, and the page is not zoomed; a drag pans; a burst of wheels in
 * one frame is heard once with its deltas summed; a wheel off the map
 * scrolls the page; and the same view without
 * `gestures: true` hears no wheel, the page scrolls under it, and the host
 * says why.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const EXAMPLE = "packages/skills/skills/graview-worker-view/examples/a-map-that-pans-and-zooms.js";

export async function gesturesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  const out = mkdtempSync(join(tmpdir(), "graview-guest-gestures-"));
  const source = readFileSync(resolve(repoRoot, EXAMPLE), "utf8");
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { ada, mapApp, manifestOf, mapSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/map-app.ts"))};
const SOURCE = ${JSON.stringify(source)};
const asked = new URLSearchParams(location.search);
const declared = manifestOf(SOURCE);
const { gestures, ...without } = declared;
const manifest = asked.has("plain") ? without : declared;
window.__failures = [];
window.__problems = [];
window.__went = [];
window.__handle = mount(document.getElementById("app"), {
  app: mapApp,
  seed: mapSeed,
  principal: ada,
  face: "pages",
  path: "/places/architecture-map",
  scheme: "light",
  label: "Recon",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, { manifest, worker: { source: SOURCE }, onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) }),
});
window.__handle.drawn().then(() => { window.__ready = true; });
window.__map = () => document.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("svg.map") ?? null;
window.__box = () => (window.__map()?.getAttribute("viewBox") ?? "").split(" ").map(Number);
window.__heard = () => window.__map()?.getAttribute("data-heard") ?? null;
/* How far anything on the page has scrolled: the window and every element that scrolls. */
window.__scrolled = () => window.scrollY + window.scrollX + [...document.querySelectorAll("*")].reduce((sum, one) => sum + one.scrollTop + one.scrollLeft, 0);
`,
      resolveDir: resolve(repoRoot, "packages/embed"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  /* The app in the window's first 700 pixels, and the page going on below it: a wheel left to the page scrolls. */
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Recon</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:700px}#below{height:2400px}</style></head>
<body><div id="app"></div><div id="below">Below the app.</div><script type="module" src="/entry.js"></script></body></html>`;
  writeFileSync(join(out, "index.html"), page);
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    try {
      const body = readFileSync(join(out, path));
      response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, colorScheme: "light" });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const open = async (query) => {
      await tab.goto(`${HOST}/?${query}`, { waitUntil: "load" });
      await tab.waitForFunction(() => window.__ready === true && window.__box().length === 4, null, { timeout: 30_000 });
      await tab.evaluate(() => window.scrollTo(0, 0));
      await tab.waitForTimeout(300);
    };
    /* The map's middle, and a point beside it in the same view, in the page's pixels. */
    const where = () =>
      tab.evaluate(() => {
        const box = window.__map().getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height, below: box.bottom };
      });
    const until = async (test, arg, what) => {
      try {
        await tab.waitForFunction(test, arg, { timeout: 5_000 });
      } catch {
        throw new Error(`${what} never came: ${JSON.stringify(await tab.evaluate(() => ({ box: window.__box(), heard: window.__heard(), failures: window.__failures, problems: window.__problems })).catch(String))}`);
      }
    };
    const state = () => tab.evaluate(() => ({ box: window.__box(), heard: window.__heard(), scrolled: window.__scrolled(), zoom: window.visualViewport?.scale ?? 1 }));

    await open("gestures");
    const at = await where();
    const before = await state();

    /* A WHEEL zooms in around the pointer. */
    await tab.mouse.move(at.x, at.y);
    await tab.mouse.wheel(0, -300);
    await until((width) => window.__box()[2] < width - 1, before.box[2], "the map zoomed in by the wheel");
    await tab.waitForTimeout(200);
    const wheeled = await state();
    claim(
      "a wheel over the map zooms it in around the pointer, and the page stays where it was",
      wheeled.heard === "wheel" && wheeled.box[2] < before.box[2] && Math.abs(wheeled.box[0] + wheeled.box[2] / 2 - (before.box[0] + before.box[2] / 2)) < 2 && wheeled.scrolled === before.scrolled,
      { before, wheeled },
    );

    /* CONTROL AND A WHEEL — a trackpad's pinch — zooms, heard as a pinch; the page is not zoomed. */
    await tab.keyboard.down("Control");
    await tab.mouse.wheel(0, -100);
    await tab.keyboard.up("Control");
    await until((width) => window.__heard() === "pinch" && window.__box()[2] < width - 1, wheeled.box[2], "the map zoomed in by a pinch");
    await tab.waitForTimeout(200);
    const pinched = await state();
    claim("a wheel with Control held, a trackpad's pinch, is heard as a pinch and zooms the map, and the page is neither zoomed nor scrolled", pinched.heard === "pinch" && pinched.box[2] < wheeled.box[2] && pinched.zoom === 1 && pinched.scrolled === before.scrolled, { wheeled, pinched });

    /* A DRAG pans: the map moves with the pointer, so what was under it stays under it. */
    await tab.mouse.move(at.x, at.y);
    await tab.mouse.down();
    for (let step = 1; step <= 8; step += 1) await tab.mouse.move(at.x + step * 15, at.y + step * 8);
    await tab.mouse.up();
    await until((x) => window.__heard() === "drag" && window.__box()[0] < x - 1, pinched.box[0], "the map panned by the drag");
    await tab.waitForTimeout(200);
    const dragged = await state();
    /* The SVG fits its viewBox in whole: a pixel is as many units as the tighter of its two sides says. */
    const perPixel = Math.max(pinched.box[2] / at.width, pinched.box[3] / at.height);
    claim(
      "a drag across the map pans it with the pointer, by as many of the map's units as the pointer moved pixels",
      dragged.heard === "drag" && Math.abs(pinched.box[0] - dragged.box[0] - 120 * perPixel) < 6 * perPixel + 1 && Math.abs(pinched.box[1] - dragged.box[1] - 64 * perPixel) < 6 * perPixel + 1 && dragged.box[2] === pinched.box[2] && dragged.scrolled === before.scrolled,
      { pinched, dragged, perPixel },
    );

    /* A BURST in one frame is heard once, its deltas summed. */
    const burst = await tab.evaluate(() => {
      const map = window.__map();
      const box = map.getBoundingClientRect();
      const width = window.__box()[2];
      let prevented = 0;
      for (let i = 0; i < 10; i += 1) {
        const event = new WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY: 30, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
        map.dispatchEvent(event);
        if (event.defaultPrevented) prevented += 1;
      }
      return { prevented, width };
    });
    await until((width) => window.__box()[2] > width + 1, burst.width, "the map zoomed out by the burst");
    await tab.waitForTimeout(300);
    const after = await state();
    const expected = burst.width / Math.exp(-300 / 500);
    claim("ten wheels in one frame are taken from the page and heard once, their deltas summed: the map zooms out as far as one wheel of all ten", burst.prevented === 10 && Math.abs(after.box[2] - expected) < 0.5, { burst, after: after.box, expected });

    /* OFF THE MAP the page scrolls. */
    await tab.mouse.move(at.x, Math.min(at.below + 40, 780));
    const still = await state();
    await tab.mouse.wheel(0, 400);
    await tab.waitForFunction((was) => window.__scrolled() > was, still.scrolled, { timeout: 5_000 }).catch(() => {});
    const scrolled = await state();
    claim("a wheel off the map, where the view does not listen, scrolls the page and leaves the map as it was", scrolled.scrolled > still.scrolled && scrolled.box.join() === still.box.join(), { still, scrolled });
    claim("the map did not fail, and nothing about it was said to be wrong", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));

    /* THE SAME VIEW WITHOUT gestures: true. */
    await open("plain");
    const plainAt = await where();
    const plainBefore = await state();
    await tab.mouse.move(plainAt.x, plainAt.y);
    await tab.mouse.wheel(0, -300);
    await tab.waitForFunction((was) => window.__scrolled() !== was, plainBefore.scrolled, { timeout: 5_000 }).catch(() => {});
    await tab.waitForTimeout(300);
    const plainAfter = await state();
    await tab.evaluate(() => window.scrollTo(0, 0));
    await tab.mouse.move(plainAt.x, plainAt.y);
    await tab.mouse.wheel(0, 400);
    await tab.waitForFunction((was) => window.__scrolled() > was, 0, { timeout: 5_000 }).catch(() => {});
    const plainScrolled = await state();
    const said = await tab.evaluate(() => window.__problems);
    claim(
      "the same view without gestures: true hears no wheel, the page scrolls under it, and the host says why",
      plainAfter.heard === "none" && plainAfter.box.join() === plainBefore.box.join() && plainScrolled.scrolled > 0 && plainScrolled.box.join() === plainBefore.box.join() && said.some((one) => /does not say "gestures": true/.test(one)),
      { plainBefore, plainAfter, plainScrolled, said },
    );
    await context.close();
    claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  } finally {
    server.close();
  }
}
