#!/usr/bin/env node
/**
 * DO THE LINES POINT AT THE THINGS THEY NAME?
 *
 * A connector is the one part of this picture that makes a claim about two
 * OTHER parts of it. Every other element is wrong on its own — a card in the
 * wrong place looks like a card in the wrong place — but a line that misses
 * says something false about the graph, and it says it in the most
 * believable way the interface has.
 *
 * And it is anchored on MEASURED DOM boxes, which is what lets a line land on
 * one row of a matrix rather than on the panel around it, and is exactly why
 * it goes wrong: a measurement is a fact about a moment. Scroll the matrix
 * and every line still points where the row used to be. Nothing throws,
 * nothing is logged, every test stays green, and the picture is lying.
 *
 * So this asks the only question worth asking — for every line on screen,
 * is each end ON the thing it claims — and asks it again after each of the
 * things that move content without changing the layout.
 *
 *   node scripts/verify-lines.mjs [--engine=webkit]
 *
 * Writes docs/lines-check.json.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
/*
 * The todo app, focused on a rule with its relation shown — the state the
 * UI audit already uses because it is the one with lines in it. A picture
 * with no connectors cannot fail a test about connectors, and a harness
 * that passes on nothing is the thing this file exists to replace.
 */
const served = await serving("todo", 5193, repoRoot);
const PAGE = `${served.url}/?theme=light&today=2026-09-01#focus=rule-order&relation=task&zoom=1`;

/**
 * Every line, and what each end is sitting on.
 *
 * The ends come out of the path's own `d`, which is the thing actually
 * painted — reading the model that produced it would only prove the model
 * agrees with itself.
 */
const MEASURE = () => {
  const stage = document.querySelector("[data-graview-stage]");
  if (!stage) return { error: "no stage" };
  const sb = stage.getBoundingClientRect();
  const svg = document.querySelector("svg[data-graview-connectors], svg");

  /* Stage space to client space: the overlay spans the stage. */
  const toClient = (p) => ({ x: p.x + sb.left, y: p.y + sb.top });

  const endsOf = (d) => {
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (nums.length < 4) return null;
    return {
      p0: { x: nums[0], y: nums[1] },
      p1: { x: nums[nums.length - 2], y: nums[nums.length - 1] },
    };
  };

  /* What is under a point, ignoring the overlay itself. */
  const pickAt = (p) => {
    const at = toClient(p);
    for (const el of document.elementsFromPoint(at.x, at.y)) {
      if (el.closest("svg") === svg) continue;
      const host = el.closest("[data-graview-pick], [data-graview-view]");
      if (host) {
        return host.getAttribute("data-graview-pick") ?? host.getAttribute("data-graview-view");
      }
    }
    return null;
  };

  const lines = [];
  for (const path of document.querySelectorAll("path[data-graview-connector]")) {
    const e = endsOf(path.getAttribute("d") ?? "");
    if (e === null) continue;
    const at = toClient(e.p0);
    const to = toClient(e.p1);
    lines.push({
      kind: path.getAttribute("data-graview-connector"),
      edges: Number(path.getAttribute("data-graview-edges") ?? 1),
      /* Inside the stage at all? A line leaving the picture is never right. */
      inside:
        at.x >= sb.left - 2 && at.x <= sb.right + 2 && at.y >= sb.top - 2 && at.y <= sb.bottom + 2 &&
        to.x >= sb.left - 2 && to.x <= sb.right + 2 && to.y >= sb.top - 2 && to.y <= sb.bottom + 2,
      lands: [pickAt(e.p0), pickAt(e.p1)],
      length: Math.hypot(e.p1.x - e.p0.x, e.p1.y - e.p0.y),
    });
  }
  return { stage: { w: Math.round(sb.width), h: Math.round(sb.height) }, lines };
};

