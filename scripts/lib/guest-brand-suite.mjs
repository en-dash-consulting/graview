/**
 * A WORKER VIEW DRAWS THE APP'S WHOLE BRAND, IN A REAL BROWSER (FR-127):
 * the brand transport of `scripts/guest-sandbox.mjs`.
 *
 * The embed is mounted over the offers fixture with a brand — a name, an
 * inline SVG logo, a display face and a radius — and a worker view, "The
 * masthead", that draws `<img src="${props.theme.logo}">` and the app's
 * name in `var(--graview-font-display)` with `var(--graview-radius)`
 * corners. Then the host re-dresses the app (`handle.setBrand`) with
 * another name, face, radius and logo: on the app's own page and inside
 * ChatGPT's widget a PNG at an address on the page's own origin, which the
 * host fetches; inside Claude's widget, whose frame is an opaque origin
 * with no address of its own, another inline SVG.
 *
 *   --policy=page      the app's own page, with no content security policy
 *   --policy=claude    inside Claude's widget frame (img-src allows blob:)
 *   --policy=chatgpt   inside ChatGPT's (img-src has no blob:)
 *
 * The claims: the view's name and heading face are the app's wordmark's
 * and headings'; its logo is the brand's, byte for byte, at its own
 * natural size; it is a `blob:` of the page where the policy allows blob:
 * images and a `data:` image where it does not; the view loaded nothing;
 * and after the brand changes all of it follows, in the same region, the
 * same worker and the same image element — pushed, not redrawn — with the
 * last logo's `blob:` URL let go.
 */
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";
import { localize, POLICIES, proxyPage } from "./widget-policies.mjs";

export const MASTHEAD_MANIFEST = { name: "masthead", title: "The masthead", attach: "package", cardinality: "many" };

/** The view, as a chat writes one: plain, against the graview global. */
export const MASTHEAD_JS = `
graview.style(\`
  .mast { display: flex; align-items: center; gap: 12px; padding: 12px; }
  .mast h2 { margin: 0; font-family: var(--graview-font-display); border-radius: var(--graview-radius); border: 1px solid var(--graview-edge); padding: 4px 8px; }
\`);
let pushes = 0;
graview.onProps((props) => {
  pushes += 1;
  const theme = props.theme || {};
  graview.render(graview.html\`<div class="mast" id="mast" data-pushes="\${pushes}">\${theme.logo ? graview.html\`<img id="logo" alt="" src="\${theme.logo}">\` : ""}<h2 id="name">\${theme.name || ""}</h2><span id="radius">\${theme.radius || ""}</span></div>\`);
});
`;

export const SVG_A = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><rect width="48" height="24" rx="4" fill="#0b6e4f"/><path d="M8 12h32" stroke="#fff" stroke-width="4"/></svg>`;
export const SVG_B = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="14" fill="#8a3b12"/></svg>`;

