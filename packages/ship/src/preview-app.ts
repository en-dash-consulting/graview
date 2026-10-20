import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * AN APP DECLARED IN CODE, FOR THE PREVIEW'S PAGE (W-245).
 *
 * `graview preview` and `graview shots` drew a document only: the page is
 * built once and makes the app from what it is handed, and a document is
 * data. An app in code is a module — the one `graview check` loads — so the
 * page is handed that module instead, bundled here for the browser with
 * everything it imports, its own `@graview/core` among them (the framework's
 * marks are `Symbol.for`, one key across every copy). The store beside it
 * runs the module as Node loaded it: its acts, its rules and its labels are
 * the app's own on both sides, never a document's guess at them.
 */

/** What an esbuild module offers that this needs. */
interface Bundler {
  build(options: Record<string, unknown>): Promise<{ readonly outputFiles?: readonly { readonly text: string }[] }>;
}

/**
 * ESBUILD, FROM THE PROJECT THE COMMAND RUNS IN, then beside this package.
 * A project built with vite has it; nobody previewing a document needs it.
 * Null when neither has it.
 */
export async function findBundler(cwd = process.cwd(), beside: readonly string[] = [import.meta.url]): Promise<Bundler | null> {
  for (const from of [join(cwd, "package.json"), ...beside]) {
    try {
      const at = createRequire(from).resolve("esbuild");
      const module = (await import(pathToFileURL(at).href)) as Partial<Bundler> & { default?: Partial<Bundler> };
      const build = module.build ?? module.default?.build;
      if (typeof build === "function") return { build };
    } catch {
      // Not here; the next place, or none.
    }
  }
  return null;
}

export const NO_BUNDLER =
  "an app declared in code is bundled for the preview's page with esbuild, which this project does not have (a project built with vite has it):\n" +
  "  npm install --save-dev esbuild   (or pnpm add -D esbuild)\n" +
  "or hand it a declaration document (a .json file).\n";

/**
 * The app module `entry`, bundled for a browser as one ES module whose
 * `app` is the module's default export, or its `app`, as `graview check`
 * takes them. Throws with `NO_BUNDLER` when there is no esbuild to bundle it.
 */
export async function bundleAppForPage(entry: string, options: { readonly cwd?: string; readonly bundler?: Bundler | null } = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const bundler = options.bundler === undefined ? await findBundler(cwd) : options.bundler;
  if (!bundler) throw new Error(NO_BUNDLER);
  const path = resolve(cwd, entry);
  const built = await bundler.build({
    stdin: { contents: `import * as declared from ${JSON.stringify(path)};\nexport const app = declared.default ?? declared.app;\n`, resolveDir: dirname(path), sourcefile: "graview-preview-app.js", loader: "js" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  const text = built.outputFiles?.[0]?.text;
  if (text === undefined) throw new Error(`${entry} could not be bundled for the preview's page.`);
  return text;
}
