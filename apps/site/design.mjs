/**
 * GRAVIEW.DEV'S DESIGN: every page the site serves, written from records.
 *
 * The site is a Graview app (`apps/site/app.json`). Its records — a page per
 * address, and the packages, skills, check findings, commands, recipes,
 * chapters and questions those pages are about — are written out of the
 * repository by `scripts/site-docs.mjs`, and each page is rendered by
 * `renderPlace` from `@graview/pages/static` with this design: the way a
 * product hands the routed face its own pages, without React. A page record
 * names which of the designs below writes it (`design`); the docs pages
 * share one shell, the landing page, the tour and the long version are hand
 * designed (`apps/site/pages/`) and filled from records where they say what
 * the tree says, and llms.txt, the sitemap and the rest are records too.
 *
 * Nothing here reads the repository. What a page says about a package, a
 * skill or a recipe is that record's; what it says around them is the
 * design's own prose, the reason the repository is shaped the way it is.
 */
import { createHash } from "node:crypto";

/** The address the site is served at, and the one every canonical, card and twin names. */
export const SITE = "https://graview.dev";
export const REPOSITORY = "https://github.com/en-dash-consulting/graview";
const LICENSE = "https://www.elastic.co/licensing/elastic-license";
/** The declaration this site is, in the repository. */
export const DECLARATION = `${REPOSITORY}/blob/main/apps/site/app.json`;

/** What Graview is, in the words every page that has to say it uses. */
const DEFINITION = "a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration";

/* ── the smallest markdown that these files actually use ──────────────── */

export const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    /*
     * `.inl` on every link in prose, because a bare inline anchor is an
     * eighteen-pixel target and the floor is twenty-four. The landing page
     * has had this class since it was audited; the generated pages did not,
     * and every one of them failed the same check on the same day they
     * appeared. A class the hand-written page needs, the written-out pages
     * need too — that is what makes them the same site.
     */
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="inl" href="$2">$1</a>');
}

/**
 * Markdown to HTML, for the subset these files use: headings, fenced code,
 * lists, tables, blockquotes and paragraphs. Not a markdown library — a
 * renderer for the documents in this repository, which a test reads back.
 */
export function render(markdown) {
  const lines = markdown.split("\n");
  const out = [];
  let i = 0;
  const closeList = (kind) => { if (kind) out.push(`</${kind}>`); };
  let list = null;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      closeList(list); list = null;
      /* The fence's language goes on the code, where a reader that cannot
         see the page — a crawler, a model — learns what it is reading. */
      const lang = line.slice(3).trim() || "text";
      const fence = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) { fence.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<div class="code" data-scroller><pre><code class="language-${escape(lang)}">${escape(fence.join("\n"))}</code></pre></div>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList(list); list = null;
      const level = Math.min(6, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const number = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || number) {
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) { closeList(list); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((bullet ?? number)[1])}</li>`);
      i += 1;
      continue;
    }
    /*
     * A LIST ITEM THAT RUNS ONTO THE NEXT LINE is still that list item.
     * Markdown wraps them with an indent and no marker, and the first
     * version of this renderer read the second line as a new paragraph —
     * so every wrapped bullet in every README closed its own list and
     * printed its tail at the left margin, under the one it belonged to.
     * It looked like a styling fault and was a parsing one.
     */
    if (list !== null && /^\s+\S/.test(line)) {
      const last = out.length - 1;
      out[last] = out[last].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      closeList(list); list = null;
      out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      i += 1;
      continue;
    }
    if (line.trim() === "") { closeList(list); list = null; i += 1; continue; }
    if (line.startsWith("|")) {
      closeList(list); list = null;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i += 1; }
      const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        `<div data-scroller class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    /*
     * ALWAYS TAKE THE LINE. The first version gathered a paragraph with a
     * `while` whose condition excluded the very line that got here — so a
     * `---` rule, which matches no branch above and is excluded below,
     * advanced nothing and the renderer spun for ever on the first README
     * that had one. A loop whose progress depends on a condition it did not
     * itself check is a loop that will eventually stop making progress.
     */
    const para = [lines[i]];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^[-*#>|]|^\d+\./.test(lines[i]) && !lines[i].startsWith("```")) {
      para.push(lines[i]); i += 1;
    }
    closeList(list); list = null;
    /* A horizontal rule is a rule, not a paragraph of three hyphens. */
    const text = para.join(" ").trim();
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) out.push("<hr>");
    else if (text) out.push(`<p>${inline(text)}</p>`);
  }
  closeList(list);
  return out.join("\n");
}

/* ── the same pages, for a reader that is not a browser ───────────────── */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", rarr: "→", larr: "←", darr: "↓", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", middot: "·", mdash: "—", ndash: "–", hellip: "…",
};
const decode = (text) =>
  text.replace(/&(#\d+|[a-z]+);/g, (whole, name) => (name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : ENTITIES[name] ?? whole));
export const plain = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const absolute = (href, base) => new URL(decode(href), base).href;

/** A run of prose as Markdown: links made absolute, code, emphasis. */
export function inlineMd(html, base) {
  return decode(
    html
      .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => `[${text}](${absolute(href, base)})`)
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`")
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, "**$2**")
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, "*$2*")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\s+/g, " ").trim();
}

/**
 * A DOCS PAGE AS MARKDOWN, out of the very HTML the page is.
 *
 * A model reading the site wants the words, not the rail, the copy buttons
 * and a stylesheet the size of the page. Writing a second copy of each page
 * for it would be the one thing this site exists not to do, so the twin is
 * the page's own body read back: the subset of HTML these pages are made of
 * (headings, prose, lists, cards, tables, code, the terminal) and nothing
 * else. A live frame becomes a sentence saying it is there.
 */
export function toMarkdown(html, base) {
  const held = [];
  const hold = (md) => `\u0000${held.push(md) - 1}\u0000`;
  const items = (list) => [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, item]) => item);
  const s = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<button[\s\S]*?<\/button>/g, "")
    .replace(/<div class="chapter-live"[^>]*aria-label="([^"]*)"[^>]*>[\s\S]*?<\/div>/g, (_, label) => hold(`*${decode(label)}: a live demo, on the HTML page.*`))
    .replace(/<div class="code"[^>]*><pre><code(?: class="language-([\w+-]+)")?>([\s\S]*?)<\/code><\/pre><\/div>/g, (_, lang, code) => hold(`\`\`\`${lang ?? "text"}\n${decode(code)}\n\`\`\``))
    .replace(/<div class="term"[^>]*>((?:<div class="l">[\s\S]*?<\/div>)+)<\/div>/g, (_, lines) =>
      hold(`\`\`\`sh\n${[...lines.matchAll(/<div class="l">([\s\S]*?)<\/div>/g)].map(([, line]) => {
        const command = decode(/<span class="c2">([\s\S]*?)<\/span>/.exec(line)?.[1] ?? "");
        const note = /<span class="n2">([\s\S]*?)<\/span>/.exec(line)?.[1];
        return note ? `${command}  # ${decode(note)}` : command;
      }).join("\n")}\n\`\`\``))
    .replace(/<div class="cta-line">\s*<code>([\s\S]*?)<\/code>\s*<\/div>/g, (_, command) => hold(`\`\`\`sh\n${decode(command)}\n\`\`\``))
    .replace(/<table>([\s\S]*?)<\/table>/g, (_, table) => {
      const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
        [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => inlineMd(cell, base).replace(/\|/g, "\\|")));
      if (rows.length === 0) return "";
      return hold([rows[0], rows[0].map(() => "---"), ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n"));
    })
    .replace(/<ul class="cards">([\s\S]*?)<\/ul>/g, (_, list) =>
      hold([...list.matchAll(/<li><a href="([^"]*)"><strong>([\s\S]*?)<\/strong><span>([\s\S]*?)<\/span><\/a><\/li>/g)]
        .map(([, href, name, what]) => `- [${plain(name)}](${absolute(href, base)}): ${inlineMd(what, base)}`).join("\n")))
    .replace(/<ul class="names"[^>]*>([\s\S]*?)<\/ul>/g, (_, list) => hold(items(list).map((item) => inlineMd(item, base)).join(", ")))
    .replace(/<(ul|ol)(?: [^>]*)?>([\s\S]*?)<\/\1>/g, (_, kind, list) =>
      hold(items(list).map((item, n) => `${kind === "ol" ? `${n + 1}.` : "-"} ${inlineMd(item, base)}`).join("\n")))
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_, level, text) => hold(`${"#".repeat(Number(level))} ${inlineMd(text, base)}`))
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_, quote) => hold(`> ${inlineMd(quote, base)}`))
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/g, (_, para) => hold(inlineMd(para, base)))
    .replace(/<hr>/g, () => hold("---"));
  return `${[...s.matchAll(/\u0000(\d+)\u0000/g)].map(([, i]) => held[Number(i)]).filter(Boolean).join("\n\n")}\n`;
}

