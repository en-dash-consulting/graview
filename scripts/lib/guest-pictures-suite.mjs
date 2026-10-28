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
 *
 * Then a full-size photograph (FR-192, Maryland Family Weekend's journey
 * view): a real JPEG of 1 200 × 900 the browser itself encoded, with an
 * EXIF APP1 segment after its JFIF one, heavier than the 512 000
 * characters a view's own data: image may be, on a page whose policy
 * refuses blob: images, as Graview Cloud's does. The view is handed a
 * short blob: address and the page draws the data: image behind it.
 *
 * Then sixty-four jobs, each with a small photograph answered a little
 * after the one before (FR-207, Graview Cloud's "the-faces"): the view
 * draws every one and is not stopped as a flood.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

export const PHOTOS_MANIFEST = { name: "job-photos", title: "Job photos", attach: "job", cardinality: "many", pictures: { width: 400 } };
/* The same view at the width a pictures: true view draws one (1 200), for a full-size photograph (FR-192). */
export const JOURNEY_MANIFEST = { ...PHOTOS_MANIFEST, pictures: true };
/* Where the full-size photograph is kept on the porch, in place of its own (FR-192). */
const MOMENT = "/graview/files/harbor-6d1f.jpg";
/* How many jobs, each with a small photograph, the "?many" page draws (FR-207): more than half the 120 messages a view may send in a second. */
const MANY = 64;
/*
 * Each face's photograph is answered this many ms after the one before,
 * counted from when the first was asked for — not from when each is asked,
 * which a browser's six connections to a host would spread over seconds —
 * so the sixty-four settle one by one in about half a second.
 */
const FACE_STAGGER_MS = 8;

/*
 * A RECORD'S VIDEO IN A VIEW (0.1.37): "Job reel" places the porch's clip
 * for the host to play, and a button that opens the step's photograph in
 * the host's full-screen viewer. It draws no <video> and holds no path.
 * And a hero (Roadmap f-video-hero): the same clip placed again at the
 * foot as `<graview-video autoplay cover>`, a background the host plays
 * muted and looping in the box the view sized.
 */
export const REEL_MANIFEST = { name: "job-reel", title: "Job reel", attach: "job", cardinality: "many", pictures: true };
export const REEL_JS = `
graview.style(\`.reel { display: grid; gap: 8px; padding: 12px; } graview-video { width: 320px; } .hero { width: 100%; height: 120px; border-radius: 12px; overflow: hidden; }\`);
graview.onProps((props) => {
  const porch = props.nodes.find((job) => job.clip);
  graview.render(graview.html\`\${props.nodes.map((job) => graview.html\`<section class="reel" data-key="\${job.id}"><h3>\${job.label}</h3>\${job.clip ? graview.html\`<p data-said>\${job.clip.name} \${job.clip.duration}</p><graview-video data-record="\${job.id}" data-field="clip"></graview-video>\` : ""}<button data-lightbox data-record="\${job.id}" data-field="photos" data-index="1">See the step</button></section>\`)}\${porch ? graview.html\`<graview-video class="hero" autoplay cover data-record="\${porch.id}" data-field="clip"></graview-video>\` : ""}\`);
});
`;

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

/**
 * A PHONE'S PHOTOGRAPH, AS IT IS KEPT: the browser's own JPEG of `width` ×
 * `height` of noise (so it stays heavy), with an EXIF APP1 segment put
 * after its JFIF APP0, as a camera writes one.
 */
async function exifJpeg(browser, width, height) {
  const context = await browser.newContext();
  try {
    const tab = await context.newPage();
    const base64 = await tab.evaluate(
      ([w, h]) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext("2d");
        const pixels = context.createImageData(w, h);
        let seed = 7;
        for (let i = 0; i < pixels.data.length; i += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          pixels.data[i] = seed & 0xff;
          pixels.data[i + 1] = (seed >> 8) & 0xff;
          pixels.data[i + 2] = (seed >> 16) & 0xff;
          pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      },
      [width, height],
    );
    const jpeg = Buffer.from(base64, "base64");
    /* SOI, then APP0 (JFIF) if the encoder wrote one; the APP1 goes after it. */
    const after = jpeg[2] === 0xff && jpeg[3] === 0xe0 ? 4 + jpeg.readUInt16BE(4) : 2;
    const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
    const app0 = after === 2 ? Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x00, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00]) : jpeg.subarray(2, after);
    return Buffer.concat([jpeg.subarray(0, 2), app0, app1, jpeg.subarray(after)]);
  } finally {
    await context.close();
  }
}

