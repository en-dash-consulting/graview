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
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  process.exit(0);
}

process.stderr.write(
  `These packages changed with no changeset: ${touchedPackages.join(", ")}\n\n` +
    "Run `pnpm changeset` and say what changed. Bumps default to patch here\n" +
    "unless there is a reason to say otherwise — a minor bump is a claim about\n" +
    "a new capability, and most changes are not.\n",
);
process.exit(1);
