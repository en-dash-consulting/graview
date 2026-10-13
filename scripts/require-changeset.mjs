#!/usr/bin/env node
/**
 * A change to a package needs a changeset.
 *
 * Not because the tool demands one, but because a version bump is a decision:
 * "this is a patch" is a claim about what a stranger's build will do when they
 * upgrade, and it is far easier to make while the change is still in front of
 * the person who made it than three weeks later from a diff.
 *
 * Only `packages/` counts. The four apps are demonstrations that prove the
 * framework rather than things anyone installs, and versioning them would
 * produce release noise about software nobody depends on.
 *
 *   node scripts/require-changeset.mjs [base-ref]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { saysCompatibility, surfacesTouched } from "./lib/surfaces.mjs";
import { HOSTED_BUDGET_NAMES } from "./lib/bundle-budget.mjs";
import { raiseSaid } from "./lib/hosted-page.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The Version packages pull request is where changesets are spent: it bumps
// every package and removes the changesets that asked for it.
const head = process.env["GITHUB_HEAD_REF"] || process.env["GITHUB_REF_NAME"] || "";
if (head.startsWith("changeset-release/")) {
  process.stdout.write("The Version packages pull request spends changesets; it needs none of its own.\n");
  process.exit(0);
}
const base = process.argv[2] ?? process.env["GITHUB_BASE_REF"] ?? "main";

const git = (...args) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();

let range = `origin/${base}...HEAD`;
try {
  // Quietly: a missing remote ref is the ordinary case locally, and git's own
  // "fatal:" on stderr reads like a failure when it is a fallback.
  execFileSync("git", ["rev-parse", "--verify", `origin/${base}`], {
    cwd: repoRoot,
    stdio: "ignore",
  });
} catch {
  range = `${base}...HEAD`;
}

const changed = git("diff", "--name-only", range).split("\n").filter(Boolean);

/*
 * A HOSTED PAGE SPENT ON PURPOSE, AND SAID (FR-179). A raise of a hosted
 * page's budget is a file in scripts/budget-raises/ that names the changeset
 * shipping it; that changeset arrives in the same pull request and says the
 * kilobytes the raise adds up front, so no change spends more of Cloud's
 * first load than its own words say.
 */
const addedHere = (dir) => git("diff", "--name-only", "--diff-filter=A", range, "--", dir).split("\n").filter(Boolean);
const addedChangesets = new Set(addedHere(".changeset").map((file) => file.replace(/^\.changeset\//, "")));
const hostedRaisesAdded = addedHere("scripts/budget-raises")
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({ file, raise: JSON.parse(readFileSync(resolve(repoRoot, file), "utf8")) }))
  .filter(({ raise }) => HOSTED_BUDGET_NAMES.includes(raise.budget));
const unsaid = hostedRaisesAdded.filter(({ raise }) => !addedChangesets.has(raise.changeset) || !readFileSync(resolve(repoRoot, ".changeset", raise.changeset), "utf8").includes(raiseSaid(raise)));
if (unsaid.length > 0) {
  process.stderr.write(
    `These raise a hosted page's budget, and no changeset this pull request adds says what they spend up front:\n` +
      unsaid.map(({ file, raise }) => `  ${file}: ${raiseSaid(raise)} more up front on "${raise.budget}", changeset "${raise.changeset ?? "(none named)"}"\n`).join("") +
      `\nName the changeset in the raise ("changeset": "<name>.md"), add it here, and say the kilobytes in it.\n`,
  );
  process.exit(1);
}
const touchedPackages = [
  ...new Set(
    changed
      .filter((file) => file.startsWith("packages/"))
      // A README or a test is part of the package and does not change what a
      // consumer installs, so neither needs a version.
      .filter((file) => !/\/(tests?|README\.md)/.test(file))
      .map((file) => file.split("/")[1]),
  ),
].filter(Boolean);

if (touchedPackages.length === 0) {
  process.stdout.write("No package changed; no changeset needed.\n");
  process.exit(0);
}

const pending = readdirSync(resolve(repoRoot, ".changeset")).filter(
  (file) => file.endsWith(".md") && file !== "README.md",
);

if (pending.length > 0) {
  process.stdout.write(
    `${touchedPackages.join(", ")} changed; ${pending.length} changeset(s) present.\n`,
  );
  /*
   * AND A CHANGE TO A SURFACE A HOST HOLDS US TO SAYS WHAT IT DID (FR-30).
   * Every changeset this pull request adds answers in a `Compatibility:`
   * line — "unchanged" is an answer — when it touches ops and primitives,
   * stored formats, the wire, the declaration and check codes, or derived
   * tool names and schemas. docs/stability.md says what each may change.
   */
  const surfaces = surfacesTouched(changed);
  if (surfaces.length > 0) {
    const added = git("diff", "--name-only", "--diff-filter=A", range, "--", ".changeset")
      .split("\n")
      .filter((file) => file.endsWith(".md") && !file.endsWith("README.md"));
    const silent = added.filter((file) => !saysCompatibility(readFileSync(resolve(repoRoot, file), "utf8")));
    if (silent.length > 0) {
      process.stderr.write(
        `This change touches ${surfaces.join("; ")}.\nThese changesets do not say what it does to compatibility:\n` +
          silent.map((file) => `  ${file}\n`).join("") +
          "\nAdd a line `Compatibility: …` to each — additive, breaking, or unchanged, and for whom.\n" +
          "docs/stability.md says what each surface may change within a major.\n",
      );
      process.exit(1);
    }
    process.stdout.write(`Touches ${surfaces.join(", ")}; every changeset added says what it does to compatibility.\n`);
  }
  process.exit(0);
}

process.stderr.write(
  `These packages changed with no changeset: ${touchedPackages.join(", ")}\n\n` +
    "Run `pnpm changeset` and say what changed. Bumps default to patch here\n" +
    "unless there is a reason to say otherwise — a minor bump is a claim about\n" +
    "a new capability, and most changes are not.\n",
);
process.exit(1);
