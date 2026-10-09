#!/usr/bin/env node
/**
 * THE NUMBERS ON THE PAGE, COUNTED OUT OF THE REPOSITORY.
 *
 * A marketing page is where numbers go to rot. Nobody recounts the packages
 * after adding one, "a dozen skills" survives becoming nine, and by the time
 * anyone notices, the page is a thing the team quietly does not defend.
 *
 * So the page carries `data-number="packages"` and this fills it in. Run it
 * after anything that changes a count; `--check` fails when the page and the
 * repository disagree, which is what the test calls.
 *
 * The test suite total is the one number here that cannot be counted from a
 * file listing, so it is read from the last run's report rather than guessed.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => resolve(repoRoot, ...parts);
const dirs = (path) => readdirSync(at(path)).filter((entry) => statSync(at(path, entry)).isDirectory());

/** Every count the page may ask for, and how it is arrived at. */
export function countOf() {
  // The checker is `check.ts` and the families it asks, in `check/`.
  const check = [
    readFileSync(at("packages/core/src/cli/check.ts"), "utf8"),
    ...readdirSync(at("packages/core/src/cli/check")).map((name) => readFileSync(at("packages/core/src/cli/check", name), "utf8")),
  ].join("\n");
  const codes = new Set([...check.matchAll(/code: "([a-z0-9-]+)"/g)].map((m) => m[1]));
  return {
    packages: dirs("packages").length,
    skills: dirs("packages/skills/skills").length,
    /*
     * A LENS IS A THING WITH A FACTORY AND ROLES, not a file in the lens
     * folder. Counting files said six and the docs page rendered a skill
     * saying four, which is how a number that nobody can check drifts in
     * two directions at once. `reach` lives there and is a built-in view:
     * no `create…Lens`, no roles to rebind, nothing a second domain could
     * take. Five is the number, and this is why it is five.
     */
    lenses: readdirSync(at("packages/primitives/src/lens"))
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => /export function create[A-Za-z]+Lens/.test(readFileSync(at("packages/primitives/src/lens", file), "utf8")))
      .length,
    codes: codes.size,
    chapters: [...readFileSync(at("docs/site/progression.html"), "utf8").matchAll(/id="chapter-\d+"/g)].length,
    tests: tested(),
    testFiles: testFiles(),
  };
}

/**
 * THE NUMBER OF TESTS, COUNTED RATHER THAN REPORTED.
 *
 * The first version read a total out of `docs/tests.json`, written by hand
 * after a run — and within an hour the suite had grown by six and the page
 * and the file agreed with each other and with nothing else. A number whose
 * source is "somebody wrote it down" is exactly the number this file exists
 * to abolish.
 *
 * So it counts `it(` in the tree. That is the number of tests with names in
 * the source, which is a smaller number than the runtime total, because a
 * handful run inside loops — and being the smaller, exactly countable one is
 * the right trade for a claim on a marketing page.
 */
/*
 * NOT COUNTED: what is built or installed, and `.claude`, where an assistant's
 * worktrees live — whole second checkouts, which doubled the count on the
 * machine that had them and made the page disagree with every other one.
 */
const UNCOUNTED = new Set(["node_modules", "dist", ".git", "out", ".claude"]);

function testFiles() {
  let found = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (UNCOUNTED.has(entry)) continue;
      const path = resolve(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.test\.(ts|tsx|js|mjs)$/.test(entry)) found += 1;
    }
  };
  walk(repoRoot);
  return found;
}

function tested() {
  let found = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (UNCOUNTED.has(entry)) continue;
      const path = resolve(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.test\.(ts|tsx|js|mjs)$/.test(entry)) {
        found += (readFileSync(path, "utf8").match(/(^|\s)it\(/g) ?? []).length;
      }
    }
  };
  walk(repoRoot);
  return found;
}

/**
 * A COUNT IN A SENTENCE IS STILL A COUNT. The strip under the hero carried
 * `data-number` and stayed right; the prose beside it said "Five ship with
 * it" a lens later and "Fourteen skills" a skill later, because nothing
 * filled it in. So a number spelled out in prose carries
 * `data-number-word` and is written here too, keeping the capital it was
 * given at the start of a sentence.
 */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function spelled(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return String(n);
}
const capital = (word, like) => (/^[A-Z]/.test(like) ? word[0].toUpperCase() + word.slice(1) : word);

/** The pages that carry counts: the landing page, and the long version. */
export const PAGES = ["docs/site/index.html", "docs/site/progression.html"];

/** Fill every marked count on a page; `wrong` collects what disagreed. */
export function fill(html, counts, wrong = []) {
  return html
    .replace(/(<(strong|span) data-number="([a-zA-Z]+)">)([^<]*)(<\/\2>)/g, (whole, open, _tag, name, said, close) => {
      const found = counts[name];
      if (found === null || found === undefined) return whole;
      if (String(found) !== said) wrong.push(`${name}: the page says ${said}, the repository says ${found}`);
      return `${open}${found}${close}`;
    })
    .replace(/(<span data-number-word="([a-zA-Z]+)">)([^<]*)(<\/span>)/g, (whole, open, name, said, close) => {
      const found = counts[name];
      if (found === null || found === undefined) return whole;
      const word = capital(spelled(found), said);
      if (word !== said) wrong.push(`${name}: the page says "${said}", the repository says ${found}`);
      return `${open}${word}${close}`;
    });
}

const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const checking = process.argv.includes("--check");
  const counts = countOf();
  let stale = 0;
  for (const page of PAGES) {
    const html = readFileSync(at(page), "utf8");
    const wrong = [];
    const next = fill(html, counts, wrong);
    if (checking) {
      if (wrong.length > 0) {
        process.stderr.write(`${page} has numbers the repository disagrees with — run \`pnpm site:numbers\`.\n`);
        for (const line of wrong) process.stderr.write(`  ${line}\n`);
        stale += 1;
      }
    } else {
      if (next !== html) writeFileSync(at(page), next);
      process.stdout.write(
        wrong.length === 0
          ? `every number on ${page} was already right\n`
          : `corrected ${wrong.length} on ${page}: ${wrong.join("; ")}\n`,
      );
    }
  }
  if (checking) {
    if (stale > 0) process.exit(1);
    process.stdout.write(`every number on the pages is the repository's own\n`);
  }
}
