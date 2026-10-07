import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE REPOSITORY SPELLS IN AMERICAN ENGLISH. Identifiers, the sentences a
 * person reads, comments, docs, skills, changesets and test names: color,
 * center, behavior, judgment, labeled, canceled, catalog, gray, normalize.
 * A British form in one place and the American one in the next is two
 * names for one thing, and an export spelled one way is an import a
 * stranger gets wrong the other way.
 *
 * What is left alone: the platform's own names (`aria-labelledby`), a
 * third party's values (Google Calendar's and MCP's `cancelled`), proper
 * nouns, and what was written somewhere else and is kept verbatim —
 * published changelogs, the PRD and run records under `.ndx/`, Graview
 * Cloud's documents among the test fixtures, the harness verdicts and the
 * generated docs pages, which are built from what this test reads.
 */
const root = resolve(import.meta.dirname, "..");

const IN_SCOPE = /^(packages\/|apps\/|scripts\/|tests\/|docs\/|\.changeset\/|\.github\/|README\.md$|AGENTS\.md$|CLAUDE\.md$)/;
const OUT_OF_SCOPE = new RegExp(
  [
    String.raw`(^|/)CHANGELOG\.md$`,
    String.raw`(^|/)LICENSE(\.md)?$`,
    String.raw`^docs/[^/]+\.json$`,
    String.raw`^docs/hosted-page\.`,
    String.raw`^docs/watch/`,
    // Generated from the tree by `pnpm site:build:all` and `pnpm site:build`; tests/site.test.ts holds them to it.
    String.raw`^docs/site/docs/`,
    String.raw`^docs/site/chapters\.js$`,
    // Stored stores, and Graview Cloud's own documents kept verbatim as fixtures.
    String.raw`^apps/[^/]+/data/`,
    String.raw`^packages/core/tests/document/fixtures/`,
    String.raw`^packages/core/tests/fixtures/formats/`,
    String.raw`^packages/studio/tests/fixtures/`,
    String.raw`^packages/guest/tests/fixtures/`,
    String.raw`^scripts/fixtures/`,
    String.raw`^tests/the-repo-spells-in-american-english\.test\.ts$`,
    String.raw`\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|webm|pdf|zip|gz|tgz|wasm)$`,
  ].join("|"),
);

/** Each form matches at the start of a word or a camelCase part, capitalized or not, and in capitals. */
const forms = (stems: readonly string[]): string =>
  stems.flatMap((stem) => [stem, stem[0]!.toUpperCase() + stem.slice(1), stem.toUpperCase()]).join("|");

const OUR = ["colour", "neighbour", "honour", "behaviour", "favour", "flavour", "labour", "humour", "rumour", "harbour", "armour", "vapour", "odour"];
const RE = ["centre", "centred", "centring", "theatre", "metre", "fibre", "litre", "calibre", "manoeuvre"];
const ONE_WORD = ["judgement", "acknowledgement", "artefact", "catalogue", "dialogue", "analogue", "grey", "kerb", "licence", "defence", "offence", "whilst", "amongst", "travell", "jewellery"];
const IZE = [
  "normal", "summar", "serial", "organ", "recogn", "initial", "optim", "custom", "author", "human", "capital",
  "sanit", "raster", "memo", "general", "visual", "priorit", "minim", "maxim", "categor", "special", "util",
  "final", "standard", "token", "local", "real", "character", "random", "synchron", "apolog", "alphabet",
  "material", "emphas", "synthes", "anonym", "stabil", "harmon", "vector", "item", "symbol", "civil",
];

