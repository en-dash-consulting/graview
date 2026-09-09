/**
 * The packages, packed — the way a stranger would receive them.
 *
 * `pnpm pack`, not `npm pack`: only pnpm rewrites `workspace:*` into a real
 * version range, and a tarball carrying the literal `workspace:*` is
 * uninstallable anywhere outside this repo. Nothing else would notice, since
 * inside the workspace it resolves fine.
 *
 * Returns { "@graview/core": "/abs/path/graview-core-0.0.0.tgz", ... }.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function packTarballs(repoRoot, into) {
  const tarballs = {};
  for (const name of readdirSync(resolve(repoRoot, "packages")).sort()) {
    const dir = resolve(repoRoot, "packages", name);
    const manifest = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
    execFileSync("pnpm", ["pack", "--pack-destination", into], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    tarballs[manifest.name] = resolve(
      into,
      `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`,
    );
  }
  return tarballs;
}

/**
 * Points every `@graview/*` (and `create-graview`) specifier in a manifest at
 * its tarball, with `overrides` so the packages' dependencies on EACH OTHER
 * — by a version that is on no registry — resolve to what was just built.
 */
export function pinToTarballs(manifest, tarballs) {
  const pin = (deps = {}) =>
    Object.fromEntries(
      Object.entries(deps).map(([name, spec]) => [name, tarballs[name] ? `file:${tarballs[name]}` : spec]),
    );
  const overrides = Object.fromEntries(Object.entries(tarballs).map(([name, file]) => [name, `file:${file}`]));
  return {
    ...manifest,
    ...(manifest.dependencies ? { dependencies: pin(manifest.dependencies) } : {}),
    ...(manifest.devDependencies ? { devDependencies: pin(manifest.devDependencies) } : {}),
    // npm reads `overrides`; pnpm reads `pnpm.overrides`. Both, so the same
    // manifest installs under either.
    overrides,
    pnpm: { ...(manifest.pnpm ?? {}), overrides },
  };
}
