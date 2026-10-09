#!/usr/bin/env node
/**
 * THE EMBED'S CHROME, AS ONE FAMILY (FR-72, FR-75 – FR-78).
 *
 * Graview Cloud's staging found it: on a hosted app the profile menu opened
 * UNDER the seat's rail and could not be read. Each surface had picked its
 * own `z-index` in one stacking context. This drives every popover in the
 * framework's registry (`POPOVERS` in `@graview/react`) — not a list kept
 * here — on the embed's Graview and pages faces and on the whole-page
 * Shell, at a desk's width and a phone's, with the seat open, and asks the
 * browser what is actually under the middle of each pane and under its
 * last row.
 *
 * The embed is mounted the way a host mounts it: a page of the host's own
 * (a header, the app, a footer), built with esbuild from the workspace's
 * sources, serving the todo app's declaration and seed.
 *
 * And since that is the same app twice: the whole-page Shell and the embed
 * wear ONE bar on the scene — the same parts under the same test ids, one
 * row of at most 48 px at a desk and on a phone, in both schemes — and what
 * either face says to a person says a day as the glance does and a choice
 * as it is declared, never "2026-08-28" or "tue".
 *
 *   node scripts/verify-chrome.mjs [--engine=chromium|webkit|firefox] [--quick]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const QUICK = process.argv.includes("--quick");
const { POPOVERS } = await import(resolve(repoRoot, "packages/react/dist/popover.js"));

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const SIZES = QUICK ? [{ width: 1440, height: 900 }] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }];

/** The host's page: its own header and footer around the element the embed owns. */
const HOST_PAGE = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}header,footer{padding:8px 16px}#app{position:relative;height:calc(100vh - 80px)}</style></head>
<body><header><a href="/apps">Your apps</a></header><main><h1 style="position:absolute;left:-9999px">${title}</h1><div id="app"></div></main><footer>Hosted elsewhere</footer>
<script type="module" src="/entry.js"></script></body></html>`;

/** Builds the host's page: the embed over the todo app, as a product's bundler would. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-chrome-host-"));
  const todo = resolve(repoRoot, "apps/todo/src/index.ts");
  const seed = resolve(repoRoot, "apps/todo/src/data/example.json");
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { todoApp } from ${JSON.stringify(todo)};
        import seed from ${JSON.stringify(seed)};
        const asked = new URLSearchParams(location.search);
        const options = {
          app: todoApp,
          seed,
          face: asked.get("face") ?? "graview",
          principal: { kind: "human", id: "user-nora", roles: ["keeper"] },
          label: "Things",
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
          // Whether the seat's ask field is drawn, when the page asks.
          ...(asked.get("seat") ? { seat: asked.get("seat") } : {}),
          // A host's own actions, as Graview Cloud has them (FR-72).
          hostActions: [
            { label: "Change the app", href: "/apps/things/change" },
            { label: "Your apps", href: "/apps" },
            { label: "Report this app", href: "/report?app=things" },
          ],
        };
        window.__handle = mount(document.getElementById("app"), options);
        window.__handle.drawn().then(() => { window.__ready = true; });`,
      resolveDir: resolve(repoRoot, "packages/embed"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE("Things, on a host's page"));
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    if (!file.startsWith(out) || !existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
    response.end(readFileSync(file));
  });
  await new Promise((ready) => host.listen(portFor("chrome-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** Opens the seat from its ask field, so every popover is driven with it open over the picture. */
async function openTheSeat(page) {
  const state = () => page.evaluate(() => document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null);
  const was = await state();
  if (was === null || was === "open") return was;
  /*
   * On a phone the open seat is a bottom sheet over most of the picture —
   * the triggers under it (the folded districts, a card's acts) are covered
   * by design while it is up, and put away by its grab line. There the
   * popovers are driven with the seat's field closed at the foot.
   */
  if ((await page.getAttribute('[data-testid="seat"]', "data-graview-seat-shape")) === "phone") return was;
  await page.click('[data-testid="seat-field"]');
  await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(300);
  return state();
}

/** Opens one popover of the registry the way a person would; false when nothing here opens it. */
async function openOne(page, entry) {
  if (entry.opens === "context-menu") {
    const card = await page.evaluate(() => {
      for (const element of document.querySelectorAll(".graview-ground [data-graview-view]")) {
        const box = element.getBoundingClientRect();
        if (box.width < 20 || box.height < 20) continue;
        const x = box.left + box.width / 2;
        const y = box.top + Math.min(box.height / 2, 20);
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        if (element.contains(document.elementFromPoint(x, y))) return { x, y };
      }
      return null;
    });
    if (!card) return false;
    await page.mouse.click(card.x, card.y, { button: "right" });
  } else {
    const trigger = page.locator(`[data-testid="${entry.trigger}"]:visible`).first();
    if ((await trigger.count()) === 0 || !(await trigger.isEnabled())) return false;
    try {
      if (entry.opens === "typing") {
        // Reached the way the keys reach it, so no press on the box is pending when the harness presses away.
        await trigger.focus({ timeout: 3000 });
        await page.keyboard.type("a");
      } else await trigger.click({ timeout: 3000 });
    } catch {
      return false;
    }
  }
  try {
    await page.waitForSelector(`[data-testid="${entry.pane}"]:not([hidden])`, { timeout: 3000 });
    await page.waitForTimeout(150);
    return true;
  } catch {
    return false;
  }
}

/** What is under the pane's middle and under its last row, and whether it stands in the top layer. */
function standing(page, pane) {
  return page.evaluate((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (!element) return null;
    const inside = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return { at: hit ? `${hit.tagName.toLowerCase()}${hit.getAttribute("data-testid") ? `[${hit.getAttribute("data-testid")}]` : ""}` : null, inside: hit !== null && element.contains(hit) };
    };
    const box = element.getBoundingClientRect();
    const center = inside(box.left + box.width / 2, box.top + box.height / 2);
    const rows = [...element.querySelectorAll("li, button, a, input, select, [role=option], [role=menuitem], fieldset")].filter((row) => row.getBoundingClientRect().height > 0);
    const last = rows.at(-1);
    last?.scrollIntoView({ block: "nearest" });
    const lastBox = last?.getBoundingClientRect();
    const lastRow = lastBox ? inside(lastBox.left + Math.min(lastBox.width / 2, 40), lastBox.top + lastBox.height / 2) : { at: null, inside: true };
    const view = { width: document.documentElement.clientWidth, height: innerHeight };
    const after = element.getBoundingClientRect();
    return {
      topLayer: (() => {
        try {
          return element.matches(":popover-open");
        } catch {
          return false;
        }
      })(),
      center,
      lastRow,
      inTheViewport: after.left >= -1 && after.top >= -1 && after.right <= view.width + 1 && after.bottom <= view.height + 1,
      box: [Math.round(after.left), Math.round(after.top), Math.round(after.width), Math.round(after.height)],
    };
  }, pane);
}

/** Closes whatever is open: Escape, then a press on the trigger if it stayed. */
async function closeAll(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  const still = await page.evaluate(() => [...document.querySelectorAll("[popover]")].filter((one) => one.matches(":popover-open")).length);
  if (still > 0) {
    await page.mouse.click(2, 2);
    await page.waitForTimeout(120);
  }
}

/** Whether a popover's pane is open: drawn, not hidden, and in the top layer. */
function isOpen(page, entry) {
  return page.evaluate((testId) => {
    const pane = document.querySelector(`[data-testid="${testId}"]`);
    if (!pane || pane.hidden || pane.getBoundingClientRect().height === 0) return false;
    try {
      return pane.matches(":popover-open");
    } catch {
      return true;
    }
  }, entry.pane);
}

/** Where the keyboard is, said against a popover: in its pane, on its trigger, on a card (the acts' way back), or elsewhere. */
function keyboardAt(page, entry) {
  return page.evaluate(({ pane, trigger }) => {
    const active = document.activeElement;
    const element = document.querySelector(`[data-testid="${pane}"]`);
    return {
      inPane: element !== null && element.contains(active),
      onTrigger: trigger !== null && active?.getAttribute("data-testid") === trigger,
      onCard: active?.closest?.("[data-graview-view]") !== null && active?.closest?.("[data-graview-view]") !== undefined,
      onBody: active === null || active === document.body,
      at: active ? `${active.tagName.toLowerCase()}${active.getAttribute("data-testid") ? `[${active.getAttribute("data-testid")}]` : ""}` : null,
    };
  }, { pane: entry.pane, trigger: entry.trigger });
}

/** A point on the page that is no control, no card and no popover: somewhere a press is "away". */
function bareGround(page) {
  return page.evaluate(() => {
    const busy = "button, a, input, select, textarea, summary, label, [tabindex], [popover], [data-graview-view], [role=dialog]";
    for (const y of [6, 14, 24, 36, 48]) {
      for (let x = Math.round(innerWidth * 0.5); x < innerWidth - 4; x += 13) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !hit.closest(busy)) return { x, y };
      }
      for (let x = Math.round(innerWidth * 0.5); x > 4; x -= 13) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !hit.closest(busy)) return { x, y };
      }
    }
    return { x: 2, y: 2 };
  });
}