/* ── what a page says about itself ────────────────────────────────────── */

const SEO_START = "<!-- site-seo:start — written by scripts/site-docs.mjs. -->";
const SEO_END = "<!-- site-seo:end -->";
const SEO_BLOCK = /<!-- site-seo:start[\s\S]*?<!-- site-seo:end -->\n?/;
const RECIPES_START = "<!-- site-recipes:start — written by scripts/site-docs.mjs. -->";
const RECIPES_END = "<!-- site-recipes:end -->";
const RECIPES_BLOCK = /<!-- site-recipes:start[\s\S]*?<!-- site-recipes:end -->/;

/** JSON for a `<script>`: nothing in it can close the element it sits in. */
const ldScript = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 1).replace(/</g, "\\u003c")}\n</script>`;
export const metaOf = (html, name) => decode(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)">`).exec(html)?.[1] ?? "");
export const titleOf = (html) => decode(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "");

/** The landing page's questions and answers, read off the section a person reads. */
export function faqs(html) {
  const section = /<section id="faq"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  return [...section.matchAll(/<div class="qa">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g)].map(([, q, a]) => ({ question: plain(q), answer: a }));
}

/** Where a docs page sits, as the trail back to the home page reads. */
function trail(path, title) {
  const crumbs = [["Graview", `${SITE}/`], ["Docs", `${SITE}/docs/index.html`]];
  if (path.startsWith("packages/")) crumbs.push(["Packages", `${SITE}/docs/packages.html`]);
  if (path.startsWith("skills/")) crumbs.push(["Skills", `${SITE}/docs/skills.html`]);
  if (path.startsWith("recipes/")) crumbs.push(["Recipes", `${SITE}/docs/recipes.html`]);
  if (path !== "index.html") crumbs.push([title, `${SITE}/docs/${path}`]);
  return crumbs;
}

/** What a docs page says about itself to a search engine: an article, and where it sits. */
function articleData({ path, title, blurb }) {
  const url = `${SITE}/docs/${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: `${title} — Graview docs`,
        description: blurb,
        url,
        inLanguage: "en",
        image: `${SITE}/og.png`,
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${SITE}/#software` },
        publisher: { "@id": `${SITE}/#endash` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: trail(path, title).map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
      },
    ],
  };
}

/** The current release's version: every package shares it. */
const versionOf = (site) => site.records("release").find((r) => r.fields.current)?.fields.version ?? "";

/**
 * THE LANDING PAGE'S STRUCTURED DATA: the site, its publisher, the software
 * (as an application a person installs and as the source it is built
 * from), and the questions the page answers. Everything in it is read off
 * the page or the records — the description is the page's own, the version
 * is the current release's, the answers are the FAQ section's — so the
 * markup a search engine reads cannot claim what the page does not.
 */
function landingData(html, version) {
  const description = metaOf(html, "description");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Graview", description, inLanguage: "en", publisher: { "@id": `${SITE}/#endash` } },
      {
        "@type": "Organization", "@id": `${SITE}/#endash`, name: "En Dash", url: "https://endash.us",
        logo: { "@type": "ImageObject", url: `${SITE}/endash-mark.svg` },
        sameAs: ["https://github.com/en-dash-consulting"],
      },
      {
        "@type": "SoftwareApplication", "@id": `${SITE}/#software`, name: "Graview", description, url: `${SITE}/`,
        applicationCategory: "DeveloperApplication", operatingSystem: "Any platform with Node.js 22 or later",
        softwareVersion: version, license: LICENSE, isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        downloadUrl: "https://www.npmjs.com/package/graview", installUrl: `${SITE}/docs/getting-started.html`,
        softwareHelp: { "@type": "CreativeWork", url: `${SITE}/docs/index.html` },
        image: `${SITE}/og.png`, publisher: { "@id": `${SITE}/#endash` }, sameAs: [REPOSITORY],
      },
      {
        "@type": "SoftwareSourceCode", "@id": `${SITE}/#source`, name: "Graview", description,
        codeRepository: REPOSITORY, programmingLanguage: { "@type": "ComputerLanguage", name: "TypeScript" },
        runtimePlatform: "Node.js 22", license: LICENSE, version,
        targetProduct: { "@id": `${SITE}/#software` }, author: { "@id": `${SITE}/#endash` },
      },
      {
        "@type": "FAQPage", "@id": `${SITE}/#faq`, url: `${SITE}/`, isPartOf: { "@id": `${SITE}/#website` },
        mainEntity: faqs(html).map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: plain(answer) } })),
      },
    ],
  };
}

/** The tour and the long version are articles, one step from the home page. */
function articleOnTheSite(html, url, crumb) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle", "@id": `${url}#article`, headline: titleOf(html), description: metaOf(html, "description"), url,
        inLanguage: "en", image: `${SITE}/og.png`, isPartOf: { "@id": `${SITE}/#website` }, about: { "@id": `${SITE}/#software` },
        publisher: { "@id": `${SITE}/#endash` }, breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
        itemListElement: [["Graview", `${SITE}/`], [crumb, url]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
      },
    ],
  };
}

/** A page with its structured data written between its markers, which go just before `</head>` the first time. */
function withSeo(html, data) {
  const block = `${SEO_START}\n${ldScript(data)}\n${SEO_END}\n`;
  return SEO_BLOCK.test(html) ? html.replace(SEO_BLOCK, block) : html.replace("</head>", `${block}</head>`);
}

/* ── the records, as the pages read them ──────────────────────────────── */

const byField = (field) => (a, b) => (a.fields[field] < b.fields[field] ? -1 : a.fields[field] > b.fields[field] ? 1 : 0);
const byPosition = (a, b) => a.fields.position - b.fields.position;
const packagesOf = (site) => [...site.records("package")].sort(byField("dir"));
const skillsOf = (site) => [...site.records("skill")].sort(byField("dir"));
const codesOf = (site) => [...site.records("check")].sort((a, b) => a.fields.code.localeCompare(b.fields.code));
const commandsOf = (site) => [...site.records("command")].sort((a, b) => a.fields.name.localeCompare(b.fields.name));
const recipesOf = (site) => [...site.records("recipe")].sort(byPosition).map(recipeOf);
const questionsOf = (site) => [...site.records("question")].sort(byPosition);
const examplesOf = (site) => [...site.records("example")].sort(byField("dir"));
const pagesOf = (site) => site.records("page");
const docsPagesOf = (site) => pagesOf(site).filter((p) => p.fields.format === "html" && p.fields.path.startsWith("docs/"));

/** How many chapters the long version has, spelled, counted off its records. */
function chaptersSpelled(site) {
  return spelled(site.records("chapter").length);
}
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function spelled(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return String(n);
}

/** A recipe as its pages read it: its record, and what its declaration declares, out of the document it carries. */
function recipeOf(record) {
  const f = record.fields;
  const document = JSON.parse(f.document);
  const counts = Object.fromEntries((f.counts ?? []).map((pair) => {
    const at = pair.lastIndexOf("=");
    return [pair.slice(0, at), Number(pair.slice(at + 1))];
  }));
  return {
    slug: f.slug,
    title: f.title,
    task: f.task,
    blurb: f.blurb ?? "",
    prompt: f.prompt,
    name: f.name ?? document.name,
    description: f.summary ?? document.description,
    source: f.document,
    kinds: Object.entries(document.kinds ?? {}).map(([name, kind]) => ({
      name,
      plural: kind.plural ?? `${name}s`,
      fields: Object.keys(kind.fields ?? {}),
      edges: Object.entries(kind.edges ?? {}).map(([edge, spec]) => ({ name: edge, to: spec.to ?? [] })),
      count: counts[name] ?? 0,
    })),
    acts: Object.keys(document.acts ?? {}).length,
    rules: Object.entries(document.rules ?? {}).map(([name, rule]) => ({ name, ...rule, repairs: rule.repairs ?? [] })),
    records: f.records ?? 0,
    ties: f.relations ?? 0,
    check: f.check ?? [],
  };
}

/* ── the docs pages' shell ────────────────────────────────────────────── */

