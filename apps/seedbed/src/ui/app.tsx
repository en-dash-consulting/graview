import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import type { Brand } from "@graview/core";
import { GraviewProvider, useGraph, useGraview, type Scheme, type SceneProps } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { templateIntelligence, type ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import { createSeedbedStore, type SeedbedStore } from "../domain/app.js";
import type { SeedbedSchema } from "../domain/schema.js";
import { seedbedViews } from "./views.js";

type S = SeedbedSchema;

/**
 * The app opens from ALTITUDE: a city of empty districts.
 *
 * Every other example lands inside the stack because it has a graph worth
 * standing in. An empty one does not — its first honest picture is the map
 * of what COULD exist, each kind a district saying "none yet", each one an
 * invitation. Onboarding starts by looking at the shape of the domain, not
 * at a void with a shelf under it.
 */
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, overview: true };

export function createSeedbedUiStore(): SeedbedStore {
  return createSeedbedStore();
}

export interface SeedbedAppProps {
  readonly store?: SeedbedStore;
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly renderer?: "gpu" | "dom" | "auto";
  readonly attachRenderer?: SceneProps<S>["attachRenderer"];
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  /** Whether the store behind this app is remembered in the browser (see main.tsx). */
  readonly remembers?: boolean;
  /** Whether the agent's seat is in the rail; a chapter before the seat exists says no. */
  readonly seat?: boolean;
  /** The brand, if the declaration has one yet; the framework's own otherwise. */
  readonly brand?: Brand | undefined;
  /** Whether the coverage lens is mounted over the gardeners. */
  readonly lens?: boolean;
  /** Whether the board lens is mounted over the plots. */
  readonly board?: boolean;
}

/**
 * The whole application: the provider, the Shell, and one seat. What the
 * example proves is that this is ALL an app has to write above its
 * declaration — the same file `graview create` writes for a new product.
 */
export function SeedbedApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
  seat = true,
  // No default: a chapter before the brand exists passes nothing, and the
  // framework's own name and palette are the honest picture of that.
  brand,
  lens = true,
  board = true,
}: SeedbedAppProps) {
  const created = useMemo(() => store ?? createSeedbedUiStore(), [store]);
  const views = useMemo(() => seedbedViews(created.schema as never, { lens, board }), [created, lens, board]);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={views}
      initialView={initialView}
      scheme={scheme}
      {...(brand ? { brand } : {})}
    >
      <Shell<S>
        standing="The garden keeps its agreements"
        seat={seat ? (onCall) => <StarterGarden onCall={onCall} /> : undefined}
        remembers={remembers}
        syncUrl={syncUrl}
        renderer={renderer}
        scheme={scheme}
        onScheme={(next) => {
          setScheme(next);
          onSchemeChange?.(next);
        }}
        {...(attachRenderer ? { attachRenderer } : {})}
      />
    </GraviewProvider>
  );
}

/**
 * THE INTELLIGENCE AT ZERO. An empty declared graph plus a seat that can
 * propose starter data is the "describe your domain, get a working app"
 * moment. Every proposal below is an ordinary mutation through the derived
 * tool surface — logged, attributed to the seat, reviewable, undoable. No
 * import path, no fixture file, no bypass.
 */
function StarterGarden({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const nodes = useGraph();
  const empty = nodes.length === 0;

  return (
    <AgentSeat<S>
      testId="agent-starter"
      count={empty ? 1 : 0}
      gate="add-gardener"
      label={() => "Plant a starter garden"}
      busyLabel="Planting…"
      idle="The garden is planted"
      onCall={onCall}
      run={async (agent) => {
        /*
         * The seat asks the INTELLIGENCE SEAM, not a script: the starter
         * provider proposes from the declaration alone — a creator per
         * empty kind, honest arguments off the derived forms — and each
         * proposal applies as an ordinary attributed mutation. Swap in
         * `llmIntelligence({ complete })` and nothing else changes; that
         * is the seam working. The rule lands with untended plots, so the
         * first thing the seat teaches is that the graph argues back.
         */
        const starter = templateIntelligence<S>();
        for (const proposal of await starter.propose(store)) {
          await agent.run(proposal.mutation, { ...proposal.args });
        }
      }}
    />
  );
}
