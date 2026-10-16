import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO A MONTH TO PICK A DAY FROM (`when-picker.tsx`): opened from a
 * date's editor by its button, or Alt with the down arrow — fetched the first
 * time one is opened (or a pointer rests on the button), never in the first
 * paint, and never at all on a page where nobody picks a day.
 */
const MONTH = /* @__PURE__ */ lazyModule(retryingImport(() => import("./when-picker.js")));

export const WhenPicker = {
  Part: MONTH.part((m: typeof import("./when-picker.js"), props: import("./when-picker.js").WhenMonthProps) => <m.WhenMonth {...props} />, { quiet: true }),
  prefetch: (): void => MONTH.prefetch(),
};
export type { WhenMonthProps } from "./when-picker.js";
