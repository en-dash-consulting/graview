#!/usr/bin/env node
/**
 * THE DEPENDENCIES A PULL REQUEST AND A RELEASE CARRY, CHECKED (HQ feature
 * f-dependency-security-gate).
 *
 *   node scripts/dependency-check.mjs [--base <ref>]
 *     `pnpm audit` over the workspace, each finding sorted by whether a
 *     published package reaches it (scripts/lib/dependency-check.mjs). Fails
 *     on a high or critical advisory that one does; reports the rest. Then
 *     the lockfile versions changed against <ref> (default origin/main).
 *
 *   node scripts/dependency-check.mjs signatures
 *     `npm audit signatures` over every package the lockfile installs on
 *     this machine. npm cannot read pnpm's layout (it sees the hoisted links
 *     at the root and little else), so the lockfile is installed again,
 *     frozen and with no scripts run, as a hoisted tree in a scratch
 *     directory, and npm checks that tree. Fails on a missing or invalid
 *     signature, and on a package the lockfile installs that npm did not see.
 *
 * Both write what they found to $GITHUB_STEP_SUMMARY when it is set.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changesMarkdown, failuresOf, findingsMarkdown, findingsOf, lockfileChanges, publishedReach, unseenByNpm } from "./lib/dependency-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}

function summary(markdown) {
  console.log(`${markdown}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n\n`);
}

function manifestOf(path) {
  try {
    return JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Every package installed under a directory's node_modules, nested ones too; a link (a workspace project) is not one. */
function installedUnder(dir, found = new Set()) {
  const modules = join(dir, "node_modules");
  if (!existsSync(modules)) return found;
  for (const entry of readdirSync(modules)) {
    if (entry.startsWith(".")) continue;
    const places = entry.startsWith("@") ? readdirSync(join(modules, entry)).map((name) => join(modules, entry, name)) : [join(modules, entry)];
    for (const place of places) {
      if (lstatSync(place).isSymbolicLink()) continue;
      const manifest = manifestOf(place);
      if (manifest?.name && manifest.version) found.add(`${manifest.name}@${manifest.version}`);
      installedUnder(place, found);
    }
  }
  return found;
}

function audit() {
  const listed = run("pnpm", ["--filter", "./packages/*", "list", "--prod", "--depth", "Infinity", "--json"]);
  if (listed.status !== 0) throw new Error(`pnpm list failed: ${listed.stderr}`);
  const trees = JSON.parse(listed.stdout);
  const listedNames = new Set(trees.map((tree) => tree.name));
  const published = readdirSync(join(root, "packages")).map((dir) => manifestOf(join(root, "packages", dir))).filter((manifest) => manifest && !manifest.private);
  const unlisted = published.filter((manifest) => !listedNames.has(manifest.name)).map((manifest) => manifest.name);
  if (published.length === 0 || unlisted.length > 0) throw new Error(`pnpm list did not list every published package: ${unlisted.join(", ") || "none found"}`);
  const reach = publishedReach(trees, manifestOf);

  // pnpm audit exits non-zero whenever it finds anything; what it found is the answer.
  const audited = run("pnpm", ["audit", "--json"]);
  let report;
  try {
    report = JSON.parse(audited.stdout);
  } catch {
    throw new Error(`pnpm audit did not answer with JSON (exit ${audited.status}): ${audited.stderr || audited.stdout.slice(0, 500)}`);
  }
  const rows = findingsOf(report, reach);
  summary(findingsMarkdown(rows));

  const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "origin/main";
  // An empty ref would read the index: the lockfile compared with itself.
  const before = base ? run("git", ["show", `${base}:pnpm-lock.yaml`]) : { status: 1 };
  if (before.status === 0) summary(changesMarkdown(lockfileChanges(before.stdout, readFileSync(join(root, "pnpm-lock.yaml"), "utf8")), base));
  else summary(`### Lockfile versions changed against \`${base}\`\n\n\`${base}\` could not be read here, so the lockfile was not compared.`);

  const failures = failuresOf(rows);
  for (const failure of failures) console.error(`::error::${failure}`);
  return failures.length === 0 ? 0 : 1;
}

function signatures() {
  const scratch = mkdtempSync(join(tmpdir(), "graview-signatures-"));
  try {
    const projects = run("pnpm", ["list", "--recursive", "--depth", "-1", "--json"]);
    if (projects.status !== 0) throw new Error(`pnpm list failed: ${projects.stderr}`);
    const places = JSON.parse(projects.stdout).map((project) => relative(root, project.path));
    for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) copyFileSync(join(root, file), join(scratch, file));
    for (const place of places) {
      mkdirSync(join(scratch, place), { recursive: true });
      copyFileSync(join(root, place, "package.json"), join(scratch, place, "package.json"));
    }
    const install = run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts", "--config.node-linker=hoisted"], { cwd: scratch, stdio: ["ignore", "inherit", "inherit"] });
    if (install.status !== 0) throw new Error(`the hoisted install of the lockfile failed (exit ${install.status})`);
    // npm reads a workspace from package.json, not pnpm-workspace.yaml, and
    // finds it by its link in the root's node_modules, which a hoisted pnpm
    // install does not make. Without both, every project's dependencies are
    // extraneous to npm, and npm checks a package only through a dependency
    // that reaches it.
    const workspaces = places.filter((place) => place !== "");
    const manifest = JSON.parse(readFileSync(join(scratch, "package.json"), "utf8"));
    writeFileSync(join(scratch, "package.json"), `${JSON.stringify({ ...manifest, workspaces }, null, 2)}\n`);
    for (const place of workspaces) {
      const link = join(scratch, "node_modules", manifestOf(join(scratch, place)).name);
      if (existsSync(link)) continue;
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(relative(dirname(link), join(scratch, place)), link, "dir");
    }

    // The release age is pnpm's to hold when the lockfile takes a version; asked
    // of npm here, a user's own `min-release-age` refuses this week's versions
    // before it reads one signature.
    const env = { ...process.env, npm_config_min_release_age: "0" };
    const tree = run("npm", ["ls", "--all", "--json"], { cwd: scratch, env });
    const installed = installedUnder(scratch);
    for (const place of places) if (place !== "") installedUnder(join(scratch, place), installed);
    const coverage = unseenByNpm(installed, JSON.parse(tree.stdout || "{}"), readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"));
    const checked = run("npm", ["audit", "signatures"], { cwd: scratch, env });
    const said = `${checked.stdout}${checked.stderr}`.split("\n").filter((line) => !/^npm warn Unknown (env|project|user) config/.test(line)).join("\n").trim();

    const lines = ["### Registry signatures", "", "```", said, "```", ""];
    lines.push(`${coverage.installed} packages installed, every one in the tree npm checked${coverage.unseen.length > 0 ? " but those below" : ""}; ${coverage.notInstalled} more in the lockfile are not installed on this platform.`);
    if (coverage.unseen.length > 0) lines.push("", `Installed and not checked: ${coverage.unseen.join(", ")}.`);
    summary(lines.join("\n"));
    if (checked.status !== 0) console.error("::error::npm audit signatures found a missing or invalid signature");
    if (coverage.unseen.length > 0) console.error(`::error::npm did not check ${coverage.unseen.length} installed package(s)`);
    return checked.status === 0 && coverage.unseen.length === 0 ? 0 : 1;
  } finally {
    if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
  }
}

try {
  process.exit(args[0] === "signatures" ? signatures() : audit());
} catch (error) {
  console.error(`::error::${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
