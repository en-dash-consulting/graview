import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/**
 * WHAT IS BEHIND THE BAR'S TOOLS — the person's menu and the problems' rows
 * (FR-131) — fetched when they are first reached for, and asked for again
 * when they did not arrive (FR-139). One door for both, so one arrival or
 * one failure is known to every place that draws from it.
 */
export const barPanes = lazyModule(retryingImport(() => import("./bar-panes.js")));
