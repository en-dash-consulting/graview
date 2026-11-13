#!/usr/bin/env node
/**
 * PAGES AND THE SCENE ARE ONE FACE, AND ONE CONTROL MOVES A LEVEL.
 *
 * Things' routed pages stand over the Scene's own city (`sceneUnderPages`),
 * and what Nick asked of it, looking at it, is held here by name, at a desk
 * and on a phone: no Scene/Pages switch and a person at the root sent to
 * the one face; one quiet control at the bottom left, Page · Nearby · City,
 * that says the level and goes to any; the same page moving through every
 * level, its lines exact every frame, never sheared, never overshooting;
 * the bar fixed and usable at every level; every view standing on its
 * district at the City, inside the window, clear of every district's
 * ground, buildings and name, every name readable; anything chosen at the
 * City landing at Nearby and staying, Back included; the ground letting go
 * of a choice and the camera free at the City; every view that shows
 * records drawing their lines; the history rising and sinking with the
 * scrub, the same element throughout; and a duplicate view found by
 * `graview check`, its edit removing it. And on a rich app — Deep Time at
 * its size, eleven kinds, 294 records, ten worker views — the City and
 * Nearby read clean: nothing said stands on anything else said, every
 * district names its kind, no word is cut off or wraps, the legend is
 * closed until its button opens it, and each view's board is that view.
 * There, too, a record opened in the city by a press or a link is lit where
 * it stands with its district in its order and nothing faded but what a
 * fresh load fades; a board's post crosses no name and runs under any board
 * it has to cross; a district's "⚠ n" opens that kind's problems alone; and
 * the page is drawn once, its elements, keyboard and typed word kept as the
 * one face arrives.
 *
 * Frame strips (desk and phone, light and dark), and the rich app's City
 * and Nearby at 1280 and 390 wide (`rich-*.png`), are written to
 * docs/one-face/ for a person to look at.
 *
 *   node scripts/verify-one-face.mjs [--engine=chromium|webkit]   (Chromium by default)
 *
 * Writes docs/one-face.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, devices } from "playwright";
import { launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";
import { serveRich } from "./lib/one-face-rich-host.mjs";
import { document as deepTime } from "./fixtures/one-face-rich/deep-time.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ["chromium"];
const DESK = { width: 1440, height: 900 };
const PHONE = "Pixel 7";
const DAY = "today=2026-09-01";
const STRIPS = resolve(repoRoot, "docs/one-face");

const report = { at: new Date().toISOString(), engines, app: "apps/todo", checks: {} };
const errors = [];
const seen = { switch: [], button: [], node: [], lines: [], views: [], chosen: [], shear: [], duplicate: [], risen: [], sunk: [], scrubbed: [], stand: [], cover: [], inside: [], names: [], ground: [], free: [], overshoot: [], bar: [], viewLines: [], resize: [], resizeLines: [], resizeKept: [], pinch: [], standsOut: [], noCityWords: [], connected: [], chosenRecord: [], crossing: [], offSight: [], shortcuts: [], keysTurnOff: [], zoomKeys: [], inField: [], shortcutsRun: [], folds: [], dragged: [], keptChoice: [], sliderRun: [], small: [], legend: [], richClear: [], richNamed: [], richWords: [], richLegend: [], richViews: [], richRecords: [], richNearbyViews: [], richControls: [], richOwnDistrict: [], richLegible: [], richHomeNearby: [], richOneLevel: [], richSmooth: [], richFocusSeen: [], richProblems: [], richHand: [], richProblemsOfKind: [], richPosts: [], richPostsUnder: [], recordInPlace: [], oneRuleFades: [], noWordsAfterPress: [], drawnOnce: [] };

/* ------------------------------------------------------------------ */
/* In the page                                                         */
/* ------------------------------------------------------------------ */

const ready = async (page) => {
  await page.waitForSelector("[data-graview-one-place]", { timeout: 60_000 });
  await page.waitForTimeout(600);
};
const levelOf = (page) => page.evaluate(() => Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place")));
/** Wait until the face rests at a level: the sheet says it and nothing is moving. */
async function restAt(page, level, timeout = 8_000) {
  await page.waitForFunction(
    (want) => {
      const sheet = document.querySelector("[data-graview-one-place]");
      const city = document.querySelector('[data-testid="one-place-city"]');
      const now = Number(city?.getAttribute("data-graview-altitude-now") ?? (want === 0 ? 0 : -1));
      return Number(sheet?.getAttribute("data-graview-one-place")) === want && Math.abs(now - want) < 0.002;
    },
    level,
    { timeout },
  );
  await page.waitForTimeout(260);
}

/**
 * THE RECORDER: from now, every animation frame, what that frame drew —
 * the page's element and its box and transform, each line's two ends with
 * the building and the page edge it should meet, and each board's box and
 * its face's transform. Registered after the face's own frame, so it reads
 * what the face wrote in the same frame.
 */
function startRecording(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector("[data-graview-one-place]");
    if (sheet && sheet.__oneFace === undefined) sheet.__oneFace = Math.random();
    const token = sheet?.__oneFace;
    const frames = [];
    window.__oneFaceFrames = frames;
    window.__oneFaceStop = false;
    const matrixOf = (el) => {
      const t = getComputedStyle(el).transform;
      if (!t || t === "none") return [1, 0, 0, 1, 0, 0];
      const m = new DOMMatrixReadOnly(t);
      return [m.a, m.b, m.c, m.d, m.e, m.f];
    };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const tick = () => {
      if (window.__oneFaceStop) return;
      requestAnimationFrame(tick);
      const now = document.querySelector("[data-graview-one-place]");
      if (!now) return;
      const city = document.querySelector('[data-testid="one-place-city"]');
      const lines = [...document.querySelectorAll("[data-graview-line]")]
        .filter((g) => getComputedStyle(g.ownerSVGElement ?? g).opacity !== "0")
        .map((g) => {
          const [fx, fy] = (g.getAttribute("data-graview-line-from") ?? "0,0").split(",").map(Number);
          const [tx, ty] = (g.getAttribute("data-graview-line-to") ?? "0,0").split(",").map(Number);
          const [bx, by] = (g.getAttribute("data-graview-line-bend") ?? "0,0").split(",").map(Number);
          const key = g.getAttribute("data-graview-line");
          const on = g.getAttribute("data-graview-line-on");
          const under = g.hasAttribute("data-graview-line-under");
          const building = on === "building" ? document.querySelector(`[data-graview-building="${CSS.escape(key)}"]`) : null;
          return { key, on, under, from: { x: fx, y: fy }, to: { x: tx, y: ty }, bend: { x: bx, y: by }, building: building ? rect(building) : null, opacity: Number(getComputedStyle(g.ownerSVGElement).opacity) };
        });
      const boards = [...document.querySelectorAll("[data-graview-board]")].map((b) => ({ key: b.getAttribute("data-graview-board"), path: b.getAttribute("data-graview-board-path"), box: rect(b), opacity: Number(b.style.opacity || 0), face: b.firstElementChild ? matrixOf(b.firstElementChild) : null, own: b.hasAttribute("aria-current") }));
      // Each district's name as this face draws it, and how much of it is seen.
      const names = [...document.querySelectorAll("[data-graview-district-tag]")].map((t) => ({ key: t.getAttribute("data-graview-district-tag"), box: rect(t), opacity: t.style.visibility === "hidden" ? 0 : Number(t.style.opacity || 1) * Number(getComputedStyle(t.parentElement).opacity) }));
      // Read while it is in the window's flow, the page is the window: the box it fills.
      const inFlow = getComputedStyle(now).display === "contents";
      const bar = document.querySelector('[data-testid="one-place-bar"]')?.getBoundingClientRect();
      // The control and the legend over it, and the timeline beside them: all of what stands at the foot.
      const dock = [document.querySelector("[data-graview-one-face-dock]"), document.querySelector("[data-graview-past-slot] > *")].filter(Boolean).map((el) => el.getBoundingClientRect());
      const control = dock.length ? dock.reduce((a, b) => new DOMRect(Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right) - Math.min(a.left, b.left), Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top))) : null;
      frames.push({
        names,
        bar: bar ? { x: bar.left, y: bar.top, width: bar.width, height: bar.height } : null,
        control: control ? { x: control.left, y: control.top, width: control.width, height: control.height } : null,
        t: performance.now(),
        same: now.__oneFace === token,
        level: Number(now.getAttribute("data-graview-one-place")),
        altitude: Number(city?.getAttribute("data-graview-altitude-now") ?? 0),
        box: inFlow ? { x: 0, y: 0, width: innerWidth, height: innerHeight } : rect(now),
        matrix: inFlow ? [1, 0, 0, 1, 0, 0] : matrixOf(now),
        lines,
        boards,
        url: location.pathname,
        // What the page is standing on: the page it shows, once the new address has drawn.
        standing: now.getAttribute("data-graview-standing-on"),
      });
    };
    requestAnimationFrame(tick);
  });
}
const stopRecording = (page) =>
  page.evaluate(() => {
    window.__oneFaceStop = true;
    return window.__oneFaceFrames ?? [];
  });

/** No frame of the page's box moves more than this share of the whole way it went. */
function jumps(frames) {
  const travel = (key) => Math.max(...frames.map((f) => f.box[key])) - Math.min(...frames.map((f) => f.box[key]));
  let worst = 0;
  let at = -1;
  for (let i = 1; i < frames.length; i++) {
    for (const key of ["x", "y", "width", "height"]) {
      const whole = travel(key);
      if (whole < 4) continue;
      const step = Math.abs(frames[i].box[key] - frames[i - 1].box[key]) / whole;
      if (step > worst) {
        worst = step;
        at = i;
      }
    }
  }
  return { worst: Number(worst.toFixed(3)), at };
}

/** Whether a transform moves and scales alike in both directions, and nothing else. */
const shearless = (m) => Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6 && Math.abs(m[0] - m[3]) < 1e-6;

/** Every line in every frame: its building end on the building as painted, its page end on the page's edge. */
function lineMisses(frames, phone) {
  let worst = 0;
  let counted = 0;
  const examples = [];
  for (const frame of frames) {
    for (const line of frame.lines) {
      if (line.opacity < 0.05) continue;
      if (line.building && !line.under) {
        const mid = { x: line.building.x + line.building.width / 2, y: line.building.y + line.building.height / 2 };
        const miss = Math.hypot(mid.x - line.to.x, mid.y - line.to.y);
        counted++;
        if (miss > worst) worst = miss;
        if (miss > 2 && examples.length < 4) examples.push({ key: line.key, end: "building", miss: Number(miss.toFixed(2)), altitude: frame.altitude });
      }
      // The page end: on the page's edge facing the city, as the page's box is in this frame.
      const edge = phone ? Math.abs(line.from.y - frame.box.y) : Math.abs(line.from.x - frame.box.x);
      counted++;
      if (edge > worst) worst = edge;
      if (edge > 2 && examples.length < 4) examples.push({ key: line.key, end: "page", miss: Number(edge.toFixed(2)), altitude: frame.altitude });
    }
  }
  return { worst: Number(worst.toFixed(2)), counted, examples };
}


/** Every point of every line, sampled along its curve in every frame: none inside the page, the bar or the control. */
function linesInside(frames) {
  const inside = (p, b, pad = 1) => b && p.x > b.x + pad && p.x < b.x + b.width - pad && p.y > b.y + pad && p.y < b.y + b.height - pad;
  let crossed = 0;
  let counted = 0;
  const examples = [];
  for (const frame of frames) {
    if (frame.altitude < 0.6 || frame.altitude > 1.4) continue;
    for (const line of frame.lines) {
      if (line.opacity < 0.05 || !line.bend) continue;
      counted++;
      for (let i = 1; i < 20; i++) {
        const t = i / 20;
        const p = { x: (1 - t) ** 2 * line.from.x + 2 * (1 - t) * t * line.bend.x + t * t * line.to.x, y: (1 - t) ** 2 * line.from.y + 2 * (1 - t) * t * line.bend.y + t * t * line.to.y };
        if (inside(p, frame.box) || inside(p, frame.bar) || inside(p, frame.control)) {
          crossed++;
          if (examples.length < 4) examples.push({ key: line.key, altitude: frame.altitude, at: p });
          break;
        }
      }
    }
  }
  return { counted, crossed, examples };
}

const press = async (page, selector) => {
  await page.locator(selector).first().click();
};

/* ------------------------------------------------------------------ */
/* What each claim drives                                             */
/* ------------------------------------------------------------------ */

async function noSwitch(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  await page.locator('[data-testid="app-menu-open"]').first().click();
  const opened = await page.waitForSelector('[data-testid="app-menu"]:not([hidden])', { timeout: 5_000 }).then(() => true, () => false);
  await page.waitForTimeout(400);
  const menu = await page.evaluate(() => ({
    faces: document.querySelectorAll('[data-testid="app-faces"], [data-testid^="app-face-"]').length,
    sceneLink: [...document.querySelectorAll("a")].filter((a) => /in the scene/i.test(a.textContent ?? "") && a.offsetParent !== null).length,
    // No altitude control on the bar: the one at the foot is the way up.
    barUp: document.querySelectorAll('[data-testid="one-place-bar"] [data-testid*="altitude"], [data-testid="one-place-bar"] [data-testid="up"]').length,
  }));
  await page.keyboard.press("Escape");
  return { where, opened, ...menu, ok: opened && menu.faces === 0 && menu.sceneLink === 0 && menu.barUp === 0 };
}

async function rootIsTheOneFace(browser, where) {
  const context = await browser.newContext({ viewport: DESK });
  // A person, not a driven browser: the app's root sends a person to the one face.
  await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${where.device} root: ${error.message}`));
  await page.goto(`${at("todo")}/?${DAY}`, { waitUntil: "load" });
  await page.waitForURL(/\/pages\//, { timeout: 30_000 });
  await ready(page);
  await restAt(page, 2, 15_000).catch(() => {});
  const landed = { url: new URL(page.url()).pathname, level: await levelOf(page), shell: await page.locator(".graview-shell, [data-testid=\"lines-key\"]").count() };
  await context.close();
  return { where, ...landed, ok: /^\/pages\/?$/.test(landed.url) && landed.level === 2 && landed.shell === 0 };
}

async function theButton(page, where, phone) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const read = () =>
    page.evaluate(() => {
      const box = document.querySelector('[data-testid="altitude"]');
      const group = box?.querySelector('[role="group"]');
      const stops = [0, 1, 2].map((n) => {
        const b = document.querySelector(`[data-testid="altitude-stop-${n}"]`);
        const r = b?.getBoundingClientRect();
        // The stop's own word, read without the keycap that stands over it while the legend is open (the legend says the keys).
        const cap = b?.querySelector("kbd");
        const words = b ? [...b.childNodes].filter((node) => node !== cap).map((node) => node.textContent).join("").trim() : null;
        return b ? { w: r.width, h: r.height, name: b.getAttribute("aria-label"), words, keycap: cap ? cap.textContent.trim() : null, pressed: b.getAttribute("aria-pressed") === "true" } : null;
      });
      const sheet = document.querySelector("[data-graview-one-place]").getBoundingClientRect();
      const r = group?.getBoundingClientRect();
      return {
        at: r ? { left: r.left, bottom: innerHeight - r.bottom, top: r.top, height: r.height } : null,
        stops,
        said: group?.getAttribute("aria-label") ?? null,
        key: Boolean(document.querySelector('[data-testid="altitude-key"]')),
        sheetTop: sheet.top,
        controlBottom: r?.bottom ?? null,
      };
    });
  const levels = [];
  levels.push({ level: 0, ...(await read()) });
  /*
   * The control covers none of the page: scrolled to its foot, no part a
   * person reads or presses (a leaf with words, a control, a picture) is
   * under the control — and the page keeps no empty band for it where
   * nothing would be under it (Nick, 2026-11-12: "extra space in the footer").
   */
  const foot = await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((done) => setTimeout(done, 300));
    const room = document.querySelector("[data-graview-altitude-room]");
    const parts = [document.querySelector("[data-graview-one-face-dock]"), document.querySelector("[data-graview-past-slot] > *")].filter(Boolean).map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const sheet = document.querySelector("[data-graview-one-place]");
    const covered = [...sheet.querySelectorAll("*")]
      .filter((el) => !room?.contains(el) && (el.matches("a[href], button, input, select, textarea, img, svg, video, canvas, [role=button], [role=link]") || (el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0)))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && parts.some((p) => r.right > p.left && r.left < p.right && r.bottom > p.top && r.top < p.bottom);
      })
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent ?? "").trim().slice(0, 30)}”`);
    const roomHeight = room ? room.getBoundingClientRect().height : null;
    /*
     * And no empty band: with the room taken away, the page scrolled to its
     * end again, something must stand under the control for there to be any
     * room at all — and never more room than the control's own height and air.
     */
    let neededWithout = null;
    if (room && roomHeight > 0) {
      const was = room.style.height;
      room.style.height = "0px";
      window.scrollTo(0, document.documentElement.scrollHeight);
      neededWithout = [...sheet.querySelectorAll("*")].some((el) => {
        if (room.contains(el) || !(el.matches("a[href], button, input, select, textarea, img, svg, video, canvas, [role=button], [role=link]") || (el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0))) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && parts.some((p) => r.right > p.left - 8 && r.left < p.right + 8 && r.bottom > p.top - 8 && r.top < p.bottom);
      });
      room.style.height = was;
    }
    const most = Math.max(0, ...parts.map((p) => p.height)) + 40;
    return { room: Boolean(room), roomHeight, neededWithout, most, covered };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Alt+ArrowUp");
  await restAt(page, 1);
  levels.push({ level: 1, ...(await read()) });
  await page.keyboard.press("Alt+ArrowUp");
  await restAt(page, 2);
  levels.push({ level: 2, ...(await read()) });
  await page.keyboard.press("Alt+ArrowDown");
  await restAt(page, 1);
  await page.keyboard.press("Escape");
  await restAt(page, 0);
  // Named stops a person reads, the one here lit; a thumb's size on a phone, the bar's own size at a desk.
  const sized = (l) => l.stops.every((stop) => stop && Boolean(stop.name) && (phone ? stop.h >= 44 && stop.w >= 44 : stop.h <= 30));
  const lit = (l) => l.stops.map((stop) => stop?.pressed).join() === [0, 1, 2].map((n) => n === l.level).join();
  const words = (l) => l.stops.map((stop) => stop?.words).join("·") === "Page·Nearby·City";
  // A keycap, where one stands over a stop, names that stop's own key.
  const caps = (l) => l.stops.every((stop, n) => stop?.keycap === null || stop?.keycap === String(n + 1));
  // At the bottom left — a phone's rides above the sheet at Nearby.
  const corner = (l) => l.at && l.at.left <= 24 && (l.at.bottom <= 24 || (phone && l.level === 1));
  const ok =
    levels.every((l) => corner(l) && sized(l) && lit(l) && words(l) && caps(l)) &&
    levels.every((l) => l.key) &&
    /1 of 3/.test(levels[0].said ?? "") && /3 of 3/.test(levels[2].said ?? "") &&
    foot.room && foot.covered.length === 0 && (foot.roomHeight === 0 || (foot.neededWithout === true && foot.roomHeight <= foot.most)) &&
    // A phone's sheet: the control rides above it, never over it.
    (!phone || (levels[1].controlBottom !== null && levels[1].controlBottom <= levels[1].sheetTop + 1)) &&
    (await levelOf(page)) === 0;
  return { where, levels, foot, ok };
}

