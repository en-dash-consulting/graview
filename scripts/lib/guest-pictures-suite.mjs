/**
 * A WORKER VIEW DRAWS THE PICTURES ON A RECORD, IN A REAL BROWSER (FR-175):
 * the pictures transport of `scripts/guest-sandbox.mjs`.
 *
 * The embed is mounted over a crew's jobs (scripts/fixtures/jobs-app.ts) as
 * Ana, who is on the porch repair and not the roof survey, with a worker
 * view, "Job photos", whose manifest says `pictures: { width: 400 }`. The
 * host serves each file at its path only to a request carrying the
 * reader's session cookie, as Graview Cloud's files route does: a sandboxed
 * worker could never load it. The porch's photograph is a PNG 1 600 pixels
 * across; the step's is 40.
 *
 * The claims: the view draws both of the porch's pictures from addresses
 * the host made — `blob:` URLs of the page — the step's byte for byte at
 * its own size, the porch's made 400 pixels across; it is handed the SVG
 * plan and the PDF quote by name, type and size and draws no address for
 * them; nothing the view drew or was handed names a path on the host; the
 * host fetched each picture once, with the reader's cookie, and never the
 * roof's photograph (a record Ana may not see), the SVG or the PDF.
 *
 * Then the same app served under a base, `/a/jobs/`, as Graview Cloud
 * serves an app at `/a/<app>/` while its records keep `/graview/files/…`
 * (2026-10-18: "pictures: true never delivers src"). The host says where a
 * record's files are (`file` on the view's definition); the view draws the
 * porch's pictures, fetched under the base and never at the host's root.
 *
 * Then a host that says it once for the whole page, as Graview Cloud does
 * (0.1.36): `files: filesAt("/a/jobs/graview/files", …)` and no `file` on
 * the view. The view's pictures are fetched under the base all the same,
 * and the porch's own page draws its pictures, and links its quote, there.
 */
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

export const PHOTOS_MANIFEST = { name: "job-photos", title: "Job photos", attach: "job", cardinality: "many", pictures: { width: 400 } };

/** The view, as a chat writes one: each job, its pictures by the address the host handed, its papers by name. */
export const PHOTOS_JS = `
graview.style(\`
  .job { display: grid; gap: 8px; padding: 12px; }
  .job img { display: block; max-width: 100%; border-radius: var(--graview-radius); }
\`);
graview.onProps((props) => {
  const files = (job) => [...(job.photos || []), ...(job.papers || [])];
  graview.render(graview.html\`\${props.nodes.map((job) => graview.html\`<section class="job" data-key="\${job.id}" data-job="\${job.id}"><h3>\${job.label}</h3>\${files(job).map((file) => file.src
    ? graview.html\`<img data-key="\${file.name}" data-name="\${file.name}" alt="\${file.caption || file.name}" src="\${file.src}">\`
    : graview.html\`<p data-key="\${file.name}" data-document="\${file.name}">\${file.name} \${file.type} \${file.bytes}\${file.left ? " " + file.left : ""}</p>\`)}</section>\`)}\`);
});
`;

/** A real PNG, `width` × `height`, of one color. */
function png(width, height, [r, g, b]) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.from([0, ...Array.from({ length: width }, () => [r, g, b]).flat()]);
  const rows = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

const SESSION = "graview-session=ana-7c1";