/** The rail, in order: the path under docs/ and what it says. */
const RAIL = [
  ["index.html", "Docs home"],
  ["getting-started.html", "Getting started"],
  ["recipes.html", "Recipes"],
  ["concepts.html", "Concepts"],
  ["packages.html", "Packages"],
  ["cli.html", "The CLI"],
  ["agents.html", "With a model"],
  ["skills.html", "Skills"],
  ["checks.html", "What check says"],
  ["demos.html", "Live demos"],
  ["stability.html", "Stability"],
  ["site.html", "This site, as an app"],
];

/**
 * Every docs page is the same document with different content in it. The
 * head comes off the landing page so the fonts, the icon and the color
 * scheme cannot drift; `..` gets the stylesheet and the mark right from one
 * directory down. What is the page's own — its title, its description, its
 * address, its card, its Markdown twin and its structured data — replaces
 * the landing page's, so no two pages on the site say the same thing about
 * themselves.
 */
function shell(landing, { path, title, blurb, here, body, scripts = [], data = "" }) {
  const HEAD_START = landing.indexOf("<!doctype html>");
  const HEAD_END = landing.indexOf('<a class="skip"');
  /* The Graview logo off the landing page's header: the kit's outlines, inline so it takes the page's ink. */
  const LOGO = /<a class="logo"[\s\S]*?<\/a>/.exec(landing)?.[0] ?? "";
  if (!LOGO) throw new Error("the landing page has no <a class=\"logo\"> in its header to put on the docs pages");
  const up = path.includes("/") ? "../.." : "..";
  const url = `${SITE}/docs/${path}`;
  const twin = path.split("/").pop().replace(/\.html$/, ".md");
  const meta = landing
    .slice(HEAD_START, HEAD_END)
    .replace(SEO_BLOCK, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)} — Graview docs</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(blurb)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(title)} — Graview docs">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(blurb)}">`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}">`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`)
    .replace("</head>", `<link rel="alternate" type="text/markdown" href="${twin}" title="This page as Markdown">\n${ldScript(articleData({ path, title, blurb }))}\n</head>`)
    // The site's own files (the face, the icons) are `brand/` at the root: `up` from here.
    .replaceAll('"brand/', `"${up}/brand/`);
  /* A package's or a skill's page is one directory down, so the nav's
     links to the docs root are one `../` longer there — a nav that forgot
     this sent every nested page's "Docs home" to a file that does not exist. */
  const docsRoot = up === ".." ? "" : "../";
  return `${meta}<a class="skip" href="#main">Skip to content</a>

<div class="wrap" lang="en">
  <nav class="rail" aria-label="Documentation">
    <div class="brand">
      ${LOGO.replace('href="index.html"', `href="${up}/index.html"`)}
      <span class="sub">Documentation</span>
    </div>

    <div class="jump">
${RAIL.map(([href, label]) => `      <a href="${docsRoot}${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
      <a href="${up}/tour.html">The tour</a>
      <a href="${up}/progression.html">The garden, grown</a>
      <a href="${up}/index.html">&larr; graview.dev</a>
    </div>

    <div class="railfoot">
      records of a Graview app,<br>
      written out of the repository,<br>
      never by hand
    </div>
  </nav>

  <main class="col" id="main" tabindex="-1">
${body}
  </main>
</div>

<footer>
  <p class="sm dim">
    Graview is built by <a href="https://endash.us">En&nbsp;Dash</a>, which also runs
    <a href="https://graview.cloud">Graview Cloud</a>, the hosted product built on it. This site is
    itself a Graview app: every page is a record of <a href="${DECLARATION}">its declaration</a>,
    written out of the repository by <code>node scripts/site-docs.mjs</code> and rendered by
    <code>renderPlace</code>, so nothing on it can disagree with the code it describes.
    <a href="${docsRoot}site.html">Open it as an app</a>.
  </p>
</footer>
<script>
/*
 * A REGION THAT SCROLLS NEEDS A WAY INTO IT.
 *
 * A code block narrower than its content scrolls sideways, and a keyboard
 * cannot reach it without a tab stop — axe calls it
 * scrollable-region-focusable, and at 320px every page with a wide code
 * sample failed it the day these pages appeared. The landing page has done
 * this since it was audited. Conditional, and re-asked on resize, because a
 * tab stop on something that does NOT scroll is a stop that goes nowhere.
 */
(function () {
  var scrollers = [].slice.call(document.querySelectorAll("[data-scroller]"));
  function mark() {
    scrollers.forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (scrolls) {
        el.setAttribute("tabindex", "0");
        /*
         * A REGION NEEDS A NAME, so only the ones that have one get the
         * role. Promoting every scrolling code block to a region put two
         * unnamed landmarks on the same page and axe said so — a landmark
         * a screen reader lists as "region, region" is worse than no
         * landmark, and the tab stop is what the keyboard actually needed.
         */
        if (el.getAttribute("aria-label")) el.setAttribute("role", "region");
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
      }
    });
  }
  mark();
  addEventListener("resize", mark);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mark);
})();

/* The same copy button the landing page has, and the same promise: where
   the clipboard is refused the command is still on the page, selectable. */