async function sameNode(page, where, phone) {
  // A phone's sheet shows the top of a record's page, where no part names another record: its list's rows do.
  await page.goto(`${at("todo")}${phone ? "/pages/tasks" : "/pages/tasks/t-deposit"}?${DAY}`, { waitUntil: "load" });
  await ready(page);
  await startRecording(page);
  for (const [button, level] of [["rise", 1], ["rise", 2], ["descend", 1], ["descend", 0]]) {
    await press(page, `[data-graview-${button}]`);
    await restAt(page, level);
  }
  const frames = await stopRecording(page);
  const moving = frames.filter((f, i) => i > 0 && JSON.stringify(f.box) !== JSON.stringify(frames[i - 1].box));
  const jump = jumps(frames);
  seen.lines.push({ where, ...lineMisses(frames, phone), ok: lineMisses(frames, phone).counted > 0 && lineMisses(frames, phone).worst <= 2 });
  const crossing = linesInside(frames);
  seen.crossing.push({ where, path: phone ? "/pages/tasks" : "/pages/tasks/t-deposit", ...crossing, ok: crossing.counted > 0 && crossing.crossed === 0 });
  const shear = frames.filter((f) => !shearless(f.matrix) || f.boards.some((b) => b.face && !shearless(b.face)));
  seen.shear.push({ where, frames: frames.length, sheared: shear.length, first: shear[0] ? { altitude: shear[0].altitude, matrix: shear[0].matrix } : null, reachedTheCity: frames.some((f) => f.altitude > 1.99), ok: shear.length === 0 && frames.some((f) => f.altitude > 1.99) });
  return { where, frames: frames.length, moved: moving.length, same: frames.every((f) => f.same), jump, ok: frames.length > 30 && frames.every((f) => f.same) && jump.worst <= 0.25 && moving.length > 20 };
}

/** Up to the city from a page, by the control. */
async function toCity(page, path) {
  await page.goto(`${at("todo")}${path}${path.includes("?") ? "&" : "?"}${DAY}`, { waitUntil: "load" });
  await ready(page);
  await press(page, '[data-testid="altitude-stop-2"]');
  await restAt(page, 2);
}

/*
 * THE VIEWS AT THE CITY: every place the bar offers stands; each view of
 * one kind stands by its district; none stands on a district's ground,
 * buildings or name, or on another view; all inside the window below the
 * bar and above the control; every kind's name in sight and readable.
 */
async function views(page, where) {
  await page.goto(`${at("todo")}/pages/?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const offered = await page.evaluate(() => ["/", ...new Set([...document.querySelectorAll('nav[aria-label="The app’s places"] a[href], [data-testid="app-places"] a[href]')].map((a) => new URL(a.href, location.href).pathname).filter((path) => path.startsWith("/pages")).map((path) => path.slice("/pages".length) || "/"))]);
  await press(page, '[data-testid="altitude-stop-2"]');
  await restAt(page, 2);
  const seenNow = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const city = document.querySelector('[data-testid="one-place-city"]');
    // Each view, and where its post meets the ground: what it stands on.
    // A phone's City pans: a view placed where the bar or the control stands over it is put away until the City is panned to it, and stands all the same.
    const signs = [...document.querySelectorAll("[data-graview-board]")].filter((b) => !b.getAttribute("data-graview-board").startsWith("record:")).map((b) => ({ key: b.getAttribute("data-graview-board"), path: b.getAttribute("data-graview-board-path").split("?")[0], label: b.getAttribute("title"), box: rect(b), stem: (parseFloat(b.style.getPropertyValue("--graview-sign-post")) || 0), shown: Number(b.style.opacity) > 0.9 || (innerWidth <= 600 && b.hasAttribute("data-graview-under")) }));
    const tiles = [...city.querySelectorAll("[data-graview-plot] .graview-plot-tile")].map((tile) => ({ kind: tile.closest("[data-graview-plot]").getAttribute("data-graview-plot"), box: rect(tile) }));
    const buildings = [...city.querySelectorAll("[data-graview-building]")].map(rect);
    // Each district's name as this face says it (the Scene's own stand down under it): what stands on it is what a board's box meets.
    const boardBoxes = [...document.querySelectorAll("[data-graview-board]")].filter((b) => Number(b.style.opacity || 0) > 0.5).map((b) => ({ title: b.getAttribute("title"), box: rect(b) }));
    const names = [...document.querySelectorAll("[data-graview-district-tag]")].filter((tag) => getComputedStyle(tag).visibility !== "hidden").map((tag) => {
      const box = rect(tag);
      return { kind: tag.getAttribute("data-graview-district-tag"), box, covered: boardBoxes.filter((b) => overlap(b.box, box) > 2).map((b) => b.title), size: parseFloat(getComputedStyle(tag).fontSize) };
    });
    const bar = document.querySelector('[data-testid="one-place-bar"]').getBoundingClientRect().bottom;
    const control = document.querySelector('[data-testid="altitude"] [role="group"]').getBoundingClientRect().top;
    // What a view stands on: the district its kind is, the nearest tile to its foot.
    // From the view's foot to the nearest edge of each district's ground.
    const gap = (p, b) => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));
    const nearest = (box, stem = 0) => tiles.reduce((best, tile) => { const d = gap({ x: box.x + box.width / 2, y: box.y + box.height + stem }, tile.box); return !best || d < best.d ? { kind: tile.kind, d } : best; }, null);
    return {
      signs: signs.map((sign) => ({ ...sign, near: nearest(sign.box, sign.stem)?.kind ?? null })),
      // A district's ground is its diamond (its box's bare corners are the street): no view stands on it, on a building or on a name.
      covers: signs.flatMap((sign) => tiles.some((t) => { const cx = t.box.x + t.box.width / 2; const cy = t.box.y + t.box.height / 2; const near = (lo, hi, v) => Math.max(lo, Math.min(hi, v)); return Math.abs(near(sign.box.x, sign.box.x + sign.box.width, cx) - cx) / (t.box.width / 2) + Math.abs(near(sign.box.y, sign.box.y + sign.box.height, cy) - cy) / (t.box.height / 2) < 0.97; }) || [...buildings, ...names.map((n) => n.box)].some((box) => overlap(sign.box, box) > 4) ? [sign.label] : []),
      onEachOther: signs.flatMap((a, i) => signs.slice(i + 1).filter((b) => overlap(a.box, b.box) > 4).map((b) => `${a.label} × ${b.label}`)),
      outside: signs.filter((sign) => sign.box.y < bar || sign.box.y + sign.box.height > control || sign.box.x < 0 || sign.box.x + sign.box.width > innerWidth).map((sign) => sign.label),
      names,
    };
  });
  const paths = new Set(seenNow.signs.filter((sign) => sign.shown).map((sign) => sign.path));
  const missing = offered.filter((path) => !paths.has(path.split("?")[0]));
  // A kind's list stands by that kind's district.
  const kindOf = { "/tasks": "task", "/lists": "list", "/reasons": "reason", "/rules": "rule" };
  const astray = seenNow.signs.filter((sign) => kindOf[sign.path] && seenNow.signs && !(sign.near ?? "").endsWith(kindOf[sign.path])).map((sign) => `${sign.label} by ${sign.near}`);
  const checked = seenNow.signs.filter((sign) => kindOf[sign.path]).length;
  seen.stand.push({ where, checked, astray, ok: checked > 0 && astray.length === 0 });
  seen.cover.push({ where, covers: seenNow.covers, onEachOther: seenNow.onEachOther, ok: seenNow.covers.length === 0 && seenNow.onEachOther.length === 0 });
  // A phone's City pans rather than shrink its views' words past reading: there a view may stand past the window's edge.
  seen.inside.push({ where, outside: seenNow.outside, ok: seenNow.outside.length === 0 || !where.device.startsWith("desk") });
  // A phone's names are a size smaller, as the rest of its City is.
  seen.names.push({ where, names: seenNow.names.map((n) => ({ kind: n.kind, covered: n.covered, size: n.size })), ok: seenNow.names.length > 0 && seenNow.names.every((n) => n.covered.length === 0 && n.size >= (where.device.includes("desk") ? 11 : 9)) });
  return { where, offered, views: seenNow.signs.map((sign) => sign.label), missing, ok: offered.length >= 3 && missing.length === 0 };
}

/*
 * ANYTHING CHOSEN AT THE CITY LANDS NEARBY, AND STAYS: a view pressed, a
 * view walked to by the arrow keys and gone into by Enter or the control's
 * Nearby, a record's building pressed, and a Find result — each at
 * Nearby, the address its own, still there a second and a half later, the
 * same element all the way, starting from what was pressed. And Back.
 */
async function chosen(page, where) {
  const results = [];
  for (const how of ["press", "keys", "control", "building", "find"]) {
    await toCity(page, "/pages/tasks/t-deposit");
    const target = await page.evaluate(() => {
      const b = [...document.querySelectorAll("[data-graview-board]")].find((one) => one.getAttribute("title") === "The week");
      const r = b?.getBoundingClientRect();
      return b ? { path: b.getAttribute("data-graview-board-path"), box: { x: r.left, y: r.top, width: r.width, height: r.height } } : null;
    });
    await startRecording(page);
    let goal = "/places/the-week";
    let from = target?.box ?? null;
    if (how === "press") await page.locator('[data-graview-board][title="The week"]').click();
    else if (how === "building") {
      const spot = await page.evaluate(() => {
        // Clear of every board and the post it stands on, and every district's name, which take a press of their own.
        const signs = [...document.querySelectorAll("[data-graview-board], [data-graview-district-tag]")].map((b) => { const r = b.getBoundingClientRect(); const post = parseFloat(b.style.getPropertyValue("--graview-sign-post")) || 0; return new DOMRect(r.left - 4, r.top, r.width + 8, r.height + post + 4); });
        for (const building of document.querySelectorAll("[data-graview-building]")) {
          const r = building.getBoundingClientRect();
          const p = { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
          if (r.width < 6 || p.y < 60 || p.y > innerHeight - 80 || signs.some((b) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom)) continue;
          if (building.getAttribute("data-graview-building") === "t-deposit") continue;
          // The building a press there lands on is the front-most whose box holds the point, as the face finds it: this one.
          const front = [...document.querySelectorAll("[data-graview-building]")].filter((one) => { const q = one.getBoundingClientRect(); return p.x >= q.left && p.x <= q.right && p.y >= q.top && p.y <= q.bottom; }).sort((one, two) => two.getBoundingClientRect().bottom - one.getBoundingClientRect().bottom)[0];
          if (front !== building) continue;
          return { id: building.getAttribute("data-graview-building"), ...p };
        }
        return null;
      });
      if (!spot) {
        await stopRecording(page);
        results.push({ how, ok: false, error: "no building in sight to press" });
        continue;
      }
      goal = `/${encodeURIComponent(spot.id)}`;
      from = { x: spot.x - 1, y: spot.y - 1, width: 2, height: 2 };
      await page.mouse.click(spot.x, spot.y);
    } else if (how === "find") {
      goal = "/tasks/t-book";
      from = null;
      await page.locator('[data-testid="one-place-bar"] [data-testid="nav-find"]:visible, [data-testid="one-place-bar"] [data-testid="app-find-open"]:visible').first().click();
      await page.keyboard.type("Book the van");
      await page.waitForTimeout(600);
      // The first thing Find offers, chosen as a person would: the arrow onto it, and Enter.
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    } else {
      let reached = false;
      // As a person walks the arrows toward it: the way it lies most, and the other way where that comes back to a view already passed.
      const passed = new Set();
      for (let step = 0; step < 24 && !reached && target; step++) {
        const here = await page.evaluate(() => document.activeElement?.getAttribute("title") ?? "");
        reached = here === "The week";
        if (reached) break;
        const again = passed.has(here);
        passed.add(here);
        const way = await page.evaluate(([goal, other]) => {
          const at = document.activeElement?.getBoundingClientRect();
          if (!at) return "ArrowLeft";
          const dx = goal.x + goal.width / 2 - (at.left + at.width / 2);
          const dy = goal.y + goal.height / 2 - (at.top + at.height / 2);
          const across = Math.abs(dx) > Math.abs(dy);
          return across !== other ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp";
        }, [target.box, again]);
        await page.keyboard.press(way);
      }
      if (!reached) {
        await stopRecording(page);
        results.push({ how, ok: false, error: "the arrow keys never reached The week" });
        continue;
      }
      if (how === "keys") await page.keyboard.press("Enter");
      else await press(page, '[data-testid="altitude-stop-1"]');
    }
    await page.waitForURL((url) => url.pathname.endsWith(goal), { timeout: 8_000 }).catch(() => {});
    await restAt(page, 1).catch(() => {});
    await page.waitForTimeout(1500);
    const frames = await stopRecording(page);
    const after = frames.findIndex((f) => f.url.endsWith(goal) && f.standing !== null && !f.standing.startsWith("t-deposit"));
    const first = after >= 0 ? frames[after] : null;
    // From what was pressed: a building's page leaves from its board, which stands over the building on a post as tall as it needs — above the press, never off to one side.
    const start = first && from ? Math.hypot(first.box.x + first.box.width / 2 - (from.x + from.width / 2), how === "building" ? Math.max(0, first.box.y + first.box.height - (from.y + from.height)) : first.box.y + first.box.height - (from.y + from.height)) : null;
    const landed = { url: new URL(page.url()).pathname, level: await levelOf(page) };
    const levels = [...new Set(frames.slice(Math.max(0, after)).map((f) => f.level))];
    // Back, from there: the page before, at the level it was left at, and still there.
    await page.goBack();
    await page.waitForTimeout(1600);
    const back = { url: new URL(page.url()).pathname, level: await levelOf(page) };
    results.push({ how, landed, levels, start: start === null ? null : Number(start.toFixed(1)), same: frames.every((f) => f.same), jump: jumps(frames.slice(Math.max(0, after))), back, ok: landed.url.endsWith(goal) && landed.level === 1 && !levels.includes(0) && levels.at(-1) === 1 && frames.every((f) => f.same) && (start === null || start <= 40) && jumps(frames.slice(Math.max(0, after))).worst <= 0.25 && back.url.endsWith("/tasks/t-deposit") && back.level >= 1 });
  }
  return { where, results, ok: results.every((one) => one.ok) };
}


/*
 * THE NEARBY PANEL, SIZED BY HAND: its inner edge dragged wider and by the
 * keyboard (the arrows, Home and End), the lines exact in every frame of
 * the drag, and the width it was given kept as the page goes up to the
 * City and back — the move starting and ending from it.
 */
async function resize(page, where, phone) {
  await page.goto(`${at("todo")}${phone ? "/pages/tasks" : "/pages/tasks/t-deposit"}?${DAY}`, { waitUntil: "load" });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("graview.one-face.panel.desk");
      localStorage.removeItem("graview.one-face.panel.phone");
    } catch {}
  });
  await page.reload({ waitUntil: "load" });
  await ready(page);
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  const panelOf = () => page.evaluate(() => {
    const r = document.querySelector("[data-graview-one-place]").getBoundingClientRect();
    const edge = document.querySelector('[data-testid="one-place-panel-edge"]');
    return { x: r.left, y: r.top, width: r.width, height: r.height, now: Number(edge?.getAttribute("aria-valuenow")), min: Number(edge?.getAttribute("aria-valuemin")), max: Number(edge?.getAttribute("aria-valuemax")), role: edge?.getAttribute("role") };
  });
  const before = await panelOf();
  const edge = await page.locator('[data-testid="one-place-panel-edge"]').boundingBox();
  await startRecording(page);
  const from = { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(phone ? from.x : from.x - i * 18, phone ? from.y - i * 14 : from.y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const frames = await stopRecording(page);
  const dragged = await panelOf();
  const misses = lineMisses(frames, phone);
  seen.resizeLines.push({ where, ...misses, ok: misses.counted > 0 && misses.worst <= 2 });
  const crossing = linesInside(frames);
  seen.crossing.push({ where, path: "resizing", ...crossing, ok: crossing.counted > 0 && crossing.crossed === 0 });
  await page.locator('[data-testid="one-place-panel-edge"]').focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  const atEnd = await panelOf();
  await page.keyboard.press("Home");
  await page.waitForTimeout(300);
  const atHome = await panelOf();
  await page.keyboard.press(phone ? "ArrowUp" : "ArrowLeft");
  await page.waitForTimeout(300);
  const stepped = await panelOf();
  // Up to the City and back: the panel comes back at the width it was given.
  await press(page, '[data-testid="altitude-stop-2"]');
  await restAt(page, 2);
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  const back = await panelOf();
  seen.resizeKept.push({ where, stepped: stepped.width, back: back.width, ok: Math.abs(back.width - stepped.width) <= 1 && Math.abs(back.height - stepped.height) <= 1 });
  const grew = phone ? dragged.height > before.height + 40 : dragged.width > before.width + 40;
  const ends = phone ? atEnd.height > atHome.height : atEnd.width > atHome.width;
  return { where, before: { width: before.width, height: before.height }, dragged: { width: dragged.width, height: dragged.height }, role: before.role, range: [before.min, before.max], ok: before.role === "separator" && grew && ends && (phone ? stepped.height > atHome.height : stepped.width > atHome.width) };
}


/*
 * A PINCH ON THE PAGE IS THE BROWSER'S OWN: on a phone, two fingers closing
 * on the page leave it the page — no level moved, nothing taken from the
 * browser's zoom — while beside the city the same pinch on the page moves
 * the camera up toward the City.
 */
async function pinch(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  const fingers = async (at, from, to) => {
    const points = (gap) => [{ x: at.x - gap, y: at.y }, { x: at.x + gap, y: at.y }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(from) });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(from + ((to - from) * i) / 8) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  // Who took the moves: a listener after the face's own, reading whether the browser was told no.
  await page.evaluate(() => {
    window.__pinchTaken = 0;
    window.addEventListener("touchmove", (event) => {
      if (event.defaultPrevented) window.__pinchTaken += 1;
    }, { passive: true });
  });
  await fingers({ x: 200, y: 420 }, 120, 40);
  await page.waitForTimeout(900);
  const onPage = { level: await levelOf(page), taken: await page.evaluate(() => window.__pinchTaken), altitude: await page.evaluate(() => Number(document.querySelector('[data-testid="one-place-city"]')?.getAttribute("data-graview-altitude-now") ?? 0)) };
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  const sheet = await page.evaluate(() => {
    const r = document.querySelector("[data-graview-one-place]").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
  });
  const before = await page.evaluate(() => Number(document.querySelector('[data-testid="one-place-city"]').getAttribute("data-graview-altitude-now")));
  let highest = before;
  const watching = page.evaluate(() => new Promise((done) => {
    let most = 0;
    const t0 = performance.now();
    const tick = () => {
      most = Math.max(most, Number(document.querySelector('[data-testid="one-place-city"]').getAttribute("data-graview-altitude-now")));
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
      else done(most);
    };
    requestAnimationFrame(tick);
  }));
  await fingers(sheet, 140, 30);
  highest = Math.max(highest, await watching);
  return { where, onPage, nearby: { before, highest }, ok: onPage.level === 0 && onPage.taken === 0 && onPage.altitude < 0.01 && highest > before + 0.2 };
}


/*
 * THE RECORD BESIDE THE CITY: at Nearby on a record's page, the record
 * stands out from what it is linked to — its own color and lifted — the
 * Scene draws no lines or words of its own from it into the city, and the
 * page's "Also connected" list says nothing the page already shows, in the
 * page's flow rather than over it.
 */
async function chosenRecord(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  await page.waitForTimeout(500);
  const read = await page.evaluate(() => {
    const city = document.querySelector('[data-testid="one-place-city"]');
    const roofOf = (building) => getComputedStyle(building.querySelector(".graview-iso-roof")).fill;
    const chosen = city.querySelector('[data-graview-building="t-deposit"]');
    const others = [...city.querySelectorAll("[data-graview-building]")].filter((b) => b !== chosen);
    // Lifted by its own translate, apart from the transform playback rises by.
    const lift = chosen ? parseFloat((getComputedStyle(chosen).translate || "0 0").split(" ")[1] ?? "0") || 0 : 0;
    const words = [...city.querySelectorAll(".graview-record-links, .graview-record-link-said")].filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none").length;
    const box = document.querySelector("[data-graview-connected-box]");
    const listed = [...(box?.querySelectorAll("[data-graview-record]") ?? [])].map((b) => b.getAttribute("data-graview-record"));
    const sheet = document.querySelector("[data-graview-one-place]");
    const shown = new Set([...sheet.querySelectorAll("[data-graview-pick], [data-graview-record], [data-record]")].filter((el) => !box?.contains(el)).map((el) => el.getAttribute("data-graview-pick") ?? el.getAttribute("data-graview-record") ?? el.getAttribute("data-record")));
    return { found: Boolean(chosen), roof: chosen ? roofOf(chosen) : null, sameRoof: others.filter((b) => roofOf(b) === (chosen ? roofOf(chosen) : "")).length, lift, words, listed, repeated: listed.filter((id) => shown.has(id)), sticky: box ? getComputedStyle(box).position : null };
  });
  // Lit by its color and outline where it stands, never lifted: a lit record changes no geometry.
  seen.standsOut.push({ where, ...read, ok: read.found && read.sameRoof === 0 && Math.abs(read.lift) < 0.5 });
  seen.noCityWords.push({ where, words: read.words, ok: read.words === 0 });
  seen.connected.push({ where, listed: read.listed, repeated: read.repeated, position: read.sticky, ok: read.repeated.length === 0 && read.sticky !== "sticky" && read.sticky !== "fixed" });
  return { where, ok: true };
}


/* Book the van, beside the city: the list it is on stands out of sight, and its line points there from the city's edge. */
async function offSight(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-book?${DAY}`, { waitUntil: "load" });
  await ready(page);
  await startRecording(page);
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  await page.waitForTimeout(400);
  const frames = await stopRecording(page);
  const crossing = linesInside(frames);
  const pointed = frames.at(-1)?.lines.filter((line) => line.under).length ?? 0;
  seen.crossing.push({ where, path: "/pages/tasks/t-book", pointed, ...crossing, ok: crossing.counted > 0 && crossing.crossed === 0 && pointed > 0 });
  return { where, ok: true };
}


