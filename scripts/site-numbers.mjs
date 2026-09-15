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
  const check = readFileSync(at("packages/core/src/cli/check.ts"), "utf8");
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
function testFiles() {
  let found = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git" || entry === "out") continue;
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
      if (entry === "node_modules" || entry === "dist" || entry === ".git" || entry === "out") continue;
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

const PAGE = "docs/site/index.html";
const checking = process.argv.includes("--check");
const counts = countOf();
const html = readFileSync(at(PAGE), "utf8");
const wrong = [];

const next = html.replace(
  /(<strong data-number="([a-z]+)">)([^<]*)(<\/strong>)/g,
  (whole, open, name, said, close) => {
    const found = counts[name];
    if (found === null || found === undefined) return whole;
    if (String(found) !== said) wrong.push(`${name}: the page says ${said}, the repository says ${found}`);
    return `${open}${found}${close}`;
  },
);

if (checking) {
  if (wrong.length > 0) {
    process.stderr.write(`${PAGE} has numbers the repository disagrees with — run \`pnpm site:numbers\`.\n`);
    for (const line of wrong) process.stderr.write(`  ${line}\n`);
    process.exit(1);
  }
  process.stdout.write(`every number on the page is the repository's own\n`);
} else {
  writeFileSync(at(PAGE), next);
  process.stdout.write(
    wrong.length === 0
      ? `every number on the page was already right\n`
      : `corrected ${wrong.length}: ${wrong.join("; ")}\n`,
  );
}
