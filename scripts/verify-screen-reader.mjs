#!/usr/bin/env node
/**
 * WHAT A SCREEN READER IS TOLD, STOP BY STOP.
 *
 * axe-core is clean over every example on both faces (`verify-a11y`), and
 * the accessibility tree is populated — but nobody had listened to it read.
 * axe says a button has a name; it does not say the name is "↗", that a
 * card says its title twice, that a value is read as "Shipped, button" with
 * nothing to say it is the stage, or that a record somebody else changed
 * while you were on it changed in silence.
 *
 * So this walks a real app the way a person without sight would: the tree
 * the browsers expose, in the order a screen reader reaches it. Chromium's
 * whole tree through CDP (`Accessibility.getFullAXTree`), read in document
 * order into what a reader would say; WebKit's (the engine VoiceOver reads
 * Safari through) as Playwright's `ariaSnapshot`. At each stop it notes:
 *
 *   what is read, and in what order;
 *   whether a person could act without sight — every control named in
 *   words (never a bare mark), landmarks named, headings in order;
 *   where the keyboard is after each act, navigation, menu and form;
 *   what the live regions say when somebody else, in another tab sharing
 *   the store, changes a record.
 *
 * The stops: the bar; the Pages and Scene switch; a list; a record page; a
 * columns lens, a card on it moved by the keyboard, its menu and a drag; a blocks lens; an act's form; the quick ask (⌘K); and a change
 * from someone else, with the two shown to each other and with presence
 * off, as a served store's change arrives. Over two apps: the Roadmap (a document mounted as
 * Graview Cloud mounts one, in two tabs sat down as Ada and Ben, every op
 * of one landed in the other through `store.receive` as a served store's
 * are) and the todo example on its own port.
 *
 * Its verdict is `docs/screen-reader.json`, as named claims. It also writes
 * `docs/screen-reader-walk.md`: what a screen reader would say at each
 * stop, in order — the written walk. `scripts/voiceover-walk.mjs` listens
 * to the same stops with real VoiceOver, when somebody chooses to.
 *
 *   node scripts/verify-screen-reader.mjs [--quick] [--engine=chromium|webkit] [--serve]
 *
 * `--quick` walks in Chromium only; the whole run adds WebKit's tree.
 * `--serve` serves the stops and waits, for a walk by hand.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deadline } from "./lib/deadline.mjs";
import { launchEngine, WEBFONTS } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { buildRoadmapHost } from "./lib/screen-reader-host.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const SERVE = process.argv.includes("--serve");
const askedEngine = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const ENGINES = askedEngine ? [askedEngine] : QUICK ? ["chromium"] : ["chromium", "webkit"];
const VERDICT = resolve(repoRoot, "docs/screen-reader.json");
const WALK = resolve(repoRoot, "docs/screen-reader-walk.md");
const DESK = { width: 1280, height: 800 };
const TODAY = "2026-09-01";

/* ── what the live regions say, kept from the page's first moment ─────── */

/**
 * Every live region's words as they change: what a screen reader would
 * announce without the reader moving. Runs in the page before anything
 * else, so a region that is filled after it arrives is heard.
 */