/** How far the pane hangs from what opened it: the gap between the trigger's edge and the pane's, above or below. */
function hanging(page, entry) {
  return page.evaluate(({ pane, trigger }) => {
    const element = document.querySelector(`[data-testid="${pane}"]`);
    const from = trigger ? document.querySelector(`[data-testid="${trigger}"]`) : null;
    if (!element || !from) return null;
    const p = element.getBoundingClientRect();
    const t = from.getBoundingClientRect();
    const gap = p.top >= t.bottom - 1 ? p.top - t.bottom : t.top - p.bottom;
    const overlapsAcross = p.right > t.left - 1 && p.left < t.right + 1;
    return { gap: Math.round(gap), overlapsAcross, below: p.top >= t.bottom - 1 };
  }, { pane: entry.pane, trigger: entry.trigger });
}

/**
 * Every popover of the registry this page draws, opened and asked of the
 * browser: what is on top (FR-76), then the family's habits (FR-77).
 */
async function everyPopoverOn(page, where, size, seen) {
  const results = {};
  const drawn = [];
  for (const [name, entry] of Object.entries(POPOVERS)) {
    if (!(await openOne(page, entry))) {
      results[name] = { drawn: false };
      continue;
    }
    drawn.push(name);
    const said = await standing(page, entry.pane);
    const ok = said !== null && said.topLayer && said.center.inside && said.lastRow.inside && said.inTheViewport;
    /* FR-77: the keyboard goes in on open (a combobox's stays in its box), and it hangs from its trigger. */
    const opened = await keyboardAt(page, entry);
    const tookTheKeyboard = entry.focus === "into" ? opened.inPane : opened.onTrigger;
    const hangs = await hanging(page, entry);
    const anchored = entry.trigger === null ? true : hangs !== null && hangs.gap <= 12 && hangs.overlapsAcross;
    /* Escape closes it and the keyboard goes back. */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const escaped = { open: await isOpen(page, entry), keyboard: await keyboardAt(page, entry) };
    const backAfterEscape = entry.trigger === null ? escaped.keyboard.onCard : escaped.keyboard.onTrigger;
    /* A press on bare ground closes it, and the keyboard goes back (a combobox's goes where the press put it). */
    let away = { open: true, keyboard: null };
    /*
     * A combobox's box: after an Escape the Shell gives the keyboard back to
     * the box it was in for a moment (`useTheKeyboardLandsSomewhere`), which
     * would open its list again; the press away is made once that is over.
     */
    if (entry.focus !== "into") await page.waitForTimeout(2700);
    if (await openOne(page, entry)) {
      const ground = await bareGround(page);
      await page.mouse.click(ground.x, ground.y);
      await page.waitForTimeout(200);
      away = { open: await isOpen(page, entry), keyboard: await keyboardAt(page, entry), at: ground };
    }
    const backAfterAway = entry.focus !== "into" ? true : entry.trigger === null ? away.keyboard?.onCard === true : away.keyboard?.onTrigger === true;
    const family = {
      tookTheKeyboard,
      anchored,
      escapeCloses: !escaped.open,
      escapeGivesTheKeyboardBack: backAfterEscape,
      aPressAwayCloses: !away.open,
      aPressAwayGivesTheKeyboardBack: backAfterAway,
    };
    results[name] = { drawn: true, ...said, ok, opened, hangs, escaped, away, family, familyOk: Object.values(family).every(Boolean) };
    (seen[name] ??= []).push(`${where} ${size.width}×${size.height}`);
    await closeAll(page);
  }
  /* Opening one closes any other: each drawn popover opened while the one before it is open. */
  for (const [index, name] of drawn.entries()) {
    const before = drawn[(index + drawn.length - 1) % drawn.length];
    if (before === name) continue;
    if (!(await openOne(page, POPOVERS[before]))) continue;
    if (!(await openOne(page, POPOVERS[name]))) continue;
    const both = { [before]: await isOpen(page, POPOVERS[before]), [name]: await isOpen(page, POPOVERS[name]) };
    results[name].closesTheOneBefore = { before, ...both, ok: both[name] && !both[before] };
    results[name].familyOk = results[name].familyOk && results[name].closesTheOneBefore.ok;
    await closeAll(page);
  }
  return results;
}

