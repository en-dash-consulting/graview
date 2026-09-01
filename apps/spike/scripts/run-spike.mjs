#!/usr/bin/env node
/**
 * Drives the three-plane spike in Chrome Canary with the HTML-in-Canvas flag,
 * screenshots the composited scene, and answers the platform questions from
 * inside a real browser.
 *
 *   node apps/spike/scripts/run-spike.mjs [--headed]
 *
 * Writes docs/platform-findings.json and docs/spike-three-planes.png.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// The GPU capture probes genuinely need Canary; the path lives in
// scripts/lib/engine.mjs for the harnesses, and here only as a default.
const CANARY_DEFAULT =
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  CANARY_DEFAULT;
const FLAGS = [
  "--enable-blink-features=CanvasDrawElement",
  "--enable-unsafe-webgpu",
  "--use-angle=metal",
];

async function startVite() {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, "apps/spike"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start in 40s")), 40_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("5187")) {
        clearTimeout(timer);
        ready();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite exited with ${code}`));
    });
  });
  return child;
}

const vite = await startVite();
let browser;
let report = {};

try {
  browser = await chromium.launch({
    executablePath: BROWSER,
    headless: !process.argv.includes("--headed"),
    args: FLAGS,
  });
  const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
  const consoleLines = [];
  page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`pageerror: ${e.message}`));

  await page.goto("http://localhost:5187/", { waitUntil: "load" });
  await page.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
  const ready = await page.evaluate(() => window.__graviewReady);

  mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
  await page
    .locator("#scene-canvas")
    .screenshot({ path: resolve(repoRoot, "docs/spike-three-planes.png") });

  // Does a real click land on the drawn pixels? The router should make it so
  // even while the platform's own geometry sync does not. Every panel is
  // tried, because plane 0 overlaps the planes behind it and a point chosen
  // badly proves nothing.
  await page.evaluate(() => {
    window.__received = [];
    document.addEventListener(
      "click",
      (e) => {
        const panel = e.target.closest?.("[id^=panel-]");
        window.__received.push({ tag: e.target.tagName, panel: panel?.id ?? null });
      },
      true,
    );
  });

  const targets = await page.evaluate(() => {
    const scene = window.__graviewScene;
    const canvas = scene.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const SCALES = [1, 0.72, 0.52];
    return scene.views.map((view, index) => {
      const button = view.element.querySelector("button");
      const panelRect = view.element.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const localX = buttonRect.left - panelRect.left + buttonRect.width / 2;
      const localY = buttonRect.top - panelRect.top + buttonRect.height / 2;
      const scale = SCALES[index];
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      return {
        id: view.id,
        drawnClient: [
          canvasRect.left + cx + (view.x - cx) * scale + localX * scale,
          canvasRect.top + cy + (view.y - cy) * scale + localY * scale,
        ],
      };
    });
  });

  const clickResult = [];
  for (const target of targets) {
    await page.evaluate(() => (window.__received = []));
    await page.mouse.click(target.drawnClient[0], target.drawnClient[1]);
    const received = await page.evaluate(() => window.__received);
    const outputs = await page.evaluate(() =>
      window.__graviewScene.views.map((v) => v.element.querySelector("output")?.textContent ?? null),
    );
    clickResult.push({
      clicked: target.id,
      at: target.drawnClient.map((n) => Number(n.toFixed(1))),
      received,
      // The button under the cursor is the one whose output changed.
      activated: outputs
        .map((text, i) => (text && text !== "idle" ? `panel-${i}` : null))
        .filter(Boolean),
    });
    await page.evaluate(() =>
      window.__graviewScene.views.forEach((v) => {
        const out = v.element.querySelector("output");
        if (out) out.textContent = "idle";
      }),
    );
  }

  // Each measurement phase starts from a fresh page: the GPU process can be
  // brought down by the high-node-count sweep, and a crash in one phase must
  // not cost the answers from another.
  const freshPage = async () => {
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
  };

  // What the exclusion list actually covers, now that the call shape is known.
  let restrictions = {};
  try {
    await freshPage();
  restrictions = await page.evaluate(async () => {
    const scene = window.__graviewScene;
    const canvas = scene.canvas;
    const device = scene.compositor.deviceForProbe();
    const results = {};

    const tryCapture = (label, build) =>
      new Promise((resolve) => {
        const el = build();
        el.style.position = "absolute";
        el.style.left = "0px";
        el.style.top = "3000px";
        canvas.appendChild(el);
        const texture = device.createTexture({
          size: [64, 64],
          format: "rgba8unorm",
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const onPaint = () => {
          canvas.removeEventListener("paint", onPaint);
          let outcome = "captured";
          try {
            device.queue.drawElementImageToTexture({ source: el }, { destination: { texture } });
          } catch (error) {
            outcome = String(error);
          }
          texture.destroy();
          el.remove();
          results[label] = outcome;
          resolve();
        };
        canvas.addEventListener("paint", onPaint);
        canvas.requestPaint();
        setTimeout(() => { el.remove(); results[label] ??= "timed out"; resolve(); }, 1500);
      });

    await tryCapture("inline-svg", () => {
      const host = document.createElement("div");
      host.innerHTML = '<svg width="64" height="64"><circle cx="32" cy="32" r="24" fill="#c33"/></svg>';
      return host;
    });
    await tryCapture("nested-canvas", () => {
      const host = document.createElement("div");
      const inner = document.createElement("canvas");
      inner.width = 32; inner.height = 32;
      host.appendChild(inner);
      return host;
    });
    await tryCapture("cross-origin-iframe", () => {
      const host = document.createElement("div");
      const frame = document.createElement("iframe");
      frame.src = "https://example.com/";
      frame.width = "64"; frame.height = "64";
      host.appendChild(frame);
      return host;
    });
    await tryCapture("plain-div", () => {
      const host = document.createElement("div");
      host.textContent = "control";
      return host;
    });
    await tryCapture("non-child-descendant", () => {
      const host = document.createElement("div");
      const inner = document.createElement("div");
      inner.textContent = "nested";
      host.appendChild(inner);
      // Returned element is the immediate child; the point of the control is
      // that its DESCENDANTS capture fine, only non-children are rejected.
      return host;
    });
    return results;
  });
  } catch (error) {
    restrictions = { error: String(error) };
  }

  // Capture budget against node count, measured through the real API.
  // Phase-isolated: a GPU-process crash at high node counts must not lose the
  // samples already taken, so each phase keeps what it got.
  let budget = { samples: [], crashed: false };
  try {
    await freshPage();
  budget = await page.evaluate(async () => {
    const scene = window.__graviewScene;
    const canvas = scene.canvas;
    const device = scene.compositor.deviceForProbe();
    // Capture accepts only IMMEDIATE children of the canvas, so the probe
    // nodes are attached to the canvas itself rather than to a wrapper.
    const samples = [];
    const spawned = [];

    const median = (xs) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };

    for (const nodes of [1, 8, 32, 64, 96, 128, 160, 192]) {
      for (const el of spawned.splice(0)) el.remove();
      const elements = [];
      const textures = [];
      for (let i = 0; i < nodes; i++) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:160px;height:100px;background:#fff;border:1px solid #ddd;font:13px system-ui;padding:6px";
        el.textContent = `node ${i} — a line of real text to rasterise`;
        el.style.position = "absolute";
        el.style.left = "0px";
        el.style.top = `${2000 + i * 4}px`;
        canvas.appendChild(el);
        spawned.push(el);
        elements.push(el);
        textures.push(
          device.createTexture({
            size: [160, 100],
            format: "rgba8unorm",
            usage:
              GPUTextureUsage.COPY_DST |
              GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.RENDER_ATTACHMENT,
          }),
        );
      }

      const captureTimes = [];
      let failure = null;
      for (let f = 0; f < 10; f++) {
        await new Promise((resolve) => {
          const onPaint = () => {
            canvas.removeEventListener("paint", onPaint);
            const t0 = performance.now();
            try {
              for (let i = 0; i < nodes; i++) {
                device.queue.drawElementImageToTexture(
                  { source: elements[i] },
                  { destination: { texture: textures[i] } },
                );
              }
            } catch (error) {
              failure = String(error);
            }
            captureTimes.push(performance.now() - t0);
            resolve();
          };
          canvas.addEventListener("paint", onPaint);
          canvas.requestPaint();
          setTimeout(resolve, 1000);
        });
        if (failure) break;
      }

      for (const t of textures) t.destroy();
      if (failure) {
        samples.push({ nodes, error: failure });
        break;
      }
      const captureMs = median(captureTimes);
      samples.push({
        nodes,
        captureMs: Number(captureMs.toFixed(3)),
        perNodeMs: Number((captureMs / nodes).toFixed(4)),
        // 16.7ms is one frame at 60Hz; how much of it capture alone eats.
        frameBudgetShare: Number((captureMs / 16.7).toFixed(3)),
      });
    }
    for (const el of spawned.splice(0)) el.remove();
    return { samples };
  });
  } catch (error) {
    budget = { samples: budget.samples, crashed: true, error: String(error) };
  }

  report = {
    at: new Date().toISOString(),
    browser: BROWSER,
    flags: FLAGS,
    ready,
    click: clickResult,
    budget,
    restrictions,
    console: consoleLines,
  };
} catch (error) {
  report = { error: String(error), browser: BROWSER, flags: FLAGS };
} finally {
  await browser?.close();
  vite.kill();
}

const out = resolve(repoRoot, "docs/platform-findings.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n\nwrote ${out}\n`);
