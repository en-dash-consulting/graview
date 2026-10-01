import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The first thing the walkthrough asks anyone to do is
 * `pnpm install && pnpm build && pnpm test` in a checkout with nothing built
 * in it. That only works if every workspace name a test imports is reachable
 * after exactly those two steps.
 *
 * There are two ways to be reachable, and a name has to take one of them:
 * vitest resolves it to a source file by an alias, or `pnpm build` compiles
 * the package it names. The example apps take neither by default — `build`
 * compiles the packages and leaves `apps/` to `typecheck` — so a test that
 * reaches across to `@graview/todo` resolves through a `dist/` that a fresh
 * checkout does not have. It passed on this repository for as long as it did
 * because every machine that ran it had run `pnpm typecheck` at some point.
 */
describe("a fresh checkout can run its own setup", () => {
  const root = resolve(import.meta.dirname, "..");

  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  /** The packages `pnpm build` compiles, so their `dist/` exists afterwards. */
  const built = new Set(
    (manifest.scripts.build.match(/packages\/[a-z-]+/g) ?? []).map(
      (p) => p.replace("packages/", ""),
    ),
  );

  const config = readFileSync(resolve(root, "vitest.config.ts"), "utf8");

  /** The specifiers vitest resolves to a source file, and where each points. */
  const aliases = new Map<string, string>();
  for (const [, name, dir] of config.matchAll(
    /"(@graview\/[a-z/-]+)":\s*src\("([a-z-]+)"\)/g,
  )) {
    aliases.set(name, `packages/${dir}/src/index.ts`);
  }
  for (const [, name, dir] of config.matchAll(
    /"(@graview\/[a-z/-]+)":\s*app\("([a-z-]+)"\)/g,
  )) {
    aliases.set(name, `apps/${dir}/src/index.ts`);
  }
  // The few written out longhand rather than through the helpers.
  for (const [, name, path] of config.matchAll(
    /"(@graview\/[a-z/-]+)":\s*fileURLToPath\(\s*new URL\("\.\/([^"]+)"/g,
  )) {
    aliases.set(name, path);
  }

  const testFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.test\.tsx?$/.test(entry)) testFiles.push(full);
    }
  };
  for (const where of ["packages", "apps", "tests"]) walk(resolve(root, where));

  /**
   * And what those tests reach: an app's own source imports other apps, and
   * a name it imports is resolved the same way. Rota was reached only from
   * the launcher's and seedbed's sources, so a fresh checkout failed here
   * and this check, reading test files alone, said nothing (W-153).
   */
  const sourceFiles: string[] = [];
  for (const app of readdirSync(resolve(root, "apps"))) {
    const dir = resolve(root, "apps", app, "src");
    const walkSource = (at: string) => {
      for (const entry of readdirSync(at)) {
        const full = resolve(at, entry);
        if (statSync(full).isDirectory()) walkSource(full);
        else if (/\.tsx?$/.test(entry)) sourceFiles.push(full);
      }
    };
    try {
      walkSource(dir);
    } catch {
      // An app without a src/ (none yet) has nothing to reach.
    }
  }

  it("has test files to check", () => {
    expect(testFiles.length).toBeGreaterThan(20);
  });

  it("resolves every workspace name its tests import without a dist that build does not write", () => {
    const unreachable = new Map<string, string[]>();
    for (const file of [...testFiles, ...sourceFiles]) {
      const source = readFileSync(file, "utf8");
      for (const [, specifier] of source.matchAll(/from "(@graview\/[a-z/-]+)"/g)) {
        if (aliases.has(specifier)) continue;
        // Not aliased: node resolution will want the package's own entry, so
        // `pnpm build` has to have written it.
        const pkg = specifier.split("/")[1];
        if (built.has(pkg)) continue;
        const at = unreachable.get(specifier) ?? [];
        at.push(file.slice(root.length + 1));
        unreachable.set(specifier, at);
      }
    }
    expect(Object.fromEntries(unreachable)).toEqual({});
  });

  it("points every alias at a file that is there", () => {
    const missing = [...aliases].filter(([, target]) => {
      try {
        return !statSync(resolve(root, target)).isFile();
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