const BRITISH = new RegExp(
  [
    `(?:${forms([...OUR, ...RE, ...ONE_WORD])})`,
    `(?:${forms(["programme"])})(?![dr]|D|R)`,
    `(?:${forms(["cancell", "modell", "channell", "signall", "levell", "tunnell", "fuell", "totall", "pencill", "spirall"])})(?:ed|ing|ED|ING)(?![a-z])`,
    `(?:${forms(["labell"])})(?:ed|ing|ED|ING)(?![a-z]|[Bb][Yy])`,
    `(?:${forms(IZE)})(?:is|IS)(?:e|ed|es|ing|ation|ations|er|ers|able|E|ED|ES|ING|ATION|ER|ABLE)(?![a-z])`,
    `(?:${forms(["anal", "paral", "catal"])})(?:ys|YS)(?:e|ed|ing|E|ED|ING)(?![a-z])`,
    String.raw`\b(?:learnt|spelt|misspelt|maths|storey|storeys)\b`,
  ].join("|"),
  "g",
);

/** Kept as written: the platform's names, a third party's values, proper nouns. */
const ALLOWED: readonly RegExp[] = [
  /aria-labelledby/gi,
  /notifications\/cancelled/g,
  /harbour health|harbourline/gi,
  // Ids in Graview Cloud's org fixture, which tests name.
  /strength-fit-judgement/g,
  // A rename says what the name was: "`colorsIn` (was `coloursIn`)".
  /\bwas `[^`]*`/g,
];
const ALLOWED_IN: Readonly<Record<string, readonly RegExp[]>> = {
  // Google Calendar's own status for a deleted event.
  "packages/core/src/sync/google-calendar.ts": [/"cancelled"/g],
  "packages/core/tests/integration/sync.test.ts": [/"cancelled"/g],
};

/** Every British form on one line, after what is allowed has been taken out. */
function britishIn(line: string, file = ""): string[] {
  let rest = line;
  for (const allowed of [...ALLOWED, ...(ALLOWED_IN[file] ?? [])]) rest = rest.replace(allowed, (found) => " ".repeat(found.length));
  return [...rest.matchAll(BRITISH)].map((match) => match[0]);
}

function trackedInScope(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\0").filter((file) => file && IN_SCOPE.test(file) && !OUT_OF_SCOPE.test(file));
}

describe("the repository's spelling", () => {
  it("finds a planted British form, and passes the forms the platform and third parties own", () => {
    expect(britishIn("const colour = theme.colour;")).toEqual(["colour", "colour"]);
    expect(britishIn("export function humaniseField(field: string) {}")).toEqual(["humanise"]);
    expect(britishIn("centreY, the neighbour's behaviour, a judgement, travelled, a catalogue, grey")).toEqual([
      "centre", "neighbour", "behaviour", "judgement", "travell", "catalogue", "grey",
    ]);
    expect(britishIn("it was labelled and cancelled; normalised and summarised")).toEqual(["labelled", "cancelled", "normalised", "summarised"]);
    expect(britishIn('<div aria-labelledby="h" role="region">')).toEqual([]);
    expect(britishIn("labelledBy: heading")).toEqual([]);
    expect(britishIn('case "notifications/cancelled":')).toEqual([]);
    expect(britishIn("`colorsIn` (was `coloursIn`)")).toEqual([]);
    expect(britishIn('status === "cancelled"', "packages/core/src/sync/google-calendar.ts")).toEqual([]);
    expect(britishIn('status === "cancelled"')).toEqual(["cancelled"]);
    expect(britishIn("a promise, a surprise, otherwise precise; the program was programmed; towards the center")).toEqual([]);
    expect(britishIn("emphasis, synthesis, analysis, organism, realism, criticism")).toEqual([]);
  });

  it("spells every tracked source, doc, skill and changeset in American English", () => {
    const found: string[] = [];
    for (const file of trackedInScope()) {
      let text: string;
      try {
        text = readFileSync(resolve(root, file), "utf8");
      } catch {
        continue; // deleted in the working tree
      }
      text.split("\n").forEach((line, index) => {
        for (const form of britishIn(line, file)) found.push(`${file}:${index + 1}: ${form}`);
      });
    }
    expect(found).toEqual([]);
  });
});
