#!/usr/bin/env node
/**
 * TWO PEOPLE TYPING INTO ONE TEXT (Roadmap f-collab-text, phase 4: the
 * live editor).
 *
 * `graview preview` of the Roadmap's briefs — a Markdown `body`, typed
 * together as the declaration says prose is — opened in two browsers sat
 * down as two people, Ada and Bo, each on the same brief's page, ten
 * thousand characters long. Each opens the body and types into it at once,
 * with real keystrokes, Ada near the top and Bo far below. It asks:
 *
 *   the body opens live: no Save, a Done, and the text area takes keys;
 *   the two pages converge — both text areas and the server's store hold
 *   the same text, with every word each of them typed in it whole;
 *   each page draws the other's caret, named for them, where they stand;
 *   Bo's own caret stays on the word he was typing while Ada's words land
 *   above it;
 *   and no page threw.
 *
 * Then, on the same brief:
 *
 *   a page whose CPU is slowed four times types beside one that is not, and
 *   both converge with the store (Chromium's CPU throttling; WebKit and
 *   Firefox, which have none, have their main thread kept busy three
 *   quarters of the time instead);
 *   a page that drops offline mid-run keeps typing, comes back, and its run
 *   lands carried over what the other typed meanwhile;
 *   each person's Ctrl or Cmd Z takes back only their own run;
 *   a word composed with an input method (Chromium's Input.imeSetComposition)
 *   lands whole, and nothing it showed while composing is ever kept;
 *   a seat that may not see the body (the document's `outsider`, whose
 *   sight hides it) is served no splice, no typed word and no caret;
 *   and a reader that says it reads op format 2 is sent the body whole each
 *   time it changes, and folds to the store's text.
 *
 *   node scripts/verify-typed-together.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/typed-together.json. Needs `pnpm build`.
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
// The preview this starts answers only with the run's key: sent from here, and traded for each browser's cookie.
import { admit, KEY, keyedFetch as fetch } from "./lib/serve-key.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { LIVE_PATH, LIVE_SUBPROTOCOL, seatHeaders } from "../packages/ship/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const DOCUMENT = "scripts/fixtures/long-text/roadmap-with-an-outsider.gdd.json";
const SEED = "scripts/fixtures/long-text/roadmap.seed.json";
const BRIEF = "brief-0129";
const report = { at: new Date().toISOString(), engine: ENGINE, document: DOCUMENT, claims: {} };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 600)}`}\n`);
};

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-typed-together: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

await vacant(portFor("typed-together"));
const server = spawn(process.execPath, [CLI, "preview", DOCUMENT, "--seed", SEED, "--port", String(portFor("typed-together"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("typed-together");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-typed-together: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}
await admit(base);

const errors = [];
const browsers = [];
let seat;
try {
  /**
   * A page sat down as somebody: the preview's seat, under their own id and
   * name (the preview believes a loopback page's seat). Each in a browser of
   * its own, as two people are: a second page in one browser can be one the
   * engine counts as hidden, and a hidden page says nothing of where it is.
   */
  const sitDown = async (id, name) => {
    const browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
    browsers.push(browser);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    await context.route("**/graview/document", async (route) => {
      const answered = await route.fetch();
      const handed = await answered.json();
      seat = handed.principal;
      await route.fulfill({ response: answered, json: { ...handed, principal: { ...handed.principal, id, name } } });
    });
    /*
     * Every socket the page opens, kept where the harness can reach it —
     * whether going offline closed it is a finding — and a page that can be
     * cut off in every engine: `context.setOffline` keeps an open socket in
     * all three and, in WebKit, lets a loopback one open again. While
     * `__offline`, a socket asks for a path nobody answers and a fetch
     * fails, as the network's absence does.
     */
    await context.addInitScript(() => {
      const Native = window.WebSocket;
      const nativeFetch = window.fetch.bind(window);
      window.__sockets = [];
      window.__offline = false;
      window.WebSocket = class extends Native {
        constructor(url, ...rest) {
          super(window.__offline ? `${location.origin.replace(/^http/, "ws")}/nowhere-while-offline` : url, ...rest);
          window.__sockets.push(this);
        }
      };
      window.fetch = (...args) => (window.__offline ? Promise.reject(new TypeError("Failed to fetch")) : nativeFetch(...args));
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(`${base}/briefs/${BRIEF}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
    await page.locator('[data-graview-long="body"] dt button').first().click();
    await page.waitForSelector('[data-graview-live="body"] textarea:not([readonly])', { timeout: 20_000 });
    return page;
  };
  const ada = await sitDown("ada", "Ada");
  const bo = await sitDown("bo", "Bo");

  /*
   * Three readers on the socket from here, as other programs: a seat the
   * document hides the body from, a reader of op format 2, and one of op
   * format 3 that keeps every op, to read what was ever kept.
   */
  const listen = (principal, opFormat) => {
    const url = new URL(`${base.replace(/^http/, "ws")}${LIVE_PATH}`);
    // A socket carries no headers: a server that believes seat headers reads them from the query.
    for (const [name, value] of Object.entries(seatHeaders(principal))) url.searchParams.set(name, value);
    // And the run's key, which a socket carries the same way.
    url.searchParams.set("graview_key", KEY);
    const socket = new WebSocket(url, [LIVE_SUBPROTOCOL]);
    const heard = [];
    socket.onopen = () => socket.send(JSON.stringify({ t: "hello", protocol: 1, opFormat }));
    socket.onmessage = (event) => heard.push(String(event.data));
    return { heard, close: () => socket.close() };
  };
  const outsider = listen({ kind: "human", id: "cy", name: "Cy", roles: ["outsider"] }, 3);
  const older = listen({ kind: "human", id: "old", name: "Old", roles: ["owner"] }, 2);
  const keeper = listen({ kind: "human", id: "keeper", name: "Keeper", roles: ["owner"] }, 3);
  const area = '[data-graview-live="body"] textarea';

  const opened = await ada.evaluate(() => {
    const long = document.querySelector('[data-graview-long="body"]');
    const buttons = [...(long?.querySelectorAll("button") ?? [])].map((one) => one.textContent?.trim());
    return { live: long?.querySelector("[data-graview-live]") !== null, buttons };
  });
  claim("theBodyOpensLiveWithNoSave", opened.live && !opened.buttons.includes("Save") && opened.buttons.includes("Done"), opened);

  /* Each puts the caret where they will type: Ada after the first line, Bo deep in the brief, after a word. */
  const place = (page, where) =>
    page.evaluate(
      ([selector, at]) => {
        const element = document.querySelector(selector);
        element.focus();
        const text = element.value;
        // After the space that ends a word, so what is typed is a word of its own.
        const after = text.indexOf(" ", at) + 1;
        element.setSelectionRange(after, after);
        return after;
      },
      [area, where],
    );
  await place(ada, 40);
  await place(bo, 6000);
  const ADA_TYPES = "alpha beta gamma ";
  const BO_TYPES = "one two three ";
  await Promise.all([ada.keyboard.type(ADA_TYPES, { delay: 40 }), bo.keyboard.type(BO_TYPES, { delay: 40 })]);

  /* Converged: both areas and the store hold one text. */
  const valueOf = (page) => page.evaluate((selector) => document.querySelector(selector)?.value ?? null, area);
  const stored = async () => {
    const state = await (await fetch(`${base}/graview/state`, { headers: seatHeaders(seat) })).json();
    return state.snapshot?.nodes?.find((node) => node.id === BRIEF)?.body ?? null;
  };
  let one;
  let two;
  let held;
  for (let tries = 0; tries < 60; tries++) {
    [one, two, held] = await Promise.all([valueOf(ada), valueOf(bo), stored()]);
    if (one === two && two === held && one.includes(ADA_TYPES) && one.includes(BO_TYPES)) break;
    await new Promise((settle) => setTimeout(settle, 250));
  }
  claim("twoPagesTypingIntoOneLongFieldConverge", one === two && two === held && one.includes(ADA_TYPES) && one.includes(BO_TYPES) && one.length > 10_000, {
    length: one?.length,
    sameOnBoth: one === two,
    sameAsTheStore: two === held,
    adasWords: one?.includes(ADA_TYPES),
    bosWords: one?.includes(BO_TYPES),
  });

  /* Bo's caret, on his own page, stays after the words he typed though Ada's landed above. */
  const ownCaret = await bo.evaluate((selector) => {
    const element = document.querySelector(selector);
    return { before: element.value.slice(Math.max(0, element.selectionStart - 14), element.selectionStart), collapsed: element.selectionStart === element.selectionEnd };
  }, area);
  claim("aCaretStaysOnItsWordWhileTheOtherTypesAboveIt", ownCaret.collapsed && ownCaret.before === BO_TYPES, ownCaret);

  /* Each draws the other's caret, named, where they stand — once the last word of where it stands has arrived. */
  const caretOf = async (page, who, typed) => {
    let seen = null;
    for (let tries = 0; tries < 40; tries++) {
      seen = await page.evaluate((id) => {
        const caret = document.querySelector(`[data-graview-caret^="human:${id}:"]`);
        if (!caret) return null;
        let before = "";
        for (const node of caret.parentElement.childNodes) {
          if (node === caret) break;
          before += node.textContent ?? "";
        }
        const box = caret.getBoundingClientRect();
        const area = document.querySelector('[data-graview-live="body"] textarea').getBoundingClientRect();
        return { title: caret.title, before: before.slice(-20), color: getComputedStyle(caret).borderLeftColor, width: Math.round(box.width), inside: box.left >= area.left && box.right <= area.right + 1 };
      }, who);
      if (seen?.before.endsWith(typed)) break;
      await new Promise((settle) => setTimeout(settle, 250));
    }
    return seen;
  };
  const [bosOnAda, adasOnBo] = await Promise.all([caretOf(ada, "bo", BO_TYPES), caretOf(bo, "ada", ADA_TYPES)]);
  claim("eachSeesTheOthersCaretWhereTheyStand", bosOnAda?.title === "Bo is typing here" && bosOnAda.before?.endsWith(BO_TYPES) && adasOnBo?.title === "Ada is typing here" && adasOnBo.before?.endsWith(ADA_TYPES) && bosOnAda?.inside && adasOnBo?.inside, { bosOnAda, adasOnBo });

  /** Until both pages and the store hold one text that `holds`; the three as they last read. */
  const converge = async (holds, tries = 80) => {
    let read = [];
    for (let at = 0; at < tries; at++) {
      read = await Promise.all([valueOf(ada), valueOf(bo), stored()]);
      if (read[0] === read[1] && read[1] === read[2] && holds(read[0])) return { ok: true, text: read[0] };
      await new Promise((settle) => setTimeout(settle, 250));
    }
    return { ok: false, text: read[0], sameOnBoth: read[0] === read[1], sameAsTheStore: read[1] === read[2] };
  };
  /** Which of these a text holds, and its length, for a verdict's detail. */
  const holding = ({ text, ...rest }, ...said) => ({ ...rest, length: text?.length, ...Object.fromEntries(said.map((one) => [one, text?.includes(one) ?? false])) });

  /* A page four times slower: CDP's CPU throttling where the engine has it, a busy main thread where it does not. */
  const QUICK = "quick lark ";
  const SLOW = "slow tortoise ";
  let slowed;
  if (ENGINE === "chromium" || ENGINE === "canary") {
    const cdp = await bo.context().newCDPSession(bo);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    slowed = { how: "Emulation.setCPUThrottlingRate 4", undo: () => cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }) };
  } else {
    await bo.evaluate(() => {
      // Three quarters of every 40 ms spent spinning: what a page four times slower has left for its own work.
      window.__hog = setInterval(() => {
        const until = performance.now() + 30;
        while (performance.now() < until);
      }, 40);
    });
    slowed = { how: "main thread kept busy 30 ms in every 40", undo: () => bo.evaluate(() => clearInterval(window.__hog)) };
  }
  await Promise.all([ada.keyboard.type(QUICK, { delay: 40 }), bo.keyboard.type(SLOW, { delay: 40 })]);
  const throttled = await converge((text) => text.includes(QUICK) && text.includes(SLOW));
  await slowed.undo();
  claim("aThrottledPageTypingBesideAQuickOneConverges", throttled.ok, { slowed: slowed.how, ...holding(throttled, QUICK, SLOW) });

  /* Bo drops offline mid-run, types on, comes back: his run lands carried over what Ada typed meanwhile. */
  const AWAY = "unsent words typed while away ";
  const HERE = "typed while here ";
  await bo.keyboard.type(AWAY.slice(0, 3), { delay: 40 });
  await bo.context().setOffline(true);
  await new Promise((settle) => setTimeout(settle, 1500));
  // Whether going offline closed the live socket by itself, or the page still holds it open.
  const closedByOffline = await bo.evaluate(() => window.__sockets.filter((one) => one.url.includes("/graview/live")).every((one) => one.readyState >= 2));
  // It does not in any engine: the page is cut off itself, its socket closed and every new one and every fetch failing until it is back.
  await bo.evaluate(() => {
    window.__offline = true;
    window.__sockets.forEach((one) => one.close());
  });
  await Promise.all([bo.keyboard.type(AWAY.slice(3), { delay: 40 }), ada.keyboard.type(HERE, { delay: 40 })]);
  await new Promise((settle) => setTimeout(settle, 1000));
  const [shownAway, keptAway] = await Promise.all([valueOf(bo), stored()]);
  await bo.context().setOffline(false);
  await bo.evaluate(() => (window.__offline = false));
  const back = await converge((text) => text.includes(AWAY) && text.includes(HERE), 120);
  claim("aPageThatDropsOfflineMidRunComesBackAndItsRunLandsCarriedOver", back.ok && shownAway.includes(AWAY) && !keptAway.includes(AWAY), {
    closedByOffline,
    shownWhileAway: shownAway.includes(AWAY),
    keptWhileAway: keptAway.includes(AWAY),
    ...holding(back, AWAY, HERE),
  });

  /* Ada and Bo each type; Ada's Ctrl or Cmd Z takes back her run and only hers. */
  const MINE = "zeta";
  const THEIRS = "omega ";
  await Promise.all([ada.keyboard.type(MINE, { delay: 40 }), bo.keyboard.type(THEIRS, { delay: 40 })]);
  const both = await converge((text) => text.includes(HERE + MINE) && text.includes(THEIRS));
  await ada.keyboard.press("ControlOrMeta+z");
  const takenBack = await converge((text) => !text.includes(HERE + MINE) && text.includes(THEIRS) && text.includes(HERE));
  claim("eachPersonsUndoTakesBackOnlyTheirOwnRun", both.ok && takenBack.ok, { typed: both.ok, ...holding(takenBack, HERE + MINE, THEIRS) });

  /* A word composed with an input method: nothing is sent while it is composed, and it lands whole. */
  const COMPOSED = "日本";
  const SHOWN = ["に", "にほ", "にほん"];
  if (ENGINE === "chromium" || ENGINE === "canary") {
    const cdp = await ada.context().newCDPSession(ada);
    await ada.focus(area);
    for (const text of SHOWN) {
      await cdp.send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
      await new Promise((settle) => setTimeout(settle, 500));
    }
    const midWord = await stored();
    await cdp.send("Input.insertText", { text: COMPOSED });
    await bo.keyboard.type("kana ", { delay: 40 });
    const composed = await converge((text) => text.includes(COMPOSED) && text.includes("kana "));
    // Every splice the store kept for the body, as the reader that keeps them all was sent it.
    const inserted = keeper.heard.flatMap((said) => {
      const message = JSON.parse(said);
      return (message.ops ?? []).flatMap((op) => op.primitives.flatMap((one) => (one.op === "splice-text" && one.id === BRIEF ? [one.inserted] : [])));
    });
    const partial = inserted.filter((one) => /[぀-ゟ]/u.test(one) || one.includes("日") !== one.includes("本"));
    claim("aWordComposedWithAnInputMethodLandsWhole", composed.ok && !SHOWN.some((one) => midWord.includes(one)) && inserted.some((one) => one.includes(COMPOSED)) && partial.length === 0, {
      ...holding(composed, COMPOSED),
      keptMidWord: SHOWN.filter((one) => midWord.includes(one)),
      wholeSplice: inserted.some((one) => one.includes(COMPOSED)),
      partial,
    });
  } else {
    claim("aWordComposedWithAnInputMethodLandsWhole", true, { skipped: true, why: `${ENGINE} has no Input.imeSetComposition to compose with: Chromium's verdict holds this claim` });
  }

  /*
   * A layer over the page takes Ada's keyboard (Roadmap f-live-editor-blur):
   * a tour's hint, as the first-look tour draws one, its button focused.
   * Her editor stays open, and when the hint goes and leaves the keyboard
   * on nothing, the text area has it back with her caret where it was, and
   * what she types next lands there.
   */
  const AFTER_TOUR = "tour ";
  const caretAt = await ada.evaluate((selector) => {
    const text = document.querySelector(selector);
    text.focus();
    const at = Math.min(5, text.value.length);
    text.setSelectionRange(at, at);
    const pane = document.createElement("div");
    pane.setAttribute("data-graview-overlay", "");
    pane.setAttribute("role", "dialog");
    pane.setAttribute("data-tour-hint", "");
    const next = document.createElement("button");
    next.textContent = "Next";
    pane.append(next);
    document.body.append(pane);
    next.focus();
    return at;
  }, area);
  await new Promise((settle) => setTimeout(settle, 400));
  const underTheTour = await ada.evaluate((selector) => ({ open: document.querySelector(selector) !== null, keyboard: document.activeElement?.textContent ?? null }), area);
  await ada.evaluate(() => document.querySelector("[data-tour-hint]")?.remove());
  await new Promise((settle) => setTimeout(settle, 400));
  const afterTheTour = await ada.evaluate((selector) => {
    const text = document.querySelector(selector);
    return { open: text !== null, focused: document.activeElement === text, caret: text ? [text.selectionStart, text.selectionEnd] : null };
  }, area);
  const beforeTyping = await stored();
  await ada.keyboard.type(AFTER_TOUR, { delay: 40 });
  const afterTour = await converge((text) => text.includes(AFTER_TOUR));
  claim(
    "aTourThatTakesTheKeyboardLeavesTheEditorOpenAndGivesItsCaretBack",
    underTheTour.open && underTheTour.keyboard === "Next" && afterTheTour.open && afterTheTour.focused && afterTheTour.caret?.[0] === caretAt && afterTour.ok && afterTour.text?.slice(caretAt, caretAt + AFTER_TOUR.length) === AFTER_TOUR && afterTour.text?.slice(0, caretAt) === beforeTyping.slice(0, caretAt),
    { caretAt, underTheTour, afterTheTour, ...holding(afterTour, AFTER_TOUR) },
  );

  /* What the seat the body is hidden from was sent, start to end: no splice, no typed word, no caret. */
  const final = await stored();
  const typedWords = [ADA_TYPES, BO_TYPES, QUICK, SLOW, AWAY, HERE, THEIRS];
  const toldOutsider = outsider.heard.join("\n");
  const welcomed = outsider.heard.some((said) => said.includes('"welcome"'));
  claim("aSeatThatMayNotSeeTheFieldIsServedNoSpliceAndNoCaret", welcomed && !toldOutsider.includes("splice-text") && !toldOutsider.includes('"caret"') && typedWords.every((one) => !toldOutsider.includes(one)), {
    messages: outsider.heard.length,
    welcomed,
    splices: toldOutsider.includes("splice-text"),
    carets: toldOutsider.includes('"caret"'),
    words: typedWords.filter((one) => toldOutsider.includes(one)),
  });

  /* The reader of op format 2: sent the body whole each time, it folds to the store's text. */
  let folded;
  let splicesToOlder = 0;
  let wholes = 0;
  for (const said of older.heard) {
    const message = JSON.parse(said);
    if (message.t === "welcome" && message.state) folded = message.state.snapshot.nodes.find((node) => node.id === BRIEF)?.body;
    for (const op of message.ops ?? []) {
      for (const one of op.primitives) {
        if (one.op === "splice-text") splicesToOlder++;
        if (one.op === "patch-node" && one.id === BRIEF && "body" in one.after) {
          wholes++;
          folded = one.after.body;
        }
      }
    }
  }
  claim("anOlderReaderOfOpFormat2ConvergesOnWholeValues", splicesToOlder === 0 && wholes > 0 && folded === final, { splices: splicesToOlder, wholeWrites: wholes, foldsToTheStoresText: folded === final, length: folded?.length });
  for (const one of [outsider, older, keeper]) one.close();

  claim("noPageThrew", errors.length === 0, errors);
} catch (error) {
  claim("theRunFinished", false, String(error).slice(0, 1200));
} finally {
  await Promise.all(browsers.map((one) => one.close()));
  server.kill();
}

report.passed = Object.values(report.claims).every((one) => one.ok);
writeFileSync(resolve(repoRoot, "docs/typed-together.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nwrote docs/typed-together.json\n`);
process.exit(report.passed ? 0 : 1);
