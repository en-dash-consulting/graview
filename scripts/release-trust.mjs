#!/usr/bin/env node
/**
 * TRUST THE RELEASE WORKFLOW TO PUBLISH. Run once by a package owner, from a
 * machine logged in to npm (`npm login`).
 *
 * Each package's trusted publisher on npmjs.com names this repository, the
 * `release.yml` workflow and the `npm` environment. Until 0.1.9 it allowed
 * `npm stage publish` only, and a person approved each staged version with
 * their second factor; now the release job publishes, and the human gate is
 * the `npm` environment's required reviewer in GitHub. npm keeps one
 * configuration per package, so each is listed, revoked and created again
 * allowing publish.
 *
 * Every `npm trust` call asks for the second factor. The first is run where
 * you can answer it: npm opens a page, and on it you tick "skip two-factor
 * authentication for the next 5 minutes". The rest then run inside that
 * window, two seconds apart as npm asks. If the window closes first, this
 * stops and says so; running it again starts from what npm has then.
 *
 * Needs npm 12 (`npm trust`), run through npx.
 *
 *   node scripts/release-trust.mjs           say what would change (asks for the second factor once)
 *   node scripts/release-trust.mjs --apply   change it
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPOSITORY = "en-dash-consulting/graview";
const WORKFLOW = "release.yml";
const ENVIRONMENT = "npm";
const root = resolve(import.meta.dirname, "..");
const NPM = ["-y", "npm@12"];
const apply = process.argv.includes("--apply");
const pause = () => spawnSync("sleep", ["2"]);

const names = readdirSync(join(root, "packages"))
  .sort()
  .map((dir) => JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")))
  .filter((manifest) => !manifest.private)
  .map((manifest) => manifest.name);

/** An npm call whose answer is read; a second-factor refusal stops the run with what to do. */
const quiet = (args) => {
  const result = spawnSync("npx", [...NPM, ...args], { cwd: root, encoding: "utf8" });
  const said = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (/EOTP|one-time password/i.test(said)) {
    console.error("\nnpm asked for the second factor again: the five-minute window closed. Run this again; it starts from what npm has now.");
    process.exit(1);
  }
  if (/E401|ENEEDAUTH/i.test(said)) {
    console.error("\nnpm doesn't know who you are. Run `npm login`, then this again.");
    process.exit(1);
  }
  return { ok: result.status === 0, said, stdout: result.stdout ?? "" };
};
const listed = (name) => {
  const answer = quiet(["trust", "list", name, "--json"]);
  if (!answer.ok) return [];
  try {
    const parsed = JSON.parse(answer.stdout || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
};
const ours = (item) => JSON.stringify(item).includes(REPOSITORY);
const idOf = (item) => item.id ?? item.trustId ?? item.uuid;
const publishes = (item) => JSON.stringify(item).match(/"(allowPublish|allow_publish|publish)"\s*:\s*true/) !== null;

/* 1. The one call you answer: tick "skip two-factor authentication for the next 5 minutes". */
console.log(`Approve npm's second-factor page once, and tick "skip two-factor authentication for the next 5 minutes".\n`);
const first = spawnSync("npx", [...NPM, "trust", "list", names[0]], { cwd: root, stdio: "inherit" });
if (first.status !== 0) {
  console.error("\nnpm did not answer the first call; run this again.");
  process.exit(1);
}

/* 2. The rest, inside the window. */
let failed = 0;
for (const name of names) {
  pause();
  const existing = listed(name).filter(ours);
  const ids = existing.map(idOf).filter(Boolean);
  const already = existing.length === 1 && publishes(existing[0]);
  console.log(`\n${name}: ${existing.length} relationship(s) for ${REPOSITORY}${ids.length ? ` (${ids.join(", ")})` : ""}${already ? ", already allowing publish" : ""}`);
  if (already) continue;
  if (!apply) {
    console.log(`  would revoke ${ids.length} and trust ${WORKFLOW} in environment ${ENVIRONMENT} to publish`);
    continue;
  }
  for (const id of ids) {
    pause();
    const revoked = quiet(["trust", "revoke", name, `--id=${id}`, "--yes"]);
    if (!revoked.ok) {
      failed += 1;
      console.log(`  could not revoke ${id}:\n${revoked.said.trim()}`);
    }
  }
  pause();
  const created = quiet(["trust", "github", name, "--file", WORKFLOW, "--repository", REPOSITORY, "--environment", ENVIRONMENT, "--allow-publish", "--yes"]);
  if (created.ok) console.log(`  trusts ${WORKFLOW} (environment ${ENVIRONMENT}) to publish`);
  else {
    failed += 1;
    console.log(`  could not trust:\n${created.said.trim()}`);
  }
}
if (!apply) console.log("\nNothing changed. Run again with --apply to change it.");
else if (failed > 0) {
  console.error(`\n${failed} change(s) failed; run again — it starts from what npm has now.`);
  process.exit(1);
} else console.log(`\nAll ${names.length} packages trust ${REPOSITORY}'s ${WORKFLOW} (environment ${ENVIRONMENT}) to publish.`);
