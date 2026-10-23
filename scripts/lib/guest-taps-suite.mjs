/**
 * A PRESS AND A PHONE'S TAP ON A WORKER VIEW, IN A REAL BROWSER (0.1.45):
 * the taps transport of `scripts/guest-sandbox.mjs`.
 *
 * Graview Cloud's Threat Watch in miniature (scripts/fixtures/threat-app.ts):
 * the home is a worker view drawing each threat as a card,
 * `<div class="card" data-record="threat:…">` with a heading, badges and a
 * line inside and no `<a>` anywhere, and a "More" toggle on each card the
 * view binds itself with `graview.on("click")`. The embed is mounted the way
 * a host mounts it, on the pages face, at the home.
 *
 * The claims: the card is a link the host made, drawn as something to
 * press; a click on its heading opens the threat's page, and so does Enter
 * on the card; and on a phone (Chromium's and WebKit's mobile emulation,
 * a coarse pointer and touch; Firefox has none, so its run is the desk's
 * alone) a tap on the card's heading opens it, a tap on a badge inside it
 * opens it, and a tap on the view's own toggle inside the card toggles it
 * and opens nothing.
 *
 * And a press that is no button: each card's "Acknowledge" and each triage
 * fieldset's "Save the note" are `<span role="button" data-act>`. The host
 * makes each a press, reached by the keyboard and drawn as something to
 * press; on a desk Space on "Acknowledge" and Enter on "Save the note",
 * after a note typed beside it, apply their acts; on a phone a tap on
 * "Acknowledge" inside a card acknowledges the threat and opens nothing,
 * and a tap on "Save the note" saves the note typed beside it.
 *
 * And the keyboard by default (0.1.47): Tab from the top of the page
 * reaches every link and press the view drew; Space on a
 * `<div role="button" aria-pressed>` the view hears itself presses it
 * without scrolling the page, and the keyboard stays on it as the view
 * draws again; whatever has the keyboard shows a ring at 3:1 or more,
 * light and dark; an `<a data-record>` carries its address as its `href`,
 * a Cmd- or Ctrl-click opens it in a new tab and a plain click in the app;
 * an icon that says nothing is hidden from assistive technology; and a
 * table's row opens on Enter on its first cell.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const PHISHING = "threat:phishing";
const VPN = "threat:vpn";

export async function tapsSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, engine }) {
  const out = mkdtempSync(join(tmpdir(), "graview-guest-taps-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { sam, threatApp, threatSeed, WATCH_JS, WATCH_MANIFEST } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/threat-app.ts"))};
window.__failures = [];
window.__problems = [];
const asked = new URLSearchParams(location.search);
window.__handle = mount(document.getElementById("app"), {
  app: threatApp,
  seed: threatSeed,
  principal: sam,
  face: "pages",
  /* The host keeps its own addresses (memory routing): a page of the app is its one page, ?at=<the app's path>. */
  path: asked.get("at") ?? "/",
  ...(asked.has("bare") ? {} : { hrefOf: (path) => "/?at=" + encodeURIComponent(path) }),
  scheme: new URLSearchParams(location.search).get("scheme") === "dark" ? "dark" : "light",
  label: "Threat Watch",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, { manifest: WATCH_MANIFEST, worker: { source: WATCH_JS }, onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) }),
});
window.__handle.drawn().then(() => { window.__ready = true; });
window.__view = () => document.querySelector("[data-worker-view]")?.shadowRoot ?? null;
window.__card = (id) => window.__view()?.querySelector('.card[data-record="' + id + '"]') ?? null;
window.__path = () => window.__handle.where().path;
window.__node = (id) => window.__handle.store.graph.getNode(id);
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
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Threat Watch</title>
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

  const open = async (on, query = "") => {
    await on.goto(`${HOST}/${query}`, { waitUntil: "load" });
    await on.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    await on.waitForFunction((id) => window.__card?.(id)?.querySelector("h3") != null, PHISHING, { timeout: 15_000 });
    await on.waitForTimeout(300);
  };
  /* Where the reader is once a press has had its chance to move them: the home's path, unless it did. */
  const settled = async (on) => {
    await on.waitForFunction(() => window.__path() !== "/", null, { timeout: 3_000 }).catch(() => {});
    return on.evaluate(() => window.__path());
  };
  /* The threat's own page: its path names it. */
  const opened = (path) => typeof path === "string" && path !== "/" && path.includes("phishing");
  const inView = (selector) => `[data-worker-view] >> ${selector}`;

  try {
    /* ON A DESK. */
    const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await desk.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await open(tab);
    const drawn = await tab.evaluate((id) => {
      const card = window.__card(id);
      const style = getComputedStyle(card);
      return { link: card.hasAttribute("data-graview-link"), role: card.getAttribute("role"), tabindex: card.getAttribute("tabindex"), cursor: style.cursor, touchAction: style.touchAction };
    }, PHISHING);
    claim("a card the view bound to a record with data-record is a link the host made: a link to assistive technology, reached by the keyboard, drawn with a pointer and no double-tap zoom", drawn.link && drawn.role === "link" && drawn.tabindex === "0" && drawn.cursor === "pointer" && drawn.touchAction === "manipulation", drawn);
    await tab.locator(inView(`.card[data-record="${PHISHING}"] h3`)).click();
    const clicked = await settled(tab);
    claim("on a desk, a click on a threat card's heading opens the threat's page", opened(clicked), clicked);
    await open(tab);
    await tab.locator(inView(`.card[data-record="${PHISHING}"]`)).focus();
    await tab.keyboard.press("Enter");
    const entered = await settled(tab);
    claim("on a desk, Enter on a threat card opens the threat's page", opened(entered), entered);
    /* A PRESS THAT IS NO BUTTON. */
    await open(tab);
    const press = await tab.evaluate((id) => {
      const span = window.__view().querySelector('[data-ack="' + id + '"]');
      const style = getComputedStyle(span);
      return { role: span.getAttribute("role"), tabindex: span.getAttribute("tabindex"), marked: span.hasAttribute("data-graview-press"), cursor: style.cursor, touchAction: style.touchAction };
    }, PHISHING);
    claim('a <span role="button" data-act> is a press the host made: a button to assistive technology, reached by the keyboard, drawn with a pointer and no double-tap zoom', press.role === "button" && press.tabindex === "0" && press.marked && press.cursor === "pointer" && press.touchAction === "manipulation", press);
    await tab.locator(inView(`[data-ack="${PHISHING}"]`)).focus();
    await tab.keyboard.press("Space");
    await tab.waitForFunction((id) => window.__node(id)?.status === "acknowledged" && window.__view().querySelector('[data-said="' + id + '"]')?.textContent === "Done", PHISHING, { timeout: 5_000 }).catch(() => {});
    const spaced = await tab.evaluate((id) => ({ status: window.__node(id)?.status, said: window.__view().querySelector('[data-said="' + id + '"]')?.textContent, path: window.__path(), scrolled: window.scrollY }), PHISHING);
    claim('on a desk, Space on a card\'s <span role="button" data-act="acknowledge"> acknowledges the threat, the view hears that it did, and the card does not open', spaced.status === "acknowledged" && spaced.said === "Done" && spaced.path === "/", spaced);
    await tab.locator(inView(`[data-note="${VPN}"]`)).fill("Patch window is Saturday");
    await tab.locator(inView(`[data-save-note="${VPN}"]`)).focus();
    await tab.keyboard.press("Enter");
    await tab.waitForFunction((id) => window.__node(id)?.note === "Patch window is Saturday", VPN, { timeout: 5_000 }).catch(() => {});
    const noted = await tab.evaluate((id) => ({ note: window.__node(id)?.note ?? null }), VPN);
    claim('on a desk, Enter on a fieldset\'s <span role="button" data-act="set-note"> saves the note typed beside it', noted.note === "Patch window is Saturday", noted);
    claim("the home view did not fail, and the host said nothing was wrong with it", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));

    /* THE KEYBOARD, BY DEFAULT (0.1.47): Tab from the top of the page through the view, and every link and press the view drew is reached. */
    await open(tab);
    const stops = await tab.evaluate(() => {
      const view = window.__view();
      const marks = [...view.querySelectorAll("[data-graview-link], [data-graview-press], a[href], button, input")]
        .map((one) => (one.localName === "tr" ? one.querySelector("td, th") : one))
        .filter(Boolean)
        .filter((one, at, all) => all.indexOf(one) === at);
      marks.forEach((one, at) => one.setAttribute("data-tab-stop", String(at)));
      document.activeElement?.blur?.();
      return marks.map((one) => `<${one.localName}${one.getAttribute("data-record") ? ` data-record="${one.getAttribute("data-record")}"` : ""}${one.getAttribute("data-act") ? ` data-act="${one.getAttribute("data-act")}"` : ""}>`);
    });
    const reached = new Set();
    let inside = false;
    /* Safari's Tab passes over links with an address unless the person asks for them, as on every page: Option-Tab is how its keyboard reaches them. */
    const next = engine === "webkit" ? "Alt+Tab" : "Tab";
    for (let press = 0; press < 240; press += 1) {
      await tab.keyboard.press(next);
      const at = await tab.evaluate(() => {
        let on = document.activeElement;
        while (on?.shadowRoot?.activeElement) on = on.shadowRoot.activeElement;
        return on?.getAttribute?.("data-tab-stop") ?? null;
      });
      if (at !== null) {
        inside = true;
        reached.add(Number(at));
      } else if (inside) break;
    }
    const missed = stops.filter((_, at) => !reached.has(at));
    claim("on a desk, Tab (Option-Tab in Safari, which passes over any link with an address without it) reaches every link and press the view drew: each card, link and row bound to a record (a row by its first cell), each data-act, each control it hears itself, each button and field", stops.length >= 12 && missed.length === 0, { stops: stops.length, missed });

    /* A <div role="button"> the view hears itself: Space presses it, and the page does not scroll under it. */
    await open(tab);
    await tab.evaluate(() => {
      window.__keys = [];
      window.addEventListener("keydown", (event) => window.__keys.push({ key: event.key, prevented: event.defaultPrevented }));
    });
    const scrolled = () =>
      tab.evaluate(() => {
        let sum = window.scrollY;
        const walk = (root) => {
          for (const one of root.querySelectorAll("*")) {
            sum += one.scrollTop;
            if (one.shadowRoot) walk(one.shadowRoot);
          }
        };
        walk(document);
        return sum;
      });
    await tab.locator(inView(`[data-save-note="${VPN}"]`)).focus();
    await tab.keyboard.press("Tab");
    const before = await scrolled();
    await tab.keyboard.press("Space");
    await tab.waitForFunction(() => window.__view().querySelector("[data-only-critical]")?.getAttribute("aria-pressed") === "true", null, { timeout: 5_000 }).catch(() => {});
    const toggled = await tab.evaluate(() => {
      const view = window.__view();
      const div = view.querySelector("[data-only-critical]");
      return { pressed: div.getAttribute("aria-pressed"), tabindex: div.getAttribute("tabindex"), links: view.querySelectorAll(".every li").length, keys: window.__keys, focused: view.activeElement === div, path: window.__path() };
    });
    const after = await scrolled();
    claim('on a desk, Space on a <div role="button" aria-pressed> the view hears with graview.on("click") presses it, as on a button, and the page does not scroll', toggled.pressed === "true" && toggled.tabindex === "0" && toggled.links === 1 && toggled.keys.at(-1)?.key === " " && toggled.keys.at(-1)?.prevented === true && before === after && toggled.path === "/", { ...toggled, before, after });
    claim("the keyboard stays on the control the view drew again, as it drew the list again under it", toggled.focused, toggled);

    /* A whole ring, at least 2px, set off, in the app's accent at 3:1 or more against the ground behind it — light and dark. */
    const ringOf = (on) =>
      on.evaluate(() => {
        const view = window.__view();
        const div = view.querySelector("[data-only-critical]");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const paint = canvas.getContext("2d", { willReadFrequently: true });
        const rgba = (color) => {
          paint.clearRect(0, 0, 1, 1);
          paint.fillStyle = "#000";
          paint.fillStyle = color;
          paint.fillRect(0, 0, 1, 1);
          return [...paint.getImageData(0, 0, 1, 1).data];
        };
        let ground = null;
        for (let at = div.parentElement ?? div.getRootNode().host; at && !ground; at = at.parentElement ?? at.getRootNode()?.host ?? null) {
          const said = rgba(getComputedStyle(at).backgroundColor);
          if (said[3] === 255) ground = said;
        }
        ground ??= rgba(getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "#000" : "#fff");
        const style = getComputedStyle(div);
        const ring = rgba(style.outlineColor);
        const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const [hi, lo] = [luminance(ring), luminance(ground)].sort((a, b) => b - a);
        return { visible: div.matches(":focus-visible"), style: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), ring, ground, contrast: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 };
      });
    const ringed = (ring) => ring.visible && ring.style === "solid" && ring.width >= 2 && ring.offset >= 1 && ring.contrast >= 3;
    const light = await ringOf(tab);
    const dark = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    const night = await dark.newPage();
    night.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await open(night, "?scheme=dark");
    await night.locator(inView(`[data-save-note="${VPN}"]`)).focus();
    await night.keyboard.press("Tab");
    const darkRing = await ringOf(night);
    await dark.close();
    claim("whatever has the keyboard shows a whole ring at least 2px wide, set off from it, at 3:1 or more against the ground behind it, light and dark", ringed(light) && ringed(darkRing), { light, dark: darkRing });

    /* A real link: an address on hover and in a new tab, and the app's own on a plain click. */
    await open(tab);
    const anchor = await tab.evaluate((id) => {
      const a = window.__view().querySelector('[data-link="' + id + '"]');
      return { href: a.getAttribute("href"), role: a.getAttribute("role"), tabindex: a.getAttribute("tabindex"), target: a.getAttribute("target"), icon: a.querySelector("svg")?.getAttribute("aria-hidden") ?? null, color: getComputedStyle(a).color, ink: getComputedStyle(a.closest("li")).color, underline: getComputedStyle(a).textDecorationLine };
    }, PHISHING);
    /* The app's path the host's address names (`?at=`): the host keeps its own addresses, and says them through `hrefOf`. */
    const atOf = (href) => (typeof href === "string" && href.startsWith("/?at=") ? decodeURIComponent(href.slice("/?at=".length)) : null);
    claim("an <a data-record> carries the host's own address for the page the face goes to as its href (the embed's hrefOf), opens in this tab, needs no role or tab stop patched on, and is drawn in the words' own color, not underlined", opened(atOf(anchor.href)) && atOf(anchor.href).startsWith("/threats/") && anchor.role === null && anchor.tabindex === null && anchor.target === null && anchor.color === anchor.ink && anchor.underline === "none", anchor);
    claim("an icon the view drew with no role, label or title is hidden from assistive technology", anchor.icon === "true", anchor);
    const popup = desk.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
    await tab.locator(inView(`[data-link="${PHISHING}"]`)).click({ modifiers: ["ControlOrMeta"] });
    const newTab = await popup;
    const stayed = await tab.evaluate(() => window.__path());
    /* The new tab is the host's page at that address, and the app opens there on the threat's page. */
    let landedThere = null;
    if (newTab) {
      await newTab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 }).catch(() => null);
      landedThere = await newTab.evaluate(() => window.__path?.() ?? null).catch(() => null);
    }
    const there = newTab ? new URL(newTab.url()) : null;
    claim("a Cmd- or Ctrl-click on it is the browser's: a new tab at the host's address, where the app opens on the threat's page, and the app stays where it was", stayed === "/" && there !== null && `${there.pathname}${there.search}` === anchor.href && opened(landedThere), { stayed, opened: newTab?.url() ?? null, href: anchor.href, landedThere });
    await newTab?.close();
    await tab.locator(inView(`[data-link="${PHISHING}"]`)).click();
    const followed = await settled(tab);
    claim("a plain click on it opens the threat's page in the app, at the path its address names", followed === atOf(anchor.href), { followed, href: anchor.href });

    /*
     * A HOST THAT SAYS NO ADDRESS: memory routing with no hrefOf. The face's
     * own path is no page of the host's, so the link carries none — a link
     * by its role and the keyboard, as on the scene — and Enter on it still
     * opens the threat's page in the app.
     */
    await open(tab, "?bare=1");
    const bare = await tab.evaluate((id) => {
      const a = window.__view().querySelector('[data-link="' + id + '"]');
      return { href: a.getAttribute("href"), role: a.getAttribute("role"), tabindex: a.getAttribute("tabindex") };
    }, PHISHING);
    await tab.locator(inView(`[data-link="${PHISHING}"]`)).focus();
    await tab.keyboard.press("Enter");
    const bareFollowed = await settled(tab);
    claim("under memory routing with no address from the host, an <a data-record> carries no href, is a link by its role and a tab stop, and Enter opens the threat's page in the app", bare.href === null && bare.role === "link" && bare.tabindex === "0" && opened(bareFollowed), { ...bare, followed: bareFollowed });

    /*
     * THE RING AT THE REGION'S EDGE: a link the view drew flush with the
     * region's left edge, given the keyboard, shows its whole ring — every
     * side of it painted, not cut by the region's clip. And one the view
     * rings wider (--graview-focus-width 5px, --graview-focus-offset 4px, set
     * in its own stylesheet where the region's rule cannot read them): the
     * region lets as much past its edge as that ring reaches.
     */
    const ringAtTheEdge = async (selector) => {
      await open(tab);
      await tab.locator(inView(selector)).focus();
      await tab.keyboard.press(engine === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab");
      await tab.keyboard.press(engine === "webkit" ? "Alt+Tab" : "Tab");
      const edge = await tab.evaluate((selector) => {
        const a = window.__view().querySelector(selector);
        const region = document.querySelector("[data-worker-view]").getBoundingClientRect();
        const box = a.getBoundingClientRect();
        const style = getComputedStyle(a);
        const width = parseFloat(style.outlineWidth);
        const offset = parseFloat(style.outlineOffset);
        return { focused: a.matches(":focus-visible"), flushLeft: Math.round(box.left - region.left), width, offset, color: style.outlineColor, ring: { left: box.left - offset - width, top: box.top - offset - width, right: box.right + offset + width, bottom: box.bottom + offset + width }, region: { left: region.left, top: region.top } };
      }, selector);
      /* Each side of the ring, sampled at its middle across its width: the ring's color must be painted there. */
      const shot = await tab.screenshot({ clip: { x: Math.max(0, edge.ring.left - 2), y: Math.max(0, edge.ring.top - 2), width: edge.ring.right - edge.ring.left + 4, height: edge.ring.bottom - edge.ring.top + 4 } });
      const sides = await tab.evaluate(
        async ({ b64, edge, from }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${b64}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const paint = canvas.getContext("2d", { willReadFrequently: true });
          paint.drawImage(image, 0, 0);
          const scale = image.width / (edge.ring.right - edge.ring.left + 4);
          const probe = document.createElement("canvas").getContext("2d");
          probe.fillStyle = edge.color;
          probe.fillRect(0, 0, 1, 1);
          const want = [...probe.getImageData(0, 0, 1, 1).data];
          const near = (at) => Math.abs(at[0] - want[0]) + Math.abs(at[1] - want[1]) + Math.abs(at[2] - want[2]) < 60;
          const px = (x, y) => [...paint.getImageData(Math.floor((x - from.x) * scale), Math.floor((y - from.y) * scale), 1, 1).data];
          const half = edge.width / 2;
          const middle = { x: (edge.ring.left + edge.ring.right) / 2, y: (edge.ring.top + edge.ring.bottom) / 2 };
          return {
            left: near(px(edge.ring.left + half, middle.y)),
            top: near(px(middle.x, edge.ring.top + half)),
            right: near(px(edge.ring.right - half, middle.y)),
            bottom: near(px(middle.x, edge.ring.bottom - half)),
          };
        },
        { b64: shot.toString("base64"), edge, from: { x: Math.max(0, edge.ring.left - 2), y: Math.max(0, edge.ring.top - 2) } },
      );
      return { ...edge, sides, whole: edge.focused && edge.flushLeft === 0 && edge.width >= 2 && sides.left && sides.top && sides.right && sides.bottom };
    };
    const edge = await ringAtTheEdge("[data-flush]");
    const wide = await ringAtTheEdge("[data-flush-wide]");
    claim("a focused link flush with the region's left edge shows its whole ring, and so does one the view rings wider", edge.whole && wide.whole && wide.width >= 5, { edge, wide });

    /* A table's row bound to a record: its first cell takes the keyboard, and Enter there opens the row. */
    await open(tab);
    const row = await tab.evaluate((id) => {
      const tr = window.__view().querySelector('[data-row="' + id + '"]');
      return { role: tr.getAttribute("role"), tabindex: tr.getAttribute("tabindex"), cell: tr.querySelector("td").getAttribute("tabindex") };
    }, PHISHING);
    await tab.locator(inView(`[data-row="${PHISHING}"] td >> nth=0`)).focus();
    await tab.keyboard.press("Enter");
    const rowed = await settled(tab);
    claim("a table's row bound to a record keeps its role, its first cell takes the keyboard, and Enter there opens the threat's page", row.role === null && row.tabindex === null && row.cell === "0" && opened(rowed), { ...row, path: rowed });
    await desk.close();

    /* ON A PHONE: a coarse pointer and touch, where a tap is the press. Firefox has no mobile emulation. */
    if (engine !== "firefox") {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "light" });
      const hand = await phone.newPage();
      hand.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
      await open(hand);
      const coarse = await hand.evaluate(() => matchMedia("(pointer: coarse)").matches);
      await hand.locator(inView(`.card[data-record="${PHISHING}"] h3`)).tap();
      const tapped = await settled(hand);
      claim("on a phone, a tap on a threat card's heading opens the threat's page", coarse && opened(tapped), { coarse, path: tapped });
      await open(hand);
      await hand.locator(inView(`.card[data-record="${PHISHING}"] [data-badge]`)).tap();
      const badge = await settled(hand);
      claim("on a phone, a tap on a badge inside the card opens the threat's page too: the press is the card's, from whatever inside it the finger lands on", opened(badge), badge);
      await open(hand);
      await hand.locator(inView(`[data-more="${PHISHING}"]`)).tap();
      await hand.waitForFunction((id) => window.__card(id)?.querySelector("[data-summary]") != null, PHISHING, { timeout: 5_000 }).catch(() => {});
      const toggled = await hand.evaluate((id) => ({ summary: window.__card(id)?.querySelector("[data-summary]")?.textContent ?? null, path: window.__path() }), PHISHING);
      claim("on a phone, a tap on the view's own toggle inside the card toggles it and opens nothing", toggled.summary === "Forty mailboxes got the fake invoice this morning." && toggled.path === "/", toggled);
      await open(hand);
      await hand.locator(inView(`[data-ack="${PHISHING}"]`)).tap();
      await hand.waitForFunction((id) => window.__node(id)?.status === "acknowledged", PHISHING, { timeout: 5_000 }).catch(() => {});
      const acked = await hand.evaluate((id) => ({ status: window.__node(id)?.status, path: window.__path() }), PHISHING);
      claim('on a phone, a tap on a card\'s <span role="button" data-act="acknowledge"> acknowledges the threat and opens nothing', acked.status === "acknowledged" && acked.path === "/", acked);
      await hand.locator(inView(`[data-note="${PHISHING}"]`)).tap();
      await hand.locator(inView(`[data-note="${PHISHING}"]`)).fill("Forwarded to the mail team");
      await hand.locator(inView(`[data-save-note="${PHISHING}"]`)).tap();
      await hand.waitForFunction((id) => window.__node(id)?.note === "Forwarded to the mail team", PHISHING, { timeout: 5_000 }).catch(() => {});
      const tappedNote = await hand.evaluate((id) => ({ note: window.__node(id)?.note ?? null }), PHISHING);
      claim('on a phone, a tap on a fieldset\'s <span role="button" data-act="set-note"> saves the note typed beside it', tappedNote.note === "Forwarded to the mail team", tappedNote);
      await phone.close();
    }
    claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  } finally {
    server.close();
  }
}
