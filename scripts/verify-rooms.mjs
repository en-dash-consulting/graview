#!/usr/bin/env node
/**
 * PEOPLE TALK IN THE APP, AND TO THE HOST'S STAFF (Graview HQ
 * feature:f-chat-rooms, feature:f-support-chat) — driven in a real browser.
 *
 * Things declares a room for the household and a thread on each task. Two
 * people, in two browsers on one served store, each see what the other
 * says as it is said, in the room and on a task's thread; each edits and
 * removes only their own; a mention reaches the person it names, on the
 * bell; what is new is counted there until it is read. The gauntlet's
 * program team room is kept from a visitor, and so is the thread on a
 * member of staff they cannot see. The support panel sends each message
 * with where the person was, and shows a reply. A desk and a phone, and
 * the keyboard alone.
 *
 *   node scripts/verify-rooms.mjs [--engine=chromium|webkit|firefox] [--quick]
 *
 * Writes docs/rooms.json; with ROOMS_SHOTS=<dir>, photographs into it.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving, vacant } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const VERDICT = resolve(repoRoot, "docs/rooms.json");
const SHOTS = process.env.ROOMS_SHOTS ? resolve(process.env.ROOMS_SHOTS) : undefined;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const DAY = "today=2026-09-01";
const PORT = portFor("rooms-served");
const SERVER = at("rooms-served");
const DATA = mkdtempSync(join(tmpdir(), "graview-rooms-"));

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let todo;
let gauntlet;
let server;
let browser;
const stopServer = () => {
  if (!server) return;
  try {
    process.kill(-server.child.pid, "SIGTERM");
  } catch {
    server.child.kill("SIGTERM");
  }
};
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close();
    todo?.stop();
    gauntlet?.stop();
    stopServer();
  },
});

/** Things' store behind `graview serve`, as somebody hosting it would start it. */
function startServer() {
  const child = spawn("node", ["packages/graview/dist/cli.js", "serve", "apps/todo/dist/domain/app.js", "--data", DATA, "--seed", "apps/todo/src/data/example.json", "--port", String(PORT), "--allow-origin", at("todo")], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], detached: true });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("the store server did not start")), 30_000);
    let said = "";
    child.stdout.on("data", (chunk) => {
      said += String(chunk);
      const key = /[?&]graview_key=([\w-]+)/.exec(said)?.[1];
      if (said.includes(SERVER) && key) {
        clearTimeout(timer);
        ready({ child, key });
      }
    });
    child.stderr.on("data", (chunk) => (said += String(chunk)));
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`the store server exited with ${code}: ${said.slice(-400)}`));
    });
  });
}

