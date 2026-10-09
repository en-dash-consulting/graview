import { themeCss, type Scheme } from "@graview/primitives";
import { applySettings } from "@graview/react";
import { createRoot } from "react-dom/client";
import { seedbedBrand } from "./domain/brand.js";
import { PagesApp } from "@graview/pages";
import { aiThroughDevServer, type HostAi } from "@graview/tools";
import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openStore,
} from "@graview/ship/browser";
import { createMemoryAdapter, type SettingDeclaration } from "@graview/core";
import { seedbedApp } from "./domain/app.js";
import type { SeedbedSchema } from "./domain/schema.js";
import { chapterFromSearch } from "./domain/chapters.js";
import { SeedbedApp } from "./ui/app.js";
import { browserEmptyChoice, forgetEmptyParam, openGarden } from "./open.js";
import { seedbedDesign } from "./ui/design.js";
import { seedbedViews } from "./ui/views.js";
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
 * The garden remembers: what you sow here is still here tomorrow. It opens
 * on the example garden; "Start fresh" (or "Load the example garden") is
 * the way back to it, and "Start empty" the way to a blank graph.
 *
 * `?chapter=N` opens the garden as it stood at that chapter of the
 * progression instead (see domain/chapters.ts): its declaration, its seed,
 * and — from the chapter that earns it — the browser adapter.
 */
type Opened = Pick<Awaited<ReturnType<typeof openStore<SeedbedSchema>>>, "store">;
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
    } as never)) as Opened)
  : // The finished garden opens planted; "Start empty" and `?empty=1` are the way to a blank one (see open.ts).
    await openGarden({ adapter, search: window.location.search, fresh: browserStartsFresh(), choice: browserEmptyChoice });
forgetFreshParam();
forgetEmptyParam();
const remembers = chapter ? chapter.remembers : true;

/*
 * THE READER'S OWN SETTINGS, APPLIED BEFORE ANYTHING RENDERS — a fact about
 * the person and their browser, not about which chapter or which face.
 */
applySettings(((chapter?.app ?? seedbedApp) as { settings?: readonly SettingDeclaration[] }).settings ?? []);

/*
 * THE AI IS THE HOST'S TO GIVE. The garden ships with none — the graph
 * answers, and an open question is told AI isn't on. A host with a model
 * passes it as `ai`; the rehearsal hands this example one the same way.
 */
/*
 * A MODEL IN DEVELOPMENT. Started with `ANTHROPIC_API_KEY=… pnpm dev`, the
 * dev server lends the seat one through its door (`aiDevProxy`), holding
 * the key itself; without a key the seat says how to turn it on. Only in a
 * dev build: a built page asks no door and says what any product says.
 */
const ai = (window as unknown as { __seedbedAi?: HostAi }).__seedbedAi ?? ((import.meta as { env?: { DEV?: boolean } }).env?.DEV ? await aiThroughDevServer() : undefined);

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        store: opened.store,
        ...(brand ? { brand } : {}),
        signature: true,
        // The seat the chapter puts at the keyboard: the pages withhold by it.
        ...(chapter?.principal ? { principal: chapter.principal } : {}),
        sceneHref: "/",
        remembers,
        // The garden's pictures on this face too, as the chapter stands them up.
        views: seedbedViews(opened.store.schema as never, {
          lens: chapter ? chapter.lens : true,
          board: chapter ? chapter.board : true,
          map: chapter ? (chapter.map ?? false) : false,
          reach: chapter ? (chapter.reach ?? false) : true,
          ...(chapter?.studioOf ? { studio: chapter.studioOf } : {}),
          ...(chapter?.season ? { season: true } : {}),
          ...(chapter?.rotation ? { rotation: true } : {}),
        }),
        settings: ((chapter?.app ?? seedbedApp) as { settings?: readonly SettingDeclaration[] }).settings ?? [],
        ...(ai ? { ai } : {}),
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
      reach={chapter ? (chapter.reach ?? false) : true}
      {...(chapter?.studioOf ? { studio: chapter.studioOf } : {})}
      {...(chapter?.season ? { season: true } : {})}
      {...(chapter?.rotation ? { rotation: true } : {})}
      brand={brand}
      // The finished garden's own way to an empty one, and back; a chapter's garden is the chapter's.
      garden={!chapter}
      {...(ai ? { ai } : {})}
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
