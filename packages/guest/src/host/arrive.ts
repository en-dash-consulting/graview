import { retryingImport } from "@graview/core/retry";

/**
 * The host's half of a worker view, fetched when one is first drawn, and
 * asked for again with a URL of its own when it did not arrive (FR-139).
 */
export const workerChunk = retryingImport(() => import("./worker.js"));

/**
 * The host's half of a frame view — the frame, its session and the theme it
 * reads — fetched when one is first drawn (FR-179), so a page that only
 * registers a `guestView` carries none of it before a face draws one.
 */
export const frameChunk = /* @__PURE__ */ retryingImport(() => import("./frame.js"));

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

/*
 * WHAT PRESSES A DRAFT'S CONTROLS, LENT BY THE PAGE (Roadmap
 * f-make-any-page-better; `@graview/guest/host/pressing`). Here, beside the
 * doors the host fetches its halves by, because every page that draws a
 * worker view has this file up front: a file of its own was a chunk of its
 * own before the page drew.
 */
let pressing: (() => Promise<typeof import("../headless/pressed-here.js")>) | undefined;

/** Lends what fetches the headless press run (`@graview/guest/headless/pressed-here`). */
export function lendViewPressing(load: () => Promise<typeof import("../headless/pressed-here.js")>): void {
  pressing = load;
}

/** What fetches the headless press run, when the page lent it. */
export function viewPressing(): (() => Promise<typeof import("../headless/pressed-here.js")>) | undefined {
  return pressing;
}
