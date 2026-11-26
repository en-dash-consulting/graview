/**
 * GRAVIEW.DEV'S CHROME: what every page of the site wears around its own
 * content — the shared part of the head, the one header and the one footer.
 *
 * The home, the tour, the long version, the missing page and every docs page
 * were five designs that had drifted apart: four headers with four sets of
 * links, three footers, two families of type. They are one now, and the way
 * to keep them one is to write them in one place. The hand-designed pages
 * (`apps/site/pages/`) carry these between markers, written by
 * `scripts/site-chrome.mjs` (`--check` fails when one is stale); the docs
 * shell in `apps/site/design.mjs` calls the same functions. A test holds every
 * page the site serves to the same header and footer.
 *
 * `base` is how a page reaches the site's root: "" from the root, "../" or
 * "../../" from the docs, and "/" from the page for a missing address, which
 * is served at whatever depth the address was.
 */
import { REPOSITORY } from "./prose.mjs";

/** The declaration this site is, in the repository. */
const DECLARATION = `${REPOSITORY}/blob/main/apps/site/app.json`;

/**
 * THE GRAVIEW LOCKUP: the framework's own (docs/site/brand/graview-primary.svg
 * and graview-reverse.svg), inline so it takes the page's ink — navy with the
 * turquoise point on paper, white with it on night.
 */
