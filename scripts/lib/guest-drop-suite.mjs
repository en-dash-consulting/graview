/**
 * FILES DROPPED ON A WORKER VIEW, IN A REAL BROWSER (FR-193): the drop
 * transport of `scripts/guest-sandbox.mjs`.
 *
 * Graview Cloud's family weekend in miniature (scripts/fixtures/weekend-app.ts):
 * the journey home view draws the days as cards, each marked
 * `data-drop="moment" data-drop-connect="takenOn:<day>"`, and its manifest
 * accepts a moment's photo and clip. The embed is mounted the way a host
 * mounts it, with the host's files (`files`: an upload that keeps what it is
 * sent and answers where it keeps it, a video as an MP4 with its poster and
 * length). The view's code handles no drop.
 *
 * The claims: Saturday's card is a drop target the host offers; dragging
 * files over it, the host draws it and says what dropping does; three
 * photographs and a phone's video dropped on it — a DataTransfer built in
 * the page — are four moments on Saturday, each its file on its field, in
 * one change one undo takes back; a view that hears `drop` is told the
 * files as the host stored them and makes them moments with one act of
 * several; a friend, who may make no moment, is offered no drop target and
 * a drop makes nothing; and on a phone (a coarse pointer) a tap on
 * Sunday's card opens the picker, asking for pictures and videos, and what
 * is picked is moments on Sunday.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const SATURDAY = "day:saturday";
const SUNDAY = "day:sunday";

export async function dropSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, engine }) {
  const out = mkdtempSync(join(tmpdir(), "graview-guest-drop-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { JOURNEY_HANDLED_JS, JOURNEY_HANDLED_MANIFEST, JOURNEY_JS, JOURNEY_MANIFEST, nana, theo, weekendApp, weekendOnDayApp, weekendSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/weekend-app.ts"))};
const asked = new URLSearchParams(location.search);
const handled = asked.has("handled");
window.__failures = [];
window.__problems = [];
window.__uploaded = [];
/* The host's files: it keeps what it is sent, and answers where; a video as the MP4 a browser plays, with its poster and length. */
const files = {
  maxBytes: 20_000_000,
  kinds: ["image/*", "video/*"],
  async upload(file, name) {
    window.__uploaded.push({ name, type: file.type, bytes: file.size });
    const n = window.__uploaded.length;
    const video = file.type.startsWith("video/");
    return { href: "/graview/files/" + n + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + (video ? ".mp4" : ""), name, type: video ? "video/mp4" : file.type, bytes: file.size, ...(video ? { duration: 9, poster: "/graview/files/" + n + "-poster.jpg" } : {}) };
  },
};
const manifest = handled ? JOURNEY_HANDLED_MANIFEST : JOURNEY_MANIFEST;
const definition = { manifest, worker: { source: handled ? JOURNEY_HANDLED_JS : JOURNEY_JS }, onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) };
window.__handle = mount(document.getElementById("app"), {
  app: handled ? weekendOnDayApp : weekendApp,
  seed: weekendSeed,
  principal: asked.get("seat") === "theo" ? theo : nana,
  face: "pages",
  path: "/places/" + (handled ? "the-journey-home-told" : "the-journey-home"),
  files,
  scheme: "light",
  label: "Family weekend",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, definition),
});
window.__handle.drawn().then(() => { window.__ready = true; });
/* Three photographs and a phone's video, as Finder hands them: a DataTransfer built in the page. */
window.__finder = (names) => {
  const transfer = new DataTransfer();
  for (const [name, type, size] of names) transfer.items.add(new File([new Uint8Array(size)], name, { type, lastModified: Date.UTC(2026, 9, 17, 15, 2) }));
  return transfer;
};
window.__card = (day) => document.querySelector('[data-worker-view]')?.shadowRoot?.querySelector('[data-day="' + day + '"]') ?? null;
window.__drag = (day, type, names) => {
  const card = window.__card(day);
  const transfer = window.__finder(names);
  let event = new DragEvent(type, { bubbles: true, composed: true, cancelable: true, dataTransfer: transfer });
  /* An engine whose DragEvent will not carry one built in the page: the same transfer, on the event. */
  if (!event.dataTransfer) {
    event = new Event(type, { bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
  }
  (card.querySelector("h3") ?? card).dispatchEvent(event);
  return event.defaultPrevented;
};
window.__moments = (day) => window.__handle.store.graph.allEdges().filter((edge) => edge.kind === "takenOn" && edge.to === day).map((edge) => window.__handle.store.graph.getNode(edge.from));
`,
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
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Family weekend</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;
  writeFileSync(join(out, "index.html"), page);
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    try {
      const body = readFileSync(join(out, path));
      response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  const FINDER = [
    ["IMG_4031.jpg", "image/jpeg", 2_400],
    ["IMG_4032.jpg", "image/jpeg", 2_600],
    ["IMG_4033.png", "image/png", 1_800],
    ["IMG_4034.MOV", "video/quicktime", 9_000],
  ];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const open = async (on, query) => {
      await on.goto(`${HOST}/?${query}`, { waitUntil: "load" });
      await on.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
      await on.waitForFunction((day) => window.__card?.(day)?.hasAttribute("data-graview-drop") || window.__card?.(day)?.hasAttribute("data-drop"), SATURDAY, { timeout: 15_000 });
      await on.waitForTimeout(300);
    };
    const until = async (on, test, arg, what) => {
      try {
        await on.waitForFunction(test, arg, { timeout: 10_000 });
      } catch {
        throw new Error(`${what} never came: ${JSON.stringify(await on.evaluate(() => ({ failures: window.__failures, problems: window.__problems, uploaded: window.__uploaded, status: document.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("[data-graview-drop-status]")?.textContent })).catch(String))}`);
      }
    };

    /* THE DEFAULT: a view that handles no drop. */
    await open(tab, "default");
    const offered = await tab.evaluate((day) => ({ target: window.__card(day).hasAttribute("data-graview-drop"), said: window.__card(day).getAttribute("aria-description") }), SATURDAY);
    claim("Saturday's card, which the view marked data-drop, is a drop target the host offers and says to assistive technology", offered.target && /Drop to add moments to Saturday/.test(offered.said ?? ""), offered);
    const over = await tab.evaluate(([day, names]) => {
      const prevented = window.__drag(day, "dragover", names);
      const root = document.querySelector("[data-worker-view]").shadowRoot;
      const card = window.__card(day);
      return { prevented, drawn: card.hasAttribute("data-graview-drop-over"), outline: getComputedStyle(card).outlineStyle, status: root.querySelector("[data-graview-drop-status]")?.textContent };
    }, [SATURDAY, FINDER]);
    claim("dragging files over Saturday's card, the host takes the drag, draws the card with its own outline and says what dropping there does", over.prevented && over.drawn && over.outline === "dashed" && over.status === "Drop to add moments to Saturday.", over);
    const dropped = await tab.evaluate(([day, names]) => window.__drag(day, "drop", names), [SATURDAY, FINDER]);
    await until(tab, (day) => window.__moments(day).length === 4 && /4 moments/.test(window.__card(day).textContent), SATURDAY, "four moments on Saturday, drawn by the view");
    const kept = await tab.evaluate((day) => {
      const store = window.__handle.store;
      const moments = window.__moments(day);
      const ops = store.log.all();
      return {
        photos: moments.filter((one) => one.photo).map((one) => one.photo.name).sort(),
        clips: moments.filter((one) => one.clip).map((one) => ({ name: one.clip.name, type: one.clip.type, duration: one.clip.duration })),
        batches: [...new Set(ops.map((op) => op.batch))],
        vias: [...new Set(ops.map((op) => op.via))],
        authors: [...new Set(ops.map((op) => op.author.id))],
        uploaded: window.__uploaded.map((one) => one.name),
        status: document.querySelector("[data-worker-view]").shadowRoot.querySelector("[data-graview-drop-status]")?.textContent,
        drawn: window.__card(day).querySelector("[data-count]")?.textContent,
      };
    }, SATURDAY);
    claim(
      "three photographs and a phone's video dropped on Saturday are four moments on Saturday, each its file on its field, stored through the host's files",
      dropped && kept.photos.join() === "IMG_4031.jpg,IMG_4032.jpg,IMG_4033.png" && kept.clips.length === 1 && kept.clips[0].type === "video/mp4" && kept.clips[0].duration === 9 && kept.uploaded.length === 4,
      kept,
    );
    claim("the four were made in one change, as Nana, through the view, and the host said so", kept.batches.length === 1 && kept.vias.join() === "view:journey" && kept.authors.join() === "person:nana" && kept.status === "Added 4 moments to Saturday." && kept.drawn === "4 moments", kept);
    const undone = await tab.evaluate(([batch, day]) => {
      window.__handle.store.undo(batch, { author: { kind: "human", id: "person:nana", roles: ["family"] } });
      return { left: window.__moments(day).length, moments: window.__handle.store.graph.nodesOfKind("moment").length };
    }, [kept.batches[0], SATURDAY]);
    await until(tab, (day) => /0 moments/.test(window.__card(day).textContent), SATURDAY, "Saturday drawn with no moments again");
    claim("one undo takes all four back", undone.left === 0 && undone.moments === 0, undone);
    claim("the journey view did not fail, and nothing about its drop targets was said to be wrong", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));

    /* A VIEW THAT HEARS THE DROP: its own act, several as one change. */
    await open(tab, "handled");
    await tab.evaluate(([day, names]) => window.__drag(day, "drop", names), [SATURDAY, FINDER]);
    await until(tab, (day) => window.__moments(day).length === 4, SATURDAY, "four moments the view made on Saturday");
    const told = await tab.evaluate((day) => {
      const ops = window.__handle.store.log.all();
      return { captions: window.__moments(day).map((one) => one.caption).sort(), acts: [...new Set(ops.map((op) => op.mutation?.name))], batches: [...new Set(ops.map((op) => op.batch))], vias: [...new Set(ops.map((op) => op.via))], clip: window.__moments(day).find((one) => one.clip)?.clip };
    }, SATURDAY);
    claim(
      "a view that hears the drop is told the files as the host stored them, and makes them four moments with one act of several, as one change",
      told.captions.join("|") === "Dropped IMG_4031.jpg|Dropped IMG_4032.jpg|Dropped IMG_4033.png|Dropped IMG_4034.MOV" && told.acts.join() === "add-moment-to-day" && told.batches.length === 1 && told.vias.join() === "view:journey-handled" && told.clip?.href?.endsWith(".mp4") && told.clip.field === undefined && told.clip.at === undefined,
      told,
    );

    /* A SEAT THAT MAY MAKE NO MOMENT. */
    await open(tab, "seat=theo");
    const friend = await tab.evaluate(([day, names]) => ({ target: window.__card(day).hasAttribute("data-graview-drop"), prevented: window.__drag(day, "drop", names) }), [SATURDAY, FINDER]);
    await tab.waitForTimeout(500);
    const after = await tab.evaluate((day) => ({ moments: window.__moments(day).length, uploaded: window.__uploaded.length, problems: window.__problems }), SATURDAY);
    claim("a friend, who may make no moment, is offered no drop target, and a drop there stores nothing and makes nothing", !friend.target && !friend.prevented && after.moments === 0 && after.uploaded === 0 && after.problems.length === 0, { ...friend, ...after });
    await context.close();

    /* ON A PHONE: a coarse pointer, where a tap opens the picker. Firefox has no mobile emulation, so its phone is a narrow window that is said and not tapped. */
    if (engine !== "firefox") {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "light" });
      const hand = await phone.newPage();
      hand.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
      await open(hand, "default");
      const coarse = await hand.evaluate(() => matchMedia("(pointer: coarse)").matches);
      const [chooser] = await Promise.all([hand.waitForEvent("filechooser", { timeout: 10_000 }), hand.locator(`[data-day="${SUNDAY}"] h3`).tap()]);
      const asks = { accept: await chooser.element().getAttribute("accept"), multiple: chooser.isMultiple() };
      await chooser.setFiles([
        { name: "IMG_5001.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(3_000) },
        { name: "IMG_5002.MOV", mimeType: "video/quicktime", buffer: Buffer.alloc(6_000) },
      ]);
      await until(hand, (day) => window.__moments(day).length === 2, SUNDAY, "two moments on Sunday, picked");
      const picked = await hand.evaluate((day) => ({ names: window.__moments(day).map((one) => (one.photo ?? one.clip).name).sort(), batches: [...new Set(window.__handle.store.log.all().map((op) => op.batch))].length }), SUNDAY);
      claim("on a phone, a tap on Sunday's card opens the picker asking for pictures and videos, and what is picked is moments on Sunday, in one change", coarse && asks.accept === "image/*,video/*" && asks.multiple && picked.names.join() === "IMG_5001.jpg,IMG_5002.MOV" && picked.batches === 1, { coarse, ...asks, ...picked });
      await phone.close();
    }
    claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  } finally {
    server.close();
  }
}
