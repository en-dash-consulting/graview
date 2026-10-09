import { aiThroughDevServer } from "@graview/tools";
import { PagesApp } from "@graview/pages";
import { themeCss, type Scheme } from "@graview/primitives";
import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { discographyApp } from "./domain/app.js";
import seed from "./data/seed.json";
import { discographyBrand } from "./domain/brand.js";
import { DiscographyApp } from "./ui/app.js";
import { linerNotes } from "./ui/design.js";
import { discographySchema } from "./domain/schema.js";
import { views } from "./ui/views.js";
import { openingSeat, SEATS } from "./ui/seats.js";

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

function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme, discographyBrand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

/*
 * A MODEL IN DEVELOPMENT. Started with `ANTHROPIC_API_KEY=… pnpm dev`, the
 * dev server lends the seat one through its door (`aiDevProxy`), holding
 * the key itself; without a key the seat says how to turn it on. Only in a
 * dev build: a built page asks no door and says what any product says.
 */
const ai = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ? await aiThroughDevServer() : undefined;

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * THE APP REMEMBERS. Persistence is the op log; `openStore` is the lifecycle
 * every deployment repeats. Here it is the browser adapter, so an edit
 * survives a reload, attributed and undoable. `?fresh=1` returns to empty;
 * a driven browser starts fresh unless it asks to remember (`?remember=1`),
 * so a harness specifies the app rather than its own residue.
 */
const opened = await openStore({
  app: discographyApp,
  adapter: createBrowserAdapter(),
  fresh: browserStartsFresh(),
  seed: seed as never,
});
forgetFreshParam();

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        ...(ai ? { ai } : {}),
        store: opened.store,
        brand: discographyBrand,
        signature: true,
        sceneHref: "/",
        remembers: true,
        principal: openingSeat(),
        seats: SEATS,
        /*
         * THE SAME PICTURES ON BOTH FACES. Handed the registry the scene
         * draws from, the pages land on a gallery of them — every kind as
         * a card until you title a lens, then the lens by its name — with
         * the map of the kinds and the seat on every route.
         */
        views: views(),
        settings: discographyApp.settings ?? [],
      }}
      // Your own pages over the derived ones: see ui/pages.tsx.
      registry={linerNotes(discographySchema)}
    />,
  );
} else {
  createRoot(root).render(
    <DiscographyApp store={opened.store} {...(ai ? { ai } : {})} remembers syncUrl initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__graviewReady"] = { scheme };