/** The host's actions in the profile menu, reached from the keyboard alone, and readable in the scheme the embed wears. */
async function hostActionsByKeyboard(page) {
  await page.locator('[data-testid="profile-button"]:visible').first().focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="profile"]:not([hidden])', { timeout: 3000 });
  const reached = [];
  for (let presses = 0; presses < 40 && reached.length < 3; presses++) {
    const at = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.getAttribute("data-testid") === "host-action" ? active.textContent : null;
    });
    if (at && !reached.includes(at)) reached.push(at);
    if (reached.length < 3) await page.keyboard.press("Tab");
  }
  const looks = await page.evaluate(() => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const pane = document.querySelector('[data-testid="profile"]');
    const link = pane.querySelector('[data-testid="host-action"]');
    const ink = luminance(getComputedStyle(link).color);
    // The floating panel is a gradient: its first stop is the ground the words stand on.
    const style = getComputedStyle(pane);
    const painted = /rgba?\([^)]*\)/.exec(style.backgroundImage)?.[0];
    const ground = luminance(style.backgroundColor === "rgba(0, 0, 0, 0)" && painted ? painted : style.backgroundColor);
    const [light, dark] = ink > ground ? [ink, ground] : [ground, ink];
    return {
      scheme: pane.closest("[data-graview-scheme]")?.getAttribute("data-graview-scheme") ?? null,
      contrast: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
      inThePane: [...pane.querySelectorAll('[data-testid="host-action"]')].map((one) => [one.textContent, one.getAttribute("href")]),
    };
  });
  /* Nothing of the host's stands over the embed: no fixed element outside it covers any of its box. */
  const overTheScene = await page.evaluate(() => {
    const root = document.querySelector("[data-graview-embed]");
    const box = root.getBoundingClientRect();
    return [...document.body.querySelectorAll("*")]
      .filter((one) => !root.contains(one) && getComputedStyle(one).position === "fixed")
      .filter((one) => {
        const at = one.getBoundingClientRect();
        return at.width > 0 && at.right > box.left && at.left < box.right && at.bottom > box.top && at.top < box.bottom;
      })
      .map((one) => one.tagName.toLowerCase());
  });
  await page.keyboard.press("Escape");
  return { reached, ...looks, overTheScene };
}