/*
 * THE LEVELS' OWN KEYS: 1, 2 and 3 go to Page, Nearby and City, [ and ]
 * down and up; each stop names its key, and the keys stand over the stops
 * while the Key is open. The browser's zoom chords are its own: none is
 * taken, and no level moves. In a field the keys type.
 */
async function shortcuts(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  await page.locator("h1").last().click();
  const moves = [];
  for (const [key, want] of [["2", 1], ["3", 2], ["[", 1], ["]", 2], ["1", 0]]) {
    await page.keyboard.press(key);
    const reached = await restAt(page, want).then(() => true, () => false);
    moves.push({ key, want, reached });
  }
  const named = await page.evaluate(() => [0, 1, 2].map((n) => ({ title: document.querySelector(`[data-testid="altitude-stop-${n}"]`)?.getAttribute("title"), keys: document.querySelector(`[data-testid="altitude-stop-${n}"]`)?.getAttribute("aria-keyshortcuts") })));
  await press(page, '[data-testid="altitude-stop-1"]');
  await restAt(page, 1);
  // The legend is a button: opened here, unless it is open already.
  if ((await page.locator('[data-testid="altitude-key"]').first().getAttribute("aria-expanded")) !== "true") await press(page, '[data-testid="altitude-key"]');
  await page.waitForTimeout(200);
  const caps = await page.evaluate(() => ({ caps: [0, 1, 2].map((n) => document.querySelector(`[data-testid="altitude-keycap-${n}"]`)?.textContent ?? null), listed: document.querySelector('[data-testid="altitude-key-keys"]')?.textContent ?? "" }));
  seen.shortcuts.push({ where, moves, named, caps, ok: moves.every((m) => m.reached) && named.every((n, i) => n.keys?.split(" ").includes(String(i + 1))) && caps.caps.join() === "1,2,3" && /1 Page/.test(caps.listed) });
  // The keys can be turned off from the legend, and the line says so in words; turned back on, 3 goes to the city again.
  await press(page, '[data-testid="altitude-keys-turn"]');
  const offLine = await page.evaluate(() => document.querySelector('[data-testid="altitude-key-keys"]')?.textContent ?? "");
  await page.keyboard.press("3");
  await page.waitForTimeout(400);
  const stayedOff = (await levelOf(page)) === 1;
  await press(page, '[data-testid="altitude-keys-turn"]');
  const onLine = await page.evaluate(() => document.querySelector('[data-testid="altitude-key-keys"]')?.textContent ?? "");
  seen.keysTurnOff.push({ where, offLine, stayedOff, onLine, ok: /are off/.test(offLine) && /Turn on/.test(offLine) && stayedOff && /1 Page/.test(onLine) && /Turn off/.test(onLine) });
  // The browser's zoom chords: told to the page, none taken, and the level stays.
  const zoom = await page.evaluate(() => {
    const taken = [];
    for (const [key, mod] of [["=", "ctrlKey"], ["-", "ctrlKey"], ["0", "ctrlKey"], ["=", "metaKey"], ["-", "metaKey"]]) {
      const event = new KeyboardEvent("keydown", { key, [mod]: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      if (event.defaultPrevented) taken.push(`${mod}+${key}`);
    }
    return taken;
  });
  await page.waitForTimeout(400);
  seen.zoomKeys.push({ where, taken: zoom, level: await levelOf(page), ok: zoom.length === 0 && (await levelOf(page)) === 1 });
  // In a field, the keys type.
  await page.locator('[data-testid="one-place-bar"] [data-testid="nav-find"]:visible, [data-testid="one-place-bar"] [data-testid="app-find-open"]:visible').first().click();
  await page.keyboard.type("123[]");
  await page.waitForTimeout(500);
  const typed = await page.evaluate(() => (document.activeElement instanceof HTMLInputElement ? document.activeElement.value : null));
  seen.inField.push({ where, typed, level: await levelOf(page), ok: typed === "123[]" && (await levelOf(page)) === 1 });
  return { where, ok: true };
}


/*
 * THE CONTROL PUT AWAY INTO A SLIDER: one press folds it into a slider that
 * names only the level you are at; dragged from Page to City the camera
 * follows the thumb through every altitude between and settles at a level;
 * and the choice is kept when the page is opened again.
 */
async function slider(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const areaOf = () => page.evaluate(() => {
    const r = document.querySelector('[data-testid="altitude"] [role="group"]').getBoundingClientRect();
    return { width: r.width, height: r.height, area: r.width * r.height };
  });
  const whole = await areaOf();
  await press(page, '[data-testid="altitude-size"]');
  await page.waitForTimeout(200);
  const mini = await areaOf();
  // The same control made shorter, not another widget: clearly narrower (at most 60% of the levels' width), and the same height.
  seen.small.push({ where, whole, mini, share: Number((mini.width / whole.width).toFixed(3)), ok: mini.width <= whole.width * 0.6 && Math.abs(mini.height - whole.height) <= 1 });
  const folded = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="altitude-slider"]');
    const r = el?.getBoundingClientRect();
    return el ? { role: el.getAttribute("role"), now: el.getAttribute("aria-valuenow"), text: el.getAttribute("aria-valuetext"), word: document.querySelector('[data-testid="altitude-word"]')?.textContent, stops: document.querySelectorAll('[data-testid^="altitude-stop-"]').length, height: r.height } : null;
  });
  seen.folds.push({ where, folded, ok: Boolean(folded) && folded.role === "slider" && folded.now === "0" && folded.text === "Page" && folded.word === "Page" && folded.stops === 0 });
  const thumb = await page.locator('[data-testid="altitude-thumb"]').boundingBox();
  const trackEnd = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="altitude-thumb"]').parentElement.getBoundingClientRect();
    return { x: t.right, y: t.top + t.height / 2 };
  });
  const altitudes = [];
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(thumb.x + thumb.width / 2 + ((trackEnd.x - thumb.x - thumb.width / 2) * i) / 12, trackEnd.y);
    await page.waitForTimeout(60);
    altitudes.push(await page.evaluate(() => Number(document.querySelector('[data-testid="one-place-city"]')?.getAttribute("data-graview-altitude-now") ?? 0)));
  }
  await page.mouse.up();
  const settled = await restAt(page, 2, 10_000).then(() => true, () => false);
  const between = altitudes.filter((a) => a > 0.15 && a < 1.85).length;
  const word = await page.evaluate(() => document.querySelector('[data-testid="altitude-word"]')?.textContent);
  seen.dragged.push({ where, altitudes: altitudes.map((a) => Number(a.toFixed(2))), between, settled, word, ok: between >= 3 && settled && word === "City" });
  await page.reload({ waitUntil: "load" });
  await ready(page);
  const kept = await page.evaluate(() => Boolean(document.querySelector('[data-testid="altitude-slider"]')));
  await press(page, '[data-testid="altitude-size"]');
  seen.keptChoice.push({ where, kept, ok: kept });
  return { where, ok: true };
}


/*
 * THE LEGEND AND THE TOOLTIP, WHOLE OR PUT AWAY: in both states the
 * control's tooltip names the level and its keys on hover and on focus, and
 * is what a screen reader is told (`aria-describedby`); and the Key opens
 * the legend, keys and all.
 */
async function legend(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const states = [];
  for (const state of ["whole", "slider"]) {
    if (state === "slider") await press(page, '[data-testid="altitude-size"]');
    await page.waitForTimeout(200);
    const target = state === "whole" ? '[data-testid^="altitude-stop-"][aria-pressed="true"]' : '[data-testid="altitude-slider"]';
    await page.locator(target).hover();
    await page.waitForTimeout(700);
    const hovered = await page.evaluate((target) => {
      const el = document.querySelector(target);
      const tip = document.getElementById(el?.getAttribute("aria-describedby") ?? "");
      return { said: tip?.textContent ?? null, shown: tip ? Number(getComputedStyle(tip).opacity) : 0 };
    }, target);
    await page.mouse.move(700, 300);
    await page.locator(target).focus();
    await page.waitForTimeout(700);
    const focused = await page.evaluate((target) => {
      const tip = document.getElementById(document.querySelector(target)?.getAttribute("aria-describedby") ?? "");
      return tip ? Number(getComputedStyle(tip).opacity) : 0;
    }, target);
    await press(page, '[data-testid="altitude-key"]');
    await page.waitForTimeout(200);
    const legendText = await page.evaluate(() => document.querySelector('[data-testid="altitude-key-pane"]')?.textContent ?? "");
    await press(page, '[data-testid="altitude-key"]');
    states.push({ state, hovered, focused, legend: /1 Page/.test(legendText) && /View/.test(legendText) });
  }
  await press(page, '[data-testid="altitude-size"]');
  return { where, states, ok: states.every((one) => /\(\d\) · \[ and \] to move/.test(one.hovered.said ?? "") && one.hovered.shown > 0.9 && one.focused > 0.9 && one.legend) };
}

