import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { appFromOrCompile, sayFindings } from "@graview/core/compiled";
import { PagesApp } from "@graview/pages";
import { createViews } from "@graview/react";
import { registerDeclaredLenses, registerDefaultViews, registerViewSpecs, themeCss } from "@graview/primitives";
import { openRemote } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { pages, SCENE } from "./pages.js";

/*
 * A PRODUCT FACE OVER A RUNNING PREVIEW'S STORE.
 *
 * The preview holds the store and the declaration; this page is the face.
 * It asks the preview (through the dev server's proxy, vite.config.ts) for
 * the app and the seat it sits in, opens the store over the wire, live, and
 * draws Graview's routed face with its own shell, home, routes and record
 * pages. A change made here is the preview's, and its own page sees it.
 */
const root = document.getElementById("root");
if (!root) throw new Error("no #root");

const handed = (await (await fetch("/graview/document")).json()) as { readonly document: unknown; readonly compiled?: unknown; readonly principal: Principal; readonly state?: unknown };
const compiled = await appFromOrCompile(handed);
if (!compiled.ok) throw new Error(sayFindings(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

const remote = await openRemote({ app, url: window.location.origin, principal: handed.principal, live: true, subprotocol: true, pollMs: 1200, ...(handed.state ? { state: handed.state as never, openTimeoutMs: 0 } : {}) });

/*
 * THE LOOK, ADOPTED BY HAND. The embed would put the theme on its own
 * element; a face of its own puts it on the document, from the app's brand,
 * and switching scheme is one replaceSync.
 */
const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];
const scheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
sheet.replaceSync(themeCss(scheme, app.brand));
document.documentElement.dataset["graviewScheme"] = scheme;
document.title = app.name;

/*
 * THE PICTURES: every kind at every fidelity from the declaration, the
 * record pages it declares as blocks, and its titled lenses as places.
 */
const views = registerDeclaredLenses(registerViewSpecs(registerDefaultViews(app.schema, createViews(app.schema)), app.schema, app.viewSpecs), app);

createRoot(root).render(
  <PagesApp
    context={{
      store: remote.store,
      principal: handed.principal,
      ...(app.brand ? { brand: app.brand } : {}),
      // A record's "See it on the map" opens the preview's own scene, focused on it.
      sceneHref: SCENE,
      views,
      settings: app.settings ?? [],
      app,
    }}
    registry={pages(app)}
  />,
);
// What a harness waits on, rather than a timer and a hope.
Object.assign(window, { __graview: { store: remote.store, principal: handed.principal }, __faceReady: true });
