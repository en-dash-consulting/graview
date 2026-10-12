import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO A RECORD'S FILES (FR-162, FR-163): what draws a picture, a
 * gallery and a document, and the editor that puts one there — fetched with
 * the first file field drawn, never in the first paint, and never at all
 * for an app whose records hold none. One part, told what to draw (`as`).
 */
const FILES = /* @__PURE__ */ lazyModule(retryingImport(() => import("./files.js")));

export const Files = FILES.part((m: typeof import("./files.js"), props: import("./files.js").FilesProps) => m.drawFiles(props), { quiet: true });
export type { FilesProps } from "./files.js";
