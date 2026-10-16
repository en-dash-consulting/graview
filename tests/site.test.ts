import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE SITE IS GENERATED, SO THE SITE CAN GO STALE.
 *
 * graview.dev is a Graview app: a declaration (`apps/site/app.json`) and
 * the records `scripts/site-docs.mjs` writes out of the repository — the
 * READMEs, the skills, the CLI's usage, every code the checker can produce,
 * the recipes — with a page record for every address the site serves, each
 * rendered by `renderPlace` in the site's design (`apps/site/design.mjs`).
 * Into the hand-designed pages it fills (`apps/site/pages/`) go the
 * stylesheet, which every page carries inline because the artifact host
 * blocks a `<link>`, and the numbers on the landing page.
 *
 * All of it is exactly the kind of thing that is right on the day it is
 * written and quietly wrong four months later — "three lenses" surviving
 * the fourth, a package page for a package that no longer exists. So the
 * generators all take `--check`, and this is what runs it.
 *
 * A failure here is never a bug. It means somebody changed the repository
 * and the site has not caught up: run `pnpm site:build:all`.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (script: string) => {
  try {
    execFileSync("node", [resolve(repoRoot, "scripts", script), "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return null;
  } catch (error) {
    const said = error as { stderr?: string; stdout?: string };
    return `${said.stderr ?? ""}${said.stdout ?? ""}`.trim();
  }
};

describe("the site says what the repository says", () => {
  it("carries the current stylesheet on every page", () => {
    expect(run("site-css.mjs")).toBeNull();
  });

  it("puts the repository's own numbers on the landing page", () => {
    /*
     * The one claim a marketing page cannot be trusted with. Nobody recounts
     * the packages after adding one, and by the time anyone notices, the
     * page is a thing the team quietly does not defend.
     */
    expect(run("site-numbers.mjs")).toBeNull();
  });

  it("leaves the test count, which every pull request moves, to the release and the deploy", () => {
    /*
     * A count every pull request changes was a line every pull request
     * rewrote, and a conflict with whichever merged first. The Version
     * packages step and the Pages deploy write it (`--release`), so the
     * page a person reads still says main's number; a pull request's check
     * holds every other count exactly.
     */
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(manifest.scripts["version-packages"]).toMatch(/site-numbers\.mjs --release && node scripts\/site-docs\.mjs/);
    const pages = readFileSync(resolve(repoRoot, ".github/workflows/pages.yml"), "utf8");
    expect(pages).toContain("node scripts/site-numbers.mjs --release && node scripts/site-docs.mjs");
    expect(pages).not.toMatch(/^\s+paths:/m);
    // The page still carries the count, as a number, for those two to fill in.
    expect(readFileSync(resolve(repoRoot, "docs/site/index.html"), "utf8")).toMatch(/<strong data-number="tests">\d+<\/strong>/);
  });

  it("has docs pages that match the packages, skills and findings in the tree", () => {
    /* And their Markdown twins, llms.txt, llms-full.txt, robots.txt, the
       sitemap and the landing pages' structured data, all written by the
       same run: tests/site-for-machines.test.ts holds what they promise. */
    expect(run("site-docs.mjs")).toBeNull();
  });

  it("draws the hero's first frame from the chapter the hero mounts", () => {
    expect(run("site-poster.mjs")).toBeNull();
  });
});

describe("what the pages promise each other", () => {
  const read = (file: string) => readFileSync(resolve(repoRoot, "docs/site", file), "utf8");

  it("keeps the landing page a landing page: no chapters on it", () => {
    /*
     * The page this replaced ran to fifteen chapters, which is what made it
     * documentation wearing a headline. They live in the long version now,
     * and the way to keep them there is to say so.
     */
    const landing = read("index.html");
    expect(landing).not.toContain('data-graview-chapter="2"');
    expect(landing).toContain('href="progression.html"');
    /* The long feature tour, the stepper with it, moved to tour.html rather than away. */
    expect(landing).not.toContain('data-step-live="1"');
    expect(landing).toContain('href="tour.html"');
    expect(read("tour.html")).toContain('data-step-live="1"');
    expect(read("tour.html")).toContain('id="surfaces"');
  });

  it("opens the landing page on the prompt, then says what it builds and what you get before the recipes", () => {
    const landing = read("index.html");
    const main = landing.slice(landing.indexOf("<main"));
    const prompt = main.indexOf('id="prompt-text"');
    expect(prompt).toBeGreaterThan(-1);
    // The prompt comes first, then the recipe tabs, then the headline as the why.
    expect(main.indexOf('class="recipe-tabs"')).toBeGreaterThan(prompt);
    expect(main.indexOf("<h1")).toBeGreaterThan(prompt);
    // No stat strip in the hero: the one number left on the page is the footer's.
    const hero = /<section id="what"[\s\S]*?<\/section>/.exec(main)?.[0] ?? "";
    expect(hero).not.toMatch(/data-number=/);
    // The sections the page is cut to, in order.
    const order = ["what", "builds", "gives", "recipes", "how", "cloud", "faq"].map((id) => main.indexOf(`<section id="${id}"`));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(main.match(/<section id="/g)).toHaveLength(7);
    // Each feature card goes to its own section of the tour.
    for (const anchor of ["surfaces", "rules", "lenses", "agent", "acts", "studio"]) {
      expect(main).toContain(`href="tour.html#${anchor}"`);
      expect(read("tour.html")).toContain(`id="${anchor}"`);
    }
  });

  it("links the docs and the long version to each other and back", () => {
    expect(read("docs/index.html")).toContain('href="../progression.html"');
    expect(read("docs/index.html")).toContain('href="../index.html"');
    expect(read("progression.html")).toContain('href="index.html"');
  });

  it("sends a newcomer from the landing page to a getting-started page that exists", () => {
    expect(read("index.html")).toContain('href="docs/getting-started.html"');
    expect(existsSync(resolve(repoRoot, "docs/site/docs/getting-started.html"))).toBe(true);
    expect(read("docs/index.html")).toContain('href="getting-started.html"');
    expect(read("docs/index.html")).toContain('href="agents.html"');
    expect(read("docs/index.html")).toContain('href="demos.html"');
  });

  it("is deployable to graview.dev as it stands", () => {
    /* GitHub Pages reads these three off the published directory; the
       sitemap lists every page the generator wrote. */
    expect(read("CNAME").trim()).toBe("graview.dev");
    expect(existsSync(resolve(repoRoot, "docs/site/.nojekyll"))).toBe(true);
    expect(read("robots.txt")).toContain("https://graview.dev/sitemap.xml");
    const sitemap = read("sitemap.xml");
    for (const page of ["index.html", "getting-started.html", "agents.html", "demos.html", "packages/graview.html"]) {
      expect(sitemap, page).toContain(`https://graview.dev/docs/${page}`);
    }
    expect(read("404.html")).toContain("site-css:start");
    expect(read("index.html")).toContain('<link rel="canonical" href="https://graview.dev/">');
    expect(read("docs/agents.html")).toContain('<link rel="canonical" href="https://graview.dev/docs/agents.html">');
  });

  it("gives every generated page the same accessibility floor as the page", () => {
    /* The skip link and the rail are not decoration: they are the two
       things a keyboard needs, and a generated page gets them or it is not
       the same site. */
    for (const file of ["docs/index.html", "docs/packages/core.html", "docs/skills/graview-lens.html"]) {
      const page = read(file);
      expect(page, file).toContain('<a class="skip" href="#main">');
      expect(page, file).toContain('<nav class="rail" aria-label="Documentation">');
      // The skip link's target takes the keyboard, or Enter on it lands on <body>.
      expect(page, file).toContain('<main class="col" id="main" tabindex="-1">');
    }
  });
});

describe("the site is a Graview app", () => {
  /*
   * graview.dev is what Graview says an app is: one declaration, and records.
   * The declaration is held to the same checker a product's is, and every
   * address the site serves is a page record rendered by `renderPlace` —
   * nothing in docs/site that a person or a crawler reads is written any
   * other way.
   */
  const SITE_DIR = resolve(repoRoot, "docs/site");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = resolve(dir, entry);
      return statSync(path).isDirectory() ? walk(path) : [relative(SITE_DIR, path)];
    });
  /* What the site serves to read: every page, twin and file for crawlers and models. Not the site's own
     assets (the stylesheet, the bundle, the face, the pictures), not the recipes' committed files, not
     this folder's README and not the narrow-width fixture. */
  const served = walk(SITE_DIR)
    .filter((file) => /\.(html|md|txt|xml)$/.test(file))
    .filter((file) => !file.startsWith("brand/") && !file.startsWith("_") && file !== "README.md")
    .sort();

  it("has a declaration that passes graview check with no error and no warning", () => {
    // Exits 1 on an error; a warning is a line starting with "!".
    const said = execFileSync(process.execPath, [resolve(repoRoot, "packages/graview/dist/cli.js"), "check", "--document", resolve(repoRoot, "apps/site/app.json")], { cwd: repoRoot, encoding: "utf8" });
    expect(said.split("\n").filter((line) => line.startsWith("!"))).toEqual([]);
    expect(said).toContain("checks clean");
  });

  it("serves every address from a record, rendered by renderPlace, and has a record for nothing it does not serve", async () => {
    const { renderSite } = (await import(pathToFileURL(resolve(repoRoot, "scripts/site-docs.mjs")).href)) as {
      renderSite: () => Promise<{ files: Map<string, string>; served: Map<string, string>; snapshot: { nodes: { id: string; kind: string; path?: string; twin?: string }[] } }>;
    };
    const site = await renderSite();
    expect([...site.served.keys()].sort()).toEqual(served);
    const pages = site.snapshot.nodes.filter((node) => node.kind === "page");
    for (const file of served) {
      const record = pages.find((page) => page.id === site.served.get(file));
      expect(record, file).toBeDefined();
      expect([record!.path, record!.twin], file).toContain(file);
      // What is on disk is what the record renders to, byte for byte.
      expect(readFileSync(resolve(SITE_DIR, file), "utf8") === site.files.get(file), file).toBe(true);
    }
    // Reading the repository runs the CLI on each recipe: seconds alone, longer beside the whole suite.
  }, 60_000);

  it("says so on the landing page and on every docs page, with the declaration a click away and the app live a click away", () => {
    const read = (file: string) => readFileSync(resolve(SITE_DIR, file), "utf8");
    const declaration = 'href="https://github.com/en-dash-consulting/graview/blob/main/apps/site/app.json"';
    expect(read("index.html")).toContain('href="docs/site.html"');
    expect(read("index.html")).toContain(declaration);
    for (const file of served.filter((f) => f.startsWith("docs/") && f.endsWith(".html"))) {
      const page = read(file);
      expect(page, file).toMatch(/<a href="(\.\.\/)?site\.html"( aria-current="page")?>This site, as an app<\/a>/);
      expect(page, file).toContain(declaration);
    }
    // The page it opens carries the declaration and the records its pages were rendered from, and mounts them.
    const scene = read("docs/site.html");
    expect(scene).toContain('data-graview-document="site-app" data-graview-seed="site-records"');
    expect(JSON.parse(/<script type="application\/json" id="site-app">([\s\S]*?)<\/script>/.exec(scene)![1]!)).toEqual(JSON.parse(readFileSync(resolve(repoRoot, "apps/site/app.json"), "utf8")));
    const records = JSON.parse(/<script type="application\/json" id="site-records">([\s\S]*?)<\/script>/.exec(scene)![1]!) as { nodes: { kind: string; path?: string }[] };
    for (const kind of ["package", "skill", "check", "page"]) expect(records.nodes.some((node) => node.kind === kind), kind).toBe(true);
    expect(records.nodes.filter((node) => node.kind === "page").map((node) => node.path)).toContain("docs/site.html");
    expect(scene).toContain('<script src="../chapters.js"></script>');
  });
});
