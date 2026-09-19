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
 * FOUR LINES IN ONE STATE IS NOT AN ANALYSIS.
 *
 * The first version of this asked one app in one place and passed, which
 * proved that one picture was all right. A connector fault is a fault of
 * ARRANGEMENT — a box of no size, two ends in the same place, a member
 * inside something that scrolls — so the way to find one is to look at
 * many arrangements, and the framework ships three apps whose pictures are
 * nothing like each other.
 */
const APPS = [
  {
    app: "todo",
    port: 5193,
    states: [
      ["at rest", "/?theme=light&today=2026-09-01"],
      ["from altitude", "/?theme=light&today=2026-09-01#overview=1"],
      ["focused, with a relation shown", "/?theme=light&today=2026-09-01#focus=rule-order&relation=task&zoom=1"],
      ["in the dark", "/?theme=dark&today=2026-09-01#overview=1"],
    ],
  },
  {
    app: "seedbed",
    port: 5194,
    states: [
      ["at rest", "/?chapter=15&theme=light"],
      ["from altitude", "/?chapter=15&theme=light#overview=1"],
      ["a chapter with one kind", "/?chapter=1&theme=light#overview=1"],
    ],
  },
  {
    app: "rota",
    port: 5195,
    states: [
      ["at rest", "/?theme=light&today=2026-09-14"],
      ["from altitude", "/?theme=light&today=2026-09-14#overview=1"],
      ["a shift chosen", "/?theme=light&today=2026-09-14#focus=aggregate:shift&sel=s-fri-repair"],
    ],
  },
];

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
  const sick = [];
  for (const path of document.querySelectorAll("path[data-graview-connector]")) {
    const d = path.getAttribute("d") ?? "";
    /*
     * ARITHMETIC FIRST, because one assertion catches every degeneracy at
     * once: a zero-size box divided into, a control point from two
     * coincident ends, a radius of nothing. A NaN in a path is not a wrong
     * line, it is NO line — the browser drops the whole subpath silently,
     * so the failure looks exactly like a relationship that was never
     * drawn, which is the hardest kind to notice and the easiest to test.
     */
    if (/NaN|Infinity|undefined/.test(d)) sick.push({ kind: path.getAttribute("data-graview-connector"), why: "not a number", d: d.slice(0, 60) });
    else if (d.trim() === "") sick.push({ kind: path.getAttribute("data-graview-connector"), why: "empty path" });
    const e = endsOf(d);
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
  return { stage: { w: Math.round(sb.width), h: Math.round(sb.height) }, lines, sick };
};

const faults = (shot, when) => {
  const out = [];
  if (shot.error) return [`${when}: ${shot.error}`];
  for (const bad of shot.sick ?? []) out.push(`${when}: a ${bad.kind} line is ${bad.why}${bad.d ? ` — ${bad.d}` : ""}`);
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

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, faults: [], seen: [] };

for (const { app, port, states } of APPS) {
  const served = await serving(app, port, repoRoot);
  const browser = await launchEngine(ENGINE, { headless: true });
  try {
    for (const [what, path] of states) {
      const where = `${app} ${what}`;
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
      await page.goto(`${served.url}${path}`, { waitUntil: "load" });
      await page
        .waitForFunction(() => document.querySelector("[data-graview-stage]") !== null, null, { timeout: 30_000 })
        .catch(() => {});
      await page.waitForTimeout(1600);

      const still = await page.evaluate(MEASURE);
      report.faults.push(...faults(still, where));
      report.seen.push({ where, lines: still.lines?.length ?? 0 });

      /*
       * THE SCROLL: the thing that moves content and changes no layout, and
       * the one a measured anchor forgets about.
       */
      const scrollers = await page.evaluate(() => {
        const found = [...document.querySelectorAll("[data-graview-stage] *")].filter((el) => {
          const s = getComputedStyle(el);
          const scrolls = ["auto", "scroll"].includes(s.overflow) || ["auto", "scroll"].includes(s.overflowY) || ["auto", "scroll"].includes(s.overflowX);
          return scrolls && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4);
        });
        for (const el of found) {
          el.scrollTop = Math.min(140, el.scrollHeight - el.clientHeight);
          el.scrollLeft = Math.min(140, el.scrollWidth - el.clientWidth);
        }
        return found.length;
      });
      if (scrollers > 0) {
        await page.waitForTimeout(700);
        report.faults.push(...faults(await page.evaluate(MEASURE), `${where}, scrolled`));
        report.scrolled = (report.scrolled ?? 0) + scrollers;
      }

      /* And a reshape, which moves everything without touching the graph. */
      await page.setViewportSize({ width: 1080, height: 820 });
      await page.waitForTimeout(900);
      report.faults.push(...faults(await page.evaluate(MEASURE), `${where}, reshaped`));

      await page.close();
    }
  } catch (error) {
    report.faults.push(`${app}: ${String(error).slice(0, 160)}`);
  } finally {
    await browser.close();
    served.stop();
  }
}

report.lines = report.seen.reduce((sum, one) => sum + one.lines, 0);
report.checks.everyLineIsDrawable = !report.faults.some((f) => /not a number|empty path/.test(f));
report.checks.everyLineStaysInThePicture = !report.faults.some((f) => /leaves the stage/.test(f));
report.checks.everyLineLandsOnSomething = !report.faults.some((f) => /neither end on anything/.test(f));
report.checks.nothingThrew = !report.faults.some((f) => /Error|Timeout/.test(f));
/*
 * A HARNESS THAT PASSES ON NOTHING IS THEATRE: with no lines on any page
 * every claim above is vacuously true and the run has checked nothing.
 */
report.checks.thereWereLinesToCheck = report.lines > 0;
if (report.lines === 0) report.faults.push("no connectors anywhere: the harness checked nothing");

/*
 * AND SAY WHEN A CLAIM WENT UNEXERCISED.
 *
 * None of the framework's own apps puts a member inside something that
 * scrolls — their lenses fit their cards — so the scroll claim passes here
 * by never being asked. That is not a pass, and pretending it is would be
 * how the fault got in: it was found in a PRODUCT, in a matrix wider than
 * its panel, because the framework had nothing shaped like that to find it
 * in. A harness should be able to say "I did not check this".
 */
if ((report.scrolled ?? 0) === 0) {
  report.unexercised = "no app here has a member inside a scroller, so the scroll claim went unasked";
}

report.passed = Object.values(report.checks).every(Boolean);
writeFileSync(resolve(repoRoot, "docs/lines-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const fault of report.faults.slice(0, 14)) process.stdout.write(`??  ${fault}\n`);
for (const [name, ok] of Object.entries(report.checks)) process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.unexercised) process.stdout.write(`--  ${report.unexercised}\n`);
process.stdout.write(
  `\n${report.lines} lines across ${report.seen.length} states, ${report.scrolled ?? 0} scrollers — ` +
    `${report.passed ? "the lines point at things" : "the lines do not point at things"}\n`,
);
process.exit(report.passed ? 0 : 1);
