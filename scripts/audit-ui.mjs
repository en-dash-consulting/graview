#!/usr/bin/env node
/**
 * What is actually WRONG on each screen, in numbers.
 *
 * `survey-ui.mjs` photographs every place a person can land; this asks the
 * questions a photograph makes you squint at — are two cards on top of each
 * other, is a control smaller than a fingertip, does a caption end in an
 * ellipsis mid-word, is the same string on screen twice. Every one of these
 * was found by eye first, which is exactly why they belong in a script.
 *
 *   node scripts/audit-ui.mjs [app]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

const APPS = {
  todo: { port: 5193, ready: "__todoReady", query: "&today=2026-09-01", states: {
    lists: async () => {},
    week: async (p) => { await p.locator('[data-testid="places"] button', { hasText: "The week" }).click(); },
    selected: async (p) => { await p.click('[data-graview-pick="t-deposit"]'); },
    // Every existing state left plane 1 empty, which is how minus-one-pixel
    // band arithmetic sat unseen: nothing ever measured a raised relation.
    raised: async (p) => { await p.click('[data-graview-view="kind:list"]'); },
    travelled: async (p) => { await p.dblclick('[data-graview-pick="t-deposit"]'); },
    graview: async (p) => { await p.click('[data-testid="overview"]'); },
  } },
  the household example: { port: 5190, ready: "__the household exampleReady", states: {
    home: async () => {},
    selected: async (p) => { const s = await p.getAttribute("[data-graview-span]", "data-graview-span"); await p.click(`[data-graview-pick="${s}"]`); },
    raised: async (p) => { await p.click('[data-graview-view="kind:person"]'); },
    travelled: async (p) => { const s = await p.getAttribute("[data-graview-span]", "data-graview-span"); await p.dblclick(`[data-graview-pick="${s}"]`); },
    graview: async (p) => { await p.click('[data-testid="overview"]'); },
  } },
  proposal: { port: 5191, ready: "__proposalReady", states: {
    home: async () => {},
    selected: async (p) => { const k = await p.getAttribute("[data-graview-pick]", "data-graview-pick"); await p.click(`[data-graview-pick="${k}"]`); },
    raised: async (p) => { await p.click('[data-graview-view="kind:requirement"]'); },
    graview: async (p) => { await p.click('[data-testid="overview"]'); },
  } },
  the coaching example: { port: 5192, ready: "__the coaching exampleReady", states: {
    team: async () => {},
    training: async (p) => { await p.locator('[data-testid="places"] button', { hasText: "What we train" }).click(); },
    week: async (p) => { await p.locator('[data-testid="places"] button', { hasText: "The week" }).click(); },
    selected: async (p) => { await p.click('[data-graview-pick="p-amara"]'); },
    // The exact screen the raised-relation collapse was reported from: the
    // team place with Drills raised, and one drill selected.
    raised: async (p) => { await p.click('[data-graview-view="kind:drill"]'); await p.waitForTimeout(900); const d = await p.getAttribute('[data-graview-plane="1"]', "data-graview-view"); await p.click(`[data-graview-view="${d}"]`); },
    travelled: async (p) => { await p.dblclick('[data-graview-pick="p-amara"]'); },
    problem: async (p) => { await p.click('[data-testid="standing"]'); await p.waitForTimeout(400); await p.click('[data-testid="problems"] li:nth-child(4) button'); },
    graview: async (p) => { await p.click('[data-testid="overview"]'); },
  } },
};

function startVite(name, port) {
  const child = spawn("npx", ["vite"], { cwd: resolve(repoRoot, `apps/${name}`), stdio: ["ignore", "pipe", "pipe"], detached: true });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 60_000);
    child.stdout.on("data", (c) => { if (String(c).includes(String(port))) { clearTimeout(timer); ready(child); } });
    child.on("exit", (code) => { clearTimeout(timer); fail(new Error(`vite exited with ${code}`)); });
  });
}

const audit = () => {
  const box = (el) => el.getBoundingClientRect();
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
    const b = box(el);
    return b.width > 2 && b.height > 2;
  };
  const area = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  };

  /* Two cards drawn on top of one another. Views are siblings on a stage and
     the layout is supposed to keep them apart; where it does not, one card is
     literally hiding another's content. */
  const views = [...document.querySelectorAll("[data-graview-view]")].filter(visible);
  const collisions = [];
  /*
   * A TUCK is not a collision. A card drawn deliberately behind the one it
   * hangs off says so in the tree, and counting that as a defect buries the
   * real ones — which is exactly what happened while a fan of six illegible
   * slivers sat on screen and every count said the same thing it says for a
   * clean strip.
   */
  const tucks = new Set();
  for (const el of views) {
    const parent = el.dataset.graviewNested;
    if (!parent) continue;
    tucks.add(`${el.dataset.graviewView}|${parent}`);
    tucks.add(`${parent}|${el.dataset.graviewView}`);
  }
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const a = box(views[i]), b = box(views[j]);
      const over = area(a, b);
      if (over < 200) continue;
      // Ignore a near-plane card deliberately drawn over a far one.
      const pa = Number(views[i].dataset.graviewPlane), pb = Number(views[j].dataset.graviewPlane);
      if (pa !== pb) continue;
      if (tucks.has(`${views[i].dataset.graviewView}|${views[j].dataset.graviewView}`)) continue;
      collisions.push({
        a: views[i].dataset.graviewView, b: views[j].dataset.graviewView,
        plane: pa, overlap: Math.round(over),
        share: Math.round((over / Math.min(a.width * a.height, b.width * b.height)) * 100),
      });
    }
  }

  /* A control too small to hit. 24px is the WCAG 2.2 minimum. */
  /*
   * A control's DESIGNED size, not its projected one.
   *
   * The scene draws a receded plane at 0.85 and the overview at less than
   * half, so a perfectly good 24-pixel control measures 20 back there — and
   * that is the depth model working, not a defect. Dividing by the host's own
   * scale asks the question that has an answer: was this built big enough?
   */
  const scaleOf = (el) => {
    const host = el.closest("[data-graview-view]");
    if (!host) return 1;
    const m = new DOMMatrixReadOnly(getComputedStyle(host).transform);
    const natural = el.closest("[data-graview-natural]");
    const inner = natural ? new DOMMatrixReadOnly(getComputedStyle(natural).transform).a : 1;
    return Math.max(0.05, (m.a || 1) * (inner || 1));
  };
  const small = [...document.querySelectorAll("button, [role=button], a[href], select, input")]
    .filter(visible)
    .map((el) => ({ el, b: box(el), scale: scaleOf(el) }))
    // Half a pixel of tolerance: a control designed at exactly 24 must not
    // fail on a sub-pixel transform.
    .filter(({ b, scale }) => b.width / scale < 23.5 || b.height / scale < 23.5)
    .slice(0, 10)
    .map(({ el, b, scale }) => ({
      what: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28),
      size: `${Math.round(b.width / scale)}x${Math.round(b.height / scale)}`,
    }));

  /* A caption cut mid-word. An ellipsis is a decision; one on a label that had
     room beside it is a layout that gave up. */
  const cut = [...document.querySelectorAll("*")]
    .filter((el) => el.children.length === 0 && visible(el))
    .filter((el) => {
      const s = getComputedStyle(el);
      if (s.textOverflow !== "ellipsis") return false;
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      // A capped label that carries the whole string in its tooltip has
      // TIDIED rather than lost it, which is the contract the chip and the
      // observation line both keep on purpose.
      return !el.closest("[title]");
    })
    .slice(0, 8)
    .map((el) => (el.textContent ?? "").trim().slice(0, 34));

  /* The same string twice: the smell the codebase already names. */
  const seen = new Map();
  for (const el of document.querySelectorAll("h1,h2,h3,strong,button,[data-testid=focused],nav *")) {
    if (el.children.length > 0) continue;
    // A string that is not on screen cannot repeat on it: altitude-only
    // controls exist in the tree at display none inside the stack.
    if (!visible(el)) continue;
    /*
     * A RAISED card duplicating its origin's title is the design, not the
     * smell: keeping the origin legible while its members stand on plane 1
     * is an acceptance criterion, and the same node drawn in two places
     * carries the same name both times. Likewise the strip, which exists to
     * name the selection the way a crumb names the focus.
     */
    if (el.closest('[data-graview-plane="1"], [data-testid="inspector-strip"], .graview-kind-open')) continue;
    const t = (el.textContent ?? "").trim();
    if (t.length < 6) continue;
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  /*
   * The crumb for the thing you are looking at is SUPPOSED to name it — that
   * pairing is a breadcrumb beside a heading, which is how every document
   * works. What is not supposed to happen is chrome naming a PLACE that the
   * picture below it also names, which is a different string in a different
   * element saying the same thing for no reason.
   */
  const crumb = (document.querySelector("[data-testid=focused]")?.textContent ?? "")
    .replace(/\s*×\s*$/, "")
    .trim();
  // The raised chip names the raised relation the way the crumb names the
  // focus — and the group it names deliberately stays visible below.
  const raisedChip = (document.querySelector("[data-testid=raised]")?.textContent ?? "")
    .replace(/\s*×\s*$/, "")
    .trim();
  const repeats = [...seen.entries()]
    .filter(([t, n]) => n > 1 && t !== crumb && t !== raisedChip)
    .map(([t, n]) => `${t} x${n}`);

  /*
   * Chrome sitting on the CONTENT.
   *
   * The strip is an elevated transient surface now — it floats in front of
   * the scene instead of reserving a band of it, and hovering over the
   * constant kinds shelf while a selection is open is the design, not a
   * defect: the shelf is a map, the strip is dismissible, and the elevation
   * shadow says which is nearer. What would still be wrong is the strip
   * sitting on the thing you are actually working with — the focus or a
   * raised card — so that is what this counts.
   */
  const strip = document.querySelector('[data-testid="inspector-strip"]');
  const covered = [];
  if (strip && !document.querySelector('[role="dialog"]')) {
    const s = box(strip);
    for (const v of views) {
      if (Number(v.dataset.graviewPlane) >= 2) continue;
      // The PANEL someone can see, not the band slot the layout allotted:
      // a host is the full band with the view centred inside it, and the
      // strip sitting on a slot's empty margin covers nothing.
      const inner = v.querySelector('[data-graview-primitive="panel"], .graview-kind-card') ?? v;
      const b = box(inner);
      const o = area(b, s);
      // A transient surface may lap a panel's margin; sitting on a real
      // share of it is what covering means.
      if (o > 200 && o > b.width * b.height * 0.06)
        covered.push({ id: v.dataset.graviewView, overlap: Math.round(o) });
    }
  }

  /* The board's own arrangement: no slot on top of another, and no slot
     clipped by the pitch edge — the two ways a shrinking pitch failed, kept
     failing, and never showed up in a count. */
  const boardEl = document.querySelector('[data-graview-primitive="board"]');
  const board = [];
  if (boardEl) {
    const pitch = box(boardEl);
    const slots = [...boardEl.querySelectorAll("[data-graview-slot]")]
      .filter(visible)
      .map((el) => ({ id: el.dataset.graviewSlot, b: box(el) }));
    for (const { id, b } of slots) {
      if (b.left < pitch.left - 2 || b.right > pitch.right + 2 || b.top < pitch.top - 2 || b.bottom > pitch.bottom + 2)
        board.push(`${id} clipped by the pitch edge`);
    }
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++)
        if (area(slots[i].b, slots[j].b) > 40) board.push(`${slots[i].id} overlaps ${slots[j].id}`);
  }

  /* How much of the stage carries anything at all. */
  const stage = document.querySelector("[data-graview-stage]");
  let fill = null;
  if (stage) {
    const s = box(stage);
    const painted = views.reduce((sum, v) => { const b = box(v); return sum + b.width * b.height; }, 0);
    fill = Math.round((painted / (s.width * s.height)) * 100);
  }

  /* The strip's own shape: how many actions it is showing against how many
     it has, since hiding most of them behind "+N more" defeats the point. */
  let inspector = null;
  if (strip) {
    const shown = strip.querySelectorAll('[data-testid="affordances"] > li').length;
    const more = strip.querySelector('[data-testid="affordances"] li:last-child button');
    const hidden = /^\+(\d+) more$/.exec((more?.textContent ?? "").trim());
    const b = box(strip);
    inspector = {
      shown: hidden ? shown - 1 : shown,
      hidden: hidden ? Number(hidden[1]) : 0,
      size: `${Math.round(b.width)}x${Math.round(b.height)}`,
      text: (strip.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
    };
  }

  return { collisions: collisions.slice(0, 8), small, cut, repeats, covered, board, fill, inspector };
};