/** The scene's box, the frame it stands in, the seat at its foot and where the city's leftmost card starts. */
function picture(page) {
  return page.evaluate(() => {
    const ground = document.querySelector(".graview-ground");
    const seat = document.querySelector('[data-testid="seat"]');
    const frame = ground?.parentElement;
    const box = ground?.getBoundingClientRect();
    const at = seat?.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".graview-ground [data-graview-view]")].map((card) => card.getBoundingClientRect()).filter((one) => one.width > 0);
    return {
      frameWidth: Math.round(frame?.getBoundingClientRect().width ?? 0),
      sceneWidth: Math.round(box?.width ?? 0),
      state: seat?.getAttribute("data-graview-seat") ?? null,
      side: seat?.getAttribute("data-graview-seat-side") ?? null,
      fromLeft: at && box ? Math.round(at.left - box.left) : null,
      fromRight: at && box ? Math.round(box.right - at.right) : null,
      keyboard: document.activeElement?.getAttribute("data-testid") ?? null,
      firstCard: box && cards.length > 0 ? Math.round(Math.min(...cards.map((one) => one.left)) - box.left) : null,
    };
  });
}

/*
 * THE SEAT FLOATS, AND THE PICTURE KEEPS ITS WIDTH (FR-78, restated). The
 * seat was a rail that took a fifth of the picture, put away to a slim tab
 * that still took 36 pixels; it is an ask field at the picture's foot now,
 * that opens over the picture and is snapped between the two feet by ⇄.
 * Held here: opening it moves no card, ⇄ from the keyboard moves it to the
 * other foot and the tab's choice is kept across a reload, and a host can
 * leave it out with the picture keeping every pixel.
 */
