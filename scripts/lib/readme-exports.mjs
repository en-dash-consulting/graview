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
  ["localStorage", "a browser global"],
  ["sessionStorage", "a browser global"],
  ["Request", "a web platform global, every runtime's"],
  ["Response", "a web platform global, every runtime's"],
  ["CanvasDrawElement", "a Chromium feature flag"],
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
  ["importScripts", "a worker global, which a guest's worker does not have"],
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
