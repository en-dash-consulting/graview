import { themeCss, type Scheme } from "@graview/primitives";
import { applySettings } from "@graview/react";
import { createRoot } from "react-dom/client";
import { PagesApp } from "@graview/pages";
import { open } from "./open.js";
import { todoApp } from "./domain/app.js";
import { thingsBrand } from "./domain/brand.js";
import { openingSeat, today, TodoApp } from "./ui/app.js";
import { thingsDesign } from "./ui/design.js";

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

/*
 * THE READER'S OWN SETTINGS, APPLIED BEFORE ANYTHING RENDERS.
 *
 * Here rather than in a component, for the same reason the scheme is here:
 * it is a fact about the person and their browser, it belongs to the
 * document, and this app has two faces on two paths that must not disagree
 * about how big the words are.
 */
applySettings(todoApp.settings ?? []);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * THE APP REMEMBERS. Persistence is the op log, and `openStore` is the
 * lifecycle every deployment repeats — here with the browser adapter, so an
 * edit survives a reload, attributed and undoable, and the example is the
 * FIRST load rather than every load. `?fresh=1` (the "Start fresh" control)
 * returns to the example; a driven browser starts fresh unless it asks to
 * remember, so the harnesses keep specifying the example rather than their
 * own residue.
 */
/*
 * THE SAME WAY IT OPENS ANYWHERE. `open()` is what the launcher mounts
 * through too, so "Things remembers" is one fact rather than one fact here
 * and a different one on the desk.
 */
const { opened, principal, remembers, presence } = await open();

/*
 * TWO FACES, ONE DECLARATION. The scene owns "/" (and the hash, which is
 * its view state); the routed face lives under "/pages" on ordinary paths.
 * Same store machinery, same ids — a record page links to its spatial stop
 * and the scene's header offers the pages, because they are one app.
 */
if (window.location.pathname.startsWith("/pages")) {
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{
        store: opened.store,
        brand: thingsBrand,
        sceneHref: "/",
        invariantContext: { today: today() },
        /*
         * THE SAME SEAT ON BOTH FACES. The routed face lists the kinds this
         * seat may see and withholds the acts it may not, from the same
         * policy the scene narrows by — `?as=user-sam` sits somebody down
         * here exactly as it does over there.
         */
        principal,
        remembers,
      }}
      /*
       * THE APP'S OWN FACE, over the same derivations. Every surface is
       * replaced; nothing here reaches past the framework. The routes it
       * does not register — the not-found page, which has no kind to
       * register on — render the framework's own inside this shell.
       */
      registry={thingsDesign(todoApp.schema)}
    />,
  );
} else {
  createRoot(root).render(
    <TodoApp
      store={opened.store}
      principal={principal}
      remembers={remembers}
      presence={presence}
      syncUrl
      renderer="dom"
      initialScheme={scheme}
      onSchemeChange={applyScheme}
    />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__todoReady"] = { renderer: "dom", scheme };
