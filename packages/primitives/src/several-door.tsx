import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { Suspense } from "react";
import type { SeveralBarProps } from "./several-bar.js";

/*
 * THE DOOR TO THE SELECTION BAR: fetched with the first record chosen, or
 * as soon as a list is reached for (`prefetchSeveral`, on a box's first
 * hover or focus) — never in a list's first paint.
 */
const SEVERAL = /* @__PURE__ */ lazyModule(retryingImport(() => import("./several-bar.js")));

const Bar = /* @__PURE__ */ SEVERAL.part((module: typeof import("./several-bar.js"), props: SeveralBarProps) => <module.SeveralBar {...props} />, { what: "The selection bar" });

/** The bar over a list that has records chosen; nothing while none is. */
export function SeveralBarDoor(props: SeveralBarProps) {
  if (props.chosen.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <Bar {...props} />
    </Suspense>
  );
}

/** Fetch the bar now if it is not here: for a pointer or the keyboard reaching a list's boxes. */
export const prefetchSeveral = (): void => SEVERAL.prefetch();
export type { SeveralBarProps } from "./several-bar.js";
