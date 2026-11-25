import type { AnySchema, Principal, Store, ViewerState } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { codeOf, type WorkerViewCode, type WorkerViewLoad } from "./code-of.js";
import type { WorkerViewManifest } from "./manifest.js";
import { readAhead } from "./mine.js";
import { readsOnlyUnseen, unseenOf, viewKinds } from "./unseen.js";
import { viewRuntime } from "./view-script.js";

const openDrawChunk = retryingImport(() => import("./open-draw.js"));
const pressChunk = retryingImport(() => import("./press.js"));

/**
 * WHAT A VIEW'S FIRST DRAW WAITS FOR, FETCHED AHEAD OF IT (Graview HQ
 * f-custom-pages-first-visit): its code, the host's halves it is drawn by
 * and, where a person is on their way to it (`intent`), what it keeps for
 * them. Nothing runs: no worker starts, no record is read, no act asked.
 * Nothing at all for a seat that sees nothing the view reads, whose visit
 * would not fetch it either.
 */
export function viewAhead(
  definition: { readonly manifest: WorkerViewManifest; readonly worker: WorkerViewCode | WorkerViewLoad },
  asked: { readonly store: Store<AnySchema>; readonly principal: Principal; readonly viewerState?: ViewerState | undefined; readonly intent: boolean },
): void {
  const reads = viewKinds(definition.manifest);
  if (readsOnlyUnseen(reads, unseenOf(asked.store, asked.principal, reads))) return;
  const quiet = (one: Promise<unknown>) => void one.catch(() => undefined);
  if (typeof definition.worker === "function") quiet(codeOf(definition.worker));
  quiet(viewRuntime());
  quiet(openDrawChunk());
  quiet(pressChunk());
  if (asked.intent && asked.viewerState) readAhead(asked.viewerState, asked.principal, definition.manifest.name);
}
