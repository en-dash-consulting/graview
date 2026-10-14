import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO A RECORD IN ANOTHER APP (FR-171): what draws a linked record
 * with its own card, and picks one from what the host lists — fetched with
 * the first one drawn, never in the first paint, and never at all for an
 * app that links no other.
 */
const LINKED = /* @__PURE__ */ lazyModule(retryingImport(() => import("./linked-record.js")));

export const LinkedRecordView = LINKED.part((m: typeof import("./linked-record.js"), props: import("./linked-record.js").LinkedRecordViewProps) => m.drawLinkedRecord(props), { quiet: true });
export const LinkedPicker = LINKED.part((m: typeof import("./linked-record.js"), props: import("./linked-record.js").LinkedPickerProps) => m.drawLinkedPicker(props), { what: "Picking a linked record" });
export type { LinkedPickerProps, LinkedRecordViewProps } from "./linked-record.js";
