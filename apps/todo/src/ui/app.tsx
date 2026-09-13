import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  GraviewProvider,
  useGraph,
  useGraview,
  useNavigation,
  type Scheme,
  type SceneProps,
} from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import type { Principal } from "@graview/core";
import type { ToolCall } from "@graview/tools";
import { useEffect, useMemo, useState } from "react";
import example from "../data/example.json";
import { createTodoStore, todoApp, type TodoStore } from "../domain/app.js";
import { thingsBrand } from "../domain/brand.js";
import type { TodoSchema } from "../domain/schema.js";
import { today } from "./when.js";
import { todoViews } from "./views.js";

type S = TodoSchema;

/**
 * The whole shell, and it is short on purpose.
 *
 * Everything that is not about tasks — what is selected and what can be done
 * with it, whether the rules hold, what just happened and how to take it back,
 * the way out of a view, the way up to the Graview — comes from
 * `@graview/primitives` already derived. An app supplies a name, a home view,
 * and whatever seat it wants to give an agent.
 */

/**
 * TWO SEATS AT THE KEYBOARD, so the policy can be felt rather than believed.
 *
 * A principal's id is its USER NODE's id — that is what a self grant
 * compares, so Sam editing Sam's own profile is permitted and Sam editing
 * Nora's is not, with no code out here deciding it. Sitting down in one
 * re-derives every surface: the strip's acts and its withheld sentences,
 * whether the people and invitations are drawn at all, whether "Show the
 * installation" and "Who may do what" are on the bar, what the routed face
 * lists, and the agent's tool list.
 */
export const SEATS = [
  { label: "Nora, keeper", principal: { kind: "human", id: "user-nora", roles: ["keeper"] } },
  { label: "Sam, member", principal: { kind: "human", id: "user-sam", roles: ["member"] } },
] as const satisfies readonly { label: string; principal: Principal }[];

/**
 * Which seat the app opens in. `?as=user-sam` is how a harness, a
 * screenshot or a link sits somebody down somewhere other than the front.
 */
export function openingSeat(): Principal {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("as");
    const found = SEATS.find((seat) => seat.principal.id === asked);
    if (found) return found.principal;
  }
  return SEATS[0].principal;
}

/** The two places: the week, and the lists. One `focusId` apart. */
export const PLACES = [
  { id: aggregateId("task"), label: "The week" },
  { id: aggregateId("list"), label: "The lists" },
] as const;

export const HOME = PLACES[1].id;
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, focusId: HOME };

/*
 * The day, from its own module — the views need it too, and reaching back
 * into the shell for it would close a cycle. Re-exported because every test
 * and harness in the repository imports it from here.
 */
export { EXAMPLE_TODAY, today } from "./when.js";

export function createTodoUiStore(when: string = today()): TodoStore {
  return createTodoStore({
    snapshot: example as never,
    invariantOptions: { context: { today: when } },
  });
}

export interface TodoAppProps {
  readonly store?: TodoStore;
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly renderer?: "gpu" | "dom" | "auto";
  readonly attachRenderer?: SceneProps<S>["attachRenderer"];
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  /** Whether the store behind this app is remembered in the browser (see main.tsx). */
  readonly remembers?: boolean;
  /** Which seat the app opens in; the bar offers the other. */
  readonly principal?: Principal;
  /** Told when a seat is taken, for a host that keeps the choice in its address. */
  readonly onSeat?: (principal: Principal) => void;
}

export function TodoApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
  principal,
  onSeat,
}: TodoAppProps) {
  const created = useMemo(() => store ?? createTodoUiStore(), [store]);
  const views = useMemo(() => todoViews(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={views}
      initialView={initialView}
      scheme={scheme}
      brand={thingsBrand}
      principal={principal ?? openingSeat()}
      seats={SEATS}
      settings={todoApp.settings ?? []}
      {...(onSeat ? { onSeat } : {})}
    >
      <TodoShell
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

/** Where you are, remembered while you wander into a task and back. */
function usePlace(): (typeof PLACES)[number] {
  const { view } = useGraview<S>();
  const [place, setPlace] = useState<(typeof PLACES)[number]>(PLACES[1]);
  useEffect(() => {
    const here = PLACES.find((candidate) => candidate.id === view.focusId);
    if (here) setPlace(here);
  }, [view.focusId]);
  return place;
}

/**
 * The Shell, with what this app adds: a places switcher in the bar, and
 * Escape backing out to whichever place you were in, not always the first.
 */
function TodoShell({
  remembers,
  syncUrl,
  renderer,
  scheme,
  onScheme,
  attachRenderer,
}: {
  remembers: boolean;
  syncUrl: boolean;
  renderer: "gpu" | "dom" | "auto";
  scheme: Scheme;
  onScheme: (scheme: Scheme) => void;
  attachRenderer?: SceneProps<S>["attachRenderer"];
}) {
  const place = usePlace();
  return (
    <Shell<S>
      home={place.id}
      standing="Nothing is out of order"
      /*
       * NO SWITCHER OF ITS OWN. The framework's named places are the same
       * machinery — three pictures over two groups, each a pill with a URL
       * — and running a second one beside it put "The week" on the bar
       * twice, which `audit-ui` reports as the duplication it is.
       */
      // A person's own record on the routed face: the profile the self
      // grant already makes theirs to edit and nobody else's.
      profileHref={(userId) => `/pages/people/${userId}`}
      /*
       * THE APP'S OWN DECLARATION, one press away. The keeper who keeps
       * who is here also keeps what the app IS — its kinds, fields, acts
       * and rules — and changes it with the same gestures, checked before
       * anything is written.
       */
      studio={<StudioPlace app={todoApp} />}
      seat={(onCall) => <TidyButton onCall={onCall} />}
      remembers={remembers}
      syncUrl={syncUrl}
      renderer={renderer}
      scheme={scheme}
      onScheme={onScheme}
      {...(attachRenderer ? { attachRenderer } : {})}
    />
  );
}

/**
 * The agent seat: hand the list over and watch what it does.
 *
 * It asks the framework what is wrong rather than deciding out here what
 * "tidy" means, then applies the repairs the rule itself named.
 */
function TidyButton({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const nodes = useGraph();
  const late = useMemo(
    () =>
      store.graph
        .allNodes()
        .filter((node) => {
          const task = node as unknown as { kind: string; done?: boolean; due?: string };
          return task.kind === "task" && !task.done && task.due !== undefined && task.due < today();
        }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, nodes],
  );

  return (
    <AgentSeat<S>
      who="tidy"
      testId="agent-tidy"
      count={late}
      gate="reschedule"
      label={(n) => `Move ${n} overdue`}
      busyLabel="Tidying…"
      idle="Nothing is overdue"
      onCall={onCall}
      run={async (agent) => {
        const violations = (await agent.run("get_violations", {
          context: { today: today() },
        })) as {
          invariant: string;
          repairs: { mutation: string; args?: Record<string, unknown> }[];
        }[];
        for (const violation of violations) {
          if (violation.invariant !== "nothing-overdue") continue;
          const repair = violation.repairs.find(
            (candidate) => candidate.mutation === "reschedule",
          );
          if (!repair) continue;
          await agent.run("reschedule", { ...repair.args, due: today() });
        }
      }}
    />
  );
}
