#!/usr/bin/env node
/**
 * THE SCENE KEEPS UP WITH A HAND ON AN APP OF A THOUSAND RECORDS.
 *
 * A product owner, on an app of a thousand records and four thousand links (2026-10-24):
 * "the scene view really struggles with performance … it's super slow and
 * laggy cuz there's loads of data … also, the grid that displays should
 * move with the image while panning, instead of snapping back into the
 * correct spot after the panning/moving action completes." Measured, a drag
 * that was designed to cost nothing in React rendered the scene; letting go
 * of it drew every card and every record the panel beside the map listed
 * again, then flew a half-second tween from the picture to itself; and the
 * ground's lattice stood still under the cards while they moved and jumped
 * to meet them when the hand let go.
 *
 * The app's data stays where it is. This serves a made-up field survey of
 * the same shape (`scripts/fixtures/large-scene/field-survey.mjs`: twenty
 * kinds, 1,016 records, about 4,100 links, districts of 3 to 250) with
 * `graview preview` — the page as it ships, production React — and holds:
 *
 *   a drag on a 1,000-record scene sets no React state, from altitude and
 *   on the ground: not one commit while the hand moves;
 *
 *   every grid under the picture moves with it while it is dragged and
 *   does not jump when it is let go: mid-drag the lattice from altitude and
 *   the fine measure on the ground have each moved exactly as far as what
 *   stands on them — a building, a card — and letting go moves none of it;
 *
 *   letting go of a drag draws the scene once and no card again: one
 *   render of the scene, nothing inside a card on the ground (a board of
 *   250), and the main thread busy under its budget; the wheel likewise;
 *
 *   entering a district of 250 records takes under its budget.
 *
 * TIMES ARE THE MAIN THREAD'S OWN (DevTools' TaskDuration, before and after
 * each gesture), at a quarter of the processor's speed as the report was
 * measured (`GRAVIEW_SLOW` to choose another). And they are held against a
 * REFERENCE: a fixed piece of work — records built and sorted, a column of
 * text laid out and read — run in the same page under the same throttle.
 * The budgets were set on a machine where it took `REFERENCE_MS`; a machine
 * or a throttle that takes longer stretches every budget by as much (never
 * shrinks it), so a regression is the scene growing against the reference,
 * not a slower runner. Opening a district beside the map is reported and
 * not held: most of it is the relations' ribbons being routed, which are
 * measured on their own elsewhere.
 *
 * Chromium only: the throttle and the task clock are DevTools'.
 *
 *   node scripts/verify-scene-at-scale.mjs [--headed]
 *
 * Writes docs/scene-at-scale.json.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { writeFieldSurvey } from "./fixtures/large-scene/field-survey.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const SLOWDOWN = Number(process.env["GRAVIEW_SLOW"] ?? 0) > 1 ? Number(process.env["GRAVIEW_SLOW"]) : 4;
const PORT = portFor("scene-at-scale");

/*
 * WHAT THE REFERENCE TOOK, at 4× on the machine the budgets were set on
 * (2026-10-24, an Apple-silicon laptop, median of five runs), and THE
 * BUDGETS, in main-thread milliseconds at that speed: what the scene took
 * there after the work, with about twice the room. Before it, on the same
 * machine and the same survey: a drag's forty moves 413 ms (now 365 — they
 * were meant to cost nothing in React, and the grid's own move is in them
 * now), letting go 306 (now ~120), the wheel 366 (~125), letting go on the
 * board of 250 307 (~105), going in 1,450 (~1,340, a board of 250 drawn).
 */
const REFERENCE_MS = 87;
const BUDGET = {
  "drag-moves": 700,
  release: 250,
  wheel: 250,
  "go-in": 2_000,
  "ground-release": 220,
};

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-scene-at-scale: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "graview-scene-at-scale-"));
const survey = writeFieldSurvey(dir);
const report = { at: new Date().toISOString(), engine: "chromium", slowdown: SLOWDOWN, records: survey.records, links: survey.links, claims: {}, measured: {} };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...detail };
};

await vacant(PORT);
const server = spawn(process.execPath, [CLI, "preview", survey.document, "--seed", survey.seed, "--port", String(PORT)], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("scene-at-scale");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-scene-at-scale: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}

