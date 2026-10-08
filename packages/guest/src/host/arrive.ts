import { retryingImport } from "@graview/core/retry";

/**
 * The host's half of a worker view, fetched when one is first drawn, and
 * asked for again with a URL of its own when it did not arrive (FR-139).
 */
export const workerChunk = retryingImport(() => import("./worker.js"));

/**
 * Load a part, and hand it over once it is here: when it did not arrive —
 * the network away as the view was drawn — it is asked for again when the
 * browser is back online, for as long as the view is drawn. Never a
 * rejection nobody catches (a page error). Returns the way to stop asking.
 */
export function untilItArrives<M>(load: () => Promise<M>, then: (module: M) => void): () => void {
  let gone = false;
  const again = () => {
    window.removeEventListener("online", again);
    if (!gone) attempt();
  };
  const attempt = () =>
    void load().then(
      (module) => {
        if (!gone) then(module);
      },
      () => {
        if (!gone) window.addEventListener("online", again);
      },
    );
  attempt();
  return () => {
    gone = true;
    window.removeEventListener("online", again);
  };
}
