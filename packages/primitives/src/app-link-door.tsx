import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import type { CSSProperties } from "react";

/*
 * THE DOOR TO ANOTHER APP ON A RECORD (FR-171): what draws an app-link
 * field as the app the host's `resolveApp` names — fetched with the first
 * one drawn, never in the first paint, and never at all for an app whose
 * records link none.
 */

/** What draws one app-link field: the address, how it is drawn, and the record and field it is the value of. */
export interface AppLinkProps {
  /** The address the record keeps. */
  readonly address: string;
  /** `record`: the name and the home's headline under it; `chip`: the name alone, on a row or a card. */
  readonly as?: "record" | "chip";
  /**
   * The record and field it is the value of, where it may be changed in
   * place: the control that changes it stands beside the link, never
   * around it, and only where an act may write it.
   */
  readonly nodeId?: string;
  readonly field?: string;
  readonly style?: CSSProperties;
}

const APP_LINK = /* @__PURE__ */ lazyModule(retryingImport(() => import("./app-link.js")));

export const AppLink = APP_LINK.part((m: typeof import("./app-link.js"), props: AppLinkProps) => m.drawAppLink(props), { quiet: true });