/** A real PNG, `width` × `height`, of one color: what Cloud keeps at /graview/assets/<sha256>.png. */
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
  const rows = Buffer.concat(Array.from({ length: height }, () => Buffer.from([0, ...Array.from({ length: width }, () => [r, g, b]).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
export const PNG = png(36, 18, [20, 90, 160]);
export const PNG_PATH = "/graview/assets/logo.png";

export async function brandSuite({ repoRoot, build, browser, claim, report, POLICY, HOST, GUEST, HOST_PORT, GUEST_PORT }) {
  const proxied = POLICY !== "page";
  const policy = proxied ? POLICIES[POLICY] : undefined;
  if (proxied && !policy) throw new Error(`--policy is page or one of ${Object.keys(POLICIES).join(", ")}, not ${POLICY}`);
  /* Claude's view frame is an opaque origin: no address of its own, so the second logo is inline there too. */
  const secondLogo = POLICY === "claude" ? { logo: SVG_B, bytes: Buffer.from(SVG_B), width: 30, height: 30 } : { logo: PNG_PATH, bytes: PNG, width: 36, height: 18 };
  const first = { name: "En Dash", logo: SVG_A, typography: { display: "Georgia, 'Times New Roman', serif" }, shape: { radius: 4 } };
  const second = { name: "En Dash Consulting", logo: secondLogo.logo, typography: { display: "'Courier New', Courier, monospace" }, shape: { radius: 16 } };
  const widgetJs = (
    await build({
      stdin: {
        contents: `
import { mount } from "@graview/embed";
import { SCHEMES } from "@graview/core";
import { registerWorkerView } from "@graview/guest/host/views";
import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
window.__failures = [];
const brands = { first: { ...${JSON.stringify(first)}, schemes: SCHEMES }, second: { ...${JSON.stringify(second)}, schemes: SCHEMES } };
const definition = { manifest: ${JSON.stringify(MASTHEAD_MANIFEST)}, worker: { source: ${JSON.stringify(MASTHEAD_JS)} }, onFailure: (reason, detail) => window.__failures.push([reason, detail]) };
window.__handle = mount(document.getElementById("app"), {
  app: offersApp,
  seed: offersSeed,
  principal: lin,
  face: "pages",
  path: "/places/the-masthead",
  scheme: "light",
  brand: brands.first,
  label: "Offers",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, definition),
});
window.__rebrand = () => window.__handle.setBrand(brands.second);
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
  const widgetHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Offers</title><style>body{margin:0}#app{position:relative;height:900px}</style></head><body><div id="app"></div><script>${widgetJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  const hostHtml = proxied ? `<!doctype html><html><head><meta charset="utf-8"><title>Chat</title></head><body><iframe id="proxy" title="Widget" style="width:1200px;height:1000px;border:0" src="${GUEST}/proxy/${POLICY}.html"></iframe></body></html>` : widgetHtml;
  const asked = [];
  const serveLogo = (req, res) => {
    asked.push(req.url);
    res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
    res.end(PNG);
  };
  const servers = [
    createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
        return res.end(hostHtml);
      }
      if (!proxied && req.url === PNG_PATH) return serveLogo(req, res);
      res.writeHead(404);
      res.end();
    }).listen(HOST_PORT, "127.0.0.1"),
    createServer((req, res) => {
      if (proxied && req.url === `/proxy/${POLICY}.html`) {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "content-security-policy": localize(policy.proxyCsp, HOST) });
        return res.end(proxyPage(policy, widgetHtml, HOST));
      }
      if (proxied && req.url === PNG_PATH) return serveLogo(req, res);
      res.writeHead(404);
      res.end();
    }).listen(GUEST_PORT, "localhost"),
  ];
  if (proxied) report.policy = { name: POLICY, csp: localize(policy.proxyMetaCsp ?? policy.proxyCsp, HOST), sandbox: policy.innerSandbox };

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, colorScheme: "light" });
    const requests = [];
    const logoRequests = [];
    context.on("request", (request) => {
      requests.push(request.url());
      if (request.url().endsWith(PNG_PATH)) logoRequests.push({ type: request.resourceType(), url: request.url() });
    });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    let app;
    for (let i = 0; i < 200 && !app; i += 1) {
      for (const frame of tab.frames()) if (await frame.evaluate(() => typeof window.__handle === "object").catch(() => false)) app = frame;
      if (!app) await tab.waitForTimeout(100);
    }
    if (!app) throw new Error("the embed never mounted");
    /* Polled from Node: an engine counts a string waitForFunction as eval, which a widget's policy may refuse. */
    const until = async (test, arg, what) => {
      for (let i = 0; i < 150; i += 1) {
        if (await app.evaluate(test, arg).catch(() => false)) return;
        await tab.waitForTimeout(100);
      }
      throw new Error(`${what} never came: ${JSON.stringify(await app.evaluate(() => ({ failures: window.__failures, text: document.body.innerText.slice(0, 300) })).catch(String))}`);
    };
    const drawnAs = (name) =>
      until(
        (said) => {
          const root = document.querySelector('[data-worker-view="masthead"]')?.shadowRoot;
          const image = root?.querySelector("#logo");
          return root?.querySelector("#name")?.textContent === said && Boolean(image?.complete && image.naturalWidth > 0);
        },
        name,
        `the masthead drawn as "${name}"`,
      );
    /* What the view drew, beside what the app drew: the page's heading, and the wordmark on its bar. */
    const read = () =>
      app.evaluate(async () => {
        const region = document.querySelector('[data-worker-view="masthead"]');
        const root = region.shadowRoot;
        const image = root.querySelector("#logo");
        const heading = root.querySelector("#name");
        const src = image.getAttribute("src");
        let bytes = null;
        if (src.startsWith("data:")) {
          const [head, body] = src.split(",", 2);
          const text = head.endsWith(";base64") ? atob(body) : decodeURIComponent(body);
          bytes = [...text].map((c) => c.charCodeAt(0));
        } else {
          bytes = await fetch(src).then(async (response) => [...new Uint8Array(await response.arrayBuffer())]).catch((error) => `unread: ${error}`);
        }
        const pageHeading = document.querySelector("[data-graview-face=pages] [data-graview-page-title]");
        const wordmark = [...document.querySelectorAll("[data-graview-embed] a, [data-graview-embed] span")].find((one) => !region.contains(one) && one.textContent.trim() === heading.textContent && one.children.length <= 1);
        return {
          name: heading.textContent,
          scheme: src.slice(0, src.indexOf(":")),
          src,
          natural: [image.naturalWidth, image.naturalHeight],
          bytes,
          viewFont: getComputedStyle(heading).fontFamily,
          viewRadius: getComputedStyle(heading).borderTopLeftRadius,
          radiusSaid: root.querySelector("#radius").textContent,
          pushes: Number(root.querySelector("#mast").getAttribute("data-pushes")),
          appHeadingFont: pageHeading ? getComputedStyle(pageHeading).fontFamily : null,
          wordmark: wordmark ? { text: wordmark.textContent.trim(), font: getComputedStyle(wordmark).fontFamily } : null,
          marked: region.__marked === true && image.__marked === true,
        };
      });
    const brief = ({ bytes, src, ...seen }) => ({ ...seen, src: src.slice(0, 60), bytes: Array.isArray(bytes) ? bytes.length : bytes });
    const sameBytes = (seen, expected) => Array.isArray(seen) && seen.length === expected.length && seen.every((byte, i) => byte === expected[i]);
    const blobAllowed = POLICY !== "chatgpt";

    await drawnAs(first.name);
    const before = await read();
    claim(`the view's name is the app's wordmark, "${first.name}", and its heading is drawn in the app's display face, as the app's own headings and wordmark are`, before.name === first.name && before.wordmark?.text === first.name && before.viewFont === before.wordmark.font && (before.appHeadingFont === null || before.viewFont === before.appHeadingFont) && /Georgia/.test(before.viewFont), brief(before));
    claim("its corners are the app's radius, by var(--graview-radius) and props.theme.radius alike", before.viewRadius === "4px" && before.radiusSaid === "4px", { viewRadius: before.viewRadius, said: before.radiusSaid });
    claim("its logo is the brand's inline SVG, byte for byte, at the SVG's own size", sameBytes(before.bytes, [...Buffer.from(SVG_A)]) && before.natural.join("x") === "48x24", { natural: before.natural, scheme: before.scheme, bytes: Array.isArray(before.bytes) ? before.bytes.length : before.bytes });
    claim(blobAllowed ? "the logo is handed as a blob: URL of the page itself, which the policy lets an image load from" : "the logo is handed as a data: image, since the policy's img-src has no blob:", blobAllowed ? before.scheme === "blob" : before.scheme === "data", { src: before.src.slice(0, 60) });

    await app.evaluate(() => {
      const region = document.querySelector('[data-worker-view="masthead"]');
      region.__marked = true;
      region.shadowRoot.querySelector("#logo").__marked = true;
    });
    await app.evaluate(() => window.__rebrand());
    await drawnAs(second.name);
    await tab.waitForTimeout(300);
    const after = await read();
    const revoked = blobAllowed && before.scheme === "blob" ? await app.evaluate((url) => fetch(url).then(() => false, () => true), before.src) : null;
    claim(`after the brand changes, the view says "${second.name}" in the new display face, as the app's wordmark and headings do`, after.name === second.name && after.wordmark?.text === second.name && after.viewFont === after.wordmark.font && (after.appHeadingFont === null || after.viewFont === after.appHeadingFont) && /Courier/.test(after.viewFont), brief(after));
    claim("and takes the new radius", after.viewRadius === "16px" && after.radiusSaid === "16px", { viewRadius: after.viewRadius, said: after.radiusSaid });
    claim(`and draws the new logo, byte for byte, at its own size (${secondLogo.width}×${secondLogo.height})`, sameBytes(after.bytes, [...secondLogo.bytes]) && after.natural.join("x") === `${secondLogo.width}x${secondLogo.height}`, { natural: after.natural, scheme: after.scheme, bytes: Array.isArray(after.bytes) ? after.bytes.length : after.bytes });
    claim("it followed the brand by being pushed it, not redrawn: the same region and the same image element, one push more", after.marked && after.pushes > before.pushes, { marked: after.marked, pushes: [before.pushes, after.pushes] });
    if (revoked !== null) claim("the last logo's blob: URL is let go once the new one is drawn", revoked === true, { url: before.src });
    if (secondLogo.logo === PNG_PATH) {
      /*
       * Since FR-124/FR-125 the app draws its own mark — the strip's and the
       * routed face's title, `AppTitle` — and a mark that is a path is an
       * `<img>` at that path, so the page itself asks for the PNG as an
       * image (each engine folds the page's images of one address into one
       * request). That is the app showing its logo, not the view loading
       * one, and the asset is served `no-store` here, so no cache joins it
       * to the host's fetch. What holds: the host fetched the bytes once (one
       * `fetch`), every other request is an image the app's own marks
       * account for, and nothing in the view names the address.
       */
      const fetched = logoRequests.filter((one) => one.type === "fetch");
      const imaged = logoRequests.filter((one) => one.type === "image");
      const marks = await app.evaluate((path) => {
        const region = document.querySelector('[data-worker-view="masthead"]');
        const drawn = [...document.querySelectorAll("img")].filter((image) => image.getAttribute("src") === path);
        const inView = [...region.shadowRoot.querySelectorAll("*")].filter((one) => [...one.attributes].some((attribute) => attribute.value.includes(path))).length;
        return { appMarks: drawn.filter((image) => image.getAttribute("data-testid") === "app-mark" && !region.contains(image)).length, otherImages: drawn.length - drawn.filter((image) => image.getAttribute("data-testid") === "app-mark" && !region.contains(image)).length, inView };
      }, PNG_PATH);
      claim(
        "the PNG at the page's own address was fetched once, by the host: the view loaded nothing",
        fetched.length === 1 && imaged.length + fetched.length === logoRequests.length && (imaged.length === 0 || marks.appMarks > 0) && marks.otherImages === 0 && marks.inView === 0 && asked.length === logoRequests.length,
        { served: asked, requests: logoRequests, ...marks },
      );
    }
    const elsewhere = requests.filter((url) => /^https?:/.test(url) && !url.startsWith(`${HOST}/`) && !url.startsWith(`${GUEST}/proxy/`) && !url.endsWith(PNG_PATH) && !url.endsWith("/favicon.ico"));
    claim("nothing else was requested", elsewhere.length === 0, elsewhere);
    claim("no view failed", (await app.evaluate(() => window.__failures)).length === 0, await app.evaluate(() => window.__failures));
    /* WebKit reports the harness's own fetch of the revoked URL, above, as a page error: that one is the claim, not the page. */
    const id = before.src.slice(before.src.lastIndexOf("/") + 1);
    report.pageErrors = report.pageErrors.filter((error) => !(revoked && error.includes(id)));
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    for (const server of servers) server.close();
  }
}

