import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type AnySchema, type AppPlace, type GraviewApp } from "@graview/core";
import { placesOf } from "@graview/core/seat";

/**
 * THE PLACES A `graview shots` RUN PHOTOGRAPHS, by what was asked.
 *
 * Each of the app's places (`placesOf`: the home, the scene's overview,
 * each declared lens, each kind's list) by its address word or its title;
 * a path (`/tasks/t1`) is taken as it is. Nothing asked is every place.
 */
export interface Shot {
  /** The file's name, before the scheme and width: the place's address word, `-scene` when it is the place's stop in the scene. */
  readonly name: string;
  /** The address, with the scene's stop in its fragment. */
  readonly address: string;
  readonly scene: boolean;
}

const fileWord = (said: string) => said.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";

export function shotsOf(app: GraviewApp<AnySchema>, asked: readonly string[], faces: readonly ("pages" | "scene")[]): { readonly shots: readonly Shot[]; readonly unknown: readonly string[] } {
  const places = placesOf(app);
  const found: AppPlace[] = [];
  const paths: string[] = [];
  const unknown: string[] = [];
  for (const one of asked) {
    if (one.startsWith("/")) {
      paths.push(one);
      continue;
    }
    const place = places.find((p) => p.slug === one || p.title.toLowerCase() === one.toLowerCase()) ?? (one === "scene" ? places.find((p) => p.slug === "overview") : undefined);
    if (place) found.push(place);
    else unknown.push(one);
  }
  const chosen = asked.length === 0 ? places : found;
  const shots: Shot[] = [];
  for (const place of chosen) {
    // The overview IS the scene's place: one picture of it, whatever the faces.
    if (place.slug === "overview") {
      shots.push({ name: "overview", address: place.address, scene: true });
      continue;
    }
    if (faces.includes("pages")) shots.push({ name: place.slug, address: place.address, scene: false });
    if (faces.includes("scene")) shots.push({ name: `${place.slug}-scene`, address: `/places/overview${place.stop === "#" ? "" : place.stop}`, scene: true });
  }
  for (const path of paths) shots.push({ name: fileWord(path), address: path, scene: path.startsWith("/places/overview") });
  return { shots, unknown };
}

/** What a Playwright module offers that this needs. */
interface Engine {
  launch(options?: { headless?: boolean }): Promise<{
    newPage(options: { viewport: { width: number; height: number }; colorScheme: "light" | "dark"; deviceScaleFactor?: number }): Promise<{
      goto(url: string, options?: { waitUntil?: "load" }): Promise<unknown>;
      waitForFunction(fn: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
      waitForTimeout(ms: number): Promise<void>;
      evaluate<T>(fn: string): Promise<T>;
      screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
      close(): Promise<void>;
    }>;
    close(): Promise<void>;
  }>;
}

/**
 * PLAYWRIGHT, FROM THE PROJECT THE COMMAND RUNS IN.
 *
 * It is a peer the person installs: tens of megabytes of browser nobody
 * running `graview check` should download. Looked for beside the project
 * first (`npx graview` runs from a cache that cannot see it), then beside
 * this package. Null when neither has it.
 */
export async function findPlaywright(cwd = process.cwd(), beside: readonly string[] = [import.meta.url]): Promise<{ readonly chromium: Engine } | null> {
  for (const from of [join(cwd, "package.json"), ...beside]) {
    try {
      const at = createRequire(from).resolve("playwright");
      // CommonJS: its exports arrive named, or only on the default, as Node reads them.
      const module = (await import(pathToFileURL(at).href)) as { chromium?: Engine; default?: { chromium?: Engine } };
      const chromium = module.chromium ?? module.default?.chromium;
      if (chromium) return { chromium };
    } catch {
      // Not here; the next place, or none.
    }
  }
  return null;
}

export const NO_PLAYWRIGHT =
  "graview shots draws with Playwright, which this project does not have. It is a peer you install, not a dependency of graview:\n" +
  "  npm install --save-dev playwright   (or pnpm add -D playwright)\n" +
  "  npx playwright install chromium\n" +
  "then run graview shots again from the same directory.\n";

export interface ShootOptions {
  readonly url: string;
  readonly shots: readonly Shot[];
  readonly out: string;
  readonly schemes: readonly ("light" | "dark")[];
  readonly widths: readonly number[];
  readonly engine: { readonly chromium: Engine };
  /** Told each file as it is written. */
  readonly onShot?: (file: string) => void;
}

/** Every shot at every scheme and width, into `out` as `<name>-<scheme>-<width>.png`. Resolves to the files written. */
export async function shoot(options: ShootOptions): Promise<string[]> {
  mkdirSync(options.out, { recursive: true });
  const written: string[] = [];
  const browser = await options.engine.chromium.launch({ headless: true });
  try {
    for (const scheme of options.schemes) {
      for (const width of options.widths) {
        for (const shot of options.shots) {
          const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
          try {
            await page.goto(`${options.url}${shot.address}`, { waitUntil: "load" });
            await page.waitForFunction("window.__graviewReady === true || typeof window.__graviewFailed === 'string'", undefined, { timeout: 60_000 });
            const failed = await page.evaluate<string | undefined>("window.__graviewFailed");
            if (failed) throw new Error(failed);
            // Let a lazy part arrive and the scene settle before the picture is taken.
            await page.waitForTimeout(shot.scene ? 1800 : 700);
            const file = resolve(options.out, `${shot.name}-${scheme}-${width}.png`);
            await page.screenshot({ path: file, fullPage: !shot.scene });
            written.push(file);
            options.onShot?.(file);
          } finally {
            await page.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  return written;
}
