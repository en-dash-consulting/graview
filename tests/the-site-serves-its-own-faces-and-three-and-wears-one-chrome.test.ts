import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * GRAVIEW.DEV IS ONE SITE, SERVED FROM ITSELF.
 *
 * The home draws its map with three.js r128 and every page is set in
 * Merriweather, Montserrat and JetBrains Mono (and the example garden's
 * frames in its own Figtree and Fraunces). Each is a file the site serves,
 * pinned to the bytes that were reviewed and carrying its license beside it,
 * so no page asks a CDN or Google Fonts for anything; the one third party is
 * the analytics, which runs on graview.dev's own hostname only. And every
 * page wears the same head, header and footer, written from one place
 * (apps/site/chrome.mjs), and the same stylesheet.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(repoRoot, "docs/site");
const read = (file: string) => readFileSync(resolve(SITE, file), "utf8");
const sha = (file: string) => createHash("sha256").update(readFileSync(resolve(SITE, file))).digest("hex");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [relative(SITE, path)];
  });
const pages = walk(SITE).filter((file) => file.endsWith(".html") && !file.startsWith("_") && !file.startsWith("recipes/"));

/** Each vendored file, the bytes it must be, and its license beside it. */
const PINNED: [file: string, sha256: string, license: string, says: RegExp][] = [
  ["vendor/three-r128.min.js", "9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2", "vendor/LICENSE-three.txt", /The MIT License[\s\S]*three\.js authors/],
  ["brand/merriweather-latin.woff2", "4fbe8dd9c23b1fd62a988bb8a69b8e692d810f773d9ef6ebca2ba2760c7b11ee", "brand/OFL-Merriweather.txt", /Merriweather Project Authors[\s\S]*SIL Open Font License, Version 1\.1/],
  ["brand/montserrat-latin.woff2", "3893d66e2e605c23b0daa3cb8379ee35994f53b8b3cdadd45427d76f68879cfa", "brand/OFL-Montserrat.txt", /Montserrat[\s\S]*SIL Open Font License, Version 1\.1/],
  ["brand/jetbrains-mono-latin.woff2", "2c32b9b3ee358c119e210f6f5195f9bd34894d78a785ff2e95d60e718e400af4", "brand/OFL-JetBrainsMono.txt", /JetBrains Mono Project Authors[\s\S]*SIL Open Font License, Version 1\.1/],
  ["brand/figtree-latin.woff2", "8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928", "brand/OFL-Figtree.txt", /Figtree Project Authors[\s\S]*SIL Open Font License, Version 1\.1/],
  ["brand/fraunces-latin.woff2", "48282a415ec22e31beaf0a0666e6fae0c8cbddcd0b1f6e729f27c3ade8a64e43", "brand/OFL-Fraunces.txt", /Fraunces Project Authors[\s\S]*SIL Open Font License, Version 1\.1/],
];

interface Chrome {
  FACES: [string, string, string][];
  sharedHead: (o: { base?: string; preload?: string }) => string;
  siteHeader: (o: { base?: string; here?: string }) => string;
  siteFooter: (o: { base?: string }) => string;
}
const chrome = (await import(pathToFileURL(resolve(repoRoot, "apps/site/chrome.mjs")).href)) as Chrome;

