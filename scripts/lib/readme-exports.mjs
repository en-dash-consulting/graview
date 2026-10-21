/**
 * WHAT A README NAMES, A TARBALL HAS (FR-15).
 *
 * A README is where a stranger learns a package's API, and it drifts
 * silently: the render package's promised `routePointer` was renamed to
 * `PointerRouter` and `hitTest` and nothing said so, and published 0.1.0
 * lacked the sights its README and the walks described. Every name a README
 * puts in backticks that reads as an API name (camelCase or PascalCase) has
 * to be exported by one of the packed `@graview/*` packages — their `.d.ts`
 * entries, read with the TypeScript checker so re-exports count.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

/** Names written in backticks that are not exports, and why. */
export const NOT_EXPORTS = new Map([
  ["ctrlKey", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["deltaMode", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["deltaX", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["deltaY", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["metaKey", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["pointerId", "a field of a gesture a worker view hears (0.1.42), not an export"],
  ["preventDefault", "a DOM event method the host calls over a view that hears gestures, not an export"],
  ["localStorage", "a browser global"],
  ["basePath", "an option of the embed's mount and of addressOf, not an export"],
  ["onNavigate", "an option of the embed's mount and a prop of PagesApp, not an export"],
  ["setPath", "a method of the embed's handle, not an export"],
  ["onSubmitted", "an option of the visitor form's mount and a prop of VisitorFormPage, not an export (Roadmap f-public-forms)"],
  ["sceneHref", "a field of the pages' context and a parameter of spatialHref and placeHref, not an export"],
  ["signIn", "an option of the embed's mount, GraviewProvider and the pages' context, not an export (FR-183)"],
  ["keptViews", "an option of the embed's mount, FrameOptions and GraviewProvider, not an export (0.1.38)"],
  ["setApp", "a method of the embed's handle, not an export (FR-116)"],
  ["setLabel", "a method of the embed's handle, not an export (FR-128)"],
  ["setHostActions", "a method of the embed's handle, not an export (FR-128)"],
  ["onDrawn", "an option of the embed's mount and the pages' mount, not an export (FR-188)"],
  ["setDraftView", "a method of the embed's handle and the pages' handle, not an export (FR-187)"],
  ["readyMs", "a limit of mountGuestWorker, mountWorkerView and mountGuestView, not an export"],
  ["sessionStorage", "a browser global"],
  ["Request", "a web platform global, every runtime's"],
  ["Response", "a web platform global, every runtime's"],
  ["CanvasDrawElement", "a Chromium feature flag"],
  ["layoutSubtree", "an earlier Chromium spelling of the canvas's element-capture attribute"],
  ["elementsFromPoint", "a DOM method of the document"],
  ["graviewRenderer", "a page global an operator sets to choose the renderer, not an export"],
  ["GRAVIEW_RENDERER", "an environment variable the harnesses read, not an export"],
  ["seatOf", "an option of serveStore, not an export"],
  ["attachRenderer", "a prop of the Scene, not an export"],
  ["onConflict", "a method of openRemote's store, not an export"],
  ["onStatus", "a method of openRemote's store, not an export"],
  ["presenceEveryMs", "an option of openRemote, not an export"],
  ["keepTheirs", "a method of a RemoteConflict, not an export"],
  ["useMine", "a method of a RemoteConflict, not an export"],
  ["onRefusal", "a method of openRemote's store, not an export"],
  ["wouldNeed", "a field of a refusal on the wire, not an export"],
  ["retryAfter", "a field of a busy answer on the wire, not an export"],
  ["serializeAttachment", "a Cloudflare Durable Object WebSocket method, not an export"],
  ["deserializeAttachment", "a Cloudflare Durable Object WebSocket method, not an export"],
  ["declarationChanged", "a method of a store handler, not an export"],
  ["onCall", "an option of createMcpHttpHandler and a method of a store handler, not an export"],
  ["resolveApp", "an option of openRemote, not an export"],
  ["onDeclaration", "a method of openRemote's store, not an export"],
  ["onBuild", "a method of openRemote's store, not an export"],
  ["minProtocol", "an option of createStoreHandler, not an export"],
  ["minHostProtocol", "an option of liveProtocol and createStoreHandler, not an export"],
  ["hostProtocol", "an option of openRemote and a field of hello and reload on the wire, not an export"],
  ["hostBuild", "a field of a LiveSocketState, not an export"],
  ["withheldKey", "an option of liveProtocol and createStoreHandler, not an export"],
  ["viaClaimed", "an option of createStoreHandler, not an export"],
  ["viaOf", "an option of createStoreHandler and liveProtocol, not an export"],
  ["seatOfKey", "an option of createStoreHandler, not an export"],
  ["seatKey", "an option of createStoreHandler, not an export"],
  ["reloadPage", "an option of openRemote, not an export"],
  ["onBehalfOf", "a field of a Presence and a Principal, not an export"],
  ["onBehalfOfName", "a field of a Presence, not an export"],
  ["nodesAfter", "a field of a PlannedChange, not an export"],
  ["edgesAfter", "a field of a PlannedChange, not an export"],
  ["applyAll", "a method of a Store, not an export"],
  ["onFailure", "an option of mountGuestWorker and mountWorkerView, not an export"],
  ["maxNodes", "a limit of mountGuestWorker and mountWorkerView, not an export"],
  ["maxSourceBytes", "a limit of mountWorkerView, not an export"],
  ["messageWindowMs", "a limit of a guest's host, not an export"],
  ["pushMs", "a limit of mountWorkerView, not an export"],
  ["silentMs", "a limit of mountGuestWorker and mountWorkerView, not an export"],
  ["drawMs", "a limit of mountGuestWorker and mountWorkerView, not an export"],
  ["importScripts", "a worker global, which a guest's worker does not have"],
  ["GraviewGuest", "the one global @graview/guest/client.js leaves in a frame guest's page, not an export"],
  ["minBuilding", "an option of sceneThumbnail, not an export"],
  ["graviewHeadless","the global a headless script leaves in its isolate for the host to call (HEADLESS_ENTRY), not an export"],
]);

/** The API-shaped names a README puts in backticks: `name`, `name()`, `Name`. */
export function namedIn(text) {
  const names = new Set();
  for (const [, name] of text.matchAll(/`([A-Za-z_$][A-Za-z0-9_$]*)(?:\(\))?`/g)) {
    if (/[A-Z]/.test(name) && !NOT_EXPORTS.has(name)) names.add(name);
  }
  return names;
}

/** Every name the given declaration entry points export, following re-exports. */
export function exportsOf(entries) {
  const names = new Set();
  if (entries.length === 0) return names;
  const program = ts.createProgram(entries, {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  const checker = program.getTypeChecker();
  for (const entry of entries) {
    const source = program.getSourceFile(entry);
    const symbol = source && checker.getSymbolAtLocation(source);
    for (const exported of symbol ? checker.getExportsOfModule(symbol) : []) names.add(exported.name);
  }
  return names;
}

/** The names a README promises that no packed package exports. */
export function unexported(readmePath, exported) {
  return [...namedIn(readFileSync(readmePath, "utf8"))].filter((name) => !exported.has(name)).sort();
}
