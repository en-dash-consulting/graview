import { aiThroughDevServer } from "@graview/tools";
import { themeCss, type Scheme } from "@graview/primitives";
import { applySettings } from "@graview/react";
import { createRoot } from "react-dom/client";
import { PagesApp } from "@graview/pages";
import { open } from "./open.js";
import { rotaApp } from "./domain/app.js";
import { rotaBrand } from "./domain/brand.js";
import { RotaApp, today } from "./ui/app.js";
import { rotaDesign } from "./ui/design.js";
import { rotaViews } from "./ui/views.js";

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
  // The declared brand, not the framework's own — and the brand's KIT comes
  // with it, so the one relation this app has is drawn the way Rota says.
  sheet.replaceSync(themeCss(scheme, rotaBrand));
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
 * THE SAME WAY IT OPENS ANYWHERE — its own port, the launcher, or against a
 * running `graview serve`. One function, so "where is my data" has one
 * answer per address rather than one per entry point.
 */
const opened = await open();
const { store, principal, remembers } = opened;

applySettings(rotaApp.settings ?? []);

/*
 * A REFUSAL THE SERVER MADE IS SAID OUT LOUD. `openRemote` has already
 * taken the hopeful change back; what is left is telling somebody, in the
 * policy's own words. An alert is blunt and it is honest — a demo that
 * swallowed the sentence would be hiding the one thing this arrangement
 * exists to show.
 */
opened.onRefusal((reason) => {
  (window as unknown as Record<string, unknown>)["__rotaRefused"] = reason;
  window.alert(reason);
});
(window as unknown as Record<string, unknown>)["__rotaOps"] = () => opened.intents();

/*
 * A MODEL IN DEVELOPMENT. Started with `ANTHROPIC_API_KEY=… pnpm dev`, the
 * dev server lends the seat one through its door (`aiDevProxy`), holding
 * the key itself; without a key the seat says how to turn it on. Only in a
 * dev build: a built page asks no door and says what any product says.
 */
const ai = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ? await aiThroughDevServer() : undefined;

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

if (window.location.pathname.startsWith("/pages")) {
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        ...(ai ? { ai } : {}),
        store,
        brand: rotaBrand,
        signature: true,
        sceneHref: "/",
        invariantContext: { today: today() },
        principal,
        remembers,
        // The app's pictures on this face too: every named lens a page, the nav the bar.
        views: rotaViews(),
        settings: rotaApp.settings ?? [],
      }}
      registry={rotaDesign(rotaApp.schema)}
    />,
  );
} else {
  createRoot(root).render(
    <RotaApp
      {...(ai ? { ai } : {})}
      store={store}
      principal={principal}
      remembers={remembers}
      syncUrl
      renderer="dom"
      initialScheme={scheme}
      onSchemeChange={applyScheme}
    />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__rotaReady"] = {
  renderer: "dom",
  scheme,
  // What the opening had to run to get here: empty on an ordinary visit, one
  // operation on a browser that was holding a roster from before the rule.
  migrated: opened.migrated,
  // Where the roster lives: this browser, or a folder on a server.
  where: opened.where,
};
