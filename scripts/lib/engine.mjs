/**
 * Which browser a harness runs in, decided in exactly one place.
 *
 * Every green verdict used to be a one-browser verdict: all the harnesses
 * hardcoded the Chrome Canary binary, and GRAVIEW_BROWSER sat unused. The DOM
 * path is what ships and iOS Safari is the mobile browser, so the engine is a
 * PARAMETER now — `--engine=webkit`, `--engine=firefox`, or GRAVIEW_ENGINE —
 * and Canary is required only where the GPU capture flag genuinely is
 * (HTML-in-Canvas is Chromium-only by nature, experimental and opt-in).
 *
 *   node scripts/<harness>.mjs --engine=webkit
 *   GRAVIEW_ENGINE=firefox pnpm audit
 */
import { chromium, firefox, webkit } from "playwright";

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
export async function launchEngine(name, { headless = true, firefoxUserPrefs } = {}) {
  switch (name) {
    case "chromium":
      return chromium.launch({ headless });
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
  return chromium.launch({
    executablePath: CANARY,
    headless,
    args: ["--enable-blink-features=CanvasDrawElement", ...extraArgs],
  });
}
