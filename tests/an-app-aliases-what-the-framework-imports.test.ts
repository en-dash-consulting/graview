import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AN APP ALIASES EVERY SUBPATH THE FRAMEWORK IMPORTS. A vite alias is a
 * prefix: an app that maps "@graview/core" to core's index and does not map
 * "@graview/core/document" sends the studio's import of it to
 * "core/src/index.ts/document", and the app never starts — seedbed's studio
 * rehearsal timed out on exactly this when the studio began judging rules in
 * words. Every subpath a framework module imports in the browser has to be
 * aliased, ahead of its bare name, wherever the bare name is.
 */
const root = resolve(import.meta.dirname, "..");
/** Modules that run only in Node, and the scaffold's text: their subpath imports never reach an app's bundle. */
const NODE_ONLY = /(^|\/)(cli|dev|serve|file-adapter|sqlite)[^/]*\.ts$|\/cli\/|\/scaffold\/|\/packages\/(graview|create-graview)\//;

function importedSubpaths(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !NODE_ONLY.test(path)) {
        for (const [, spec] of readFileSync(path, "utf8").matchAll(/from "(@graview\/[a-z]+\/[a-z]+)"/g)) found.add(spec!);
      }
    }
  };
  for (const pkg of readdirSync(resolve(root, "packages"))) walk(resolve(root, "packages", pkg, "src"));
  return found;
}

describe("an app aliases what the framework imports", () => {
  const subpaths = [...importedSubpaths()].sort();
  const configs = readdirSync(resolve(root, "apps")).flatMap((app) =>
    readdirSync(resolve(root, "apps", app))
      .filter((file) => /^vite.*\.config\.ts$/.test(file))
      .map((file) => ({ name: `apps/${app}/${file}`, text: readFileSync(resolve(root, "apps", app, file), "utf8") })),
  );

  it("finds the subpaths the browser path imports", () => {
    expect(subpaths).toContain("@graview/core/document");
  });

  it.each(configs.map((config) => [config.name, config.text]))("%s aliases each one ahead of its bare name", (_, text) => {
    for (const subpath of subpaths) {
      const bare = subpath.split("/").slice(0, 2).join("/");
      if (!text.includes(`"${bare}":`)) continue;
      expect(text, subpath).toContain(`"${subpath}":`);
      expect(text.indexOf(`"${subpath}":`), `${subpath} before ${bare}`).toBeLessThan(text.indexOf(`"${bare}":`));
    }
  });
});