export const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 847.64 180" aria-hidden="true" focusable="false"><g transform="translate(12 7)"><g fill="none" stroke="currentColor" stroke-width="8.4" stroke-linejoin="round"><path d="M81 63 L15 49 L84 12 H181 L120 56"/><path d="M60 100 L15 127 L101 150 L179 107 L123 98"/><path d="M101 95 V125" stroke-linecap="round"/></g><circle cx="101" cy="74" r="11.7" fill="var(--point, currentColor)"/></g><g transform="translate(234 0)"><path d="M323.02 -200.02Q249.99 -200.02 179.98 -180.53Q109.98 -161.04 64.95 -123.06L118.05 -37.76Q154.03 -67.74 208.02 -85.72Q262 -103.71 318.94 -103.71Q409.85 -103.71 452.29 -61.76Q494.74 -19.81 494.74 65.06V167.81L504.74 281.06L499.77 395.3V532.07H605.24V77.14Q605.24 -65.93 533.17 -132.97Q461.1 -200.02 323.02 -200.02ZM311.88 23.03Q233.92 23.03 172.42 55.53Q110.93 88.03 75.42 146.03Q39.92 204.04 39.92 281.06Q39.92 358.07 75.42 416.08Q110.93 474.08 172.42 506.08Q233.92 538.08 311.88 538.08Q378.9 538.08 434.35 511.08Q489.81 484.07 523.76 427.07Q557.71 370.06 557.71 281.06Q557.71 192.05 523.76 135.05Q489.81 78.04 434.35 50.53Q378.9 23.03 311.88 23.03ZM324.09 119.38Q374.98 119.38 413.9 139.84Q452.83 160.29 474.78 196.72Q496.74 233.15 496.74 281.06Q496.74 328.97 474.78 365.39Q452.83 401.82 413.9 421.78Q374.98 441.74 324.09 441.74Q274.19 441.74 234.77 421.78Q195.35 401.82 173.39 365.39Q151.43 328.97 151.43 281.06Q151.43 233.15 173.39 196.72Q195.35 160.29 234.77 139.84Q274.19 119.38 324.09 119.38Z" transform="translate(0.0 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M86.84 0V532.07H192.32V387.97L181.21 430Q204.22 483.04 255.74 510.56Q307.25 538.08 383.26 538.08V430.68Q376.22 431.68 370.2 432.19Q364.17 432.69 358.15 432.69Q284.25 432.69 240.79 389.26Q197.34 345.84 197.34 260.92V0Z" transform="translate(101.59 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M414.85 0V109.94L409.8 131.96V321.93Q409.8 378.86 375.35 410.81Q340.89 442.77 271.95 442.77Q225.99 442.77 182.02 428.28Q138.04 413.79 107.06 388.81L61.94 471.1Q103.97 504.09 162.51 521.09Q221.04 538.08 285.04 538.08Q397.17 538.08 458.74 483.55Q520.31 429.01 520.31 315.9V0ZM245.91 -6.02Q185.88 -6.02 140.88 14Q95.88 34.01 71.39 70.02Q46.9 106.03 46.9 152.03Q46.9 196.07 67.92 231.58Q88.95 267.09 136.98 288.58Q185.01 310.07 265.03 310.07H425.83V230.93H270.17Q202.31 230.93 179.34 208.98Q156.36 187.03 156.36 156.06Q156.36 120.13 185.3 99.17Q214.24 78.21 265.13 78.21Q315.01 78.21 353.92 100.17Q392.84 122.13 409.8 165.06L429.84 89.1Q410.87 44.03 363.89 19Q316.91 -6.02 245.91 -6.02Z" transform="translate(154.53 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M226.9 0 -3.05 532.07H111.46L313.31 57.2H257.04L463.92 532.07H571.38L340.43 0Z" transform="translate(242.05 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M86.84 0V532.07H197.34V0ZM142.09 626.84Q110.96 626.84 90.39 646.9Q69.81 666.96 69.81 696.04Q69.81 725.13 90.39 745.19Q110.96 765.24 142.09 765.24Q173.23 765.24 193.8 746.19Q214.37 727.14 214.37 698.05Q214.37 667.96 194.29 647.4Q174.22 626.84 142.09 626.84Z" transform="translate(326.81 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M330.1 -6.02Q243.04 -6.02 177.5 28.99Q111.96 64 75.94 125.51Q39.92 187.03 39.92 266.03Q39.92 345.05 74.94 406.56Q109.97 468.07 171.5 503.08Q233.04 538.08 311.09 538.08Q389.1 538.08 449.14 503.59Q509.17 469.1 543.21 407.1Q577.24 345.1 577.24 262.05Q577.24 255.03 576.74 245.51Q576.23 235.99 575.23 227.97H127.35V307.1H516.97L472.79 281.09Q473.78 329.02 452.82 365.95Q431.87 402.89 395.44 423.85Q359.01 444.82 311.1 444.82Q263.18 444.82 226.25 423.85Q189.33 402.89 168.87 365.46Q148.41 328.02 148.41 278.1V260.03Q148.41 210.1 171.37 171.65Q194.33 133.21 236.26 111.75Q278.19 90.29 333.11 90.29Q379.08 90.29 416.52 105.27Q453.97 120.25 481.96 151.2L542.21 79.99Q506.2 37.99 452.18 15.98Q398.16 -6.02 330.1 -6.02Z" transform="translate(365.82 133.24) scale(.153 -.153)" fill="currentColor"/><path d="M201.92 0 4.95 532.07H109.43L281.31 57.2H232.07L410.95 532.07H504.38L679.25 57.2H630.03L806.9 532.07H905.34L707.37 0H601.87L440.08 426.67H472.23L307.42 0Z" transform="translate(454.41 133.24) scale(.153 -.153)" fill="currentColor"/></g></svg>`;

/**
 * The families the site is set in, and the two the example garden's own
 * design is set in, which its live frames draw with: served from brand/
 * (SIL Open Font License, each with its license beside it), so no page asks
 * another site for a face. A face is fetched only where a page uses it.
 */
export const FACES = [
  ["Montserrat", "montserrat-latin.woff2", "400 700"],
  ["Merriweather", "merriweather-latin.woff2", "300 900"],
  ["JetBrains Mono", "jetbrains-mono-latin.woff2", "100 800"],
  ["Figtree", "figtree-latin.woff2", "300 900"],
  ["Fraunces", "fraunces-latin.woff2", "100 900"],
];

/**
 * The part of the head every page shares. Analytics runs on graview.dev's own
 * hostname only, so a local preview, a file:// page and the harnesses send
 * nothing and never wait on the network. The faces are declared only where
 * the page is served: a browser refuses a font to a file:// page, which then
 * reads in the fallbacks the stylesheet names. `preload` names the face a
 * page's first headline is set in, so it arrives before the swap is seen.
 */
export function sharedHead({ base = "", preload = "" } = {}) {
  const faces = FACES.map(([family, file, weight]) => `@font-face { font-family: "${family}"; src: url("${base}brand/${file}") format("woff2"); font-weight: ${weight}; font-style: normal; font-display: swap; }`).join(" ");
  const early = FACES.find(([family]) => family === preload);
  return `<!-- Analytics, on graview.dev only: a local preview, a file:// page and the harnesses send nothing and never wait on the network. -->
<script>
if (location.hostname === "graview.dev" || location.hostname === "www.graview.dev") {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-5M3BER325D");
  var ga = document.createElement("script");
  ga.async = true;
  ga.src = "https://www.googletagmanager.com/gtag/js?id=G-5M3BER325D";
  document.head.appendChild(ga);
}
</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Cstyle%3Eg%7Bstroke:%23001769%7Dcircle%7Bfill:%23001769%7D%40media (prefers-color-scheme:dark)%7Bg%7Bstroke:%23fff%7Dcircle%7Bfill:%23fff%7D%7D%3C/style%3E%3Cg fill=%27none%27 stroke-width=%272.4%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M13 11 L3 8 L14 3 H29 L21 9%27/%3E%3Cpath d=%27M10 18 L3 23 L16.5 28 L29 21 L22 19%27/%3E%3Cpath d=%27M16.5 18.5 V23.5%27 stroke-linecap=%27round%27/%3E%3C/g%3E%3Ccircle cx=%2716.5%27 cy=%2713.5%27 r=%272%27/%3E%3C/svg%3E" type="image/svg+xml">
<link rel="icon" href="${base}brand/favicon.ico" sizes="16x16 32x32">
<link rel="apple-touch-icon" href="${base}brand/apple-touch-icon.png">
<script>
/* The site's faces, served from this site (brand/; SIL Open Font License, brand/OFL-*.txt). */
if (location.protocol !== "file:") {
  var face = document.createElement("style");
  face.textContent = '${faces}';
  document.head.appendChild(face);${early ? `
  var early = document.createElement("link");
  early.rel = "preload"; early.as = "font"; early.type = "font/woff2"; early.crossOrigin = "anonymous";
  early.href = "${base}brand/${early[1]}";
  document.head.appendChild(early);` : ""}
}
</script>
<style>
/* The host that publishes a page as an artifact supplies a small reset; a
   standalone page has to supply its own, so the two render identically. */
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>`;
}

/** The links the header carries, in its order: where a person goes from anywhere on the site. */
export const NAV = [
  ["tour", "tour.html", "The tour"],
  ["docs", "docs/index.html", "Docs"],
  ["github", REPOSITORY, "GitHub"],
];

const href = (base, path) => (/^https?:/.test(path) ? path : `${base}${path}`);

/**
 * THE ONE HEADER: the lockup home on the left, the tour, the docs and the
 * source on the right. `here` marks the section a page is in.
 */
export function siteHeader({ base = "", here = "" } = {}) {
  return `<header class="site-head">
  <div class="site-head-in">
    <a class="logo" href="${base === "/" ? "/" : `${base}index.html`}" aria-label="Graview home">${LOGO}</a>
    <nav class="site-nav" aria-label="Site">
${NAV.map(([id, path, label]) => `      <a href="${href(base, path)}"${id === here ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
    </nav>
  </div>
</header>`;
}

/** THE ONE FOOTER: the rest of the site, the site as the app it is, and who makes it. */
export function siteFooter({ base = "" } = {}) {
  const links = [
    ["tour.html", "The tour"],
    ["progression.html", "The garden, grown"],
    ["docs/index.html", "Docs"],
    ["docs/releases.html", "Releases"],
    [REPOSITORY, "GitHub"],
    ["https://www.npmjs.com/package/graview", "npm"],
    ["https://graview.cloud", "Graview Cloud"],
  ];
  return `<footer class="site-foot">
  <div class="site-foot-in">
    <nav class="foot-nav" aria-label="More of the site">
${links.map(([path, label]) => `      <a href="${href(base, path)}">${label}</a>`).join("\n")}
    </nav>
    <p>This site is a Graview app: <a href="${href(base, "docs/site.html")}">open it</a> &middot; <a href="${DECLARATION}">its declaration</a>. Planned and built with <a href="https://n-dx.dev">n-dx</a>.</p>
    <p>Graview is made by <a href="https://endash.us">En&nbsp;Dash</a>, Richmond, VA, and across the US.</p>
  </div>
</footer>`;
}

/** The markers a hand-designed page carries each part between. */
export const MARKERS = {
  head: ["<!-- site-head:start — written by scripts/site-chrome.mjs from apps/site/chrome.mjs. -->", "<!-- site-head:end -->"],
  header: ["<!-- site-header:start — written by scripts/site-chrome.mjs from apps/site/chrome.mjs. -->", "<!-- site-header:end -->"],
  footer: ["<!-- site-footer:start — written by scripts/site-chrome.mjs from apps/site/chrome.mjs. -->", "<!-- site-footer:end -->"],
};
