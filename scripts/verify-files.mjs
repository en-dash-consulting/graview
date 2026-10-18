#!/usr/bin/env node
/**
 * A PICTURE OR A DOCUMENT ON A RECORD, PUT THERE FROM THE PAGE (FR-162, FR-163).
 *
 * Graview Cloud asked, after 0.1.23, for a record that can hold a picture
 * or a document, put there from the page through the host's own storage.
 * The app is a document mounted the way Cloud mounts one — the embed on a
 * host's page that is the app, built with esbuild from the workspace's
 * sources (`scripts/fixtures/files/repairs.gdd.json`): a job with `photos`
 * (a list of images) and `papers` (a list of files), a card that shows the
 * first photo (`{"image": "photos", "as": "thumb"}`), and a place that
 * lists the jobs as cards. The host hands `files: filesAt("/__graview/files",
 * …)` and serves that door with `devFilesHandler` from `@graview/ship/dev`,
 * which keeps what it is sent in memory and takes less than the page says
 * (150 KB), so the host's own refusal is seen too.
 *
 * On the routed face (at 1280 and 390) and the scene (at 1280), in three
 * engines and both schemes, it asks:
 *
 *   a photo picked with the file input is sent, kept on the record by its
 *   act, and drawn in the record's gallery, said by its name; a photo pasted
 *   is kept beside it; a PDF picked is shown inline, with its download;
 *   the gallery opens a photo full size and gives the keyboard back to it;
 *   a file the host refuses is said in the editor's own words, and nothing
 *   is kept; taking the last act back takes the file off the record; the
 *   list's row and the place's card draw the first photo small; without
 *   the host's files the editor says this host takes none and offers no way
 *   to add one; and every picture drawn says what it is.
 *
 *   A video (0.1.37, `clip`, a one-second WebM of 624 bytes) picked is kept
 *   by its act and played on the record's page — native controls, the
 *   keyboard on it, only its metadata fetched, its length read from that
 *   and said — and the list's row draws it as its first frame with a play
 *   glyph and its length.
 *
 *   node scripts/verify-files.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCHEMES = QUICK ? ["light"] : ["light", "dark"];
/** `--shots=<dir>`: each screen, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const PROBE = process.argv.includes("--probe");
const REPAIRS = resolve(repoRoot, "scripts/fixtures/files/repairs.gdd.json");
const REPAIRS_SEED = resolve(repoRoot, "scripts/fixtures/files/repairs.seed.json");
const SERVER_TAKES = 150_000;

const SCREENS = [
  { face: "pages", width: 1280, height: 800 },
  { face: "pages", width: 390, height: 844 },
  { face: "graview", width: 1280, height: 800 },
];

/** A PNG of one color, `size` pixels square — or of noise, which no compressor makes small. */
function png(size, [r, g, b], noise = false) {
  const row = 1 + size * 3;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = y * row + 1 + x * 3;
      raw[at] = noise ? Math.floor(Math.random() * 256) : r;
      raw[at + 1] = noise ? Math.floor(Math.random() * 256) : g;
      raw[at + 2] = noise ? Math.floor(Math.random() * 256) : b;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: noise ? 0 : 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 100]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const PORCH = { name: "porch.png", mimeType: "image/png", buffer: png(48, [200, 120, 60]) };
