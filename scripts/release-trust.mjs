#!/usr/bin/env node
/**
 * TRUST THE RELEASE WORKFLOW TO PUBLISH. Run once by a package owner, from a
 * machine logged in to npm (`npm login`).
 *
 * Each package's trusted publisher on npmjs.com names this repository, the
 * `release.yml` workflow and the `npm` environment. Until 0.1.9 it allowed
 * `npm stage publish` only, and a person approved each staged version with
 * their second factor; now the release job publishes, and the human gate is
 * the `npm` environment's required reviewer in GitHub. This replaces each
 * package's relationship for this repository with one that allows publish.
 *
 * Needs npm 12 (`npm trust`), run through npx. npm may ask for the second
 * factor on each change.
 *
 *   node scripts/release-trust.mjs           say what would change
 *   node scripts/release-trust.mjs --apply   change it
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPOSITORY = "en-dash-consulting/graview";
const WORKFLOW = "release.yml";
const ENVIRONMENT = "npm";
const root = resolve(import.meta.dirname, "..");
const NPM = ["-y", "npm@12"];
const apply = process.argv.includes("--apply");

const names = readdirSync(join(root, "packages"))
  .sort()
  .map((dir) => JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")))
  .filter((manifest) => !manifest.private)
  .map((manifest) => manifest.name);

const listed = (name) => {
  try {
    const raw = execFileSync("npx", [...NPM, "trust", "list", name, "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    const said = String(error.stdout ?? "") + String(error.stderr ?? "");
    if (/E401|authenticat|log ?in/i.test(said)) {
      console.error("npm doesn't know who you are. Run `npm login`, then this again.");
      process.exit(1);
    }
    return [];
  }
};
const ours = (item) => JSON.stringify(item).includes(REPOSITORY);
const npm = (args) => spawnSync("npx", [...NPM, ...args], { cwd: root, stdio: "inherit" }).status === 0;

let failed = 0;
for (const name of names) {
  const existing = listed(name).filter(ours);
  const ids = existing.map((item) => item.id ?? item.trustId ?? item.uuid).filter(Boolean);
  console.log(`\n${name}: ${existing.length} relationship(s) for ${REPOSITORY}${ids.length ? ` (${ids.join(", ")})` : ""}`);
  if (!apply) {
    console.log(`  would revoke ${ids.length} and trust ${WORKFLOW} in environment ${ENVIRONMENT} to publish`);
    continue;
  }
  for (const id of ids) if (!npm(["trust", "revoke", name, `--id=${id}`, "--yes"])) failed += 1;
  if (!npm(["trust", "github", name, "--file", WORKFLOW, "--repository", REPOSITORY, "--environment", ENVIRONMENT, "--allow-publish", "--yes"])) failed += 1;
}
if (!apply) console.log("\nNothing changed. Run again with --apply to change it.");
else if (failed > 0) {
  console.error(`\n${failed} change(s) failed; run again — it starts from what npm has now.`);
  process.exit(1);
} else console.log(`\nAll ${names.length} packages trust ${REPOSITORY}'s ${WORKFLOW} (environment ${ENVIRONMENT}) to publish.`);