document.querySelectorAll("[data-copy]").forEach(function (button) {
  button.addEventListener("click", function () {
    var said = button.textContent;
    function done(word) {
      button.textContent = word;
      button.setAttribute("data-copied", "");
      setTimeout(function () { button.textContent = said; button.removeAttribute("data-copied"); }, 1600);
    }
    if (!navigator.clipboard) { done("Select it"); return; }
    navigator.clipboard.writeText(button.dataset.copy).then(
      function () { done("Copied"); },
      function () { done("Select it"); }
    );
  });
});
</script>
${data}${scripts.map((src) => `<script src="${src}"></script>`).join("\n")}
</body>
</html>
`;
}

const section = (id, heading, inner) =>
  `    <section id="${id}" aria-labelledby="h-${id}">\n      <div class="head"><span class="tick" aria-hidden="true"></span><h2 id="h-${id}">${escape(heading)}</h2></div>\n${inner}\n    </section>\n`;

const slug = (text) => text.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/* ── the docs pages ───────────────────────────────────────────────────── */

/**
 * Each docs page's body, by the design its record names. What a page says
 * about a package, a skill or a recipe is that record's fields; the prose
 * around it is the page's.
 */
const DOCS = {
  package(page, site) {
    const pkg = page.related("about")[0];
    const f = pkg.fields;
    const entries = [...pkg.related("exports")].sort(byPosition);
    const pkgs = packagesOf(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">${escape(f.name)}</h1>\n` +
      /* A plain definition first, the sentence an answer engine quotes; the package's own words after it. */
      `      <p class="lede" style="margin-top: 18px;"><code>${escape(f.name)}</code> is one of the ${pkgs.length} npm packages of Graview, ${DEFINITION}. ${inline(f.description ?? "")}</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>pnpm add ${escape(f.name)}</code>` +
      `<button type="button" class="copy" data-copy="pnpm add ${escape(f.name)}">Copy</button></div></div>\n` +
      (entries.length > 1
        ? `      <p class="sm dim" style="margin-top: 14px;">Entry points: ${entries.map((e) => `<code>${escape(e.fields.specifier)}</code>`).join(", ")}</p>\n`
        : "") +
      `    </section>\n` +
      (f.readme ? section("readme", "What it is", render(f.readme)) : "") +
      ((f.api ?? []).length
        ? section("api", `What it exports (${f.api.length})`,
            `      <p class="sm dim">Read off the package's own barrel, so this is what is there today.</p>\n` +
            `      <ul class="names">${f.api.map((n) => `<li><code>${escape(n)}</code></li>`).join("")}</ul>`)
        : "")
    );
  },

  skill(page, site) {
    const f = page.related("about")[0].fields;
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">${escape(f.name)}</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;"><code>${escape(f.name)}</code> is one of Graview's ${skillsOf(site).length} authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: ${inline(f.description ?? "")}</p>\n` +
      `      <p class="sm dim">Installed into a project by <code>graview skills install .</code>, and read by whichever assistant is working beside you.</p>\n` +
      `    </section>\n` +
      section("skill", "The skill", render(f.body ?? ""))
    );
  },

  packages(page, site) {
    const pkgs = packagesOf(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The packages</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Graview, ${DEFINITION}, ships as ${pkgs.length} npm packages at one version. <code>graview</code> is the tool a person installs; <code>@graview/*</code> is the framework a product imports, each package depending only on the ones beneath it.</p>\n` +
      `    </section>\n` +
      section("all", "All of them",
        `      <ul class="cards">\n` +
        pkgs.map((p) =>
          `        <li><a href="packages/${p.fields.dir}.html"><strong>${escape(p.fields.name)}</strong><span>${escape(p.fields.description ?? "")}</span></a></li>`,
        ).join("\n") + `\n      </ul>`)
    );
  },

  skills(page, site) {
    const sks = skillsOf(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The skills</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Graview's ${sks.length} skills are instructions an AI coding assistant reads before it writes a Graview app. Each teaches a model one shape of the declaration, and each ends in <code>graview check</code> — reporting what it actually said, rather than claiming the work is done.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>graview skills install .</code><button type="button" class="copy" data-copy="graview skills install .">Copy</button></div></div>\n` +
      `    </section>\n` +
      section("all", "All of them",
        `      <ul class="cards">\n` +
        sks.map((s) =>
          `        <li><a href="skills/${s.fields.dir}.html"><strong>${escape(s.fields.name)}</strong><span>${escape(s.fields.description ?? "")}</span></a></li>`,
        ).join("\n") + `\n      </ul>`)
    );
  },

  cli(page, site) {
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The CLI</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;"><code>graview</code> is Graview's command line: it starts a product, checks its declaration, writes its agent docs and serves its store. Every subcommand lives in the package whose concern it is: the generator and the checker in <code>@graview/core</code>, <code>serve</code> in <code>@graview/ship</code>, <code>skills</code> in <code>@graview/skills</code>. None of them needs a browser.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm install -g graview</code><button type="button" class="copy" data-copy="npm install -g graview">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">Or not at all: a project made by <code>graview create</code> has it as a devDependency, so <code>npx graview check</code> works from inside one, and <code>npx graview create</code> works from nowhere.</p></div>\n` +
      `    </section>\n` +
      commandsOf(site).map((c) => section(`cli-${c.fields.name}`, `graview ${c.fields.name}`,
        (c.fields.usage ? `      <div class="code" data-scroller aria-label="graview ${c.fields.name}, usage"><pre><code class="language-text">${escape(c.fields.usage)}</code></pre></div>\n` : "") +
        (c.fields.blurb ? `      <p>${inline(c.fields.blurb)}</p>` : ""),
      )).join("")
    );
  },

  checks(page, site) {
    const codes = codesOf(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">What <code>graview check</code> says</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;"><code>graview check</code> reads a Graview app's declaration without a browser and reports what is wrong with it, in words. It can say ${codes.length} things, read here out of the checker's own source. An <strong>error</strong> should fail your build. A <strong>warning</strong> is a judgment call. A <strong>note</strong> is a question worth answering once.</p>\n` +
      `    </section>\n` +
      ["error", "warning", "note"].map((severity) => {
        const mine = codes.filter((c) => c.fields.severity === severity);
        if (mine.length === 0) return "";
        return section(severity, `${mine.length} ${severity}${mine.length === 1 ? "" : "s"}`,
          `      <ul class="names">${mine.map((c) => `<li><code>${escape(c.fields.code)}</code></li>`).join("")}</ul>`);
      }).join("")
    );
  },

  /*
   * The one page that is prose. Everything else here is read out of the
   * repository; a concept is not in the repository — it is the reason the
   * repository is shaped the way it is, and nothing can generate that.
   * Each one links to the skill that teaches it, so the prose stays short
   * and the instructions stay in one place.
   */
  concepts(page, site) {
    const concepts = [...site.records("concept")].sort(byPosition);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Concepts</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">A Graview app is one declaration: a TypeScript object, made by <code>defineApp</code>, with seven things in it. Every surface in a Graview application is derived from some part of what is on this page.</p>\n` +
      `    </section>\n` +
      concepts.map((concept) => {
        const skill = concept.related("taughtBy")[0]?.fields.dir ?? "";
        return section(slug(concept.fields.title), concept.fields.title,
          `      <p>${inline(concept.fields.says)}</p>\n` +
          `      <p class="sm dim">Taught by <a class="inl" href="skills/${skill}.html"><code>${skill}</code></a>.</p>`,
        );
      }).join("")
    );
  },

  /* Starting a product: what the command asks, what it writes, what to do next. */
  "getting-started"(page, site) {
    const made = page.related("about")[0].fields;
    const create = commandsOf(site).find((c) => c.fields.name === "create");
    const scripts = (made.scripts ?? []).map((line) => {
      const at = line.indexOf(" = ");
      return [line.slice(0, at), line.slice(at + 3)];
    });
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Getting started</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Starting a product on Graview takes one command, <code>npm create graview</code>, which writes a running app for your own domain. Everything on this page below the command is read out of the generator that writes it, so it is what you will actually get.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm create graview@latest my-app</code><button type="button" class="copy" data-copy="npm create graview@latest my-app">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">Or <code>pnpm create graview my-app</code>, or <code>npx graview create my-app</code>. Node 22 or later.</p></div>\n` +
      `    </section>\n` +
      section("asks", "What it asks",
        `      <p>The directory is the only thing it needs; the rest has a default it says out loud. Give it the product's name and the first kind of thing your domain has — <code>--kind shift</code>, <code>--kind work-order</code> — and it writes chapter one for that domain rather than for a placeholder.</p>\n` +
        (create ? `      <div class="code" data-scroller aria-label="graview create, usage"><pre><code class="language-text">${escape(create.fields.usage)}</code></pre></div>` : "")) +
      section("writes", `What it writes (${made.files.length} files)`,
        `      <p>The declaration split into domain and UI, so the domain has no React in it and <code>graview check</code> can read it headless. <code>src/domain/</code> is the whole surface you will work in; the shell in <code>src/ui/</code> is eighty lines made of framework parts, and every one of them can be replaced.</p>\n` +
        `      <ul class="names" aria-label="The files graview create writes">${made.files.map((f) => `<li><code>${escape(f)}</code></li>`).join("")}</ul>\n` +
        `      <p class="sm dim" style="margin-top: 14px;">Dependencies: ${made.dependencies.map((d) => `<code>${escape(d)}</code>`).join(", ")}. Dev: ${made.devDependencies.map((d) => `<code>${escape(d)}</code>`).join(", ")}. No zod of your own — <code>@graview/core</code> re-exports <code>z</code>, so a kind's fields are built with exactly the copy the framework was built with.</p>`) +
      section("scripts", "The scripts it gives you",
        `      <div class="tablewrap"><table><thead><tr><th scope="col">Script</th><th scope="col">Runs</th></tr></thead><tbody>` +
        scripts.map(([name, cmd]) => `<tr><td><code>npm run ${escape(name)}</code></td><td><code>${escape(cmd)}</code></td></tr>`).join("") +
        `</tbody></table></div>\n` +
        `      <p class="sm" style="margin-top: 14px;"><strong>Start with <code>verify</code></strong> — typecheck, tests, build and <code>graview check</code>, in that order — and then <code>dev</code>: the scene at the root, the routed face at <code>/pages</code>.</p>`) +
      section("loop", "The loop from there",
        `      <p>Open a session beside the declaration. The skills are already installed where Claude Code and Codex look for them, and the first one to read is <a class="inl" href="skills/graview-node-kind.html"><code>graview-node-kind</code></a>. Describe a kind; let the model draft its fields, its edges, its acts and its rule; run <code>graview check</code>; look at the picture; declare more. The checker tells you both when a shape is wrong, in words, before a page does.</p>\n` +
        `      <ul class="cards">\n` +
        `        <li><a href="skills/graview-new-app.html"><strong>graview-new-app</strong><span>The shape of the declaration, the shell that comes for free, and the CI that keeps it honest.</span></a></li>\n` +
        `        <li><a href="skills/graview-node-kind.html"><strong>graview-node-kind</strong><span>Add a kind — fields, edges, label, plural, roles — and verify it with graview check.</span></a></li>\n` +
        `        <li><a href="skills/graview-invariant.html"><strong>graview-invariant</strong><span>A rule that names the acts that would repair it, then make it fire.</span></a></li>\n` +
        `        <li><a href="skills/graview-pages.html"><strong>graview-pages</strong><span>The routed face, from the derived pages to a design of your own.</span></a></li>\n` +
        `        <li><a href="skills/graview-ship.html"><strong>graview-ship</strong><span>Persistence, migrations, export and health, self-hosted or behind a service.</span></a></li>\n` +
        `      </ul>`) +
      section("one-release", "One release, run from the project",
        `      <p>Every <code>@graview/*</code> package and <code>graview</code> are one release: pin them all to the same version, and run <code>graview doctor</code> when something will not start — it says a pin, a lockfile, an install or a document that is on another release, and a <code>react</code> beside a <code>react-dom</code> of another version, which React refuses at startup with a blank page.</p>\n` +
        `      <p>Run the project's own <code>graview</code> (<code>node_modules/.bin/graview</code>, <code>pnpm exec graview</code>) rather than <code>npx -y graview@&lt;version&gt;</code>: inside a pnpm workspace that already holds that release in its hidden hoist, npx skips the install, finds no bin and says <code>sh: graview: command not found</code>.</p>\n` +
        `      <p>Holding only a document and a snapshot, <code>graview preview app.json --seed seed.json</code> draws the scene and Pages over them with nothing built, and <code>graview shots</code> photographs its places.</p>`) +
      section("checkout", "Working on the framework itself",
        `      <p>A product can consume a checkout of the framework by path instead of a registry, the way the first-party examples do: build the framework, then <code>pnpm graview create ../my-app --link .</code>. The project resolves every <code>@graview/*</code> import into the checkout's <code>dist/</code>, and its dev server rebuilds when the framework does.</p>\n` +
        `      <div class="term" data-scroller aria-label="Commands to work on the framework itself">` +
        `<div class="l"><span class="p">$</span><span class="c2">git clone https://github.com/en-dash-consulting/graview &amp;&amp; cd graview</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm install &amp;&amp; pnpm build</span><span class="n2">every package</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm graview create ../my-app --link . --name "My App" --kind thing</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm dev:seedbed</span><span class="n2">the garden — ?chapter=N opens any chapter</span></div>` +
        `</div>`)
    );
  },

  /* Working with a model: the second programming interface, and where each piece of it is documented. */
  agents(page, site) {
    const cmds = commandsOf(site);
    const pkgs = packagesOf(site);
    const sks = skillsOf(site);
    const describe = cmds.find((c) => c.fields.name === "describe");
    const docsCmd = cmds.find((c) => c.fields.name === "docs");
    const toolsPkg = pkgs.find((p) => p.fields.dir === "tools");
    const studioPkg = pkgs.find((p) => p.fields.dir === "studio");
    const skillsPkg = pkgs.find((p) => p.fields.dir === "skills");
    const skillCard = (name) => {
      const skill = sks.find((s) => s.fields.dir === name);
      return skill ? `        <li><a href="skills/${skill.fields.dir}.html"><strong>${escape(skill.fields.name)}</strong><span>${escape(skill.fields.description ?? "")}</span></a></li>\n` : "";
    };
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Working with a model</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">An AI agent uses a Graview app through the same declaration a person does: the same acts, as typed tools, under the same permissions and rules. A declaration is a context graph, and a context graph is the one thing a model reads as well as a person does. Graview has two programming interfaces over one declaration: the surfaces a person uses, and the tools, descriptions and skills a model uses. Neither can drift from the other, because both are derived.</p>\n` +
      `    </section>\n` +
      section("seat", "The seat",
        `      <p>An intelligence provider in the declaration says what a model may do and how words and pictures reach it. The seat gets the same acts a person has, narrowed by the same policy, and its turns land in the same operation log with an author and an intent — watchable from altitude, and undoable out of order. What comes back from a model is a plan before it is a change: one row per thing, what it was sure about, what goes with what if you decline something, then one batch with one undo.</p>\n` +
        `      <p>In the app, a person meets the model where the thing is. Right-click a record for what it picks from the acts, places and panels the app already has; press ⌘K to ask about what is selected, and the answer stands on a card beside it, a change it proposes waiting as a ghost until it is accepted. The host lends the model (<code>ai</code>), and with AI off none of it is drawn.</p>\n` +
        `      <figure class="shot"><img class="light" src="../img/quick-ask-light.png" width="1280" height="760" loading="lazy" alt="The todo example's scene with the task Pay the deposit selected and, beside it, an answer card proposing to mark it done, with Accept and Dismiss."><img class="dark" src="../img/quick-ask-dark.png" width="1280" height="760" loading="lazy" alt="The same answer card beside the selected task, in the dark scheme."><figcaption>The todo example, asked with ⌘K.</figcaption></figure>\n` +
        `      <ul class="cards">\n${skillCard("graview-agent-seat")}${skillCard("graview-permissions")}${skillCard("graview-desk")}      </ul>`) +
      section("tools", "Typed tools, derived",
        `      <p>${escape(toolsPkg?.fields.description ?? "")} Every act is a tool with a schema and a sentence attached; the tool surface is generated from the declaration and narrowed by the seat's role, so a model is never offered an act it may not take.</p>\n` +
        `      <p class="sm dim">The package: <a class="inl" href="packages/tools.html"><code>@graview/tools</code></a>.</p>`) +
      section("read", "What a model can read",
        `      <p><code>graview describe</code> reads the declaration out for something that cannot see: what a blank installation meets and in what order, what is drawn and what falls back, what a seat may do, how a model is reached, what is judged. <code>graview docs</code> writes an <code>llms.txt</code> and an <code>agents.md</code> beside the entry, derived, so they cannot drift.</p>\n` +
        (describe ? `      <div class="code" data-scroller aria-label="graview describe, usage"><pre><code class="language-text">${escape(describe.fields.usage)}</code></pre></div>\n` : "") +
        (docsCmd ? `      <div class="code" data-scroller aria-label="graview docs, usage" style="margin-top: 10px;"><pre><code class="language-text">${escape(docsCmd.fields.usage)}</code></pre></div>` : "")) +
      section("skills", `What a model reads before it writes (${sks.length} skills)`,
        `      <p>${escape(skillsPkg?.fields.description ?? "")} Installed into a product by <code>graview skills install .</code> — which <code>graview create</code> runs for you — into <code>.claude/skills</code> and <code>.agents/skills</code>, so Claude Code and Codex find the same instructions.</p>\n` +
        `      <ul class="cards">\n` + sks.map((sk) => skillCard(sk.fields.dir)).join("") + `      </ul>`) +
      section("studio", "The studio: a model edits the declaration itself",
        `      <p>${escape(studioPkg?.fields.description ?? "")}</p>\n` +
        `      <ul class="cards">\n${skillCard("graview-studio")}${skillCard("graview-seed")}      </ul>\n` +
        `      <p class="sm dim">The package: <a class="inl" href="packages/studio.html"><code>@graview/studio</code></a>.</p>`)
    );
  },

  /* The demos: the garden's surfaces, live, and the example apps. */
  demos(page, site) {
    const frame = (n, label, aria, extra = "") =>
      `      <div class="chapter-live" data-graview-chapter="${n}" data-label="${escape(label)}" role="region" aria-label="${escape(aria)}"${extra}><p class="chapter-loading">${escape(label)}, loading…</p></div>`;
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Live demos</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">These are live demos of Graview: the example garden, running in this page. Nothing here is a screenshot. Each frame is the example garden, mounted on this page by <code>@graview/embed</code> from the same declaration, at a different place in it. <a class="inl" href="../progression.html">The garden, grown</a> has all ${chaptersSpelled(site)} chapters, each with what the declaration gained.</p>\n` +
      `    </section>\n` +
      section("city", "The city, at altitude",
        `      <p>Every kind is a district; every record a building on its own plot; every edge a road with its words on it. Drag the ground, press a district, come down to a plot.</p>\n` + frame(16, "The garden, grown", "The example garden at altitude, live", ' data-stop="#overview=1" data-settle="1"')) +
      section("pages", "The routed face",
        `      <p>The same store as ordinary pages — here in the garden's own design: an almanac over the same acts, rules and log.</p>\n` + frame(13, "The garden's own face", "The garden's routed pages, live", ' data-face="pages"')) +
      section("studio", "The studio",
        `      <p>The declaration itself, open as a graph, edited with ordinary acts and checked before the change lands.</p>\n` + frame(15, "Seedbed, in the studio", "The declaration open in the studio, live", ' data-settle="0"')) +
      section("seat", "A seat for an agent",
        `      <p>The same acts a person has, narrowed by the same policy, attributed in the same log.</p>\n` + frame(5, "Seedbed, with a seat", "The garden with an agent's seat, live")) +
      section("apps", "The example apps",
        `      <p>Each was built to prove a claim the others could not, and each is opened in a real browser on every push. They live under <code>apps/</code> in the repository; <code>pnpm apps</code> opens the desk, which opens the rest.</p>\n` +
        `      <ul class="cards">\n` + examplesOf(site).map((app) => `        <li><a href="${REPOSITORY}/tree/main/apps/${app.fields.dir}"><strong>${escape(app.fields.dir)}</strong><span>${escape(app.fields.description ?? "")}</span></a></li>`).join("\n") + `\n      </ul>`) +
      /* The city and the lens settle the way the landing page's do: the city stepped back once, through the product's own controls. */
      SETTLE
    );
  },

  /*
   * What a version may change: `docs/stability.md`, the promise a host holds
   * a release to, as a page. Its own first heading is the page's h1.
   */
  stability(page) {
    const stability = page.fields.body ?? "";
    const stabilityTitle = /^#\s+(.*)\n/.exec(stability)?.[1] ?? "What a version may change";
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">${inline(stabilityTitle)}</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Graview's stability promise says what a release may change and what it may not. Every <code>@graview/*</code> package shares one version; this page is <code>docs/stability.md</code> in the repository.</p>\n` +
      `    </section>\n` +
      section("promise", "The promise", render(stability.replace(/^#\s+.*\n+/, "")))
    );
  },

  /*
   * A RECIPE: the prompt on the front page with a different task, and what
   * an agent made of it in Larkspur, a made-up repository. Everything on
   * the page is the recipe record's — its declaration, the counts of its
   * seed, and what `graview check --document` said about it — so a recipe's
   * page cannot describe a declaration it does not have.
   */
  recipe(page) {
    const r = recipeOf(page.related("about")[0]);
    const kindsTable =
      `      <div class="tablewrap" data-scroller aria-label="The kinds the ${escape(r.task)} recipe declares"><table>\n` +
      `        <tr><th>Kind</th><th>Fields</th><th>Relations</th><th>Records in the seed</th></tr>\n` +
      r.kinds.map((k) => `        <tr><td><code>${escape(k.name)}</code></td><td>${k.fields.map((f) => `<code>${escape(f)}</code>`).join(", ")}</td><td>${k.edges.length ? k.edges.map((e) => `<code>${escape(e.name)}</code> to ${e.to.map((t) => `<code>${escape(t)}</code>`).join(", ")}`).join("; ") : "none"}</td><td>${k.count}</td></tr>`).join("\n") +
      `\n      </table></div>`;
    const rulesList =
      `      <ul>\n` +
      r.rules.map((rule) => `        <li><b>${escape(rule.title)}.</b> Over each ${escape(rule.over)}${rule.when ? `, when <code>${escape(rule.when)}</code>` : ""}: requires <code>${escape(rule.require)}</code>. ${rule.repairs.length ? `Repaired by ${rule.repairs.map((x) => `“${escape(x.label ?? x.act)}” (<code>${escape(x.act)}</code>)`).join(" or ")}.` : "No repair."}</li>`).join("\n") +
      `\n      </ul>`;
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">${escape(r.title)}</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">This recipe is what an agent made of one prompt, in a repository it had never seen. ${escape(r.blurb)}</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>${escape(r.prompt)}</code><button type="button" class="copy" data-copy="${escape(r.prompt)}">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">Paste it into Claude Code, Codex or Cursor at the root of your repository. <a class="inl" href="../../start.md">start.md</a> is the page the agent reads.</p></div>\n` +
      `    </section>\n` +
      section("live", "The app, running",
        `      <p>This is the declaration below, compiled in your browser by the same compiler <code>graview check</code> uses, over the seed below. Press a district; open the problems; take a repair.</p>\n` +
        `      <div class="chapter-live" data-graview-recipe="${r.slug}" data-label="${escape(r.name)}" role="region" aria-label="${escape(`The app the ${r.task} prompt made, live`)}"><p class="chapter-loading">${escape(r.title)}, loading…</p></div>`) +
      section("declared", "What the agent declared",
        `      <p><b>${escape(r.name)}</b>: ${escape(r.description)} ${r.kinds.length} kinds, ${r.acts} acts and ${r.rules.length} rules, each rule with the act that repairs it.</p>\n` +
        kindsTable + `\n` + `      <h3>The rules</h3>\n` + rulesList) +
      section("checked", "What graview check says",
        `      <p>Run on every push, against the committed file:</p>\n` +
        `      <div class="term" data-scroller aria-label="graview check on the ${escape(r.task)} recipe"><div class="l"><span class="p">$</span> <span class="c2">npx graview check --document app.json</span></div>${r.check.map((line) => `<div class="l"><span class="c2">${escape(line)}</span></div>`).join("")}</div>\n` +
        (r.check.some((line) => line.startsWith("·")) ? `      <p class="sm dim">A line starting with a dot is a note, not a warning: advice the checker leaves for a person to weigh.</p>\n` : "")) +
      section("made", "How it was made",
        `      <p>An agent was given the prompt above and nothing else, at the root of Larkspur: a booking service for small clinics that does not exist, written as a TypeScript monorepo the size of a real one, with sixteen modules, guides and runbooks with gaps, a CODEOWNERS that misses some, fourteen decision records and pinned dependencies. It followed <a class="inl" href="../../start.md">start.md</a>, scaffolded, declared, ran <code>graview check</code> until it was clean, opened <code>graview preview</code> and reported back. The two files it wrote are committed as they came out of that run.</p>\n` +
        `      <p>CI does not run an agent. On every push it checks the committed declaration with <code>graview check --document</code>, loads the seed into a store, and opens this page in a browser to see the app mount. To run the prompt again yourself:</p>\n` +
        `      <div class="code" data-scroller aria-label="Running the recipe again"><pre><code class="language-sh">node scripts/fixtures/recipes/larkspur.mjs larkspur\ncd larkspur &amp;&amp; git init -q &amp;&amp; git add -A &amp;&amp; git commit -qm larkspur\n# then paste the prompt into your agent</code></pre></div>\n` +
        `      <p class="sm dim">The files: <a class="inl" href="../../recipes/${r.slug}/app.json"><code>app.json</code></a> and <a class="inl" href="../../recipes/${r.slug}/seed.json"><code>seed.json</code></a> (${r.records} records and ${r.ties} relations).</p>`) +
      section("declaration", "The declaration, in full",
        `      <div class="code" data-scroller aria-label="The ${escape(r.task)} recipe's app.json" style="max-height: 560px; overflow: auto;"><pre><code class="language-json">${escape(r.source.trimEnd())}</code></pre></div>`)
    );
  },

  recipes(page, site) {
    const rcps = recipesOf(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Recipes</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">A recipe is one prompt to hand your agent, with a different task each, and the app an agent made of it. Each was made from the prompt alone in Larkspur, a made-up repository, and each runs on its page.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>${escape(rcps[0].prompt)}</code><button type="button" class="copy" data-copy="${escape(rcps[0].prompt)}">Copy</button></div></div>\n` +
      `    </section>\n` +
      section("list", "The recipes",
        `      <ul class="cards">\n` + rcps.map((r) => `        <li><a href="recipes/${r.slug}.html"><strong>${escape(r.title)}</strong><span>${escape(r.blurb)}</span></a></li>`).join("\n") + `\n      </ul>`)
    );
  },

  "docs-home"(page, site) {
    const CHAPTERS = chaptersSpelled(site);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Documentation</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">This is the documentation for Graview, ${DEFINITION}. Everything here except the concepts is written out of the repository, so none of it can disagree with the code it describes.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm create graview@latest my-app</code><button type="button" class="copy" data-copy="npm create graview@latest my-app">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">New here? <a class="inl" href="getting-started.html">Getting started</a> is the first hour; <a class="inl" href="../progression.html">the garden, grown</a> is the whole framework in ${CHAPTERS} live steps.</p></div>\n` +
      `    </section>\n` +
      section("map", "Where things are",
        `      <ul class="cards">\n` +
        `        <li><a href="getting-started.html"><strong>Getting started</strong><span>One command to a running product, what it writes, and the loop from there.</span></a></li>\n` +
        `        <li><a href="recipes.html"><strong>Recipes</strong><span>One prompt for your agent, a different task each, and the app it made, live.</span></a></li>\n` +
        `        <li><a href="../tour.html"><strong>The tour</strong><span>Every surface Graview derives from one declaration, each beside a live frame.</span></a></li>\n` +
        `        <li><a href="concepts.html"><strong>Concepts</strong><span>The declaration, and the seven things in it.</span></a></li>\n` +
        `        <li><a href="agents.html"><strong>Working with a model</strong><span>The seat, the typed tools, what a model reads, and the studio.</span></a></li>\n` +
        `        <li><a href="demos.html"><strong>Live demos</strong><span>Every surface of the garden, running on the page, and the example apps.</span></a></li>\n` +
        `        <li><a href="packages.html"><strong>Packages (${packagesOf(site).length})</strong><span>What each ships and what each exports.</span></a></li>\n` +
        `        <li><a href="skills.html"><strong>Skills (${skillsOf(site).length})</strong><span>What your assistant reads before it writes.</span></a></li>\n` +
        `        <li><a href="cli.html"><strong>The CLI</strong><span>create, check, types, docs, describe, lens, figure, serve, skills.</span></a></li>\n` +
        `        <li><a href="checks.html"><strong>What check says (${codesOf(site).length})</strong><span>Every finding, and how loudly.</span></a></li>\n` +
        `        <li><a href="stability.html"><strong>Stability</strong><span>What a version may change, and what a host can hold it to.</span></a></li>\n` +
        `        <li><a href="../progression.html"><strong>The garden, grown</strong><span>${CHAPTERS[0].toUpperCase() + CHAPTERS.slice(1)} live chapters, from one kind to a product.</span></a></li>\n` +
        `        <li><a href="site.html"><strong>This site, as an app</strong><span>graview.dev is a Graview app: its pages are records, and its city is one click away.</span></a></li>\n` +
        `      </ul>`)
    );
  },

  /*
   * THIS SITE, AS AN APP. graview.dev is a Graview app: the declaration in
   * apps/site/app.json and the records scripts/site-docs.mjs writes out of
   * the repository. This page says so, counts what it holds, and opens it
   * live — the city of its packages, skills and checks — from the very
   * document and records every other page on the site is rendered from.
   */
  site(page, site, { declaration: declared }) {
    const kinds = Object.entries(declared.kinds ?? {});
    const total = kinds.reduce((sum, [kind]) => sum + site.records(kind).length, 0);
    return (
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">This site is a Graview app</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">graview.dev is a Graview app: one declaration, <a class="inl" href="${DECLARATION}"><code>apps/site/app.json</code></a>, and ${total} records written out of the repository by <code>node scripts/site-docs.mjs</code>. Every page the site serves is one of those records, rendered as static HTML by <code>renderPlace</code> from <code>@graview/pages/static</code> in the site's own design, so a search engine and a model read plain pages, and none of them can say what the records do not.</p>\n` +
      `    </section>\n` +
      section("live", "The site, running",
        `      <p>This is that declaration, compiled in your browser by the same compiler <code>graview check</code> uses, over the same records the pages are rendered from: the city of its packages, skills, check findings and pages. Press a district; come down to a record; switch to its pages.</p>\n` +
        `      <div class="chapter-live" data-graview-document="site-app" data-graview-seed="site-records" data-stop="#overview=1" data-label="graview.dev" role="region" aria-label="graview.dev as a Graview app, live"><p class="chapter-loading">graview.dev, loading…</p></div>`) +
      section("declared", "What it declares",
        `      <p><b>${escape(declared.name ?? "graview.dev")}</b>: ${escape(declared.description ?? "")} ${kinds.length} kinds, each read out of the tree:</p>\n` +
        `      <div class="tablewrap" data-scroller aria-label="The kinds graview.dev declares"><table>\n` +
        `        <tr><th>Kind</th><th>What it is</th><th>Records</th></tr>\n` +
        kinds.map(([kind, spec]) => `        <tr><td><code>${escape(kind)}</code></td><td>${escape(spec.description ?? "")}</td><td>${site.records(kind).length}</td></tr>`).join("\n") +
        `\n      </table></div>`) +
      section("made", "How a page is made",
        `      <p><code>scripts/site-docs.mjs</code> reads the repository — each package's <code>package.json</code>, <code>README.md</code> and barrel, each skill's <code>SKILL.md</code>, the checker's source, the CLI's help, the recipes, the chapters — and writes a record for each, then a page record for every address graview.dev serves, related to what it is about. Each page record is rendered by <code>renderPlace</code> with the site's design, <code>apps/site/design.mjs</code>: a docs page in the docs shell, the front page, the tour and the long version filled into their hand-designed pages (<code>apps/site/pages/</code>), and <code>llms.txt</code>, <code>llms-full.txt</code>, the sitemap and <code>start.md</code> as records too. <code>tests/site.test.ts</code> holds every served address to a record, and the declaration to <code>graview check</code>.</p>\n` +
        `      <div class="code" data-scroller aria-label="Checking the declaration"><pre><code class="language-sh">npx graview check --document apps/site/app.json\nnode scripts/site-docs.mjs --check</code></pre></div>`)
    );
  },
};

