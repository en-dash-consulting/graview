/**
 * HOW FAST THIS MACHINE'S PAGES ARE, FOR A CLAIM THAT TIMES A PAGE.
 *
 * "The page's own timer kept time while views spun, never more than 250 ms
 * between 50 ms ticks" was set on this checkout's Mac, where the longest
 * gap was 111–156 ms on the limits page and 170–178 ms in the widget: the
 * host drawing a hostile view up to its budget (100 ms of any second, a
 * wall-clock limit), then stopping it and drawing its plain face (CPU work).
 * On GitHub's runners the same pages took 278 ms (WebKit) and 251–323 ms
 * (verify.yml runs 44315293358, 44324221246, 44327255373): the budget held,
 * and the CPU work around it was slower.
 *
 * So, as import-cost.mjs does for its CPU budgets, a fixed reference — the
 * kind of work the host does drawing a view: elements with style
 * attributes appended, laid out and taken away, and a stylesheet of rules
 * parsed and matched — is run in a page of the same browser (throttled as
 * the harness throttles its pages), and a bound stretches by how much
 * slower it ran here than on the machine the bound was set on. Never
 * shrinks: a regression is the host holding the page longer against the
 * reference, not a slower runner. Never past PACE_CEILING either, the
 * most the host itself stretches a view's budgets on a slow device
 * (packages/guest/src/host/device-pace.ts): past it the claim would hold
 * nothing.
 */

/** As packages/guest/src/host/device-pace.ts's PACE_CEILING: the most a bound stretches. */
export const PACE_CEILING = 4;

/** What the reference took on the machine the bounds were set on (2026-11-18, the median of 7, each engine). */
export const REFERENCE_MS = { chromium: 70.6, webkit: 93, firefox: 36 };

/** How many times slower `ms` is than the reference in `engine`, to a hundredth: at least 1, at most PACE_CEILING, and 1 for an engine with none. */
export function factorOf(ms, engine) {
  const was = REFERENCE_MS[engine];
  if (!(was > 0) || !Number.isFinite(ms)) return 1;
  return Math.min(PACE_CEILING, Math.max(1, Math.round((ms / was) * 100) / 100));
}

/** The reference, run in the page: the median of seven, in milliseconds. */
const reference = () => {
  const times = [];
  const main = document.body.appendChild(document.createElement("main"));
  for (let round = 0; round < 7; round += 1) {
    const began = performance.now();
    for (let i = 0; i < 8_000; i += 1) {
      const element = document.createElement("div");
      element.setAttribute("style", "margin: 1px; color: red; padding: " + (i % 50) + "px");
      element.textContent = "row " + i;
      main.appendChild(element);
    }
    void main.offsetHeight;
    const sheet = document.createElement("style");
    sheet.textContent = Array.from({ length: 4_000 }, (_, i) => ".x" + i + " div { color: red }").join("\n");
    document.head.appendChild(sheet);
    void getComputedStyle(main.lastElementChild).color;
    sheet.remove();
    main.replaceChildren();
    void main.offsetHeight;
    times.push(performance.now() - began);
  }
  main.remove();
  return times.sort((a, b) => a - b)[3];
};

/**
 * How many times slower than the bounds' machine this one runs the
 * reference in `engine`, at least 1. `prepare` throttles the page as the
 * harness throttles its own (GRAVIEW_SLOW).
 */
export async function pageFactor(context, engine, prepare) {
  const tab = await context.newPage();
  try {
    await prepare?.(tab);
    await tab.setContent("<!doctype html><html><head><title>Reference</title></head><body></body></html>");
    const ms = await tab.evaluate(reference);
    return { ms: Math.round(ms * 10) / 10, reference: REFERENCE_MS[engine], factor: factorOf(ms, engine) };
  } finally {
    await tab.close();
  }
}
