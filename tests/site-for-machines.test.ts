import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * GRAVIEW.DEV, AS A CRAWLER, AN ANSWER ENGINE AND A MODEL READ IT.
 *
 * A person sees the page. Everything else that reads the site sees its head,
 * its structured data, its sitemap, its robots.txt and its llms.txt — and
 * nobody looks at any of those after the day they are written, so they are
 * exactly what goes quietly wrong: a page missing from the sitemap, a
 * description copied onto forty pages, an FAQ in the markup that the page
 * no longer says, a link to a page that moved. Each claim here is one a
 * reader that cannot see the page relies on.
 *
 * The files are written by scripts/site-docs.mjs (and the counts by
 * site-numbers.mjs); a failure here means run `pnpm site:build:all`, or
 * that a hand-written page broke a promise below.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = resolve(repoRoot, "docs/site");
const SITE = "https://graview.dev";
const read = (file: string) => readFileSync(resolve(SITE_DIR, file), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [relative(SITE_DIR, path)];
  });
}
const everyFile = walk(SITE_DIR);
/** Every page a person can land on: not the 404, not the narrow-width fixture. */
const pages = everyFile.filter((f) => f.endsWith(".html") && f !== "404.html" && !f.startsWith("_"));
const docsPages = pages.filter((f) => f.startsWith("docs/"));
const urlOf = (file: string) => (file === "index.html" ? `${SITE}/` : `${SITE}/${file}`);
const fileOf = (url: string) => {
  const path = url.slice(SITE.length + 1);
  return path === "" ? "index.html" : path.endsWith("/") ? `${path}index.html` : path;
};
/** The page with its styles, scripts and comments gone: what it says. */
const textOf = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ");
const metaOf = (html: string, name: string) => new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(html)?.[1];
const ldOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json!) as { "@graph": Record<string, unknown>[] });
const nodesOf = (html: string) => ldOf(html).flatMap((data) => data["@graph"]);

