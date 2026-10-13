import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";

/*
 * THE DOOR TO ANOTHER APP ON A RECORD (FR-171): what draws an app-link
 * field as the app the host's `resolveApp` names — fetched with the first
 * one drawn, never in the first paint, and never at all for an app whose
 * records link none.
 */
const APP_LINK = /* @__PURE__ */ lazyModule(retryingImport(() => import("./app-link.js")));

export const AppLink = APP_LINK.part((m: typeof import("./app-link.js"), props: import("./app-link.js").AppLinkProps) => m.drawAppLink(props), { quiet: true });
export type { AppLinkProps } from "./app-link.js";