const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const report = { at: new Date().toISOString(), screens: [] };
let browser;

try {
  browser = await chromium.launch({ executablePath: BROWSER, headless: !process.argv.includes("--headed") });
  for (const [name, app] of Object.entries(APPS)) {
    if (only && only !== name) continue;
    const vite = await startVite(name, app.port);
    try {
      for (const [state, go] of Object.entries(app.states)) {
        const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
        try {
          await page.goto(`http://localhost:${app.port}/?theme=light${app.query ?? ""}`, { waitUntil: "load" });
          await page.waitForFunction((f) => f in window, app.ready, { timeout: 120_000 });
          await page.waitForTimeout(900);
          await go(page);
          await page.waitForTimeout(1200);
          report.screens.push({ app: name, state, ...(await page.evaluate(audit)) });
        } catch (error) {
          report.screens.push({ app: name, state, error: String(error).slice(0, 160) });
        } finally {
          await page.close();
        }
      }
    } finally {
      try { process.kill(-vite.pid, "SIGKILL"); } catch { vite.kill("SIGKILL"); }
    }
  }
} finally {
  await browser?.close();
}

writeFileSync(resolve(repoRoot, "docs/audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

let bad = 0;
for (const s of report.screens) {
  const where = `${s.app}/${s.state}`.padEnd(20);
  if (s.error) { process.stdout.write(`FAIL ${where} ${s.error}\n`); bad++; continue; }
  const notes = [
    s.collisions.length ? `${s.collisions.length} card collisions (worst ${s.collisions[0].share}%)` : "",
    s.covered.length ? `strip covers ${s.covered.length}` : "",
    s.board?.length ? `board: ${s.board[0]}${s.board.length > 1 ? ` +${s.board.length - 1}` : ""}` : "",
    s.cut.length ? `${s.cut.length} cut: ${s.cut[0]}` : "",
    s.repeats.length ? `repeats: ${s.repeats.join(", ")}` : "",
    s.small.length ? `${s.small.length} controls under 24px` : "",
    s.inspector?.hidden ? `strip hides ${s.inspector.hidden} of ${s.inspector.hidden + s.inspector.shown} actions` : "",
  ].filter(Boolean);
  if (notes.length) bad++;
  process.stdout.write(`${notes.length ? "??" : "ok"} ${where} ${notes.join("; ")}\n`);
}
process.stdout.write(`\n${report.screens.length - bad} of ${report.screens.length} screens clean\n`);
