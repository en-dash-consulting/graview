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
import { portFor } from "./lib/ports.mjs";

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
    port: portFor("todo"),
    states: [
      ["at rest", "/?theme=light&today=2026-09-01"],
      ["from altitude", "/?theme=light&today=2026-09-01#overview=1"],
      ["focused, with a relation shown", "/?theme=light&today=2026-09-01#focus=rule-order&relation=task&zoom=1"],
      ["in the dark", "/?theme=dark&today=2026-09-01#overview=1"],
    ],
    /* A chosen record's links from altitude: wide with its panel docked, and narrow with its sheet. */
    chosen: [
      ["a task chosen from altitude", 1440, 900, "/?theme=light&today=2026-09-01#focus=t-post&overview=1&zoom=1&sel=t-post&pin.t-post=690.29%2C261.93"],
      ["a task chosen from altitude on a phone", 390, 844, "/?theme=light&today=2026-09-01#overview=1&sel=t-post"],
    ],
  },
  {
    app: "seedbed",
    port: portFor("seedbed"),
    states: [
      ["at rest", "/?chapter=15&theme=light"],
      ["from altitude", "/?chapter=15&theme=light#overview=1"],
      ["a chapter with one kind", "/?chapter=1&theme=light#overview=1"],
    ],
  },
  {
    app: "gauntlet",
    port: portFor("gauntlet"),
    states: [["at rest", "/?theme=light"]],
    /* The ground, in a lens, at 1440 and on a phone, light and dark: nothing chosen draws no record's links; one chosen draws its own. */
    ground: [
      ["the timetable", "The timetable", 1440, 900, "light"],
      ["the timetable in the dark", "The timetable", 1440, 900, "dark"],
      ["the timetable on a phone", "The timetable", 390, 844, "light"],
    ],
  },
  {
    app: "rota",
    port: portFor("rota"),
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

  /*
   * What is under a point, ignoring the overlay itself. A line routed through
   * the gutters leaves a card exactly at its border, and a border at a
   * fractional pixel (a band drawn at 0.95) is outside the element at that
   * very point; so the point and its neighbors within two pixels are asked,
   * which still finds a line ending in open ground.
   */
  const NEAR = [[0, 0], [0, -2], [0, 2], [-2, 0], [2, 0]];
  const pickAt = (p) => {
    for (const [dx, dy] of NEAR) {
      const at = toClient({ x: p.x + dx, y: p.y + dy });
      for (const el of document.elementsFromPoint(at.x, at.y)) {
        if (el.closest("svg") === svg) continue;
        const host = el.closest("[data-graview-pick], [data-graview-view]");
        if (host) {
          return host.getAttribute("data-graview-pick") ?? host.getAttribute("data-graview-view");
        }
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

/*
 * READ A LINE ONCE ITS PATH HAS HELD. A reshape can move the scene twice —
 * the window, then the bar wrapping a frame later because one row no longer
 * holds at the new width — and a line read during the second move points at
 * where its card was. Measured until two readings in a row agree, up to four
 * seconds; what is still moving then is reported as it stands.
 */
async function settled(page) {
  let last = null;
  let reading = await page.evaluate(MEASURE);
  for (let waited = 0; waited < 4000; waited += 200) {
    const said = JSON.stringify(reading);
    if (said === last) break;
    last = said;
    await page.waitForTimeout(200);
    reading = await page.evaluate(MEASURE);
  }
  return reading;
}

/*
 * A CHOSEN RECORD'S LINK ENDS WHERE IT POINTS. Its end dot lies on the far
 * record's building or chip, and a dashed one on its district's ground —
 * never on empty ground, and never on the chosen record's own card (a chip
 * of the card saying the same thing is not the far record drawn). Read from
 * the painted path, as above.
 */
const RECORD_LINKS = () => {
  const stage = document.querySelector(".graview-record-links")?.parentElement;
  const s = stage?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const rel = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };
  const cards = [...document.querySelectorAll("[data-graview-view][data-graview-selected]:not([data-graview-view^='kind:'])")];
  // What is drawn as a far end: a building or a district's ground, and none of what stands inside the chosen record's own card.
  const targets = [...document.querySelectorAll("[data-graview-building], [data-graview-plot] .graview-plot-tile")].filter((el) => !cards.some((card) => card.contains(el))).map(rel);
  const chips = [...document.querySelectorAll("[data-graview-pick]")].filter((el) => cards.some((card) => card !== el && card.contains(el))).map(rel);
  const inside = (box, p, slack) => p.x >= box.x - slack && p.x <= box.x + box.w + slack && p.y >= box.y - slack && p.y <= box.y + box.h + slack;
  return [...document.querySelectorAll(".graview-record-link")].map((g) => {
    const dot = g.querySelector("circle");
    const tail = g.querySelector("path")?.getAttribute("d")?.match(/(-?[\d.]+) (-?[\d.]+)\s*$/);
    const end = dot ? { x: Number(dot.getAttribute("cx")), y: Number(dot.getAttribute("cy")) } : tail ? { x: Number(tail[1]), y: Number(tail[2]) } : null;
    return {
      lands: g.getAttribute("data-graview-lands"),
      edge: g.getAttribute("data-graview-link"),
      end,
      onTarget: end !== null && targets.some((box) => inside(box, end, 4)),
      onItsOwnCard: end !== null && !targets.some((box) => inside(box, end, 4)) && chips.some((box) => inside(box, end, 2)),
    };
  });
};

/*
 * THE GROUND'S LINES ARE A FUNCTION OF THE CHOICE. Every record-level line
 * (a tie to a chosen record's far end, or a connector between two records)
 * is counted with the words it says; nothing chosen, none; one chosen, one
 * line per link and each says which.
 */
const GROUND_LINES = () => {
  const stage = document.querySelector("[data-graview-stage]");
  const s = stage?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const lines = [...document.querySelectorAll("[data-graview-tie], [data-graview-connector]")];
  const said = [...document.querySelectorAll("[data-graview-link-said]")].map((el) => el.textContent.trim());
  const boxes = [...document.querySelectorAll("[data-graview-pick], [data-graview-view]")].map((el) => el.getBoundingClientRect());
  const loose = [...document.querySelectorAll("[data-graview-tie]")].filter((path) => {
    const circle = path.parentElement?.querySelector("circle");
    if (!circle) return false;
    const c = circle.getBoundingClientRect();
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    return !boxes.some((b) => x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 4 && y <= b.bottom + 4);
  }).length;
  return { lines: lines.length, said: said.length, repeated: said.length - new Set(said).size, loose, left: s.left };
};

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, faults: [], seen: [], recordLinks: 0 };

for (const { app, port, states, chosen = [], ground = [] } of APPS) {
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
      report.faults.push(...faults(await settled(page), `${where}, reshaped`));

      await page.close();
    }
    for (const [what, place, width, height, theme] of ground) {
      const where = `${app} ${what}`;
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${served.url}/?theme=${theme}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("[data-graview-stage]") !== null, null, { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const tab = page.getByRole("link", { name: place, exact: true }).first();
      if (!(await tab.isVisible().catch(() => false))) {
        // A narrow bar folds its places into a menu.
        await page.locator('[data-testid="app-places-open"], [data-testid="app-menu"]').first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
      const press = (locator) => locator.first().click({ timeout: 4000 }).then(() => true, () => false);
      const opened =
        (await press(page.getByRole("link", { name: place, exact: true }))) ||
        (await press(page.getByRole("menuitem", { name: place, exact: true }))) ||
        (await press(page.getByText(place, { exact: true })));
      await page.waitForTimeout(2200);
      const count = () => page.evaluate(GROUND_LINES);
      const rest = await count();
      if (!opened) report.faults.push(`${where}: the place could not be opened`);
      report.groundAtRest = (report.groundAtRest ?? 0) + rest.lines;
      if (rest.lines > 0) report.faults.push(`${where}: ${rest.lines} record-level connectors are drawn with nothing chosen`);
      const record = page.locator("[data-graview-pick]:visible").first();
      await record.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const chosenNow = await count();
      report.groundChosen = (report.groundChosen ?? 0) + chosenNow.lines;
      if (chosenNow.lines !== chosenNow.said) report.faults.push(`${where}: ${chosenNow.lines} lines are drawn for the chosen record but ${chosenNow.said} links are said`);
      if (chosenNow.repeated > 0) report.faults.push(`${where}: ${chosenNow.repeated} of the chosen record's links are drawn twice`);
      if (chosenNow.loose > 0) report.faults.push(`${where}: ${chosenNow.loose} lines end where nothing is drawn`);
      // Back out and in again: the lines are a function of the choice, so none is left standing.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1200);
      const after = await count();
      if (after.lines > 0) report.faults.push(`${where}: ${after.lines} lines stay drawn after the record is put down`);
      await page.close();
    }
    for (const [what, width, height, path] of chosen) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${served.url}${path}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("[data-graview-stage]") !== null, null, { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2400);
      for (const link of await page.evaluate(RECORD_LINKS)) {
        report.recordLinks += 1;
        if (!link.onTarget) report.faults.push(`${app} ${what}: a ${link.edge} link ends where nothing is drawn (${link.end ? `${Math.round(link.end.x)},${Math.round(link.end.y)}` : "no end"})`);
        if (link.onItsOwnCard) report.faults.push(`${app} ${what}: a ${link.edge} link ends on the chosen record's own card`);
      }
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
report.checks.everyRecordLinkEndsWhereItPoints = !report.faults.some((f) => /ends where nothing is drawn|ends on the chosen record/.test(f));
report.checks.withNothingChosenNoRecordLevelConnectorIsDrawn = !report.faults.some((f) => /connectors are drawn with nothing chosen|could not be opened/.test(f)) && (report.groundAtRest ?? 0) === 0;
report.checks.aChosenRecordDrawsExactlyItsOwnLinks = !report.faults.some((f) => /links are said|drawn twice|stay drawn|end where nothing/.test(f)) && (report.groundChosen ?? 0) > 0;
report.checks.nothingThrew = !report.faults.some((f) => /Error|Timeout/.test(f));
/*
 * A HARNESS THAT PASSES ON NOTHING IS THEATER: with no lines on any page
 * every claim above is vacuously true and the run has checked nothing.
 */
report.checks.thereWereLinesToCheck = report.lines > 0 && report.recordLinks > 0;
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
