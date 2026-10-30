import type { AnySchema, Principal, Store } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import type { ToldStore } from "@graview/core/told";
import { lazyModule } from "@graview/react/provider";
import type { ComponentType } from "react";

/**
 * "WHAT GRAVIEW HAS BEEN TOLD" (Roadmap f-menu-learns), the door: the
 * Studio's panel of what people told this app (`told-panel.tsx`) is fetched
 * when it is opened, never with the Studio — a host that hands the Studio
 * in carries only this.
 */
export interface ToldPanelProps {
  readonly told: ToldStore;
  readonly store: Store<AnySchema>;
  readonly principal: Principal;
  readonly onClose: () => void;
}

const panel = /* @__PURE__ */ lazyModule(retryingImport(() => import("./told-ui.js")));

export const ToldPanelDoor: ComponentType<ToldPanelProps> = /* @__PURE__ */ panel.part(
  (module, props: ToldPanelProps) => <module.ToldPanel {...props} />,
  { what: "What Graview has been told" },
);