async function theSeatSnapsAndHides(newPage, readyOf) {
  const said = {};
  const visit = async (page, url, ready) => {
    await page.goto(url, { waitUntil: "load" });
    await ready(page);
    await page.waitForTimeout(900);
  };
  for (const [where, url, ready] of [
    ["the embed's Graview", `${at("chrome-host")}/?face=graview`, readyOf.embed],
    ["the Shell", `${at("todo")}/?today=2026-09-01&fresh=1`, readyOf.shell],
  ]) {
    const page = await newPage({ width: 1440, height: 900 });
    await visit(page, url, ready);
    const closed = await picture(page);
    await page.locator('[data-testid="seat-field"]').focus();
    await page.keyboard.type("a");
    await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const opened = await picture(page);
    await page.locator('[data-testid="seat-side"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const snapped = await picture(page);
    await visit(page, url, ready);
    const afterAReload = await picture(page);
    await page.close();
    said[where] = {
      closed,
      opened,
      snapped,
      afterAReload,
      ok:
        closed.state === "closed" && closed.side === "left" && closed.fromLeft !== null && closed.fromLeft <= 20 &&
        closed.sceneWidth === closed.frameWidth &&
        opened.state === "open" && opened.firstCard === closed.firstCard && opened.sceneWidth === closed.sceneWidth &&
        snapped.side === "right" && snapped.fromRight !== null && snapped.fromRight <= 20 && snapped.keyboard === "seat-side" &&
        afterAReload.side === "right",
    };
  }
  /* Narrower than a laptop the picture still keeps its whole width: there is no rail to lay over it. */
  {
    const page = await newPage({ width: 820, height: 900 });
    await visit(page, `${at("chrome-host")}/?face=graview`, readyOf.embed);
    const narrow = await picture(page);
    await page.close();
    said.thePictureKeepsItsWidthBelowALaptop = { narrow, ok: narrow.state === "closed" && narrow.sceneWidth === narrow.frameWidth };
  }
  /* The host's choice: no seat at all. */
  {
    const page = await newPage({ width: 1440, height: 900 });
    await visit(page, `${at("chrome-host")}/?face=graview&seat=hidden`, readyOf.embed);
    const started = await picture(page);
    await page.close();
    said["startedAs-hidden"] = { started, ok: started.state === null && started.sceneWidth === started.frameWidth };
  }
  return said;
}

/** A notice as the browser draws it: in the top layer, in the viewport, on top at its middle, in the floating panel, readable. */
function noticeLooks(page, kind) {
  return page.evaluate((testId) => {
    const stack = document.querySelector(`[data-testid="${testId}"]`);
    const card = stack?.querySelector('[data-testid="notice"]');
    if (!stack || !card) return null;
    const box = card.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const style = getComputedStyle(card);
    const painted = /rgba?\([^)]*\)/.exec(style.backgroundImage)?.[0] ?? style.backgroundColor;
    const ink = luminance(getComputedStyle(card.querySelector("span:nth-of-type(2)")).color);
    const ground = luminance(painted);
    const [light, dark] = ink > ground ? [ink, ground] : [ground, ink];
    return {
      topLayer: stack.matches(":popover-open"),
      onTop: hit !== null && card.contains(hit),
      inTheViewport: box.left >= 0 && box.top >= 0 && box.right <= document.documentElement.clientWidth && box.bottom <= innerHeight,
      // The float surface, filled and cast: a gradient once, a flat fill since the design kit's revision 03.
      floatingPanel: (style.backgroundImage.includes("gradient") || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor)) && style.boxShadow !== "none",
      contrast: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
      text: card.textContent,
    };
  }, kind === "toast" ? "notices-toasts" : "notices-banners");
}

