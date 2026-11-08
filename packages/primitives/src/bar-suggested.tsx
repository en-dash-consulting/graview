import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/**
 * THE SUGGESTED TRAY, FETCHED WHEN SOMETHING MAY WAIT. The inbox asks the
 * seat's log whether the app's own actor ever left anything there to decide
 * (an op that `suggests`); while nothing does it fetches nothing, so a
 * hosted page carries the tray, and the reading of which suggestions still
 * wait (`suggestions`, `@graview/core/tidying`), only once there may be one
 * to show — or once the host said what the app's own actor did while the
 * person was away (`whileAway`). One door for every face's inbox.
 */
const tray = lazyModule(retryingImport(() => import("./suggested.js")));

/** How many wait for this person, told to the bell; draws nothing. */
export const SuggestedCount = tray.part<{ readonly onCount: (count: number) => void }>((module, props) => <module.SuggestedCount {...props} />, { quiet: true });

/** What waits, in the inbox's "For you". */
export const SuggestedList = tray.part<{ readonly close: () => void; readonly done: () => void }>((module, props) => <module.SuggestedList {...props} />, { quiet: true, as: "div" });

/** What the app's own actor did while the person was away, what this seat may read of what waits and not answer, and what people said not to suggest, in the inbox's Updates. */
export const SuggestedUpdates = tray.part<{ readonly alone: boolean; readonly close: () => void; readonly done: () => void }>((module, props) => <module.SuggestedUpdates {...props} />, { quiet: true, as: "div" });
