/**
 * Which browser a harness runs in, decided in exactly one place.
 *
 * Every green verdict used to be a one-browser verdict: all the harnesses
 * hardcoded the Chrome Canary binary, with GRAVIEW_BROWSER as the only way
 * to point them elsewhere. The DOM path is what ships and iOS Safari is the
 * mobile browser, so the engine is a PARAMETER now — `--engine=webkit`,
 * `--engine=firefox`, or GRAVIEW_ENGINE — and Canary is required only where
 * the GPU capture flag genuinely is (HTML-in-Canvas is Chromium-only by
 * nature, experimental and opt-in).
 *
 * GRAVIEW_BROWSER keeps its old meaning: it names the Chromium-family
 * binary for the chromium and canary engines (Playwright's bundled build
 * otherwise — `npx playwright install chromium webkit firefox` is the
 * prerequisite). It has no say over webkit or firefox.
 *
 *   node scripts/<harness>.mjs --engine=webkit
 *   GRAVIEW_ENGINE=firefox pnpm audit
 *   GRAVIEW_BROWSER=/path/to/chrome pnpm audit
 */
import { existsSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import { watched } from "./watch.mjs";

/** The one place the Canary path is written. GRAVIEW_BROWSER overrides it. */
const CANARY =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

export const ENGINES = ["chromium", "webkit", "firefox"];

/** The engine a harness was asked for: --engine=<name>, GRAVIEW_ENGINE, or chromium. */
export function engineName(argv = process.argv) {
  const flag = argv.find((a) => a.startsWith("--engine="));
  const name = flag ? flag.slice("--engine=".length) : (process.env["GRAVIEW_ENGINE"] ?? "chromium");
  if (![...ENGINES, "canary"].includes(name)) {
    throw new Error(`Unknown engine "${name}" — use one of: ${ENGINES.join(", ")}, canary.`);
  }
  return name;
}

/**
 * Launches the named engine for the DOM path.
 *
 * `firefoxUserPrefs` exists so a harness can simulate an ESR-class engine —
 * flipping `layout.css.properties-and-values.enabled` off is how the
 * altitude morph's degradation is VERIFIED rather than assumed.
 */
export async function launchEngine(name, options = {}) {
  // Every page every harness opens is held to the rules that hold everywhere (watch.mjs).
  return watched(forcedRenderer(await launch(name, options)), name);
}

/**
 * THE PATH EVERY PAGE DRAWS ON, forced: GRAVIEW_RENDERER=gpu or =dom. The
 * framework draws `auto` on the GPU where the browser can capture and on
 * the DOM path elsewhere; a run that must hold on one path says so here,
 * and every page of every harness is told before its scripts run
 * (`graviewRenderer`, which `rendererAsked` reads) — no address changes.
 * A page told `gpu` in a browser that cannot draw on it still draws on the
 * DOM path, and says so on its ground (`data-graview-renderer`).
 */
export const RENDERER = (() => {
  const asked = process.env["GRAVIEW_RENDERER"];
  if (asked === undefined || asked === "") return null;
  if (asked !== "gpu" && asked !== "dom") throw new Error(`GRAVIEW_RENDERER is "${asked}" — use gpu or dom.`);
  return asked;
})();

/**
 * The switches a Chromium needs to hand a headless page a WebGPU adapter and
 * element capture: Metal through ANGLE on a Mac, SwiftShader's Vulkan where
 * there is no GPU (a CI runner). Capture itself is on by default from
 * Chromium 158 and behind the flag before it.
 */
export const GPU_ARGS = [
  "--enable-blink-features=CanvasDrawElement",
  "--enable-unsafe-webgpu",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  ...(process.platform === "darwin"
    ? ["--use-angle=metal"]
    : ["--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--use-angle=swiftshader"]),
];

/** The Chromium that can draw on the GPU path: the operator's, else Canary where it is installed, else the bundled build. */
export function gpuChromium() {
  return process.env["GRAVIEW_BROWSER"] ?? (existsSync(CANARY) ? CANARY : undefined);
}

function forcedRenderer(browser) {
  if (!RENDERER) return browser;
  const told = new WeakSet();
  const tell = async (context) => {
    if (told.has(context)) return;
    told.add(context);
    await context.addInitScript({ content: `globalThis.graviewRenderer = ${JSON.stringify(RENDERER)};` });
  };
  return new Proxy(browser, {
    get(target, prop) {
      if (prop === "newContext") {
        return async (...args) => {
          const context = await target.newContext(...args);
          await tell(context);
          return context;
        };
      }
      if (prop === "newPage") {
        return async (...args) => {
          // A page of its own context, told before it is navigated.
          const context = await target.newContext(...args);
          await tell(context);
          const page = await context.newPage();
          page.on("close", () => void context.close().catch(() => {}));
          return page;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function launch(name, { headless = true, firefoxUserPrefs, args } = {}) {
  switch (name) {
    case "chromium": {
      // The operator's Chromium, when named — same override the harnesses
      // always honored — else Playwright's bundled build. Forced onto the
      // GPU path, the Chromium that can capture, with the switches it needs.
      const onGpu = RENDERER === "gpu";
      const executablePath = onGpu ? gpuChromium() : process.env["GRAVIEW_BROWSER"];
      // `args`: flags only a Chromium understands — the scale harness turns vsync off to time work, not the display.
      const all = [...(onGpu ? GPU_ARGS : []), ...(args ?? [])];
      return chromium.launch({ ...(executablePath ? { executablePath } : {}), headless, ...(all.length > 0 ? { args: all } : {}) });
    }
    case "canary":
      // The plain Canary binary without the capture flag — for a harness
      // that wants the shipping Chrome rather than the bundled build.
      return chromium.launch({ executablePath: CANARY, headless });
    case "webkit":
      return webkit.launch({ headless });
    case "firefox":
      return firefox.launch({
        headless,
        ...(firefoxUserPrefs ? { firefoxUserPrefs } : {}),
      });
    default:
      throw new Error(`Unknown engine "${name}".`);
  }
}

/**
 * The GPU capture path: Chrome Canary with the HTML-in-Canvas flag, the one
 * launch shape that genuinely cannot be any other engine. `extraArgs` is for
 * the harnesses that also need WebGPU switches.
 */
export async function launchCanaryGpu({ headless = true, extraArgs = [] } = {}) {
  return watched(forcedRenderer(await chromium.launch({
    executablePath: CANARY,
    headless,
    args: ["--enable-blink-features=CanvasDrawElement", ...extraArgs],
  })), "chromium");
}

/** Google's webfont hosts, which the apps' pages ask for their faces. */
export const WEBFONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * ARRIVE WITHOUT ASKING SOMEBODY ELSE'S NETWORK, for a harness that measures
 * boxes rather than letters.
 *
 * The apps ask Google for their webfonts in a render-blocking stylesheet. On
 * this macOS WebKit that request now and then never finishes: `page.goto`
 * waiting for `load` timed out at thirty seconds (playback and viewport,
 * WebKit only, in three runs of four), and waiting for `domcontentloaded`
 * instead only moved the failure — with the stylesheet still pending, WebKit
 * held the todo shell's layout at the size it first had, and a phone turned
 * sideways measured a box that never followed. Refused at once, the
 * stylesheet fails, the page lays out in its fallback faces, and `load` comes
 * when the page's own files are in — which is what these harnesses wait for.
 * verify-site, which measures text, waits on the fonts a bounded moment instead.
 */
export async function arriveWithoutWebfonts(page, url) {
  await page.route(WEBFONTS, (route) => route.abort());
  await page.goto(url, { waitUntil: "load" });
}
