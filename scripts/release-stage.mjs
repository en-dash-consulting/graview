#!/usr/bin/env node
/**
 * STAGE, DON'T PUBLISH. The release workflow's publish step.
 *
 * Every package whose version is not yet on npm is packed by pnpm — which
 * turns each `workspace:` range into the version it names — and handed to
 * `npm stage publish`. Nothing goes live: npm holds each version until a
 * person approves it with their second factor (`pnpm release:approve`). The
 * trusted publisher on npmjs.com allows staging only, so a workflow that
 * reached `npm publish` is refused, which is the point: merging to main is
 * not, on its own, a release.
 *
 * Runs npm 12 (the `stage` command) through npx, with the OIDC token of the
 * `npm` environment; prints one line per package and exits non-zero if any
 * fails. `--dry-run` packs and asks npm to stage nothing.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "graview-stage-"));
const dryRun = process.argv.includes("--dry-run");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const onNpm = (name, version) => {
  try {
    return run("npm", ["view", `${name}@${version}`, "version"]).trim() === version;
  } catch {
    return false;
  }
};

let failed = 0;
for (const dir of readdirSync(join(root, "packages")).sort()) {
  const manifest = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
  if (manifest.private) continue;
  const spec = `${manifest.name}@${manifest.version}`;
  if (onNpm(manifest.name, manifest.version)) {
    console.log(`have   ${spec}`);
    if (!dryRun) continue;
  }
  try {
    const packed = run("pnpm", ["pack", "--pack-destination", out], join(root, "packages", dir)).trim().split("\n").at(-1).trim();
    const tarball = packed.startsWith("/") ? packed : join(out, packed);
    run("npx", ["-y", "npm@12", "stage", "publish", tarball, "--access", "public", ...(dryRun ? ["--dry-run"] : ["--provenance"])]);
    console.log(`staged ${spec}`);
  } catch (error) {
    failed += 1;
    console.log(`FAILED ${spec}\n${String(error.stderr ?? error.message).trim()}`);
  }
}
if (failed > 0) {
  console.log(`\n${failed} package(s) could not be staged.`);
  process.exit(1);
}
console.log("\nStaged. Approve them with `pnpm release:approve` (your second factor), which also tags and writes the releases.");