function listenToLiveRegions() {
  const said = [];
  window.__said = said;
  const last = new WeakMap();
  const regionOf = (node) => {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element?.closest?.('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]') ?? null;
  };
  const hear = (region) => {
    if (!region || region.closest("[aria-hidden='true']")) return;
    const text = (region.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text === (last.get(region) ?? "")) return;
    last.set(region, text);
    if (!text) return;
    const role = region.getAttribute("role");
    const politeness = region.getAttribute("aria-live") ?? (role === "alert" ? "assertive" : "polite");
    said.push({ at: Date.now(), politeness, text: text.slice(0, 240), where: region.getAttribute("data-testid") ?? region.getAttribute("aria-label") ?? role ?? "aria-live" });
  };
  const watch = () =>
    new MutationObserver((records) => {
      for (const record of records) {
        hear(regionOf(record.target));
        // A region that arrives with its words already in it is read by no screen reader; its later changes are.
        for (const added of record.addedNodes) if (added.nodeType === 1 && regionOf(added) !== added) hear(regionOf(added));
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  if (document.documentElement) watch();
  else document.addEventListener("DOMContentLoaded", watch);
}

/** What the live regions said since `since` (ms since epoch). */
const heardSince = (page, since) => page.evaluate((from) => (window.__said ?? []).filter((one) => one.at >= from), since);

/* ── the tree, as a reader reaches it (Chromium, CDP) ─────────────────── */

/** Roles a reader stops on and acts at: each must be named in words. */
const CONTROLS = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "menuitem", "menuitemcheckbox", "menuitemradio", "tab", "slider", "spinbutton", "listbox", "PopUpButton", "ToggleButton"]);
/** Roles a reader moves between with a key: each named, so two are told apart. */
const LANDMARKS = new Set(["banner", "main", "navigation", "contentinfo", "search", "region", "complementary", "form"]);
/** Roles whose name IS their contents: said once, whole, not descended into for text. */
const NAMED_BY_CONTENTS = new Set(["image", "img", "button", "link", "heading", "menuitem", "menuitemcheckbox", "menuitemradio", "tab", "option", "MenuListOption", "checkbox", "radio", "switch", "ToggleButton", "PopUpButton"]);
const SKIPPED = new Set(["InlineTextBox", "LineBreak", "none", "generic", "presentation", "ignored", "RootWebArea", "WebArea", "LayoutTable", "LayoutTableRow", "LayoutTableCell", "Unknown", "paragraph", "listitem", "term", "definition", "DescriptionList", "strong", "emphasis", "Section", "LabelText", "time", "code", "Abbr", "mark", "superscript", "subscript", "group"]);

const prop = (node, name) => node.properties?.find((one) => one.name === name)?.value?.value;
const valueOf = (field) => (field && typeof field === "object" ? (field.value ?? "") : (field ?? ""));

/** A node as a reader says it: "Features, link", "Tasks, heading level 2", "Scene, toggle button, not pressed". */
function phrase(node) {
  const role = valueOf(node.role);
  const name = String(valueOf(node.name)).replace(/\s+/g, " ").trim();
  const states = [];
  const pressed = prop(node, "pressed");
  if (pressed !== undefined) states.push(pressed === true || pressed === "true" ? "pressed" : "not pressed");
  const checked = prop(node, "checked");
  if (checked !== undefined) states.push(checked === true || checked === "true" ? "checked" : "not checked");
  const expanded = prop(node, "expanded");
  if (expanded !== undefined) states.push(expanded ? "expanded" : "collapsed");
  if (prop(node, "disabled")) states.push("dimmed");
  if (prop(node, "required")) states.push("required");
  if (prop(node, "invalid") && prop(node, "invalid") !== "false") states.push("invalid");
  const value = String(valueOf(node.value) ?? "").trim();
  const words =
    role === "heading"
      ? `heading level ${prop(node, "level") ?? "?"}`
      : role === "StaticText"
        ? ""
        : role === "PopUpButton" || role === "combobox"
          ? "pop-up button"
          : role === "textbox" || role === "searchbox"
            ? `${role === "searchbox" ? "search" : "edit"} text`
            : LANDMARKS.has(role)
              ? `${role} landmark`
              : role;
  const description = String(valueOf(node.description) ?? "").trim();
  const parts = [name || (role === "StaticText" ? "" : "(no name)"), value && value !== name ? value : "", words, ...states].filter(Boolean);
  return { role, name, line: parts.join(", "), description };
}

/**
 * The reading order under `selector` (default: the whole page): every node
 * a reader says, in document order. `skip` leaves out the subtrees of
 * other selectors (the bar, at a stop that is the page under it); a list
 * longer than `items` is said to its first few and then counted.
 */
async function readingOrder(page, cdp, { selector = "body", skip = [], items = 3 } = {}) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const backend = async (sel) => {
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel });
    const ids = [];
    for (const nodeId of nodeIds) ids.push((await cdp.send("DOM.describeNode", { nodeId })).node.backendNodeId);
    return ids;
  };
  const start = new Set(await backend(selector));
  const skipped = new Set((await Promise.all(skip.map(backend))).flat());
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const said = [];
  const controls = [];
  const landmarks = [];
  const headings = [];
  const walk = (node, depth, inside) => {
    if (!node) return;
    if (skipped.has(node.backendDOMNodeId)) return;
    const within = inside || start.has(node.backendDOMNodeId);
    const role = valueOf(node.role);
    const children = (node.childIds ?? []).map((id) => byId.get(id));
    if (node.ignored || SKIPPED.has(role) || (role === "StaticText" && !within)) {
      // A group with a name is said, as a reader says "Arrange, group".
      if (within && !node.ignored && role === "group" && valueOf(node.name)) said.push({ depth, ...phrase(node) });
      for (const child of children) walk(child, depth + (role === "group" && valueOf(node.name) ? 1 : 0), within);
      return;
    }
    if (!within) {
      for (const child of children) walk(child, depth, within);
      return;
    }
    const spoken = phrase(node);
    if (role === "StaticText") {
      if (spoken.name) said.push({ depth, ...spoken, line: spoken.name });
      return;
    }
    if (role === "list") {
      const listed = children.filter((child) => child && !child.ignored);
      said.push({ depth, ...spoken, line: `list, ${listed.length} item${listed.length === 1 ? "" : "s"}` });
      for (const [index, child] of listed.entries()) {
        if (index >= items) {
          said.push({ depth: depth + 1, role: "more", name: "", line: `… and ${listed.length - items} more` });
          // The rest are still checked for names, but not said.
          for (const rest of listed.slice(index)) collect(rest);
          break;
        }
        walk(child, depth + 1, true);
      }
      return;
    }
    said.push({ depth, ...spoken });
    if (CONTROLS.has(role)) controls.push(spoken);
    if (LANDMARKS.has(role)) landmarks.push(spoken);
    if (role === "heading") headings.push({ level: Number(prop(node, "level")), name: spoken.name });
    // A control's name is its contents: what is inside is not said again, but a control inside it (a heading's link) is.
    if (NAMED_BY_CONTENTS.has(role)) {
      for (const child of children) collectControls(child, depth + 1);
      return;
    }
    for (const child of children) walk(child, depth + 1, true);
  };
  /** The controls inside a list item past the few said: still held to having names. */
  const collect = (node) => {
    if (!node) return;
    const role = valueOf(node.role);
    if (!node.ignored && CONTROLS.has(role)) controls.push(phrase(node));
    for (const id of node.childIds ?? []) collect(byId.get(id));
  };
  const collectControls = (node, depth) => {
    if (!node) return;
    const role = valueOf(node.role);
    if (!node.ignored && CONTROLS.has(role)) {
      const spoken = phrase(node);
      said.push({ depth, ...spoken });
      controls.push(spoken);
    }
    for (const id of node.childIds ?? []) collectControls(byId.get(id), depth);
  };
  const top = nodes.find((node) => valueOf(node.role) === "RootWebArea") ?? nodes[0];
  walk(top, 0, start.has(top.backendDOMNodeId));
  return { said, controls, landmarks, headings };
}

/** A name a person can act on: words or numbers, not a mark ("↗", "×", "…") and not nothing. */
const named = (name) => /[\p{L}\p{N}]/u.test(name ?? "");

/** Each fact a record page changes in place, and whether its control says which fact it is: "Stage: Shipped", never "Shipped, button". */
async function factsSaid(page) {
  const said = await page.evaluate(() =>
    [...document.querySelectorAll("dt")].flatMap((term) => {
      const value = term.nextElementSibling?.querySelector("button");
      return value ? [{ term: term.textContent.trim(), name: value.getAttribute("aria-label") ?? value.textContent.trim() }] : [];
    }),
  );
  return { said, bare: said.filter((fact) => !fact.name.toLowerCase().includes(fact.term.toLowerCase())) };
}