/*
 * WHAT REACT DID, without React's devtools: the hook React looks for when it
 * loads, standing in for them. Each commit is counted, and each component
 * that rendered in it — and whether what it draws is inside a card on the
 * scene (`[data-graview-view]`, below the card's own element).
 */
const counting = () => {
  const tally = { commits: 0, rendered: 0, inCards: 0 };
  const firstElement = (fiber) => {
    for (let at = fiber.child; at; at = at.child) if (at.tag === 5) return at.stateNode;
    return null;
  };
  const walk = (fiber, mounting) => {
    for (let f = fiber; f; f = f.sibling) {
      const mount = mounting || f.alternate === null;
      if ([0, 1, 11, 14, 15].includes(f.tag) && (mount || (f.flags & 1) === 1)) {
        tally.rendered += 1;
        const element = firstElement(f);
        if (element?.parentElement?.closest?.("[data-graview-view]")) tally.inCards += 1;
      }
      if (!mount && f.alternate && f.child === f.alternate.child) continue;
      if (f.child) walk(f.child, mount);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    inject(renderer) {
      this.renderers.set(1, renderer);
      return 1;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      tally.commits += 1;
      walk(root.current.child, false);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  window.__react = () => {
    const out = { ...tally };
    tally.commits = 0;
    tally.rendered = 0;
    tally.inCards = 0;
    return out;
  };
};

/** The fixed work the budgets are scaled by: no Graview in it. */
const referenceWork = () => {
  const began = performance.now();
  const rows = [];
  for (let i = 0; i < 40_000; i++) rows.push({ id: `r${i}`, n: (i * 7919) % 10_007, s: `name ${(i * 31) % 997}` });
  rows.sort((a, b) => a.n - b.n || (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
  const kept = JSON.parse(JSON.stringify(rows.slice(0, 8_000)));
  const column = document.createElement("div");
  column.style.cssText = "position:absolute;left:-10000px;top:0;width:640px;font:14px sans-serif";
  for (let i = 0; i < 2_000; i++) {
    const line = document.createElement("div");
    line.textContent = `${kept[i].s} ${kept[i].id}`;
    line.style.padding = `${i % 3}px`;
    column.append(line);
  }
  document.body.append(column);
  let tall = 0;
  for (const line of column.children) tall += line.getBoundingClientRect().height;
  column.remove();
  return tall > 0 ? performance.now() - began : -1;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

let browser;
try {
  browser = await launchEngine("chromium", { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.addInitScript(counting);
  await page.goto(`${base}/places/overview`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-drawn]", { timeout: 120_000 });
  await page.waitForTimeout(1_500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOWDOWN });
  await cdp.send("Performance.enable");
  await page.waitForTimeout(1_500);

  // The reference, under the same throttle: the first run warms the engine and is not counted.
  await page.evaluate(referenceWork);
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await page.evaluate(referenceWork));
  const reference = median(runs);
  const factor = Math.max(1, reference / REFERENCE_MS);
  report.reference = { ms: Math.round(reference), setOn: REFERENCE_MS, factor: Number(factor.toFixed(2)) };
  const budget = (name) => Math.round(BUDGET[name] * factor);

  /** Main-thread milliseconds spent while `act` runs and the page settles after it. */
  const busy = async (act, settle = 1_200) => {
    const task = async () => (await cdp.send("Performance.getMetrics")).metrics.find((metric) => metric.name === "TaskDuration").value;
    const before = await task();
    await act();
    await page.waitForTimeout(settle);
    return Math.round(((await task()) - before) * 1000);
  };
  const react = () => page.evaluate(() => window.__react());
  const afterFrames = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)))));

  /** Open ground near a point: nothing pickable under it. */
  const groundNear = (wanted) =>
    page.evaluate(({ x, y }) => {
      const bare = (px, py) => {
        const el = document.elementFromPoint(px, py);
        return el !== null && el.closest(".graview-ground") !== null && !el.closest("[data-graview-view], [data-graview-pick], button, a, [role='button'], .graview-plot-tile");
      };
      for (let r = 0; r <= 500; r += 20) {
        for (let a = 0; a < 360; a += r === 0 ? 360 : 20) {
          const px = Math.round(x + r * Math.cos((a * Math.PI) / 180));
          const py = Math.round(y + r * Math.sin((a * Math.PI) / 180));
          if (bare(px, py)) return { x: px, y: py };
        }
      }
      return null;
    }, wanted);

  /** Where the lattice is anchored and where a building on it stands, as drawn. */
  const ground = () =>
    page.evaluate(() => {
      const anchor = (selector) => {
        const grid = document.querySelector(`.graview-ground > ${selector}`);
        const [x, y] = (grid ? getComputedStyle(grid).backgroundPosition.split(",")[0] : "").trim().split(/\s+/).map((part) => Number.parseFloat(part));
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      };
      const roofs = [...document.querySelectorAll("[data-graview-building] .graview-iso-roof")];
      const roof = roofs[Math.floor(roofs.length / 2)]?.getBoundingClientRect();
      const card = document.querySelector("[data-graview-stage] > [data-graview-view]")?.getBoundingClientRect();
      return {
        lattice: anchor(".graview-lattice"),
        measure: anchor(".graview-measure"),
        building: roof ? { x: roof.left, y: roof.top } : null,
        card: card ? { x: card.left, y: card.top } : null,
      };
    });
  /** How far `grid` and `thing` moved from `rest` to `during`, and how far either moved again from `during` to `after`. */
  const together = (rest, during, after, grid, thing) => {
    const a = rest?.[grid], b = during?.[grid], c = after?.[grid], p = rest?.[thing], q = during?.[thing], r = after?.[thing];
    if (!a || !b || !c || !p || !q || !r) return { ok: false, missing: [grid, thing] };
    const gridMoved = { x: b.x - a.x, y: b.y - a.y };
    const thingMoved = { x: q.x - p.x, y: q.y - p.y };
    const gridJumped = Math.hypot(c.x - b.x, c.y - b.y);
    const thingJumped = Math.hypot(r.x - q.x, r.y - q.y);
    const ok = Math.hypot(thingMoved.x, thingMoved.y) > 30 && Math.abs(gridMoved.x - thingMoved.x) <= 1 && Math.abs(gridMoved.y - thingMoved.y) <= 1 && gridJumped <= 1 && thingJumped <= 1;
    return { ok, gridMoved, thingMoved, gridJumped, thingJumped };
  };

  /** A drag of 40 moves from open ground, held before it is let go. */
  const dragFrom = async (from, dx, dy) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(from.x + (dx * i) / 40, from.y + (dy * i) / 40);
      await page.waitForTimeout(16);
    }
  };

  /* ── from altitude ─────────────────────────────────────────────────── */
  const start = await groundNear({ x: 1200, y: 300 });
  if (!start) throw new Error("no open ground to drag from at altitude");
  // The first drag puts "Reset view" in the trail, which the scene steps its signs past: once, not each drag.
  await dragFrom(start, -120, 40);
  await page.mouse.up();
  await page.waitForTimeout(1_500);
  await react();

  const rest = await ground();
  let during = null;
  const moves = await busy(async () => {
    await dragFrom(start, -240, 80);
    await afterFrames();
    during = await ground();
  }, 0);
  const whileMoving = await react();
  const release = await busy(() => page.mouse.up());
  const letGo = await react();
  await page.waitForTimeout(300);
  const after = await ground();
  report.measured.altitude = { moves, release, whileMoving, letGo, rest, during, after };

  claim("a drag on a 1,000-record scene sets no React state", whileMoving.commits === 0, { commits: whileMoving.commits, rendered: whileMoving.rendered });
  const grids = {
    "the lattice, from altitude": together(rest, during, after, "lattice", "building"),
    "the fine measure, from altitude": together(rest, during, after, "measure", "building"),
  };
  claim(`a drag's own moves keep the main thread under ${budget("drag-moves")} ms`, moves <= budget("drag-moves"), { measured: moves, budget: budget("drag-moves") });
  claim(
    `letting go of a drag draws the scene once and takes under ${budget("release")} ms`,
    letGo.commits <= 2 && letGo.inCards === 0 && release <= budget("release"),
    { measured: release, budget: budget("release"), commits: letGo.commits, renderedInCards: letGo.inCards, rendered: letGo.rendered },
  );

  // The wheel pans the ground from altitude: the same hand, and the same letting go.
  const at2 = await groundNear({ x: 1100, y: 400 });
  await page.mouse.move(at2.x, at2.y);
  const wheel = await busy(async () => {
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(-40, -30);
      await page.waitForTimeout(40);
    }
  });
  const wheeled = await react();
  report.measured.wheel = { wheel, wheeled };
  claim(`the wheel's pan draws no card again and takes under ${budget("wheel")} ms`, wheeled.inCards === 0 && wheel <= budget("wheel"), { measured: wheel, budget: budget("wheel"), commits: wheeled.commits });

  /* ── a district beside the map, and in it ──────────────────────────── */
  const biggest = await page.evaluate(() => {
    const plots = [...document.querySelectorAll("[data-graview-view^='kind:']")];
    const counted = plots.map((card) => ({ id: card.getAttribute("data-graview-view"), name: card.querySelector("[data-graview-district-name]")?.textContent?.trim() ?? "", n: Number((card.textContent ?? "").match(/(\d+)/)?.[1] ?? 0) }));
    return counted.sort((a, b) => b.n - a.n)[0] ?? null;
  });
  if (!biggest) throw new Error("no district to open");
  report.measured.biggest = biggest;
  const beside = await busy(() => page.locator(`[data-graview-view="${biggest.id}"] [data-graview-district-name]`).first().click(), 6_000);
  await react();
  report.measured.besideTheMap = { ms: beside, note: "reported, not held: the relations' ribbons are routed here (ribbons.ts)" };
  const goIn = await busy(() => page.getByTestId("district-panel-go").click(), 3_000);
  await react();
  const onGround = await page.evaluate(() => ({ cards: document.querySelectorAll("[data-graview-view] [data-graview-primitive='card'], [data-graview-view] .graview-column-card").length, elements: document.querySelectorAll("*").length }));
  report.measured.goIn = { ms: goIn, ...onGround };
  claim(`entering a district of ${biggest.n} records takes under ${budget("go-in")} ms`, goIn <= budget("go-in"), { measured: goIn, budget: budget("go-in"), elements: onGround.elements });

  /* ── on the ground, over a board of every record ───────────────────── */
  const there = await groundNear({ x: 1380, y: 200 });
  if (!there) throw new Error("no open ground to drag from on the ground");
  const still = await ground();
  await dragFrom(there, -160, 80);
  await afterFrames();
  const held = await ground();
  const groundMoving = await react();
  const groundRelease = await busy(() => page.mouse.up());
  const groundLetGo = await react();
  await page.waitForTimeout(300);
  grids["the fine measure, on the ground"] = together(still, held, await ground(), "measure", "card");
  claim(
    "every grid under the picture moves with it while it is dragged and does not jump when it is let go",
    Object.values(grids).every((one) => one.ok),
    grids,
  );
  report.measured.ground = { groundMoving, groundRelease, groundLetGo };
  claim("a drag on the ground over a board of 250 sets no React state", groundMoving.commits === 0, { commits: groundMoving.commits });
  claim(
    `letting go on the ground draws no card on the board again and takes under ${budget("ground-release")} ms`,
    groundLetGo.inCards === 0 && groundRelease <= budget("ground-release"),
    { measured: groundRelease, budget: budget("ground-release"), renderedInCards: groundLetGo.inCards, rendered: groundLetGo.rendered, commits: groundLetGo.commits },
  );
  claim("no page error", report.pageErrors.length === 0, { errors: report.pageErrors });
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 600);
} finally {
  await browser?.close();
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}

report.passed = !report.error && Object.values(report.claims).length > 0 && Object.values(report.claims).every((one) => one.ok);
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/scene-at-scale.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, one] of Object.entries(report.claims)) process.stdout.write(`${one.ok ? "ok" : "FAIL"} ${name}${one.measured !== undefined ? ` (${one.measured} ms)` : ""}\n`);
if (report.error) process.stdout.write(`FAIL ${report.error}\n`);
process.stdout.write(`reference ${report.reference?.ms ?? "?"} ms (set on ${REFERENCE_MS}), budgets ×${report.reference?.factor ?? "?"}\n`);
process.exit(report.passed ? 0 : 1);
