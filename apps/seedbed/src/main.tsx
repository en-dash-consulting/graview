import { themeCss, type Scheme } from "@graview/primitives";
import { createRoot } from "react-dom/client";
import { seedbedBrand } from "./domain/brand.js";
import { PagesApp } from "@graview/pages";
import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openStore,
} from "@graview/ship/browser";
import { createMemoryAdapter } from "@graview/core";
import { seedbedApp } from "./domain/app.js";
import type { SeedbedSchema } from "./domain/schema.js";
import { chapterFromSearch } from "./domain/chapters.js";
import { SeedbedApp } from "./ui/app.js";
import { seedbedDesign } from "./ui/design.js";
import { seedbedPages } from "./ui/pages.js";

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];

const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const asked = new URLSearchParams(window.location.search).get("theme");
  if (asked === "light" || asked === "dark") return asked;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme, brand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * The empty app remembers too: what you sow here is still here tomorrow,
 * and "Start fresh" is the way back to the blank graph (see todo's main.tsx).
 *
 * `?chapter=N` opens the garden as it stood at that chapter of the
 * progression instead (see domain/chapters.ts): its declaration, its seed,
 * and — from the chapter that earns it — the browser adapter.
 */
type Opened = Awaited<ReturnType<typeof openStore<SeedbedSchema>>>;
const chapter = chapterFromSearch(window.location.search);
const brand = chapter ? chapter.app.brand : seedbedBrand;
applyScheme(scheme);
const adapter = !chapter || chapter.remembers ? createBrowserAdapter() : createMemoryAdapter();
if (chapter?.stored) {
  /*
   * What an earlier deployment left behind, put where opening will find
   * it: the snapshot at its old version. Opening then has to carry it
   * forward, and the migration it runs is the chapter's whole point.
   */
  const scope = `chapter-${chapter.n}`;
  await adapter.delete(scope);
  await adapter.save(scope, chapter.stored.snapshot as never);
  (adapter as { saveMeta?: (scope: string, meta: { version: number }) => void }).saveMeta?.(scope, { version: chapter.stored.version });
}
const opened: Opened = chapter
  ? ((await openStore({
      app: chapter.app as never,
      adapter,
      scope: `chapter-${chapter.n}`,
      seed: chapter.seed as never,
      fresh: chapter.stored ? false : !chapter.remembers || browserStartsFresh(),
      storeOptions: chapter.principal ? { principal: chapter.principal } : {},
    } as never)) as unknown as Opened)
  : await openStore({ app: seedbedApp, adapter, fresh: browserStartsFresh() });
forgetFreshParam();
const remembers = chapter ? chapter.remembers : true;

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        store: opened.store,
        ...(brand ? { brand } : {}),
        // The seat the chapter puts at the keyboard: the pages withhold by it.
        ...(chapter?.principal ? { principal: chapter.principal } : {}),
        sceneHref: "/",
        remembers,
      }}
      // The garden's own plot page, over the derived defaults for the rest.
      {...(!chapter || chapter.pages
        ? { registry: chapter?.design ? seedbedDesign(opened.store.schema) : seedbedPages(opened.store.schema) }
        : {})}
    />,
  );
} else {
  createRoot(root).render(
    <SeedbedApp
      store={opened.store}
      remembers={remembers}
      seat={chapter ? chapter.seat : true}
      lens={chapter ? chapter.lens : true}
      board={chapter ? chapter.board : true}
      map={chapter ? (chapter.map ?? false) : false}
      brand={brand}
      syncUrl
      renderer="dom"
      initialScheme={scheme}
      onSchemeChange={applyScheme}
      // The seat the chapter puts at the keyboard: the strip narrows by it,
      // exactly as the routed face above already did.
      {...(chapter?.principal ? { principal: chapter.principal } : {})}
    />,
  );
}

(window as unknown as Record<string, unknown>)["__seedbedReady"] = { renderer: "dom", scheme };
