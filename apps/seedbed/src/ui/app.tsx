import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  GraviewProvider,
  Scene,
  useGraph,
  useGraview,
  type Scheme,
  type SceneProps,
  UrlSync,
} from "@graview/react";
import {
  ActivityRail,
  AgentSeat,
  BackOut,
  Backtrack,
  Inspector,
  OverviewButton,
  RelationKey,
  Standing,
  Trail,
  Wordmark,
  QuickRelations,
  ChatPanel,
} from "@graview/primitives";
import { templateIntelligence, type ToolCall } from "@graview/tools";
import { useCallback, useMemo, useState } from "react";
import { createSeedbedStore, type SeedbedStore } from "../domain/app.js";
import { seedbedBrand } from "../domain/brand.js";
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
}

export function SeedbedApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  initialScheme = "light",
  onSchemeChange,
}: SeedbedAppProps) {
  const created = useMemo(() => store ?? createSeedbedUiStore(), [store]);
  const views = useMemo(() => seedbedViews(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={views}
      initialView={initialView}
      scheme={scheme}
      brand={seedbedBrand}
    >
      <Shell
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

function Shell({
  syncUrl,
  renderer,
  scheme,
  onScheme,
  attachRenderer,
}: {
  syncUrl: boolean;
  renderer: "gpu" | "dom" | "auto";
  scheme: Scheme;
  onScheme: (scheme: Scheme) => void;
  attachRenderer?: SceneProps<S>["attachRenderer"];
}) {
  const [calls, setCalls] = useState<readonly ToolCall[]>([]);
  const onCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      const settling =
        call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <CommandBar syncUrl={syncUrl} scheme={scheme} onScheme={onScheme} onCall={onCall} calls={calls} />
      <BackOut home={null} />
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
        <Scene renderer={renderer} {...(attachRenderer ? { attachRenderer } : {})} />
        <RelationKey<S> />
        <QuickRelations<S> />
        <OverviewButton />
        <Inspector />
      </div>
    </div>
  );
}

function CommandBar({
  syncUrl,
  scheme,
  onScheme,
  onCall,
  calls,
}: {
  syncUrl: boolean;
  scheme: Scheme;
  onScheme: (scheme: Scheme) => void;
  onCall: (call: ToolCall) => void;
  calls: readonly ToolCall[];
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 22px",
        height: 56,
        flex: "0 0 auto",
        borderBottom: "1px solid var(--graview-edge)",
        background: "var(--graview-bar)",
        backdropFilter: "blur(14px)",
        position: "relative",
        zIndex: 20,
      }}
    >
      {syncUrl ? <UrlSync /> : null}
      <Wordmark<S> />
      <Backtrack />
      <Trail home={null} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* The scene offering the page face: two faces, one application. */}
        <a
          href="/pages"
          data-testid="pages-link"
          title="The same app, as ordinary pages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 24,
            padding: "2px 8px",
            fontSize: 12.5,
            color: "var(--graview-ink-muted)",
            textDecoration: "none",
          }}
        >
          Pages
        </a>
        <Standing clean="The garden keeps its agreements" />
        <ChatPanel<S> onCall={onCall} />
        <ActivityRail calls={calls} seat={<StarterGarden onCall={onCall} />} />
        <button
          type="button"
          data-testid="scheme"
          aria-label={`Switch to ${scheme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${scheme === "dark" ? "light" : "dark"} mode`}
          onClick={() => onScheme(scheme === "dark" ? "light" : "dark")}
          style={{ padding: "6px 9px", lineHeight: 1 }}
        >
          {scheme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
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
