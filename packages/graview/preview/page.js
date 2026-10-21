/*
 * THE PAGE `graview preview` SERVES (and `graview shots` photographs).
 *
 * Graview's own faces over a document and nothing else: the server
 * (`@graview/ship/cli`'s `preview`) answers `/graview/document` with the
 * document, the app it compiled from it and the seat this page sits in — or,
 * for an app declared in code, where its bundled module is — and
 * serves the store beside it. The page builds the app from what it was
 * handed, opens the store over the wire and mounts the embed as the whole
 * page — the scene and Pages, the bar and the address bar — the way Graview
 * Cloud's shell does. No product, no dev server: `scripts/build-preview-page.mjs`
 * bundles this once at build time into `packages/graview/dist/preview/`.
 */
import { appFromOrCompile, sayFindings } from "@graview/core/compiled";
import { mount, preload } from "@graview/embed";
import { openRemote, remoteViews } from "@graview/ship/browser";

const root = document.getElementById("graview-app");
/*
 * A FORM FOR A VISITOR (Roadmap f-public-forms), at `/forms/<name>`: the
 * server hands a visitor minted for this page in place of the preview's
 * seat, and the form is drawn alone — `@graview/embed/form`, fetched only
 * here — over the store that visitor is served.
 */
const formAt = /^\/forms\/([^/]+)\/?$/.exec(location.pathname);
// The face this page opens on, fetched now beside the document and the store, as Graview Cloud's shell fetches it (FR-57).
const facing = formAt ? import("@graview/embed/form") : preload("pages");
try {
  if (formAt) await visitorForm(decodeURIComponent(formAt[1]));
  else await whole();
} catch (error) {
  const said = document.createElement("pre");
  said.setAttribute("role", "alert");
  said.style.cssText = "margin:2rem;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap";
  said.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(said);
  window.__graviewFailed = said.textContent;
}

async function visitorForm(name) {
  const response = await fetch(`/graview/document?form=${encodeURIComponent(name)}`);
  const handed = await response.json();
  if (!response.ok) throw new Error(handed.error ?? `The preview server did not hand over the form (${response.status}).`);
  const compiled = await appFromOrCompile(handed);
  if (!compiled.ok) throw new Error(sayFindings(compiled.findings));
  const app = compiled.app;
  const principal = handed.principal;
  const remote = await openRemote({ app, url: location.origin, principal, ...(handed.state ? { state: handed.state, openTimeoutMs: 0 } : { openTimeoutMs: 3000 }) });
  document.title = app.forms?.[name]?.title ?? app.name;
  const { mount: mountForm } = await facing;
  window.__graview = mountForm(root, { app, form: name, principal, remote, height: "100dvh", onSubmitted: () => (window.__graviewSubmitted = true) });
  window.__graviewReady = true;
}

async function whole() {
  const response = await fetch("/graview/document");
  if (!response.ok) throw new Error(`The preview server did not hand over the document (${response.status}).`);
  const handed = await response.json();
  // An app declared in code comes as its module, bundled by the server (W-245); a document with the app compiled from it.
  const appOf = async (said) => {
    if (typeof said.module === "string") return (await import(/* @vite-ignore */ said.module)).app;
    const compiled = await appFromOrCompile(said);
    if (!compiled.ok) throw new Error(sayFindings(compiled.findings));
    return compiled.app;
  };
  const app = await appOf(handed);
  if (!app || typeof app !== "object" || !("schema" in app)) throw new Error("The app module the preview server handed does not export an app.");
  const principal = handed.principal;
  /*
   * The store's state came with the document: the store opens on it without
   * asking again, and without waiting for its socket's welcome (no
   * `openTimeoutMs`): the page draws what it was handed, and the socket
   * connects behind it, polling covering the moment until it has.
   */
  const remote = await openRemote({ app, url: location.origin, principal, live: true, subprotocol: true, pollMs: 1200, ...(handed.state ? { state: handed.state, openTimeoutMs: 0 } : { openTimeoutMs: 3000 }) });
  document.title = app.name;
  /*
   * THE VIEWS A PERSON TIDIES FROM THE PLACE MENU (Roadmap f-place-menu-views):
   * kept by the preview server, as Graview Cloud keeps them. A declared
   * lens hidden or deleted is written into the server's document; the page
   * asks for it again and is handed the new app. What they stand at came
   * with the document, so nothing more is asked before the page draws.
   */
  let handle;
  const keptViews = remoteViews({
    url: location.origin,
    principal,
    ...(handed.views ? { state: handed.views } : {}),
    onDeclaration: async () => {
      const again = await (await fetch("/graview/document")).json();
      if (typeof again.module === "string") return;
      const next = await appFromOrCompile(again);
      if (next.ok) handle?.setApp(next.app, remote);
    },
  });
  await Promise.all([facing, keptViews.ready]);
  handle = mount(root, {
    app,
    remote,
    principal,
    studio: false,
    face: "pages",
    routing: "address",
    bar: true,
    height: "100dvh",
    label: app.name,
    heading: 1,
    keptViews,
    // A view proposed and not kept (`--view` and `--manifest`, FR-187), drawn where it attaches and marked as a draft.
    ...(handed.draftView ? { draftView: handed.draftView } : {}),
  });
  window.__graview = handle;
  void handle.drawn().then(() => {
    window.__graviewReady = true;
  });
}