/** Where the keyboard is, as a reader would be told it: the focused node's phrase, or where it fell. */
async function focusSaid(page, cdp) {
  const fell = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return "the page itself (focus fell to <body>)";
    if (!active.isConnected) return "an element no longer on the page";
    return null;
  });
  if (fell) return { lost: true, line: fell };
  if (cdp) {
    // The focused element's own node in the tree: marked, found by the DOM, then read as the tree says it.
    await page.evaluate(() => document.activeElement?.setAttribute("data-screen-reader-focus", ""));
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-screen-reader-focus]" });
    await page.evaluate(() => document.querySelector("[data-screen-reader-focus]")?.removeAttribute("data-screen-reader-focus"));
    if (nodeId) {
      const { node } = await cdp.send("DOM.describeNode", { nodeId });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { backendNodeId: node.backendNodeId, fetchRelatives: false });
      const focused = nodes.find((one) => one.backendDOMNodeId === node.backendNodeId) ?? nodes[0];
      if (focused) return { lost: false, line: phrase(focused).line, role: valueOf(focused.role), name: String(valueOf(focused.name)) };
    }
  }
  const described = await page.evaluate(() => {
    const active = document.activeElement;
    return { role: active.getAttribute("role") ?? active.tagName.toLowerCase(), name: (active.getAttribute("aria-label") ?? active.textContent ?? "").trim().slice(0, 80) };
  });
  return { lost: false, line: `${described.name}, ${described.role}`, ...described };
}

/* ── the walk ──────────────────────────────────────────────────────────── */

const report = { at: new Date().toISOString(), engines: ENGINES, checks: {}, stops: {}, webkit: {}, pageErrors: [] };
const walk = [];
/** A stop's lines, kept for the written walk. */
const stop = (app, title, note) => {
  const entry = { app, title, note, sections: [] };
  walk.push(entry);
  return {
    read: (heading, order) => entry.sections.push({ heading, lines: order.said.map((one) => `${"  ".repeat(Math.min(one.depth, 6))}${one.line}`) }),
    focus: (after, focus) => entry.sections.push({ heading: `Focus after ${after}`, lines: [focus.line] }),
    heard: (what, heard) => entry.sections.push({ heading: `Heard: ${what}`, lines: heard.length > 0 ? heard.map((one) => `(${one.politeness}) ${one.text}`) : ["(nothing)"] }),
    note: (heading, lines) => entry.sections.push({ heading, lines }),
  };
};
const check = (name, ok, detail = {}) => {
  report.checks[name] = { ok: Boolean(ok), ...detail };
};
/** Every control named in words; what is not. */
const unnamed = (order) => order.controls.filter((control) => !named(control.name)).map((control) => control.line);
/** Text a reader lands on that is a mark and nothing else: "⚠", "·", "→" said as a word of its own. */
/** A change said as it is kept (Roadmap f-change-sentences-in-words): an arrow, a value in a program's quotes, or a key spelled as code ("stage → \"considering\"", "minPlayers"). */
const SAID_AS_KEPT = /→|"|\b[a-z]+[A-Z]\w*\b/;
const bareMarks = (order) => [...new Set(order.said.filter((one) => one.role === "StaticText" && one.name.trim() && !named(one.name) && !/^[.,:;!?]+$/.test(one.name.trim())).map((one) => one.name.trim()))];

const servers = [];
let host;
let browser;
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close().catch(() => undefined);
    host?.stop();
    for (const server of servers) server.stop();
  },
});

const ready = async (page, test) => {
  await page.waitForFunction(test, undefined, { timeout: 60_000 });
  await page.waitForTimeout(800);
};
const roadmapReady = (page) => ready(page, () => window.__ready === true);
const todoReady = (page) => ready(page, () => Object.keys(window).some((key) => /^__\w*Ready$/.test(key)));
const ROADMAP_AT = (path, as = "ada") => `${at("screen-reader-host")}${path}?as=${as}`;
const TODO_AT = (path) => `${at("todo")}${path}${path.includes("?") ? "&" : "?"}today=${TODAY}`;
const BAR = "[data-graview-app-bar]";
const ASK = '[data-testid="quick-ask"]';

/** Presses a control by the keyboard, as a person without a pointer does: focus it, then Enter. */
async function press(locator, key = "Enter") {
  await locator.focus();
  await locator.press(key);
}

