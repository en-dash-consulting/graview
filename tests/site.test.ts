import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE SITE IS GENERATED, SO THE SITE CAN GO STALE.
 *
 * Three things are written into `docs/site` out of the repository: the
 * stylesheet, which two pages and thirty-one docs pages all carry inline
 * because the artifact host blocks a `<link>`; the numbers on the landing
 * page; and the docs themselves, which are the READMEs, the skills, the
 * CLI's usage and every code the checker can produce.
 *
 * All three are exactly the kind of thing that is right on the day it is
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
    expect(landing).toContain('data-step-live="1"');
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
