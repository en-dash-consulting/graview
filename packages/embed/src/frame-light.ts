import { Store, type AnySchema, type GraviewApp, type Scheme } from "@graview/core";
import { useEffect, useState } from "react";

/*
 * WHAT A FACE WITH NO BAR NEEDS OF THE FRAME: a store from a declaration and
 * the host page's scheme as it changes. Apart from `./frame.tsx` so a
 * visitor's form (`./form.tsx`, Roadmap f-public-forms) takes them without
 * the bar, the notices and the first look.
 */

/** A store from a declaration and a seed: the app's own policy, in memory. */
export function storeOf<S extends AnySchema>(app: GraviewApp<S>, seed: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] } | undefined): Store<S> {
  return new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(seed ? { snapshot: seed as never } : {}),
    ...(app.policy ? { policy: app.policy } : {}), ...(app.publishing ? { publishing: app.publishing } : {}),
    ...(app.intelligence ? { intelligence: app.intelligence } : {}),
    // The app's day: today() is the date in its zone, as a server's store reads it (Roadmap f-app-time-zone).
    ...(app.brand?.timeZone ? { timeZone: app.brand.timeZone } : {}),
  } as never);
}

/**
 * The host page's scheme: an explicit `data-theme`, else the scheme the
 * app prefers (`brand.scheme`, FR-124), else the system's preference.
 */
export function hostScheme(preferred?: Scheme | "auto"): Scheme {
  if (typeof document === "undefined") return preferred === "dark" ? "dark" : "light";
  const stamped = document.documentElement.dataset["theme"];
  if (stamped === "dark" || stamped === "light") return stamped;
  if (preferred === "dark" || preferred === "light") return preferred;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * THE HOST PAGE'S SCHEME, AS IT CHANGES. Read once, an embed kept the
 * scheme the page had when it mounted: a host that stamps `data-theme` when
 * its own toggle is pressed (or a widget's glue, when the chat says the
 * theme changed) left the embed in the other one.
 */
export function useHostScheme(follow: boolean, preferred?: Scheme | "auto"): Scheme {
  const [scheme, setScheme] = useState<Scheme>(() => hostScheme(preferred));
  useEffect(() => {
    if (!follow || typeof document === "undefined") return;
    const read = () => setScheme(hostScheme(preferred));
    read();
    const stamped = new MutationObserver(read);
    stamped.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    media?.addEventListener?.("change", read);
    return () => {
      stamped.disconnect();
      media?.removeEventListener?.("change", read);
    };
  }, [follow, preferred]);
  return scheme;
}
