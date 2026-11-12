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
 * `graview check`, its edit removing it.
 *
 * Frame strips (desk and phone, light and dark) are written to
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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ["chromium"];
const DESK = { width: 1440, height: 900 };
const PHONE = "Pixel 7";
const DAY = "today=2026-09-01";
const STRIPS = resolve(repoRoot, "docs/one-face");

const report = { at: new Date().toISOString(), engines, app: "apps/todo", checks: {} };
const errors = [];
const seen = { switch: [], button: [], node: [], lines: [], views: [], chosen: [], shear: [], duplicate: [], risen: [], sunk: [], scrubbed: [], stand: [], cover: [], inside: [], names: [], ground: [], free: [], overshoot: [], bar: [], viewLines: [], resize: [], resizeLines: [], resizeKept: [], pinch: [], standsOut: [], noCityWords: [], connected: [], chosenRecord: [], crossing: [], offSight: [], shortcuts: [], zoomKeys: [], inField: [], shortcutsRun: [], folds: [], dragged: [], keptChoice: [], sliderRun: [], small: [], legend: [] };

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
      // Read while it is in the window's flow, the page is the window: the box it fills.
      const inFlow = getComputedStyle(now).display === "contents";
      const bar = document.querySelector('[data-testid="one-place-bar"]')?.getBoundingClientRect();
      const control = document.querySelector('[data-testid="altitude"] [role="group"]')?.getBoundingClientRect();
      frames.push({
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
        return b ? { w: r.width, h: r.height, name: b.getAttribute("aria-label"), words: b.textContent?.trim(), pressed: b.getAttribute("aria-pressed") === "true" } : null;
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
  // The page's last words are not under the control: scrolled to its foot, the last thing above the room kept for it.
  const foot = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const room = document.querySelector("[data-graview-altitude-room]");
    const fab = document.querySelector('[data-testid="altitude"] [role="group"]').getBoundingClientRect();
    let last = room?.previousElementSibling;
    while (last && last.getBoundingClientRect().height === 0) last = last.previousElementSibling;
    const deepest = last ? [...last.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().height > 0 && el.children.length === 0).map((el) => el.getBoundingClientRect().bottom) : [];
    return { room: Boolean(room), lastBottom: Math.max(0, ...deepest), fabTop: fab.top };
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
  // At the bottom left — a phone's rides above the sheet at Nearby.
  const corner = (l) => l.at && l.at.left <= 24 && (l.at.bottom <= 24 || (phone && l.level === 1));
  const ok =
    levels.every((l) => corner(l) && sized(l) && lit(l) && words(l)) &&
    levels.every((l) => l.key) &&
    /1 of 3/.test(levels[0].said ?? "") && /3 of 3/.test(levels[2].said ?? "") &&
    foot.room && foot.lastBottom <= foot.fabTop + 1 &&
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
  seen.crossing.push({ where, path: "/pages/tasks/t-deposit", ...crossing, ok: crossing.counted > 0 && crossing.crossed === 0 });
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
    const signs = [...document.querySelectorAll("[data-graview-board]")].filter((b) => !b.getAttribute("data-graview-board").startsWith("record:")).map((b) => ({ key: b.getAttribute("data-graview-board"), path: b.getAttribute("data-graview-board-path").split("?")[0], label: b.getAttribute("title"), box: rect(b), shown: Number(b.style.opacity) > 0.9 }));
    const tiles = [...city.querySelectorAll("[data-graview-plot] .graview-plot-tile")].map((tile) => ({ kind: tile.closest("[data-graview-plot]").getAttribute("data-graview-plot"), box: rect(tile) }));
    const buildings = [...city.querySelectorAll("[data-graview-building]")].map(rect);
    const names = [...city.querySelectorAll(".graview-kind-face[data-graview-nameplate]")].filter((face) => face.getAttribute("data-graview-nameplate") !== "none").map((face) => {
      const box = rect(face);
      const points = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5]].map(([fx, fy]) => document.elementFromPoint(box.x + box.width * fx, box.y + box.height * fy));
      const name = face.querySelector("[data-graview-district-name]");
      return { kind: face.closest("[data-graview-view]")?.getAttribute("data-graview-view"), box, covered: points.filter((top) => top && !face.contains(top)).map((top) => top.closest("[data-graview-board]")?.getAttribute("title") ?? top.tagName), size: name ? parseFloat(getComputedStyle(name).fontSize) : 0 };
    });
    const bar = document.querySelector('[data-testid="one-place-bar"]').getBoundingClientRect().bottom;
    const control = document.querySelector('[data-testid="altitude"] [role="group"]').getBoundingClientRect().top;
    // What a view stands on: the district its kind is, the nearest tile to its foot.
    // From the view's foot to the nearest edge of each district's ground.
    const gap = (p, b) => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));
    const nearest = (box) => tiles.reduce((best, tile) => { const d = gap({ x: box.x + box.width / 2, y: box.y + box.height }, tile.box); return !best || d < best.d ? { kind: tile.kind, d } : best; }, null);
    return {
      signs: signs.map((sign) => ({ ...sign, near: nearest(sign.box)?.kind ?? null })),
      covers: signs.flatMap((sign) => [...tiles.map((t) => t.box), ...buildings, ...names.map((n) => n.box)].some((box) => overlap(sign.box, box) > 4) ? [sign.label] : []),
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
  seen.inside.push({ where, outside: seenNow.outside, ok: seenNow.outside.length === 0 });
  seen.names.push({ where, names: seenNow.names.map((n) => ({ kind: n.kind, covered: n.covered, size: n.size })), ok: seenNow.names.length > 0 && seenNow.names.every((n) => n.covered.length === 0 && n.size >= 11) });
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
        const signs = [...document.querySelectorAll("[data-graview-board]")].map((b) => b.getBoundingClientRect());
        for (const building of document.querySelectorAll("[data-graview-building]")) {
          const r = building.getBoundingClientRect();
          const p = { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
          if (r.width < 6 || p.y < 60 || p.y > innerHeight - 80 || signs.some((b) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom)) continue;
          if (building.getAttribute("data-graview-building") === "t-deposit") continue;
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
      for (let step = 0; step < 24 && !reached && target; step++) {
        reached = await page.evaluate(() => document.activeElement?.getAttribute("title") === "The week");
        if (reached) break;
        const way = await page.evaluate((goal) => {
          const at = document.activeElement?.getBoundingClientRect();
          if (!at) return "ArrowLeft";
          const dx = goal.x + goal.width / 2 - (at.left + at.width / 2);
          const dy = goal.y + goal.height / 2 - (at.top + at.height / 2);
          return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp";
        }, target.box);
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
    const start = first && from ? Math.hypot(first.box.x + first.box.width / 2 - (from.x + from.width / 2), first.box.y + first.box.height - (from.y + from.height)) : null;
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
 * stands out from what it is linked to — its own colour and lifted — the
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
    const lift = chosen ? new DOMMatrixReadOnly(getComputedStyle(chosen).transform === "none" ? undefined : getComputedStyle(chosen).transform).f : 0;
    const words = [...city.querySelectorAll(".graview-record-links, .graview-record-link-said")].filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none").length;
    const box = document.querySelector("[data-graview-connected-box]");
    const listed = [...(box?.querySelectorAll("[data-graview-record]") ?? [])].map((b) => b.getAttribute("data-graview-record"));
    const sheet = document.querySelector("[data-graview-one-place]");
    const shown = new Set([...sheet.querySelectorAll("[data-graview-pick], [data-graview-record], [data-record]")].filter((el) => !box?.contains(el)).map((el) => el.getAttribute("data-graview-pick") ?? el.getAttribute("data-graview-record") ?? el.getAttribute("data-record")));
    return { found: Boolean(chosen), roof: chosen ? roofOf(chosen) : null, sameRoof: others.filter((b) => roofOf(b) === (chosen ? roofOf(chosen) : "")).length, lift, words, listed, repeated: listed.filter((id) => shown.has(id)), sticky: box ? getComputedStyle(box).position : null };
  });
  seen.standsOut.push({ where, ...read, ok: read.found && read.sameRoof === 0 && read.lift < -2 });
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
  seen.crossing.push({ where, path: "/pages/tasks/t-book", pointed, ...crossing, ok: crossing.counted > 0 && crossing.crossed === 0 });
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
  await press(page, '[data-testid="altitude-key"]');
  await page.waitForTimeout(200);
  const caps = await page.evaluate(() => ({ caps: [0, 1, 2].map((n) => document.querySelector(`[data-testid="altitude-keycap-${n}"]`)?.textContent ?? null), listed: document.querySelector('[data-testid="altitude-key-keys"]')?.textContent ?? "" }));
  await press(page, '[data-testid="altitude-key"]');
  seen.shortcuts.push({ where, moves, named, caps, ok: moves.every((m) => m.reached) && named.every((n, i) => n.title?.includes(`· ${i + 1}`) && n.keys?.split(" ").includes(String(i + 1))) && caps.caps.join() === "1,2,3" && /1 Page/.test(caps.listed) });
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
  seen.small.push({ where, whole, mini, share: Number((mini.area / whole.area).toFixed(3)), ok: mini.area <= whole.area / 3 });
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
    const target = state === "whole" ? '[data-testid="altitude-stop-1"]' : '[data-testid="altitude-slider"]';
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
  return { where, states, ok: states.every((one) => one.hovered.said?.includes("1 Page") && one.hovered.shown > 0.9 && one.focused > 0.9 && one.legend) };
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

/* ------------------------------------------------------------------ */
/* The run                                                             */
/* ------------------------------------------------------------------ */

let browser;
const todo = await serving("todo", portFor("todo"), repoRoot);
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
      [seen.offSight, (page, where) => offSight(page, where)],
      [seen.sliderRun, (page, where) => slider(page, where)],
    ]);
    seen.switch.push(await rootIsTheOneFace(browser, { engine, device: "desk 1440×900" }).catch((error) => ({ ok: false, error: String(error?.message ?? error) })));
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
  report.checks.browserZoomKeysAreNotTaken = { held: seen.zoomKeys, ok: every(seen.zoomKeys) };
  report.checks.shortcutsDoNotFireInAField = { held: seen.inField, ok: every(seen.inField) };
  report.checks.theControlCollapsesToASliderNamingTheLevel = { held: seen.folds, ok: every(seen.folds) };
  report.checks.draggingTheSliderScrubsTheLevels = { held: seen.dragged, ok: every(seen.dragged) };
  report.checks.theCollapsedControlIsAtMostAThirdOfTheExpanded = { held: seen.small, ok: every(seen.small) };
  report.checks.theLegendAndTooltipsAreReachableInBothStates = { held: seen.legend, ok: every(seen.legend) };
  report.checks.theCollapsedChoiceIsKept = { held: seen.keptChoice, ok: every(seen.keptChoice) };
  report.checks.aDuplicateViewIsFound = { held: seen.duplicate, ok: every(seen.duplicate) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  todo.stop();
}

writeFileSync(resolve(repoRoot, "docs/one-face.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/one-face.json\n");
process.exit(report.passed ? 0 : 1);