export async function picturesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  /* The paths the fixture's records keep (FILES in scripts/fixtures/jobs-app.ts). */
  const files = {
    porch: "/graview/files/porch-3f9a.png",
    step: "/graview/files/step-77c1.png",
    plan: "/graview/files/plan-02bd.svg",
    quote: "/graview/files/quote-9e4f.pdf",
    roof: "/graview/files/roof-b5e0.png",
  };
  const served = {
    [files.porch]: { type: "image/png", body: png(1_600, 1_000, [180, 120, 60]) },
    [files.step]: { type: "image/png", body: png(40, 20, [20, 90, 160]) },
    [files.roof]: { type: "image/png", body: png(40, 20, [160, 20, 20]) },
    [files.plan]: { type: "image/svg+xml", body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>') },
    [files.quote]: { type: "application/pdf", body: Buffer.from("%PDF-1.4\n%%EOF\n") },
  };
  const js = (
    await build({
      stdin: {
        contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { recordPath } from "@graview/pages";
import { filesAt } from "@graview/ship/browser";
import { ana, jobsApp, jobsSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/jobs-app.ts"))};
window.__failures = [];
window.__problems = [];
/* Served under a base (Graview Cloud's /a/<app>/), the host says where a record's files are: on the view ("file"), or once for the page ("?files", filesAt under the base, as Cloud hands it). */
const base = location.pathname.startsWith("/a/jobs/") ? "/a/jobs" : "";
const asked = new URLSearchParams(location.search);
const once = asked.has("files");
const definition = { manifest: ${JSON.stringify(PHOTOS_MANIFEST)}, worker: { source: ${JSON.stringify(PHOTOS_JS)} }, ...(base && !once ? { file: (href) => base + href } : {}), onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) };
window.__handle = mount(document.getElementById("app"), {
  app: jobsApp,
  seed: jobsSeed,
  principal: ana,
  face: "pages",
  path: asked.has("record") ? recordPath(jobsApp.schema, "job", asked.get("record")) : "/places/job-photos",
  ...(once ? { files: filesAt(base + "/graview/files", { maxBytes: 1000000, kinds: ["image/*", "application/pdf"] }) } : {}),
  scheme: "light",
  label: "Jobs",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, definition),
});
`,
        resolveDir: resolve(repoRoot, "packages/embed"),
        loader: "js",
      },
      bundle: true,
      format: "iife",
      write: false,
      platform: "browser",
      target: "es2022",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [graviewSources(repoRoot)],
      logLevel: "silent",
    })
  ).outputFiles[0].text;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Jobs</title><style>body{margin:0}#app{position:relative;height:1400px}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  /* What reached the files route: the path, and whether it carried the reader's session. */
  const asked = [];
  const server = createServer((req, res) => {
    const page = req.url.split("?")[0];
    if (page === "/" || page === "/a/jobs/") {
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "set-cookie": `${SESSION}; Path=/; SameSite=Lax; HttpOnly` });
      return res.end(html);
    }
    /* Under the base as at the root: the bytes are the app's, wherever its page is served. */
    const file = served[req.url.startsWith("/a/jobs/graview/files/") ? req.url.slice("/a/jobs".length) : req.url];
    if (file) {
      const signed = (req.headers.cookie ?? "").split(/;\s*/).includes(SESSION);
      asked.push({ path: req.url, signed });
      if (!signed) {
        res.writeHead(401, { "content-type": "text/plain" });
        return res.end("Sign in to see this file.");
      }
      res.writeHead(200, { "content-type": file.type, "cache-control": "no-store" });
      return res.end(file.body);
    }
    res.writeHead(404);
    res.end();
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1, colorScheme: "light" });
    const requests = [];
    context.on("request", (request) => requests.push({ url: request.url(), type: request.resourceType() }));
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    const until = async (test, what) => {
      for (let i = 0; i < 150; i += 1) {
        if (await tab.evaluate(test).catch(() => false)) return;
        await tab.waitForTimeout(100);
      }
      throw new Error(`${what} never came: ${JSON.stringify(await tab.evaluate(() => ({ failures: window.__failures, text: document.body.innerText.slice(0, 400) })).catch(String))}`);
    };
    await until(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot;
      const images = [...(root?.querySelectorAll("img") ?? [])];
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0);
    }, "the porch's two pictures, drawn");
    await tab.waitForTimeout(300);
    const seen = await tab.evaluate(async () => {
      const root = document.querySelector('[data-worker-view="job-photos"]').shadowRoot;
      const images = Object.fromEntries(
        await Promise.all(
          [...root.querySelectorAll("img")].map(async (image) => {
            const src = image.getAttribute("src");
            const bytes = await fetch(src).then(async (response) => [...new Uint8Array(await response.arrayBuffer())]).catch((error) => `unread: ${error}`);
            return [image.getAttribute("data-name"), { scheme: src.slice(0, src.indexOf(":")), sameOrigin: src.startsWith(`blob:${location.origin}/`), natural: [image.naturalWidth, image.naturalHeight], alt: image.getAttribute("alt"), bytes }];
          }),
        ),
      );
      const documents = [...root.querySelectorAll("[data-document]")].map((one) => one.textContent.trim());
      const jobs = [...root.querySelectorAll("[data-job]")].map((one) => one.getAttribute("data-job"));
      const named = [...root.querySelectorAll("*")].filter((one) => [...one.attributes].some((attribute) => attribute.value.includes("/graview/files/")) || one.textContent.includes("/graview/files/")).length;
      return { images, documents, jobs, named, failures: window.__failures, problems: window.__problems };
    });
    const step = seen.images["step.png"];
    const porch = seen.images["porch.png"];
    const stepBytes = [...served[files.step].body];
    claim("the view draws only the job Ana is on: the porch repair, not the roof survey", seen.jobs.length === 1 && seen.jobs[0] === "job:porch", seen.jobs);
    claim("it draws the porch's photographs from blob: URLs of the page, which the host made from the bytes", Boolean(step && porch) && [step, porch].every((one) => one.scheme === "blob" && one.sameOrigin), { step: step && { scheme: step.scheme, sameOrigin: step.sameOrigin }, porch: porch && { scheme: porch.scheme, sameOrigin: porch.sameOrigin } });
    claim("the step's photograph is the file on the record, byte for byte, at its own size (40×20), with its caption as its alt", Array.isArray(step?.bytes) && step.bytes.length === stepBytes.length && step.bytes.every((byte, i) => byte === stepBytes[i]) && step.natural.join("x") === "40x20" && step.alt === "The cracked step", { natural: step?.natural, alt: step?.alt, bytes: Array.isArray(step?.bytes) ? step.bytes.length : step?.bytes });
    claim("the porch's photograph, 1600 pixels across, is handed made smaller to the 400 the view draws a picture at", porch?.natural.join("x") === "400x250" && Array.isArray(porch.bytes), { natural: porch?.natural, handed: Array.isArray(porch?.bytes) ? porch.bytes.length : porch?.bytes, stored: served[files.porch].body.length });
    claim("the SVG plan and the PDF quote are handed as their name, type and size, with no address", seen.documents.includes("plan.svg image/svg+xml 200") && seen.documents.includes("quote.pdf application/pdf 1800") && seen.documents.length === 2, seen.documents);
    claim("nothing the view drew names a path on the host", seen.named === 0, { named: seen.named });
    const fetched = asked.map((one) => one.path).sort();
    claim("the host fetched each of the porch's two pictures once, with the reader's session", fetched.length === 2 && fetched[0] === [files.porch, files.step].sort()[0] && fetched[1] === [files.porch, files.step].sort()[1] && asked.every((one) => one.signed), asked);
    claim("the roof's photograph, on a record Ana may not see, was never asked for; nor the SVG or the PDF", !requests.some((one) => [files.roof, files.plan, files.quote].some((path) => one.url.endsWith(path))), requests.filter((one) => one.url.includes("/graview/files/")));
    const pictureRequests = requests.filter((one) => one.url.includes("/graview/files/"));
    claim("every request for a picture was the host's fetch, never an image the view loaded", pictureRequests.length === 2 && pictureRequests.every((one) => one.type === "fetch"), pictureRequests);
    const elsewhere = requests.filter((one) => /^https?:/.test(one.url) && !one.url.startsWith(`${HOST}/`));
    claim("nothing else was requested", elsewhere.length === 0, elsewhere);
    claim("no view failed, and nothing was left out", seen.failures.length === 0 && seen.problems.length === 0, { failures: seen.failures, problems: seen.problems });
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);

    /* THE SAME APP UNDER A BASE: the records keep /graview/files/…, and the host says the files are under /a/jobs. */
    asked.length = 0;
    requests.length = 0;
    await tab.goto(`${HOST}/a/jobs/`, { waitUntil: "load" });
    await until(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot;
      const images = [...(root?.querySelectorAll("img") ?? [])];
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0);
    }, "the porch's two pictures, drawn under the base");
    await tab.waitForTimeout(300);
    const based = await tab.evaluate(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]').shadowRoot;
      return { images: [...root.querySelectorAll("img")].map((image) => ({ name: image.getAttribute("data-name"), blob: image.getAttribute("src").startsWith(`blob:${location.origin}/`), natural: [image.naturalWidth, image.naturalHeight] })), failures: window.__failures, problems: window.__problems };
    });
    claim("under a base, the view draws the porch's two pictures from blob: URLs the host made", based.images.length === 2 && based.images.every((one) => one.blob && one.natural[0] > 0), based.images);
    const underBase = asked.map((one) => one.path).sort();
    claim("under a base, the host fetched each picture where it said a record's files are, under /a/jobs, with the reader's session", underBase.length === 2 && underBase.every((path) => path.startsWith("/a/jobs/graview/files/")) && asked.every((one) => one.signed), asked);
    claim("under a base, nothing was asked of /graview/files/ at the host's root", !requests.some((one) => new URL(one.url).pathname.startsWith("/graview/files/")), requests.filter((one) => one.url.includes("/graview/files/")));
    claim("under a base, no view failed, and nothing was left out", based.failures.length === 0 && based.problems.length === 0, { failures: based.failures, problems: based.problems });

    /* THE SAME APP UNDER A BASE, THE HOST SAYING IT ONCE: filesAt under the base, as Cloud hands it, and no file on the view (0.1.36). */
    asked.length = 0;
    requests.length = 0;
    await tab.goto(`${HOST}/a/jobs/?files`, { waitUntil: "load" });
    await until(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot;
      const images = [...(root?.querySelectorAll("img") ?? [])];
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0);
    }, "the porch's two pictures, drawn under the base from the page's files");
    const once = asked.map((one) => one.path).sort();
    claim("under a base, a host that hands filesAt under it and no file on the view has the view's pictures fetched under /a/jobs", once.length === 2 && once.every((path) => path.startsWith("/a/jobs/graview/files/")) && !requests.some((one) => new URL(one.url).pathname.startsWith("/graview/files/")), { asked, requests: requests.filter((one) => one.url.includes("/graview/files/")) });
    asked.length = 0;
    requests.length = 0;
    await tab.goto(`${HOST}/a/jobs/?files&record=job:porch`, { waitUntil: "load" });
    await until(() => {
      const images = [...document.querySelectorAll("[data-graview-gallery] img")];
      return images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0);
    }, "the porch's own page, its three pictures loaded under the base");
    const record = await tab.evaluate(() => ({
      pictures: [...document.querySelectorAll("[data-graview-gallery] img")].map((image) => ({ src: image.getAttribute("src"), natural: image.naturalWidth })),
      papers: [...document.querySelectorAll("[data-graview-documents] a[download]")].map((link) => link.getAttribute("href")),
    }));
    claim(
      "under a base, the record's own page draws each of its pictures, and links its quote, at the host's address under /a/jobs, from filesAt alone",
      record.pictures.length === 3 && record.pictures.every((one) => one.src.startsWith("/a/jobs/graview/files/") && one.natural > 0) && record.papers.length > 0 && record.papers.every((href) => href.startsWith("/a/jobs/graview/files/")) && !requests.some((one) => new URL(one.url).pathname.startsWith("/graview/files/")),
      { record, requests: requests.filter((one) => one.url.includes("/graview/files/")).map((one) => one.url) },
    );
    claim("under a base, saying it once, no view failed, and nothing was left out", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));
    await context.close();
  } finally {
    server.close();
  }
}
