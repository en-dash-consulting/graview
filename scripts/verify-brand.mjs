#!/usr/bin/env node
/**
 * THE WHOLE BRAND, FROM THE DOCUMENT, ON BOTH FACES (FR-124, FR-125).
 *
 * Nick's test, from a fresh chat on a new Graview Cloud app: "brand this
 * as En Dash using the logo at <url>, serif headings, and add a custom
 * front page". The document that chat ends with is
 * `packages/core/tests/document/fixtures/en-dash.gdd.json` — a logo written
 * inline, a page icon kept at `/graview/assets/<sha256>.svg`, serif
 * headings, a shape, a hue per kind, a preference for dark, a description
 * and a front page of its own — mounted the way Cloud mounts an app: the
 * embed over the document compiled in the page, on a host's page that has
 * an icon of its own. In each engine, on the Graview face and the Pages
 * face, with the host's page stamped light and stamped dark:
 *
 *   the logo is drawn byte for byte as the document gives it, wherever
 *   the app's name is;
 *   the app's name and the home's headings are set in the display face,
 *   which resolves to the `system-serif` stack;
 *   the description is drawn under the name;
 *   the brand's shape reaches the page (`--graview-radius` is 6px);
 *   the scheme the page is stamped with is the one drawn.
 *
 * And once per engine: with the page unstamped and the system light, the
 * app's preference for dark is the scheme drawn; mounted with `favicon:
 * true` (the host's page IS the app) the page wears the brand's icon, and
 * mounted without it the host's own icon is left alone.
 *
 * And with the document's logo given one for each scheme, in each scheme on
 * each face: the scheme's own is the one drawn; and with a light one alone
 * the brand asked to invert (a picture on white), it is inverted and
 * screened in the dark and left as given in the light.
 *
 * And with the document's brand given a ground of its own, a light one
 * alone (Roadmap f-brand-ground), in each scheme on each face: the page
 * stands on it — the light one as given, and in the dark the darker shade
 * of its hue the brand derives, never Graview's paper or navy; the scene
 * on the deeper shade drawn from each — and a card is drawn apart from it.
 *
 *   node scripts/verify-brand.mjs [--engine=chromium|webkit|firefox] [--quick]
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCHEMES = ["light", "dark"];
const FACES = ["graview", "pages"];
const DOCUMENT = resolve(repoRoot, "packages/core/tests/document/fixtures/en-dash.gdd.json");
const document_ = JSON.parse(readFileSync(DOCUMENT, "utf8"));
const LOGO = document_.brand.logo.src;
const ICON = document_.brand.favicon;
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#0f6e5c"/></svg>';
const DESK = { width: 1280, height: 800 };
/** A logo for each scheme, told apart by their fill; and a picture on white kept at a path, for the inverted fallback. */
const PAIR = {
  light: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><rect width="24" height="24" fill="#123456"/></svg>',
  dark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><rect width="24" height="24" fill="#fedcba"/></svg>',
};
const ON_WHITE = "/graview/assets/on-white.svg";
/** A page background of the app's own: a light one alone, so the dark scheme's is derived. */
const GROUND = "#eef3f8";
const ON_WHITE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" width="48" height="24"><rect width="48" height="24" fill="#fff"/><circle cx="24" cy="12" r="8" fill="#0b2545"/></svg>';
/** The `system-serif` stack, as a browser says a computed font-family: compared without quotes or spaces. */
const { SYSTEM_STACKS, groundSchemes, colorsIn } = await import(resolve(repoRoot, "packages/core/dist/index.js"));
/** A color as a browser says a computed one: `rgb(r, g, b)`. */
const rgbOf = (hex) => {
  const { r, g, b } = colorsIn(hex)[0];
  return `rgb(${r}, ${g}, ${b})`;
};
/** What each face stands on, from the brand's ground: the routed face on the ground, the scene on its deeper shade. */
const drawnFrom = groundSchemes(GROUND);
const GROUNDS = Object.fromEntries(["light", "dark"].map((scheme) => [scheme, { pages: rgbOf(drawnFrom[scheme].ground), graview: rgbOf(drawnFrom[scheme].groundDeep) }]));
const flat = (family) => family.replace(/["'\s]/g, "").toLowerCase();
const SERIF = flat(SYSTEM_STACKS["system-serif"]);

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>A host's page</title>
<link rel="icon" href="/host-icon.svg">
<style>body{margin:0;font:16px/1.4 Helvetica,sans-serif;background:#fff;color:#222}#app{position:relative;height:100vh}</style></head>
<body><main><div id="app"></div></main><script type="module" src="/entry.js"></script></body></html>`;

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-brand-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import enDash from ${JSON.stringify(DOCUMENT)};
        const asked = new URLSearchParams(location.search);
        const theme = asked.get("theme");
        if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
        // A logo for each scheme, or a light one the brand asked to invert in the dark (TrueNorth's picture on white).
        const logos = ${JSON.stringify({ pair: { light: PAIR.light, dark: PAIR.dark }, invert: { light: ON_WHITE, darkFallback: "invert" } })};
        const logo = logos[asked.get("logo")];
        // A page background of the app's own (Roadmap f-brand-ground).
        const ground = asked.get("ground");
        const brand = { ...enDash.brand, ...(logo ? { logo } : {}), ...(ground ? { ground } : {}) };
        const compiled = compileDocumentWithoutCheck({ ...enDash, brand }, { today: () => "2026-10-07" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: { nodes: [
            { id: "w1", kind: "workshop", title: "Farm Bureau POM workshop", status: "held", held: "2026-09-30" },
            { id: "w2", kind: "workshop", title: "Mapping the work", status: "planned" },
            { id: "p1", kind: "person", name: "Ada" },
          ], edges: [{ id: "e1", kind: "attendedBy", from: "w1", to: "p1" }] },
          face: asked.get("face") ?? "graview",
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
          bar: true,
          ...(asked.get("favicon") === "1" ? { favicon: true } : {}),
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
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const icons = { "/host-icon.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#999"/></svg>', [ICON]: ICON_SVG, [ON_WHITE]: ON_WHITE_SVG };
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    if (icons[path]) {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      response.end(icons[path]);
      return;
    }
    const file = join(out, path.replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(out) || !existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html" });
    response.end(readFileSync(file));
  });
  await vacant(portFor("brand-host"));
  await new Promise((ready) => host.listen(portFor("brand-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** What the page draws of the brand, read in the page. */
function read() {
  const root = document.querySelector('[class^="graview-embed-"], [class*=" graview-embed-"]');
  const marks = [...document.querySelectorAll('[data-testid="app-mark"]')];
  const names = [...document.querySelectorAll('[data-testid="app-name"]')].filter((one) => one.getBoundingClientRect().width > 0);
  const headings = [...document.querySelectorAll("h1, h2")].filter((one) => one.getBoundingClientRect().width > 0 && one.textContent.trim() !== "");
  return {
    marks: marks.map((one) => one.innerHTML),
    nameFaces: names.map((one) => getComputedStyle(one).fontFamily),
    headingFaces: headings.map((one) => ({ text: one.textContent.trim().slice(0, 40), face: getComputedStyle(one).fontFamily })),
    subtitles: [...document.querySelectorAll('[data-testid="app-subtitle"]')].filter((one) => one.getBoundingClientRect().width > 0).map((one) => one.textContent.trim()),
    // The bar says the app's name alone (FR-131); the line under it is the name's hover.
    nameTitles: [...document.querySelectorAll('[data-testid="app-home"]')].map((one) => one.getAttribute("title") ?? ""),
    radius: root ? getComputedStyle(root).getPropertyValue("--graview-radius").trim() : null,
    drawn: root ? getComputedStyle(root).colorScheme : null,
    icons: [...document.querySelectorAll('link[rel~="icon"]')].map((one) => one.getAttribute("href")),
    // Each mark's faces for a scheme, and which of them is drawn; and a light logo marked to invert, as it is styled.
    faces: marks.map((one) => [...one.querySelectorAll("[data-graview-scheme-only]")].map((face) => ({ scheme: face.getAttribute("data-graview-scheme-only"), drawn: getComputedStyle(face).display !== "none" && face.getBoundingClientRect().width > 0, fill: face.querySelector("rect")?.getAttribute("fill") ?? null }))),
    fallbacks: marks.filter((one) => one.hasAttribute("data-graview-logo-fallback")).map((one) => ({ filter: getComputedStyle(one).filter, blend: getComputedStyle(one).mixBlendMode })),
    // What the face stands on, as drawn: the routed face's content, or the scene's ground; and a card's fill beside it.
    ground: (() => {
      let surface = [...document.querySelectorAll("[data-embed-content], .graview-ground")].find((one) => one.getBoundingClientRect().width > 0);
      // What paints it: the nearest that is not see-through, itself or a parent.
      while (surface && /^rgba\(.*, 0\)$|^transparent$/.test(getComputedStyle(surface).backgroundColor)) surface = surface.parentElement;
      const probe = document.createElement("div");
      probe.style.background = "var(--graview-panel)";
      root?.appendChild(probe);
      const panel = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { drawn: surface ? getComputedStyle(surface).backgroundColor : null, token: root ? getComputedStyle(root).getPropertyValue("--graview-ground").trim() : null, panel };
    })(),
  };
}

const host = await buildHost();
const errors = [];
const seen = [];
const preferred = [];
const icons = [];
const logos = [];
const grounds = [];
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    const open = async (query, colorScheme = "light") => {
      const context = await browser.newContext({ viewport: DESK, colorScheme });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${engine} ${query}: ${error.message}`));
      await page.goto(`${at("brand-host")}/?${query}`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForTimeout(800);
      const drawn = await page.evaluate(read);
      await context.close();
      return drawn;
    };
    for (const scheme of SCHEMES) for (const face of FACES) seen.push({ engine, scheme, face, ...(await open(`face=${face}&theme=${scheme}`)) });
    for (const scheme of SCHEMES) for (const face of FACES) for (const logo of ["pair", "invert"]) logos.push({ engine, scheme, face, logo, ...(await open(`face=${face}&theme=${scheme}&logo=${logo}`)) });
    for (const scheme of SCHEMES) for (const face of FACES) grounds.push({ engine, scheme, face, ...(await open(`face=${face}&theme=${scheme}&ground=${encodeURIComponent(GROUND)}`)).ground });
    for (const face of FACES) preferred.push({ engine, face, system: "light", stamped: "none", drawn: (await open(`face=${face}`, "light")).drawn });
    icons.push({ engine, owned: (await open("face=pages&favicon=1")).icons, embedded: (await open("face=pages")).icons });
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const checks = {
  theLogoIsDrawnByteForByteWhereverTheNameIs: { seen: seen.map(({ engine, scheme, face, marks }) => ({ engine, scheme, face, marks: marks.length, same: marks.every((one) => one === LOGO) })), ok: seen.length > 0 && seen.every((one) => one.marks.length > 0 && one.marks.every((mark) => mark === LOGO)) },
  theNameAndTheHeadingsAreSetInTheDisplayFace: {
    expected: SYSTEM_STACKS["system-serif"],
    seen: seen.map(({ engine, scheme, face, nameFaces, headingFaces }) => ({ engine, scheme, face, nameFaces, headingFaces })),
    ok: seen.every((one) => one.nameFaces.length > 0 && one.nameFaces.every((face) => flat(face) === SERIF) && (one.face !== "pages" || (one.headingFaces.some((h) => h.text === "Workshops by En Dash") && one.headingFaces.every((h) => flat(h.face) === SERIF)))),
  },
  theDescriptionIsTheHomesLineAndTheNamesHover: {
    seen: seen.map(({ engine, scheme, face, subtitles, nameTitles }) => ({ engine, scheme, face, subtitles, nameTitles })),
    ok: seen.every((one) => one.nameTitles.some((title) => title.includes(document_.description)) && (one.face !== "pages" || one.subtitles.includes(document_.description))),
  },
  theBrandsShapeReachesThePage: { seen: seen.map(({ engine, scheme, face, radius }) => ({ engine, scheme, face, radius })), ok: seen.every((one) => one.radius === "6px") },
  theSchemeTheHostStampedIsDrawn: { seen: seen.map(({ engine, scheme, face, drawn }) => ({ engine, face, stamped: scheme, drawn })), ok: seen.every((one) => one.drawn === one.scheme) },
  theAppsPreferredSchemeIsDrawnWhenNobodyChose: { preferred: document_.brand.scheme, seen: preferred, ok: preferred.length === engines.length * FACES.length && preferred.every((one) => one.drawn === "dark") },
  thePageWearsTheBrandsIconOnlyWhenTheHostOwnsIt: { seen: icons, ok: icons.length === engines.length && icons.every((one) => one.owned.length > 0 && one.owned.every((href) => href === ICON) && one.embedded.length === 1 && one.embedded[0] === "/host-icon.svg") },
  theLogoForTheSchemeIsTheOneDrawn: {
    seen: logos.filter((one) => one.logo === "pair").map(({ engine, scheme, face, faces }) => ({ engine, scheme, face, faces })),
    ok: logos.some((one) => one.logo === "pair") && logos.filter((one) => one.logo === "pair").every((one) => one.faces.length > 0 && one.faces.every((mark) => { const drawn = mark.filter((face) => face.drawn); return mark.length === 2 && drawn.length === 1 && drawn[0].scheme === one.scheme && drawn[0].fill === (one.scheme === "dark" ? "#fedcba" : "#123456"); })),
  },
  aLightLogoIsInvertedInTheDarkOnlyWhereTheBrandAsked: {
    seen: logos.filter((one) => one.logo === "invert").map(({ engine, scheme, face, fallbacks }) => ({ engine, scheme, face, fallbacks })),
    ok: logos.some((one) => one.logo === "invert") && logos.filter((one) => one.logo === "invert").every((one) => one.fallbacks.length > 0 && one.fallbacks.every((mark) => (one.scheme === "dark" ? /invert\(1\)/.test(mark.filter) && /hue-rotate\(180deg\)/.test(mark.filter) && mark.blend === "screen" : mark.filter === "none" && mark.blend === "normal"))),
  },
  theAppsOwnGroundIsDrawnInBothSchemes: {
    expected: GROUNDS,
    seen: grounds,
    ok: grounds.length === engines.length * SCHEMES.length * FACES.length && grounds.every((one) => one.token === (one.scheme === "light" ? GROUND : drawnFrom.dark.ground) && one.drawn === GROUNDS[one.scheme][one.face] && one.panel !== one.drawn) && drawnFrom.dark.ground !== GROUND,
  },
  noPageThrew: { errors, ok: errors.length === 0 },
};
const report = { at: new Date().toISOString(), engines, document: "packages/core/tests/document/fixtures/en-dash.gdd.json", checks, passed: Object.values(checks).every((check) => check.ok) };
writeFileSync(resolve(repoRoot, "docs/brand.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
process.exit(report.passed ? 0 : 1);
