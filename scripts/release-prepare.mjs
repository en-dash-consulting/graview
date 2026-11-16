#!/usr/bin/env node
/**
 * A BATCH CARRIES ITS OWN RELEASE. `pnpm release:prepare`, run on a batch
 * branch once its last build has merged into it, does what the Version
 * packages pull request did, so the batch's own CI and Nightly are the
 * release's gates and its merge is the release:
 *
 *   1. `changeset version`: the changesets are spent, the fourteen packages
 *      (one fixed group) take the next version, each changelog its section;
 *      then FRAMEWORK_VERSION is written to match.
 *   2. The version's release record in apps/site/releases.json: kept when
 *      one is there, otherwise scaffolded from the changesets for a person
 *      to rewrite. A scaffold says `WRITE ME` in its headline and its
 *      compatibility line, and the releases test fails until neither does.
 *   3. The site: `site-numbers --release` (the test count the release
 *      writes) and `pnpm site:build:all`, as the Version step did.
 *
 * It commits nothing; it says what is left. It needs `pnpm build` first,
 * since the docs pages are generated from the built packages. It refuses a
 * branch that already carries a version main does not have: running it
 * twice would version the same changes into two numbers, one never on npm.
 *
 *   pnpm release:prepare
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { scaffoldRecord, UNWRITTEN, withRecord } from "./lib/release.mjs";

const root = resolve(import.meta.dirname, "..");
const step = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
};
const quiet = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (said) => {
  console.error(said);
  process.exit(1);
};
const versionOf = () => JSON.parse(readFileSync(join(root, "packages/graview/package.json"), "utf8")).version;

const pending = readdirSync(join(root, ".changeset"))
  .filter((file) => file.endsWith(".md") && file !== "README.md")
  .sort()
  .map((name) => ({ name, text: readFileSync(join(root, ".changeset", name), "utf8") }));
if (pending.length === 0) fail("No changeset is pending: there is nothing for this branch to release.");

try {
  quiet("git", ["fetch", "--quiet", "origin", "main"]);
} catch {
  console.warn("Could not fetch origin main; reading the copy of it this checkout has.");
}
let mainVersion = null;
for (const ref of ["origin/main", "main"]) {
  try {
    mainVersion = JSON.parse(quiet("git", ["show", `${ref}:packages/graview/package.json`])).version;
    break;
  } catch {}
}
if (mainVersion === null) fail("Could not read main's version (git fetch origin main, then run this again).");
const before = versionOf();
if (before !== mainVersion) {
  fail(
    `This branch already carries ${before}, and main is at ${mainVersion}. Running this again would version the ` +
      `changes since into another number and leave ${before} never published. Revert the commit that versioned ` +
      `${before} (its changesets come back), merge what is new, and run this once.`,
  );
}
if (!existsSync(join(root, "packages/core/dist"))) fail("Run `pnpm build` first: the docs pages are generated from the built packages.");

/* 1. The version. */
step("pnpm", ["exec", "changeset", "version"]);
step("node", ["scripts/write-framework-version.mjs"]);
const version = versionOf();
if (version === before) fail(`changeset version left the packages at ${before}.`);
let taken = false;
try {
  taken = quiet("npm", ["view", `graview@${version}`, "version"]) === version;
} catch {}
if (taken) fail(`npm already has graview ${version}: main moved past what this branch read. Discard these changes, merge main, and run this again.`);

/* 2. The release record. */
const recordsFile = join(root, "apps/site/releases.json");
const file = JSON.parse(readFileSync(recordsFile, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const { records, added } = withRecord(file.releases, scaffoldRecord(version, pending, today));
if (added) writeFileSync(recordsFile, `${JSON.stringify({ ...file, releases: records }, null, 2)}\n`);

/* 3. The site. */
step("node", ["scripts/site-numbers.mjs", "--release"]);
step("pnpm", ["site:build:all"]);

const record = records.find((one) => one.version === version);
const unwritten = JSON.stringify(record).includes(UNWRITTEN);
console.log(`\nGraview ${before} → ${version}: ${pending.length} changeset(s) spent.`);
console.log(added ? `A release record for ${version} was scaffolded in apps/site/releases.json.` : `The release record for ${version} was already in apps/site/releases.json; it is kept as written.`);
console.log("\nWhat is left:");
if (unwritten) {
  console.log(`  - Rewrite ${version}'s record in apps/site/releases.json: the headline, the summary in plain words, and the`);
  console.log(`    compatibility line leading with what breaks for a host. Remove every "${UNWRITTEN}", and every FR number`);
  console.log("    the changesets carried. Set its date to the day npm publishes it (UTC). Then run `pnpm site:build:all` again.");
}
console.log("  - Commit it on this branch, push, and dispatch Nightly on its head after that last push");
console.log("    (`gh workflow run nightly.yml --ref <branch>`): the publish needs a green Nightly on the tree main gets.");
console.log("  - Merge on green. The publish job then waits for its one approval in the npm environment.");
