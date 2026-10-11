import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO A RECORD'S FILES (FR-162, FR-163): what draws a picture, a
 * gallery and a document, and the editor that puts one there, fetched with
 * the first file field drawn — never in the first paint, and never at all
 * for an app whose records hold none.
 */
const FILES = /* @__PURE__ */ lazyModule(retryingImport(() => import("./files.js")));
type Files = typeof import("./files.js");

/** A record's file field, changed where it stands (needs the provider an edit runs through). */
export const FileField = FILES.part((m: Files, props: Parameters<Files["FileField"]>[0]) => <m.FileField {...props} />, { what: "These files", as: "div" });
/** A record's file field where nothing changes it here: its files as its page shows them. */
export const FileRow = FILES.part((m: Files, props: Parameters<Files["FileRow"]>[0]) => <m.FileRow {...props} />, { what: "These files", as: "div" });
/** One picture, small: on a card or a row. */
export const FileThumb = FILES.part((m: Files, props: Parameters<Files["FileThumb"]>[0]) => <m.FileThumb {...props} />, { quiet: true });
/** An `image` block. */
export const FilesBlock = FILES.part((m: Files, props: Parameters<Files["FilesBlock"]>[0]) => <m.FilesBlock {...props} />, { quiet: true });
/** A form's file control. */
export const FilesControl = FILES.part((m: Files, props: Parameters<Files["FilesControl"]>[0]) => <m.FilesControl {...props} />, { what: "This field", as: "div" });
