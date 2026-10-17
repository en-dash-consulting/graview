import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * GRAVIEW.DEV SHOWS THE INLINE AI, NOT A CHAT BOX (Roadmap
 * f-dev-site-no-chatbox).
 *
 * The Ask box — a field at the foot of both faces that grew into a chat
 * thread — is retired for the quick ask and the context menu's AI. Nothing
 * the site serves says it, draws it or demonstrates it: no copy, no alt
 * text, no picture's name, no recipe and no docs page, and no live frame's
 * bundle carries its parts. The pictures that show the AI in its place are
 * the todo example's own, taken by `scripts/site-quick-ask-shots.mjs`.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(repoRoot, "docs/site");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk(SITE);
const read = (file: string) => readFileSync(file, "utf8");

/** How the box was said, and the names its parts were drawn under. */
const SAID = [/\bask box\b/i, /\bask field\b/i, /\bchat box\b/i, /\bseat'?s field\b/i, /“Ask [A-Z][^”]*…”/, /"Ask <the app>…"/, /\bSeatField\b/, /\bPageAsk\b/];
const DRAWN = [/seat-field/, /data-graview-seat(?![-\w])/, /page-seat/, /seat-panel/];

describe("graview.dev draws no chat box", () => {
  it("says it nowhere: no copy, no alt text, no recipe, no docs page", () => {
    const words = files.filter((file) => /\.(html|md|txt|xml|json)$/.test(file));
    expect(words.length).toBeGreaterThan(20);
    const found = words.flatMap((file) => SAID.filter((pattern) => pattern.test(read(file))).map((pattern) => `${relative(SITE, file)}: ${pattern}`));
    expect(found).toEqual([]);
  });

  it("names no picture for it and draws none of its parts, in the pages or the live frames' bundles", () => {
    // A picture's name; the agent seat's skill page is the engine's, which stays.
    const names = files.map((file) => relative(SITE, file)).filter((file) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file) && /seat|chat|ask-box|ask-field/i.test(file) && !/chatgpt/i.test(file));
    expect(names).toEqual([]);
    const drawn = files.filter((file) => /\.(html|js|css)$/.test(file)).flatMap((file) => DRAWN.filter((pattern) => pattern.test(read(file))).map((pattern) => `${relative(SITE, file)}: ${pattern}`));
    expect(drawn).toEqual([]);
  });

  it("shows the inline AI instead, in pictures taken from a real app", () => {
    for (const scheme of ["light", "dark"]) expect(existsSync(resolve(SITE, `img/quick-ask-${scheme}.png`)), scheme).toBe(true);
    const tour = read(resolve(SITE, "tour.html"));
    expect(tour).toContain('src="img/quick-ask-light.png"');
    expect(tour).toContain('src="img/quick-ask-dark.png"');
    expect(tour).toMatch(/⌘K/);
    // Taken from the todo example as it runs, by the script that says how.
    const shots = read(resolve(repoRoot, "scripts/site-quick-ask-shots.mjs"));
    expect(shots).toContain('serving("todo"');
    expect(shots).toContain("quick-ask-${scheme}.png");
  });
});