describe("what a crawler reads off every page", () => {
  it("finds a language, a viewport, a theme color, a title, a description, a canonical address and a card on every page", () => {
    for (const file of pages) {
      const html = read(file);
      expect(html, file).toMatch(/^<!doctype html>\n<html lang="en">/);
      expect(html, file).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
      expect(html, file).toContain('<meta name="theme-color"');
      // One <title> in the head; an inline SVG's own <title> is its accessible name, not the page's.
      expect(html.slice(0, html.indexOf("</head>")).match(/<title>/g), file).toHaveLength(1);
      expect(metaOf(html, "description")?.length ?? 0, file).toBeGreaterThan(40);
      expect(html, file).toContain(`<link rel="canonical" href="${urlOf(file)}">`);
      expect(metaOf(html, "og:url"), file).toBe(urlOf(file));
      expect(metaOf(html, "og:title"), file).toBeTruthy();
      expect(metaOf(html, "og:description"), file).toBeTruthy();
      expect(metaOf(html, "og:image"), file).toBe(`${SITE}/og.png`);
      expect(metaOf(html, "twitter:card"), file).toBe("summary_large_image");
      expect(html, file).not.toContain('name="robots" content="noindex"');
    }
  });

  it("gives no two pages the same title or the same description", () => {
    const titles = pages.map((f) => /<title>([\s\S]*?)<\/title>/.exec(read(f))?.[1]);
    const descriptions = pages.map((f) => metaOf(read(f), "description"));
    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
  });

  it("keeps the page for a missing address out of the index", () => {
    const missing = read("404.html");
    expect(missing).toContain('<meta name="robots" content="noindex">');
    expect(missing).not.toContain('rel="canonical"');
  });

  it("finds one h1 on every page, a language on every code block and words for every picture", () => {
    for (const file of pages) {
      const html = read(file).replace(/<style[\s\S]*?<\/style>/g, "");
      expect(html.match(/<h1[\s>]/g), file).toHaveLength(1);
      for (const block of html.match(/<pre><code[^>]*>/g) ?? []) expect(block, file).toMatch(/class="language-[\w+-]+"/);
      for (const img of html.match(/<img\b[^>]*>/g) ?? []) expect(img, file).toMatch(/\salt="/);
    }
  });

  it("opens every docs page with a sentence that says what its subject is", () => {
    for (const file of docsPages) {
      const lede = /<p class="lede"[^>]*>([\s\S]*?)<\/p>/.exec(read(file))?.[1] ?? "";
      expect(textOf(lede), file).toMatch(/\b(is|are|takes)\b/);
    }
  });
});

describe("what an answer engine reads in the structured data", () => {
  it("parses on every page that has it, and every page has it", () => {
    for (const file of pages) expect(ldOf(read(file)).length, file).toBeGreaterThan(0);
  });

  it("describes Graview on the landing page as the software, its source, its publisher and its site", () => {
    const nodes = nodesOf(read("index.html"));
    const of = (type: string) => nodes.find((n) => n["@type"] === type);
    expect(of("WebSite")).toMatchObject({ url: `${SITE}/`, name: "Graview" });
    expect(of("Organization")).toMatchObject({ name: "En Dash", url: "https://endash.us" });
    expect(of("SoftwareApplication")).toMatchObject({
      name: "Graview",
      license: "https://www.elastic.co/licensing/elastic-license",
      offers: { price: "0" },
    });
    expect(of("SoftwareSourceCode")).toMatchObject({
      codeRepository: "https://github.com/en-dash-consulting/graview",
      programmingLanguage: { name: "TypeScript" },
      license: "https://www.elastic.co/licensing/elastic-license",
    });
    const version = JSON.parse(readFileSync(resolve(repoRoot, "packages/graview/package.json"), "utf8")).version;
    expect(of("SoftwareApplication")?.["softwareVersion"]).toBe(version);
  });

  it("asks the landing page's FAQ only the questions the page asks, and answers them in its words", () => {
    const html = read("index.html");
    const section = /<section id="faq"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    const asked = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(([, q, a]) => [textOf(q!).trim(), textOf(a!).trim()]);
    expect(asked.length).toBeGreaterThanOrEqual(4);
    const faq = nodesOf(html).find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(asked.map(([q]) => q));
    faq.mainEntity.forEach((q, i) => {
      // The markup keeps the page's punctuation; the comparison is of the words.
      const words = (text: string) => text.replace(/[^\w@-]+/g, " ").trim();
      expect(words(q.acceptedAnswer.text)).toBe(words(asked[i]![1]!));
    });
  });

  it("makes every docs page an article with the trail back to the home page", () => {
    for (const file of docsPages) {
      const nodes = nodesOf(read(file));
      const article = nodes.find((n) => n["@type"] === "TechArticle");
      const trail = nodes.find((n) => n["@type"] === "BreadcrumbList") as { itemListElement: { item: string; position: number }[] };
      expect(article?.["url"], file).toBe(urlOf(file));
      expect(article?.["description"], file).toBe(metaOf(read(file), "description")?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
      expect(trail.itemListElement[0]?.item, file).toBe(`${SITE}/`);
      expect(trail.itemListElement.at(-1)?.item, file).toBe(urlOf(file));
    }
  });
});

describe("what a model reads", () => {
  const llms = read("llms.txt");
  const full = read("llms-full.txt");

  it("finds an llms.txt in the llmstxt.org shape: a name, a summary, then sections of links", () => {
    expect(llms).toMatch(/^# Graview\n\n> Graview is /);
    expect(llms).toContain("https://graview.cloud");
    expect(llms).toContain("Elastic License 2.0");
    expect(llms).toContain("npm create graview@latest my-app");
    expect(llms.match(/^## /gm)?.length).toBeGreaterThanOrEqual(4);
  });

  it("lists every docs page in llms.txt, as its Markdown twin, once", () => {
    for (const file of docsPages) {
      const twin = `${urlOf(file).replace(/\.html$/, ".md")})`;
      expect(llms.split(twin).length - 1, file).toBe(1);
      expect(existsSync(resolve(SITE_DIR, file.replace(/\.html$/, ".md"))), file).toBe(true);
      expect(read(file), file).toContain('<link rel="alternate" type="text/markdown"');
    }
    expect(llms).toContain(`${SITE}/progression.html`);
  });

  it("carries every docs page in full in llms-full.txt, as Markdown and not as markup", () => {
    for (const file of docsPages) expect(full, file).toContain(`Source: ${urlOf(file)}\n`);
    // Code samples keep their angle brackets; the page's own markup must not come along.
    const prose = full.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    expect(prose).not.toMatch(/<(div|section|span|nav|main|button)\b[^>]*>/);
    expect(prose).not.toMatch(/<a class="inl"|data-scroller|aria-label=/);
  });

  it("links only to pages that exist, from llms.txt, llms-full.txt and every twin", () => {
    const sources = ["llms.txt", "llms-full.txt", ...everyFile.filter((f) => f.endsWith(".md") && f.startsWith("docs/"))];
    for (const source of sources) {
      for (const [, url] of read(source).matchAll(/\]\((https:\/\/graview\.dev\/[^)#\s]*)/g)) {
        expect(existsSync(resolve(SITE_DIR, fileOf(url!))), `${source} → ${url}`).toBe(true);
      }
    }
  });
});

describe("what the crawlers are told", () => {
  it("lets every crawler read everything, and names the AI crawlers, the sitemap and llms.txt", () => {
    const robots = read("robots.txt");
    expect(robots).not.toMatch(/^Disallow:\s*\S/m);
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/$/m);
    for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"]) {
      expect(robots, bot).toContain(`User-agent: ${bot}\n`);
    }
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).toContain(`${SITE}/llms.txt`);
  });

  it("lists every page in the sitemap, at its own address, with the day it last changed — and nothing else", () => {
    const sitemap = read("sitemap.xml");
    const listed = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map(([, loc]) => loc!);
    expect(listed.length).toBe(sitemap.match(/<url>/g)?.length);
    expect([...listed].sort()).toEqual(pages.map(urlOf).sort());
  });
});

describe("what the pages link to", () => {
  /**
   * EVERY LINK ON THE SITE LANDS. Relative links between the landing page,
   * the long version and forty docs pages one and two directories down are
   * exactly the kind that break on a move, and a crawler that meets a 404
   * stops trusting the rest. A fragment must name an id on its page.
   */
  it("has no broken internal link or fragment on any page", () => {
    const ids = new Map<string, Set<string>>();
    const idsOf = (file: string) => {
      if (!ids.has(file)) ids.set(file, new Set([...read(file).matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id!)));
      return ids.get(file)!;
    };
    const broken: string[] = [];
    for (const file of [...pages, "404.html"]) {
      // Code samples are text: an `href` written inside one is not a link.
      const html = read(file).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<code[\s\S]*?<\/code>/g, "");
      for (const [, attr] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        const link = attr!;
        if (/^(https?:|mailto:|data:|javascript:)/.test(link)) continue;
        const [path, fragment] = link.split("#");
        const target = path === "" ? file : relative(SITE_DIR, resolve(SITE_DIR, dirname(file), link.startsWith("/") ? `.${path}` : path!));
        const resolved = link.startsWith("/") ? path!.slice(1) || "index.html" : target;
        if (!existsSync(resolve(SITE_DIR, resolved))) broken.push(`${file} → ${link}`);
        else if (fragment && resolved.endsWith(".html") && !idsOf(resolved).has(fragment)) broken.push(`${file} → ${link} (no #${fragment})`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("loads nothing from another site: every script, stylesheet and picture is the site's own", () => {
    for (const file of [...pages, "404.html"]) {
      const html = read(file);
      expect(html.match(/<script\b[^>]*\ssrc="https?:/g), file).toBeNull();
      expect(html.match(/<link\b[^>]*rel="(?:stylesheet|preload|modulepreload)"[^>]*href="https?:/g), file).toBeNull();
      expect(html.match(/<(?:img|iframe|video|audio|source)\b[^>]*\ssrc="https?:/g), file).toBeNull();
    }
  });
});

describe("what the site says about itself", () => {
  /**
   * The license is the Elastic License 2.0, and that is what the site says.
   * "Open source" names a different set of licenses; a page that says it
   * about this one is making a claim the license does not.
   */
  it("never calls Graview open source, or an open framework", () => {
    // brand/ holds the font's own license, which is the font's to word.
    for (const file of everyFile.filter((f) => /\.(html|md|txt|xml)$/.test(f) && !f.startsWith("brand/"))) {
      expect(textOf(read(file)), file).not.toMatch(/open[ -]source|open framework/i);
      // The head's descriptions and the structured data are what a search result shows.
      expect(read(file).replace(/<style[\s\S]*?<\/style>/g, ""), file).not.toMatch(/open[ -]source|open framework/i);
    }
  });

  it("counts packages, skills, lenses and chapters the way the tree does, in digits and in words", async () => {
    const numbers = (await import(pathToFileURL(resolve(repoRoot, "scripts/site-numbers.mjs")).href)) as {
      countOf: () => Record<string, number>;
      spelled: (n: number) => string;
    };
    const counts = numbers.countOf();
    const nouns: Record<string, string> = { packages: "packages", skills: "skills", lenses: "lenses", chapters: "chapters" };
    const words = Array.from({ length: 100 }, (_, n) => numbers.spelled(n));
    const said = new RegExp(`\\b(${words.join("|")}|\\d+)\\s+(?:(?:npm|live|authoring|more)\\s+)?(packages|skills|lenses|chapters)\\b`, "gi");
    const wrong: string[] = [];
    for (const file of [...pages, "llms.txt", "llms-full.txt"]) {
      const text = file.endsWith(".html") ? textOf(read(file)) : read(file);
      for (const [whole, number, noun] of text.matchAll(said)) {
        const value = /^\d+$/.test(number!) ? Number(number) : words.indexOf(number!.toLowerCase());
        const expected = counts[nouns[noun!.toLowerCase()]!];
        if (value !== expected) wrong.push(`${file}: "${whole}" — the tree has ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
