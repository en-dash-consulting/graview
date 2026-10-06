/**
 * A FRAME GUEST OF A FEW LINES, IN A REAL BROWSER (FR-85–FR-88): the client
 * transport of `scripts/guest-sandbox.mjs`.
 *
 * Graview Cloud serves an owner's uploaded view in a frame whose policy
 * allows inline script and nothing else (`default-src 'none'; script-src
 * 'unsafe-inline'`), so the guest's client cannot be loaded from anywhere:
 * it is inlined. The guest here is a few lines of HTML and the prebuilt
 * client (`@graview/guest/client.js`, GraviewGuest.connect) in a <script>,
 * served from another origin under that policy, and registered in the
 * embed over the offers fixture as a guest view of `package` that reads
 * `offer` and `includes` and is titled "The price sheet"; a second is the
 * home's body. Lin, of the client, may see the packages and only the
 * offers made to her firm.
 *
 * The claims: the inlined client connects under that policy; the guest
 * draws each package's offers, read across kinds, with nothing of the offer
 * Lin may not see in what it was handed (FR-85); it is painted from
 * `props.theme` and pushed the dark theme when the app's toggle goes dark,
 * whatever the system prefers (FR-86); its frame is named by its title and
 * it is a place by that title (FR-87); a press in it asks for an act,
 * applied as Lin through the view; a link in it goes to the record's page;
 * it resizes to what it asks; and a guest attached to the home is the
 * home's body (FR-88).
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

/** Graview Cloud's policy for an uploaded view: inline script, and nothing else to load. */
export const VIEW_POLICY = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'";

/**
 * The guest, as an owner writes it: the graview-embed skill's worked example
 * (examples/price-sheet.html), with the client inlined where it says so.
 * The harness wraps `connect` to keep what each push handed the guest, so
 * it can say what the guest was never handed; the guest is not changed.
 */
export function priceSheet(repoRoot, client) {
  const example = readFileSync(resolve(repoRoot, "packages/skills/skills/graview-embed/examples/price-sheet.html"), "utf8");
  const recorder = `;(function () { var client = GraviewGuest; window.__seen = []; GraviewGuest = { protocol: client.protocol, connect: function () { var guest = client.connect.apply(client, arguments); guest.subscribe(function (props) { window.__seen.push(props); }); return guest; } }; })();`;
  const placeholder = "<script>/* @graview/guest/client.js, inlined here */</script>";
  if (!example.includes(placeholder)) throw new Error("the worked example no longer says where the client goes");
  return example.replace(placeholder, () => `<script>${client.replace(/<\/script/gi, "<\\/script")}${recorder}</script>`);
}

