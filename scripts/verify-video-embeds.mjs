#!/usr/bin/env node
/**
 * A VIEW PLAYS A YOUTUBE OR VIMEO VIDEO IN PLACE (HQ f-view-video-embeds).
 *
 * The embed is mounted as a host mounts it, with a worker view that places
 * two videos by name and one by an address that is on no list. The
 * providers are stood in for: every request off the host's own page is
 * answered here, and counted, so nothing reaches the network and "nothing
 * was asked" is a number. In three engines, it asks:
 *
 *   nothing is asked of any provider until a person presses play — on the
 *   routed pages, on the one face, and in the Scene's card; a press plays
 *   the video where it stood, in the same box, from the one address the
 *   host builds, told the page's origin and no more, with the keyboard in
 *   the player; a redraw of the view — words changed, something put in
 *   before it, something taken out — does not start it over; a press on it
 *   does not open the card around it; another one pressed stops it, and so
 *   does leaving the place; the link out is there throughout, by the
 *   keyboard too; an address outside the list is refused and said; a
 *   provider its host turned off is its link alone; a page whose policy
 *   allows no frame from it says so and keeps the link; printed, it is its
 *   address; and nothing is wider than a phone.
 *
 *   node scripts/verify-video-embeds.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const ID = "dQw4w9WgXcQ";
const BASE = "/films";
const MANIFEST = { name: "films", title: "Films", attach: "task", cardinality: "many" };
/* A card bound to a record, holding a video; a second video; one on no list; and a control that draws the view again, differently each time. */
const SOURCE = `graview.style(\`
  .films { display: grid; gap: 16px; padding: 16px; }
  .card { border: 1px solid var(--graview-edge); border-radius: 8px; padding: 12px; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; }
\`);
let drawn = 0;
let props;
const draw = () => {
  const task = props.nodes.find((node) => node.kind === "task");
  graview.render(graview.html\`<div class="films">
    <button id="again">Draw again</button>
    \${drawn % 2 ? graview.html\`<p id="extra">Drawn \${drawn} times</p>\` : ""}
    <div class="pair">
      \${drawn > 0 && drawn < 3 ? graview.html\`<p>New</p>\` : ""}
      <section class="card" data-key="card" data-record="\${task.id}"><h3>\${task.label} \${drawn}</h3><graview-video data-provider="youtube" data-video="${ID}" data-start="90" title="The keynote"></graview-video></section>
      <graview-video id="two" data-watch="https://vimeo.com/76979871/8272103f6e" title="The film"></graview-video>
    </div>
    <graview-video id="bad" data-watch="https://video.example/watch?v=1"></graview-video>
    <p id="after">After the videos</p>
  </div>\`);
};
graview.onProps((given) => { props = given; draw(); });
graview.on("click", "#again", () => { drawn += 1; draw(); });`;
const SEED = { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }], edges: [] };
const report = { at: new Date().toISOString(), engines, checks: {}, pageErrors: [] };
const claim = (engine, name, ok, saw) => {
  const at = (report.checks[name] ??= { ok: true, engines: {} });
  at.engines[engine] = { ok, ...(ok ? {} : { saw }) };
  at.ok &&= ok;
  process.stdout.write(`${ok ? "ok" : "NO"}  ${engine}  ${name}${ok ? "" : ` ${JSON.stringify(saw)}`}\n`);
};

