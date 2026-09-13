import { themeCss, type Scheme } from "@graview/primitives";
import { applySettings } from "@graview/react";
import { createRoot } from "react-dom/client";
import { PagesApp } from "@graview/pages";
import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openStore,
} from "@graview/ship/browser";
import example from "./data/example.json";
import { rotaApp } from "./domain/app.js";
import { rotaBrand } from "./domain/brand.js";
import { openingSeat, RotaApp, today } from "./ui/app.js";
import { rotaDesign } from "./ui/design.js";

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
 * A ROSTER STORED BEFORE THE SECOND RULE EXISTED still opens.
 *
 * `?stored=1` puts a version-1 roster in this browser — the shape a
 * deployment that shipped before the limit rule would have left behind — so
 * the migration is something a reader can watch happen rather than a claim
 * in a changelog. It runs once, as a logged, attributed, invertible
 * operation, and the browser is then at 2 like everybody else.
 */
const adapter = createBrowserAdapter();
const stored = new URLSearchParams(window.location.search).get("stored") === "1";
if (stored) {
  await adapter.delete(rotaApp.name);
  await adapter.save(rotaApp.name, {
    nodes: example.nodes.filter((node) => node.id !== "rule-limit"),
    edges: example.edges,
  } as never);
  adapter.saveMeta(rotaApp.name, { version: 1 });
}

const opened = await openStore({
  app: rotaApp,
  adapter,
  seed: example as never,
  // A browser deliberately holding a version-1 roster is not a fresh one.
  fresh: stored ? false : browserStartsFresh(),
  storeOptions: { invariantOptions: { context: { today: today() } } },
});
forgetFreshParam();
const remembers = true;

applySettings(rotaApp.settings ?? []);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

if (window.location.pathname.startsWith("/pages")) {
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        store: opened.store,
        brand: rotaBrand,
        sceneHref: "/",
        invariantContext: { today: today() },
        principal: openingSeat(),
        remembers,
      }}
      registry={rotaDesign(rotaApp.schema)}
    />,
  );
} else {
  createRoot(root).render(
    <RotaApp
      store={opened.store}
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
  migrated: opened.migrated.map((operation) => operation.intent),
};
