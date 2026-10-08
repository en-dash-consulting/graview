/**
 * A VIEW OF ONE RECORD BESIDE ITS EDITING, IN A REAL BROWSER (FR-149,
 * FR-150, FR-151): the record transport of `scripts/guest-sandbox.mjs`.
 *
 * Graview Cloud's workshop in miniature (scripts/fixtures/workshop-app.ts):
 * a deliverable is a subject and a draft of several paragraphs. The embed
 * is mounted the way a host mounts it, with the graview-worker-view skill's
 * own worked example of a view of one record (`examples/a-record.js`)
 * registered for `deliverable`, as a plain script (FR-96). Nick, staff, may
 * change the draft; Rae, a reviewer, may read it and change nothing, and
 * may not see the internal memo. The claims: on the scene and on Pages the
 * view is drawn above the record's own fields, which stay editable, unless
 * its manifest says `replaces: "page"`; the view draws the draft as
 * paragraphs, read off `props.node`; "Edit draft" opens the whole draft,
 * filled by the host, and a person's edit saves with its line breaks; and
 * a view that offers Rae the same field, or binds one to the memo she may
 * not see, gets nothing filled in, and her press changes nothing.
 */
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

export const RECORD_MANIFEST = { name: "deliverable", attach: "deliverable", cardinality: "one", acts: ["set-draft"] };
const EMAIL = "deliverable:email";
const ADDED = "P.S. The barn has parking for forty.";

