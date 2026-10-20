import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { GRAVIEW_PACKAGES } from "@graview/core/scaffold";
import { describe, expect, it } from "vitest";
import { sourceAliases, sourceEntries } from "../../src/dev.js";

/**
 * An app that runs the framework from its sources in development reads its
 * aliases from the packages' own `exports`, so a new subpath export cannot be
 * missed by an app's hand-written list: every export a product's dependency
 * names resolves to a file in its `src`, and no bare name swallows a subpath.
 */
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const aliases = sourceAliases(root);

/** What Vite does with an array of aliases: the first whose `find` matches. */
const resolveLike = (specifier: string) => aliases.find((alias) => alias.find.test(specifier))?.replacement;

function exportsOf(dir: string): Array<[string, string]> {
  const pkg = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, string | { default: string }>;
  };
  return Object.entries(pkg.exports).map(([subpath, value]) => [
    subpath === "." ? pkg.name : `${pkg.name}/${subpath.slice(2)}`,
    typeof value === "string" ? value : value.default,
  ]);
}

describe("the framework's sources, one alias per export", () => {
  it("resolves every built export of every package a product depends on to a source file that exists", () => {
    const missing: string[] = [];
    for (const dir of GRAVIEW_PACKAGES) {
      for (const [specifier, target] of exportsOf(dir)) {
        if (target.startsWith("./dist/") && !target.endsWith(".js")) continue; // a built file, left to ordinary resolution
        const source = resolveLike(specifier);
        if (!source || !existsSync(source)) missing.push(`${specifier} (${target})`);
        else if (target.endsWith(".js") && target.startsWith("./dist/")) {
          expect(relative(join(root, "packages", dir), source)).toMatch(/^src\/.+\.tsx?$/);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("matches each specifier exactly, so a bare name never swallows a subpath", () => {
    expect(resolveLike("@graview/core")).toBe(join(root, "packages/core/src/index.ts"));
    expect(resolveLike("@graview/core/words")).toBe(join(root, "packages/core/src/words.ts"));
    expect(resolveLike("@graview/primitives/pages")).toBe(join(root, "packages/primitives/src/pages.ts"));
    expect(resolveLike("@graview/embed/pages")).toBe(join(root, "packages/embed/src/pages.tsx"));
    expect(resolveLike("@graview/core/not-an-export")).toBeUndefined();
    // A built file nobody writes in src is the checkout's own build of it, which a linked project's link may not reach.
    expect(resolveLike("@graview/core/document.schema.json")).toBe(join(root, "packages/core/dist/document.schema.json"));
  });

  it("lists subpaths before bare names, for an app that adds prefix aliases after them", () => {
    const depth = aliases.map((alias) => alias.find.source.split("\\/").length);
    expect(depth).toEqual([...depth].sort((a, b) => b - a));
  });

  it("finds its own checkout when it is not told one", () => {
    expect(sourceAliases().map((alias) => alias.replacement)).toEqual(aliases.map((alias) => alias.replacement));
  });

  it("refuses a directory that is not a checkout rather than answering no aliases", () => {
    const elsewhere = mkdtempSync(join(tmpdir(), "graview-not-a-checkout-"));
    expect(() => sourceEntries(elsewhere)).toThrow(/has no packages\/ directory/);
  });
});
