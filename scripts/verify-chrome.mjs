#!/usr/bin/env node
/**
 * THE EMBED'S CHROME, AS ONE FAMILY (FR-72, FR-75 – FR-78).
 *
 * Graview Cloud's staging found it: on a hosted app the profile menu opened
 * UNDER the seat's rail and could not be read. Each surface had picked its
 * own `z-index` in one stacking context. This drives every popover in the
 * framework's registry (`POPOVERS` in `@graview/react`) — not a list kept
 * here — on the embed's Graview and pages faces and on the whole-page
 * Shell, at a desk's width and a phone's, and asks the
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
 * And what the app's own actor did and suggests is said on the todo
 * example's bar: with `tidy=1` a test actor ("Graview, tidying",
 * `automated`) makes two links it is sure of and suggests one it is not, so
 * Activity folds its run into one digest row that opens to each change with
 * its lineage, and the Suggested tray beside it holds the third until a
 * person declines it — which the actor is refused next time. With
 * `reader=1` the page is a seat that may see the suggestion and may not
 * make it, whose Accept is a vote (f-suggestion-votes); with `vote=1` a
 * reader's vote is already cast when the keeper opens the tray; with
 * `signedOut=1` the reader is the host's one shared signed-out seat, with
 * the host's way in (f-votes-shared-seat).
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
import { serving, vacant } from "./lib/serve.mjs";
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
        import { capabilities, memoryViews } from "@graview/core";
        import { declined, suggest, suggestions, voteSuggestion } from "@graview/core/tidying";
        import { todoApp } from ${JSON.stringify(todo)};
        import seed from ${JSON.stringify(seed)};
        const asked = new URLSearchParams(location.search);
        const options = {
          app: todoApp,
          seed,
          face: asked.get("face") ?? "graview",
          principal: { kind: "human", id: "user-nora", roles: ["keeper"] },
          /*
           * A reader who may see a suggestion and may not make the change, when the page asks (f-suggestion-votes): the list's grant to
           * everybody dropped from the policy, and a seat with no role — a visitor by link, as a host would seat one.
           */
          ...(asked.get("reader") ? { app: { ...todoApp, policy: { ...todoApp.policy, grants: todoApp.policy.grants.filter((grant) => grant.roles !== "*") } }, principal: { kind: "human", id: "user-vis", name: "Vis", roles: [] } } : {}),
          /*
           * The host's one shared signed-out seat, when the page asks (f-votes-shared-seat): every stranger served as one "anonymous",
           * marked shared, and the host's way in — what the tray offers in place of a vote the store would refuse.
           */
          ...(asked.get("signedOut")
            ? {
                app: { ...todoApp, policy: { ...todoApp.policy, grants: todoApp.policy.grants.filter((grant) => grant.roles !== "*") } },
                principal: { kind: "human", id: "anonymous", roles: [], shared: true },
                signIn: { label: "Sign in to make changes", run: () => { window.__signedIn = (window.__signedIn ?? 0) + 1; } },
              }
            : {}),
          label: "Things",
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
          // What the app's own actor did while the reader was away, as a host that ran whileAway() hands it, when the page asks.
          ...(asked.get("away") ? { whileAway: { tidied: 2, waiting: 1 } } : {}),
          // Whether the quick ask is drawn, when the page asks.
          ...(asked.get("quickAsk") ? { quickAsk: asked.get("quickAsk") !== "false" } : {}),
          // The page the routed face opens on, when the page asks.
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          // A host that refuses every change to the declaration, when the page asks: the framework says so in a toast of its own (FR-237).
          ...(asked.get("refuse")
            ? { keptViews: memoryViews({ may: { views: true, lenses: true }, declaration: { change: () => Promise.reject(new Error("The app could not be changed: the host is holding it while a repair is checked.")), restore() {} } }) }
            : {}),
          // The host's Report this (FR-237), when the page asks: what it is handed is kept for the claim.
          ...(asked.get("report") ? { onReport: (report) => { (window.__reports ??= []).push(report); } } : {}),
          /*
           * Somebody else here, when the page asks: Sam, on the whole thing, held as a socket holds a presence — so the bar
           * draws who is here (FR-155) and its list is opened with the rest of the family.
           */
          ...(asked.get("company") ? { presence: { here() {}, leave() {}, onWho(listener) { listener([{ participant: "human:user-sam:tab", kind: "human", name: "Sam", hue: 200, stop: "#overview=1", at: new Date().toISOString(), held: "socket" }]); return () => undefined; } } } : {}),
          // A host's own actions, as Graview Cloud has them (FR-72).
          hostActions: [
            { label: "Change the app", href: "/apps/things/change" },
            { label: "Your apps", href: "/apps" },
            { label: "Report this app", href: "/report?app=things" },
          ],
          // A host's buttons on the bar itself (FR-227): Cloud's "Send feedback", one tap from the reader.
          barActions: [
            { label: "Send feedback", icon: "✉", onSelect: () => { window.__feedback = (window.__feedback ?? 0) + 1; } },
            { label: "Share", onSelect: () => {} },
          ],
        };
        window.__handle = mount(document.getElementById("app"), options);
        // What reads the suggestions back, for the claims that ask the store what a person declined, and casts a vote as somebody else.
        window.__tidying = { declined, suggestions, voteSuggestion };
        // The framework's version, as a host's Report this is handed it (FR-237).
        window.__version = capabilities().version;
        /*
         * The app's own actor tidied, when the page asks: two links it is sure of, made with their lineage, and one it is not, suggested.
         * Its run is one row of Activity, and the suggestion waits in the Suggested tray beside it.
         */
        if (asked.get("tidy")) {
          const store = window.__handle.store;
          const actor = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
          store.apply({ name: "wait-for", args: { taskId: "t-paint", blockerId: "t-shelves" } }, { author: actor, lineage: { basis: "The shelves cover the wall that needs paint", confidence: 0.93 } });
          store.apply({ name: "wait-for", args: { taskId: "t-broadband", blockerId: "t-notice" } }, { author: actor, lineage: { basis: "The broadband moves with the notice date", confidence: 0.9 } });
          suggest(store, [{ name: "wait-for", args: { taskId: "t-post", blockerId: "t-notice" } }], { author: actor, lineage: { basis: "The post is redirected from the day notice is given", confidence: 0.45 } });
          // A reader's vote for it already cast, when the page asks (f-suggestion-votes): what the keeper reads beside Accept.
          if (asked.get("vote")) voteSuggestion(store, suggestions(store)[0].id, "for", { author: { kind: "human", id: "user-vis", name: "Vis", roles: [] } });
        }
        /*
         * A workflow's run asked about as one, when the page asks (f-job-approvals): three tasks to archive in one suggestion, said
         * as one, each change its own sentence — what a workflow whose approve is "ask" leaves in the tray.
         */
        if (asked.get("run")) {
          const store = window.__handle.store;
          const actor = { kind: "system", id: "workflow:tidy", name: "Set aside finished tasks", automated: true };
          suggest(store, ["t-paint", "t-shelves", "t-broadband"].map((id) => ({ name: "archive-task", args: { id } })), { author: actor, lineage: { basis: "Finished a week ago", run: "workflow:tidy:2026-10-28", actor: "workflow:tidy" }, intent: "Set aside finished tasks: 3 tasks to archive" });
        }
        /*
         * A crowded tray, when the page asks: a task renamed to 120 characters with no space, and a suggestion for each task it could
         * wait for, each based on a sentence that names it — as Threat Watch's seventeen named "@tanstack/react-router".
         */
        if (asked.get("crowd")) {
          const store = window.__handle.store;
          const actor = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
          const long = "@tanstack/" + "react_router_devtools_".repeat(6);
          store.apply({ name: "rename", args: { id: "t-keys", label: long.slice(0, 120) } }, { author: options.principal });
          for (const node of store.graph.nodesOfKind("task")) {
            if (node.id === "t-keys") continue;
            try {
              suggest(store, [{ name: "wait-for", args: { taskId: "t-keys", blockerId: node.id } }], { author: actor, lineage: { basis: long + " shares a scope with " + node.id, confidence: 0.6 } });
            } catch {}
          }
        }
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
  await vacant(portFor("chrome-host"));
  await new Promise((ready) => host.listen(portFor("chrome-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** Whether an Ask box is drawn anywhere on the page: none is, since the quick ask replaced it (Roadmap f-quick-ask-framework). */
async function anAskBox(page) {
  return page.evaluate(() => document.querySelector('[data-testid="seat-field"], [data-testid="seat"], [data-testid="page-seat"]') !== null);
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

/** The scene's box, the frame it stands in, and whether an Ask box or a quick ask is drawn. */
function picture(page) {
  return page.evaluate(() => {
    const ground = document.querySelector(".graview-ground");
    const frame = ground?.parentElement;
    const box = ground?.getBoundingClientRect();
    return {
      frameWidth: Math.round(frame?.getBoundingClientRect().width ?? 0),
      sceneWidth: Math.round(box?.width ?? 0),
      askBox: document.querySelector('[data-testid="seat-field"], [data-testid="seat"]') !== null,
      quickAsk: document.querySelector("[data-graview-quick-ask]") !== null,
    };
  });
}

/*
 * THE PICTURE KEEPS ITS WIDTH, AND NO ASK BOX STANDS ON IT (FR-78, restated
 * for Roadmap f-quick-ask-framework). The seat was a rail that took a fifth
 * of the picture, then an ask field at its foot; neither is drawn now: the
 * quick ask opens beside what it is about when ⌘K asks for it. Held here:
 * the picture is its frame's whole width at a desk and below a laptop, no
 * Ask box is drawn, and a host's `quickAsk: false` draws no quick ask.
 */
async function thePictureKeepsItsWidth(newPage, readyOf) {
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
    const drawn = await picture(page);
    await page.close();
    said[where] = { drawn, ok: !drawn.askBox && drawn.sceneWidth === drawn.frameWidth };
  }
  /* Narrower than a laptop the picture still keeps its whole width: there is no rail to lay over it. */
  {
    const page = await newPage({ width: 820, height: 900 });
    await visit(page, `${at("chrome-host")}/?face=graview`, readyOf.embed);
    const narrow = await picture(page);
    await page.close();
    said.thePictureKeepsItsWidthBelowALaptop = { narrow, ok: !narrow.askBox && narrow.sceneWidth === narrow.frameWidth };
  }
  /* The host's choice: no quick ask at all. */
  {
    const page = await newPage({ width: 1440, height: 900 });
    await visit(page, `${at("chrome-host")}/?face=graview&quickAsk=false`, readyOf.embed);
    const started = await picture(page);
    await page.close();
    said.startedWithoutTheQuickAsk = { started, ok: !started.quickAsk && !started.askBox && started.sceneWidth === started.frameWidth };
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
      { where: "the embed's Graview", url: `${at("chrome-host")}/?face=graview&company=1&tidy=1`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the embed's pages", url: `${at("chrome-host")}/?face=pages&company=1&tidy=1`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the Shell", url: `${at("todo")}/?today=2026-09-01&fresh=1`, ready: () => page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 }) },
    ];
    for (const place of places) {
      await page.goto(place.url, { waitUntil: "load" });
      await place.ready();
      await page.waitForTimeout(900);
      const askBox = await anAskBox(page);
      faces[`${place.where} ${size.width}×${size.height}`] = { askBox, popovers: await everyPopoverOn(page, place.where, size, seen) };
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
  /* ---- What tidying did and suggests, on both faces of the todo example: one digest row, and a tray that waits */
  {
    const tidying = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&tidy=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      // The tray: one suggestion, what it would do and what it was based on, waiting.
      const tray = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const rows = [...document.querySelectorAll('[data-testid="suggestion"]')].map((row) => row.textContent ?? "");
        return { count: button.textContent?.trim().charAt(0), rows, edges: window.__handle.store.graph.allEdges().length };
      });
      await page.keyboard.press("Escape");
      // Activity: the actor's two links, one digest row that opens to each with its lineage and its own undo.
      const digest = await page.evaluate(async () => {
        document.querySelector('[data-testid="activity-button"]')?.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="activity-digest"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const row = document.querySelector('[data-testid="activity-digest"]');
        if (!row) return null;
        row.querySelector('[data-testid="digest-toggle"]')?.click();
        await new Promise((done) => setTimeout(done, 100));
        const each = [...document.querySelectorAll('[data-testid="digest-change"]')];
        return {
          said: row.querySelector("div")?.textContent ?? "",
          rows: document.querySelectorAll('[data-testid="diff-log"] > li').length,
          each: each.map((one) => one.querySelector("[data-graview-lineage]")?.textContent ?? ""),
          undoes: each.filter((one) => one.querySelector('[data-testid="undo-turn"]')).length,
        };
      });
      await page.keyboard.press("Escape");
      /*
       * Declined from the tray: it goes, nothing is made, and the log says it was declined — what the store reads to refuse the actor the
       * same suggestion next time (asked, not tried: a refusal here would be an act the watch saw refused).
       */
      const declined = await page.evaluate(async () => {
        document.querySelector('[data-testid="suggested-button"]')?.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-decline"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const before = window.__handle.store.graph.allEdges().length;
        document.querySelector('[data-testid="suggestion-decline"]')?.click();
        await new Promise((done) => setTimeout(done, 200));
        const declinedBy = window.__tidying.declined(window.__handle.store, [{ name: "wait-for", args: { taskId: "t-post", blockerId: "t-notice" } }])?.author.id ?? null;
        return { trayGone: document.querySelector('[data-testid="suggested-button"]') === null, unchanged: window.__handle.store.graph.allEdges().length === before, declinedBy, keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName };
      });
      await page.close();
      const ok =
        tray !== null && tray.count === "1" && tray.rows.length === 1 && /suggests/.test(tray.rows[0]) && /The post is redirected from the day notice is given/.test(tray.rows[0]) && /45% sure/.test(tray.rows[0]) &&
        digest !== null && /Graview, tidying/.test(digest.said) && /Tidied 2 things today/.test(digest.said) && digest.each.length === 2 && digest.each.every((one) => /based on/.test(one)) && digest.undoes === 2 &&
        declined.trayGone && declined.unchanged && declined.declinedBy === "user-nora" && declined.keyboard !== "BODY";
      tidying[face] = { tray, digest, declined, ok };
    }
    report.checks.whatTidyingDidAndSuggestsIsSaidOnTheTodoExample = { ...tidying, ok: Object.values(tidying).every((one) => one.ok) };
  }
  /*
   * ---- A suggestion takes a vote from someone who may not accept it (f-suggestion-votes), on both faces: a reader — the list's grant
   * to everybody dropped, a seat with no role — presses Accept in the tray and is not refused: the row says "Your vote was recorded"
   * and stays, nothing is made, the store counts the vote as theirs, and the keyboard never lands on <body>; and the keeper, with
   * that vote cast, reads "1 for, 0 against" beside Accept and is offered no vote of their own.
   */
  {
    const votes = {};
    for (const face of ["graview", "pages"]) {
      const asReader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      asReader.on("pageerror", (error) => errors.push(error.message));
      await asReader.goto(`${at("chrome-host")}/?face=${face}&tidy=1&reader=1`, { waitUntil: "load" });
      await asReader.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await asReader.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const reader = await asReader.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-accept"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const store = window.__handle.store;
        const before = store.graph.allEdges().length;
        const accept = document.querySelector('[data-testid="suggestion-accept"]');
        const described = document.getElementById(accept?.getAttribute("aria-describedby") ?? "")?.textContent ?? null;
        accept?.focus();
        accept?.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-voted"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const [waiting] = window.__tidying.suggestions(store, { kind: "human", id: "user-vis", roles: [] });
        return {
          described,
          said: document.querySelector('[data-testid="suggestion-voted"]')?.textContent ?? null,
          pressed: document.querySelector('[data-testid="suggestion-accept"]')?.getAttribute("aria-pressed") ?? null,
          rows: document.querySelectorAll('[data-testid="suggestion"]').length,
          refused: document.querySelector('[data-testid="suggestion-refused"]')?.textContent ?? null,
          unchanged: store.graph.allEdges().length === before,
          tally: waiting?.tally ?? null,
          keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
        };
      });
      await asReader.close();
      const asKeeper = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      asKeeper.on("pageerror", (error) => errors.push(error.message));
      await asKeeper.goto(`${at("chrome-host")}/?face=${face}&tidy=1&vote=1`, { waitUntil: "load" });
      await asKeeper.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await asKeeper.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const keeper = await asKeeper.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-accept"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        return {
          tally: document.querySelector('[data-testid="suggestion-tally"]')?.textContent ?? null,
          votes: document.querySelector('[data-testid="suggestion-accept"]')?.hasAttribute("aria-pressed") ?? null,
          withdraw: document.querySelector('[data-testid="suggestion-withdraw-vote"]') !== null,
        };
      });
      await asKeeper.keyboard.press("Escape");
      await asKeeper.close();
      const ok =
        reader !== null && reader.described === "Counts as your vote; somebody who may make it decides." && reader.said === "Your vote was recorded." && reader.pressed === "true" && reader.rows === 1 && reader.refused === null && reader.unchanged &&
        reader.tally !== null && reader.tally.for === 1 && reader.tally.against === 0 && reader.tally.mine === "for" && reader.keyboard !== "BODY" &&
        keeper !== null && keeper.tally === "1 for, 0 against" && keeper.votes === false && keeper.withdraw === false;
      votes[face] = { reader, keeper, ok };
    }
    report.checks.aSuggestionTakesAVoteFromAReaderAndShowsTheTallyToWhoMayDecide = { ...votes, ok: Object.values(votes).every((one) => one.ok) };
  }
  /*
   * ---- A workflow's run is one suggestion that lists its changes and takes them one at a time (f-job-approvals), on both faces:
   * the row says the run as one, "Accept all" stands where Accept does, the changes open each in its act's own sentence with its own
   * Accept, and one accepted is made while the rest still wait in the same row — the keyboard never on <body>.
   */
  {
    const runs = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&run=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const run = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-items"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const words = document.querySelector("[data-graview-suggestion-words]")?.textContent ?? "";
        const all = document.querySelector('[data-testid="suggestion-accept"]')?.textContent ?? null;
        const summary = document.querySelector('[data-testid="suggestion-items"] summary');
        summary?.click();
        await new Promise((done) => setTimeout(done, 100));
        const items = [...document.querySelectorAll('[data-testid="suggestion-item"]')].map((item) => item.firstElementChild?.textContent ?? "");
        const second = document.querySelectorAll('[data-testid="suggestion-item-accept"]')[1];
        const label = second?.getAttribute("aria-label") ?? null;
        second?.focus();
        second?.click();
        for (let turn = 0; turn < 50 && document.querySelectorAll('[data-testid="suggestion-item"]').length !== 2; turn++) await new Promise((done) => setTimeout(done, 50));
        const store = window.__handle.store;
        return {
          words,
          all,
          items,
          label,
          left: document.querySelectorAll('[data-testid="suggestion-item"]').length,
          rows: document.querySelectorAll('[data-testid="suggestion"]').length,
          archived: store.graph.getNode("t-shelves")?.$archived === true,
          untouched: store.graph.getNode("t-paint")?.$archived !== true,
          heard: document.querySelector('[data-testid="suggestion-heard"]')?.textContent ?? null,
          keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
        };
      });
      await page.keyboard.press("Escape");
      await page.close();
      const ok =
        run !== null && /^Set aside finished tasks suggests 3 tasks to archive$/.test(run.words.trim()) && run.all === "Accept all" && run.items.length === 3 && run.items.every((one) => /^Archive /.test(one)) &&
        run.label === `Accept: ${run.items[1]}` && run.left === 2 && run.rows === 1 && run.archived && run.untouched && run.heard === "Accepted that change; the rest still wait." && run.keyboard !== "BODY";
      runs[face] = { run, ok };
    }
    report.checks.aRunsSuggestionListsItsChangesAndTakesOneAtATime = { ...runs, ok: Object.values(runs).every((one) => one.ok) };
  }
  /*
   * ---- A visitor is offered Sign in rather than a vote (f-votes-shared-seat), on both faces: the host's one shared signed-out seat
   * opens the tray and finds the host's "Sign in to vote" — a native button — where Accept and Decline were, before pressing
   * anything; pressing it asks the host, nothing is kept in the log, and the keyboard never lands on <body>.
   */
  {
    const offered = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&tidy=1&signedOut=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const visitor = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const store = window.__handle.store;
        const signIn = document.querySelector('[data-testid="suggestion-sign-in"]');
        const seen = { tag: signIn?.tagName ?? null, said: signIn?.textContent ?? null, accept: document.querySelector('[data-testid="suggestion-accept"]') !== null, decline: document.querySelector('[data-testid="suggestion-decline"]') !== null };
        signIn?.focus();
        signIn?.click();
        await new Promise((done) => setTimeout(done, 50));
        return {
          ...seen,
          asked: window.__signedIn ?? 0,
          votesKept: store.log.all().filter((op) => op.vote !== undefined).length,
          keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
        };
      });
      await page.close();
      const ok = visitor !== null && visitor.tag === "BUTTON" && visitor.said === "Sign in to vote" && !visitor.accept && !visitor.decline && visitor.asked === 1 && visitor.votesKept === 0 && visitor.keyboard !== "BODY";
      offered[face] = { visitor, ok };
    }
    report.checks.aVisitorIsOfferedSignInRatherThanAVote = { ...offered, ok: Object.values(offered).every((one) => one.ok) };
  }
  /*
   * ---- "Not now" is one person's, and the tray says what tidying did while they were away, on both faces: the host hands what
   * whileAway() worked out; the tray says it in a line; Not now, pressed from the keyboard, hides the suggestion from this reader
   * alone — kept in this browser, nothing in the log, still waiting for everyone else — and the keyboard never lands on <body>.
   */
  {
    const notNow = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&tidy=1&away=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const said = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        const label = button.getAttribute("aria-label");
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion-not-now"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        const away = document.querySelector('[data-testid="while-away"]')?.textContent ?? null;
        const later = document.querySelector('[data-testid="suggestion-not-now"]');
        const hint = later ? (document.getElementById(later.getAttribute("aria-describedby") ?? "")?.textContent ?? null) : null;
        later?.focus();
        return { label, away, hint, focused: document.activeElement?.getAttribute("data-testid") ?? null, ops: window.__handle.store.log.length };
      });
      // Pressed as a keyboard presses it.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        const store = window.__handle.store;
        const key = Object.keys(localStorage).find((one) => one.startsWith("graview:not-now:"));
        return {
          ops: store.log.length,
          stillWaitsForEveryone: window.__tidying.suggestions(store).length,
          kept: key ? JSON.parse(localStorage.getItem(key) ?? "[]").length : 0,
          rows: document.querySelectorAll('[data-testid="suggestion"]').length,
          button: document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]')?.textContent?.trim() ?? null,
          keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
        };
      });
      await page.close();
      const ok =
        said !== null &&
        said.label === "Suggested: One suggestion waiting · tidied 2 things while you were away" &&
        said.away === "One suggestion waiting · tidied 2 things while you were away." &&
        /until tomorrow/.test(said.hint ?? "") &&
        said.focused === "suggestion-not-now" &&
        after.ops === said.ops &&
        after.stillWaitsForEveryone === 1 &&
        after.kept === 1 &&
        after.rows === 0 &&
        /Tidied 2/.test(after.button ?? "") &&
        after.keyboard !== "BODY";
      notNow[face] = { said, after, ok };
    }
    report.checks.notNowIsOnePersonsAndTheTraySaysWhatWasDoneWhileTheyWereAway = { ...notNow, ok: Object.values(notNow).every((one) => one.ok) };
  }
  /*
   * ---- The Suggested tray never scrolls sideways (f-suggested-tray-overflow), on both faces at 320 px: a dozen suggestions on a
   * task whose name is 120 characters with no space wrap their sentences and basis lines, wrap their chip rows and cut the long
   * chip with an ellipsis and its whole name in its title — the panel and every row no wider than they are drawn, and the panel
   * inside the page.
   */
  {
    const crowded = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&crowd=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="suggested-button"]', { timeout: 30_000 }).catch(() => {});
      const said = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="suggested-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="suggestion"]'); turn++) await new Promise((done) => setTimeout(done, 50));
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const panel = document.querySelector('[data-testid="suggested"]');
        if (!panel) return null;
        const wide = (one) => one.scrollWidth > one.clientWidth;
        const rows = [...panel.querySelectorAll('[data-testid="suggestion"]')];
        const box = panel.getBoundingClientRect();
        const long = [...panel.querySelectorAll('[data-graview-primitive="chip"]')].find((chip) => (chip.textContent ?? "").startsWith("@tanstack/"));
        return {
          rows: rows.length,
          panel: { scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, left: Math.round(box.left), right: Math.round(box.right), page: innerWidth },
          wideRows: rows.filter(wide).map((row) => ({ scrollWidth: row.scrollWidth, clientWidth: row.clientWidth })),
          chip: long ? { title: long.getAttribute("title"), width: Math.round(long.getBoundingClientRect().width), cut: long.scrollWidth >= long.clientWidth } : null,
        };
      });
      await page.close();
      const ok =
        said !== null &&
        said.rows >= 10 &&
        said.panel.scrollWidth <= said.panel.clientWidth &&
        said.wideRows.length === 0 &&
        said.panel.left >= 0 &&
        said.panel.right <= said.panel.page &&
        said.chip !== null &&
        said.chip.title?.length === 120 &&
        said.chip.width <= said.panel.clientWidth;
      crowded[face] = { said, ok };
    }
    report.checks.theSuggestedTrayNeverScrollsSideways = { ...crowded, ok: Object.values(crowded).every((one) => one.ok) };
  }
  /*
   * ---- Activity never scrolls sideways (FR-226, f-activity-panel-no-sideways-scroll), on both faces at 320 px: the same crowded
   * page's rename of a task to 120 characters with no space is a row whose sentence wraps, whose "as it was" and undo stay inside
   * the panel, and whose chip is cut with its whole name in its title — the panel and every row no wider than they are drawn, and
   * the panel inside the page.
   */
  {
    const crowded = {};
    for (const face of ["graview", "pages"]) {
      const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=${face}&crowd=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-testid="app-bar"] [data-testid="activity-button"]', { timeout: 30_000 }).catch(() => {});
      const said = await page.evaluate(async () => {
        const button = document.querySelector('[data-testid="app-bar"] [data-testid="activity-button"]');
        if (!button) return null;
        button.click();
        for (let turn = 0; turn < 50 && !document.querySelector('[data-testid="diff-log"] > li'); turn++) await new Promise((done) => setTimeout(done, 50));
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const panel = document.querySelector('[data-testid="activity"]');
        if (!panel) return null;
        const wide = (one) => one.scrollWidth > one.clientWidth;
        const rows = [...panel.querySelectorAll('[data-testid="diff-log"] > li')];
        const box = panel.getBoundingClientRect();
        const inside = (one) => {
          const at = one.getBoundingClientRect();
          return at.left >= box.left - 1 && at.right <= box.right + 1;
        };
        const long = rows.find((row) => (row.textContent ?? "").includes("@tanstack/"));
        const chip = long ? [...long.querySelectorAll('[data-graview-primitive="chip"]')].find((one) => (one.textContent ?? "").startsWith("@tanstack/")) : null;
        return {
          rows: rows.length,
          panel: { scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, left: Math.round(box.left), right: Math.round(box.right), page: innerWidth },
          wideRows: rows.filter(wide).map((row) => ({ scrollWidth: row.scrollWidth, clientWidth: row.clientWidth })),
          // The long row's buttons, each inside the panel: "as it was" and undo.
          buttons: long ? [...long.querySelectorAll("button")].map((one) => ({ name: one.getAttribute("data-testid") ?? one.textContent, inside: inside(one) })) : [],
          chip: chip ? { title: chip.getAttribute("title"), width: Math.round(chip.getBoundingClientRect().width), inside: inside(chip) } : null,
        };
      });
      await page.close();
      const ok =
        said !== null &&
        said.rows >= 1 &&
        said.panel.scrollWidth <= said.panel.clientWidth &&
        said.wideRows.length === 0 &&
        said.panel.left >= 0 &&
        said.panel.right <= said.panel.page &&
        said.buttons.length >= 2 &&
        said.buttons.every((one) => one.inside) &&
        said.chip !== null &&
        said.chip.title?.length === 120 &&
        said.chip.inside &&
        said.chip.width <= said.panel.clientWidth;
      crowded[face] = { said, ok };
    }
    report.checks.activityNeverScrollsSideways = { ...crowded, ok: Object.values(crowded).every((one) => one.ok) };
  }
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
  /* ---- FR-236: no notice carries a side accent; FR-237: an error toast the framework raised offers the host's Report this */
  {
    const accents = {};
    const reporting = {};
    /* The framework's own error toast: a tidying the host refused — Hide on the list's place, with a host that refuses every change to the declaration. */
    const refused = async (page) => {
      const standing = page.locator('[data-testid="app-places-standing"] [aria-current="page"]');
      const stands = (await standing.count()) > 0 && (await standing.first().isVisible());
      await (stands ? standing.first() : page.locator('[data-testid="app-places-open"]').first()).click({ button: "right" });
      const row = page.locator('[data-testid="context-menu"] [data-menu-item="hide-list"]');
      const offered = await row.waitFor({ timeout: 10_000 }).then(() => true, () => false);
      if (offered) await row.click();
      const toast = page.locator('[data-testid="notices-toasts"] [data-testid="notice"][data-tone="bad"]');
      const said = await toast.first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
      return { offered, said };
    };
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=pages&path=/tasks&refuse=1&report=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForTimeout(600);
      /* The host's banner and a toast of every tone, beside the framework's own error toast. */
      await page.evaluate(() => {
        window.__handle.notify({ kind: "banner", tone: "warn", sentence: "Offline — changes will be sent when you reconnect.", action: { label: "Retry", onSelect: () => {} } });
        for (const tone of ["info", "good", "warn", "bad"]) window.__handle.notify({ kind: "toast", tone, sentence: `A ${tone} toast from the host.`, timeout: false });
      });
      const raised = await refused(page);
      await page.waitForTimeout(300);
      /* FR-236: no element in a toast or a banner has a border on its left wider than its other sides. */
      const sides = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-testid="notice"]')];
        const wide = [];
        for (const card of cards) {
          for (const element of [card, ...card.querySelectorAll("*")]) {
            const style = getComputedStyle(element);
            const [left, right, top, bottom] = [style.borderLeftWidth, style.borderRightWidth, style.borderTopWidth, style.borderBottomWidth].map((one) => parseFloat(one) || 0);
            if (left > Math.max(right, top, bottom)) wide.push(`${element.tagName.toLowerCase()}${element.getAttribute("data-testid") ? `[${element.getAttribute("data-testid")}]` : ""} ${left}px left, ${right}/${top}/${bottom}`);
          }
        }
        const chips = cards.map((card) => card.querySelector('[data-testid="notice-chip"]')).filter(Boolean);
        return { cards: cards.length, tones: cards.map((card) => card.getAttribute("data-tone")).sort(), chips: chips.length, chipsHidden: chips.every((chip) => chip.getAttribute("aria-hidden") === "true"), wide };
      });
      const readable = await noticeLooks(page, "toast");
      accents[colorScheme] = { ...raised, ...sides, contrast: readable?.contrast ?? null, ok: raised.offered && raised.said && sides.cards === 6 && sides.chips === 6 && sides.chipsHidden && sides.wide.length === 0 && (readable?.contrast ?? 0) >= 4.5 };
      if (colorScheme === "light") {
        /* FR-237: a native button named for the toast, the toast held while it has focus, the report handed to the host, and the toast gone once focus has moved on and its time runs out. */
        const button = page.locator('[data-testid="notice-report"]');
        const drawn = await button.first().waitFor({ timeout: 5_000 }).then(() => true, () => false);
        const named = drawn ? await button.first().evaluate((one) => ({ tag: one.tagName, label: one.getAttribute("aria-label"), text: one.textContent })) : null;
        if (drawn) await button.first().focus();
        await page.waitForTimeout(7_500);
        const held = await page.evaluate(() => document.querySelector('[data-testid="notice-report"]') !== null && document.activeElement?.getAttribute("data-testid") === "notice-report");
        if (drawn) await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        const handed = await page.evaluate(() => ({ reports: window.__reports ?? [], version: window.__version, stillThere: document.querySelector('[data-testid="notice-report"]') !== null }));
        await page.evaluate(() => document.querySelector('[data-testid="profile-button"]')?.focus());
        await page.waitForTimeout(7_500);
        const gone = await page.evaluate(() => document.querySelector('[data-testid="notice-report"]') === null);
        const report0 = handed.reports[0] ?? null;
        reporting.withTheHook = {
          drawn, named, held, handed: report0, stillThere: handed.stillThere, gone,
          ok: drawn && named?.tag === "BUTTON" && named.label === "Report this: The app could not be changed: the host is holding it while a repair is checked." && named.text === "Report this" && held && handed.reports.length === 1 && report0.message === "The app could not be changed: the host is holding it while a repair is checked." && report0.place === "tasks" && report0.record === undefined && report0.version === handed.version && handed.stillThere && gone,
        };
      }
      await page.close();
    }
    /* Without the hook, the same toast carries no button; and the host's own error toast never does. */
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${at("chrome-host")}/?face=pages&path=/tasks&refuse=1`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForTimeout(600);
      const raised = await refused(page);
      await page.waitForTimeout(300);
      const without = await page.evaluate(() => ({ toasts: document.querySelectorAll('[data-testid="notices-toasts"] [data-testid="notice"]').length, buttons: document.querySelectorAll('[data-testid="notice-report"]').length }));
      reporting.withoutTheHook = { ...raised, ...without, ok: raised.offered && raised.said && without.toasts >= 1 && without.buttons === 0 };
      await page.close();
    }
    report.checks.noticesCarryNoSideAccent = { ...accents, ok: Object.values(accents).every((one) => one.ok) };
    report.checks.anErrorToastOffersTheHostsReport = { ...reporting, ok: Object.values(reporting).every((one) => one.ok) };
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
          // And the ways past the bar (`skip-*`) are the face's, not the bar's: the Shell's scene says where they go, an embed's host page has its own.
          // Nor are the host's own buttons (FR-227): this host gives the embed two, and the Shell's todo none.
          ids: ids.filter((id) => !id.startsWith("app-place") && id !== "activity-button" && !id.startsWith("skip-") && !id.startsWith("host-bar-action")),
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
  /*
   * ---- A host's buttons stand on the bar, or fold into one control (FR-227, Roadmap f-host-buttons-in-the-app-bar): on both faces,
   * on a desk the host's "Send feedback" and "Share" stand on the bar's one row before the standing and the person, each a button named
   * by its label; on a phone they are behind one control named for them, which lists them. Either way "Send feedback", reached by the
   * keyboard, runs the host's onSelect once, and a folded list closes on the press.
   */
  {
    const buttons = {};
    for (const size of SIZES) {
      for (const face of ["graview", "pages"]) {
        const page = await browser.newPage({ viewport: size });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${at("chrome-host")}/?face=${face}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(900);
        const drawn = await page.evaluate(() => {
          const bar = document.querySelector('[data-testid="app-bar"]');
          const row = bar.getBoundingClientRect();
          const visible = (el) => el !== null && el.getBoundingClientRect().width > 0;
          const standing = bar.querySelector('[data-testid="host-bar-actions-standing"]');
          const open = bar.querySelector('[data-testid="host-bar-actions-open"]');
          const onTheRow = [...bar.querySelectorAll('[data-testid="host-bar-actions-standing"] [data-testid="host-bar-action"], [data-testid="host-bar-actions-open"]')]
            .filter(visible)
            .every((el) => { const box = el.getBoundingClientRect(); return box.top >= row.top - 1 && box.bottom <= row.bottom + 1 && box.right <= row.right + 1; });
          const ids = [...bar.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
          const first = ids.findIndex((id) => id.startsWith("host-bar-action"));
          return {
            standing: visible(standing) ? [...standing.querySelectorAll('[data-testid="host-bar-action"]')].map((el) => el.textContent.trim()) : null,
            folded: visible(open) ? open.getAttribute("aria-label") : null,
            onTheRow,
            beforeTheTools: first >= 0 && first < ids.indexOf("standing"),
          };
        });
        /* "Send feedback" by the keyboard: on the row, or in the list behind the one control. */
        if (drawn.folded !== null) {
          await page.locator('[data-testid="host-bar-actions-open"]:visible').first().focus();
          await page.keyboard.press("Enter");
          await page.waitForSelector('[data-testid="host-bar-actions"]:not([hidden])', { timeout: 3000 }).catch(() => {});
        }
        const button = page.locator('[data-testid="host-bar-action"]:visible', { hasText: "Send feedback" }).first();
        const reached = (await button.count()) > 0;
        if (reached) {
          await button.focus();
          await page.keyboard.press("Enter");
          await page.waitForTimeout(150);
        }
        const after = await page.evaluate(() => ({
          ran: window.__feedback ?? 0,
          listClosed: document.querySelector('[data-testid="host-bar-actions"]')?.hasAttribute("hidden") ?? true,
          keyboard: document.activeElement === document.body ? "body" : document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
        }));
        await page.close();
        const stands = size.width >= 640;
        const ok =
          drawn.onTheRow && drawn.beforeTheTools && reached && after.ran === 1 && after.listClosed && after.keyboard !== "body" &&
          (stands ? JSON.stringify(drawn.standing) === JSON.stringify(["✉Send feedback", "Share"]) && drawn.folded === null : drawn.standing === null && drawn.folded === "More — Send feedback, Share");
        buttons[`${face} ${size.width}×${size.height}`] = { ...drawn, reached, after, ok };
      }
    }
    report.checks.aHostsButtonsStandOnTheBarOrFoldIntoOneControl = { ...buttons, ok: Object.values(buttons).every((one) => one.ok) };
  }
  /* ---- A day said as the glance says it, and a choice as it is declared: in the problems, and on a record's page.
     The day is in the page's locale (FR-178): "Aug 28, 2026" in en-US, "28 Aug 2026" in en-GB, never 2026-08-28. */
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
      ok: problems.length > 0 && !iso.test(problems) && /\b(?:\d{1,2} [A-Z][a-z]{2} \d{4}|[A-Z][a-z]{2} \d{1,2}, \d{4})\b/.test(problems) && !iso.test(record.text) && record.said.length > 0 && !record.said.some((one) => raw.test(one)) && record.said.includes("Tue"),
    };
  }
  /* ---- FR-78, restated: the picture keeps its width, no Ask box stands on it, and the quick ask can be left out */
  const seat = await thePictureKeepsItsWidth(
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
  report.checks.thePictureKeepsItsWidthWithNoAskBox = { ...seat, ok: Object.values(seat).every((one) => one.ok) };
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