const GUTTER = { name: "gutter.png", mimeType: "image/png", buffer: png(32, [40, 120, 200]) };
const NOISE = { name: "noise.png", mimeType: "image/png", buffer: png(260, [0, 0, 0], true) };
const QUOTE = { name: "quote.pdf", mimeType: "application/pdf", buffer: PDF };
/* A second of one color, 32 pixels square, as WebM (VP8): what every engine here plays, in 624 bytes. */
const CLIP = { name: "clip.webm", mimeType: "video/webm", buffer: readFileSync(resolve(repoRoot, "scripts/fixtures/files/clip.webm")) };

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, screens: SCREENS, serverTakes: SERVER_TAKES, noiseBytes: NOISE.buffer.length, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>House repairs</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page, and its door: the page IS the app, as Cloud's shell mounts it, and the door is the dev server's. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-files-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { filesAt } from "@graview/ship/browser";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import repairs from ${JSON.stringify(REPAIRS)};
        import seed from ${JSON.stringify(REPAIRS_SEED)};
        const asked = new URLSearchParams(location.search);
        const compiled = compileDocumentWithoutCheck(repairs, { today: () => "2026-10-11" });
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          /* "files=0": a host that takes no files. */
          const files = asked.get("files") === "0" ? undefined : filesAt("/__graview/files", { maxBytes: 1000000, kinds: ["image/*", "video/*", "application/pdf"] });
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: asked.get("face") === "graview" ? "graview" : "pages",
            routing: "address",
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
            ...(files ? { files } : {}),
          });
          window.__handle.drawn().then(() => { window.__ready = true; });
        }`,
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
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const { devFilesHandler } = await import(pathToFileURL(resolve(repoRoot, "packages/ship/dist/dev.js")).href);
  const door = devFilesHandler({ maxBytes: SERVER_TAKES, kinds: ["image/*", "video/*", "application/pdf"] });
  const host = createServer((request, response) => {
    if ((request.url ?? "").startsWith("/__graview/files")) return void door(request, response);
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    const script = path.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) {
      response.writeHead(404);
      response.end();
      return;
    }
    // Every address that is no script is the one page, as a host whose page is the app answers it.
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await new Promise((ready) => host.listen(portFor("files-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** What a record holds of a field, read from the store: the files' names. */
const held = (page, id, field) => page.evaluate(([id, field]) => (window.__handle.store.graph.getNode(id)?.[field] ?? []).map((file) => file.name), [id, field]);

async function until(page, check, timeout = 10_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

/** Every picture drawn in a files' part, and whether each says what it is and has arrived. */
function pictures() {
  /* A video's thumbnail is said as a whole (`role="img"`), its poster or first frame inside it saying nothing of its own. */
  return [...document.querySelectorAll("[data-graview-files] img, [data-graview-gallery] img, [data-graview-thumb], .graview-spec-image img, video[data-graview-video]")]
    .filter((img) => !img.closest("[data-graview-video-thumb]") || img.matches("[data-graview-video-thumb]"))
    .map((img) => ({
      alt: img.getAttribute("alt") ?? img.getAttribute("aria-label"),
      src: img.getAttribute("src"),
      loaded: img.localName === "img" ? img.complete && img.naturalWidth > 0 : true,
    }));
}

const host = await buildHost();
const errors = [];
const seen = { picked: [], pasted: [], pdf: [], full: [], refused: [], undone: [], rows: [], cards: [], scene: [], none: [], said: [], played: [], videoRows: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const open = async (path, query, viewport) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${path}?${query}: ${error.message}`));
        await page.goto(`${at("files-host")}${path}?${query}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${engine} ${scheme} ${path}?${query}: the document did not compile: ${failed}`);
        await page.waitForTimeout(800);
        return { page, close: () => context.close() };
      };
      for (const screen of SCREENS) {
        const viewport = { width: screen.width, height: screen.height };
        const where = { engine, scheme, face: screen.face, width: screen.width };
        const shot = async (page, name) => {
          if (!SHOTS || engine !== engines[0]) return;
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${screen.face}-${screen.width}-${name}.png`), fullPage: screen.face === "pages" });
        };
        if (screen.face === "graview") {
          /* THE SCENE: the record in focus, its photos' editor where its facts are. */
          const { page, close } = await open("/places/overview", `face=graview#focus=roof`, viewport);
          const one = { ...where, kept: [], drawn: false };
          try {
            const input = page.locator('[data-graview-files="photos"] input[data-graview-file-input]').first();
            await input.waitFor({ state: "attached", timeout: 15_000 });
            await input.setInputFiles(PORCH);
            await until(page, async () => (await held(page, "roof", "photos")).length === 1);
            one.kept = await held(page, "roof", "photos");
            one.drawn = await until(page, () => page.evaluate(() => [...document.querySelectorAll('[data-graview-files="photos"] [data-graview-gallery] img')].some((img) => img.complete && img.naturalWidth > 0)));
            seen.said.push({ ...where, pictures: await page.evaluate(pictures) });
            await shot(page, "scene");
          } catch (error) {
            one.error = String(error.message ?? error).split("\n")[0];
          }
          seen.scene.push(one);
          await close();
          continue;
        }
        {
          /* THE RECORD'S PAGE: picked, pasted, a PDF, full size, refused, taken back. */
          const { page, close } = await open("/jobs/roof", "face=pages", viewport);
          const photos = '[data-graview-files="photos"]';
          try {
            const input = page.locator(`${photos} input[data-graview-file-input]`).first();
            await input.waitFor({ state: "attached", timeout: 15_000 });
            if (PROBE) process.stdout.write(`${engine} ${scheme} ${screen.width}: the photos' editor is drawn\n`);
            await input.setInputFiles(PORCH);
            await until(page, async () => (await held(page, "roof", "photos")).length === 1);
            const drawn = await until(page, () => page.evaluate((photos) => [...document.querySelectorAll(`${photos} [data-graview-gallery] img`)].some((img) => img.complete && img.naturalWidth > 0), photos));
            seen.picked.push({ ...where, kept: await held(page, "roof", "photos"), drawn, alt: await page.locator(`${photos} [data-graview-gallery] img`).first().getAttribute("alt") });
            await shot(page, "picked");

            /* Opened full size, and the keyboard given back to the picture it opened from. */
            const opener = page.locator(`${photos} [data-graview-gallery] button`).first();
            await opener.click();
            const opened = await until(page, () => page.evaluate(() => {
              const dialog = document.querySelector("dialog[data-graview-full]");
              const img = dialog?.querySelector("img");
              return Boolean(dialog?.open && img?.complete && img.naturalWidth > 0);
            }));
            const big = await page.evaluate(() => {
              const img = document.querySelector("dialog[data-graview-full] img");
              return img ? Math.round(img.getBoundingClientRect().width) : 0;
            });
            await shot(page, "full");
            await page.keyboard.press("Escape");
            const closed = await until(page, () => page.evaluate(() => !document.querySelector("dialog[data-graview-full]")));
            const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
            seen.full.push({ ...where, opened, big, closed, back });

            /* Pasted: a picture on the clipboard, pasted into the editor. */
            await page.evaluate(([photos, data]) => {
              const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
              const file = new File([bytes], "gutter.png", { type: "image/png" });
              const target = document.querySelector(`${photos} [data-graview-file-editor] button`);
              let event;
              try {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                event = new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true });
                if (!event.clipboardData?.files?.length) throw new Error("no files on the event");
              } catch {
                // An engine that builds no clipboard of its own is handed one, as a paste from the system's would carry.
                event = new Event("paste", { bubbles: true, cancelable: true });
                Object.defineProperty(event, "clipboardData", { value: { files: [file] } });
              }
              target.dispatchEvent(event);
            }, [photos, GUTTER.buffer.toString("base64")]);
            await until(page, async () => (await held(page, "roof", "photos")).length === 2);
            seen.pasted.push({ ...where, kept: await held(page, "roof", "photos"), drawn: await page.locator(`${photos} [data-graview-gallery] img`).count() });

            /* A PDF: shown inline, with its download beside it. */
            await page.locator('[data-graview-files="papers"] input[data-graview-file-input]').first().setInputFiles(QUOTE);
            await until(page, async () => (await held(page, "roof", "papers")).length === 1);
            const pdf = await until(page, () => page.evaluate(() => {
              const object = document.querySelector('[data-graview-files="papers"] object[type="application/pdf"]');
              const link = document.querySelector('[data-graview-files="papers"] a[download="quote.pdf"]');
              return Boolean(object?.getAttribute("data")?.startsWith("/__graview/files/") && link);
            }));
            seen.pdf.push({ ...where, kept: await held(page, "roof", "papers"), inline: pdf });
            await shot(page, "pdf");

            /* Refused by the host: more than it takes. Said in words; nothing kept. */
            await input.setInputFiles(NOISE);
            await until(page, () => page.evaluate((photos) => Boolean(document.querySelector(`${photos} [role="alert"]`)?.textContent), photos), 15_000);
            const said = await page.evaluate((photos) => document.querySelector(`${photos} [role="alert"]`)?.textContent ?? null, photos);
            seen.refused.push({ ...where, said, kept: await held(page, "roof", "photos") });
            await shot(page, "refused");

            /* Taken back: the last act, the PDF's, by the way back the face offers after it. */
            const takeBack = page.getByRole("button", { name: /^Take back/ }).first();
            let undone = false;
            if ((await takeBack.count()) > 0) {
              await takeBack.click();
              undone = await until(page, async () => (await held(page, "roof", "papers")).length === 0);
            } else {
              await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
              undone = await until(page, async () => (await held(page, "roof", "papers")).length === 0);
            }
            const gone = await until(page, () => page.evaluate(() => !document.querySelector('[data-graview-files="papers"] object')));
            seen.undone.push({ ...where, undone, gone, photos: await held(page, "roof", "photos") });
            seen.said.push({ ...where, pictures: await page.evaluate(pictures) });
          } catch (error) {
            seen.picked.push({ ...where, error: String(error.message ?? error).split("\n")[0] });
          }
          await close();
        }
        {
          /* The list's row and the place's card: the first photo, small, on the same store (put there first). */
          const { page, close } = await open("/jobs/porch", "face=pages", viewport);
          const row = { ...where, drawn: false, alt: null };
          const card = { ...where, drawn: false, alt: null };
          try {
            const input = page.locator('[data-graview-files="photos"] input[data-graview-file-input]').first();
            await input.waitFor({ state: "attached", timeout: 15_000 });
            await input.setInputFiles(GUTTER);
            await until(page, async () => (await held(page, "porch", "photos")).length === 1);
            await page.evaluate(() => window.__handle.setPath("/jobs"));
            row.drawn = await until(page, () => page.evaluate(() => [...document.querySelectorAll("img[data-graview-thumb]")].some((img) => img.complete && img.naturalWidth > 0)));
            row.alt = await page.locator("img[data-graview-thumb]").first().getAttribute("alt").catch(() => null);
            await shot(page, "row");
            await page.evaluate(() => window.__handle.setPath("/places/around-the-house"));
            card.drawn = await until(page, () => page.evaluate(() => [...document.querySelectorAll(".graview-spec-image img")].some((img) => img.complete && img.naturalWidth > 0)));
            card.alt = await page.locator(".graview-spec-image img").first().getAttribute("alt").catch(() => null);
            seen.said.push({ ...where, pictures: await page.evaluate(pictures) });
            await shot(page, "card");
          } catch (error) {
            row.error = String(error.message ?? error).split("\n")[0];
          }
          seen.rows.push(row);
          seen.cards.push(card);
          await close();
        }
        {
          /* A VIDEO (0.1.37): picked, kept by its act, played on the record's page, and a thumbnail on the list's row. */
          const { page, close } = await open("/jobs/gate", "face=pages", viewport);
          const played = { ...where, kept: [], accept: null, player: null };
          const row = { ...where, thumb: null };
          try {
            const input = page.locator('[data-graview-files="clip"] input[data-graview-file-input]').first();
            await input.waitFor({ state: "attached", timeout: 15_000 });
            played.accept = await input.getAttribute("accept");
            await input.setInputFiles(CLIP);
            await until(page, async () => (await page.evaluate(() => window.__handle.store.graph.getNode("gate")?.clip?.name ?? null)) === "clip.webm");
            played.kept = await page.evaluate(() => window.__handle.store.graph.getNode("gate")?.clip?.name ?? null);
            await until(page, () => page.evaluate(() => (document.querySelector('[data-graview-files="clip"] video[data-graview-video]')?.readyState ?? 0) >= 1));
            await until(page, () => page.evaluate(() => /0:01$/.test(document.querySelector('[data-graview-files="clip"] [data-graview-video-said]')?.textContent ?? "")), 3_000);
            played.player = await page.evaluate(() => {
              const video = document.querySelector('[data-graview-files="clip"] video[data-graview-video]');
              if (!video) return null;
              video.focus();
              return {
                src: video.getAttribute("src"),
                controls: video.controls,
                preload: video.getAttribute("preload"),
                metadata: video.readyState >= 1,
                duration: Math.round(video.duration),
                said: document.querySelector('[data-graview-files="clip"] [data-graview-video-said]')?.textContent ?? null,
                label: video.getAttribute("aria-label"),
                focused: document.activeElement === video,
                wide: Math.round(video.getBoundingClientRect().width),
              };
            });
            await shot(page, "video");
            await page.evaluate(() => window.__handle.setPath("/jobs"));
            await until(page, () => page.evaluate(() => /0:01/.test(document.querySelector('[data-graview-record="gate"] [data-graview-video-clock]')?.textContent ?? "")));
            row.thumb = await page.evaluate(() => {
              const thumb = document.querySelector('[data-graview-record="gate"] [data-graview-video-thumb]');
              return thumb ? { label: thumb.getAttribute("aria-label"), role: thumb.getAttribute("role"), glyph: Boolean(thumb.querySelector("[data-graview-play-glyph]")), clock: thumb.querySelector("[data-graview-video-clock]")?.textContent ?? null } : null;
            });
            seen.said.push({ ...where, pictures: await page.evaluate(pictures) });
            await shot(page, "video-row");
          } catch (error) {
            played.error = String(error.message ?? error).split("\n")[0];
          }
          seen.played.push(played);
          seen.videoRows.push(row);
          await close();
        }
        {
          /* A host that takes no files: said, and nothing offered. */
          const { page, close } = await open("/jobs/roof", "face=pages&files=0", viewport);
          const none = { ...where, said: null, inputs: -1 };
          try {
            await page.locator('[data-graview-files="photos"] [data-graview-file-none]').first().waitFor({ timeout: 15_000 });
            none.said = await page.locator('[data-graview-files="photos"] [data-graview-file-none]').first().textContent();
            none.inputs = await page.locator("input[data-graview-file-input], [data-graview-file-choose]").count();
          } catch (error) {
            none.error = String(error.message ?? error).split("\n")[0];
          }
          seen.none.push(none);
          await close();
        }
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const pagesScreens = SCREENS.filter((screen) => screen.face === "pages").length * SCHEMES.length * engines.length;
const sceneScreens = SCREENS.filter((screen) => screen.face === "graview").length * SCHEMES.length * engines.length;
const all = (list, count, holds) => list.length === count && list.every(holds);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