/*
 * THE CITY WITH NOTHING CHOSEN: a press on bare ground, or Escape, leaves
 * no view chosen and the city where it is; then a wheel with ctrl (a
 * trackpad's pinch) zooms the camera in and out toward the pointer, and
 * the level stays the city.
 */
async function freeCity(page, where) {
  await toCity(page, "/pages/tasks");
  const ground = await page.evaluate(() => {
    for (let y = innerHeight - 120; y > 80; y -= 23)
      for (let x = innerWidth - 40; x > 40; x -= 31) {
        const top = document.elementFromPoint(x, y);
        if (top && top.closest('[data-testid="one-place-city"]') && !top.closest("[data-graview-plot], .graview-kind-card, button, a, [data-graview-building]")) return { x, y };
      }
    return null;
  });
  if (!ground) return { where, ok: false, error: "no bare ground in sight" };
  await page.mouse.click(ground.x, ground.y);
  await page.waitForTimeout(500);
  const afterPress = await page.evaluate(() => ({ level: Number(document.querySelector("[data-graview-one-place]").getAttribute("data-graview-one-place")), chosen: document.activeElement?.closest("[data-graview-board]")?.getAttribute("title") ?? null }));
  await page.locator('[data-graview-board][title="The week"]').focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const afterEscape = await page.evaluate(() => ({ level: Number(document.querySelector("[data-graview-one-place]").getAttribute("data-graview-one-place")), chosen: document.activeElement?.closest("[data-graview-board]")?.getAttribute("title") ?? null }));
  seen.ground.push({ where, afterPress, afterEscape, ok: afterPress.level === 2 && afterPress.chosen === null && afterEscape.level === 2 && afterEscape.chosen === null });
  const zoomOf = () => page.evaluate(() => Number(document.querySelector('[data-testid="one-place-city"]').getAttribute("data-graview-camera-zoom")));
  const before = await zoomOf();
  await page.mouse.move(innerWidthOf(where) / 2, 450);
  const levels = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -60);
    await page.keyboard.up("Control");
    await page.waitForTimeout(60);
    levels.push(await levelOf(page));
  }
  await page.waitForTimeout(900);
  const closer = await zoomOf();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 60);
    await page.keyboard.up("Control");
    await page.waitForTimeout(60);
    levels.push(await levelOf(page));
  }
  await page.waitForTimeout(900);
  levels.push(await levelOf(page));
  return { where, before, closer, levels: [...new Set(levels)], ok: closer > before * 1.1 && levels.every((level) => level === 2) };
}
const innerWidthOf = (where) => (where.device.startsWith("desk") ? DESK.width : 412);

/*
 * NO MOVE BETWEEN LEVELS OVERSHOOTS: every frame of Page↔Nearby,
 * Nearby↔City and Page↔City, both ways, by the control and the keyboard,
 * the camera's zoom and the page's box move one way only — never past
 * where they stop and back.
 */
async function noOvershoot(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const moves = [];
  for (const [to, how] of [[1, "control"], [2, "control"], [1, "keys"], [0, "keys"], [2, "control"], [0, "control"]]) {
    await page.evaluate(() => {
      window.__zooms = [];
      window.__zoomStop = false;
      const tick = () => {
        if (window.__zoomStop) return;
        requestAnimationFrame(tick);
        const city = document.querySelector('[data-testid="one-place-city"]');
        const sheet = document.querySelector("[data-graview-one-place]");
        const r = sheet.getBoundingClientRect();
        // Only what is drawn: while the page fills the window the camera waits out of sight.
        const altitude = Number(city?.getAttribute("data-graview-altitude-now") ?? 0);
        window.__zooms.push({ zoom: altitude > 0.001 ? Number(city?.getAttribute("data-graview-camera-zoom") ?? 0) : 0, width: getComputedStyle(sheet).display === "contents" ? innerWidth : r.width });
      };
      requestAnimationFrame(tick);
    });
    const from = await levelOf(page);
    if (how === "keys") await page.keyboard.press(to > from ? "Alt+ArrowUp" : "Alt+ArrowDown");
    else await press(page, `[data-testid="altitude-stop-${to}"]`);
    const arrived = await restAt(page, to).then(() => true, () => false);
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => {
      window.__zoomStop = true;
      return window.__zooms;
    });
    const reversal = (values, tolerance) => {
      const moving = values.filter((v) => v > 0);
      if (moving.length < 3) return 0;
      const sign = Math.sign(moving.at(-1) - moving[0]);
      let worst = 0;
      let far = moving[0];
      for (const v of moving) {
        if (sign >= 0) far = Math.max(far, v);
        else far = Math.min(far, v);
        worst = Math.max(worst, Math.abs(far - v) > tolerance(far) ? Math.abs(far - v) : 0);
      }
      return worst;
    };
    const moved = frames.filter((f, i) => i > 0 && (f.zoom !== frames[i - 1].zoom || f.width !== frames[i - 1].width)).length;
    moves.push({ from, to, how, arrived, moved, frames: frames.length, zoomBack: Number(reversal(frames.map((f) => f.zoom), (v) => v * 0.005).toFixed(4)), widthBack: Number(reversal(frames.map((f) => f.width), () => 1).toFixed(2)) });
  }
  return { where, moves, ok: moves.every((move) => move.arrived && move.moved >= 5 && move.zoomBack === 0 && move.widthBack === 0) };
}

/*
 * THE BAR STAYS, AND WORKS, AT EVERY LEVEL: at the page, beside the city,
 * at the city and half way between, each of its controls is in the window,
 * nothing stands over it, and Tab reaches it; and at the city the app menu
 * opens over the city and its History opens the timeline.
 */
async function bar(page, where) {
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const check = () =>
    page.evaluate(() => {
      const slot = document.querySelector('[data-testid="one-place-bar"]');
      const controls = [...slot.querySelectorAll('[data-testid="app-menu-open"], [data-testid="app-find-open"], [data-testid="nav-find"], [data-testid="standing-link"], [data-testid="inbox-open"], button[aria-label*="Inbox"], [data-testid="profile-open"], button[aria-label*="your seat"]')].filter((el) => el.getBoundingClientRect().width > 0);
      return {
        top: slot.getBoundingClientRect().top,
        controls: controls.map((el) => {
          const r = el.getBoundingClientRect();
          const topAt = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { name: el.getAttribute("aria-label") ?? el.getAttribute("data-testid"), inside: r.top >= 0 && r.bottom <= innerHeight, clear: Boolean(topAt && (el === topAt || el.contains(topAt))), inert: Boolean(el.closest("[inert]")), tabbable: el.tabIndex >= 0 };
        }),
      };
    });
  const states = [];
  states.push({ at: "page", ...(await check()) });
  await press(page, '[data-testid="altitude-stop-1"]');
  await page.waitForTimeout(250);
  states.push({ at: "rising", ...(await check()) });
  await restAt(page, 1);
  states.push({ at: "nearby", ...(await check()) });
  await press(page, '[data-testid="altitude-stop-2"]');
  await page.waitForTimeout(250);
  states.push({ at: "rising to the city", ...(await check()) });
  await restAt(page, 2);
  states.push({ at: "city", ...(await check()) });
  await page.locator('[data-testid="one-place-bar"] [data-testid="app-menu-open"]').first().click();
  await page.locator('[data-testid="app-menu-history"]').click();
  const history = await page.waitForSelector('[data-testid="timeline"]', { timeout: 8_000 }).then(() => true, () => false);
  const level = await levelOf(page);
  const ok = states.every((state) => state.top === 0 && state.controls.length >= 3 && state.controls.every((c) => c.inside && c.clear && !c.inert && c.tabbable)) && history && level === 2;
  return { where, states, history, level, ok };
}

/*
 * EVERY VIEW THAT SHOWS RECORDS DRAWS ITS LINES: beside the city, each
 * defined view — a kind's list, the calendar's week and month, the board
 * of lists — draws a line to the building of each record it shows in
 * sight, whatever drew the record: a page's row, a lens's event or card.
 */
async function linesOfEveryView(page, where) {
  const results = [];
  for (const path of ["/pages/tasks", "/pages/places/the-week", "/pages/places/the-month", "/pages/places/the-lists", "/pages/places/what-is-left"]) {
    await page.goto(`${at("todo")}${path}?${DAY}`, { waitUntil: "load" });
    await ready(page);
    await press(page, '[data-testid="altitude-stop-1"]');
    await restAt(page, 1);
    await page.waitForTimeout(400);
    const seenHere = await page.evaluate(() => {
      const sheet = document.querySelector("[data-graview-one-place]");
      const port = sheet.getBoundingClientRect();
      const shown = new Set();
      for (const part of sheet.querySelectorAll("[data-graview-pick], [data-graview-record], [data-record]")) {
        const id = part.getAttribute("data-graview-pick") ?? part.getAttribute("data-graview-record") ?? part.getAttribute("data-record");
        const r = part.getBoundingClientRect();
        const mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        if (r.width < 1 || mid.x < port.left || mid.x > port.right || mid.y < port.top || mid.y > port.bottom) continue;
        if (part.closest("nav, header, [role=navigation], [role=banner]")) continue;
        if (document.querySelector(`[data-graview-building="${CSS.escape(id)}"]`)) shown.add(id);
      }
      const lines = new Set([...document.querySelectorAll("[data-graview-line]")].map((g) => g.getAttribute("data-graview-line")));
      return { shown: [...shown], lines: [...lines] };
    });
    const missing = seenHere.shown.filter((id) => !seenHere.lines.includes(id)).slice(0, 40 - 0);
    results.push({ path, shown: seenHere.shown.length, lines: seenHere.lines.length, missing: missing.slice(0, 8), // At most forty lines are drawn: past that, the forty drawn are the claim.
      ok: (path.endsWith("what-is-left") || seenHere.shown.length > 0) && (missing.length === 0 || (seenHere.lines.length >= 40 && seenHere.shown.length > 40)) });
  }
  return { where, results, ok: results.every((one) => one.ok) && results.some((one) => one.shown > 0) };
}

async function duplicate() {
  const { compileDocument } = await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/check.js")).href);
  const { editDocument } = await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/document/index.js")).href);
  const review = JSON.parse(readFileSync(resolve(repoRoot, "packages/core/tests/document/fixtures/review.gdd.json"), "utf8"));
  const board = { name: "blocks", title: "Where they stand", on: "root-cause", options: { blocks: [{ headline: "Every cause" }, { list: "all('root-cause')", as: "card" }] } };
  const twice = { ...review, lenses: [...review.lenses, board, { ...board, title: "Standing" }] };
  const found = compileDocument(twice, { today: () => "2026-10-15" }).findings.filter((f) => f.code === "check:view-duplicates-another");
  const standing = found.find((f) => f.message.includes('"Standing"'));
  const fixed = standing?.edits ? editDocument(twice, standing.edits) : null;
  const after = fixed?.ok ? compileDocument(fixed.document, { today: () => "2026-10-15" }).findings.filter((f) => f.code === "check:view-duplicates-another" && f.message.includes('"Standing"')) : null;
  return { found: found.map((f) => ({ severity: f.severity, message: f.message, edits: f.edits ?? null })), fixedLeaves: after?.length ?? null, ok: Boolean(standing?.message.includes('Keep "Where they stand"')) && after?.length === 0 };
}


/*
 * THE HISTORY, AT EVERY LEVEL. Two changes are made — a reason added, a
 * task dropped — the timeline opened from the app menu, and the city risen
 * to. Scrubbing back before both, the reason's building sinks into the
 * ground and the dropped task's rises out of it; forward again, the other
 * way; taken back part way through a sink, the same building rises again.
 * Every frame of it is read: which element each building is, and how tall
 * it stands. And the button still moves a level while the past is shown.
 */
const KEEP_THE_STORE = () => {
  const watch = (window.__graviewWatch ??= {});
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    (window.__oneFaceStores ??= []).push(store);
  };
};
async function history(page, where) {
  await page.addInitScript(KEEP_THE_STORE);
  await page.goto(`${at("todo")}/pages/tasks?${DAY}&fresh=1`, { waitUntil: "load" });
  await ready(page);
  await page.waitForFunction(() => (window.__oneFaceStores ?? []).some((store) => store.schema.kinds.includes("task")), undefined, { timeout: 30_000 });
  const reason = await page.evaluate(() => {
    const store = window.__oneFaceStores.find((one) => one.schema.kinds.includes("task"));
    const me = { kind: "human" };
    const made = store.apply({ name: "explain", args: { aboutId: "t-book", text: "The van books up a week ahead" } }, { author: me });
    store.apply({ name: "drop", args: { taskId: "t-deposit" } }, { author: me });
    return made.ops[0].writes.find((id) => id.startsWith("reason"));
  });
  await page.locator('[data-testid="app-menu-open"]').first().click();
  await page.locator('[data-testid="app-menu-history"]').click();
  await page.waitForSelector('[data-testid="timeline"]', { timeout: 20_000 });
  await press(page, '[data-graview-rise]');
  await restAt(page, 1);
  await press(page, '[data-graview-rise]');
  await restAt(page, 2);
  const ids = [reason, "t-deposit", "reason-deposit"];
  await page.evaluate((ids) => {
    window.__heights = [];
    window.__tokens = new WeakMap();
    let n = 0;
    const tick = () => {
      if (window.__heightsStop) return;
      requestAnimationFrame(tick);
      const frame = { t: performance.now() };
      for (const id of ids) {
        const el = document.querySelector(`[data-graview-building="${CSS.escape(id)}"]`);
        if (!el) {
          frame[id] = null;
          continue;
        }
        if (!window.__tokens.has(el)) window.__tokens.set(el, ++n);
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
        frame[id] = { node: window.__tokens.get(el), height: Number(m.d.toFixed(3)), leaving: el.hasAttribute("data-graview-leaving") };
      }
      window.__heights.push(frame);
    };
    requestAnimationFrame(tick);
  }, ids);
  const scrub = (index) =>
    page.evaluate((index) => {
      const scrubber = document.querySelector('[data-testid="scrubber"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(scrubber, String(index));
      scrubber.dispatchEvent(new Event("input", { bubbles: true }));
      scrubber.dispatchEvent(new Event("change", { bubbles: true }));
    }, index);
  const last = await page.evaluate(() => Number(document.querySelector('[data-testid="scrubber"]').max));
  await scrub(0);
  await page.waitForTimeout(700);
  await scrub(last);
  await page.waitForTimeout(700);
  // Back before the reason, and forward again before it has sunk: the same building rises from where it had got to.
  await scrub(0);
  await page.waitForTimeout(160);
  await scrub(last);
  await page.waitForTimeout(700);
  const frames = await page.evaluate(() => {
    window.__heightsStop = true;
    return window.__heights;
  });
  // The button moves a level with the past shown.
  await press(page, '[data-graview-descend]');
  const down = await restAt(page, 1).then(() => true, () => false);
  const stillPast = await page.evaluate(() => document.querySelector('[data-testid="timeline"]') !== null);
  const of = (id) => frames.map((frame) => frame[id]);
  const rises = (list) => {
    // Somewhere it stands low and then, the same element, all the way up.
    for (let i = 0; i < list.length; i++) {
      if (!list[i] || list[i].height > 0.9) continue;
      // While it is the same element: from low to all the way up.
      const rest = [];
      for (const one of list.slice(i)) {
        if (!one || one.node !== list[i].node) break;
        rest.push(one);
      }
      if (rest.some((one) => one.height >= 0.999)) return true;
    }
    return false;
  };
  const sinks = (list) => {
    for (let i = 0; i < list.length; i++) {
      if (!list[i] || list[i].height < 0.999 || !list[i + 1]?.leaving) continue;
      const rest = list.slice(i + 1).filter(Boolean);
      const until = rest.findIndex((one) => !one.leaving);
      const going = until < 0 ? rest : rest.slice(0, until);
      if (going.length > 2 && going.every((one) => one.node === list[i].node) && going.some((one) => one.height < 0.5)) return true;
    }
    return false;
  };
  const nodes = (list) => new Set(list.filter(Boolean).map((one) => one.node));
  const came = of(reason);
  // Taken back mid-sink and forward again: the reason's node in the last frames is one it already had.
  const tail = came.filter(Boolean).at(-1);
  const kept = tail ? came.filter(Boolean).slice(0, -20).some((one) => one.node === tail.node && one.leaving) : false;
  return {
    where,
    frames: frames.length,
    madeRises: rises(came),
    droppedRisesGoingBack: rises(of("t-deposit")),
    madeSinksGoingBack: sinks(came),
    droppedSinks: sinks(of("t-deposit")),
    untouchedOneNode: nodes(of("reason-deposit")).size === 1 && of("reason-deposit").every((one) => one && one.height >= 0.999),
    takenBackMidSinkIsTheSameNode: kept,
    buttonMovesInThePast: down && stillPast,
    ok: false,
  };
}

/** A strip of frames across a move: the page, rising to the city and coming down into a board. */
async function strip(browser, options, name) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
  await ready(page);
  const shots = [];
  const take = async (label) => shots.push({ label, png: (await page.screenshot()).toString("base64") });
  await take("the page");
  for (const [button, level] of [["rise", 1], ["rise", 2]]) {
    await press(page, `[data-graview-${button}]`);
    await page.waitForTimeout(200);
    await take(`rising to ${level}`);
    await restAt(page, level);
    await take(level === 1 ? "beside the city" : "the city");
  }
  await page.locator('[data-graview-board][title="The week"]').click();
  await page.waitForTimeout(200);
  await take("into The week");
  await restAt(page, 1);
  await take("The week, beside the city");
  const html = `<html><body style="margin:0;background:#888;display:flex;gap:6px;padding:6px;font:13px sans-serif">${shots.map((s) => `<figure style="margin:0;display:flex;flex-direction:column;gap:4px;align-items:center"><img src="data:image/png;base64,${s.png}" style="height:${options.isMobile ? 520 : 300}px"><figcaption>${s.label}</figcaption></figure>`).join("")}</body></html>`;
  await context.close();
  // Laid side by side in a browser of its own: a sheet of pictures is no page of the app's for the watch to judge.
  const plain = await chromium.launch();
  const sheet = await plain.newPage();
  await sheet.setContent(html);
  await sheet.waitForTimeout(200);
  const out = resolve(STRIPS, `${name}.png`);
  await sheet.screenshot({ path: out, fullPage: true });
  await plain.close();
  return out;
}


