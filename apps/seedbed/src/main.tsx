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
  sheet.replaceSync(themeCss(scheme, seedbedBrand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

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
const opened: Opened = chapter
  ? ((await openStore({
      app: chapter.app as never,
      adapter: chapter.remembers ? createBrowserAdapter() : createMemoryAdapter(),
      scope: `chapter-${chapter.n}`,
      seed: chapter.seed as never,
      fresh: !chapter.remembers || browserStartsFresh(),
      storeOptions: chapter.principal ? { principal: chapter.principal } : {},
    } as never)) as unknown as Opened)
  : await openStore({ app: seedbedApp, adapter: createBrowserAdapter(), fresh: browserStartsFresh() });
forgetFreshParam();
const remembers = chapter ? chapter.remembers : true;

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{ store: opened.store, brand: seedbedBrand, sceneHref: "/", remembers }}
    />,
  );
} else {
  createRoot(root).render(
    <SeedbedApp
      store={opened.store}
      remembers={remembers}
      seat={chapter ? chapter.seat : true}
      syncUrl
      renderer="dom"
      initialScheme={scheme}
      onSchemeChange={applyScheme}
    />,
  );
}

(window as unknown as Record<string, unknown>)["__seedbedReady"] = { renderer: "dom", scheme };
