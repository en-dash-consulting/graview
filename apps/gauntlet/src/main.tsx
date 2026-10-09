import { aiThroughDevServer } from "@graview/tools";
import { PagesApp } from "@graview/pages";
import { themeCss, type Scheme } from "@graview/primitives";
import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { gauntletApp } from "./domain/app.js";
import seed from "./data/seed.json";
import { gauntletBrand } from "./domain/brand.js";
import { GauntletApp } from "./ui/app.js";
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
  sheet.replaceSync(themeCss(scheme, gauntletBrand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Not being able to remember is not a reason to fail.
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
 * The browser adapter, so an edit survives a reload; a driven browser
 * starts fresh unless it asks to remember (`?remember=1`), so a harness
 * specifies the app rather than its own residue.
 */
const opened = await openStore({
  app: gauntletApp,
  adapter: createBrowserAdapter(),
  fresh: browserStartsFresh(),
  seed: seed as never,
});
forgetFreshParam();

if (window.location.pathname.startsWith("/pages")) {
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        ...(ai ? { ai } : {}),
        store: opened.store,
        brand: gauntletBrand,
        signature: true,
        sceneHref: "/",
        remembers: true,
        principal: openingSeat(),
        seats: SEATS,
        views: views(),
        settings: gauntletApp.settings ?? [],
      }}
    />,
  );
} else {
  createRoot(root).render(
    <GauntletApp store={opened.store} {...(ai ? { ai } : {})} remembers syncUrl initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__graviewReady"] = { scheme };