/*
 * A RICH APP'S CITY AND NEARBY READ CLEAN (Graview HQ
 * feature:f-one-face-city-reads-clean). Deep Time at its size — eleven
 * kinds, 294 records, ten worker views (lib/one-face-rich-host.mjs) — dark,
 * at 1280 wide and at 390: at the City and at Nearby nothing this face
 * says stands on anything else it says (the views' boards, the districts'
 * names, the page's own board); every district at the City says its kind;
 * no name, title or line is cut off by its box or wraps out of it — one
 * too long is cut whole, with an ellipsis, and the whole of it is the
 * board's own name; the legend is closed on arrival, on every visit, and
 * opens from its button; and each view's board is drawn as that view — its
 * title and whose view it is, no two alike, none listing records as a list.
 */
const RICH_PLURALS = Object.fromEntries(Object.entries(deepTime.kinds).map(([kind, one]) => [kind, one.plural]));

/** What this face draws at rest, read in the page: boards, names, the panel, and what is cut or wrapped. */
const readRich = (page) =>
  page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const shown = (el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0.5 && Number(getComputedStyle(el.parentElement).opacity) > 0.5;
    const boards = [...document.querySelectorAll("[data-graview-board]")].filter((b) => Number(b.style.opacity || 0) > 0.9).map((b) => {
      const face = b.querySelector("[data-graview-board-face]");
      const title = face?.querySelector("[data-graview-board-title]");
      const says = face?.querySelector("[data-graview-board-says]");
      // Where its post meets the ground, and the smallest of its words as drawn on the screen.
      const box = rect(b);
      const post = parseFloat(b.style.getPropertyValue("--graview-sign-post")) || 0;
      const scale = face ? box.width / (face.offsetWidth || box.width) : 1;
      const smallest = face ? Math.min(...[...face.querySelectorAll("[data-graview-board-title], [data-graview-board-says], [data-graview-board-face] span:not([style*='border-radius'])")].filter((el) => el.textContent.trim()).map((el) => parseFloat(getComputedStyle(el).fontSize) * scale)) : Infinity;
      return { key: b.getAttribute("data-graview-board"), label: b.getAttribute("title"), aria: b.getAttribute("aria-label"), box, stem: { x: box.x + box.width / 2, y: box.y + box.height + post }, smallest, title: title?.textContent ?? null, says: says?.textContent ?? null, lines: face ? face.querySelectorAll("[data-graview-board-says] ~ div > div").length : 0, own: b.hasAttribute("aria-current") };
    });
    const tags = [...document.querySelectorAll("[data-graview-district-tag]")].filter(shown).map((t) => ({ kind: t.getAttribute("data-graview-district-tag"), text: t.textContent, box: rect(t) }));
    const plots = [...document.querySelectorAll('[data-testid="one-place-city"] [data-graview-plot] .graview-plot-tile')].map((tile) => ({ kind: (tile.closest("[data-graview-plot]").getAttribute("data-graview-plot") ?? "").replace(/^kind:/, ""), box: rect(tile) }));
    // The Scene's own district names, where any is still drawn on this face.
    const plates = [...document.querySelectorAll('[data-testid="one-place-city"] .graview-kind-face')].filter((face) => getComputedStyle(face).visibility !== "hidden" && face.getAttribute("data-graview-nameplate") !== "none" && face.getBoundingClientRect().width > 0).map((face) => ({ kind: face.closest("[data-graview-view]")?.getAttribute("data-graview-view"), box: rect(face) }));
    /*
     * CUT OR WRAPPED: every piece of words this face draws at the City and
     * beside it — a name, a board's title, what it says it is, its lines,
     * the control's stops. Cut is wider than its box with no ellipsis, or
     * with one where the board's own name is not the whole of it; wrapped is
     * taller than one line.
     */
    const words = [
      ...[...document.querySelectorAll("[data-graview-district-tag]")].filter(shown).map((el) => ({ el, whole: el.getAttribute("title") })),
      ...[...document.querySelectorAll("[data-graview-board]")].filter((b) => Number(b.style.opacity || 0) > 0.9).flatMap((b) => [...b.querySelectorAll("[data-graview-board-title], [data-graview-board-says], [data-graview-board-face] span:not([style*='border-radius'])")].map((el) => ({ el, whole: el.matches("[data-graview-board-title]") ? b.getAttribute("title") : null }))),
      ...[...document.querySelectorAll('[data-testid="altitude"] button')].filter((el) => el.getBoundingClientRect().width > 0 && el.textContent.trim()).map((el) => ({ el, whole: null })),
    ];
    const problems = [];
    for (const { el, whole } of words) {
      const style = getComputedStyle(el);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
      const text = el.textContent.trim();
      if (!text) continue;
      const cut = el.scrollWidth > el.clientWidth + 1;
      const ellipsis = style.textOverflow === "ellipsis";
      if (cut && !ellipsis) problems.push({ text, why: "cut without an ellipsis" });
      else if (cut && whole !== null && whole !== text) problems.push({ text, why: `cut, and the board's name "${whole}" is not the whole of it` });
      else if (cut && whole === null && el.matches("[data-graview-district-tag]")) problems.push({ text, why: "a district's name cut" });
      // Wrapped: its words fall on more than one line — read off the lines the browser drew them on, not the box, which a fingertip's control makes taller than its line.
      const range = document.createRange();
      range.selectNodeContents(el);
      const rows = [...range.getClientRects()].filter((one) => one.width > 0).reduce((tops, one) => (tops.some((top) => Math.abs(top - one.top) < one.height / 2) ? tops : [...tops, one.top]), []);
      // A board's title takes two lines before it is cut; nothing else takes more than one.
      const most = el.matches("[data-graview-board-title]") ? 2 : 1;
      const clipped = el.matches("[data-graview-board-title]") && el.scrollHeight > el.clientHeight + 1;
      if (rows.length > most && !clipped) problems.push({ text, why: `wraps onto ${rows.length} lines (a ${line}px line)` });
      if (clipped && whole !== text) problems.push({ text, why: `cut, and the board's name "${whole}" is not the whole of it` });
    }
    const panelEl = document.querySelector("[data-graview-one-place]");
    const level = Number(panelEl?.getAttribute("data-graview-one-place"));
    const legend = Boolean(document.querySelector('[data-testid="altitude-key-pane"]'));
    const bar = document.querySelector('[data-testid="one-place-bar"]').getBoundingClientRect().bottom;
    // Each building in sight, and each line's building end: what Nearby is for.
    const buildings = [...document.querySelectorAll('[data-testid="one-place-city"] [data-graview-building]')].map((b) => ({ id: b.getAttribute("data-graview-building"), kind: (b.closest("[data-graview-plot]")?.getAttribute("data-graview-plot") ?? "").replace(/^kind:/, ""), box: rect(b) })).filter((b) => b.box.width > 2 && b.box.x + b.box.width > 0 && b.box.x < innerWidth && b.box.y + b.box.height > 0 && b.box.y < innerHeight);
    const lines = [...document.querySelectorAll("[data-graview-line]")].filter((g) => Number(getComputedStyle(g.ownerSVGElement).opacity) > 0.5 && g.getAttribute("data-graview-line-on") === "building" && !g.hasAttribute("data-graview-line-under")).map((g) => {
      const [x, y] = (g.getAttribute("data-graview-line-to") ?? "0,0").split(",").map(Number);
      return { key: g.getAttribute("data-graview-line"), to: { x, y } };
    });
    // A district's own controls — "open", its problems — where any is drawn: never under the bar, the page or the level control.
    const controls = [...document.querySelectorAll('[data-testid="one-place-city"] .graview-kind-open, [data-testid="one-place-city"] .graview-district-problems, [data-graview-district-open], [data-graview-district-problems]')].filter((el) => getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0.1 && el.getBoundingClientRect().width > 0).map((el) => ({ what: el.getAttribute("aria-label") ?? el.textContent, box: rect(el) }));
    const dock = document.querySelector("[data-graview-one-face-dock]");
    // Everything the keyboard reaches in the city's layers — the boards, the districts' names and their controls — is seen.
    const seenAll = (el) => { for (let at = el; at && at !== document.body; at = at.parentElement) { const style = getComputedStyle(at); if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.5) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const unseenFocus = [...document.querySelectorAll('[data-testid="one-place-boards"] button, [data-testid="one-place-names"] button')].filter((el) => !el.closest("[inert]") && el.tabIndex >= 0 && !seenAll(el)).map((el) => el.getAttribute("aria-label") ?? el.textContent.trim());
    // The level control: how many of its levels look chosen — pressed, or lit by a focus ring — and whether a tooltip is up.
    const stops = [...document.querySelectorAll('[data-testid^="altitude-stop-"]')];
    const chosenLooking = stops.filter((el) => el.getAttribute("aria-pressed") === "true" || el.matches(":focus-visible")).map((el) => el.textContent.trim());
    const tipUp = [...document.querySelectorAll("[data-graview-one-face-tip][data-graview-shown]")].map((el) => el.textContent.trim()).filter(Boolean);
    const district = Object.fromEntries([...document.querySelectorAll('[data-testid="one-place-city"] [data-graview-plot] .graview-plot-tile')].map((tile) => [(tile.closest("[data-graview-plot]").getAttribute("data-graview-plot") ?? "").replace(/^kind:/, ""), rect(tile)]));
    // On a phone's City, which pans, the views put away under the bar or the control until panned to: they stand all the same.
    const under = [...document.querySelectorAll("[data-graview-board][data-graview-under]")].map((b) => b.getAttribute("data-graview-board"));
    const namesUnder = (innerWidth <= 600 || innerHeight <= 600) ? [...document.querySelectorAll("[data-graview-district-tag][data-graview-under]")].map((t) => ({ kind: t.getAttribute("data-graview-district-tag"), text: t.textContent })) : [];
    /*
     * EACH BOARD'S POST, from the foot of its card down to the ground: what
     * other board or district's name it runs across, and, where it does,
     * whether it is drawn under that board — the board, not the post, is
     * what is seen where they cross.
     */
    // Beside a page its own board is the page, laid over it clear: not a board standing in the city.
    const besidePage = Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place")) === 1;
    const standing = [...document.querySelectorAll("[data-graview-board]")].filter((b) => Number(b.style.opacity || 0) > 0.9 && !b.hasAttribute("data-graview-under") && !(besidePage && b.hasAttribute("aria-current")));
    const postCrossings = [];
    for (const b of standing) {
      const box = rect(b);
      const length = parseFloat(b.style.getPropertyValue("--graview-sign-post")) || 0;
      const post = { x: box.x + box.width / 2 - 1, y: box.y + box.height, width: 2, height: length };
      const across = (other) => Math.max(0, Math.min(post.x + post.width, other.x + other.width) - Math.max(post.x, other.x)) > 0 && Math.min(post.y + post.height, other.y + other.height) - Math.max(post.y, other.y) > 1;
      for (const o of standing) {
        if (o === b) continue;
        const other = rect(o);
        if (!across(other)) continue;
        const y = (Math.max(post.y, other.y) + Math.min(post.y + post.height, other.y + other.height)) / 2;
        // Both taking the pointer for the reading (a board put away or still arriving takes none): whichever is drawn on top is what is found there.
        const was = [b.style.pointerEvents, o.style.pointerEvents];
        b.style.pointerEvents = "auto";
        o.style.pointerEvents = "auto";
        const seenThere = document.elementFromPoint(post.x + 1, y)?.closest("[data-graview-board]");
        b.style.pointerEvents = was[0];
        o.style.pointerEvents = was[1];
        postCrossings.push({ post: b.getAttribute("title"), across: `“${o.getAttribute("title")}”`, under: seenThere === o });
      }
      for (const t of tags) if (across(t.box)) postCrossings.push({ post: b.getAttribute("title"), across: `the ${t.kind} name`, under: null });
    }
    return { boards, under, namesUnder, tags, plots, plates, problems, buildings, lines, controls, unseenFocus, chosenLooking, tipUp, district, postCrossings, dock: dock ? rect(dock) : null, level, panel: level === 1 && panelEl ? rect(panelEl) : null, legend, bar, width: innerWidth, height: innerHeight };
  });

const overlapOf = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
/*
 * NO BOARD AND NO NAME LEAPS: across a move and once it has arrived, a
 * board or a district's name seen in two frames running moves no more than
 * the camera carries it — never one step of more than 30 pixels that is
 * a third of its whole way, made at well over the speed of the frames
 * either side of it (a camera moving fast on a slow machine takes long
 * steps, every one, over long frames).
 */
function signJumps(frames) {
  const leaps = [];
  for (const which of ["boards", "names"]) {
    const keys = new Set(frames.flatMap((f) => (f[which] ?? []).map((one) => one.key)));
    for (const key of keys) {
      // Two frames running in which it is seen: one put away and seen again elsewhere has not leapt.
      const all = frames.map((f, i) => ({ i, f, one: (f[which] ?? []).find((o) => o.key === key) }));
      const seenIn = all.filter(({ one }) => one && one.opacity > 0.5 && one.box.width > 0);
      if (seenIn.length < 2) continue;
      const xs = seenIn.map(({ one }) => one.box.x + one.box.width / 2);
      const ys = seenIn.map(({ one }) => one.box.y + one.box.height / 2);
      const travel = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      // Its steps, frame to frame: a leap is one far past how it moves in the frames round it, not a fast camera on a slow machine.
      // How fast it went between each two frames, in pixels a millisecond: a slow machine's frames come unevenly, and a step over a long frame is a long step.
      const speeds = seenIn.slice(1).map((_, i) => Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) / Math.max(1, seenIn[i + 1].f.t - seenIn[i].f.t));
      for (let i = 1; i < seenIn.length; i++) {
        if (seenIn[i].i !== seenIn[i - 1].i + 1) continue;
        const step = Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        const neighbors = [speeds[i - 2], speeds[i]].filter((one) => one !== undefined);
        // Seen alone between frames it was not (coming up, put away): nothing to judge a step against. Going no faster than the frames either side of it, the camera carried it.
        if (neighbors.length === 0 || speeds[i - 1] <= Math.max(...neighbors) * 2.5 + 0.05) continue;
        const still = Math.abs(seenIn[i].f.altitude - seenIn[i - 1].f.altitude) < 0.001;
        if (step > 30 && step > travel / 3) leaps.push({ which, key, step: Math.round(step), altitude: Number(seenIn[i].f.altitude.toFixed(3)), still, from: [Math.round(xs[i - 1]), Math.round(ys[i - 1])], to: [Math.round(xs[i]), Math.round(ys[i])], frame: seenIn[i].i, of: frames.length });
      }
    }
  }
  return { leaps: leaps.slice(0, 8), frames: frames.length };
}

/** Every pair of things said that stand on each other, by name. */
function onEachOther(things) {
  const out = [];
  for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) if (overlapOf(things[i].box, things[j].box) > 2) out.push(`${things[i].name} × ${things[j].name}`);
  return out;
}

