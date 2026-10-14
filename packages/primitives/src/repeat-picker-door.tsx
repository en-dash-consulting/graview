import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO HOW A DATE REPEATS (`repeat-picker.tsx`): the picker a form
 * asks with, and the control beside a record's repeating date — fetched with
 * the first one drawn, never in the first paint, and never at all for an
 * app whose dates do not repeat.
 */
const REPEAT = /* @__PURE__ */ lazyModule(retryingImport(() => import("./repeat-picker.js")));

export const RepeatPicker = REPEAT.part((m: typeof import("./repeat-picker.js"), props: import("./repeat-picker.js").RepeatPickerProps) => <m.RepeatPicker {...props} />, { quiet: true });
export const RepeatEditor = REPEAT.part((m: typeof import("./repeat-picker.js"), props: Parameters<typeof import("./repeat-picker.js").RepeatEditor>[0]) => <m.RepeatEditor {...props} />, { quiet: true });
export type { RepeatPickerProps } from "./repeat-picker.js";