/** Whether the toast stands over the popover that is open, laid over the middle of it. */
function toastOverThePopover(page, pane) {
  return page.evaluate((testId) => {
    const popover = document.querySelector(`[data-testid="${testId}"]`);
    const stack = document.querySelector('[data-testid="notices-toasts"]');
    if (!popover || !stack) return null;
    const at = popover.getBoundingClientRect();
    // Moved, not restacked: where it stands in the top layer is what is asked.
    stack.style.bottom = "auto";
    stack.style.top = `${Math.round(at.top + at.height / 2 - 10)}px`;
    // Centered on the pane, and kept on the screen: on a phone the pane hangs from the person at the bar's right (FR-131).
    stack.style.left = `${Math.max(4, Math.round(at.left + at.width / 2 - stack.getBoundingClientRect().width / 2))}px`;
    const card = stack.querySelector('[data-testid="notice"]').getBoundingClientRect();
    const hit = document.elementFromPoint(card.left + card.width / 2, card.top + Math.min(card.height / 2, 12));
    return stack.contains(hit);
  }, pane);
}

/** The host's notices, said through the handle: drawn, on top, aloud, gone or kept, changed in place, over a popover opened after them. */
async function theHostsNotices(page) {
  const said = {};
  await page.evaluate(() => {
    window.__newer = window.__handle.notify({ kind: "banner", id: "newer", sentence: "A newer version is available — reload when convenient.", tone: "info", action: { label: "Reload", href: "#" } });
    window.__handle.notify({ kind: "toast", sentence: "The app was changed — now version 4", tone: "good" });
  });
  await page.waitForTimeout(250);
  said.banner = await noticeLooks(page, "banner");
  said.toast = await noticeLooks(page, "toast");
  said.aloud = await page.evaluate(() => document.querySelector('[data-testid="notices-said"]')?.textContent ?? null);
  /* A popover opened after the toast: the toast keeps the top rung. */
  await page.locator('[data-testid="profile-button"]:visible').first().click();
  await page.waitForTimeout(250);
  said.overTheProfile = await toastOverThePopover(page, "profile");
  await page.keyboard.press("Escape");
  /* A toast goes by itself; a banner stays, and changes in place. */
  await page.waitForTimeout(6500);
  said.toastGone = await page.evaluate(() => document.querySelector('[data-testid="notices-toasts"] [data-testid="notice"]') === null);
  said.bannerStays = await page.evaluate(() => document.querySelector('[data-testid="notices-banners"] [data-testid="notice"]') !== null);
  await page.evaluate(() => window.__newer.update({ sentence: "Offline — changes will be sent when you reconnect.", tone: "warn" }));
  await page.waitForTimeout(200);
  said.changedInPlace = await page.evaluate(() => {
    const one = [...document.querySelectorAll('[data-testid="notices-banners"] [data-testid="notice"]')];
    return one.length === 1 && one[0].getAttribute("data-tone") === "warn" && one[0].textContent.includes("Offline");
  });
  /* A bad one is an alert. */
  await page.evaluate(() => window.__handle.notify({ kind: "toast", sentence: "That change was refused.", tone: "bad" }));
  await page.waitForTimeout(250);
  said.alarm = await page.evaluate(() => document.querySelector('[data-testid="notices-alarm"]')?.textContent ?? null);
  await page.evaluate(() => window.__newer.dismiss());
  await page.waitForTimeout(150);
  said.cleared = await page.evaluate(() => document.querySelector('[data-testid="notices-banners"]') === null);
  return said;
}

