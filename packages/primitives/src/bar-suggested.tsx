import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraph, useGraview } from "@graview/react/provider";
import { useMemo } from "react";

/**
 * THE SUGGESTED TRAY, FETCHED WHEN SOMETHING WAITS. The bar asks the store
 * whether the app's own actor left anything for this seat to decide
 * (`store.suggestions`); while nothing waits it draws nothing and fetches
 * nothing, so a hosted page carries the tray only once there is one to
 * show. One door for both faces: the scene's bar and the routed face's.
 */
const tray = lazyModule(retryingImport(() => import("./suggested.js")));
const Tray = tray.part<{ readonly waiting: Parameters<typeof import("./suggested.js").SuggestedTray>[0]["waiting"] }>((module, props) => <module.SuggestedTray {...props} />, { quiet: true });

export function BarSuggested() {
  const { store, principal } = useGraview<AnySchema>();
  const nodes = useGraph();
  const waiting = useMemo(() => store.suggestions(principal), [store, principal, nodes]);
  return waiting.length > 0 ? <Tray waiting={waiting} /> : null;
}
