import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraph, useGraview } from "@graview/react/provider";
import { useMemo } from "react";

/**
 * THE SUGGESTED TRAY, FETCHED WHEN SOMETHING MAY WAIT. The bar asks the
 * seat's log whether the app's own actor ever left anything there to decide
 * (an op that `suggests`); while nothing does it draws nothing and fetches
 * nothing, so a hosted page carries the tray, and the reading of which
 * suggestions still wait (`suggestions`, `@graview/core/tidying`), only
 * once there may be one to show. The tray draws nothing while none waits.
 * One door for both faces: the scene's bar and the routed face's.
 */
const tray = lazyModule(retryingImport(() => import("./suggested.js")));
const Tray = tray.part<Record<string, never>>((module) => <module.SuggestedTray />, { quiet: true });

export function BarSuggested() {
  const { store } = useGraview<AnySchema>();
  const nodes = useGraph();
  const suggested = useMemo(() => store.log.all().some((op) => op.suggests !== undefined && !op.withheld), [store, nodes]);
  return suggested ? <Tray /> : null;
}