let browser;
const todo = await serving("todo", portFor("todo"), repoRoot);
const host = await buildHost();
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const errors = [];
  const seen = {};
  const faces = {};
  const hosts = {};
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size });
    page.on("pageerror", (error) => errors.push(error.message));
    const places = [
      { where: "the embed's Graview", url: `${at("chrome-host")}/?face=graview`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the embed's pages", url: `${at("chrome-host")}/?face=pages`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the Shell", url: `${at("todo")}/?today=2026-09-01&fresh=1`, ready: () => page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 }) },
    ];
    for (const place of places) {
      await page.goto(place.url, { waitUntil: "load" });
      await place.ready();
      await page.waitForTimeout(900);
      const seat = await openTheSeat(page);
      faces[`${place.where} ${size.width}×${size.height}`] = { seat, popovers: await everyPopoverOn(page, place.where, size, seen) };
      /* ---- FR-72: the host's actions, by keyboard, in both schemes */
      if (place.url.startsWith(at("chrome-host"))) {
        for (const colorScheme of ["light", "dark"]) {
          await page.emulateMedia({ colorScheme });
          await page.waitForTimeout(250);
          hosts[`${place.where} ${size.width}×${size.height} ${colorScheme}`] = { colorScheme, ...(await hostActionsByKeyboard(page)) };
        }
        await page.emulateMedia({ colorScheme: null });
      }
    }
    await page.close();
  }

  /* ---- FR-76: every popover drawn stands over everything, middle and last row */
  const failures = Object.entries(faces).flatMap(([where, one]) =>
    Object.entries(one.popovers)
      .filter(([, said]) => said.drawn && !said.ok)
      .map(([name, said]) => `${name} on ${where}: ${JSON.stringify(said)}`),
  );
  report.checks.everyPopoverStandsOverEverythingWithTheSeatOpen = { faces, failures, ok: failures.length === 0 };
  /* ---- FR-77: every popover drawn keeps the family's habits */
  const strays = Object.entries(faces).flatMap(([where, one]) =>
    Object.entries(one.popovers)
      .filter(([, said]) => said.drawn && !said.familyOk)
      .map(([name, said]) => `${name} on ${where}: ${JSON.stringify({ family: said.family, closesTheOneBefore: said.closesTheOneBefore, opened: said.opened, escaped: said.escaped, away: said.away, hangs: said.hangs })}`),
  );
  report.checks.everyPopoverBehavesAsOneFamily = { strays, ok: strays.length === 0 };
  /* Every popover a face draws was opened somewhere: the registry is the list, so a new one is driven without anybody adding it here. */
  const unseen = Object.entries(POPOVERS)
    .filter(([name, entry]) => entry.drawn.some((face) => face === "shell" || face === "embed") && !seen[name])
    .map(([name]) => name);
  report.checks.everyPopoverAFaceDrawsWasOpened = { seen, unseen, quick: QUICK, ok: unseen.length === 0 || QUICK };
  /* ---- FR-75: a host speaks in the app's own notices */
  {
    const notices = {};
    for (const size of SIZES) {
      for (const colorScheme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: size, colorScheme });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${at("chrome-host")}/?face=graview`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(900);
        await openTheSeat(page);
        const said = await theHostsNotices(page);
        await page.close();
        const drawn = (one) => one !== null && one.topLayer && one.onTop && one.inTheViewport && one.floatingPanel && one.contrast >= 4.5;
        notices[`${size.width}×${size.height} ${colorScheme}`] = {
          ...said,
          ok: drawn(said.banner) && drawn(said.toast) && said.aloud === "The app was changed — now version 4" && said.overTheProfile === true && said.toastGone && said.bannerStays && said.changedInPlace && said.alarm === "That change was refused." && said.cleared,
        };
      }
    }
    report.checks.aHostSpeaksInTheAppsOwnNotices = { ...notices, ok: Object.values(notices).every((one) => one.ok) };
  }
  /* ---- One bar on the scene, the whole-page Shell's and the embed's: the same parts under the same ids, one row */
  {
    const bars = {};
    const readBar = (page) =>
      page.evaluate(() => {
        const bar = document.querySelector('[data-testid="app-bar"]');
        if (!bar) return null;
        // The bar's own parts: not what its panes hold (the person's menu holds what the host and the app put there) nor what Activity holds.
        const ids = [...bar.querySelectorAll("[data-testid]")].filter((el) => !el.closest('[data-testid="profile"], .graview-bar-own')).map((el) => el.getAttribute("data-testid"));
        const row = bar.getBoundingClientRect();
        const parts = [...bar.querySelectorAll(".graview-bar-row > *, .graview-bar-tools > *, .graview-bar-own > *")].filter((el) => el.getBoundingClientRect().width > 0);
        return {
          // The places stand or fold by the room and by the one you are on; the rest of the bar is the same bar.
          ids: ids.filter((id) => !id.startsWith("app-place") && id !== "activity-button"),
          places: [...document.querySelectorAll('[data-testid^="app-place-scene:"]')].map((el) => el.getAttribute("data-place-path")).sort(),
          activity: bar.querySelector('[data-testid="activity-button"]') !== null,
          activityBeforeStanding: (() => {
            const all = [...bar.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
            return !all.includes("activity-button") || all.indexOf("activity-button") < all.indexOf("standing");
          })(),
          height: Math.round(row.height),
          oneRow: parts.every((el) => { const box = el.getBoundingClientRect(); return box.top >= row.top - 1 && box.bottom <= row.bottom + 1; }),
          oldBar: ["wordmark", "backtrack", "pages-link", "places"].filter((id) => document.querySelector(`[data-testid="${id}"]`) !== null),
        };
      });
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      for (const colorScheme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: size, colorScheme });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
        await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
        await page.waitForTimeout(900);
        const shell = await readBar(page);
        await page.goto(`${at("chrome-host")}/?face=graview`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(900);
        const embed = await readBar(page);
        await page.close();
        // The places are each app's registry's (the Shell's todo registers its own lenses), so they are said, not compared.
        const same = shell !== null && embed !== null && JSON.stringify(shell.ids) === JSON.stringify(embed.ids);
        bars[`${size.width}×${size.height} ${colorScheme}`] = {
          shell,
          embed,
          ok: same && [shell, embed].every((one) => one.height <= 48 && one.oneRow && one.oldBar.length === 0 && one.activityBeforeStanding && one.places.length > 0),
        };
      }
    }
    report.checks.theShellAndAnEmbedWearOneBarOnTheScene = { ...bars, ok: Object.values(bars).every((one) => one.ok) };
  }
  /* ---- A day said as the glance says it, and a choice as it is declared: in the problems, and on a record's page */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(900);
    await page.click('[data-testid="standing"]');
    await page.waitForSelector('[data-testid="problems"]', { timeout: 10_000 });
    await page.waitForTimeout(400);
    const problems = await page.evaluate(() => document.querySelector('[data-testid="problems"]')?.innerText ?? "");
    await page.goto(`${at("todo")}/pages/tasks/t-deposit?today=2026-09-01`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const record = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      // What is read, not what is edited: the values as drawn, outside any edit control.
      const said = [...main.querySelectorAll("dd")].map((dd) => dd.innerText.trim());
      return { said, text: main.innerText };
    });
    await page.close();
    const iso = /(?<![\w-])\d{4}-\d{2}-\d{2}(?![\w-])/;
    const raw = /^(mon|tue|wed|thu|fri|sat|sun)$/;
    report.checks.aSentenceSaysADayAndAChoiceAsAPersonReadsThem = {
      problems: problems.slice(0, 400),
      record,
      ok: problems.length > 0 && !iso.test(problems) && /\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/.test(problems) && !iso.test(record.text) && record.said.length > 0 && !record.said.some((one) => raw.test(one)) && record.said.includes("Tue"),
    };
  }
  /* ---- FR-78, restated: the seat floats at the foot, snaps between the feet, and can be left out */
  const seat = await theSeatSnapsAndHides(
    async (viewport) => {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (error) => errors.push(error.message));
      return page;
    },
    {
      embed: (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }),
      shell: (page) => page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 }),
    },
  );
  report.checks.theSeatFloatsSnapsAndCanBeLeftOut = { ...seat, ok: Object.values(seat).every((one) => one.ok) };
  /* ---- FR-72: a host's own actions are in the profile menu, reached by the keyboard, readable in both schemes, with nothing of the host's over the scene */
  const wanted = ["Change the app", "Your apps", "Report this app"];
  const astray = Object.entries(hosts)
    .filter(([, said]) => JSON.stringify(said.reached) !== JSON.stringify(wanted) || said.scheme !== said.colorScheme || said.contrast < 4.5 || said.overTheScene.length > 0)
    .map(([where, said]) => `${where}: ${JSON.stringify(said)}`);
  report.checks.aHostsActionsAreInTheProfileByKeyboardInBothSchemes = { hosts, astray, ok: Object.keys(hosts).length > 0 && astray.length === 0 };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  todo.stop();
  host.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/chrome.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/chrome.json\n");
process.exit(report.passed ? 0 : 1);