const SETTLE = `    <script>
    document.addEventListener("graview:mounted", function (event) {
      var host = event.target;
      if (!(host instanceof Element) || !host.hasAttribute("data-settle")) return;
      var presses = Number(host.getAttribute("data-settle")) || 0;
      setTimeout(function () {
        for (var i = 0; i < presses; i += 1) { var out = host.querySelector('[data-testid="zoom-out"]'); if (out) out.click(); }
      }, 250);
    });
    </script>`;

/** The scripts a docs page loads after its own: the live frames, where it has any. */
function scriptsOf(design) {
  if (design === "demos" || design === "site") return ["../chapters.js"];
  if (design === "recipe") return ["../../chapters.js"];
  return [];
}

/* ── the hand-designed pages, filled from records ─────────────────────── */

/**
 * THE FRONT PAGE'S RECIPE ROWS, between their markers: each recipe's task,
 * the prompt, what it declared and where its proof is, from its record.
 */
function recipeRows(rcps) {
  const rows = rcps.map((r) =>
    `      <li class="recipe-row">\n` +
    `        <div>\n` +
    `          <h3>${escape(r.title)}</h3>\n` +
    `          <p class="recipe-prompt">${escape(r.prompt).replace(escape(`repo's ${r.task}`), `repo's <b>${escape(r.task)}</b>`)}</p>\n` +
    `        </div>\n` +
    `        <div>\n` +
    `          <p class="recipe-blurb">${escape(r.blurb)}</p>\n` +
    `          <dl>\n` +
    `            <dt>Kinds</dt><dd>${r.kinds.map((k) => escape(k.plural)).join(", ")}</dd>\n` +
    `            <dt>Rules</dt><dd>${r.rules.map((rule) => escape(rule.title)).join("; ")}</dd>\n` +
    `            <dt>Seed</dt><dd>${r.records} records and ${r.ties} relations, read out of Larkspur</dd>\n` +
    `            <dt>Check</dt><dd>${escape(r.check.some((line) => line.startsWith("!")) ? "warnings" : "clean, on every push")}</dd>\n` +
    `          </dl>\n` +
    `          <p class="recipe-links"><a href="docs/recipes/${r.slug}.html">Open it, live &rarr;</a><a href="recipes/${r.slug}/app.json">app.json</a><a href="recipes/${r.slug}/seed.json">seed.json</a></p>\n` +
    `        </div>\n` +
    `      </li>`);
  return (
    `${RECIPES_START}\n    <ol class="recipe-list">\n${rows.join("\n")}\n    </ol>\n` +
    `    <p class="sm dim recipes-note">How these were made: an agent ran each prompt once, with nothing but the prompt and <a class="inl" href="start.md">start.md</a>, at the root of Larkspur, a made-up repository written for the purpose (<code>scripts/fixtures/recipes/larkspur.mjs</code>). CI does not run an agent. On every push it checks the declaration that run produced, loads its seed, and opens each recipe&rsquo;s page in a browser to see the app mount.</p>\n    ${RECIPES_END}`
  );
}

