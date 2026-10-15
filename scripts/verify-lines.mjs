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
    /*
     * A RECORD ON THE GROUND, ITS CARD OVER A BAND OF CHIPS IN GROUPS, and
     * the same record risen from: the discography's artist whose card lists
     * thirteen songs and releases under three headings.
     */
    app: "discography",
    port: portFor("discography"),
    states: [],
    record: { id: "artist:skatterman-snug-brim", name: "Skatterman & Snug Brim", sizes: [[1440, 900], [390, 844]] },
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
  // Words two ties would both say are said once, for both (`data-graview-said-for`): counted for each tie they speak for.
  const saidFor = [...document.querySelectorAll("[data-graview-link-said]")].reduce((sum, el) => sum + (Number(el.getAttribute("data-graview-said-for")) || 1), 0);
  return { lines: lines.length, said: saidFor, repeated: said.length - new Set(said).size, loose, left: s.left };
};

/*
 * EVERY LINE ON THE GROUND IS ONE LINE. With a record in focus, each line
 * drawn — a tie from its card to a chip of the band, a road between two
 * chips, a tie from a chosen chip to a district — is a single connected
 * path (one subpath, not a run of dashes the chips and captions cut it
 * into), whose two ends lie on drawings (the card, a chip, a card of the
 * band or the shelf), and no stretch of it lies behind or across another
 * drawing: sampled every few pixels along the painted path, nothing else is
 * there but the ground. Read from the paths the browser painted.
 */
const WHOLE = (focus) => {
  const stage = document.querySelector("[data-graview-stage]");
  const drawings = [...document.querySelectorAll('[data-graview-primitive="chip"], [data-graview-primitive="panel"], [data-graview-pick], .graview-kind-card, .graview-kind-face, [data-graview-view][data-graview-plane="1"] > *')]
    .filter((el) => !el.closest("[data-graview-offstage]"))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 2 && r.height > 2);
  const words = [...document.querySelectorAll("[data-graview-relation] > span")].map((el) => el.getBoundingClientRect());
  const card = document.querySelector(`[data-graview-view="${CSS.escape(focus)}"]`);
  const cardBox = (card?.querySelector('[data-graview-primitive="panel"]') ?? card)?.getBoundingClientRect() ?? null;
  const near = (r, p, slack) => p.x >= r.left - slack && p.x <= r.right + slack && p.y >= r.top - slack && p.y <= r.bottom + slack;
  const inside = (r, p) => p.x > r.left + 1 && p.x < r.right - 1 && p.y > r.top + 1 && p.y < r.bottom - 1;
  const lines = [];
  for (const path of document.querySelectorAll("path[data-graview-connector], path[data-graview-tie]")) {
    const d = path.getAttribute("d") ?? "";
    const length = path.getTotalLength();
    if (length < 2) continue;
    const m = path.getScreenCTM();
    const at = (t) => {
      const p = path.getPointAtLength(t);
      return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
    };
    const ends = [at(0), at(length)];
    const covered = [];
    for (let t = 6; t < length - 6; t += 4) {
      const p = at(t);
      const hit = document
        .elementsFromPoint(p.x, p.y)
        .find((el) => el.closest('[data-graview-primitive], [data-graview-pick], .graview-kind-card, .graview-kind-face') && !el.closest("[data-graview-offstage]"));
      if (hit || words.some((r) => inside(r, p))) {
        const by = hit ? (hit.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ?? hit.closest("[data-graview-view]")?.getAttribute("data-graview-view") ?? hit.tagName) : "a caption";
        covered.push({ x: Math.round(p.x), y: Math.round(p.y), by });
      }
    }
    const fromCard = [path.getAttribute("data-graview-from"), path.getAttribute("data-graview-to")].includes(focus);
    lines.push({
      kind: path.getAttribute("data-graview-connector") ?? path.getAttribute("data-graview-tie"),
      from: path.getAttribute("data-graview-from"),
      to: path.getAttribute("data-graview-to"),
      subpaths: (d.match(/M/g) ?? []).length,
      endsOnDrawings: ends.every((p) => drawings.some((r) => near(r, p, 2.5))),
      // On the card's drawn edge to a pixel: not on the edge of the slot the layout gave it, nor short of it.
      oneEndOnTheCard: !fromCard || (cardBox !== null && ends.some((p) => near(cardBox, p, 1))),
      covered: covered.slice(0, 3),
      coveredCount: covered.length,
    });
  }
  return { lines, stage: stage ? Math.round(stage.getBoundingClientRect().width) : 0 };
};