report.checks.aPhotoPickedIsKeptByItsActAndDrawnInTheGallery = {
  seen: seen.picked,
  ok: all(seen.picked, pagesScreens, (one) => same(one.kept, ["porch.png"]) && one.drawn && one.alt === "porch.png"),
};
report.checks.aPhotoPastedIsKeptBesideIt = {
  seen: seen.pasted,
  ok: all(seen.pasted, pagesScreens, (one) => same(one.kept, ["porch.png", "gutter.png"]) && one.drawn === 2),
};
report.checks.theGalleryOpensAPhotoFullSizeAndGivesTheKeyboardBack = {
  seen: seen.full,
  ok: all(seen.full, pagesScreens, (one) => one.opened && one.big > 40 && one.closed && one.back === "Open porch.png full size"),
};
report.checks.aPdfIsShownInlineWithItsDownload = {
  seen: seen.pdf,
  ok: all(seen.pdf, pagesScreens, (one) => same(one.kept, ["quote.pdf"]) && one.inline),
};
report.checks.aFileTheHostRefusesIsSaidInWordsAndNothingIsKept = {
  seen: seen.refused,
  ok: all(seen.refused, pagesScreens, (one) => one.said === `“noise.png” wasn’t kept: it is more than 150 KB, the most this server takes` && same(one.kept, ["porch.png", "gutter.png"])),
};
report.checks.takingTheLastActBackTakesTheFileOffTheRecord = {
  seen: seen.undone,
  ok: all(seen.undone, pagesScreens, (one) => one.undone && one.gone && same(one.photos, ["porch.png", "gutter.png"])),
};
report.checks.theListsRowDrawsTheFirstPhotoSmall = {
  seen: seen.rows,
  ok: all(seen.rows, pagesScreens, (one) => one.drawn && one.alt === "gutter.png"),
};
report.checks.thePlacesCardDrawsTheFirstPhotoSmall = {
  seen: seen.cards,
  ok: all(seen.cards, pagesScreens, (one) => one.drawn && one.alt === "gutter.png"),
};
report.checks.theSceneTakesAPhotoWhereTheRecordsFactsAre = {
  seen: seen.scene,
  ok: all(seen.scene, sceneScreens, (one) => same(one.kept, ["porch.png"]) && one.drawn),
};
report.checks.withoutTheHostsFilesTheEditorSaysSoAndOffersNothing = {
  seen: seen.none,
  ok: all(seen.none, pagesScreens, (one) => one.said === "This host doesn’t take files, so none can be added here." && one.inputs === 0),
};
report.checks.aVideoPickedIsKeptByItsActAndPlayedWithNativeControlsAndItsLength = {
  seen: seen.played,
  ok: all(
    seen.played,
    pagesScreens,
    (one) =>
      one.kept === "clip.webm" &&
      one.accept === "video/*" &&
      one.player?.src?.startsWith("/__graview/files/") &&
      one.player.controls &&
      one.player.preload === "metadata" &&
      one.player.metadata &&
      one.player.duration === 1 &&
      one.player.said === "clip.webm · 0:01" &&
      one.player.label === "clip.webm, a 1-second video" &&
      one.player.focused &&
      one.player.wide >= 200,
  ),
};
report.checks.theListsRowDrawsAVideoAsItsFrameWithAPlayGlyphAndItsLength = {
  seen: seen.videoRows,
  ok: all(seen.videoRows, pagesScreens, (one) => one.thumb?.role === "img" && one.thumb.label === "clip.webm, a 1-second video" && one.thumb.glyph && one.thumb.clock === "0:01"),
};
report.checks.everyPictureSaysWhatItIs = {
  seen: seen.said.map((one) => ({ ...one, pictures: one.pictures.filter((picture) => !picture.alt) })),
  ok: seen.said.length > 0 && seen.said.every((one) => one.pictures.length > 0 && one.pictures.every((picture) => typeof picture.alt === "string" && picture.alt.length > 0)),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/files.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/files.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
