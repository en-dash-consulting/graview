import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { Suspense, type ReactNode } from "react";
import type { WhenInputProps } from "./when-input.js";

/*
 * THE DOOR TO A DATE'S EDITOR (`when-input.tsx`): the box that reads
 * "tomorrow 3pm" and the reader of what is typed, fetched when a date is
 * first edited or asked for — and asked for early, while the page is idle,
 * by a date that could be (`prefetchWhenInput`) — never in the first paint.
 */
const WHEN = /* @__PURE__ */ lazyModule(retryingImport(() => import("./when-input.js")));
const Part = WHEN.part((m: typeof import("./when-input.js"), props: WhenInputProps) => <m.WhenInput {...props} />, { quiet: true });

/** A day or a moment, typed as people say it or picked from a month (Roadmap f-date-inputs). */
export function WhenInput(props: WhenInputProps): ReactNode {
  return (
    <Suspense fallback={<span data-graview-when-arriving="" style={{ display: "inline-block", minHeight: 24 }} />}>
      <Part {...props} />
    </Suspense>
  );
}

/** Fetch the editor now, if it is not here yet: for a date that can be changed where it is shown. Settles once it is here (or could not be fetched); never rejects. */
export const prefetchWhenInput = (): Promise<void> => WHEN.load().then(
  () => undefined,
  () => undefined,
);
export type { WhenInputProps } from "./when-input.js";