/* What altitude shows of a record risen from: the panel beside the map, and nothing of it stamped over the city. */
const RISEN = (id) => {
  const panel = document.querySelector("[data-graview-map-panel]");
  const stamped = [...document.querySelectorAll(`[data-graview-view="${CSS.escape(id)}"]`)].filter((el) => !el.closest("[data-graview-map-panel]")).length;
  return {
    hash: location.hash,
    overview: /overview=1/.test(location.hash),
    panel: panel?.getAttribute("data-graview-map-panel") ?? null,
    title: panel?.querySelector('[data-testid="record-panel-title"]')?.textContent?.trim() ?? null,
    stamped,
    building: document.querySelector(`[data-graview-building="${CSS.escape(id)}"]`) !== null,
  };
};

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, faults: [], seen: [], recordLinks: 0 };

/* `--only=<app>` while iterating on one app's lines; the verdict is the whole run's. */
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
for (const { app, port, states, chosen = [], ground = [], record } of APPS.filter((one) => !ONLY || one.app === ONLY)) {
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
    for (const [width, height] of record?.sizes ?? []) {
      const where = `${app} ${record.id} at ${width}`;
      const page = await browser.newPage({ viewport: { width, height } });
      const open = async (hash) => {
        await page.goto(`${served.url}/?theme=light${hash}`, { waitUntil: "load" });
        await page.waitForFunction(() => "__graviewReady" in window && document.querySelector("[data-graview-stage]") !== null, null, { timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(2200);
      };
      report.ground = report.ground ?? { lines: 0, ties: 0, asked: 0 };
      const judge = async (when) => {
        const shot = await page.evaluate(WHOLE, record.id);
        report.ground.lines += shot.lines.length;
        report.ground.ties += shot.lines.filter((line) => line.from === record.id || line.to === record.id).length;
        for (const line of shot.lines) {
          const named = `${where}, ${when}: a ${line.kind} line ${line.from ?? ""}→${line.to ?? ""}`;
          if (line.subpaths !== 1) report.faults.push(`${named} is ${line.subpaths} pieces, not one line`);
          if (!line.endsOnDrawings) report.faults.push(`${named} ends where nothing is drawn`);
          if (!line.oneEndOnTheCard) report.faults.push(`${named} does not end on the record's card`);
          if (line.coveredCount > 0) report.faults.push(`${named} runs behind or across ${line.covered.map((c) => `${c.by} at ${c.x},${c.y}`).join("; ")}`);
        }
        return shot;
      };
      /* On the ground, at rest; then pointed at one of its chips in the band, and at one in its card. */
      await open(`#focus=${encodeURIComponent(record.id)}`);
      await judge("at rest");
      for (const [which, selector] of [
        ["a chip of the band pointed at", '[data-graview-view][data-graview-plane="1"] > *'],
        ["a chip of its card pointed at", `[data-graview-view="${record.id}"] [data-graview-pick]`],
      ]) {
        const target = page.locator(selector).first();
        if (!(await target.isVisible().catch(() => false))) continue;
        await target.hover({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(500);
        const shot = await judge(which);
        const asked = shot.lines.filter((line) => line.from === record.id || line.to === record.id).length;
        report.ground.asked += asked;
        if (asked === 0) report.faults.push(`${where}, ${which}: no tie from the record's card is drawn for it`);
      }
      /*
       * WITH THE REAL POINTER AND THE KEYBOARD, given more room and with
       * another record chosen: the mouse moved onto a chip of the band draws
       * that chip's tie and keeps it while it stays; Tab onto a chip does the
       * same; and while the card is held and moved, every tie still starts on
       * its drawn edge.
       */
      const tieFor = async (id) => (await page.evaluate(WHOLE, record.id)).lines.filter((line) => [line.from, line.to].includes(record.id) && [line.from, line.to].includes(id)).length;
      await open(`#focus=${encodeURIComponent(record.id)}&zoom=1`);
      const chips = page.locator('[data-graview-view][data-graview-plane="1"]');
      const chosenBox = await chips.nth(0).boundingBox();
      if (chosenBox) {
        await page.mouse.click(chosenBox.x + 12, chosenBox.y + chosenBox.height / 2);
        await page.waitForTimeout(900);
      }
      const other = (await chips.count()) > 1 ? chips.nth(1) : null;
      const otherId = other ? await other.getAttribute("data-graview-view") : null;
      const otherBox = other ? await (other.locator("> *").first()).boundingBox() : null;
      if (otherId && otherBox) {
        await page.mouse.move(otherBox.x + otherBox.width / 2, otherBox.y + otherBox.height / 2, { steps: 8 });
        await page.waitForTimeout(500);
        await judge("pointed at by the mouse with another chosen");
        const drawn = await tieFor(otherId);
        await page.waitForTimeout(1200);
        const kept = await tieFor(otherId);
        report.pointer = [...(report.pointer ?? []), { where, otherId, drawn, kept }];
        if (drawn === 0) report.faults.push(`${where}: the mouse on ${otherId} does not draw its tie while another record is chosen`);
        else if (kept === 0) report.faults.push(`${where}: the tie to ${otherId} is gone while the mouse is still on it`);
      } else report.faults.push(`${where}: no second chip of the band to point at`);
      /* The keyboard: Tab until a chip of the band or of the card has it. */
      await page.mouse.move(4, height - 4);
      await page.waitForTimeout(400);
      const resting = (await page.evaluate(WHOLE, record.id)).lines.filter((line) => [line.from, line.to].includes(record.id)).length;
      let tabbed = null;
      for (let press = 0; press < 60 && tabbed === null; press++) {
        await page.keyboard.press("Tab");
        tabbed = await page.evaluate((focus) => {
          const el = document.activeElement;
          const band = el?.closest('[data-graview-view][data-graview-plane="1"]');
          if (band) return band.getAttribute("data-graview-view");
          const pick = el?.closest(`[data-graview-view="${CSS.escape(focus)}"] [data-graview-pick]`);
          return pick ? pick.getAttribute("data-graview-pick") : null;
        }, record.id);
      }
      await page.waitForTimeout(500);
      const keyed = tabbed ? (await page.evaluate(WHOLE, record.id)).lines.filter((line) => [line.from, line.to].includes(record.id)).length : 0;
      report.keyboard = [...(report.keyboard ?? []), { where, tabbed, resting, ties: keyed }];
      if (!tabbed) report.faults.push(`${where}: Tab never reaches a chip of the band or the card`);
      else if (keyed <= resting && (await tieFor(tabbed)) === 0) report.faults.push(`${where}: Tab onto ${tabbed} does not draw its tie`);
      /* Held: the card pressed and moved, and every tie measured while it is. */
      const cardBox = await page.locator(`[data-graview-view="${record.id}"]`).boundingBox();
      if (cardBox) {
        const x = cardBox.x + cardBox.width * 0.6;
        const y = cardBox.y + 60;
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let step = 1; step <= 10; step++) {
          await page.mouse.move(x + step * 4, y + step * 3);
          await page.waitForTimeout(30);
        }
        await page.waitForTimeout(300);
        const held = await judge("while the card is held");
        report.held = [...(report.held ?? []), { where, lines: held.lines.length }];
        await page.mouse.up();
        await page.waitForTimeout(800);
      }

      /* Up from it, every way: Up, the zoom-out control, ctrl+wheel, an address, and Back. */
      const risen = async (how) => {
        const seen = await page.evaluate(RISEN, record.id);
        report.risen = [...(report.risen ?? []), { where, how, ...seen }];
        if (!seen.overview) report.faults.push(`${where}, ${how}: did not rise (${seen.hash})`);
        if (seen.title !== record.name) report.faults.push(`${where}, ${how}: the record is not in the panel beside the map (${seen.panel ?? "no panel"}, ${seen.title ?? "no title"})`);
        if (seen.stamped > 0) report.faults.push(`${where}, ${how}: the record's card is drawn over the city`);
        if (!seen.building) report.faults.push(`${where}, ${how}: the record's building is not drawn on the map`);
      };
      await open(`#focus=${encodeURIComponent(record.id)}`);
      await page.locator('[data-testid="overview"]').click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1600);
      await risen("Up");
      for (let press = 0; press < 2; press++) {
        await page.locator('[data-testid="zoom-out"]').click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(800);
      await risen("the zoom-out control");
      /* And down again: the ground, with the card. */
      await page.locator('[data-testid="overview"]').click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const down = await page.evaluate((id) => ({ hash: location.hash, card: document.querySelector(`[data-graview-stage] [data-graview-view="${CSS.escape(id)}"]`) !== null }), record.id);
      report.descended = [...(report.descended ?? []), { where, ...down }];
      if (/overview=1/.test(down.hash) || !down.card) report.faults.push(`${where}: closing the map does not return to the ground with the record's card (${down.hash})`);
      await open(`#focus=${encodeURIComponent(record.id)}`);
      await page.mouse.move(width / 2, height * 0.8);
      await page.keyboard.down("Control");
      for (let turn = 0; turn < 6; turn++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(60);
      }
      await page.keyboard.up("Control");
      await page.waitForTimeout(1600);
      await risen("ctrl+wheel");
      await open(`#focus=${encodeURIComponent(record.id)}&overview=1`);
      await risen("an address");
      await page.locator('[data-testid="record-panel-go"]').click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1600);
      await page.goBack();
      await page.waitForTimeout(1800);
      await risen("Back");
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
report.checks.everyLineOnTheGroundIsOneWholeLineFromDrawingToDrawing =
  (report.ground?.lines ?? 0) > 0 &&
  (report.ground?.asked ?? 0) > 0 &&
  !report.faults.some((f) => /pieces, not one line|ends where nothing is drawn|does not end on the record's card|no tie from the record's card/.test(f));
report.checks.theRealPointerAndTheKeyboardDrawATieWhateverElseIsChosen =
  (report.pointer ?? []).length > 0 && (report.keyboard ?? []).length > 0 && !report.faults.some((f) => /does not draw its tie|is gone while the mouse|Tab never reaches|Tab onto|no second chip/.test(f));
report.checks.whileTheCardIsHeldEveryTieStartsOnItsDrawnEdge = (report.held ?? []).length > 0 && !report.faults.some((f) => /while the card is held: .* (does not end on the record's card|is \d+ pieces|ends where nothing)/.test(f));
report.checks.noLineOnTheGroundRunsBehindOrAcrossAnything = (report.ground?.lines ?? 0) > 0 && !report.faults.some((f) => /runs behind or across/.test(f));
report.checks.aRecordRisenFromIsInThePanelBesideTheMapAndNotOverTheCity =
  (report.risen ?? []).length >= 10 && !report.faults.some((f) => /did not rise|not in the panel beside the map|drawn over the city|building is not drawn|closing the map does not return/.test(f));
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