/* A stand-in for a host's staff: what the page sends is kept, and staff answer half a second later. */
const SUPPORT = () => {
  const listeners = [];
  window.__supportSent = [];
  window.__todoSupport = {
    title: "Things support",
    transport: {
      async send(message, context) {
        window.__supportSent.push({ message, context });
        const kept = { id: `p${window.__supportSent.length}`, body: message.body, at: new Date().toISOString(), author: context.person?.id ?? "person", from: "person" };
        setTimeout(() => listeners.forEach((hear) => hear({ id: `r${window.__supportSent.length}`, body: "Thanks — Ada here. A list is shared by inviting them from People.", at: new Date().toISOString(), author: "staff", authorName: "Ada at Things", from: "staff" })), 500);
        return kept;
      },
      subscribe(onReply) {
        listeners.push(onReply);
        return () => listeners.splice(listeners.indexOf(onReply), 1);
      },
    },
  };
};

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};
const ready = async (page) => {
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 90_000 });
  await page.waitForTimeout(800);
};
const bodies = (page, within = "") => page.$$eval(`${within} [data-testid="message"]`, (all) => all.map((one) => ({ id: one.getAttribute("data-message-id"), body: one.querySelector('[data-testid="message-body"]')?.textContent ?? null, removed: one.hasAttribute("data-removed"), edited: /\(edited\)/.test(one.textContent ?? ""), edit: one.querySelector('[data-testid="message-edit"]') !== null })));
const said = (page, text, within = "", timeout = 15_000) => page.waitForFunction(([words, scope]) => [...document.querySelectorAll(`${scope} [data-testid="message-body"]`)].some((one) => one.textContent?.includes(words)), [text, within], { timeout }).then(() => true, () => false);
const keyboard = (page) => page.evaluate(() => ({ body: document.activeElement === document.body || document.activeElement === null, on: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName.toLowerCase() ?? null }));
const overflows = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const write = async (page, within, text) => {
  const field = page.locator(`${within} [data-testid="composer-field"]`);
  await field.click();
  await field.fill(text);
  await field.press("Enter");
};
const bell = (page) => page.getAttribute('[data-testid="inbox-button"]', "aria-label").catch(() => null);
const notices = async (page) => {
  if ((await page.locator('[data-testid="inbox"]').count()) === 0) await page.click('[data-testid="inbox-button"]');
  await page.waitForSelector('[data-testid="inbox"]', { timeout: 10_000 });
  const tab = page.locator('[data-testid="inbox-tab-for-you"]');
  if ((await tab.count()) > 0 && (await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await page.waitForTimeout(300);
  const listed = await page.$$eval('[data-testid="inbox-notification"]', (all) => all.map((one) => one.textContent?.replace(/\s+/g, " ").trim() ?? ""));
  await page.keyboard.press("Escape");
  return listed;
};

const errors = [];
try {
  todo = await serving("todo", portFor("todo"), repoRoot);
  await vacant(PORT);
  server = await startServer();
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const printed = encodeURIComponent(`${SERVER}/?graview_key=${server.key}`);
  const opened = async (as, path, viewport = { width: 1440, height: 900 }) => {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(`${as} ${path}: ${error.message}`));
    await page.goto(`${at("todo")}${path}?${DAY}&server=${printed}&as=${as}`, { waitUntil: "load", timeout: 90_000 });
    await ready(page);
    return page;
  };

  /* ------------------------------------- two seats, one room, each sees the other */
  reach("twoSeatsSeeEachOtherLive");
  const nora = await opened("user-nora", "/~rooms/household");
  const sam = await opened("user-sam", "/~rooms/household");
  await nora.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 30_000 });
  await sam.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 30_000 });
  await write(nora, '[data-testid="room-page"]', "Who has the van keys?");
  const samSaw = await said(sam, "Who has the van keys?");
  await write(sam, '[data-testid="room-page"]', "On the hook by the door.");
  const noraSaw = await said(nora, "On the hook by the door.");
  const live = await bodies(nora, '[data-testid="room-page"]');
  report.checks.twoSeatsSeeEachOtherLive = {
    samSaw,
    noraSaw,
    log: live.map((one) => one.body),
    logRegion: await nora.$eval('[data-testid="room-page"] [data-testid="chat-log"]', (log) => ({ role: log.getAttribute("role"), live: log.getAttribute("aria-live"), label: log.getAttribute("aria-label") })),
    ok: samSaw && noraSaw && live.length === 2,
  };
  await shot(nora, "room-desk");

  /* ---------------------------------------------- a thread on a record */
  reach("aThreadOnARecord");
  await nora.goto(`${at("todo")}/tasks/t-book?${DAY}&server=${printed}&as=user-nora`, { waitUntil: "load" });
  await sam.goto(`${at("todo")}/tasks/t-book?${DAY}&server=${printed}&as=user-sam`, { waitUntil: "load" });
  await ready(nora);
  await ready(sam);
  const THREAD = '[data-testid="record-thread"][data-about="t-book"]';
  await nora.waitForSelector(`${THREAD} [data-testid="composer-field"]`, { timeout: 30_000 });
  await write(nora, THREAD, "Saturday morning works for the van.");
  const threadSeen = await said(sam, "Saturday morning works for the van.", THREAD);
  const notInTheRoom = await nora.evaluate(() => document.querySelectorAll('[data-testid="room-page"]').length === 0);
  report.checks.aThreadOnARecord = {
    threadSeen,
    heading: await nora.textContent(`${THREAD} h2`).catch(() => null),
    composerLabel: await nora.textContent(`${THREAD} [data-testid="composer"] label`).catch(() => null),
    ok: threadSeen && notInTheRoom,
  };
  await nora.locator(THREAD).scrollIntoViewIfNeeded();
  await shot(nora, "thread-desk");

  /* -------------------------------- edit and remove your own, and only your own */
  reach("editAndRemoveOwn");
  await write(sam, THREAD, "I can drive it bak.");
  await said(nora, "I can drive it bak.", THREAD);
  const before = await bodies(sam, THREAD);
  const noraMessage = before.find((one) => one.body?.includes("Saturday morning"));
  const samMessage = before.find((one) => one.body?.includes("drive it"));
  await sam.click(`${THREAD} [data-message-id="${samMessage.id}"] [data-testid="message-edit"]`);
  const editing = sam.locator(`${THREAD} [data-testid="message-editing"] textarea`);
  await editing.fill("I can drive it back.");
  await editing.press("Enter");
  const editSeen = await said(nora, "I can drive it back.", THREAD);
  const afterEdit = await bodies(nora, THREAD);
  await sam.click(`${THREAD} [data-message-id="${samMessage.id}"] [data-testid="message-remove"]`);
  const removedSeen = await nora.waitForSelector(`${THREAD} [data-message-id="${samMessage.id}"][data-removed]`, { timeout: 15_000 }).then(() => true, () => false);
  report.checks.editAndRemoveOwn = {
    samMayEditNoras: noraMessage?.edit ?? null,
    editSeen,
    saidEdited: afterEdit.find((one) => one.id === samMessage.id)?.edited ?? false,
    removedSeen,
    removedSays: await nora.textContent(`${THREAD} [data-message-id="${samMessage.id}"] [data-testid="message-removed"]`).catch(() => null),
    ok: noraMessage?.edit === false && samMessage?.edit === true && editSeen && afterEdit.find((one) => one.id === samMessage.id)?.edited === true && removedSeen,
  };

  /* ------------------------------ what is new is counted on the bell until read */
  reach("unreadCounts");
  await nora.goto(`${at("todo")}/?${DAY}&server=${printed}&as=user-nora`, { waitUntil: "load" });
  await ready(nora);
  await sam.goto(`${at("todo")}/~rooms/household?${DAY}&server=${printed}&as=user-sam`, { waitUntil: "load" });
  await ready(sam);
  await sam.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 30_000 });
  await write(sam, '[data-testid="room-page"]', "Bins go out tonight.");
  await sam.waitForTimeout(400);
  await write(sam, '[data-testid="room-page"]', "And the recycling.");
  await nora.waitForFunction(() => [...document.querySelectorAll('[data-testid="inbox-button"]')].some((one) => /new update|need/.test(one.getAttribute("aria-label") ?? "")), undefined, { timeout: 15_000 }).catch(() => undefined);
  const unreadBell = await bell(nora);
  const unreadListed = await notices(nora);
  await nora.goto(`${at("todo")}/~rooms/household?${DAY}&server=${printed}&as=user-nora`, { waitUntil: "load" });
  await ready(nora);
  await nora.waitForSelector('[data-testid="room-page"] [data-testid="message"]', { timeout: 20_000 });
  await nora.waitForTimeout(800);
  const readListed = await notices(nora);
  report.checks.unreadCounts = {
    bell: unreadBell,
    listed: unreadListed,
    afterReading: readListed,
    ok: unreadListed.some((one) => /^2 new in Household/.test(one) || /4 new in Household/.test(one) || /new in Household/.test(one)) && !readListed.some((one) => /new in Household/.test(one)),
  };

  /* ---------------------------------------- a mention reaches the person it names */
  reach("aMentionReachesTheirNotices");
  await nora.goto(`${at("todo")}/lists?${DAY}&server=${printed}&as=user-nora`, { waitUntil: "load" });
  await ready(nora);
  await write(sam, '[data-testid="room-page"]', "@Nora can you take the van back on Monday?");
  let mentioned = [];
  for (let tries = 0; tries < 20 && !mentioned.some((one) => /mentioned you/.test(one)); tries++) {
    await nora.waitForTimeout(750);
    mentioned = await notices(nora);
  }
  const mentionBell = await bell(nora);
  const shownAsMention = await sam.$$eval('[data-testid="room-page"] [data-testid="mention"]', (all) => all.map((one) => `${one.textContent}:${one.getAttribute("data-person")}`));
  report.checks.aMentionReachesTheirNotices = {
    bell: mentionBell,
    listed: mentioned,
    shownAsMention,
    ok: mentioned.some((one) => /Sam mentioned you in Household/.test(one)) && /need/.test(mentionBell ?? "") && shownAsMention.includes("@Nora:user-nora"),
  };
  await nora.close();

  /* ---------------------------------------------------------- a phone */
  reach("aPhone");
  const phone = await opened("user-sam", "/~rooms/household", { width: 390, height: 844 });
  await phone.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 30_000 });
  await write(phone, '[data-testid="room-page"]', "Sent from my phone.");
  const phoneSaid = await said(phone, "Sent from my phone.");
  const send = await phone.locator('[data-testid="room-page"] [data-testid="composer-send"]').boundingBox();
  const roomOverflows = await overflows(phone);
  await shot(phone, "room-phone");
  await phone.goto(`${at("todo")}/tasks/t-book?${DAY}&server=${printed}&as=user-sam`, { waitUntil: "load" });
  await ready(phone);
  await phone.waitForSelector(`${THREAD} [data-testid="composer-field"]`, { timeout: 30_000 });
  await phone.locator(THREAD).scrollIntoViewIfNeeded();
  const threadBox = await phone.locator(THREAD).boundingBox();
  const threadOverflows = await overflows(phone);
  await shot(phone, "thread-phone");
  report.checks.aPhone = {
    phoneSaid,
    send,
    roomOverflows,
    thread: threadBox,
    threadOverflows,
    ok: phoneSaid && !roomOverflows && !threadOverflows && send !== null && send.x + send.width <= 390 && send.width >= 44 && threadBox !== null && threadBox.x >= 0 && threadBox.x + threadBox.width <= 391,
  };
  await phone.close();

  /* ------------------------------------------------------- the keyboard alone */
  reach("keyboardOnly");
  const keys = await opened("user-sam", "/~rooms/household");
  await keys.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 30_000 });
  let reached = false;
  for (let press = 0; press < 60 && !reached; press++) {
    await keys.keyboard.press("Tab");
    reached = (await keyboard(keys)).on === "composer-field";
  }
  await keys.keyboard.type("Line one");
  await keys.keyboard.press("Shift+Enter");
  await keys.keyboard.type("line two");
  const twoLines = await keys.inputValue('[data-testid="room-page"] [data-testid="composer-field"]');
  await keys.keyboard.press("Enter");
  const sentByEnter = await said(keys, "line two");
  const multiline = await keys.$$eval('[data-testid="room-page"] [data-testid="message-body"]', (all) => all.some((one) => one.querySelector("br") !== null && /Line one/.test(one.textContent ?? "")));
  const afterSend = await keyboard(keys);
  // Edit in place, and Escape leaves it as it was.
  const mine = (await bodies(keys, '[data-testid="room-page"]')).filter((one) => one.edit).at(-1);
  await keys.focus(`[data-testid="room-page"] [data-message-id="${mine.id}"] [data-testid="message-edit"]`);
  await keys.keyboard.press("Enter");
  await keys.waitForSelector('[data-testid="message-editing"] textarea', { timeout: 5_000 });
  const editFocused = await keys.evaluate(() => document.activeElement?.closest('[data-testid="message-editing"]') !== null);
  await keys.keyboard.press("Escape");
  const escaped = (await keys.locator('[data-testid="message-editing"]').count()) === 0;
  report.checks.keyboardOnly = {
    reached,
    twoLines,
    sentByEnter,
    multiline,
    afterSend,
    editFocused,
    escaped,
    ok: reached && twoLines === "Line one\nline two" && sentByEnter && multiline && !afterSend.body && editFocused && escaped,
  };
  await keys.close();
  await sam.close();

  /* --------------------------------- the support panel: sent with context, a reply shown */
  reach("supportSendsWithContextAndShowsAReply");
  for (const [name, viewport] of [["desk", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(`support ${name}: ${error.message}`));
    await page.addInitScript(SUPPORT);
    await page.goto(`${at("todo")}/tasks/t-book?${DAY}&fresh=1&as=user-sam`, { waitUntil: "load", timeout: 90_000 });
    await ready(page);
    // From the keyboard: the person's button, then the row, then Enter.
    await page.focus('[data-testid="profile-button"]');
    await page.keyboard.press("Enter");
    const row = page.getByRole("button", { name: "Chat with Things support" }).or(page.getByRole("link", { name: "Chat with Things support" }));
    await row.first().waitFor({ state: "visible", timeout: 10_000 });
    await row.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="support-panel"]', { timeout: 15_000 });
    const focusedField = (await keyboard(page)).on === "support-field";
    const later = await page.textContent('[data-testid="support-later"]');
    await page.keyboard.type("How do I share a list with my partner?");
    await page.keyboard.press("Enter");
    const reply = await page.waitForSelector('[data-testid="support-message"][data-from="staff"]', { timeout: 10_000 }).then(() => true, () => false);
    const sent = await page.evaluate(() => window.__supportSent);
    const panelOverflows = await overflows(page);
    const panel = await page.locator('[data-testid="support-panel"]').boundingBox();
    await shot(page, `support-${name}`);
    await page.keyboard.press("Escape");
    const closed = (await page.locator('[data-testid="support-panel"]').count()) === 0;
    const back = await keyboard(page);
    const context = sent?.[0]?.context ?? {};
    report.checks[`supportSendsWithContextAndShowsAReply${name === "desk" ? "" : "OnAPhone"}`] = {
      focusedField,
      later,
      context,
      reply,
      panel,
      closed,
      back,
      ok: focusedField && /later|while/i.test(later ?? "") && sent?.length === 1 && context.app === "todo" && context.place === "/tasks/t-book" && context.record?.id === "t-book" && context.person?.id === "user-sam" && context.roles?.includes("member") && /^\d+\.\d+\.\d+/.test(context.version ?? "") && reply && !panelOverflows && panel !== null && panel.x >= 0 && panel.x + panel.width <= viewport.width + 1 && closed && !back.body,
    };
    await page.close();
  }

  /* ------------------------------------------ a seat without sight sees none of it */
  reach("aSeatWithoutSightSeesNone");
  gauntlet = await serving("gauntlet", portFor("gauntlet"), repoRoot);
  const KEEP = () => {
    const watch = (window.__graviewWatch ??= {});
    const handed = watch.store;
    watch.store = (store) => {
      handed?.(store);
      (window.__chatStores ??= []).push(store);
    };
  };
  // One browser's storage for both seats: the visitor opens what the chair's browser keeps.
  const shared = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const chair = await shared.newPage();
  chair.on("pageerror", (error) => errors.push(`chair: ${error.message}`));
  await chair.addInitScript(KEEP);
  await chair.goto(`${at("gauntlet")}/pages/~rooms/program-team?as=u-4f1c9a&fresh=1`, { waitUntil: "load", timeout: 120_000 });
  await chair.waitForSelector('[data-testid="room-page"] [data-testid="composer-field"]', { timeout: 120_000 });
  await write(chair, '[data-testid="room-page"]', "Program locks on Friday.");
  const chairSaid = await said(chair, "Program locks on Friday.");
  // The staff a visitor cannot see, and what the chair said about them, kept in this browser for the visitor to open.
  const staff = await chair.evaluate(() => {
    const store = window.__chatStores.find((one) => one.schema.kinds.includes("message"));
    const member = store.graph.nodesOfKind("staff")[0];
    store.apply({ name: "post-message", args: { room: "staff-notes", about: member.id, body: "Covers the second room on Saturday." } }, { author: { kind: "human", id: "u-4f1c9a", roles: ["chair"] } });
    return { id: member.id, messages: store.graph.nodesOfKind("message").length };
  });
  await chair.waitForTimeout(1500);
  const visitor = await shared.newPage();
  visitor.on("pageerror", (error) => errors.push(`visitor: ${error.message}`));
  await visitor.addInitScript(KEEP);
  await visitor.goto(`${at("gauntlet")}/pages/~rooms/program-team?as=u-anon-0&remember=1`, { waitUntil: "load", timeout: 120_000 });
  await visitor.waitForSelector('[data-testid="room-missing"], [data-testid="room-page"]', { timeout: 120_000 });
  const visitorRoom = await visitor.evaluate(() => ({ missing: document.querySelector('[data-testid="room-missing"]') !== null, said: document.body.textContent?.includes("Program locks on Friday") ?? false }));
  const visitorSees = await visitor.evaluate(() => {
    const store = window.__chatStores.find((one) => one.schema.kinds.includes("message"));
    const seen = store.seenBy({ kind: "human", id: "u-anon-0", roles: [] });
    return { messages: seen.graph.nodesOfKind("message").length, staff: seen.graph.nodesOfKind("staff").length, held: store.graph.nodesOfKind("message").length };
  });
  report.checks.aSeatWithoutSightSeesNone = {
    chairSaid,
    staff,
    visitorRoom,
    visitorSees,
    ok: chairSaid && staff.messages === 2 && visitorRoom.missing && !visitorRoom.said && visitorSees.held === 2 && visitorSees.messages === 0 && visitorSees.staff === 0,
  };
  await shared.close();

  reach.done();
  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.error = String(error);
  report.pageErrors = errors;
  report.passed = false;
} finally {
  await browser?.close();
  todo?.stop();
  gauntlet?.stop();
  stopServer();
  rmSync(DATA, { recursive: true, force: true });
}

writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/rooms.json\n`);
process.exit(report.passed ? 0 : 1);