const FRONT = (client) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Front</title></head><body><h1 id="front">Our packages</h1><ul id="list"></ul>
<script>${client.replace(/<\/script/gi, "<\\/script")}</script>
<script>
GraviewGuest.connect().subscribe((props) => {
  document.getElementById("list").replaceChildren(...props.nodes.map((node) => Object.assign(document.createElement("li"), { textContent: node.label })));
});
</script></body></html>`;

export async function clientSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, GUEST, GUEST_PORT }) {
  const client = readFileSync(resolve(repoRoot, "packages/guest/client.js"), "utf8");
  const out = mkdtempSync(join(tmpdir(), "graview-guest-client-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { guestView } from "@graview/guest/host";
import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const asked = new URLSearchParams(location.search);
window.__handle = mount(document.getElementById("app"), {
  app: offersApp,
  seed: offersSeed,
  principal: lin,
  face: "pages",
  ...(asked.get("path") ? { path: asked.get("path") } : {}),
  scheme: "light",
  label: "Offers",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => {
    registry.register("package", { cardinality: "many", fidelity: "full" }, guestView({ url: ${JSON.stringify(`${GUEST}/prices.html`)}, name: "prices", title: "The price sheet", reads: { kinds: ["offer"], edges: ["includes"] } }), { title: "The price sheet" });
    registry.home?.(guestView({ url: ${JSON.stringify(`${GUEST}/front.html`)}, name: "front", title: "The front page", reads: { kinds: ["package"] } }));
    return registry;
  },
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
  writeFileSync(
    join(out, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offers</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`,
  );
  const servers = [
    createServer((request, response) => {
      const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
      try {
        const body = readFileSync(join(out, path));
        response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end();
      }
    }).listen(HOST_PORT, "127.0.0.1"),
    createServer((request, response) => {
      const body = { "/prices.html": priceSheet(repoRoot, client), "/front.html": FRONT(client) }[request.url ?? ""];
      if (!body) {
        response.writeHead(404);
        return response.end();
      }
      response.writeHead(200, { "content-type": "text/html", "content-security-policy": VIEW_POLICY });
      response.end(body);
    }).listen(GUEST_PORT, "localhost"),
  ];

  try {
    /* The system says light throughout: the app's own toggle is what must win. */
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const violations = [];
    tab.on("console", (message) => /Content Security Policy|Refused to/i.test(message.text()) && violations.push(message.text().slice(0, 200)));
    const open = async (path) => {
      await tab.goto(`${HOST}/?path=${encodeURIComponent(path)}`, { waitUntil: "load" });
      await tab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    };
    const guestFrame = async (name) => {
      for (let i = 0; i < 150; i += 1) {
        const found = tab.frames().find((one) => one.url().endsWith(`/${name}.html`));
        if (found && (await found.evaluate(() => (window.__seen?.length ?? 0) > 0 || Boolean(document.querySelector("#list li"))).catch(() => false))) return found;
        await tab.waitForTimeout(100);
      }
      const frame = tab.frames().find((one) => one.url().endsWith(`/${name}.html`));
      const inside = frame ? await frame.evaluate(() => ({ seen: window.__seen?.length ?? null, client: typeof GraviewGuest, body: document.body.innerHTML.slice(0, 300) })).catch((error) => String(error)) : "no frame";
      throw new Error(`${name} never drew: ${JSON.stringify({ inside, frames: tab.frames().map((one) => one.url()), errors: report.pageErrors, violations })}`);
    };
    /* A token as the browser computes a colour, read off the embed's own root. */
    const token = (name) =>
      tab.evaluate((variable) => {
        const value = getComputedStyle(document.querySelector("[data-graview-scheme]")).getPropertyValue(variable).trim();
        const probe = document.createElement("div");
        probe.style.backgroundColor = value;
        document.body.appendChild(probe);
        const said = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return said;
      }, name);
    const drawn = (frame) =>
      frame.evaluate(() => ({
        scheme: window.__seen.at(-1)?.theme?.scheme ?? null,
        background: getComputedStyle(document.body).backgroundColor,
        packages: [...document.querySelectorAll(".package")].map((one) => ({ title: one.querySelector("h2").textContent, offers: [...one.querySelectorAll("a")].map((link) => link.textContent) })),
        text: document.body.textContent,
        wire: JSON.stringify(window.__seen),
        pushes: window.__seen.length,
        height: document.documentElement.scrollHeight,
        connected: typeof GraviewGuest === "object" && typeof GraviewGuest.connect === "function",
      }));

    // ── the place, and what it was handed ──
    await open("/places");
    await tab.waitForTimeout(400);
    claim('the pages face lists the guest view among the app\'s places, by its title, "The price sheet"', await tab.evaluate(() => document.body.textContent.includes("The price sheet")));
    await open("/places/the-price-sheet");
    const prices = await guestFrame("prices");
    const first = await drawn(prices);
    claim("the graview-embed skill's worked example, the client inlined, is served with Cloud's view policy, and GraviewGuest.connect() connects under it", first.connected && first.pushes > 0 && violations.length === 0, { connected: first.connected, pushes: first.pushes, violations, policy: VIEW_POLICY });
    const frameTitle = await tab.evaluate(() => document.querySelector('iframe[data-guest-view="prices"]')?.getAttribute("title") ?? null);
    claim('its frame is named by its title, "The price sheet", at the place\'s own address', frameTitle === "The price sheet", frameTitle);
    const start = first.packages.find((one) => one.title.startsWith("A way in"));
    claim("it draws each package's offers, read across kinds from the offers and the includes edges", first.packages.length === 3 && JSON.stringify(start?.offers) === JSON.stringify(["Team coaching", "AI strategy sprint"]), first.packages);
    claim("nothing it was handed or drew names the offer Lin may not see", !first.wire.includes("Internal margin review") && !first.wire.includes("offer:margin") && !first.text.includes("Internal margin review"), first.packages);

    // ── the theme, and the app's toggle ──
    const lightPanel = await token("--graview-panel");
    claim("it is painted from props.theme in the app's light panel", first.scheme === "light" && first.background === lightPanel, { background: first.background, lightPanel });
    await tab.evaluate(() => window.__handle.setScheme("dark"));
    await prices.waitForFunction(() => window.__seen.at(-1)?.theme?.scheme === "dark", null, { timeout: 10_000 }).catch(() => {});
    const dark = await drawn(prices);
    const darkPanel = await token("--graview-panel");
    const system = await tab.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    claim("toggling the app to dark pushes it the dark theme and it repaints, though the system says light", !system && dark.scheme === "dark" && dark.background === darkPanel && darkPanel !== lightPanel, { dark: dark.background, darkPanel, system });

    // ── it resizes ──
    const height = await tab.evaluate(() => document.querySelector('iframe[data-guest-view="prices"]')?.style.height ?? null);
    claim("it resizes: the frame takes the height the guest asked for", dark.height > 160 && height === `${dark.height}px`, { asked: dark.height, height });

    // ── it acts ──
    await prices.click("button");
    await prices.waitForFunction(() => document.querySelector("button")?.textContent !== "Note that we compared prices", null, { timeout: 10_000 }).catch(() => {});
    const answer = await prices.evaluate(() => document.querySelector("button")?.textContent);
    const last = await tab.evaluate(() => {
      const op = window.__handle.store.log.all().at(-1);
      return op ? { author: op.author.id, via: op.via, intent: op.intent } : null;
    });
    claim("a press in it asks for an act, applied as Lin through the view (via view:prices)", answer === "Noted." && last?.author === "party:lifelogics" && last?.via === "view:prices" && last?.intent.includes("Compared the packages on price"), { answer, last });

    // ── it navigates ──
    await prices.getByText("Team coaching").first().click();
    await tab.waitForFunction(() => /Team coaching/.test(document.querySelector("h1")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
    const heading = await tab.evaluate(() => document.querySelector("h1")?.textContent ?? null);
    claim("a link in it goes to the record's own page", /Team coaching/.test(heading ?? ""), heading);

    // ── the home ──
    await tab.evaluate(() => window.__handle.setScheme("light"));
    await open("/");
    const front = await guestFrame("front");
    const home = await tab.evaluate(() => ({ inBody: Boolean(document.querySelector('[data-testid="home-view"] iframe[data-guest-view="front"]')), title: document.querySelector('iframe[data-guest-view="front"]')?.getAttribute("title") ?? null }));
    const listed = await front.evaluate(() => [...document.querySelectorAll("#list li")].map((li) => li.textContent));
    claim("a frame guest attached to the home is the routed home's body, drawn over what it reads", home.inBody && home.title === "The front page" && listed.length === 3, { home, listed });
    claim("the guest's policy refused nothing it needed", violations.length === 0, violations);
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    for (const server of servers) server.close();
    rmSync(out, { recursive: true, force: true });
  }
}
