#!/usr/bin/env node
/**
 * PUBLISH WHAT IS NOT ON NPM, THEN SAY SO EVERYWHERE. The release workflow's
 * publish step, run in the `npm` environment once a person has approved the
 * job in GitHub.
 *
 * Every package whose version is not yet on npm is packed by pnpm — which
 * turns each `workspace:` range into the version it names — and published by
 * npm trusted publishing (the job's OIDC token; no long-lived token anywhere),
 * with provenance. Then a `<name>@<version>` tag for each at HEAD is pushed,
 * and a GitHub release is written from the package's changelog section, the
 * CLI's marked latest. The `graview` and `@graview/embed` releases also say
 * what the hosted page weighs up front, by package, and its headroom
 * (lib/hosted-page-notes.mjs, FR-104). Each step skips what is already done, so a run that
 * stopped part way is finished by running it again.
 *
 * The human gate is the environment's required reviewer, not a second factor
 * per package: one approval releases all fourteen.
 *
 *   node scripts/release-publish.mjs            publish, tag, release
 *   node scripts/release-publish.mjs --dry-run  pack and ask npm to publish nothing
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostedPageNotes } from "./lib/hosted-page-notes.mjs";

const root = resolve(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "graview-publish-"));
const dryRun = process.argv.includes("--dry-run");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const onNpm = (name, version) => {
  try {
    return run("npm", ["view", `${name}@${version}`, "version", "--prefer-online"]).trim() === version;
  } catch {
    return false;
  }
};

const packages = readdirSync(join(root, "packages"))
  .sort()
  .map((dir) => ({ dir, ...JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) }))
  .filter((manifest) => !manifest.private);
const version = packages.find((one) => one.name === "graview")?.version;
if (!version || packages.some((one) => one.version !== version)) {
  console.error("The packages do not share one version; the Version packages merge is what makes them agree.");
  process.exit(1);
}

/* 1. Publish each package npm does not have yet. */
let failed = 0;
for (const one of packages) {
  const spec = `${one.name}@${version}`;
  if (onNpm(one.name, version)) {
    console.log(`have      ${spec}`);
    if (!dryRun) continue;
  }
  try {
    const packed = run("pnpm", ["pack", "--pack-destination", out], join(root, "packages", one.dir)).trim().split("\n").at(-1).trim();
    const tarball = packed.startsWith("/") ? packed : join(out, packed);
    run("npm", ["publish", tarball, "--access", "public", ...(dryRun ? ["--dry-run"] : ["--provenance"])]);
    console.log(`published ${spec}`);
  } catch (error) {
    failed += 1;
    console.log(`FAILED    ${spec}\n${String(error.stderr ?? error.message).trim()}`);
  }
}
if (failed > 0) {
  console.log(`\n${failed} package(s) could not be published; run the job again once the cause is fixed.`);
  process.exit(1);
}
if (dryRun) process.exit(0);

/* 2. Tags at HEAD, pushed; a GitHub release each, from its changelog. */
const head = run("git", ["rev-parse", "HEAD"]).trim();
const tags = packages.map((one) => `${one.name}@${version}`);
for (const tag of tags) {
  try {
    run("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  } catch {
    run("git", ["tag", tag, head]);
  }
}
run("git", ["push", "origin", ...tags.map((tag) => `refs/tags/${tag}`)]);
/* The hosted page's weight, measured once, under the releases Graview Cloud reads (FR-104). */
const WEIGHED = new Set(["graview", "@graview/embed"]);
let weight;
for (const one of packages) {
  const tag = `${one.name}@${version}`;
  if (spawnSync("gh", ["release", "view", tag], { cwd: root, stdio: "ignore" }).status === 0) {
    console.log(`have release ${tag}`);
    continue;
  }
  const notes = join(out, `notes-${one.dir}.md`);
  if (WEIGHED.has(one.name)) weight ??= (await hostedPageNotes(root)) ?? "";
  writeFileSync(notes, [releaseNotes(one), WEIGHED.has(one.name) ? weight : ""].filter(Boolean).join("\n\n"));
  run("gh", ["release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", notes, one.name === "graview" ? "--latest" : "--latest=false"]);
  console.log(`released  ${tag}`);
}
console.log(`\nGraview ${version} is live: ${packages.length} packages, tagged and released.`);

/**
 * A release's notes are its changelog section, and the section of every
 * version before it that never reached npm: a Version packages merge that
 * was never released (0.1.13) leaves its changes under its own heading, and
 * they ship in the next version that is. Each such section is said under its
 * own heading, so a reader of the release sees everything it brings.
 */
function releaseNotes(one) {
  const changelog = readFileSync(join(root, "packages", one.dir, "CHANGELOG.md"), "utf8");
  const sections = changelog
    .split(/^## /m)
    .slice(1)
    .map((part) => ({ version: part.slice(0, part.indexOf("\n")).trim(), body: part.slice(part.indexOf("\n") + 1).trim() }));
  const at = sections.findIndex((section) => section.version === version);
  if (at < 0) return `Released with the rest of Graview ${version}.`;
  const said = [sections[at].body];
  for (const earlier of sections.slice(at + 1)) {
    if (onNpm(one.name, earlier.version)) break;
    said.push(`## ${earlier.version} (never published; released in ${version})\n\n${earlier.body}`);
  }
  return said.filter(Boolean).join("\n\n");
}
