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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { saysCompatibility, surfacesTouched } from "./lib/surfaces.mjs";
import { HOSTED_BUDGET_NAMES } from "./lib/bundle-budget.mjs";
import { raiseSaid } from "./lib/hosted-page.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The Version packages pull request is where changesets are spent: it bumps
// every package and removes the changesets that asked for it.
const head = process.env["GITHUB_HEAD_REF"] || process.env["GITHUB_REF_NAME"] || "";
// Only this repository's own branch: a fork's pull request may name its branch anything.
const headRepository = (() => {
  try {
    return JSON.parse(readFileSync(process.env["GITHUB_EVENT_PATH"] ?? "", "utf8")).pull_request?.head?.repo?.full_name ?? null;
  } catch {
    return null;
  }
})();
const ownBranch = headRepository === null || headRepository === process.env["GITHUB_REPOSITORY"];
if (head.startsWith("changeset-release/") && ownBranch) {
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
const baseRef = range.split("...")[0];
const mergeBase = git("merge-base", baseRef, "HEAD");

/*
 * A BATCH CARRIES ITS OWN RELEASE (`pnpm release:prepare`), so on its pull
 * request the changesets its builds added are spent by the time CI runs:
 * the version moved, the changelogs say them, and the files are gone. Each
 * changeset any commit here added is read as it last stood, spent or not,
 * so it still answers for what it says.
 */
const versionAt = (ref) => {
  try {
    return JSON.parse(git("show", `${ref}:packages/graview/package.json`)).version;
  } catch {
    return null;
  }
};
const carriedVersion = versionAt("HEAD") !== versionAt(mergeBase) ? versionAt("HEAD") : null;
const addedChangesetText = new Map(
  git("log", "--format=", "--name-only", "--diff-filter=A", `${mergeBase}..HEAD`, "--", ".changeset")
    .split("\n")
    .filter((file) => file.endsWith(".md") && !file.endsWith("README.md"))
    .map((file) => {
      const last = git("log", "-1", "--format=%H", "--diff-filter=AM", `${mergeBase}..HEAD`, "--", file);
      return [file.replace(/^\.changeset\//, ""), git("show", `${last}:${file}`)];
    })
    // Spent only by a release: a pull request that carries none answers with the changesets it leaves on disk.
    .filter(([name]) => carriedVersion || existsSync(resolve(repoRoot, ".changeset", name))),
);

/*
 * A VERSION MOVED IS A RELEASE ONLY WHEN IT WAS MADE AS ONE: changesets
 * spent, every published package at the version, and every changelog
 * saying it. A version edited by hand would otherwise skip every check
 * above and below, and main would publish a release nobody described.
 */
if (carriedVersion) {
  const spent = [
    ...[...addedChangesetText.keys()].filter((name) => !existsSync(resolve(repoRoot, ".changeset", name))),
    ...git("diff", "--name-only", "--diff-filter=D", range, "--", ".changeset").split("\n").filter((file) => file.endsWith(".md") && !file.endsWith("README.md")),
  ];
  const manifests = readdirSync(resolve(repoRoot, "packages"))
    .filter((dir) => existsSync(resolve(repoRoot, "packages", dir, "package.json")))
    .map((dir) => ({ dir, ...JSON.parse(readFileSync(resolve(repoRoot, "packages", dir, "package.json"), "utf8")) }))
    .filter((manifest) => !manifest.private);
  const wrong = [
    ...(spent.length === 0 ? ["no changeset was spent for it"] : []),
    ...manifests.filter((one) => one.version !== carriedVersion).map((one) => `${one.name} is at ${one.version}`),
    ...manifests
      .filter((one) => !readFileSync(resolve(repoRoot, "packages", one.dir, "CHANGELOG.md"), "utf8").includes(`\n## ${carriedVersion}\n`))
      .map((one) => `packages/${one.dir}/CHANGELOG.md has no ${carriedVersion} section`),
  ];
  if (wrong.length > 0) {
    process.stderr.write(
      `This pull request moves the version to ${carriedVersion}, and it was not made as a release:\n` +
        wrong.map((line) => `  ${line}\n`).join("") +
        "\nPut the versions back and run `pnpm release:prepare`, which spends the changesets and writes every changelog.\n",
    );
    process.exit(1);
  }
}

/*
 * A HOSTED PAGE SPENT ON PURPOSE, AND SAID (FR-179). A raise of a hosted
 * page's budget is a file in scripts/budget-raises/ that names the changeset
 * shipping it; that changeset arrives in the same pull request and says the
 * kilobytes the raise adds up front, so no change spends more of Cloud's
 * first load than its own words say.
 */
const addedHere = (dir) => git("diff", "--name-only", "--diff-filter=A", range, "--", dir).split("\n").filter(Boolean);
const hostedRaisesAdded = addedHere("scripts/budget-raises")
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({ file, raise: JSON.parse(readFileSync(resolve(repoRoot, file), "utf8")) }))
  .filter(({ raise }) => HOSTED_BUDGET_NAMES.includes(raise.budget));
const unsaid = hostedRaisesAdded.filter(({ raise }) => !addedChangesetText.get(raise.changeset)?.includes(raiseSaid(raise)));
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

/*
 * A PULL REQUEST THAT CARRIES A RELEASE SPENDS EVERY CHANGESET. One left on
 * disk would be pending on main after the merge, and the release workflow
 * would open a Version packages pull request for it instead of publishing
 * the version this one carries.
 */
if (carriedVersion && pending.length > 0) {
  process.stderr.write(
    `This pull request carries ${carriedVersion} and leaves ${pending.length} changeset(s) unspent:\n` +
      pending.map((file) => `  .changeset/${file}\n`).join("") +
      "\nThey came after `pnpm release:prepare`. Revert the commit that versioned the packages (its changesets come back),\n" +
      "then run `pnpm release:prepare` once, so every change on the branch is in the one version.\n",
  );
  process.exit(1);
}

if (pending.length > 0 || carriedVersion) {
  process.stdout.write(
    carriedVersion
      ? `${touchedPackages.join(", ")} changed; this pull request carries ${carriedVersion}, which spent the ${addedChangesetText.size} changeset(s) its commits added.\n`
      : `${touchedPackages.join(", ")} changed; ${pending.length} changeset(s) present.\n`,
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
    // Read as each last stood, so a changeset a release spent still answers.
    const silent = [...addedChangesetText]
      .filter(([, text]) => !saysCompatibility(text))
      .map(([name]) => `.changeset/${name}`);
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