async function rich(browser, device) {
  const phone = device.width <= 600;
  const where = { device: `${device.width}×${device.height}` };
  const context = await browser.newContext({ viewport: device, colorScheme: "dark", ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`rich ${where.device}: ${error.message}`));
  const result = { where };
  try {
    // A formation's page: the framework's own, its sites and its period linked, so lines run from it at Nearby.
    await page.goto(`${richHost.url}/formations/formation-3?theme=dark`, { waitUntil: "load" });
    await ready(page);
    const legendAt = [];
    const moved = [];
    for (const level of [1, 2]) {
      // By the keys, as a person moves a level: 2, then 3.
      await startRecording(page);
      await page.keyboard.press(String(level + 1));
      await restAt(page, level, 15_000);
      await page.waitForTimeout(700);
      moved.push({ to: level, ...signJumps(await stopRecording(page)) });
      const seenNow = await readRich(page);
      await page.mouse.move(2, Math.round(device.height / 2));
      await page.waitForTimeout(200);
      await page.screenshot({ path: resolve(STRIPS, `rich-${device.width}-${level === 1 ? "nearby" : "city"}.png`) });
      legendAt.push(seenNow.legend);
      const tags = seenNow.tags.map((t) => ({ name: `the ${t.kind} name`, box: t.box }));
      // The views stand at Nearby as at the City (the page's own is the page there).
      const boards = seenNow.boards.filter((b) => level === 2 || !b.own).map((b) => ({ name: `“${b.label}”`, box: b.box }));
      const plates = seenNow.plates.map((p) => ({ name: `the Scene's ${p.kind} name`, box: p.box }));
      const clash = onEachOther([...tags, ...boards, ...plates]);
      // At Nearby nothing this face says stands under the page beside the city.
      const underPanel = seenNow.panel ? [...tags, ...plates, ...boards].filter((t) => overlapOf(t.box, seenNow.panel) > 2).map((t) => t.name) : [];
      // A board beside its district, never on it: on no district's ground.
      // A district's ground is its diamond (the least of |dx|/half-width + |dy|/half-height over the board under 1); the bare corners of its box are street.
      const onDiamond = (box, tile) => { const cx = tile.x + tile.width / 2; const cy = tile.y + tile.height / 2; const near = (a, b, v) => Math.max(a, Math.min(b, v)); return Math.abs(near(box.x, box.x + box.width, cx) - cx) / (tile.width / 2) + Math.abs(near(box.y, box.y + box.height, cy) - cy) / (tile.height / 2) < 0.97; };
      const onGround = boards.flatMap((b) => seenNow.plots.filter((p) => onDiamond(b.box, p.box)).map((p) => `${b.name} on ${p.kind}`)).filter((said) => !seenNow.boards.some((one) => one.own && said.startsWith(`“${one.label}”`)));
      // What covers a building: a name, a board, a district's card.
      const covering = [...tags, ...boards, ...plates];
      const hidden = seenNow.buildings.filter((b) => (!seenNow.panel || overlapOf(b.box, seenNow.panel) < b.box.width * b.box.height * 0.5) && covering.some((c) => overlapOf(b.box, c.box) > b.box.width * b.box.height * 0.3)).map((b) => `${b.id} under ${covering.find((c) => overlapOf(b.box, c.box) > b.box.width * b.box.height * 0.3).name}`);
      const kindsInSight = [...new Set(seenNow.buildings.filter((b) => !seenNow.panel || b.box.x + b.box.width < seenNow.panel.x).map((b) => b.kind))];
      const lineEnds = seenNow.lines.filter((line) => !seenNow.buildings.some((b) => line.to.x >= b.box.x - 1 && line.to.x <= b.box.x + b.box.width + 1 && line.to.y >= b.box.y - 1 && line.to.y <= b.box.y + b.box.height + 1) || covering.some((c) => line.to.x > c.box.x && line.to.x < c.box.x + c.box.width && line.to.y > c.box.y && line.to.y < c.box.y + c.box.height)).map((line) => line.key);
      const keepOut = [{ name: "the bar", box: { x: 0, y: 0, width: seenNow.width, height: seenNow.bar } }, ...(seenNow.panel ? [{ name: "the page", box: seenNow.panel }] : []), ...(seenNow.dock ? [{ name: "the level control", box: seenNow.dock }] : [])];
      const controlsCovered = seenNow.controls.flatMap((c) => keepOut.filter((k) => overlapOf(c.box, k.box) > 1).map((k) => `${c.what} under ${k.name}`));
      const outside = [...tags, ...boards].filter((t) => t.box.x < 0 || t.box.x + t.box.width > seenNow.width || t.box.y < seenNow.bar || t.box.y + t.box.height > seenNow.height).map((t) => t.name);
      /*
       * A KIND'S BOARD STANDS ON ITS OWN DISTRICT: where its post meets the
       * ground is on that district's plate (its diamond, or its edge), and
       * nearer it than any other's. And what any board says is never drawn
       * smaller than 9 pixels.
       */
      const reach = (p, tile) => Math.abs(p.x - (tile.x + tile.width / 2)) / (tile.width / 2) + Math.abs(p.y - (tile.y + tile.height / 2)) / (tile.height / 2);
      const kindOfBoard = (key) => (key.startsWith("kind:") ? key.slice(5) : key.startsWith("place:") ? key.split(":")[1] : null);
      const astray = seenNow.boards.filter((b) => !b.own && kindOfBoard(b.key) && seenNow.district[kindOfBoard(b.key)]).flatMap((b) => {
        const own = reach(b.stem, seenNow.district[kindOfBoard(b.key)]);
        const nearer = Object.entries(seenNow.district).filter(([kind, tile]) => kind !== kindOfBoard(b.key) && reach(b.stem, tile) < own).map(([kind]) => kind);
        return own > 1.08 || nearer.length > 0 ? [`“${b.label}” stands at ${own.toFixed(2)} of its district${nearer.length ? `, nearer ${nearer.join(", ")}` : ""}`] : [];
      });
      const small = seenNow.boards.filter((b) => !b.own && b.smallest < 8.9).map((b) => `“${b.label}” ${b.smallest.toFixed(1)}px`);
      // The page beside the city covers a district (half of it or more): the case a board was found beside another district in.
      const underThePage = seenNow.panel ? Object.entries(seenNow.district).filter(([, tile]) => overlapOf(tile, seenNow.panel) >= tile.width * tile.height * 0.5).map(([kind]) => kind) : [];
      // A small window's City pans rather than shrink its words past reading: there it may run past the window's edge.
      const pans = level === 2 && (device.width <= 600 || device.height <= 600);
      result[level === 2 ? "city" : "nearby"] = { unseenFocus: seenNow.unseenFocus, clash, underPanel, outside: pans ? [] : outside, onGround, hidden, kindsInSight, lineEnds, lines: seenNow.lines.length, controlsCovered, astray, small, underThePage, chosenLooking: seenNow.chosenLooking, tipUp: seenNow.tipUp, problems: seenNow.problems, postCrossings: seenNow.postCrossings };
      if (level === 1) {
        /*
         * Every view whose district is in sight beside the page stands there as
         * a board, as at the City; one whose district is past the window's
         * edge stands where its district is, out of sight with it.
         */
        const sheet = seenNow.width <= 600;
        const shownPart = { x: 0, y: seenNow.bar, width: seenNow.panel && !sheet ? seenNow.panel.x : seenNow.width, height: seenNow.panel && sheet ? (seenNow.dock ? seenNow.dock.y : seenNow.panel.y) - seenNow.bar : seenNow.height - seenNow.bar };
        // In sight with room over its back for a board: a district at the top edge of what is seen has none.
        const seenKinds = new Set(seenNow.plots.filter((p) => overlapOf(p.box, shownPart) >= p.box.width * p.box.height * 0.15 && p.box.y - 80 >= shownPart.y && p.box.x >= shownPart.x && p.box.x + p.box.width <= shownPart.x + shownPart.width).map((p) => p.kind));
        const views = seenNow.boards.filter((b) => b.key.startsWith("place:"));
        const owed = ["period:timeline", "species:tree-of-life", "site:dig-map", "event:extinctions"].filter((one) => seenKinds.has(one.split(":")[0]));
        const missing = owed.filter((one) => !views.some((b) => b.key === `place:${one}`));
        // A phone's sheet leaves the city a strip: there a view in sight is owed its board, and none has to be.
        // On a small window (a phone, or one on its side) a board stands only where it can be read: there none is owed.
        result.nearbyViews = { districtsInSight: [...seenKinds], owed, standing: views.map((b) => b.label), missing, ok: sheet || seenNow.height <= 600 || missing.length === 0 };
      }
      if (level === 2) {
        // Every district at the City says its kind, by its plural, inside the window.
        // On a small window's City, which pans, a name the bar or the control stands over is put away until panned to: it is said all the same.
        const named = seenNow.plots.map((plot) => ({ kind: plot.kind, said: seenNow.tags.find((t) => t.kind === plot.kind)?.text ?? seenNow.namesUnder.find((t) => t.kind === plot.kind)?.text ?? null })).map((one) => ({ ...one, ok: one.said !== null && one.said.toLowerCase().includes(String(RICH_PLURALS[one.kind] ?? one.kind).toLowerCase()) }));
        result.named = { districts: named.length, unnamed: named.filter((one) => !one.ok).map((one) => one.kind) };
        // Each view's board drawn as that view: its own title and whose view it is, no two alike, no record lines.
        // The app's views: the places it declared (its worker views here), not how the kinds connect.
        const views = seenNow.boards.filter((b) => b.key.startsWith("place:"));
        const read = views.map((b) => `${b.says} · ${b.title}`);
        result.views = {
          underThePansBar: seenNow.under.filter((key) => key.startsWith("place:")),
          boards: read,
          asThemselves: views.filter((b) => b.title === b.label && /^view · /i.test(b.says ?? "") && b.lines === 0).length,
          alike: read.filter((one, i) => read.indexOf(one) !== i),
        };
      }
    }
    /*
     * THE HOME BESIDE THE CITY: at Nearby on the home the city is framed in
     * the part the page leaves it, so no district stands behind the page.
     */
    await page.goto(`${richHost.url}/?theme=dark`, { waitUntil: "load" });
    await ready(page);
    await page.keyboard.press("2");
    await restAt(page, 1, 15_000);
    await page.waitForTimeout(700);
    await page.mouse.move(2, Math.round(device.height / 2));
    await page.screenshot({ path: resolve(STRIPS, `rich-${device.width}-home-nearby.png`) });
    const home = await readRich(page);
    // Where the part the page leaves the city is too small to take the whole city in at the camera's furthest (a narrow tablet, a small phone), the city cannot help standing partly behind the page: held where it can.
    const free = home.panel ? (home.width <= 600 ? { width: home.width, height: home.panel.y - home.bar } : { width: home.panel.x, height: home.height - home.bar }) : { width: home.width, height: home.height };
    result.home = { behind: home.panel ? Object.entries(home.district).filter(([, tile]) => overlapOf(tile, home.panel) > tile.width * tile.height * 0.15).map(([kind]) => kind) : [], districts: Object.keys(home.district).length, free, held: free.width >= 480 && free.height >= 300 };
    result.moved = moved;
    /*
     * A DISTRICT'S PROBLEMS OPEN FROM THE CITY AND FROM NEARBY, by a press
     * and by the keyboard: the specimens break a rule (a specimen with no
     * catalog number), and their district's "⚠ n" beside its name opens the
     * problems beside the city.
     */
    /*
     * A HAND ON A BOARD MOVES THE CITY: a drag that begins on a view's board
     * pans the city by as far as the hand goes (and opens nothing), by a
     * pointer at a desk and by a finger on a phone; a press that does not
     * move opens the view.
     */
    if (device.width === 1280 || device.width === 390) {
      await page.goto(`${richHost.url}/formations/formation-3?theme=dark`, { waitUntil: "load" });
      await ready(page);
      await page.keyboard.press("3");
      await restAt(page, 2, 15_000);
      await page.waitForTimeout(700);
      const pick = () =>
        page.evaluate(() => {
          const shown = [...document.querySelectorAll("[data-graview-board]")].filter((b) => Number(b.style.opacity || 0) > 0.9 && !b.hasAttribute("aria-current") && !b.hasAttribute("data-graview-under") && b.getAttribute("data-graview-board") !== "home");
          const inside = shown.map((b) => ({ b, r: b.getBoundingClientRect() })).filter(({ r }) => r.left > 20 && r.right < innerWidth - 20 && r.top > 120 && r.bottom < innerHeight - 140);
          const one = inside[0];
          if (!one) return null;
          const tile = document.querySelector('[data-testid="one-place-city"] [data-graview-plot] .graview-plot-tile')?.getBoundingClientRect();
          return { key: one.b.getAttribute("data-graview-board"), path: one.b.getAttribute("data-graview-board-path"), x: one.r.left + one.r.width / 2, y: one.r.top + one.r.height / 2, tile: tile ? { x: tile.left, y: tile.top } : null };
        });
      const before = await pick();
      const by = { x: 90, y: 40 };
      const touch = device.width <= 600;
      if (before) {
        if (!touch) {
          await page.mouse.move(before.x, before.y);
          await page.mouse.down();
          for (let i = 1; i <= 10; i++) await page.mouse.move(before.x + (by.x * i) / 10, before.y + (by.y * i) / 10);
          await page.mouse.up();
        } else {
          // A finger's drag, as the page hears it: pointer events of a touch, on the board it began on.
          await page.evaluate(({ key, x, y, by }) => {
            const el = document.querySelector(`[data-graview-board="${CSS.escape(key)}"]`);
            const at = (type, dx, dy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x + dx, clientY: y + dy }));
            at("pointerdown", 0, 0);
            for (let i = 1; i <= 10; i++) at("pointermove", (by.x * i) / 10, (by.y * i) / 10);
            at("pointerup", by.x, by.y);
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x + by.x, clientY: y + by.y }));
          }, { key: before.key, x: before.x, y: before.y, by });
        }
        await page.waitForTimeout(700);
      }
      const after = await page.evaluate(() => {
        const tile = document.querySelector('[data-testid="one-place-city"] [data-graview-plot] .graview-plot-tile')?.getBoundingClientRect();
        return { tile: tile ? { x: tile.left, y: tile.top } : null, url: location.pathname, level: Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place")) };
      });
      const panned = before?.tile && after.tile ? { x: Math.round(after.tile.x - before.tile.x), y: Math.round(after.tile.y - before.tile.y) } : null;
      // And a press that does not move: the view opens, beside the city.
      const press = await pick();
      if (press) {
        if (touch) await page.touchscreen.tap(press.x, press.y);
        else await page.mouse.click(press.x, press.y);
        await page.waitForTimeout(400);
        await restAt(page, 1, 15_000).catch(() => {});
      }
      const opened = { url: new URL(page.url()).pathname, level: await levelOf(page), wanted: press?.path ?? null };
      result.handOnABoard = { how: touch ? "touch" : "pointer", from: before?.key ?? null, panned, by, stayed: after.url.endsWith("/formations/formation-3") && after.level === 2, opened, ok: Boolean(before && panned && Math.abs(panned.x - by.x) <= 8 && Math.abs(panned.y - by.y) <= 8 && after.url.endsWith("/formations/formation-3") && after.level === 2 && press && opened.url.endsWith(press.path.split("?")[0]) && opened.level === 1) };
    }
    /*
     * AFTER A HAND'S PAN AT NEARBY, TOO: the city dragged under the page and
     * the bar, nothing of its own — a district's controls, a board — stands
     * under the bar, the page or the level control.
     */
    if (device.width === 1280) {
      await page.goto(`${richHost.url}/formations/formation-3?theme=dark`, { waitUntil: "load" });
      await ready(page);
      await page.keyboard.press("2");
      await restAt(page, 1, 15_000);
      await page.waitForTimeout(500);
      await page.mouse.move(300, 420);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(300 + i * 40, 420 - i * 22);
      await page.mouse.up();
      await page.waitForTimeout(900);
      const panned = await readRich(page);
      const keep = [{ name: "the bar", box: { x: 0, y: 0, width: panned.width, height: panned.bar } }, ...(panned.panel ? [{ name: "the page", box: panned.panel }] : []), ...(panned.dock ? [{ name: "the level control", box: panned.dock }] : [])];
      const things = [...panned.controls.map((c) => ({ name: c.what, box: c.box })), ...panned.boards.filter((b) => !b.own).map((b) => ({ name: `“${b.label}”`, box: b.box }))];
      result.panned = things.flatMap((t) => keep.filter((k) => overlapOf(t.box, k.box) > 1).map((k) => `${t.name} under ${k.name}`));
    }
    if (device.width === 1280) {
      const opens = [];
      for (const [from, how] of [[2, "pointer"], [2, "keyboard"], [1, "pointer"], [1, "keyboard"]]) {
        await page.goto(`${richHost.url}/specimens?theme=dark`, { waitUntil: "load" });
        await ready(page);
        await page.keyboard.press(String(from + 1));
        await restAt(page, from, 15_000);
        await page.waitForTimeout(500);
        const chip = page.locator('[data-graview-district-problems="specimen"]');
        const there = await chip.isVisible().catch(() => false);
        if (there) {
          if (how === "pointer") await chip.click();
          else {
            await chip.focus();
            await page.keyboard.press("Enter");
          }
          await restAt(page, 1, 15_000).catch(() => {});
        }
        // What the page beside the city lists: whose problems it says it is, and the kind of every record a problem there names.
        const listed = await page.evaluate(() => {
          const sheet = document.querySelector("[data-graview-one-place]");
          return {
            of: sheet?.querySelector("[data-graview-problems-of]")?.getAttribute("data-graview-problems-of") ?? null,
            named: [...(sheet?.querySelectorAll("main section:not([data-testid=rules]) a[href]") ?? [])].map((a) => new URL(a.href).pathname.split("/").at(-2)),
          };
        });
        const at = new URL(page.url());
        opens.push({ from: from === 2 ? "City" : "Nearby", how, there, url: at.pathname, kind: at.searchParams.get("kind"), level: await levelOf(page), ...listed });
      }
      result.problemsOpen = opens;
    }
    // A second visit, in the same browser: the legend still closed; the Key opens it; and once opened, the visit after finds it open.
    await page.goto(`${richHost.url}/formations/formation-3?theme=dark`, { waitUntil: "load" });
    await ready(page);
    await press(page, '[data-testid="altitude-stop-2"]');
    await restAt(page, 2, 15_000);
    const again = await page.evaluate(() => Boolean(document.querySelector('[data-testid="altitude-key-pane"]')));
    await press(page, '[data-testid="altitude-key"]');
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => ({ pane: Boolean(document.querySelector('[data-testid="altitude-key-pane"]')), expanded: document.querySelector('[data-testid="altitude-key"]')?.getAttribute("aria-expanded") }));
    await page.reload({ waitUntil: "load" });
    await ready(page);
    await press(page, '[data-testid="altitude-stop-2"]');
    await restAt(page, 2, 15_000);
    const keptOpen = await page.evaluate(() => Boolean(document.querySelector('[data-testid="altitude-key-pane"]')));
    result.legend = { firstVisit: legendAt, secondVisit: again, opened, keptOpen };
  } catch (error) {
    result.error = String(error?.message ?? error);
  }
  await context.close().catch(() => {});
  const city = result.city ?? { clash: ["not read"], underPanel: [], outside: [], problems: [] };
  const nearby = result.nearby ?? { clash: ["not read"], underPanel: [], outside: [], problems: [] };
  seen.richClear.push({ where, city: { clash: city.clash, outside: city.outside, onGround: city.onGround }, nearby: { clash: nearby.clash, underPanel: nearby.underPanel, outside: nearby.outside, onGround: nearby.onGround }, error: result.error, ok: !result.error && city.clash.length === 0 && city.outside.length === 0 && city.onGround.length === 0 && nearby.clash.length === 0 && nearby.underPanel.length === 0 && nearby.outside.length === 0 && nearby.onGround.length === 0 });
  // A desk's Nearby draws the formation page's lines: there are some to hold, and a run with none fails.
  const roomy = device.width >= 1000 && device.height > 600;
  seen.richRecords.push({ where, hidden: nearby.hidden, districtsInSight: nearby.kindsInSight, lines: nearby.lines, lineEndsNotOnABuilding: nearby.lineEnds, ok: !result.error && nearby.hidden?.length === 0 && (nearby.kindsInSight?.length ?? 0) >= 1 && (!roomy || nearby.lines > 0) && nearby.lineEnds?.length === 0 });
  seen.richNearbyViews.push({ where, ...result.nearbyViews, ok: Boolean(result.nearbyViews?.ok) });
  seen.richControls.push({ where, city: city.controlsCovered, nearby: nearby.controlsCovered, afterAPan: result.panned, ok: !result.error && city.controlsCovered?.length === 0 && nearby.controlsCovered?.length === 0 && (result.panned?.length ?? 0) === 0 });
  seen.richNamed.push({ where, ...result.named, ok: Boolean(result.named && result.named.districts === Object.keys(RICH_PLURALS).length && result.named.unnamed.length === 0) });
  seen.richWords.push({ where, city: city.problems, nearby: nearby.problems, ok: !result.error && city.problems.length === 0 && nearby.problems.length === 0 });
  seen.richLegend.push({ where, ...result.legend, ok: Boolean(result.legend && result.legend.firstVisit.every((open) => !open) && !result.legend.secondVisit && result.legend.opened.pane && result.legend.opened.expanded === "true" && result.legend.keptOpen) });
  seen.richSmooth.push({ where, moves: result.moved, ok: Boolean(result.moved?.length === 2 && result.moved.every((one) => one.leaps.length === 0)) });
  seen.richFocusSeen.push({ where, city: city.unseenFocus, nearby: nearby.unseenFocus, ok: !result.error && city.unseenFocus?.length === 0 && nearby.unseenFocus?.length === 0 });
  if (result.handOnABoard) seen.richHand.push({ where, ...result.handOnABoard });
  else if (device.width === 1280 || device.width === 390) seen.richHand.push({ where, error: result.error, ok: false });
  if (result.problemsOpen) seen.richProblems.push({ where, opens: result.problemsOpen, ok: result.problemsOpen.every((one) => one.there && one.url.endsWith("/problems") && one.level === 1) });
  // The specimens' "⚠ n" opens the problems narrowed to specimens: the page says so, and every problem it lists names a specimen.
  if (result.problemsOpen) seen.richProblemsOfKind.push({ where, opens: result.problemsOpen.map(({ from, how, kind, of, named }) => ({ from, how, kind, of, named: [...new Set(named)] })), ok: result.problemsOpen.every((one) => one.there && one.kind === "specimen" && one.of === "specimen" && one.named.length > 0 && one.named.every((plural) => plural === "specimens")) });
  /*
   * A board's post never runs across a district's name, at the City and
   * beside a page. Across another board it runs only where no place by its
   * district stands clear of every board, name and ground (held by the
   * placement's own tests), and there the board is what is seen where they
   * cross: the post is drawn under it, never over its words.
   */
  const acrossNames = [...(city.postCrossings ?? []), ...(nearby.postCrossings ?? [])].filter((one) => one.under === null);
  seen.richPosts.push({ where, acrossNames, error: result.error, ok: !result.error && Array.isArray(city.postCrossings) && Array.isArray(nearby.postCrossings) && acrossNames.length === 0 });
  const crossingBoards = [...(city.postCrossings ?? []), ...(nearby.postCrossings ?? [])].filter((one) => one.under !== null);
  seen.richPostsUnder.push({ where, crossings: crossingBoards, error: result.error, ok: !result.error && crossingBoards.every((one) => one.under) });
  seen.richOwnDistrict.push({ where, city: city.astray, nearby: nearby.astray, pageCoversADistrict: nearby.underThePage, ok: !result.error && city.astray?.length === 0 && nearby.astray?.length === 0 && (where.device !== "1280×800" || (nearby.underThePage?.length ?? 0) > 0) });
  // On a small window (a phone, or one on its side) a board's words are never smaller than 9 pixels: the City pans rather than shrink them, and beside a page a board stands only where it can be read.
  const small = device.width <= 600 || device.height <= 600;
  seen.richLegible.push({ where, city: city.small, nearby: nearby.small, ok: !result.error && (!small || (city.small?.length === 0 && nearby.small?.length === 0)) });
  seen.richHomeNearby.push({ where, ...result.home, ok: Boolean(result.home && result.home.districts > 0 && (!result.home.held || result.home.behind.length === 0)) });
  seen.richOneLevel.push({ where, nearby: { chosen: nearby.chosenLooking, tip: nearby.tipUp }, city: { chosen: city.chosenLooking, tip: city.tipUp }, ok: !result.error && nearby.chosenLooking?.length === 1 && city.chosenLooking?.length === 1 && nearby.tipUp?.length === 0 && city.tipUp?.length === 0 });
  seen.richViews.push({ where, ...result.views, ok: Boolean(result.views && result.views.boards.length + (device.width <= 600 || device.height <= 600 ? result.views.underThePansBar.length : 0) === 4 && result.views.asThemselves === result.views.boards.length && result.views.alike.length === 0) });
}