export async function picturesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  const moment = await exifJpeg(browser, 1_200, 900);
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
    /* The porch's clip (0.1.37): a second of one color, as WebM, and its poster. */
    "/graview/files/clip-5d0a.webm": { type: "video/webm", body: readFileSync(resolve(repoRoot, "scripts/fixtures/files/clip.webm")) },
    "/graview/files/clip-5d0a.png": { type: "image/png", body: png(32, 32, [58, 123, 213]) },
    [MOMENT]: { type: "image/jpeg", body: moment },
    /* The faces (FR-207), each a little later than the one before. */
    ...Object.fromEntries(Array.from({ length: MANY }, (_, i) => [`/graview/files/face-${i}.png`, { type: "image/png", body: png(40, 40, [(i * 37) % 256, 120, 200]), at: i * FACE_STAGGER_MS }])),
  };
  const js = (
    await build({
      stdin: {
        contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { recordPath } from "@graview/pages";
import { filesAt } from "@graview/ship/browser";
import { ana, FILES, jobsApp, jobsSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/jobs-app.ts"))};
window.__failures = [];
window.__problems = [];
/* Served under a base (Graview Cloud's /a/<app>/), the host says where a record's files are: on the view ("file"), or once for the page ("?files", filesAt under the base, as Cloud hands it). */
const base = location.pathname.startsWith("/a/jobs/") ? "/a/jobs" : "";
const asked = new URLSearchParams(location.search);
const once = asked.has("files");
/* "?reel": the porch holds a clip, and the reel view is drawn in place of the photos (0.1.37). */
const reel = asked.has("reel");
/* "?moment": the porch holds one full-size EXIF JPEG, drawn by a pictures: true view on a page that refuses blob: images (FR-192). */
const full = asked.has("moment");
/* "?many": sixty-four jobs Ana is on, each with a small photograph, drawn by a pictures: true view (FR-207, Graview Cloud's "the-faces"). */
const many = asked.has("many");
const faces = Array.from({ length: ${MANY} }, (_, i) => ({ id: "job:face-" + i, kind: "job", label: "Face " + i, photos: [{ href: "/graview/files/face-" + i + ".png", name: "face-" + i + ".png", type: "image/png", bytes: 120, width: 40, height: 40 }] }));
const moment = { href: ${JSON.stringify(MOMENT)}, name: "IMG_4032.jpg", type: "image/jpeg", bytes: ${moment.length}, width: 1200, height: 900, caption: "The harbor at dusk" };
const definition = { manifest: reel ? ${JSON.stringify(REEL_MANIFEST)} : full || many ? ${JSON.stringify(JOURNEY_MANIFEST)} : ${JSON.stringify(PHOTOS_MANIFEST)}, worker: { source: reel ? ${JSON.stringify(REEL_JS)} : ${JSON.stringify(PHOTOS_JS)} }, ...(base && !once ? { file: (href) => base + href } : {}), onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) };
const clip = { href: FILES.clip, name: "porch.webm", type: "video/webm", bytes: 624, width: 32, height: 32, duration: 1, poster: FILES.clipPoster, caption: "The porch, panned" };
window.__handle = mount(document.getElementById("app"), {
  app: jobsApp,
  seed: reel ? { ...jobsSeed, nodes: jobsSeed.nodes.map((node) => (node.id === "job:porch" ? { ...node, clip } : node)) } : full ? { ...jobsSeed, nodes: jobsSeed.nodes.map((node) => (node.id === "job:porch" ? { ...node, photos: [moment], papers: [] } : node)) } : many ? { ...jobsSeed, nodes: [...jobsSeed.nodes.filter((node) => node.kind !== "job"), ...faces], edges: faces.map((face) => ({ kind: "on", from: face.id, to: "crew:ana" })) } : jobsSeed,
  principal: ana,
  face: "pages",
  path: asked.has("record") ? recordPath(jobsApp.schema, "job", asked.get("record")) : reel ? "/places/job-reel" : "/places/job-photos",
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
  /* When the first face's photograph was asked for: each is answered `at` ms after it (FR-207). */
  let facesAsked;
  const server = createServer((req, res) => {
    const page = req.url.split("?")[0];
    if (page === "/" || page === "/a/jobs/") {
      /* "?moment": a page whose policy draws data: images and its own, never blob: ones, as Graview Cloud's (FR-192). */
      const policy = req.url.includes("moment") ? { "content-security-policy": "img-src 'self' data:" } : {};
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "set-cookie": `${SESSION}; Path=/; SameSite=Lax; HttpOnly`, ...policy });
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
      /* A video a range at a time, as a player asks for it (WebKit plays nothing without). */
      const range = file.type.startsWith("video/") ? /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "") : null;
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), file.body.length - 1) : file.body.length - 1;
        res.writeHead(206, { "content-type": file.type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${file.body.length}`, "content-length": String(end - start + 1), "cache-control": "no-store" });
        return res.end(file.body.subarray(start, end + 1));
      }
      const answer = () => {
        res.writeHead(200, { "content-type": file.type, "cache-control": "no-store", ...(file.type.startsWith("video/") ? { "accept-ranges": "bytes" } : {}) });
        res.end(file.body);
      };
      if (file.at === undefined) return answer();
      facesAsked ??= Date.now();
      return void setTimeout(answer, Math.max(0, facesAsked + file.at - Date.now()));
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

    /* A RECORD'S VIDEO IN A VIEW, AND THE HOST'S FULL-SCREEN VIEWER (0.1.37). */
    asked.length = 0;
    requests.length = 0;
    await tab.goto(`${HOST}/?reel`, { waitUntil: "load" });
    await until(() => {
      const root = document.querySelector('[data-worker-view="job-reel"]')?.shadowRoot;
      const video = root?.querySelector("graview-video")?.shadowRoot?.querySelector("video");
      return Boolean(video && video.readyState >= 1);
    }, "the porch's clip, played by the host in the reel view");
    const player = await tab.evaluate(() => {
      const root = document.querySelector('[data-worker-view="job-reel"]').shadowRoot;
      const box = root.querySelector("graview-video");
      const video = box.shadowRoot.querySelector("video");
      const named = [...root.querySelectorAll("*")].filter((one) => [...one.attributes].some((attribute) => attribute.value.includes("/graview/files/")) || one.textContent.includes("/graview/files/")).length;
      return {
        src: video.getAttribute("src"),
        poster: video.getAttribute("poster"),
        controls: video.controls,
        preload: video.getAttribute("preload"),
        label: video.getAttribute("aria-label"),
        duration: Math.round(video.duration),
        wide: Math.round(box.getBoundingClientRect().width),
        said: root.querySelector("[data-said]")?.textContent ?? null,
        videos: root.querySelectorAll("video").length,
        named,
      };
    });
    claim(
      "a view places the porch's clip and the host plays it there: its poster first, native controls, only its metadata fetched, said by what it shows and how long",
      player.src === "/graview/files/clip-5d0a.webm" && player.poster === "/graview/files/clip-5d0a.png" && player.controls && player.preload === "metadata" && player.label === "The porch, panned, a 1-second video" && player.duration === 1 && player.wide === 320,
      player,
    );
    claim("the view is handed the clip's facts, never its path, and its own drawing holds no <video>", player.said === "porch.webm 1" && player.named === 0 && player.videos === 0, { said: player.said, named: player.named, videos: player.videos });
    claim("the host fetched the clip with the reader's session", asked.some((one) => one.path === "/graview/files/clip-5d0a.webm") && asked.every((one) => one.signed), asked);

    /* A VIDEO THAT PLAYS AS A HERO BACKGROUND (Roadmap f-video-hero): the same clip, placed with `autoplay cover`. */
    await until(() => {
      const video = document.querySelector('[data-worker-view="job-reel"]')?.shadowRoot?.querySelector("graview-video[autoplay]")?.shadowRoot?.querySelector("video");
      return Boolean(video && video.readyState >= 1);
    }, "the hero's clip, drawn by the host");
    const readHero = () => tab.evaluate(() => {
      const box = document.querySelector('[data-worker-view="job-reel"]').shadowRoot.querySelector("graview-video[autoplay]");
      const video = box.shadowRoot.querySelector("video");
      const rect = box.getBoundingClientRect();
      return {
        autoplay: video.hasAttribute("autoplay"),
        muted: video.muted,
        loop: video.loop,
        inline: video.hasAttribute("playsinline"),
        controls: video.controls,
        preload: video.getAttribute("preload"),
        poster: video.getAttribute("poster"),
        fit: getComputedStyle(video).objectFit,
        box: [Math.round(rect.width), Math.round(rect.height)],
        video: [Math.round(video.getBoundingClientRect().width), Math.round(video.getBoundingClientRect().height)],
        still: video.hasAttribute("data-graview-video-still"),
        paused: video.paused,
        time: video.currentTime,
        said: box.shadowRoot.querySelector("figcaption")?.textContent ?? null,
      };
    });
    const hero = await readHero();
    claim(
      "a <graview-video autoplay cover> is a background the host plays: muted, looping, inline, with no controls, its poster, and filling the box the view sized",
      hero.autoplay && hero.muted && hero.loop && hero.inline && !hero.controls && hero.preload === "auto" && hero.poster === "/graview/files/clip-5d0a.png" && hero.fit === "cover" && hero.box[1] === 120 && hero.video[0] === hero.box[0] && hero.video[1] === 120 && !hero.still && hero.said === null,
      hero,
    );
    /* Played by the browser alone: no press, no call from the view. Given a few seconds, since an engine starts a background when it is ready to. */
    const played = await tab.evaluate(
      () =>
        new Promise((resolve) => {
          const video = document.querySelector('[data-worker-view="job-reel"]').shadowRoot.querySelector("graview-video[autoplay]").shadowRoot.querySelector("video");
          const started = Date.now();
          const look = () => {
            if (!video.paused || video.currentTime > 0) return resolve({ playing: true, paused: video.paused, time: video.currentTime, after: Date.now() - started });
            if (Date.now() - started > 6_000) return resolve({ playing: false, paused: video.paused, time: video.currentTime, after: Date.now() - started, error: video.error?.code ?? null, ready: video.readyState });
            setTimeout(look, 100);
          };
          look();
        }),
    );
    claim("the hero background plays on its own, pressed by nobody", played.playing, played);
    const opener = tab.locator('[data-worker-view="job-reel"] button[data-lightbox]').first();
    await opener.click();
    await until(() => {
      const image = document.querySelector("dialog[data-graview-lightbox] img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "the step's photograph, full screen in the host's viewer");
    const viewer = await tab.evaluate(() => {
      const dialog = document.querySelector("dialog[data-graview-lightbox]");
      return { open: dialog.open, modal: dialog.matches(":modal"), inBody: dialog.parentElement === document.body, src: dialog.querySelector("img").getAttribute("src"), alt: dialog.querySelector("img").getAttribute("alt"), focus: document.activeElement?.textContent ?? null, opener: document.querySelector('[data-worker-view="job-reel"]').shadowRoot.querySelector("button[data-lightbox]").getAttribute("aria-haspopup") };
    });
    claim("a press on the view's data-lightbox opens the host's full-screen viewer over the app, the keyboard on its Close", viewer.open && viewer.modal && viewer.inBody && viewer.src === "/graview/files/step-77c1.png" && viewer.alt === "The cracked step" && viewer.focus === "Close" && viewer.opener === "dialog", viewer);
    await tab.keyboard.press("Escape");
    await until(() => !document.querySelector("dialog[data-graview-lightbox]"), "the viewer, closed by Escape");
    const back = await tab.evaluate(() => document.querySelector('[data-worker-view="job-reel"]').shadowRoot.activeElement?.getAttribute("data-lightbox") !== undefined && document.querySelector('[data-worker-view="job-reel"]').shadowRoot.activeElement?.localName === "button");
    claim("Escape closes the viewer and gives the keyboard back to the view's button", back, { back });
    claim("the reel view did not fail, and nothing was left out", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));

    /* LESS MOTION, WHERE A PERSON ASKS FOR IT: the hero stands still at its poster, fetching only its metadata, and the ordinary player is as it was. */
    await tab.emulateMedia({ reducedMotion: "reduce" });
    await tab.goto(`${HOST}/?reel`, { waitUntil: "load" });
    await until(() => Boolean(document.querySelector('[data-worker-view="job-reel"]')?.shadowRoot?.querySelector("graview-video[autoplay]")?.shadowRoot?.querySelector("video")), "the hero, drawn where the person asked for less motion");
    await tab.waitForTimeout(500);
    const stillHero = await readHero();
    claim(
      "where the person asked for less motion, the hero stands still at its poster, fetching only its metadata, muted and looping still, with no controls",
      !stillHero.autoplay && stillHero.still && stillHero.paused && stillHero.time === 0 && stillHero.preload === "metadata" && stillHero.poster === "/graview/files/clip-5d0a.png" && stillHero.muted && stillHero.loop && !stillHero.controls && stillHero.fit === "cover",
      stillHero,
    );
    /* Leave the page before the preference goes back: a hero let go on this page would fetch its clip into the next section's ledger. */
    await tab.goto("about:blank");
    await tab.emulateMedia({ reducedMotion: "no-preference" });

    /* A FULL-SIZE EXIF JPEG IN A pictures: true VIEW, ON A PAGE THAT REFUSES blob: IMAGES (FR-192). */
    asked.length = 0;
    requests.length = 0;
    const head = { app1: moment[20] === 0xff && moment[21] === 0xe1 && moment.subarray(24, 28).toString("latin1") === "Exif", bytes: moment.length, base64: Math.ceil(moment.length / 3) * 4 + "data:image/jpeg;base64,".length };
    claim("the full-size photograph is a real JPEG with JFIF and an EXIF APP1, heavier as a data: image than the 512,000 characters a view's own may be", head.app1 && head.base64 > 512_000, head);
    await tab.goto(`${HOST}/?moment`, { waitUntil: "load" });
    await until(() => {
      const image = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot?.querySelector("img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "the full-size photograph, drawn by the view");
    await tab.waitForTimeout(300);
    const full = await tab.evaluate(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]').shadowRoot;
      const image = root.querySelector("img");
      const src = image.getAttribute("src");
      return { natural: [image.naturalWidth, image.naturalHeight], scheme: src.slice(0, src.indexOf(":")), length: src.length, alt: image.getAttribute("alt"), failures: window.__failures, problems: window.__problems };
    });
    claim("on a page that refuses blob: images, a pictures: true view draws the full-size EXIF JPEG on a record, at its own 1200×900, the data: image the host made", full.natural.join("x") === "1200x900" && full.scheme === "data" && full.length > 512_000 && full.alt === "The harbor at dusk", full);
    claim("the host fetched the photograph once, with the reader's session", asked.length === 1 && asked[0].path === MOMENT && asked[0].signed, [...asked]);
    claim("the full-size photograph's view did not fail, nothing was refused and nothing was left out", full.failures.length === 0 && full.problems.length === 0, { failures: full.failures, problems: full.problems });

    /*
     * SIXTY-FOUR PICTURES SETTLING WITHIN A SECOND (FR-207). Graview Cloud's
     * "the-faces" fell back as a flood: pushed again for every picture that
     * settled, the view answered more than the 120 messages it may send in a
     * second. Each face's photograph is answered 8 ms after the one before.
     */
    asked.length = 0;
    await tab.goto(`${HOST}/?many`, { waitUntil: "load" });
    await until(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot;
      const images = [...(root?.querySelectorAll("img") ?? [])];
      return window.__failures.length > 0 || (images.length === 64 && images.every((image) => image.complete && image.naturalWidth > 0));
    }, "the sixty-four faces, drawn, or the view failed");
    await tab.waitForTimeout(1_200);
    const crowd = await tab.evaluate(() => {
      const root = document.querySelector('[data-worker-view="job-photos"]')?.shadowRoot;
      const images = [...(root?.querySelectorAll("img") ?? [])];
      return { drawn: images.filter((image) => image.complete && image.naturalWidth > 0 && image.getAttribute("src")?.startsWith("blob:")).length, failures: window.__failures, problems: window.__problems, fellBack: document.querySelector('[data-worker-view-failed]')?.getAttribute("data-worker-view-failed") ?? null };
    });
    claim("a pictures: true view of sixty-four records, their pictures settling one by one within a second, is not stopped as a flood and draws every picture", crowd.drawn === MANY && crowd.failures.length === 0 && crowd.fellBack === null, crowd);
    claim("the host fetched each of the sixty-four pictures once, with the reader's session", asked.length === MANY && new Set(asked.map((one) => one.path)).size === MANY && asked.every((one) => one.signed), { asked: asked.length, distinct: new Set(asked.map((one) => one.path)).size });
    await context.close();
  } finally {
    server.close();
  }
}
