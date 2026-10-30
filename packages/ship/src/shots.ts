import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { placePath, placeSlug, type AnySchema, type AppPlace, type GraviewApp } from "@graview/core";
import { MEASURE_PICTURED_PAGE, picturedCoverage, type PageMeasure, type PictureCoverage } from "@graview/core/revisions";
import { placesOf } from "@graview/core/seat";
import { keyedAddress } from "./serve-preview.js";

/**
 * THE PLACES A `graview shots` RUN PHOTOGRAPHS, by what was asked.
 *
 * Each of the app's places (`placesOf`: the home, the scene's overview,
 * each declared lens, each kind's list) by its address word or its title;
 * a path (`/tasks/t1`) is taken as it is. Nothing asked is every place.
 * A titled view proposed and not kept (`--view`, `--manifest`) is a place
 * too, by its title and its address word, as it would be kept (W-243).
 */
export interface Shot {
  /** The file's name, before the scheme and width: the place's address word, `-scene` when it is the place's stop in the scene. */
  readonly name: string;
  /** The address, with the scene's stop in its fragment. */
  readonly address: string;
  readonly scene: boolean;
}

const fileWord = (said: string) => said.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";

export function shotsOf(app: GraviewApp<AnySchema>, asked: readonly string[], faces: readonly ("pages" | "scene")[], draft?: unknown): { readonly shots: readonly Shot[]; readonly unknown: readonly string[] } {
  const places: AppPlace[] = [...placesOf(app)];
  const drafted = draftPlace(draft);
  if (drafted && !places.some((place) => place.slug === drafted.slug)) places.push(drafted);
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

/** A draft view's place, from its manifest, when it has a title: where the page draws it, `/places/<its address word>`. */
function draftPlace(manifest: unknown): AppPlace | undefined {
  const { title, attach } = (typeof manifest === "object" && manifest !== null ? manifest : {}) as { title?: unknown; attach?: unknown };
  if (typeof title !== "string" || placeSlug(title) === "") return undefined;
  const slug = placeSlug(title);
  return { slug, title, kind: typeof attach === "string" && attach !== "home" ? attach : null, cardinality: "many", address: placePath(slug), stop: `#view=${slug}` };
}

/** What a Playwright module offers that this needs. */
interface Engine {
  launch(options?: { headless?: boolean }): Promise<{
    newPage(options: { viewport: { width: number; height: number }; colorScheme: "light" | "dark"; deviceScaleFactor?: number }): Promise<{
      goto(url: string, options?: { waitUntil?: "load" }): Promise<unknown>;
      waitForFunction(fn: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
      waitForTimeout(ms: number): Promise<void>;
      evaluate<T>(fn: string): Promise<T>;
      setViewportSize(size: { width: number; height: number }): Promise<void>;
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
  /** The preview's run key, when it keeps one: every page opens its address with it. */
  readonly key?: string;
  readonly shots: readonly Shot[];
  readonly out: string;
  readonly schemes: readonly ("light" | "dark")[];
  readonly widths: readonly number[];
  readonly engine: { readonly chromium: Engine };
  /** Told each file as it is written, and how much of the place it holds: `coverage.whole` is false when the place was taller than the picture, and `coverage.said` names the sections it left out. */
  readonly onShot?: (file: string, coverage?: PictureCoverage) => void;
}

/**
 * HOW MUCH OF THE PLACE IS PAST THE WINDOW'S FOOT, in the box the page
 * scrolls in. The page the preview serves is the app's embed, a box the
 * window's height with the bar on top, and the place scrolls inside it
 * (`[data-embed-content]`), not the document: Playwright's `fullPage` sees
 * only the document, so a long place stopped at the window. Any other page
 * shots is pointed at: the tallest box that scrolls, when it is most of the
 * window, and nothing when the document itself scrolls.
 */
export const OVERFLOW_PAST_THE_WINDOW = `(() => {
  const scrolls = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1;
  const content = document.querySelector("[data-embed-content]");
  const box = content && scrolls(content)
    ? content
    : [...document.querySelectorAll("body *")].filter((el) => scrolls(el) && el.clientHeight >= innerHeight / 2).sort((a, b) => b.clientHeight - a.clientHeight)[0];
  return box ? Math.ceil(box.scrollHeight - box.clientHeight) : 0;
})()`;

/** Chromium's tallest picture is 16,384 pixels; a place past that is pictured to there. */
export const TALLEST_SHOT = 16_000;

/**
 * THE WHOLE PLACE, NOT THE WINDOW'S WORTH: the window grown by what the
 * place's scroller still hides, until nothing is hidden. The embed measures
 * the window again on a resize (its `100dvh`), so its box grows with it; a
 * place that draws more when it has more room is measured again after it
 * has, a few times at most.
 */
export async function wholePlace(page: { evaluate<T>(fn: string): Promise<T>; setViewportSize(size: { width: number; height: number }): Promise<void> }, width: number, height: number): Promise<number> {
  let tall = height;
  for (let round = 0; round < 4; round++) {
    const hidden = await page.evaluate<number>(OVERFLOW_PAST_THE_WINDOW);
    const next = Math.min(TALLEST_SHOT, tall + Math.max(0, hidden));
    if (hidden <= 1 || next === tall) break;
    tall = next;
    await page.setViewportSize({ width, height: tall });
    // Two frames: the resize heard, the box grown, the place laid out again.
    await page.evaluate<void>("new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))");
  }
  return tall;
}

/**
 * HOW MUCH OF THE PLACE THE PICTURE HOLDS (Roadmap
 * f-revisions-say-what-broke): measured once the window is grown, as it is
 * pictured. A place taller than the tallest picture, or a scene stop that
 * is the window's worth, says what it left out by name. Undefined when the
 * page could not be measured: a picture is never refused for it.
 */
export async function coverageOf(page: { evaluate<T>(fn: string): Promise<T> }): Promise<PictureCoverage | undefined> {
  try {
    const measure = await page.evaluate<PageMeasure>(MEASURE_PICTURED_PAGE);
    return measure && typeof measure.height === "number" ? picturedCoverage(measure) : undefined;
  } catch {
    return undefined;
  }
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
          const height = width < 600 ? 844 : 900;
          const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
          try {
            // Each page is a browser of its own: it opens the address with the run's key, which is traded for its cookie.
          await page.goto(keyedAddress(`${options.url}${shot.address}`, options.key), { waitUntil: "load" });
            // The place drawn and settled, as the page says it (FR-188): its parts, fonts, images and views here, the scene's camera still.
            await page.waitForFunction("document.querySelector('[data-graview-drawn]') !== null || typeof window.__graviewFailed === 'string'", undefined, { timeout: 60_000 });
            const failed = await page.evaluate<string | undefined>("window.__graviewFailed");
            if (failed) throw new Error(failed);
            if (!shot.scene) await wholePlace(page, width, height);
            const file = resolve(options.out, `${shot.name}-${scheme}-${width}.png`);
            const coverage = await coverageOf(page);
            await page.screenshot({ path: file, fullPage: !shot.scene });
            written.push(file);
            options.onShot?.(file, coverage);
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