try {
  reach("starting the servers");
  host = await buildRoadmapHost(repoRoot);
  servers.push(await serving("todo", portFor("todo"), repoRoot));
  if (SERVE) {
    /*
     * `--serve`: the stops, served and nothing else, for a person to walk
     * by hand with a screen reader (scripts/voiceover-walk.mjs, its header).
     */
    reach.done();
    process.once("SIGINT", () => {
      host.stop();
      for (const server of servers) server.stop();
      process.exit(130);
    });
    process.stdout.write(`The Roadmap, as Ada: ${ROADMAP_AT("/")} (and ?as=ben in a second tab)\nThe todo example: ${TODO_AT("/pages")}\nCtrl-C to stop.\n`);
    await new Promise(() => undefined);
  }

  for (const engine of ENGINES) {
    browser = await launchEngine(engine);
    const chromium = engine === "chromium";
    const context = await browser.newContext({ viewport: DESK });
    // What a screen reader is told reads names and roles, not letters: Google's webfonts are refused, so WebKit's stylesheet that never finishes here does not time a page out (as playback and viewport do).
    await context.route(WEBFONTS, (route) => route.abort());
    await context.addInitScript(listenToLiveRegions);
    const cdpOf = async (page) => {
      if (!chromium) return null;
      const cdp = await context.newCDPSession(page);
      await cdp.send("Accessibility.enable");
      await cdp.send("DOM.enable");
      return cdp;
    };
    const open = async (url, isReady) => {
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${engine} ${url}: ${String(error.message).split("\n")[0]}`));
      await page.goto(url, { waitUntil: "load" });
      await isReady(page);
      return page;
    };

    if (!chromium) {
      /*
       * WEBKIT: the tree VoiceOver reads Safari through, at the same stops,
       * as Playwright's ariaSnapshot — each control in it named in words,
       * and the keyboard on the new page's heading after a link is followed.
       */
      reach(`${engine}: every stop's controls are named`);
      const stops = [
        ["roadmap · home", ROADMAP_AT("/"), roadmapReady],
        ["roadmap · a list", ROADMAP_AT("/features"), roadmapReady],
        ["roadmap · a record", ROADMAP_AT("/features/feature-0"), roadmapReady],
        ["roadmap · columns", ROADMAP_AT("/places/roadmap"), roadmapReady],
        ["roadmap · blocks", ROADMAP_AT("/places/up-next"), roadmapReady],
        ["todo · a list", TODO_AT("/pages/tasks"), todoReady],
        ["todo · a record", TODO_AT("/pages/tasks/t-deposit"), todoReady],
      ];
      const nameless = [];
      for (const [name, url, isReady] of stops) {
        const page = await open(url, isReady);
        const snapshot = await page.locator("body").ariaSnapshot();
        report.webkit[name] = snapshot.split("\n").length;
        for (const line of snapshot.split("\n")) {
          const control = /^\s*- (button|link|textbox|searchbox|combobox|checkbox|radio|switch|menuitem|tab|slider|spinbutton)\b(?:\s+"([^"]*)")?/.exec(line);
          if (control && !named(control[2] ?? "")) nameless.push(`${name}: ${line.trim()}`);
        }
        await page.close();
      }
      check(`${engine}: every control at every stop is named in words`, nameless.length === 0, { nameless: nameless.slice(0, 20) });
      reach(`${engine}: a followed link puts the keyboard on the new page's heading`);
      const page = await open(ROADMAP_AT("/"), roadmapReady);
      await press(page.getByRole("navigation").getByRole("link", { name: "Features", exact: true }));
      await page.waitForTimeout(800);
      const focus = await focusSaid(page, null);
      check(`${engine}: a followed link puts the keyboard on the new page's heading`, !focus.lost && /heading|h[1-6]/i.test(focus.role ?? "") && /Features/.test(focus.name ?? ""), { focus: focus.line });
      await page.close();
      await context.close();
      await browser.close();
      continue;
    }

    /* ── 1. THE BAR ── */
    reach("the bar");
    const ada = await open(ROADMAP_AT("/"), roadmapReady);
    const cdp = await cdpOf(ada);
    {
      const here = stop("Roadmap", "The bar", "The Roadmap's home, as Ada. The bar is the first thing in the app's region.");
      const order = await readingOrder(ada, cdp, { selector: BAR });
      here.read("Read in order", order);
      report.stops.bar = order.said.map((one) => one.line);
      check("the bar: every control is named in words", unnamed(order).length === 0, { unnamed: unnamed(order) });
      check(
        "the bar: the app's name is said first, as the page's heading, then the switch, the places and the search",
        order.headings[0]?.name === "A Roadmap" && order.headings[0]?.level === 1,
        { headings: order.headings },
      );
      // The order the Tab key reaches: what a keyboard meets first.
      await ada.locator(`${BAR} a, ${BAR} button`).first().focus();
      const tabs = [];
      for (let step = 0; step < 10; step++) {
        tabs.push((await focusSaid(ada, cdp)).line);
        await ada.keyboard.press("Tab");
      }
      here.note("The Tab key reaches, in order", tabs);
      report.stops.barTabs = tabs;
    }

    /* ── 2. THE PAGES AND SCENE SWITCH ── */
    reach("the switch");
    {
      const here = stop("Roadmap", "The Pages and Scene switch", "Pressed from the keyboard: Scene, then Pages again.");
      const switcher = ada.getByRole("group", { name: "Scene or Pages" });
      here.read("The switch", await readingOrder(ada, cdp, { selector: '[role="group"][aria-label="Scene or Pages"]' }));
      await press(switcher.getByRole("button", { name: "Scene" }));
      await ada.waitForFunction(() => document.querySelector("[data-graview-face='graview'], .graview-scene, [data-graview-scene]") !== null, undefined, { timeout: 30_000 }).catch(() => undefined);
      await ada.waitForTimeout(1200);
      const onScene = await focusSaid(ada, cdp);
      here.focus("pressing Scene", onScene);
      const scene = await readingOrder(ada, cdp, { selector: "#app", skip: [BAR, ASK], items: 2 });
      here.read("The scene, under the bar (lists cut to two items)", { said: scene.said.slice(0, 40) });
      check("the switch: the keyboard stays on the switch after Scene is pressed", !onScene.lost && /Scene/.test(onScene.name ?? "") && /pressed/.test(onScene.line), { focus: onScene.line });
      check("the scene: every control is named in words", unnamed(scene).length === 0, { unnamed: unnamed(scene).slice(0, 12) });
      await press(ada.getByRole("group", { name: "Scene or Pages" }).getByRole("button", { name: "Pages" }));
      await ada.waitForTimeout(1200);
      const onPages = await focusSaid(ada, cdp);
      here.focus("pressing Pages", onPages);
      check("the switch: the keyboard stays on the switch after Pages is pressed", !onPages.lost && /Pages/.test(onPages.name ?? "") && /pressed/.test(onPages.line), { focus: onPages.line });
    }

    /* ── 3. A LIST ── */
    reach("a list");
    {
      const here = stop("Roadmap", "A list", "Features, reached from the bar's places by the keyboard.");
      await press(ada.getByRole("navigation").getByRole("link", { name: "Features", exact: true }));
      await ada.waitForTimeout(1000);
      const focus = await focusSaid(ada, cdp);
      here.focus("following the Features link", focus);
      check("a list: following a place's link puts the keyboard on the list's heading", !focus.lost && focus.role === "heading" && /Features/.test(focus.name ?? ""), { focus: focus.line });
      const order = await readingOrder(ada, cdp, { selector: "#app", skip: [BAR, ASK] });
      here.read("Read in order (each list to its first three)", order);
      report.stops.list = order.said.map((one) => one.line);
      check("a list: every control is named in words", unnamed(order).length === 0, { unnamed: unnamed(order).slice(0, 12) });
      check("a list: no mark is read as a word of its own", bareMarks(order).length === 0, { marks: bareMarks(order) });
    }

    /* ── 4. A RECORD PAGE ── */
    reach("a record page");
    {
      const here = stop("Roadmap", "A record page", "The first feature, opened from the list by the keyboard.");
      const first = ada.locator('[data-testid="records"] a[href*="/features/"]').first();
      const name = ((await first.getAttribute("aria-label")) ?? (await first.innerText())).trim();
      await press(first);
      await ada.waitForTimeout(1000);
      const focus = await focusSaid(ada, cdp);
      here.focus(`opening “${name}”`, focus);
      check("a record page: opening a record puts the keyboard on its heading", !focus.lost && focus.role === "heading", { focus: focus.line, opened: name });
      const order = await readingOrder(ada, cdp, { selector: "#app", skip: [BAR, ASK] });
      here.read("Read in order", order);
      report.stops.record = order.said.map((one) => one.line);
      check("a record page: every control is named in words", unnamed(order).length === 0, { unnamed: unnamed(order) });
      check("a record page: no mark is read as a word of its own", bareMarks(order).length === 0, { marks: bareMarks(order) });
      const facts = await factsSaid(ada);
      check("a record page: each fact changed in place says which fact it is", facts.said.length > 0 && facts.bare.length === 0, facts);
      report.recordPath = new URL(ada.url()).pathname;
    }

    /* ── 5. AN ACT'S FORM ── */
    reach("an act's form");
    {
      const here = stop("Roadmap", "An act's form", "“Change the feature” on the record page: opened, put away with Escape, opened again and sent.");
      const opener = ada.getByRole("button", { name: /^Change the feature/ }).first();
      await press(opener);
      await ada.waitForTimeout(600);
      const inForm = await focusSaid(ada, cdp);
      here.focus("opening the form", inForm);
      check("an act's form: opening it puts the keyboard in its first field", !inForm.lost && /text|pop-up|combobox|checkbox/.test(inForm.line), { focus: inForm.line });
      const form = await readingOrder(ada, cdp, { selector: '[data-testid="record-actions"] form' });
      here.read("The form, read in order", form);
      report.stops.form = form.said.map((one) => one.line);
      check("an act's form: every field and button is named in words", form.controls.length > 0 && unnamed(form).length === 0, { unnamed: unnamed(form) });
      // Roadmap f-edit-form-prefilled: the record's change opens on what the record holds, never "—": no field left blank that the page's facts say has a value.
      const blank = await ada.evaluate(() =>
        [...document.querySelectorAll('[data-testid="record-actions"] form :is(input[type=text], textarea, select)')]
          .filter((one) => one.value === "" && [...document.querySelectorAll(`dd [data-graview-field="${one.name}"]`)].some((fact) => fact.textContent.trim() !== ""))
          .map((one) => one.name),
      );
      check("an act's form: every field opens on the record's value, never “—”", blank.length === 0 && form.said.every((one) => !/, —, pop-up button/.test(one.line)), { blank });
      await ada.keyboard.press("Escape");
      await ada.waitForTimeout(500);
      const putAway = await focusSaid(ada, cdp);
      here.focus("Escape", putAway);
      check("an act's form: Escape gives the keyboard back to the act that opened it", !putAway.lost && /Change the feature/.test(putAway.name ?? ""), { focus: putAway.line });
      // Open again and send it: the summary said again, a few words longer.
      await press(opener);
      await ada.waitForTimeout(600);
      const since = Date.now();
      const summary = ada.locator('[data-testid="record-actions"] form textarea, [data-testid="record-actions"] form input[type=text]').last();
      await summary.focus();
      await ada.keyboard.press("ControlOrMeta+End");
      await ada.keyboard.type(" Said aloud.");
      await press(ada.locator('[data-testid="record-actions"] form button[type="submit"]').first());
      await ada.waitForTimeout(1200);
      const afterSend = await focusSaid(ada, cdp);
      here.focus("sending it", afterSend);
      const heard = await heardSince(ada, since);
      here.heard("after sending it", heard);
      check("an act's form: after it is sent the keyboard is on the page, not lost", !afterSend.lost, { focus: afterSend.line });
      check("an act's form: what it did is said aloud", heard.length > 0, { heard });
      check("an act's form: what it did is said in words, with no field's key, no arrow and no value in a program's quotes", heard.length > 0 && heard.every((one) => !SAID_AS_KEPT.test(one.text)), { heard });
    }

    /* ── 6. A COLUMNS LENS ── */
    reach("a columns lens");
    {
      const here = stop("Roadmap", "A columns lens", "The Roadmap board: features in columns by stage, reached from the home by the keyboard; a card carried by the keyboard, moved from its menu's Move to ›, and dragged.");
      await press(ada.getByRole("navigation").getByRole("link", { name: "Home", exact: true }));
      await ada.waitForTimeout(800);
      await press(ada.getByRole("link", { name: /^Roadmap\b/ }).first());
      await ada.waitForTimeout(1200);
      const focus = await focusSaid(ada, cdp);
      here.focus("following the Roadmap link", focus);
      check("a columns lens: following its link puts the keyboard on its heading", !focus.lost && focus.role === "heading" && /Roadmap/.test(focus.name ?? ""), { focus: focus.line });
      const order = await readingOrder(ada, cdp, { selector: "#app", skip: [BAR, ASK], items: 2 });
      here.read("Read in order (each column to its first two cards)", order);
      report.stops.columns = order.said.map((one) => one.line);
      check("a columns lens: every control is named in words", unnamed(order).length === 0, { unnamed: unnamed(order).slice(0, 12) });
      check("a columns lens: no mark is read as a word of its own", bareMarks(order).length === 0, { marks: bareMarks(order) });
      // A card says its name once, and first: "Themes without a build, link", then what it is.
      const cards = order.said.filter((one) => one.role === "link").map((one) => one.name);
      const firstCard = cards.find((name) => order.said.some((one) => one.role === "StaticText" && one.name === name));
      check("a columns lens: a card's name is said once, as its link, before its details", firstCard === undefined, { saidTwice: firstCard ?? null });
      /*
       * NO BUTTON UNDER EVERY CARD (Roadmap f-board-move-without-buttons): a
       * card is one stop that says how it moves, and is moved three ways —
       * carried by the keyboard, from its menu's "Move to ›", and dragged —
       * each said aloud.
       */
      check("a columns lens: no Move… button stands under a card", (await ada.getByRole("button", { name: /^Move “/ }).count()) === 0, {});
      const card = ada.locator("#app [data-testid='columns-lens'] [data-graview-listed][draggable='true'] .graview-spec-item-link").first();
      const moving = (await card.getAttribute("aria-label")) ?? "";
      const described = await card.evaluate((link) => document.getElementById(link.getAttribute("aria-describedby") ?? "")?.textContent ?? "");
      check("a columns lens: a card says how it moves", /Space picks it up/.test(described), { described });
      // Carried by the keyboard: Space, the next column it may go to, Space.
      let since = Date.now();
      await card.focus();
      await ada.keyboard.press(" ");
      await ada.waitForTimeout(300);
      await ada.keyboard.press("ArrowRight");
      await ada.waitForTimeout(300);
      const carried = await heardSince(ada, since);
      here.heard(`picking up “${moving}” and carrying it a column on`, carried);
      check("a columns lens: a card picked up by the keyboard is said picked up, with its column and its place", carried.some((one) => one.text.includes(`${moving}, picked up.`) && / \d+ of \d+\./.test(one.text)), { carried, moving });
      check("a columns lens: each step the keyboard carries a card is said", carried.length >= 2 && / \d+ of \d+\.$/.test(carried.at(-1)?.text ?? ""), { carried });
      since = Date.now();
      await ada.keyboard.press(" ");
      await ada.waitForTimeout(1200);
      const afterCarry = await focusSaid(ada, cdp);
      here.focus("dropping it", afterCarry);
      const dropped = await heardSince(ada, since);
      here.heard("after the drop", dropped);
      check("a columns lens: a card dropped by the keyboard is moved, said aloud, and keeps the keyboard", dropped.some((one) => one.text.includes(`${moving}, dropped in`)) && dropped.some((one) => one.text.includes(`Moved “${moving}”`)) && !afterCarry.lost && afterCarry.name === moving, { dropped, focus: afterCarry.line });
      // From its menu: Shift+F10 on the card, "Move to ›", the first column it may go to.
      since = Date.now();
      await ada.keyboard.press("Shift+F10");
      await ada.waitForTimeout(800);
      const row = ada.locator('[data-testid="context-menu"] [data-menu-item="move-to"]');
      const offered = (await row.count()) > 0;
      if (offered) {
        await press(row);
        await ada.waitForTimeout(300);
      }
      const inMenu = await focusSaid(ada, cdp);
      here.focus("opening its menu's Move to ›", inMenu);
      check("a columns lens: a card's menu says Move to › and takes the keyboard to the first column it may go to", offered && !inMenu.lost && inMenu.role === "button", { focus: inMenu.line });
      await ada.keyboard.press("Enter");
      await ada.waitForTimeout(1200);
      const afterMenu = await focusSaid(ada, cdp);
      here.focus("choosing a column from the menu", afterMenu);
      const fromMenu = await heardSince(ada, since);
      here.heard("after the move from the menu", fromMenu);
      check("a columns lens: after a move from the menu the keyboard is on the page, not lost", !afterMenu.lost, { focus: afterMenu.line });
      check("a columns lens: a move from the menu is said aloud", fromMenu.some((one) => one.text.includes(`Moved “${moving}”`)), { heard: fromMenu, moving });
      // Dragged, as a pointer does: onto the next column that takes it.
      since = Date.now();
      const dragged = await ada.evaluate(() => {
        const first = document.querySelector("#app [data-testid='columns-lens'] [data-graview-listed][draggable='true']");
        const from = first?.closest("[data-graview-column]")?.getAttribute("data-graview-column");
        const to = [...document.querySelectorAll("#app [data-graview-column]")].map((column) => column.getAttribute("data-graview-column")).find((value) => value && value !== from);
        return first && to ? { id: first.getAttribute("data-graview-listed"), to } : null;
      });
      if (dragged) await ada.dragAndDrop(`#app [data-graview-listed="${dragged.id}"]`, `#app [data-graview-column="${dragged.to}"]`).catch(() => {});
      await ada.waitForTimeout(1200);
      const byDrag = await heardSince(ada, since);
      here.heard("after a drag", byDrag);
      check("a columns lens: a card dragged onto a column is moved and said aloud", byDrag.some((one) => one.text.startsWith("Moved “")), { heard: byDrag, dragged });
    }

    /* ── 7. A BLOCKS LENS ── */
    reach("a blocks lens");
    {
      const here = stop("Roadmap", "A blocks lens", "“Up next”: a headline and a list of cards, reached from the home by the keyboard.");
      await press(ada.getByRole("navigation").getByRole("link", { name: "Home", exact: true }));
      await ada.waitForTimeout(800);
      await press(ada.getByRole("link", { name: /^Up next\b/ }).first());
      await ada.waitForTimeout(1200);
      const focus = await focusSaid(ada, cdp);
      here.focus("following the Up next link", focus);
      check("a blocks lens: following its link puts the keyboard on its heading", !focus.lost && focus.role === "heading" && /Up next/.test(focus.name ?? ""), { focus: focus.line });
      const order = await readingOrder(ada, cdp, { selector: "#app", skip: [BAR, ASK] });
      here.read("Read in order", order);
      report.stops.blocks = order.said.map((one) => one.line);
      check("a blocks lens: every control is named in words", unnamed(order).length === 0, { unnamed: unnamed(order) });
      check("a blocks lens: no mark is read as a word of its own", bareMarks(order).length === 0, { marks: bareMarks(order) });
      const levels = order.headings.map((one) => one.level);
      check("a blocks lens: its headline sits under the page's heading", levels.length >= 2 && levels.slice(1).every((level, index) => level <= levels[index] + 1), { headings: order.headings });
      const cards = order.said.filter((one) => one.role === "link").map((one) => one.name);
      const twice = cards.find((name) => order.said.some((one) => one.role === "StaticText" && one.name === name));
      check("a blocks lens: a card's name is said once, as its link", twice === undefined, { saidTwice: twice ?? null });
    }

    /* ── 8. NO ASK BOX ── */
    reach("no Ask box");
    {
      /*
       * The Ask box is retired (Roadmap f-quick-ask-framework): no region at
       * the foot to be read past on every page. The Roadmap is lent no model,
       * so no quick ask is drawn either; todo's quick ask is walked below.
       */
      const here = stop("Roadmap", "No Ask box", "No field at the foot of the page, and no quick ask where no model is lent.");
      const regions = await ada.getByRole("region", { name: /^Ask / }).count();
      here.read("Read in order", await readingOrder(ada, cdp, { selector: "#app", skip: [BAR], items: 2 }));
      check("no Ask box: no region asks at the page's foot", regions === 0, { regions });
    }

    /* ── 9. A CHANGE FROM SOMEONE ELSE ── */
    /*
     * Twice: with Ada and Ben shown to each other, and with presence off, as
     * a served store's change arrives with nobody shown here (Roadmap
     * f-changes-heard-without-presence). Either way it is said once, with
     * who made it, in words (f-change-sentences-in-words).
     */
    for (const [title, note, shown, claim] of [
      ["A change from someone else", "Ada is on a feature's page, her keyboard on one of its facts; Ben, in another tab sharing the store, changes its stage.", true, "a change from someone else"],
      ["A change from a served store, nobody shown here", "As above with presence off: Ada is shown nobody, and Ben's op arrives as a served store's does.", false, "a change from a served store with nobody shown here"],
    ]) {
    reach(claim);
    {
      const here = stop("Roadmap", title, note);
      const path = report.recordPath ?? "/features/feature-0";
      const at = (as) => `${ROADMAP_AT(path, as)}${shown ? "" : "&presence=off"}`;
      await ada.goto(at("ada"), { waitUntil: "load" });
      await roadmapReady(ada);
      const ben = await open(at("ben"), roadmapReady);
      await ada.waitForTimeout(1500);
      const shownHere = await ada.locator('[data-testid="here"]').count();
      // Ada's keyboard on a fact, as a person reading the page would leave it.
      await ada.locator('dd button[data-graview-field="layer"], dd button[data-graview-field]').first().focus();
      const before = await focusSaid(ada, cdp);
      const since = Date.now();
      const stage = ben.locator('dd button[data-graview-field="stage"]').first();
      await stage.click();
      const choice = ben.locator('select').first();
      const now = await choice.inputValue();
      const options = await choice.locator("option").evaluateAll((all) => all.map((one) => one.value).filter(Boolean));
      await choice.selectOption(options.find((one) => one !== now) ?? options[0]);
      await choice.press("Enter").catch(() => undefined);
      await ada.waitForTimeout(2500);
      const heard = await heardSince(ada, since);
      here.heard("on Ada's page when Ben changed the stage", heard);
      const after = await focusSaid(ada, cdp);
      here.focus("Ben's change (Ada's keyboard was on a fact)", after);
      const his = heard.filter((one) => /Ben Okafor/.test(one.text));
      check(`${claim}: it is said aloud, with who made it`, his.length > 0, { heard });
      check(`${claim}: it is said once`, his.length === 1, { heard });
      check(`${claim}: it is said in words, with no field's key, no arrow and no value in a program's quotes`, his.length > 0 && his.every((one) => !SAID_AS_KEPT.test(one.text)), { heard });
      check(`${claim}: Ada's keyboard stays where it was`, !after.lost && after.line === before.line, { before: before.line, after: after.line });
      if (!shown) check(`${claim}: nobody is shown here`, shownHere === 0, { shownHere });
      await ben.close();
    }
    }

    await ada.close();
    /* ── TODO: the same stops on the example, standalone ── */
    reach("todo");
    {
      const todo = await open(TODO_AT("/pages"), todoReady);
      const tcdp = await cdpOf(todo);
      const bar = stop("Things (todo)", "The bar", "The todo example's routed face, standalone: its own banner, main and footer.");
      const barOrder = await readingOrder(todo, tcdp, { selector: "header" });
      bar.read("Read in order", barOrder);
      const landmarks = (await readingOrder(todo, tcdp)).landmarks.map((one) => one.line);
      bar.note("Landmarks", landmarks);
      check("todo · the bar: every control is named in words", unnamed(barOrder).length === 0, { unnamed: unnamed(barOrder) });
      check("todo · the page has a banner, a main and a footer", ["banner", "main", "contentinfo"].every((role) => landmarks.some((line) => line.includes(`${role} landmark`))), { landmarks });

      const list = stop("Things (todo)", "A list", "Tasks, from the bar's places by the keyboard.");
      await press(todo.getByRole("navigation").getByRole("link", { name: "Tasks", exact: true }));
      await todo.waitForTimeout(1000);
      const focus = await focusSaid(todo, tcdp);
      list.focus("following the Tasks link", focus);
      check("todo · a list: following a place's link puts the keyboard on the list's heading", !focus.lost && focus.role === "heading", { focus: focus.line });
      const listOrder = await readingOrder(todo, tcdp, { selector: "main" });
      list.read("Read in order (each list to its first three)", listOrder);
      check("todo · a list: every control is named in words", unnamed(listOrder).length === 0, { unnamed: unnamed(listOrder).slice(0, 12) });
      check("todo · a list: no mark is read as a word of its own (⚠ said as what it means)", bareMarks(listOrder).length === 0, { marks: bareMarks(listOrder) });

      const record = stop("Things (todo)", "A record page", "“Pay the deposit”, which is late, opened from the list.");
      await press(todo.getByRole("main").getByRole("link", { name: "Pay the deposit", exact: true }).first());
      await todo.waitForTimeout(1000);
      const onRecord = await focusSaid(todo, tcdp);
      record.focus("opening it", onRecord);
      check("todo · a record page: opening a record puts the keyboard on its heading", !onRecord.lost && onRecord.role === "heading", { focus: onRecord.line });
      const recordOrder = await readingOrder(todo, tcdp, { selector: "main" });
      record.read("Read in order", recordOrder);
      check("todo · a record page: every control is named in words", unnamed(recordOrder).length === 0, { unnamed: unnamed(recordOrder) });
      check("todo · a record page: no mark is read as a word of its own", bareMarks(recordOrder).length === 0, { marks: bareMarks(recordOrder) });
      const facts = await factsSaid(todo);
      check("todo · a record page: each fact changed in place says which fact it is", facts.said.length > 0 && facts.bare.length === 0, facts);

      const form = stop("Things (todo)", "An act's form", "“Rename …” on the record page: opened, sent, and the keyboard after.");
      const opener = todo.getByRole("main").getByRole("button", { name: /^Rename/ }).first();
      await press(opener);
      await todo.waitForTimeout(600);
      const inForm = await focusSaid(todo, tcdp);
      form.focus("opening it", inForm);
      check("todo · an act's form: opening it puts the keyboard in its first field", !inForm.lost && /text|textbox/.test(inForm.line), { focus: inForm.line });
      form.read("The form, read in order", await readingOrder(todo, tcdp, { selector: "main form" }));
      const since = Date.now();
      await todo.locator('main form input[type="text"], main form textarea').first().focus();
      await todo.keyboard.press("ControlOrMeta+a");
      await todo.keyboard.type("Pay the deposit today");
      await todo.keyboard.press("Enter");
      await todo.waitForTimeout(1200);
      const afterSend = await focusSaid(todo, tcdp);
      form.focus("sending it", afterSend);
      const heard = await heardSince(todo, since);
      form.heard("after sending it", heard);
      check("todo · an act's form: after it is sent the keyboard is on the page, not lost", !afterSend.lost, { focus: afterSend.line });
      check("todo · an act's form: what it did is said aloud", heard.length > 0, { heard });

      const ask = stop("Things (todo)", "The quick ask", "⌘K on a task's page, lent a stub model, asked what is left.");
      await todo.goto(`${TODO_AT("/pages/tasks/t-deposit")}&ai=stub`, { waitUntil: "load" });
      await todoReady(todo);
      await todo.keyboard.press("ControlOrMeta+K");
      await todo.waitForSelector(ASK, { timeout: 30_000 }).catch(() => undefined);
      const card = todo.getByRole("region", { name: /^Ask about / });
      const named = await card.count();
      const box = card.getByRole("combobox").first();
      const asked = Date.now();
      await box.fill("What is left?");
      await box.press("Enter");
      await todo.waitForTimeout(2500);
      const askFocus = await focusSaid(todo, tcdp);
      ask.focus("asking", askFocus);
      const askHeard = await heardSince(todo, asked);
      ask.heard("after asking", askHeard);
      const after = await readingOrder(todo, tcdp, { selector: ASK });
      ask.read("The answer card", after);
      check("todo · the quick ask: it is a region named for what it is about", named === 1, { named });
      check("todo · the quick ask: the keyboard stays on the card after asking", !askFocus.lost, { focus: askFocus.line });
      check("todo · the quick ask: the answer is said aloud", askHeard.length > 0, { heard: askHeard });
      check("todo · the quick ask: every control is named in words", unnamed(after).length === 0, { unnamed: unnamed(after) });
      await todo.close();
    }
    await context.close();
    await browser.close();
    browser = undefined;
  }
  check("no page threw", report.pageErrors.length === 0, { errors: report.pageErrors.slice(0, 10) });
} catch (error) {
  report.error = `${reach.at()}: ${String(error?.message ?? error).split("\n")[0]}`;
  check(`reached the end (stopped at ${reach.at()})`, false, { error: report.error });
} finally {
  reach.done();
  await browser?.close().catch(() => undefined);
  host?.stop();
  for (const server of servers) server.stop();
}

