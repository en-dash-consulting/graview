/**
 * `@graview/*` resolved to the workspace's own sources, for an esbuild
 * bundle that measures or serves what a product would bundle without
 * waiting on `pnpm build`. The bare name is a package's `src/index.ts`; a
 * subpath (`@graview/core/document`, `@graview/ship/browser`) is the module
 * of that name in its `src`, as the package's own `exports` map it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export function graviewSources(repo) {
  return {
    name: "graview-sources",
    setup(build) {
      build.onResolve({ filter: /^@graview\/[^/]+(\/.*)?$/ }, (args) => {
        const [, pkg, sub] = args.path.match(/^@graview\/([^/]+)(?:\/(.*))?$/);
        const src = join(repo, "packages", pkg, "src");
        if (!existsSync(src)) return undefined;
        const candidates = sub ? [join(src, `${sub}.ts`), join(src, `${sub}.tsx`), join(src, sub, "index.ts")] : [join(src, "index.ts")];
        const found = candidates.find((candidate) => existsSync(candidate));
        // Never a built copy instead: a measure of last week's dist is a measure of nothing.
        return found ? { path: found } : { errors: [{ text: `${args.path} has no source in packages/${pkg}/src` }] };
      });
    },
  };
}
