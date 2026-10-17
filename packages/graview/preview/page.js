/*
 * THE PAGE `graview preview` SERVES (and `graview shots` photographs).
 *
 * Graview's own faces over a document and nothing else: the server
 * (`@graview/ship/cli`'s `preview`) answers `/graview/document` with the
 * document, the app it compiled from it and the seat this page sits in, and
 * serves the store beside it. The page builds the app from what it was
 * handed, opens the store over the wire and mounts the embed as the whole
 * page — the scene and Pages, the bar and the address bar — the way Graview
 * Cloud's shell does. No product, no dev server: `scripts/build-preview-page.mjs`
 * bundles this once at build time into `packages/graview/dist/preview/`.
 */
import { appFromOrCompile, sayFindings } from "@graview/core/compiled";
import { mount, preload } from "@graview/embed";
import { openRemote } from "@graview/ship/browser";

const root = document.getElementById("graview-app");
// The face this page opens on, fetched now beside the document and the store, as Graview Cloud's shell fetches it (FR-57).
const facing = preload("pages");
try {
  const response = await fetch("/graview/document");
  if (!response.ok) throw new Error(`The preview server did not hand over the document (${response.status}).`);
  const handed = await response.json();
  const compiled = await appFromOrCompile(handed);
  if (!compiled.ok) throw new Error(sayFindings(compiled.findings));
  const app = compiled.app;
  const principal = handed.principal;
  /*
   * The store's state came with the document: the store opens on it without
   * asking again, and without waiting for its socket's welcome (no
   * `openTimeoutMs`): the page draws what it was handed, and the socket
   * connects behind it, polling covering the moment until it has.
   */
  const remote = await openRemote({ app, url: location.origin, principal, live: true, subprotocol: true, pollMs: 1200, ...(handed.state ? { state: handed.state, openTimeoutMs: 0 } : { openTimeoutMs: 3000 }) });
  document.title = app.name;
  await facing;
  const handle = mount(root, {
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
  });
  window.__graview = handle;
  void handle.drawn().then(() => {
    window.__graviewReady = true;
  });
} catch (error) {
  const said = document.createElement("pre");
  said.setAttribute("role", "alert");
  said.style.cssText = "margin:2rem;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap";
  said.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(said);
  window.__graviewFailed = said.textContent;
}
