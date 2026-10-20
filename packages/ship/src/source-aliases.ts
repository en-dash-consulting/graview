import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * THE FRAMEWORK FROM ITS SOURCES, ONE ALIAS PER EXPORT.
 *
 * An app that runs Graview from a checkout in development — the framework's
 * own apps, and a product linked to a sibling checkout by path — points its
 * bundler at each package's `src` rather than its `dist`, so an edit to the
 * framework is live without a build. Every such app used to list one alias
 * per entry point by hand, and every new subpath export (`@graview/core/words`,
 * `@graview/layout/view`, `@graview/primitives/pages`, …) broke each app that
 * missed it: the bare name's alias swallowed the subpath, and the page
 * answered 500 for a file that was never there.
 *
 * These are read from the packages' own `exports` instead. Each export whose
 * target is `./dist/<path>.js` is aliased to `src/<path>.ts` (or `.tsx`), and
 * an export of a file that ships as it is (`@graview/guest/client.js`, the
 * primitives' fonts) to that file. Each `find` matches its specifier exactly,
 * so `@graview/core` never swallows `@graview/core/words` whatever the order,
 * and a built file nobody writes in `src` (`@graview/core/document.schema.json`)
 * is left to ordinary resolution. They are listed subpaths first all the same,
 * for a reader and for an app that adds its own prefix aliases after them.
 *
 * Development only. An installed `@graview/ship` carries `dist` and no `src`,
 * so this throws there rather than answering an empty list that would leave
 * the app quietly on its `dist`.
 */
export interface SourceAlias {
  readonly find: RegExp;
  readonly replacement: string;
}

/** One export of one package, and where its source is (none for a built file left alone). */
export interface SourceEntry {
  readonly specifier: string;
  readonly target: string;
  readonly source: string | undefined;
}

/** The checkout this file is in: `packages/ship/{src,dist}/source-aliases.*` is three levels down. */
function thisCheckout(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}

function targetOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const conditions = value as Record<string, unknown>;
    for (const key of ["default", "import", "browser"]) {
      const found = targetOf(conditions[key]);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Every export of every framework package under `<root>/packages`: the
 * `@graview/*` packages and `graview` itself, each export paired with the
 * file the bundler should read in development.
 */
export function sourceEntries(root: string = thisCheckout()): SourceEntry[] {
  const packages = join(resolve(root), "packages");
  if (!existsSync(packages)) {
    throw new Error(
      `sourceAliases reads the framework's sources from a checkout, and ${resolve(root)} has no packages/ directory. ` +
        "An installed @graview/ship carries dist only: pass the checkout's root, or drop the aliases and use the installed packages.",
    );
  }
  const entries: SourceEntry[] = [];
  for (const dir of readdirSync(packages).sort()) {
    const manifest = join(packages, dir, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; exports?: Record<string, unknown> };
    const name = pkg.name ?? "";
    if (!name.startsWith("@graview/") && name !== "graview") continue;
    for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
      const target = targetOf(value);
      if (!target) continue;
      const specifier = subpath === "." ? name : `${name}/${subpath.replace(/^\.\//, "")}`;
      const built = /^\.\/dist\/(.+)\.js$/.exec(target);
      if (built) {
        const stem = join(packages, dir, "src", built[1]!);
        const source = [".ts", ".tsx"].map((ext) => stem + ext).find((file) => existsSync(file));
        if (!source) {
          throw new Error(
            `${specifier} is exported as ${target}, and ${dir}/src has neither ${built[1]}.ts nor ${built[1]}.tsx to run it from.`,
          );
        }
        entries.push({ specifier, target, source });
        continue;
      }
      const file = join(packages, dir, target);
      entries.push({ specifier, target, source: !target.startsWith("./dist/") && existsSync(file) ? file : undefined });
    }
  }
  return entries;
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * The aliases, for `resolve.alias` in a Vite config (an array; spread an
 * app's own after it):
 *
 * ```ts
 * import { sourceAliases } from "@graview/ship/dev";
 * export default defineConfig({ resolve: { alias: sourceAliases() } });
 * ```
 *
 * `root` is the framework checkout (the directory holding `packages/`); by
 * default, the one this `@graview/ship` was loaded from — a product linked
 * by path passes its sibling checkout to say so.
 */
export function sourceAliases(root?: string): SourceAlias[] {
  return sourceEntries(root)
    .filter((entry): entry is SourceEntry & { source: string } => entry.source !== undefined)
    .sort((a, b) => b.specifier.split("/").length - a.specifier.split("/").length || a.specifier.localeCompare(b.specifier))
    .map((entry) => ({ find: new RegExp(`^${escaped(entry.specifier)}$`), replacement: entry.source }));
}
