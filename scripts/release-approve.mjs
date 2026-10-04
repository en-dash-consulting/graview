#!/usr/bin/env node
/**
 * APPROVE WHAT CI STAGED, THEN SAY SO EVERYWHERE. `pnpm release:approve`,
 * run by a person on main after a "Version packages" merge.
 *
 * The release workflow stages every package (`scripts/release-stage.mjs`);
 * nothing is live until somebody with the second factor approves it. This
 * finds the staged versions of this repository's packages, approves each —
 * npm asks for the second factor in the browser — waits until npm serves
 * every one (it takes a few minutes to process), then pushes a
 * `<name>@<version>` tag for each at HEAD and writes a GitHub release from
 * the package's changelog section, the CLI's marked latest. Each step skips
 * what is already done, so it can be run again after an interruption.
 *
 *   pnpm release:approve            approve, tag, release
 *   pnpm release:approve --list     only say what is staged
 *   pnpm release:approve --otp=<c>  approve them all at once with an authenticator code
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const NPM = ["-y", "npm@12"];
const quiet = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const loud = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
};

const packages = readdirSync(join(root, "packages"))
  .sort()
  .map((dir) => ({ dir, ...JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) }))
  .filter((manifest) => !manifest.private);
const version = packages.find((one) => one.name === "graview")?.version;
if (!version || packages.some((one) => one.version !== version)) {
  console.error("The packages do not share one version here; run this on main after the Version packages merge.");
  process.exit(1);
}
const ask = async (question) => {
  const line = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await line.question(question)).trim();
  } finally {
    line.close();
  }
};
const live = (name) => {
  try {
    return quiet("npm", ["view", `${name}@${version}`, "version", "--prefer-online"]).trim() === version;
  } catch {
    return false;
  }
};

/* 1. What is staged, read defensively: npm's list is young and its fields may be named either way. */
const staged = JSON.parse(quiet("npx", [...NPM, "stage", "list", "--json"]) || "[]");
const field = (item, ...names) => names.map((name) => item?.[name]).find((value) => value !== undefined);
const ours = new Map(packages.map((one) => [one.name, one]));
const waiting = (Array.isArray(staged) ? staged : [])
  .map((item) => ({ id: field(item, "id", "stageId", "stage_id", "uuid"), name: field(item, "name", "package", "packageName"), version: field(item, "version") }))
  .filter((item) => item.id && ours.has(item.name) && item.version === version);
const missing = packages.filter((one) => !live(one.name) && !waiting.some((item) => item.name === one.name));

console.log(`${version}: ${waiting.length} staged, ${packages.filter((one) => live(one.name)).length} already live, ${missing.length} neither.`);
for (const item of waiting) console.log(`  staged  ${item.name}@${item.version}  (${item.id})`);
for (const one of missing) console.log(`  missing ${one.name}@${version}`);
if (missing.length > 0) {
  console.error("\nSome versions are neither staged nor live. Did the release run stage them? npm's list as it came:");
  console.error(JSON.stringify(staged, null, 2));
  process.exit(1);
}
if (process.argv.includes("--list")) process.exit(0);

/*
 * 2. Approve. With no code, npm asks for the second factor in the browser
 * for each (tick its five-minute skip on the first and the rest go
 * through). With `--otp=<code>` from an authenticator app, every approval
 * goes at once inside the code's thirty seconds; any npm refuses (a code
 * it would not take twice, say) is asked again with a fresh code.
 */
let otp = process.argv.find((arg) => arg.startsWith("--otp="))?.slice("--otp=".length);
const approve = (item, code) =>
  new Promise((done) => {
    const child = spawn("npx", [...NPM, "stage", "approve", item.id, ...(code ? ["--otp", code] : [])], { cwd: root, stdio: code ? ["ignore", "pipe", "pipe"] : "inherit" });
    let said = "";
    child.stdout?.on("data", (chunk) => (said += chunk));
    child.stderr?.on("data", (chunk) => (said += chunk));
    child.on("close", (status) => done({ item, ok: status === 0, said }));
  });
let left = waiting;
while (left.length > 0) {
  if (!otp) {
    for (const item of left) {
      console.log(`\napproving ${item.name}@${item.version}`);
      loud("npx", [...NPM, "stage", "approve", item.id]);
    }
    break;
  }
  console.log(`approving ${left.length} with one code`);
  const results = await Promise.all(left.map((item) => approve(item, otp)));
  for (const result of results) console.log(`  ${result.ok ? "approved" : "refused "} ${result.item.name}@${result.item.version}`);
  left = results.filter((result) => !result.ok).map((result) => result.item);
  if (left.length === 0) break;
  console.log(results.find((result) => !result.ok)?.said.trim().split("\n").slice(-3).join("\n"));
  otp = await ask(`A fresh code for the ${left.length} left (empty to approve them in the browser): `);
}

/* 3. Live everywhere: npm processes a version for a few minutes before it serves it. */
const deadline = Date.now() + 20 * 60_000;
let pending = packages.filter((one) => !live(one.name));
while (pending.length > 0 && Date.now() < deadline) {
  console.log(`waiting for npm to serve ${pending.length}: ${pending.map((one) => one.name).join(", ")}`);
  await new Promise((done) => setTimeout(done, 20_000));
  pending = pending.filter((one) => !live(one.name));
}
if (pending.length > 0) {
  console.error(`npm is not serving ${pending.map((one) => one.name).join(", ")} after twenty minutes; run this again later.`);
  process.exit(1);
}

/* 4. Tags at HEAD, pushed; a GitHub release each, from its changelog. */
const head = quiet("git", ["rev-parse", "HEAD"]).trim();
const tags = packages.map((one) => `${one.name}@${version}`);
for (const tag of tags) {
  try {
    quiet("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  } catch {
    quiet("git", ["tag", tag, head]);
  }
}
loud("git", ["push", "origin", ...tags.map((tag) => `refs/tags/${tag}`)]);
for (const one of packages) {
  const tag = `${one.name}@${version}`;
  if (spawnSync("gh", ["release", "view", tag], { cwd: root, stdio: "ignore" }).status === 0) {
    console.log(`have release ${tag}`);
    continue;
  }
  const changelog = readFileSync(join(root, "packages", one.dir, "CHANGELOG.md"), "utf8");
  const section = changelog.split(/^## /m).find((part) => part.startsWith(`${version}\n`))?.slice(version.length + 1).trim();
  const notes = join(tmpdir(), `graview-release-${one.dir}.md`);
  writeFileSync(notes, section || `Released with the rest of Graview ${version}.`);
  loud("gh", ["release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", notes, one.name === "graview" ? "--latest" : "--latest=false"]);
}
console.log(`\nGraview ${version} is live: ${packages.length} packages, tagged and released.`);
