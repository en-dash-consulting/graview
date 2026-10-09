import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import type { Brand, Principal, GraviewApp } from "@graview/core";
import { GraviewProvider, useGraph, useGraview, type Scheme, type SceneProps } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import { templateIntelligence, type HostAi, type ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import { createSeedbedStore, seedbedApp, type SeedbedStore } from "../domain/app.js";
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
  readonly attachRenderer?: SceneProps["attachRenderer"];
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
  /** Whether the garden's own map lens is mounted over the plots, in place of the board. */
  readonly map?: boolean;
  /** Whether the reach lens — what each role may do — is mounted over the people. */
  readonly reach?: boolean;
  /** The declaration this store is a studio over, when it is one. */
  readonly studio?: GraviewApp;
  /** Whether the season calendar is registered over the plantings. */
  readonly season?: boolean;
  /** Whether the rotation — the years a bed turns through — is registered over the rotations. */
  readonly rotation?: boolean;
  /**
   * WHO IS AT THE KEYBOARD, once a chapter declares a policy. The store
   * enforces against it, this face decides what to OFFER by it and the log
   * attributes to it — one object, three readings. Without it the scene
   * derives what an anonymous reader may do, which under a policy is
   * nothing at all.
   */
  readonly principal?: Principal;
  /** The AI the seat may use, as the host decided it. The garden has none of its own. */
  readonly ai?: HostAi;
  /**
   * Whether this is the finished garden, opened the way `open.ts` opens it:
   * the person menu then offers "Start empty" and "Load the example garden".
   * A chapter's garden, and an embedded one, offer neither.
   */
  readonly garden?: boolean;
}

/** The address that opens this garden empty, or planted with the example again. */
function gardenHref(how: "empty" | "example", href: string = window.location.href): string {
  const url = new URL(href);
  url.searchParams.delete(how === "empty" ? "fresh" : "empty");
  url.searchParams.set(how === "empty" ? "empty" : "fresh", "1");
  return url.toString();
}

/**
 * THE WAY TO AN EMPTY GARDEN, AND BACK. The garden opens planted, so the
 * blank graph this example was built to hold the framework to is one press
 * away in the person menu rather than gone: "Start empty" opens it with
 * nothing in it (and this browser remembers that), and "Load the example
 * garden" plants the example again. Each is a navigation, like "Start
 * fresh": the address says what to open and is tidied once it has.
 */
const GARDEN_ACTIONS = [
  { label: "Start empty", onSelect: () => window.location.assign(gardenHref("empty")) },
  { label: "Load the example garden", onSelect: () => window.location.assign(gardenHref("example")) },
] as const;

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
  map = false,
  reach = false,
  studio,
  season = false,
  rotation = false,
  principal,
  ai,
  garden = false,
}: SeedbedAppProps) {
  const created = useMemo(() => store ?? createSeedbedUiStore(), [store]);
  const views = useMemo(
    () => seedbedViews(created.schema, { lens, board, map, reach, season, rotation, ...(studio ? { studio } : {}) }),
    [created, lens, board, map, reach, season, rotation, studio],
  );
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={views}
      initialView={initialView}
      scheme={scheme}
      {...(brand ? { brand } : {})}
      /*
       * WHO IS AT THE KEYBOARD. The chapter's seat reached the store and the
       * routed face and not this one, so from chapter seven onward the scene
       * derived what an ANONYMOUS reader may do — which, with a policy
       * declared, is nothing. The chapter whose claim is "the actions strip
       * narrows, so a gardener never sees a button that would fail" showed a
       * gardener every act struck through, one of them reading "Not
       * permitted: tend — one of coordinator, gardener can" to a gardener.
       */
      {...(principal ? { principal } : {})}
      {...(ai ? { ai } : {})}
      settings={seedbedApp.settings ?? []}
    >
      <Shell<S>
        standing="The garden keeps its agreements"
        {...(garden ? { hostActions: GARDEN_ACTIONS } : {})}
        // Graview's own example, so it signs itself — quietly, in the person's menu.
        signature
        /*
         * The chapter's own declaration, one press away — the chapter the
         * reader is standing in, not a fixed one. Chapter fifteen IS the
         * studio; every chapter before it can now open one over itself,
         * which is the point the chapter was making.
         */
        studio={<StudioPlace app={(studio ?? seedbedApp) as never} />}
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
      who="starter"
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
