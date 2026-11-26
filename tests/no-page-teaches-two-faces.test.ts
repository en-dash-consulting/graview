import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO SKILL AND NO DOCS PAGE TEACHES TWO FACES WHERE THE ONE FACE IS MEANT
 * (Graview HQ feature:f-one-face-by-default). A routed face that owns its
 * page is the one face — the page over the Scene's own city, Page · Nearby ·
 * Map — unless its host says `sceneUnderPages: false`, and `graview create`
 * writes one `PagesApp` at `/`. The docs went on saying "both faces", "the
 * pages face" and `/pages` long after: what a reader is taught is what they
 * build. This reads what a person or an assistant learns from — every
 * skill's source, every package's README, the walkthrough and the docs
 * pages built from them (not the release notes, which say what was) — and
 * fails on the words of the old construct.
 */
const root = resolve(import.meta.dirname, "..");

const TWO_FACES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "both faces", pattern: /\bboth faces\b/i },
  { name: "two faces", pattern: /\btwo faces\b/i },
  { name: "the other face", pattern: /\bthe other face\b/i },
  { name: "either face", pattern: /\beither face\b/i },
  { name: "the pages face", pattern: /\bpages face\b/i },
  { name: "the scene at the root and the pages beside it", pattern: /\bthe scene; \/pages\b/i },
  { name: "/pages as an address", pattern: /localhost:\d+\/pages\b|`\/pages[`/?]|basename=["'`]\/pages["'`]|["']\/pages["']|\]\(\/pages\b/ },
];

/**
 * WHERE THE WORDS ARE ABOUT SOMETHING ELSE, said once with the reason. Each
 * entry is a file and the phrase's name; nothing else is let through.
 */
const ALLOWED: readonly { readonly file: string; readonly name: string; readonly why: string }[] = [];

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(path);
  }
  return out;
}

function taught(): string[] {
  const skills = walk(join(root, "packages/skills/skills"), (path) => path.endsWith("SKILL.md"));
  const readmes = readdirSync(join(root, "packages"))
    .map((name) => join(root, "packages", name, "README.md"))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    });
  const docs = walk(join(root, "docs/site/docs"), (path) => path.endsWith(".md") && !/releases\.md$/.test(path));
  return [...skills, ...readmes, join(root, "docs/walkthrough.md"), ...docs].map((path) => relative(root, path));
}

describe("no skill and no docs page teaches two faces where the one face is meant", () => {
  it("reads every skill, every package's README, the walkthrough and the docs pages", () => {
    const files = taught();
    expect(files.some((file) => file.startsWith("packages/skills/skills/"))).toBe(true);
    expect(files).toContain("packages/pages/README.md");
    expect(files).toContain("docs/walkthrough.md");
    expect(files.some((file) => file.startsWith("docs/site/docs/skills/"))).toBe(true);
  });

  it("says none of the old construct's words: both faces, the other face, the pages face, /pages", () => {
    const found: string[] = [];
    for (const file of taught()) {
      // A line and the next read together, so a phrase wrapped across them is still read whole.
      const raw = readFileSync(join(root, file), "utf8").split("\n");
      const lines = raw.map((line, index) => `${line} ${(raw[index + 1] ?? "").trim().split(/\s+/).slice(0, 3).join(" ")}`);
      lines.forEach((line, index) => {
        for (const { name, pattern } of TWO_FACES) {
          if (!pattern.test(line)) continue;
          if (ALLOWED.some((allowed) => allowed.file === file && allowed.name === name)) continue;
          found.push(`${file}:${index + 1} says "${name}": ${line.trim().slice(0, 160)}`);
        }
      });
    }
    expect(found, found.join("\n")).toEqual([]);
  });

  it("lets through only what each allowance names, and every allowance is still needed", () => {
    for (const allowed of ALLOWED) {
      const pattern = TWO_FACES.find((phrase) => phrase.name === allowed.name)?.pattern;
      expect(pattern, `${allowed.file}: no phrase named "${allowed.name}"`).toBeDefined();
      expect(allowed.why.length).toBeGreaterThan(0);
      expect(pattern!.test(readFileSync(join(root, allowed.file), "utf8")), `${allowed.file} no longer says "${allowed.name}"`).toBe(true);
    }
  });
});
