import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
// The door stands with the scene, whose face has fetched `@graview/react` already.
import { mapChoice } from "@graview/react";
import { lazyModule, useGraph, useGraview } from "@graview/react/provider";
import { Suspense } from "react";

/** What the panel beside the map shows: a lens open, one record, one district — or nothing. */
export type MapPanelShowing = { readonly what: "lens"; readonly kind: string } | { readonly what: "record"; readonly id: string } | { readonly what: "district"; readonly kind: string };

/** What the panel shows for this stop and selection, if anything: the one decision, so a test can ask it. */
export function mapPanelShows(choice: { readonly districts: readonly string[]; readonly records: readonly string[]; readonly lens: string | null }): MapPanelShowing | null {
  if (choice.lens !== null) return { what: "lens", kind: choice.lens };
  if (choice.records.length === 1 && choice.districts.length === 0) return { what: "record", id: choice.records[0]! };
  if (choice.districts.length === 1 && choice.records.length === 0) return { what: "district", kind: choice.districts[0]! };
  return null;
}

/*
 * THE PANEL ITSELF, fetched when it is first drawn: a page whose reader
 * never chooses anything from altitude carries none of it.
 */
const panelModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./map-panel.js")));
const Panel = /* @__PURE__ */ panelModule.part((module, props: { readonly showing: MapPanelShowing }) => <module.MapPanelFor showing={props.showing} />, { what: "This panel", quiet: true });

/**
 * BESIDE THE MAP, AT A SIZE A PERSON READS (see `map-panel.tsx`): from
 * altitude, a lens pressed on a district's marquee, a chosen record's links
 * or a chosen district's records, docked beside the map on a desk and a
 * sheet from the foot on a phone. Nothing on the ground.
 */
export function MapPanel<S extends AnySchema>() {
  const { store, view, selection, hiddenKinds } = useGraview<S>();
  useGraph<S>();
  if (!view.overview) return null;
  const showing = mapPanelShows(mapChoice(selection, { ...view, beside: true }, (id) => store.graph.getNode(id)?.kind as string | undefined));
  if (!showing) return null;
  // A district the declaration has not got — an address from another app, a kind since removed — has nothing to list.
  if (showing.what !== "record" && (hiddenKinds.has(showing.kind) || !(store.schema.kinds as readonly string[]).includes(showing.kind))) return null;
  return (
    <Suspense fallback={null}>
      <Panel showing={showing} />
    </Suspense>
  );
}