/* ── the verdict, and the written walk ─────────────────────────────────── */

report.passed = Object.values(report.checks).every((one) => one.ok);
writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);

const failing = Object.entries(report.checks).filter(([, one]) => !one.ok).map(([name]) => name);
const md = [
  "# What a screen reader is told",
  "",
  "Written by `scripts/verify-screen-reader.mjs` from the accessibility tree Chromium exposes (CDP `Accessibility.getFullAXTree`), read in document order the way a screen reader moves through a page: each line is what it would say at that point, as *name, role, state*. Lists are cut to their first few items. **Focus after** is where the keyboard is after the act or navigation, and **Heard** is what the live regions said, as a reader announces it without moving.",
  "",
  "No system screen reader was turned on to write this. `scripts/voiceover-walk.mjs` listens to the same stops with real VoiceOver in Safari, when somebody chooses to.",
  "",
  `Claims: ${Object.keys(report.checks).length - failing.length} of ${Object.keys(report.checks).length} hold${failing.length ? ` — not yet: ${failing.join("; ")}` : ""}. The verdict is \`docs/screen-reader.json\`.`,
  "",
];
for (const entry of walk) {
  md.push(`## ${entry.app}: ${entry.title}`, "", entry.note, "");
  for (const section of entry.sections) {
    md.push(`**${section.heading}**`, "", "```text", ...section.lines.map((line) => line.replace(/```/g, "'''")), "```", "");
  }
}
writeFileSync(WALK, `${md.join("\n").trimEnd()}\n`);

for (const [name, one] of Object.entries(report.checks)) process.stdout.write(`${one.ok ? "ok  " : "FAIL"} ${name}\n`);
process.stdout.write(`\n${Object.keys(report.checks).length - failing.length} of ${Object.keys(report.checks).length} claims hold — docs/screen-reader.json, docs/screen-reader-walk.md\n`);
process.exit(report.passed ? 0 : 1);