/*
 * A RECORD OPENED IN THE CITY IS LIT WHERE IT STANDS. Nick pressed a
 * record's building at Nearby: it was chosen, but its building moved to its
 * district's top corner, the others laid out again around it, the rest of
 * the city faded, and a line's words floated over the city — where loading
 * that record's page fresh lit it in place with nothing faded. Here a
 * species' page goes to Nearby, another species' building is pressed, and
 * then one of the records its page links to is pressed in the page beside
 * the city: each time the district's buildings stand where they stood (read
 * in the district's own ground, so a camera's move to a record out of sight
 * is not counted) — and for the press, with the building in sight, every
 * building of the district, the pressed one too, keeps its box on the
 * screen, x, y, width and height, within a pixel (the lit state changes no
 * geometry: it is a color and an outline, never a lift or a camera move) — what
 * is faded is what a fresh load of that page fades, no line's words stand
 * over the city, and the record opened is the one lit.
 */
const RECORD_FROM = "species-1";
/** Every building of one district, where it stands on its own ground (its tile's corners as the frame), what of the city is faded, and the words over the city. */
const readDistrict = (page, kind) =>
  page.evaluate((kind) => {
    const city = document.querySelector('[data-testid="one-place-city"]');
    const tile = city?.querySelector(`[data-graview-plot="kind:${CSS.escape(kind)}"] .graview-plot-tile`);
    const corners = (tile?.getAttribute("points") ?? "").trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
    // The diamond's top, right and left corners: the district's own two axes.
    const top = corners.reduce((a, b) => (b[1] < a[1] ? b : a), [0, Infinity]);
    const right = corners.reduce((a, b) => (b[0] > a[0] ? b : a), [-Infinity, 0]);
    const left = corners.reduce((a, b) => (b[0] < a[0] ? b : a), [Infinity, 0]);
    const u = [right[0] - top[0], right[1] - top[1]];
    const v = [left[0] - top[0], left[1] - top[1]];
    const det = u[0] * v[1] - u[1] * v[0] || 1;
    const onGround = (x, y) => {
      const dx = x - top[0];
      const dy = y - top[1];
      return [Math.round(((dx * v[1] - dy * v[0]) / det) * 1000) / 1000, Math.round(((u[0] * dy - u[1] * dx) / det) * 1000) / 1000];
    };
    const at = {};
    // And each one's box on the screen, as a person sees it.
    const boxes = {};
    for (const b of city?.querySelectorAll(`[data-graview-plot="kind:${CSS.escape(kind)}"] [data-graview-building]`) ?? []) {
      const r = b.getBoundingClientRect();
      boxes[b.getAttribute("data-graview-building")] = [r.left, r.top, r.width, r.height];
    }
    for (const b of city?.querySelectorAll(`[data-graview-plot="kind:${CSS.escape(kind)}"] [data-graview-building]`) ?? []) {
      // Where it meets the ground: its left face's lowest corner, as the plot draws it (a lift is a translate, not its points).
      const pts = (b.querySelector(".graview-iso-left")?.getAttribute("points") ?? "").trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
      const foot = pts.reduce((a, p) => (p[1] > a[1] ? p : a), [0, -Infinity]);
      at[b.getAttribute("data-graview-building")] = onGround(foot[0], foot[1]);
    }
    let faded = 0;
    for (const b of city?.querySelectorAll("[data-graview-building]") ?? []) {
      let o = 1;
      for (let el = b; el && el !== city; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
      if (o < 0.95) faded++;
    }
    const words = [...document.querySelectorAll(".graview-record-link-said")].filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden").map((el) => el.textContent);
    const lit = [...(city?.querySelectorAll("[data-graview-building][data-graview-here]") ?? [])].map((b) => b.getAttribute("data-graview-building"));
    const chosenOnTheScene = [...(city?.querySelectorAll("[data-graview-building][data-graview-selected]") ?? [])].map((b) => b.getAttribute("data-graview-building"));
    return { at, boxes, faded, words, lit, chosenOnTheScene, url: location.pathname, level: Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place")) };
  }, kind);
/** What of a district moved or changed its size on the screen by more than a pixel: x, y, width or height. */
const reshaped = (before, after) => Object.keys(before).filter((id) => after[id] && before[id].some((v, i) => Math.abs(after[id][i] - v) > 1)).map((id) => `${id} ${before[id].map((v) => Math.round(v)).join(",")} → ${after[id].map((v) => Math.round(v)).join(",")}`);
/** What of a district moved, in its own ground's measure. */
const movedIn = (before, after) => Object.keys(before).filter((id) => after[id] && Math.hypot(after[id][0] - before[id][0], after[id][1] - before[id][1]) > 0.02);
/** The most buildings faded in any one frame from now until it is read: a fade that comes and goes is a fade. */
const watchFading = (page) =>
  page.evaluate(() => {
    window.__mostFaded = 0;
    window.__fadeWatch = true;
    const tick = () => {
      if (!window.__fadeWatch) return;
      const city = document.querySelector('[data-testid="one-place-city"]');
      let faded = 0;
      for (const b of city?.querySelectorAll("[data-graview-building]") ?? []) if (Number(getComputedStyle(b).opacity) < 0.95) faded++;
      window.__mostFaded = Math.max(window.__mostFaded, faded);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const mostFaded = (page) => page.evaluate(() => ((window.__fadeWatch = false), window.__mostFaded));

async function recordInPlace(browser) {
  const where = { device: "1280×800", how: "pointer" };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`record in place: ${error.message}`));
  const runs = [];
  try {
    const nearby = async (path) => {
      await page.goto(`${richHost.url}${path}?theme=dark`, { waitUntil: "load" });
      await ready(page);
      await page.keyboard.press("2");
      await restAt(page, 1, 15_000);
      await page.waitForTimeout(700);
    };
    await nearby(`/species/${RECORD_FROM}`);
    // A building of another species, pressed where it stands: one nothing else stands over, beside the page.
    const target = await page.evaluate((from) => {
      const panel = document.querySelector("[data-graview-one-place]").getBoundingClientRect();
      for (const b of document.querySelectorAll('[data-testid="one-place-city"] [data-graview-plot="kind:species"] [data-graview-building]')) {
        if (b.getAttribute("data-graview-building") === from) continue;
        const r = b.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height * 0.6;
        if (x < 20 || x > panel.left - 20 || y < 80 || y > innerHeight - 120) continue;
        if (document.elementFromPoint(x, y)?.closest('[data-testid="one-place-city"]')) return { id: b.getAttribute("data-graview-building"), x, y };
      }
      return null;
    }, RECORD_FROM);
    const before = await readDistrict(page, "species");
    if (target) {
      await watchFading(page);
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(300);
      await restAt(page, 1, 15_000).catch(() => {});
      await page.waitForTimeout(900);
      const after = await readDistrict(page, "species");
      const most = await mostFaded(page);
      await nearby(`/species/${target.id}`);
      const fresh = await readDistrict(page, "species");
      runs.push({ by: "a press on its building", opened: target.id, landed: after.url, moved: movedIn(before.at, after.at), onTheScreen: reshaped(before.boxes, after.boxes), lit: after.lit, chosenOnTheScene: after.chosenOnTheScene, faded: { afterThePress: after.faded, mostWhileItMoved: most, freshLoad: fresh.faded }, words: after.words, freshMoved: movedIn(after.at, fresh.at) });
    } else runs.push({ by: "a press on its building", error: "no building of another species to press" });
    // And a link in the page beside the city: one of the records the species' page links to.
    await nearby(`/species/${RECORD_FROM}`);
    const link = await page.evaluate(() => {
      const button = document.querySelector("[data-graview-connected-box] [data-graview-record]");
      return button ? button.getAttribute("data-graview-record") : null;
    });
    const linkKind = link ? await page.evaluate((id) => document.querySelector(`[data-graview-building="${CSS.escape(id)}"]`)?.closest("[data-graview-plot]")?.getAttribute("data-graview-plot")?.replace(/^kind:/, "") ?? null, link) : null;
    if (link && linkKind) {
      const beforeLink = await readDistrict(page, linkKind);
      await watchFading(page);
      await page.locator(`[data-graview-connected-box] [data-graview-record="${link}"]`).first().click();
      await page.waitForTimeout(300);
      await restAt(page, 1, 15_000).catch(() => {});
      await page.waitForTimeout(900);
      const after = await readDistrict(page, linkKind);
      const most = await mostFaded(page);
      const path = new URL(page.url()).pathname.replace(/^\/pages/, "");
      await nearby(path);
      const fresh = await readDistrict(page, linkKind);
      runs.push({ by: "a link in the page", opened: link, landed: after.url, moved: movedIn(beforeLink.at, after.at), lit: after.lit, chosenOnTheScene: after.chosenOnTheScene, faded: { afterThePress: after.faded, mostWhileItMoved: most, freshLoad: fresh.faded }, words: after.words, freshMoved: movedIn(after.at, fresh.at) });
    } else runs.push({ by: "a link in the page", error: "no linked record with a building beside the page" });
  } catch (error) {
    runs.push({ error: String(error?.message ?? error) });
  }
  await context.close().catch(() => {});
  for (const run of runs) {
    const done = !run.error;
    seen.recordInPlace.push({ where, ...run, ok: done && run.landed.endsWith(`/${run.opened}`) && run.moved.length === 0 && (run.onTheScreen ?? []).length === 0 && run.freshMoved.length === 0 && run.lit.includes(run.opened) && run.chosenOnTheScene.length === 0 });
    seen.oneRuleFades.push({ where, by: run.by, faded: run.faded, error: run.error, ok: done && run.faded.afterThePress === run.faded.freshLoad && run.faded.mostWhileItMoved <= run.faded.freshLoad });
    seen.noWordsAfterPress.push({ where, by: run.by, words: run.words, error: run.error, ok: done && run.words.length === 0 });
  }
}

/*
 * THE PAGE IS DRAWN ONCE. With the one face on, its part is fetched as the
 * page first draws, and it arrived some 300 ms later: the page and its bar
 * drawn again as new elements, and a press, the keyboard and a word typed
 * in that time lost. Here its part is held back a while, as a slow network
 * would; meanwhile the keyboard goes into Find and a word is typed there,
 * which goes to what it finds; once the one face has come, that page's
 * main, the bar and Find are the same elements, the keyboard still in Find,
 * the word as typed, the page in the one face's sheet and the bar in its
 * slot.
 */
async function drawnOnce(browser) {
  const where = { device: "1280×800" };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`drawn once: ${error.message}`));
  let held = 0;
  // The one face's part, told by what it draws: held back 2.5 s.
  await page.route("**/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("data-graview-one-place") && body.includes("one-place-bar")) {
      held++;
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
    await route.fulfill({ response, body });
  });
  const result = { where };
  try {
    await page.goto(`${richHost.url}/species/${RECORD_FROM}`, { waitUntil: "commit" });
    await page.waitForSelector("[data-graview-app-bar]", { timeout: 30_000 });
    const meanwhile = await page.evaluate(async () => {
      const arriving = document.documentElement.hasAttribute("data-graview-one-face-arriving") && !document.querySelector("[data-graview-one-place]");
      const bar = document.querySelector("[data-graview-app-bar]");
      if (bar) bar.__drawnOnce = 1;
      // Find, as a person reaches it: its box, or the button that opens it.
      let find = bar?.querySelector('[data-testid="app-find"] input, input[data-testid="nav-find"], input[type="search"]');
      if (!find) {
        bar?.querySelector('[data-testid="app-find-open"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        find = bar?.querySelector('[data-testid="app-find"] input, input[data-testid="nav-find"], input[type="search"]');
      }
      if (find) find.__drawnOnce = 1;
      find?.focus();
      return { arriving, find: Boolean(find), focused: document.activeElement === find };
    });
    if (meanwhile.find) await page.keyboard.type("fern", { delay: 20 });
    // A word in Find goes to what it finds: that page, drawn while the one face is still on its way, is the page that has to stay.
    await page.waitForTimeout(300);
    const stillArriving = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (main) main.__drawnOnce = 1;
      return document.documentElement.hasAttribute("data-graview-one-face-arriving") && !document.querySelector("[data-graview-one-place]");
    });
    meanwhile.stillArriving = stillArriving;
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-graview-one-face-arriving") && document.querySelector("[data-graview-one-place]"), null, { timeout: 30_000 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const main = document.querySelector("main");
      const bar = document.querySelector("[data-graview-app-bar]");
      const active = document.activeElement;
      return {
        sameMain: main?.__drawnOnce === 1,
        sameBar: bar?.__drawnOnce === 1,
        keyboardInFind: active?.__drawnOnce === 1,
        typed: active instanceof HTMLInputElement ? active.value : null,
        inTheSheet: Boolean(main && document.querySelector("[data-graview-one-place]")?.contains(main)),
        barInTheSlot: Boolean(bar && document.querySelector('[data-testid="one-place-bar"]')?.contains(bar)),
        mains: document.querySelectorAll("main").length,
      };
    });
    Object.assign(result, { heldBack: held, meanwhile, after });
  } catch (error) {
    result.error = String(error?.message ?? error);
  }
  await context.close().catch(() => {});
  const a = result.after;
  seen.drawnOnce.push({ ...result, ok: Boolean(!result.error && result.heldBack > 0 && result.meanwhile?.arriving && result.meanwhile.stillArriving && result.meanwhile.find && a?.sameMain && a.sameBar && a.keyboardInFind && a.typed === "fern" && a.inTheSheet && a.barInTheSlot && a.mains === 1) });
}