describe("graview.dev serves its own three.js and faces, pinned, with their licenses", () => {
  for (const [file, digest, license, says] of PINNED) {
    it(`serves ${file} as the bytes reviewed, with ${license} beside it`, () => {
      expect(sha(file)).toBe(digest);
      expect(read(license)).toMatch(says);
    });
  }

  it("draws the home with three.js revision 128, loaded from the site after the page has drawn", () => {
    expect(read("vendor/three-r128.min.js")).toContain('"128"');
    const home = read("home.js");
    expect(home).toContain('lib.src = "vendor/three-r128.min.js"');
    // Not a blocking <script src> in the page: the headline paints before three.js arrives.
    expect(read("index.html")).not.toMatch(/<script[^>]+three/);
  });

  it("declares every face it serves, and only those, from brand/", () => {
    expect(chrome.FACES.map(([, file]) => `brand/${file}`).sort()).toEqual(PINNED.filter(([file]) => file.endsWith(".woff2")).map(([file]) => file).sort());
  });

  it("reaches no other site from any page: no CDN, no Google Fonts, only the analytics, on graview.dev itself", () => {
    const FOREIGN = /fonts\.googleapis|fonts\.gstatic|cdnjs|jsdelivr|unpkg|esm\.sh|cdn\.tailwindcss|code\.jquery/;
    for (const file of [...pages, "home.js"]) {
      const text = read(file);
      expect(text, file).not.toMatch(FOREIGN);
      expect(text.match(/<(?:script|img|iframe|video|audio|source)\b[^>]*\ssrc="https?:/g), file).toBeNull();
      expect(text.match(/<link\b[^>]*href="https?:[^"]*"[^>]*>/g)?.filter((l) => !/rel="(canonical|alternate)"/.test(l)) ?? [], file).toEqual([]);
      // Every script the page itself runs names one other origin at most: the analytics, behind graview.dev's hostname.
      for (const [, body] of text.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
        const urls = body!.match(/https:\/\/[a-z0-9.-]+/g) ?? [];
        for (const url of urls) {
          expect(url, file).toBe("https://www.googletagmanager.com");
          expect(body, file).toContain('if (location.hostname === "graview.dev" || location.hostname === "www.graview.dev")');
        }
      }
    }
  });

  it("stops the garden's live frames fetching their faces, which the page serves", () => {
    expect(readFileSync(resolve(repoRoot, "apps/seedbed/src/site-embed.ts"), "utf8")).toContain("return mountEmbed(element, { fonts: false, ...options });");
  });
});

describe("every page of graview.dev wears one head, one header, one footer and one stylesheet", () => {
  /* How a page reaches the root: the missing page at any depth by "/", the rest by its own depth. */
  const baseOf = (file: string) => (file === "404.html" ? "/" : "../".repeat(file.split("/").length - 1));
  const hereOf = (file: string) => (file.startsWith("docs/") ? "docs" : file === "tour.html" ? "tour" : "");
  const css = read("site.css").trimEnd();

  it("covers the home, the tour, the long version, the missing page and every docs page", () => {
    for (const file of ["index.html", "tour.html", "progression.html", "404.html", "docs/index.html", "docs/packages/core.html", "docs/skills/graview-lens.html"]) {
      expect(pages, file).toContain(file);
    }
  });

  for (const file of pages) {
    it(`${file}: the shared head, the header and the footer, exactly`, () => {
      const html = read(file);
      const base = baseOf(file);
      expect(html, "head").toContain(chrome.sharedHead({ base, preload: file === "index.html" ? "Merriweather" : "" }));
      expect(html.match(/<header class="site-head">[\s\S]*?<\/header>/g), "header").toEqual([chrome.siteHeader({ base, here: hereOf(file) })]);
      expect(html.match(/<footer class="site-foot">[\s\S]*?<\/footer>/g), "footer").toEqual([chrome.siteFooter({ base })]);
      // The type and the palette are the stylesheet's, and every page carries all of it.
      expect(html.includes(css), "site.css").toBe(true);
    });
  }

  it("sets headlines in Merriweather, words in Montserrat and code in JetBrains Mono, on night, navy, turquoise and paper", () => {
    expect(css).toMatch(/--serif: "Merriweather"/);
    expect(css).toMatch(/--sans: {2}"Montserrat"/);
    expect(css).toMatch(/--mono: {2}"JetBrains Mono"/);
    expect(css).toMatch(/h1, h2 \{ font-family: var\(--serif\)/);
    for (const [token, value] of [["--night", "#0A0F1F"], ["--navy", "#001769"], ["--mint", "#00E5B9"], ["--paper", "#F7F7F2"], ["--ink", "#18213A"]]) {
      expect(css, token).toMatch(new RegExp(`${token}:\\s+${value}`));
    }
    expect(existsSync(resolve(SITE, "home.js"))).toBe(true);
  });
});
