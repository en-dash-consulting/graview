#!/usr/bin/env node
/**
 * What would actually go in the tarball.
 *
 * A `files` allowlist is a claim, and the way it fails is silent: a stray
 * pattern ships `src/`, or a build artifact nobody meant to publish rides
 * along, and nobody notices until a stranger's `node_modules` is twice the
 * size it should be. `npm pack --dry-run --json` says exactly what would be
 * included, so this asserts against that rather than against the manifest.
 *
 *   node scripts/inspect-pack.mjs
 *
 * Writes docs/pack.json.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportsOf, unexported } from "./lib/readme-exports.mjs";
import { measureBudgets } from "./lib/bundle-budget.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const packagesDir = resolve(repoRoot, "packages");

/** Things that must never be in a published tarball, and why. */
const FORBIDDEN = [
  { pattern: /(^|\/)src\//, why: "source, which the declaration files already describe" },
  { pattern: /(^|\/)tests?\//, why: "tests, which nobody installing this runs" },
  { pattern: /\.tsbuildinfo$/, why: "an incremental build cache, valid only on the machine that made it" },
  { pattern: /\.test\.(ts|tsx|js)$/, why: "a test file" },
  { pattern: /(^|\/)node_modules\//, why: "vendored dependencies" },
  { pattern: /(^|\/)\.(env|npmrc)$/, why: "local configuration, and a place secrets live" },
];

/** Things that must BE there, or the package does not work when installed. */
const REQUIRED = [/(^|\/)dist\/index\.js$/, /(^|\/)dist\/index\.d\.ts$/, /(^|\/)README\.md$/];

const packDir = mkdtempSync(join(tmpdir(), "graview-pack-"));
const report = { at: new Date().toISOString(), packages: {} };
let failures = 0;
/** Each package as a stranger installs it: its tarball unpacked, for the README check after the loop. */
const unpacked = [];

for (const name of readdirSync(packagesDir).sort()) {
  const dir = resolve(packagesDir, name);
  const manifest = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));

  /*
   * `pnpm pack`, not `npm pack`.
   *
   * Only pnpm rewrites `workspace:*` into a real version range. A tarball
   * made with `npm pack` carries the literal `workspace:*` and is
   * uninstallable anywhere outside this repo — which is a thing nothing here
   * would have noticed, since inside the workspace it resolves fine. Found by
   * the smoke test next door.
   */
  const raw = execFileSync("pnpm", ["pack", "--pack-destination", packDir, "--json"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tarball = JSON.parse(raw.slice(raw.indexOf("{"))).filename ?? resolve(packDir, `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`);
  const files = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((entry) => !entry.endsWith("/"))
    .map((entry) => entry.replace(/^package\//, ""));
  const packed = { files, unpackedSize: 0 };
  const into = join(packDir, "unpacked", manifest.name.replace("/", "__"));
  mkdirSync(into, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", into]);
  const declarations = [];
  const types = (value) => {
    if (typeof value === "string") {
      if (value.endsWith(".d.ts")) declarations.push(join(into, "package", value.replace(/^\.\//, "")));
    } else if (value && typeof value === "object") Object.values(value).forEach(types);
  };
  types(manifest.exports ?? {});
  unpacked.push({ name: manifest.name, root: join(into, "package"), declarations });

  const forbidden = [];
  for (const rule of FORBIDDEN) {
    for (const file of files) {
      if (rule.pattern.test(file)) forbidden.push({ file, why: rule.why });
    }
  }
  const missing = REQUIRED.filter((rule) => !files.some((file) => rule.test(file))).map(String);

  /*
   * Every path an `exports` map promises has to exist in the tarball. An
   * export pointing at a file that was not packed is a package that installs
   * and then fails on import, which is the worst time to find out.
   */
  const promised = [];
  const walk = (value) => {
    if (typeof value === "string") promised.push(value.replace(/^\.\//, ""));
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(manifest.exports ?? {});
  walk(manifest.main ?? "");
  walk(manifest.types ?? "");
  for (const bin of Object.values(manifest.bin ?? {})) walk(bin);
  const unfulfilled = [...new Set(promised)].filter(
    (path) => path.length > 0 && !path.includes("*") && !files.includes(path),
  );

  const ok = forbidden.length === 0 && missing.length === 0 && unfulfilled.length === 0;
  if (!ok) failures += 1;
  report.packages[manifest.name] = {
    files: files.length,
    tarballBytes: statSync(tarball).size,
    ok,
    ...(forbidden.length ? { forbidden } : {}),
    ...(missing.length ? { missing } : {}),
    ...(unfulfilled.length ? { unfulfilled } : {}),
  };
  process.stdout.write(
    `${ok ? "ok  " : "FAIL"} ${manifest.name.padEnd(22)} ${String(files.length).padStart(4)} files, ${(
      statSync(tarball).size / 1024
    ).toFixed(0)}K\n`,
  );
  for (const entry of forbidden) process.stdout.write(`       ships ${entry.file} — ${entry.why}\n`);
  for (const entry of missing) process.stdout.write(`       missing ${entry}\n`);
  for (const entry of unfulfilled) process.stdout.write(`       exports promises ${entry}, not packed\n`);
}

/*
 * WHAT EACH README NAMES, SOME TARBALL EXPORTS (FR-15). Across packages,
 * because a README rightly names its neighbors' API (ship's names
 * `defineApp`); judged against what was packed, not what is in src.
 */
const exported = exportsOf(unpacked.flatMap((one) => one.declarations));
for (const one of unpacked) {
  const promised = unexported(join(one.root, "README.md"), exported);
  if (promised.length === 0) continue;
  failures += 1;
  report.packages[one.name] = { ...report.packages[one.name], ok: false, readmeNamesUnexported: promised };
  process.stdout.write(`FAIL ${one.name.padEnd(22)} README names ${promised.map((name) => `\`${name}\``).join(", ")}, which no packed package exports\n`);
}

/*
 * WHAT A FACE COSTS A HOST'S PAGE (FR-19). Each embed entry, bundled as a
 * product would bundle it, against its budget.
 */
report.budgets = await measureBudgets(repoRoot);
for (const one of report.budgets) {
  if (one.over) failures += 1;
  process.stdout.write(
    `${one.over ? "FAIL" : "ok  "} ${`@graview/embed: ${one.name}`.padEnd(36)} ${(one.minified / 1024).toFixed(0)}K minified (budget ${(one.budget.minified / 1024).toFixed(0)}K), ${(one.gzipped / 1024).toFixed(0)}K gzipped (budget ${(one.budget.gzipped / 1024).toFixed(0)}K)\n`,
  );
}

rmSync(packDir, { recursive: true, force: true });
report.passed = failures === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/pack.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.exit(failures === 0 ? 0 : 1);