const faults = (shot, when) => {
  const out = [];
  if (shot.error) return [`${when}: ${shot.error}`];
  for (const line of shot.lines) {
    if (!line.inside) out.push(`${when}: a ${line.kind} line leaves the stage`);
    /*
     * A line whose end lands on NOTHING is the stale-measurement signature:
     * it is pointing at a place where its thing used to be. A self-loop and
     * a line ending under another card are both legitimate, so the test is
     * "on something", not "on the right thing" — which is the strongest
     * claim that is true of every honest line.
     */
    if (line.length > 4 && line.lands[0] === null && line.lands[1] === null) {
      out.push(`${when}: a ${line.kind} line has neither end on anything`);
    }
  }
  return out;
};

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, faults: [] };
const browser = await launchEngine(ENGINE, { headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-graview-stage]") !== null, null, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  /* Something selected, so there are lit lines with real ends. */
  const opened = await page.evaluate(() => {
    const pick =
      document.querySelector('[data-graview-pick^="kind:"]') ??
      document.querySelector("[data-graview-pick]");
    pick?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return pick?.getAttribute("data-graview-pick") ?? null;
  });
  await page.waitForTimeout(1200);
  report.opened = opened;

  /*
   * THE CONSTELLATION FIRST, because it is where the lines are: every kind
   * against every other, which is the densest picture this framework draws
   * and the one where a wrong anchor has the most room to be wrong in.
   */
  await page.goto(`${served.url}/?theme=light&today=2026-09-01#overview=1`, { waitUntil: "load" });
  await page.waitForTimeout(1600);
  const above = await page.evaluate(MEASURE);
  report.checks.linesLandOnSomethingFromAltitude = faults(above, "from altitude").length === 0;
  report.faults.push(...faults(above, "from altitude"));
  report.overviewLines = above.lines?.length ?? 0;

  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForTimeout(1400);

  const still = await page.evaluate(MEASURE);
  report.checks.linesLandOnSomethingAtRest = faults(still, "at rest").length === 0;
  report.faults.push(...faults(still, "at rest"));
  report.lines = still.lines?.length ?? 0;

  /*
   * THE SCROLL. The thing that moves content and changes no layout, and the
   * one every measured anchor forgets about.
   */
  const scrolled = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll("[data-graview-stage] *")].filter((el) => {
      const s = getComputedStyle(el);
      return (
        (s.overflow === "auto" || s.overflow === "scroll" || s.overflowY === "auto" || s.overflowX === "auto") &&
        (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4)
      );
    });
    for (const el of scrollers) {
      el.scrollTop = Math.min(120, el.scrollHeight - el.clientHeight);
      el.scrollLeft = Math.min(120, el.scrollWidth - el.clientWidth);
    }
    return scrollers.length;
  });
  report.scrollers = scrolled;
  await page.waitForTimeout(700);
  const after = await page.evaluate(MEASURE);
  report.checks.linesLandOnSomethingAfterAScroll = faults(after, "after a scroll").length === 0;
  report.faults.push(...faults(after, "after a scroll"));

  /* And after the window changes shape, which moves everything. */
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(900);
  const resized = await page.evaluate(MEASURE);
  report.checks.linesLandOnSomethingAfterAResize = faults(resized, "after a resize").length === 0;
  report.faults.push(...faults(resized, "after a resize"));

  await page.close();
} catch (error) {
  report.error = String(error).slice(0, 300);
} finally {
  await browser.close();
  served.stop();
}

/*
 * A HARNESS THAT PASSES ON NOTHING IS THEATRE. If the page drew no lines,
 * every claim above is vacuously true and the run has checked nothing —
 * which is a failure of the harness, and should read as one.
 */
report.checks.thereWereLinesToCheck = (report.lines ?? 0) + (report.overviewLines ?? 0) > 0;
if (!report.checks.thereWereLinesToCheck) {
  report.faults.push("no connectors were drawn: the harness checked nothing");
}
report.passed = Object.values(report.checks).every(Boolean) && !report.error;
writeFileSync(resolve(repoRoot, "docs/lines-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const fault of report.faults.slice(0, 12)) process.stdout.write(`??  ${fault}\n`);
for (const [name, ok] of Object.entries(report.checks)) process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}\n`);
process.stdout.write(
  `\n${report.overviewLines ?? 0} from altitude, ${report.lines ?? 0} in the stack, ` +
    `${report.scrollers ?? 0} scrollers — ${report.passed ? "the lines point at things" : "the lines do not point at things"}\n`,
);
process.exit(report.passed ? 0 : 1);
