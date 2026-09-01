import { themeCss, type Scheme } from "@graview/primitives";
import { createRoot } from "react-dom/client";
import { PagesApp } from "@graview/pages";
import { thingsBrand } from "./domain/brand.js";
import { createTodoUiStore, today, TodoApp } from "./ui/app.js";

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
  // The declared brand, not the framework's own — `themeCss` takes one.
  sheet.replaceSync(themeCss(scheme, thingsBrand));
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
 * TWO FACES, ONE DECLARATION. The scene owns "/" (and the hash, which is
 * its view state); the routed face lives under "/pages" on ordinary paths.
 * Same store machinery, same ids — a record page links to its spatial stop
 * and the scene's header offers the pages, because they are one app.
 */
if (window.location.pathname.startsWith("/pages")) {
  const store = createTodoUiStore();
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        store,
        brand: thingsBrand,
        sceneHref: "/",
        invariantContext: { today: today() },
      }}
    />,
  );
} else {
  createRoot(root).render(
    <TodoApp syncUrl renderer="dom" initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__todoReady"] = { renderer: "dom", scheme };
