#!/usr/bin/env node
/**
 * WHAT THIS PUSH TO MAIN RELEASES — the release workflow's first question.
 *
 * Gathers the facts and hands them to `decide` (scripts/lib/release.mjs,
 * where the rules are written and tested): the changesets pending on disk,
 * every published package's version and whether npm has it, and the green
 * Nightly runs of this repository, matched by tree to the commit checked
 * out. Says the answer, and writes `path` and `version` to $GITHUB_OUTPUT
 * when it is set.
 *
 *   node scripts/release-state.mjs          decide; exit 1 when blocked or broken
 *   node scripts/release-state.mjs --gate   the publish job's check after approval:
 *                                           exit 1 unless nothing is pending, the
 *                                           versions agree and a green Nightly ran
 *                                           on this tree, and nothing newer is npm's
 *                                           latest. It does not ask which packages npm
 *                                           has, so a re-run after every package landed
 *                                           still finishes the tags and releases.
 *
 * Reads GITHUB_REPOSITORY and asks the GitHub API through `gh` (GH_TOKEN).
 * It only reads: nothing here writes to npm, git or GitHub.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decide, nightlyOnTree } from "./lib/release.mjs";

const root = resolve(import.meta.dirname, "..");
const gate = process.argv.includes("--gate");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const repository = process.env.GITHUB_REPOSITORY || "en-dash-consulting/graview";

const pending = readdirSync(join(root, ".changeset")).filter((file) => file.endsWith(".md") && file !== "README.md");
const packages = readdirSync(join(root, "packages"))
  .sort()
  .map((dir) => JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")))
  .filter((manifest) => !manifest.private);
const versions = packages.map((one) => one.version);
const version = packages.find((one) => one.name === "graview")?.version;

/* Every package, not only the CLI: a publish npm cut off part way (0.1.45, 2026-10-22) left graview on npm and the rest missing. */
const onNpm = (name, at) => {
  try {
    return run("npm", ["view", `${name}@${at}`, "version", "--prefer-online"]) === at;
  } catch {
    return false;
  }
};

/* npm's latest graview, or undefined when npm cannot be asked. */
const latestOnNpm = () => {
  try {
    return run("npm", ["view", "graview", "dist-tags.latest", "--prefer-online"]) || null;
  } catch {
    return undefined;
  }
};

/* Every green Nightly run, newest first, each with the tree of the commit it ran on (the API's head_commit.tree_id). */
function nightlies() {
  const listed = run("gh", [
    "api",
    "--paginate",
    `repos/${repository}/actions/workflows/nightly.yml/runs?status=success&per_page=100`,
    "--jq",
    ".workflow_runs[] | {id, url: .html_url, event, conclusion, repository: .head_repository.full_name, headSha: .head_sha, tree: .head_commit.tree_id}",
  ]);
  return listed
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
const tree = run("git", ["rev-parse", "HEAD^{tree}"]);
console.log(`Tree ${tree.slice(0, 12)}; changesets pending: ${pending.length}; versions: ${[...new Set(versions)].join(", ")}.`);

if (gate) {
  /* After approval, asked again: the same rules, npm left out, as if a package were still to publish. */
  const latest = latestOnNpm();
  if (latest === undefined) {
    console.log("::error::npm could not be asked which version is latest; re-run this job once it answers.");
    process.exit(1);
  }
  const nightly = nightlyOnTree(tree, nightlies(), repository);
  const decision = decide({ versions, pending, unpublished: ["a package"], nightly, latest });
  if (decision.path !== "publish") {
    console.log(`::error::${decision.reason}`);
    process.exit(1);
  }
  console.log(`The gate holds at ${decision.version}: the Nightly ${nightly.url} ran green on this tree.`);
  process.exit(0);
}

const unpublished = packages.filter((one) => !onNpm(one.name, version)).map((one) => one.name);
for (const name of unpublished) console.log(`${name}@${version} is not on npm`);
// Asked only when it decides something: a push with changesets pending, or nothing to publish, needs no Nightly.
const needsNightly = pending.length === 0 && unpublished.length > 0;
const nightly = needsNightly ? nightlyOnTree(tree, nightlies(), repository) : null;

const latest = needsNightly ? latestOnNpm() ?? null : null;
const decision = decide({ versions, pending, unpublished, nightly, latest });
console.log(`${decision.path}: ${decision.reason}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `path=${decision.path}\nversion=${decision.version ?? ""}\n`);
}
if (decision.path === "blocked" || decision.path === "broken" || decision.path === "stale") {
  console.log(`::error::${decision.reason}`);
  process.exit(1);
}