async function serveHost() {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-embeds-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import tasks from ${JSON.stringify(TASKS)};
        const asked = new URLSearchParams(location.search);
        const compiled = compileDocumentWithoutCheck(tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__problems = [];
        window.__failures = [];
        window.__handle = mount(document.getElementById("app"), {
          // The routed face and its scene, which this harness holds: an embed draws the one face unless told otherwise.
          sceneUnderPages: false,
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          face: asked.get("face") === "graview" ? "graview" : "pages",
          ...(asked.get("face") === "one" ? { sceneUnderPages: true } : {}),
          views: (schema, registry) => registerWorkerView(registry, {
            manifest: ${JSON.stringify(MANIFEST)},
            worker: { source: ${JSON.stringify(SOURCE)} },
            ...(asked.has("off") ? { embeds: { providers: ["vimeo"] } } : {}),
            onProblem: (said, problem) => window.__problems.push({ said, code: problem.code }),
            onFailure: (reason, detail) => window.__failures.push([reason, detail]),
          }),
          bar: true,
          label: "The films",
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          routing: "address",
          basePath: "${BASE}/",
        });
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
    jsx: "automatic",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>The films</title><link rel="icon" href="data:,"><style>body{margin:0}#app{position:relative;height:100vh}</style></head><body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;
  const server = createServer((request, response) => {
    const url = request.url ?? "/";
    const path = decodeURIComponent(url.split("?")[0]);
    const file = join(out, path.replace(/^\/+/, ""));
    if (path.endsWith(".js")) {
      if (!file.startsWith(out) || !existsSync(file)) return void response.writeHead(404).end();
      response.writeHead(200, { "content-type": "text/javascript" });
      return void response.end(readFileSync(file));
    }
    /* "?csp": a page whose policy allows Vimeo's frame and not YouTube's. */
    response.writeHead(200, { "content-type": "text/html", ...(url.includes("csp") ? { "content-security-policy": "frame-src https://player.vimeo.com" } : {}) });
    response.end(page);
  });
  await vacant(portFor("embeds-host"));
  await new Promise((ready) => server.listen(portFor("embeds-host"), ready));
  return () => (server.close(), rmSync(out, { recursive: true, force: true }));
}

const HOST = `http://localhost:${portFor("embeds-host")}`;
const place = (query = "") => `${HOST}${BASE}/places/films${query}`;

/** What the page draws of its first view's videos, read through the shadow roots. */
const seen = (page) =>
  page.evaluate(() => {
    const views = [...document.querySelectorAll('[data-worker-view="films"]')].filter((view) => view.getClientRects().length > 0);
    const root = views[0]?.shadowRoot;
    const one = (element) => {
      const shadow = element?.shadowRoot;
      const frame = shadow?.querySelector("iframe");
      const box = shadow?.querySelector("[data-frame]")?.getBoundingClientRect();
      const link = shadow?.querySelector("a");
      return {
        button: shadow?.querySelector("button")?.getAttribute("aria-label") ?? null,
        frame: frame ? { src: frame.getAttribute("src"), title: frame.title, sandbox: frame.getAttribute("sandbox"), focused: shadow.activeElement === frame } : null,
        box: box ? [box.x, box.y, box.width, box.height].map(Math.round) : null,
        link: link ? { href: link.href, text: link.textContent, tall: Math.round(link.getBoundingClientRect().height), focused: shadow.activeElement === link } : null,
        words: shadow?.querySelector("[data-words]")?.textContent ?? null,
        empty: !shadow || shadow.childNodes.length === 0,
      };
    };
    return {
      views: views.length,
      youtube: one(root?.querySelector(".card graview-video")),
      vimeo: one(root?.querySelector("#two")),
      bad: one(root?.querySelector("#bad")),
      heading: root?.querySelector("h3")?.textContent ?? null,
      after: Math.round(root?.querySelector("#after")?.getBoundingClientRect().y ?? -1),
      path: location.pathname,
      wide: document.documentElement.scrollWidth,
      problems: window.__problems,
      failures: window.__failures,
    };
  });

const stop = await serveHost();
try {
  for (const engine of engines) {
    const browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    const say = (name, ok, saw) => claim(engine, name, ok, saw);
    const open = async (query, viewport = { width: 1280, height: 1000 }) => {
      const context = await browser.newContext({ viewport });
      const off = [];
      /* Every request off the host's own page, answered here: a player that says which load of it this is. */
      await context.route(
        (url) => url.origin !== HOST && /^https?:$/.test(url.protocol),
        async (route) => {
          const request = route.request();
          off.push({ url: request.url(), referer: (await request.allHeaders()).referer ?? null });
          await route.fulfill({ contentType: "text/html", body: `<!doctype html><title>player</title><body style="margin:0;background:#246"><button>Pause</button><script>window.__load = Math.random()</script>` });
        },
      );
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${engine}: ${String(error).slice(0, 200)}`));
      await page.goto(query.startsWith("/") ? `${HOST}${BASE}${query}` : place(query), { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      const until = async (test, what) => {
        for (let i = 0; i < 200; i += 1) {
          const now = await seen(page);
          if (test(now)) return now;
          await page.waitForTimeout(50);
        }
        const now = await seen(page);
        say(`reached: ${what}`, false, now);
        return now;
      };
      const shot = async (name) => {
        if (!SHOTS) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `${engine}-${name}.png`) });
      };
      return { context, page, off, until, shot };
    };
    const button = (page, at) => page.locator(`[data-worker-view="films"] ${at} button[data-graview-embed-play]`);
    const load = async (page, host) => {
      for (let i = 0; i < 100; i += 1) {
        const frame = page.frames().find((one) => one.url().includes(host));
        const n = frame ? await frame.evaluate(() => window.__load).catch(() => undefined) : undefined;
        if (n) return n;
        await page.waitForTimeout(50);
      }
      return undefined;
    };

    for (const face of ["pages", "one"]) {
      const on = face === "pages" ? "on the routed pages" : "on the one face";
      const { context, page, off, until, shot } = await open(face === "one" ? "?face=one" : "");
      const ready = await until((now) => now.youtube.button !== null && now.vimeo.button !== null, `the two play buttons ${on}`);
      await page.waitForTimeout(400);
      await shot(`${face}-poster`);
      say(`${on}, a video is a poster and a play button, with its link, and nothing is asked of a provider before the press`, off.length === 0 && ready.youtube.frame === null && ready.youtube.button === "Play: The keynote" && ready.youtube.link?.href === `https://www.youtube.com/watch?v=${ID}&t=90s` && ready.vimeo.link?.href === "https://vimeo.com/76979871/8272103f6e", { off, ready });
      say(`${on}, an address outside the list is refused, said with its code, and drawn as nothing`, ready.bad.empty && ready.problems.length === 1 && ready.problems[0].code === "embed-refused" && /video\.example/.test(ready.problems[0].said) && ready.failures.length === 0, { bad: ready.bad, problems: ready.problems, failures: ready.failures });
      await button(page, ".card").click();
      const playing = await until((now) => now.youtube.frame !== null, `the YouTube player ${on}`);
      const first = await load(page, "youtube-nocookie.com");
      await shot(`${face}-playing`);
      say(`${on}, a press plays it where it stood, in the same box, with nothing below it moved and the card around it not opened`, first !== undefined && playing.youtube.frame?.src === `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0&start=90` && JSON.stringify(playing.youtube.box) === JSON.stringify(ready.youtube.box) && playing.after === ready.after && playing.path === ready.path, { playing, ready });
      say(`${on}, the player is told this page's origin alone, and only the provider pressed is asked`, off.length === 1 && off[0].referer === `${HOST}/`, off);
      say(`${on}, the keyboard is in the player, its frame says what it is, and the link stays`, playing.youtube.frame?.focused === true && playing.youtube.frame.title === "The keynote (YouTube player)" && playing.youtube.frame.sandbox === "allow-scripts allow-same-origin" && playing.youtube.link !== null, playing.youtube);
      const loads = [];
      for (let i = 1; i <= 4; i += 1) {
        await page.locator('[data-worker-view="films"] #again').first().click();
        await until((now) => now.heading?.endsWith(` ${i}`) ?? false, `the view drawn ${i} times again ${on}`);
        loads.push(await load(page, "youtube-nocookie.com"));
      }
      say(`${on}, a playing video plays on as the view draws again around it`, loads.length === 4 && loads.every((one) => one === first) && off.length === 1, { first, loads, off });
      await button(page, "#two").click();
      const other = await until((now) => now.vimeo.frame !== null && now.youtube.frame === null, `the Vimeo player alone ${on}`);
      await load(page, "player.vimeo.com");
      say(`${on}, another one pressed plays from Vimeo, and the first goes back to its poster`, other.vimeo.frame?.src === "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=8272103f6e" && other.youtube.button !== null && off.length === 2, { other, off });
      /* Leaving the place: whatever a face keeps of it, no player is left playing. */
      await page.evaluate(() => {
        history.pushState(null, "", "/films/");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      let left = Infinity;
      for (let i = 0; i < 100 && left > 0; i += 1) {
        await page.waitForTimeout(50);
        left = page.frames().filter((one) => /vimeo|nocookie/.test(one.url())).length;
      }
      say(`${on}, a player does not go on once the place is left`, left === 0, { left, frames: page.frames().map((one) => one.url()) });
      await context.close();
    }

    {
      const { context, page, off, until } = await open("");
      await until((now) => now.youtube.button !== null, "the play button, for the keyboard");
      await page.locator('[data-worker-view="films"] #again').first().focus();
      const stops = [];
      let pressed;
      for (let i = 0; i < 12 && !pressed; i += 1) {
        /* WebKit tabs to a link with Alt held, as Safari does. */
        await page.keyboard.press(engine === "webkit" ? "Alt+Tab" : "Tab");
        const at = await page.evaluate(() => {
          let on = document.activeElement;
          while (on?.shadowRoot?.activeElement) on = on.shadowRoot.activeElement;
          return on?.getAttribute("aria-label") ?? on?.textContent?.slice(0, 40) ?? null;
        });
        stops.push(at);
        if (at === "Play: The keynote") {
          await page.keyboard.press("Enter");
          pressed = true;
        }
      }
      const now = await until((one) => one.youtube.frame !== null, "the player, by the keyboard");
      await load(page, "youtube-nocookie.com");
      say("the keyboard reaches the play button, Enter plays, and the keyboard is in the player and not lost", pressed === true && now.youtube.frame?.focused === true && now.path === `${BASE}/places/films` && off.length === 1, { stops, now: now.youtube, off });
      /* And on to the link, past what the player holds. */
      const after = [];
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press(engine === "webkit" ? "Alt+Tab" : "Tab");
        const linked = (await seen(page)).youtube.link;
        after.push(linked?.focused);
        if (linked?.focused) break;
      }
      say("and the link out is a stop of its own after it", after.at(-1) === true, after);
      await page.emulateMedia({ media: "print" });
      const printed = await page.evaluate(() => {
        const shadow = document.querySelector('[data-worker-view="films"]').shadowRoot.querySelector(".card graview-video").shadowRoot;
        return { frame: shadow.querySelector("iframe") ? getComputedStyle(shadow.querySelector("iframe")).opacity : null, address: getComputedStyle(shadow.querySelector("[data-address]")).display, says: shadow.querySelector("[data-address]").textContent };
      });
      say("printed, the player is not drawn and the address is, and it plays on", printed.frame === "0" && printed.address === "inline" && printed.says.includes(`watch?v=${ID}`), printed);
      await context.close();
    }

    {
      const { context, off, until } = await open("?off");
      const now = await until((one) => one.youtube.link !== null && one.vimeo.button !== null, "a provider turned off");
      say("a provider its host turned off is its link alone, and the other still plays", now.youtube.button === null && now.youtube.box === null && now.youtube.link?.text === "The keynote: watch on YouTube ↗" && off.length === 0, { now, off });
      await context.close();
    }

    {
      const { context, page, off, until, shot } = await open("?csp");
      await until((one) => one.youtube.button !== null, "the play button, under a policy");
      await button(page, ".card").click();
      const now = await until((one) => one.youtube.words !== null, "the player refused by the page's policy");
      await shot("policy");
      say("where the page's policy allows no frame from it, it says so, keeps its link and the keyboard, and the host is told", now.youtube.frame === null && now.youtube.button === null && /do not play on this page/.test(now.youtube.words ?? "") && now.youtube.link?.focused === true && now.problems.some((one) => one.code === "embed-not-allowed") && off.length === 0, { now, off });
      await button(page, "#two").click();
      await until((one) => one.vimeo.frame !== null, "the player the policy allows");
      say("and the one it allows plays", (await load(page, "player.vimeo.com")) !== undefined, off);
      await context.close();
    }

    {
      const { context, page, off, until, shot } = await open("", { width: 390, height: 844 });
      const now = await until((one) => one.youtube.button !== null, "the play button on a phone");
      await shot("phone");
      say("on a phone it is within the page, its box and its link big enough to press", now.wide <= 390 && now.youtube.box[2] >= 250 && now.youtube.box[3] >= 140 && now.youtube.link.tall >= 24 && off.length === 0, now);
      await button(page, "#two").scrollIntoViewIfNeeded();
      await button(page, "#two").click();
      await until((one) => one.vimeo.frame !== null, "the player on a phone");
      say("and plays there", (await load(page, "player.vimeo.com")) !== undefined, off);
      await context.close();
    }

    {
      const { context, page, off, shot } = await open("/places/overview?face=graview#focus=aggregate%3Atask&in.view=films");
      let card;
      for (let i = 0; i < 200; i += 1) {
        card = await page.evaluate(() => {
          const view = document.querySelector('[data-graview-preview] [data-worker-view="films"]');
          const shadow = view?.shadowRoot?.querySelector(".card graview-video")?.shadowRoot;
          return shadow?.querySelector("a") ? { button: shadow.querySelector("button") !== null, frame: shadow.querySelector("iframe") !== null, words: shadow.querySelector("[data-words]")?.textContent ?? null, link: shadow.querySelector("a").href } : null;
        });
        if (card) break;
        await page.waitForTimeout(50);
      }
      await shot("scene-card");
      say("in the Scene's card it is a poster and a link, with nothing to play and nothing asked", card !== null && !card.button && !card.frame && card.words === "The keynote" && card.link.includes(ID) && off.length === 0, { card, off });
      await context.close();
    }
    await browser.close();
  }
} catch (error) {
  report.checks["the harness ran to its end"] = { ok: false, saw: String(error?.stack ?? error).slice(0, 600) };
  process.stdout.write(`NO  ${String(error?.stack ?? error)}\n`);
} finally {
  stop();
}
report.checks["no page threw"] = { ok: report.pageErrors.length === 0, saw: report.pageErrors.slice(0, 5) };
report.ok = Object.values(report.checks).every((one) => one.ok);
writeFileSync(resolve(repoRoot, "docs/video-embeds.json"), `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);
