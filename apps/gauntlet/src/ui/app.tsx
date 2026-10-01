import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, type Scheme } from "@graview/react";
import { Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import { useMemo, useState } from "react";
import { gauntletApp, createStore, type GauntletStore } from "../domain/app.js";
import { gauntletBrand } from "../domain/brand.js";
import type { GauntletSchema } from "../domain/schema.js";
import { views } from "./views.js";
import { openingSeat, SEATS } from "./seats.js";

type S = GauntletSchema;

/** The programme opens from altitude: seven districts, two of them in the thousands. */
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, overview: true };

export interface GauntletAppProps {
  readonly store?: GauntletStore;
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  readonly remembers?: boolean;
}

/**
 * The whole application, and deliberately nothing of its own: the Shell,
 * the derived pictures and the two lenses. What this example adds is the
 * data — so whatever goes wrong here is the framework's, not this file's.
 */
export function GauntletApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
}: GauntletAppProps) {
  const created = useMemo(() => store ?? createStore(), [store]);
  const registry = useMemo(() => views(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={registry}
      initialView={initialView}
      scheme={scheme}
      brand={gauntletBrand}
      settings={gauntletApp.settings ?? []}
      principal={openingSeat()}
      seats={SEATS}
    >
      <Shell<S>
        standing="The programme is in order"
        studio={<StudioPlace app={gauntletApp} />}
        remembers={remembers}
        syncUrl={syncUrl}
        scheme={scheme}
        onScheme={(next) => {
          setScheme(next);
          onSchemeChange?.(next);
        }}
      />
    </GraviewProvider>
  );
}
