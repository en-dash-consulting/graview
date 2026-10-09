import type { HostAi } from "@graview/tools";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, useGraph, useGraview, type Scheme } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import { templateIntelligence, type ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import { discographyApp, createStore, type DiscographyStore } from "../domain/app.js";
import { discographyBrand } from "../domain/brand.js";
import type { DiscographySchema } from "../domain/schema.js";
import { views } from "./views.js";
import { openingSeat, SEATS } from "./seats.js";

type S = DiscographySchema;

/**
 * The app opens from ALTITUDE: every kind a district, each saying how many
 * it holds — or "none yet", which is an invitation rather than a void.
 */
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, overview: true };

export interface DiscographyAppProps {
  readonly store?: DiscographyStore;
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  /** Whether the store behind this app is remembered in the browser (see main.tsx). */
  readonly remembers?: boolean;
  /** The host's model for the seat — a dev server's, when it holds a key (`aiThroughDevServer`). */
  readonly ai?: HostAi;
}

/**
 * The whole application. `Shell` is the command bar, the scene, the
 * inspector and the rail, derived; what Discography adds is a
 * sentence for when nothing is wrong and a seat for an agent. If this file
 * grows, ask whether the declaration should have grown instead.
 */
export function DiscographyApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
  ai,
}: DiscographyAppProps) {
  const created = useMemo(() => store ?? createStore(), [store]);
  const registry = useMemo(() => views(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      {...(ai ? { ai } : {})}
      store={created}
      views={registry}
      initialView={initialView}
      scheme={scheme}
      brand={discographyBrand}
      settings={discographyApp.settings ?? []}
      principal={openingSeat()}
      seats={SEATS}
    >
      <Shell<S>
        standing="Everything is in order"
        // Graview's own example, so it signs itself — quietly, in the person's menu.
        signature
        /*
         * THE APP'S OWN DECLARATION, one press away and in place. The
         * kinds, fields, edges, acts and rules of `src/domain` are a graph
         * here: change one with the ordinary acts, watch the checker judge
         * it, and apply to get the files to write back. Offered to the seat
         * that administers where there is one, and to whoever is here where
         * there is not — which is this project, today.
         */
        studio={<StudioPlace app={discographyApp} />}
        seat={(onCall) => <Starter onCall={onCall} />}
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

/**
 * The seat at zero. An empty graph plus a seat that proposes starter data is
 * the "describe your domain, get a working app" moment. Every proposal is an
 * ordinary mutation through the derived tool surface — logged, attributed to
 * the seat, reviewable, undoable.
 */
function Starter({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const nodes = useGraph();
  const empty = nodes.length === 0;
  return (
    <AgentSeat<S>
      who="starter"
      testId="agent-starter"
      count={empty ? 1 : 0}
      gate="add-song"
      label={() => "Add some starter data"}
      busyLabel="Adding…"
      idle="There is something here already"
      onCall={onCall}
      run={async (agent) => {
        const starter = templateIntelligence<S>();
        for (const proposal of await starter.propose(store)) {
          await agent.run(proposal.mutation, { ...proposal.args });
        }
      }}
    />
  );
}