/* ------------------------------------------------------------------ */
/* The run                                                             */
/* ------------------------------------------------------------------ */

let browser;
const todo = await serving("todo", portFor("todo"), repoRoot);
const richHost = await serveRich(repoRoot);
try {
  mkdirSync(STRIPS, { recursive: true });
  for (const engine of engines) {
    browser = await launchEngine(engine);
    const run = async (options, device, gestures) => {
      for (const [list, gesture] of gestures) {
        const context = await browser.newContext(options);
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${device}: ${error.message}`));
        const where = { engine, device };
        try {
          list.push(await gesture(page, where));
        } catch (error) {
          list.push({ where, ok: false, error: String(error?.message ?? error) });
        }
        await context.close().catch(() => {});
      }
    };
    await run({ viewport: DESK }, "desk 1440×900", [
      [seen.switch, (page, where) => noSwitch(page, where)],
      [seen.button, (page, where) => theButton(page, where, false)],
      [seen.node, (page, where) => sameNode(page, where, false)],
      [seen.views, (page, where) => views(page, where)],
      [seen.chosen, (page, where) => chosen(page, where)],
      [seen.free, (page, where) => freeCity(page, where)],
      [seen.overshoot, (page, where) => noOvershoot(page, where)],
      [seen.bar, (page, where) => bar(page, where)],
      [seen.viewLines, (page, where) => linesOfEveryView(page, where)],
      [seen.risen, (page, where) => history(page, where)],
      [seen.resize, (page, where) => resize(page, where, false)],
      [seen.chosenRecord, (page, where) => chosenRecord(page, where)],
      [seen.offSight, (page, where) => offSight(page, where)],
      [seen.shortcutsRun, (page, where) => shortcuts(page, where)],
      [seen.sliderRun, (page, where) => slider(page, where)],
      [seen.legend, (page, where) => legend(page, where)],
    ]);
    const phone = { ...devices[PHONE], ...(engine === "chromium" ? {} : { isMobile: false }) };
    await run(phone, PHONE, [
      [seen.button, (page, where) => theButton(page, where, true)],
      [seen.node, (page, where) => sameNode(page, where, true)],
      [seen.views, (page, where) => views(page, where)],
      [seen.overshoot, (page, where) => noOvershoot(page, where)],
      [seen.bar, (page, where) => bar(page, where)],
      [seen.resize, (page, where) => resize(page, where, true)],
      ...(engine === "chromium" ? [[seen.pinch, (page, where) => pinch(page, where)]] : []),
      [seen.sliderRun, (page, where) => slider(page, where)],
    ]);
    seen.switch.push(await rootIsTheOneFace(browser, { engine, device: "desk 1440×900" }).catch((error) => ({ ok: false, error: String(error?.message ?? error) })));
    for (const device of [{ width: 1520, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 360, height: 640 }]) await rich(browser, device);
    if (engine === "chromium") {
      await recordInPlace(browser);
      await drawnOnce(browser);
    }
    if (engine === "chromium") {
      report.strips = [];
      for (const scheme of ["light", "dark"]) {
        report.strips.push(await strip(browser, { viewport: DESK, colorScheme: scheme }, `desk-${scheme}`));
        report.strips.push(await strip(browser, { ...devices[PHONE], colorScheme: scheme }, `phone-${scheme}`));
      }
      report.strips = report.strips.map((path) => path.slice(repoRoot.length + 1));
    }
    await browser.close();
    browser = undefined;
  }
  seen.duplicate.push(await duplicate().catch((error) => ({ ok: false, error: String(error?.message ?? error) })));

  // One run of the history holds three claims.
  for (const run of seen.risen.splice(0)) {
    seen.risen.push({ ...run, ok: Boolean(run.madeRises && run.droppedRisesGoingBack) });
    seen.sunk.push({ where: run.where, ok: Boolean(run.droppedSinks && run.madeSinksGoingBack), droppedSinks: run.droppedSinks, madeSinksGoingBack: run.madeSinksGoingBack, error: run.error });
    seen.scrubbed.push({ where: run.where, ok: Boolean(run.untouchedOneNode && run.takenBackMidSinkIsTheSameNode && run.buttonMovesInThePast), untouchedOneNode: run.untouchedOneNode, takenBackMidSinkIsTheSameNode: run.takenBackMidSinkIsTheSameNode, buttonMovesInThePast: run.buttonMovesInThePast, error: run.error });
  }
  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.theFaceOffersNoSwitch = { held: seen.switch, ok: every(seen.switch) };
  report.checks.oneControlAtTheBottomLeftSaysTheLevel = { held: seen.button, ok: every(seen.button) };
  report.checks.theSameNodeMovesThroughEveryLevel = { held: seen.node, ok: every(seen.node) };
  report.checks.lineEndsAreExactEveryFrame = { held: seen.lines, ok: every(seen.lines) };
  report.checks.levelMovesNeverOvershoot = { held: seen.overshoot, ok: every(seen.overshoot) };
  report.checks.theCityHasNoShear = { held: seen.shear, ok: every(seen.shear) };
  report.checks.theBarStaysOnScreenAndUsableAtEveryLevel = { held: seen.bar, ok: every(seen.bar) };
  report.checks.everyViewStandsAtTheCity = { held: seen.views, ok: every(seen.views) };
  report.checks.aViewStandsOnItsOwnDistrict = { held: seen.stand, ok: every(seen.stand) };
  report.checks.noViewCoversADistrictsBuildingsOrLabel = { held: seen.cover, ok: every(seen.cover) };
  report.checks.everyViewIsInsideTheWindowBelowTheBar = { held: seen.inside, ok: every(seen.inside) };
  report.checks.everyKindsNameIsReadableAtCity = { held: seen.names, ok: every(seen.names) };
  report.checks.choosingAnythingAtCityLandsAtNearbyAndStays = { held: seen.chosen, ok: every(seen.chosen) };
  report.checks.clickingTheGroundDeselectsAndStaysAtCity = { held: seen.ground, ok: every(seen.ground) };
  report.checks.zoomingWithNothingSelectedStaysInTheCity = { held: seen.free, ok: every(seen.free) };
  report.checks.everyViewThatShowsRecordsDrawsItsLines = { held: seen.viewLines, ok: every(seen.viewLines) };
  report.checks.aRecordMadeInTheRangeRisesAsTheScrubCrossesIt = { held: seen.risen, ok: every(seen.risen) };
  report.checks.aRemovedRecordComesDown = { held: seen.sunk, ok: every(seen.sunk) };
  report.checks.theSameNodeIsKeptWhileScrubbing = { held: seen.scrubbed, ok: every(seen.scrubbed) };
  report.checks.theNearbyPanelResizesByDragAndKeyboard = { held: seen.resize, ok: every(seen.resize) };
  report.checks.linesStayExactWhileResizing = { held: seen.resizeLines, ok: every(seen.resizeLines) };
  report.checks.theChosenWidthIsKeptAcrossLevelMoves = { held: seen.resizeKept, ok: every(seen.resizeKept) };
  report.checks.aPinchOnThePageIsTheBrowsersOwnAndBesideTheCityMovesTheCamera = { held: seen.pinch, ok: every(seen.pinch) };
  report.checks.atNearbyTheSelectedRecordStandsOutFromItsRelated = { held: seen.standsOut, ok: every(seen.standsOut) };
  report.checks.atNearbyNoCitySideConnectionLabelsForTheSelectedRecord = { held: seen.noCityWords, ok: every(seen.noCityWords) };
  report.checks.connectedNeverRepeatsOrCoversThePage = { held: seen.connected, ok: every(seen.connected) };
  report.checks.noLineCrossesTheNearbyPanel = { held: seen.crossing, ok: every(seen.crossing) };
  report.checks.levelShortcutsMoveLevelsAndAreShown = { held: seen.shortcuts, ok: every(seen.shortcuts) };
  report.checks.theLevelKeysTurnOffAndTheLegendSaysSo = { held: seen.keysTurnOff, ok: every(seen.keysTurnOff) };
  report.checks.browserZoomKeysAreNotTaken = { held: seen.zoomKeys, ok: every(seen.zoomKeys) };
  report.checks.shortcutsDoNotFireInAField = { held: seen.inField, ok: every(seen.inField) };
  report.checks.theControlCollapsesToASliderNamingTheLevel = { held: seen.folds, ok: every(seen.folds) };
  report.checks.draggingTheSliderScrubsTheLevels = { held: seen.dragged, ok: every(seen.dragged) };
  report.checks.theCollapsedControlIsClearlySmallerAndTheSameHeight = { held: seen.small, ok: every(seen.small) };
  report.checks.theLegendAndTooltipsAreReachableInBothStates = { held: seen.legend, ok: every(seen.legend) };
  report.checks.theCollapsedChoiceIsKept = { held: seen.keptChoice, ok: every(seen.keptChoice) };
  report.checks.aDuplicateViewIsFound = { held: seen.duplicate, ok: every(seen.duplicate) };
  report.checks.aRichAppsCityAndNearbyHaveNothingStandingOnAnythingElse = { held: seen.richClear, ok: every(seen.richClear) };
  report.checks.everyDistrictAtTheCityNamesItsKind = { held: seen.richNamed, ok: every(seen.richNamed) };
  report.checks.noNameOrTitleIsCutOffOrWrapsAt1280Or390 = { held: seen.richWords, ok: every(seen.richWords) };
  report.checks.theLegendIsClosedUntilOpenedAndOnceOpenedStaysOpenOnLaterVisits = { held: seen.richLegend, ok: every(seen.richLegend) };
  report.checks.noBoardOrDistrictNameLeapsBetweenFrames = { held: seen.richSmooth, ok: every(seen.richSmooth) };
  report.checks.everythingTheKeyboardReachesInTheCityIsSeen = { held: seen.richFocusSeen, ok: every(seen.richFocusSeen) };
  report.checks.aDistrictsProblemsOpenFromTheCityAndNearbyByPointerAndKeyboard = { held: seen.richProblems, ok: every(seen.richProblems) };
  report.checks.aDragBegunOnABoardPansTheCityAndAPressOpensTheView = { held: seen.richHand, ok: every(seen.richHand) };
  report.checks.eachViewsBoardIsDrawnAsThatViewAndNoTwoAlike = { held: seen.richViews, ok: every(seen.richViews) };
  report.checks.atNearbyEveryBuildingInSightIsSeenAndEveryLineEndsOnOne = { held: seen.richRecords, ok: every(seen.richRecords) };
  report.checks.atNearbyEveryViewOfADistrictInSightHasABoard = { held: seen.richNearbyViews, ok: every(seen.richNearbyViews) };
  report.checks.noDistrictControlStandsUnderTheBarThePageOrTheLevelControl = { held: seen.richControls, ok: every(seen.richControls) };
  report.checks.everyKindsBoardStandsOnItsOwnDistrictEvenWhereThePageCoversOne = { held: seen.richOwnDistrict, ok: every(seen.richOwnDistrict) };
  report.checks.noBoardsWordsAreSmallerThanNinePixels = { held: seen.richLegible, ok: every(seen.richLegible) };
  report.checks.atNearbyTheHomeFramesTheCityBesideThePage = { held: seen.richHomeNearby, ok: every(seen.richHomeNearby) };
  report.checks.theLevelControlShowsOneChosenLevelAfterTheKeys = { held: seen.richOneLevel, ok: every(seen.richOneLevel) };
  report.checks.aRecordOpenedInTheCityByAPressOrALinkIsLitWhereItStandsAndItsDistrictKeepsItsOrder = { held: seen.recordInPlace, ok: every(seen.recordInPlace) };
  report.checks.whetherTheRestOfTheCityFadesIsOneRuleOnAFreshLoadAndAfterAPress = { held: seen.oneRuleFades, ok: every(seen.oneRuleFades) };
  report.checks.noLinksWordsFloatOverTheCityAfterARecordIsOpenedThere = { held: seen.noWordsAfterPress, ok: every(seen.noWordsAfterPress) };
  report.checks.thePageIsDrawnOnceAndItsElementsFocusAndTypedWordSurviveTheOneFacesArrival = { held: seen.drawnOnce, ok: every(seen.drawnOnce) };
  report.checks.noBoardsPostCrossesADistrictsName = { held: seen.richPosts, ok: every(seen.richPosts) };
  report.checks.aPostCrossesABoardOnlyUnderIt = { held: seen.richPostsUnder, ok: every(seen.richPostsUnder) };
  report.checks.aDistrictsWarningChipOpensTheProblemsOfThatKindAlone = { held: seen.richProblemsOfKind, ok: every(seen.richProblemsOfKind) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  todo.stop();
  richHost.stop();
}

writeFileSync(resolve(repoRoot, "docs/one-face.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/one-face.json\n");
process.exit(report.passed ? 0 : 1);