/* ── for the crawlers and the models ──────────────────────────────────── */

const START_HERE = ["getting-started.html", "concepts.html", "agents.html", "cli.html", "checks.html", "stability.html", "index.html"];
const docsPath = (page) => page.fields.path.slice("docs/".length);
const twinOf = (path) => `${SITE}/docs/${path.replace(/\.html$/, ".md")}`;

/** The pages llms.txt lists, in the order it lists them, under the heading it lists them by. */
function sections(site) {
  const pages = new Map(docsPagesOf(site).map((page) => [docsPath(page), page]));
  const paths = [...pages.keys()];
  return [
    ["Start here", START_HERE.filter((p) => pages.has(p))],
    ["Packages", ["packages.html", ...paths.filter((p) => p.startsWith("packages/")).sort()]],
    ["Skills", ["skills.html", ...paths.filter((p) => p.startsWith("skills/")).sort()]],
    ["Recipes", ["recipes.html", ...paths.filter((p) => p.startsWith("recipes/")).sort()]],
    ["Examples", ["demos.html", "site.html"].filter((p) => pages.has(p))],
  ].map(([heading, list]) => [heading, list.map((p) => pages.get(p))]);
}

function summary(site) {
  const answer = questionsOf(site).find((q) => q.fields.question === "What is Graview?");
  if (!answer) throw new Error("the front page has no “What is Graview?” in its FAQ section to summarize the site with");
  return `${answer.fields.answer} Graview Cloud (https://graview.cloud) is the hosted product built on it.`;
}