export async function recordSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, engine }) {
  const example = readFileSync(resolve(repoRoot, "packages/skills/skills/graview-worker-view/examples/a-record.js"), "utf8");
  /* The same view, offering the edit to every seat, and a second field bound to the memo: what a careless or hostile author writes. */
  const eager = example
    .replace(/const editable = [^;]+;/, "const editable = true;")
    .replace("<p role=\"note\">", '<fieldset data-record="memo:margin" class="memo"><textarea name="body" data-prefill="body" aria-label="The memo"></textarea><button data-act="quote-draft">Quote</button></fieldset><p role="note">');
  if (eager === example) throw new Error("the eager view is the example: the example changed shape");
  const out = mkdtempSync(join(tmpdir(), "graview-guest-record-"));
  const shots = process.env.GRAVIEW_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { nick, rae, workshopApp, workshopSeed, EMAIL_DRAFT } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/workshop-app.ts"))};
const asked = new URLSearchParams(location.search);
window.__failures = [];
window.__draft = EMAIL_DRAFT;
const manifest = { ...${JSON.stringify(RECORD_MANIFEST)}, ...(asked.get("eager") ? { acts: ["set-draft", "quote-draft"] } : {}), ...(asked.get("replaces") ? { replaces: asked.get("replaces") } : {}) };
const definition = { manifest, worker: { source: asked.get("eager") ? window.EAGER : window.EXAMPLE }, author: "Made by Claude, for nick", onFailure: (reason, detail) => window.__failures.push([reason, detail]) };
window.__handle = mount(document.getElementById("app"), {
  app: workshopApp,
  seed: workshopSeed,
  principal: asked.get("seat") === "rae" ? rae : nick,
  face: asked.get("face") ?? "scene",
  ...(asked.get("path") ? { path: asked.get("path") } : {}),
  scheme: "light",
  label: "Workshop",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, definition),
});
window.__handle.drawn().then(() => { window.__ready = true; });
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
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workshop</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script>window.EXAMPLE = ${JSON.stringify(example).replace(/<\/script/gi, "<\\/script")}; window.EAGER = ${JSON.stringify(eager).replace(/<\/script/gi, "<\\/script")};</script><script type="module" src="/entry.js"></script></body></html>`;
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

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const shot = async (name) => {
      if (shots) await tab.screenshot({ path: join(shots, `${name}-${engine}.png`) }).catch(() => {});
    };
    const open = async (query) => {
      await tab.goto(`${HOST}/?${query}`, { waitUntil: "load" });
      await tab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    };
    /* The record chosen and drawn at full on the scene, the way a link to it does. */
    const focusOnScene = async () => {
      await tab.evaluate((stop) => window.__handle.setStop(stop), `#focus=${encodeURIComponent(EMAIL)}`);
      await tab.waitForTimeout(900);
    };
    const region = () => tab.locator('[data-worker-view="deliverable"]');
    const viewDrawn = () => tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="deliverable"]')?.shadowRoot?.querySelector(".record h2")), null, { timeout: 20_000 }).then(() => true, () => false);
    /* What is drawn of the record: the view, and the record's own editable fields, and where each is. */
    const drawnRecord = () =>
      tab.evaluate((id) => {
        const view = document.querySelector('[data-worker-view="deliverable"]');
        const root = view?.shadowRoot;
        const fields = document.querySelector(`[data-graview-fields="${id}"]`);
        const below = view && fields ? Boolean(view.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
        return {
          view: Boolean(root?.querySelector(".record h2")),
          heading: root?.querySelector(".record h2")?.textContent ?? null,
          paragraphs: [...(root?.querySelectorAll(".draft p") ?? [])].map((p) => p.textContent),
          fields: Boolean(fields),
          // Long text says it can be changed on its "Edit" by the label (FR-147); a short field, on itself.
          draftEditable: (fields?.querySelector('[data-graview-long="draft"] [data-graview-editable]') ?? fields?.querySelector('[data-graview-field="draft"]'))?.getAttribute("data-graview-editable") ?? null,
          below,
          facts: Boolean(document.querySelector('[data-testid="record-fields"]')),
          acts: Boolean(document.querySelector('[data-testid="record-actions"]')),
          author: document.querySelector('[data-worker-view-author="deliverable"]')?.textContent ?? null,
        };
      }, EMAIL);
    const draftNow = () => tab.evaluate((id) => window.__handle.store.graph.getNode(id).draft, EMAIL);
    const draft = await (async () => {
      await open("face=pages");
      return tab.evaluate(() => window.__draft);
    })();
    const paragraphs = draft.split(/\n\s*\n/).filter((one) => one.trim() !== "");

    // ── the scene, beside ──
    await open("face=scene");
    await focusOnScene();
    await viewDrawn();
    const scene = await drawnRecord();
    await shot("scene-beside");
    claim("on the scene, a custom view of one record is drawn and the record's own fields are drawn under it, the draft editable", scene.view && scene.fields && scene.below === true && scene.draftEditable === "set-draft" && scene.author === "Made by Claude, for nick", scene);
    claim("the view draws the draft formatted: each paragraph its own, read off props.node", scene.heading === "Email to Todd" && JSON.stringify(scene.paragraphs) === JSON.stringify(paragraphs), { heading: scene.heading, drawn: scene.paragraphs.length, paragraphs: paragraphs.length });

    // ── Pages, beside ──
    await open(`face=pages&path=${encodeURIComponent(`/deliverables/${encodeURIComponent(EMAIL)}`)}`);
    await viewDrawn();
    const pages = await drawnRecord();
    await shot("pages-beside");
    claim("on Pages, the record's page is the view, then its facts and what can be done", pages.view && pages.facts && pages.acts && !pages.fields, pages);

    // ── replaces: "page" ──
    await open("face=scene&replaces=page");
    await focusOnScene();
    await viewDrawn();
    const sceneAlone = await drawnRecord();
    claim('with replaces: "page", on the scene the view is drawn alone, without the record\'s fields', sceneAlone.view && !sceneAlone.fields, sceneAlone);
    await open(`face=pages&replaces=page&path=${encodeURIComponent(`/deliverables/${encodeURIComponent(EMAIL)}`)}`);
    await viewDrawn();
    const pagesAlone = await drawnRecord();
    await shot("pages-replaced");
    claim('with replaces: "page", on Pages the view is the page under its heading, without facts or acts', pagesAlone.view && !pagesAlone.facts && !pagesAlone.acts, pagesAlone);

    // ── prefill: Nick edits the whole draft in the view ──
    await open(`face=pages&path=${encodeURIComponent(`/deliverables/${encodeURIComponent(EMAIL)}`)}`);
    await viewDrawn();
    await region().locator("summary").click();
    const textarea = region().locator('textarea[name="draft"]');
    await textarea.waitFor({ timeout: 10_000 });
    await tab.waitForTimeout(200);
    const filled = await textarea.inputValue();
    await shot("prefilled");
    claim('"Edit draft" opens a textarea the host filled with the whole draft, its line breaks kept', filled === draft, { length: filled.length, expected: draft.length, breaks: (filled.match(/\n/g) ?? []).length });
    await textarea.evaluate((field) => {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
    await tab.keyboard.type("\n\n");
    await tab.keyboard.type(ADDED, { delay: 2 });
    await region().locator('button[data-act="set-draft"]').click();
    await tab.waitForFunction((id) => window.__handle.store.graph.getNode(id).draft !== window.__draft, EMAIL, { timeout: 5_000 }).catch(() => {});
    const saved = await draftNow();
    const log = await tab.evaluate(() => window.__handle.store.log.all().map((op) => ({ via: op.via, author: op.author.id })));
    claim("editing the prefilled draft and pressing the act saves it with its line breaks intact, as Nick, through the view", saved === `${draft}\n\n${ADDED}` && log.at(-1)?.via === "view:deliverable" && log.at(-1)?.author === "person:nick", { saved: saved.slice(-80), breaks: (saved.match(/\n/g) ?? []).length, log: log.at(-1) });
    await tab.waitForTimeout(400);
    const redrawn = await tab.evaluate(() => [...document.querySelector('[data-worker-view="deliverable"]').shadowRoot.querySelectorAll(".draft p")].map((p) => p.textContent));
    claim("the view draws the saved draft, its new paragraph its own", redrawn.length === paragraphs.length + 1 && redrawn.at(-1) === ADDED, { drawn: redrawn.length });

    // ── a seat that may not write the draft ──
    await open(`face=pages&seat=rae&eager=1&path=${encodeURIComponent(`/deliverables/${encodeURIComponent(EMAIL)}`)}`);
    await viewDrawn();
    await region().locator("summary").click();
    await region().locator('textarea[name="draft"]').waitFor({ timeout: 10_000 });
    await tab.waitForTimeout(300);
    const forRae = await tab.evaluate(() => {
      const root = document.querySelector('[data-worker-view="deliverable"]').shadowRoot;
      return { draft: root.querySelector('textarea[name="draft"]').value, memo: root.querySelector('textarea[name="body"]')?.value ?? null, text: root.textContent };
    });
    await shot("rae-unfilled");
    claim("a seat that may not write the draft gets no prefilled writable field", forRae.draft === "", { length: forRae.draft.length });
    claim("prefill never hands a field the seat may not see: the memo Rae may not see fills nothing and is nowhere in the view", forRae.memo === "" && !forRae.text.includes("18 percent"), forRae.memo);
    await region().locator('button[data-act="set-draft"]').click();
    await tab.waitForTimeout(400);
    claim("her press on the act changes nothing", (await draftNow()) === draft);

    claim("no view failed", (await tab.evaluate(() => window.__failures)).length === 0, await tab.evaluate(() => window.__failures));
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}