function preamble(site) {
  return [
    "# Graview",
    "",
    `> ${summary(site)}`,
    "",
    `- Start with an agent: ${SITE}/start.md is the procedure, written for the agent — hand it "Read ${SITE}/start.md, then turn this repo's docs into a Graview app."`,
    "- Start a product: `npm create graview@latest my-app` (Node 22 or later)",
    "- License: Elastic License 2.0 — source-available, free to build with and to ship products on",
    `- Source: ${REPOSITORY}`,
    `- npm: https://www.npmjs.com/package/graview — ${packagesOf(site).length} packages, one version (${versionOf(site)})`,
    "- Hosted: Graview Cloud, https://graview.cloud (private alpha, invite-only)",
  ];
}

/* ── the design ───────────────────────────────────────────────────────── */

/**
 * THE SITE'S DESIGN, for `renderPlace`. `template(path)` reads a hand
 * designed page (`apps/site/pages/…`), `served(path)` what the site served
 * at an address before this run (the sitemap keeps a page's day when its
 * words have not moved), `today` the day it is, and `data` the declaration
 * and the records as JSON, which the page about this site carries so that
 * it opens live; `declaration` is that declaration, parsed.
 */
export function siteDesign({ template, served, today, declaration, data }) {
  const pageByPath = (site, path) => pagesOf(site).find((page) => page.fields.path === path);
  const landingTemplate = (site) => template(pageByPath(site, "index.html").fields.template);

  /** A docs page's body: what goes in its <main>. */
  const docsBody = (page, site) => {
    const write = DOCS[page.fields.design];
    if (!write) throw new Error(`apps/site/design.mjs has no docs page called "${page.fields.design}" for ${page.fields.path}`);
    return write(page, site, { declaration });
  };

  /** A docs page, whole. */
  const docsPage = (page, site) =>
    shell(landingTemplate(site), {
      path: docsPath(page),
      title: page.fields.title,
      blurb: page.fields.description ?? "",
      here: page.fields.rail ?? "",
      body: docsBody(page, site),
      scripts: scriptsOf(page.fields.design),
      data: page.fields.design === "site" ? data() : "",
    });

  /** A docs page as Markdown, for a model. */
  const twin = (page, site) => {
    const url = `${SITE}/${page.fields.path}`;
    return `${toMarkdown(docsBody(page, site), url).trimEnd()}\n\n---\n\n${page.fields.description ?? ""}\n\nThe page: ${url} · Every Graview docs page, for a model: ${SITE}/llms.txt\n`;
  };

  const landing = (page, site) => {
    const rcps = recipesOf(site);
    // The hero's tabs are written by hand: a recipe is one of them, the rota and the garden the others.
    const filled = template(page.fields.template).replace(RECIPES_BLOCK, recipeRows(rcps));
    return withSeo(filled, landingData(filled, versionOf(site)));
  };

  const HAND = {
    landing,
    tour: (page) => {
      const html = template(page.fields.template);
      return withSeo(html, articleOnTheSite(html, `${SITE}/tour.html`, "The tour"));
    },
    progression: (page) => {
      const html = template(page.fields.template);
      return withSeo(html, articleOnTheSite(html, `${SITE}/progression.html`, "The garden, grown"));
    },
    missing: (page) => template(page.fields.template),
    start: (page) => page.fields.body ?? "",

    /**
     * llms.txt (llmstxt.org): what Graview is, and every docs page with the
     * one line it says about itself, linked to its Markdown twin. Written
     * from the page records, so it lists exactly the pages there are.
     */
    llms: (page, site) => {
      const line = (p) => `- [${p.fields.title}](${twinOf(docsPath(p))}): ${p.fields.description ?? ""}`;
      const out = [
        ...preamble(site),
        "",
        `Every page below is also a web page (drop the \`.md\` for the \`.html\`); [llms-full.txt](${SITE}/llms-full.txt) is all of them in one file.`,
      ];
      for (const [heading, pages] of sections(site)) {
        out.push("", `## ${heading}`, "", ...pages.map(line));
        if (heading === "Examples") {
          for (const path of ["tour.html", "progression.html"]) {
            const hand = pageByPath(site, path);
            out.push(`- [${hand.fields.title}](${SITE}/${path}): ${hand.fields.description ?? ""}`);
          }
          out.push(...examplesOf(site).map((app) => `- [apps/${app.fields.dir}](${REPOSITORY}/tree/main/apps/${app.fields.dir}): ${app.fields.description ?? ""}`));
        }
      }
      const questions = questionsOf(site);
      const cloud = questions.find((q) => q.fields.question === "What is Graview Cloud?");
      out.push("", "## Graview Cloud", "", `- [Graview Cloud](https://graview.cloud): ${cloud ? cloud.fields.answer : "The hosted product built on Graview."}`);
      out.push("", "## Optional", "", `- [Questions, answered plainly](${SITE}/#faq): ${questions.map((q) => q.fields.question).join(" ")}`, `- [llms-full.txt](${SITE}/llms-full.txt): every docs page above, in full, as Markdown`);
      return `${out.join("\n")}\n`;
    },

    /** llms-full.txt: the same preamble, the questions, then every page's twin in llms.txt's order. */
    "llms-full": (page, site) => {
      const out = [...preamble(site), "", "## Questions, answered plainly", ""];
      for (const q of questionsOf(site)) out.push(`### ${q.fields.question}`, "", q.fields.answer ?? "", "");
      for (const [, pages] of sections(site)) {
        for (const p of pages) out.push("---", "", `Source: ${SITE}/${p.fields.path}`, "", twin(p, site).trimEnd(), "");
      }
      return `${out.join("\n").trimEnd()}\n`;
    },

    /*
     * ROBOTS: every crawler may read every page. The AI crawlers are named
     * anyway, in a group of their own, so that a default somewhere else — a
     * host's, a CDN's — that shuts them out does not get the last word on a
     * site that wants to be found by them.
     */
    robots: () =>
      [
        "# graview.dev — written by scripts/site-docs.mjs. Every page is for reading.",
        "User-agent: *",
        "Allow: /",
        "",
        "# Answer engines and AI crawlers, named so that no default elsewhere shuts them out.",
        ...AI_CRAWLERS.map((bot) => `User-agent: ${bot}`),
        "Allow: /",
        "",
        `Sitemap: ${SITE}/sitemap.xml`,
        `# For language models: ${SITE}/llms.txt (an index) and ${SITE}/llms-full.txt (every docs page in full).`,
        "",
      ].join("\n"),

    /**
     * THE SITEMAP, with the day each page last changed. Not the build's
     * date — every page would claim to change every build — and not git's,
     * which cannot be known until the very commit that would carry it. Each
     * entry keeps a short hash of the page's <main>: a page whose words are
     * the same keeps its date, and a page whose words moved takes today's.
     */
    sitemap: (page, site) => {
      const previous = served(page.fields.path);
      const before = new Map([...previous.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><!-- ([0-9a-f]+) --><\/url>/g)].map(([, loc, day, hash]) => [loc, { day, hash }]));
      const listed = [
        pageByPath(site, "index.html"),
        pageByPath(site, "progression.html"),
        pageByPath(site, "tour.html"),
        ...docsPagesOf(site).sort((a, b) => (a.fields.path < b.fields.path ? -1 : 1)),
      ];
      const urls = listed.map((p) => {
        const loc = p.fields.path === "index.html" ? `${SITE}/` : `${SITE}/${p.fields.path}`;
        const hash = hashOf(write(p, site));
        const day = before.get(loc)?.hash === hash ? before.get(loc).day : today;
        return `  <url><loc>${loc}</loc><lastmod>${day}</lastmod><!-- ${hash} --></url>`;
      });
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    },
  };

  /** Any page record, whole, as it is served. */
  const write = (page, site) => (HAND[page.fields.design] ?? docsPage)(page, site);

  return {
    /** The page as it is served at its address. */
    page: {
      records: { page: (page, site) => write(page, site) },
      document: (rendered) => rendered.main,
    },
    /** A docs page's Markdown twin, served beside it. */
    twin: {
      records: { page: (page, site) => twin(page, site) },
      document: (rendered) => rendered.main,
    },
  };
}

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];
const mainOf = (html) => /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? html;
const hashOf = (html) => createHash("sha256").update(mainOf(html)).digest("hex").slice(0, 12);
