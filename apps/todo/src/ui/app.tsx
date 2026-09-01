import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  GraviewProvider,
  JackedIn,
  Scene,
  useGraph,
  useGraview,
  useNavigation,
  useUrlSync,
  type Scheme,
  type SceneProps,
} from "@graview/react";
import {
  ActivityRail,
  BackOut,
  AgentSeat,
  Backtrack,
  Inspector,
  OverviewButton,
  RelationKey,
  Standing,
  Trail,
  Wordmark,
} from "@graview/primitives";
import type { ToolCall } from "@graview/tools";
import { useCallback, useEffect, useMemo, useState } from "react";
import example from "../data/example.json";
import { createTodoStore, type TodoStore } from "../domain/app.js";
import { thingsBrand } from "../domain/brand.js";
import type { TodoSchema } from "../domain/schema.js";
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

/** The two places: the week, and the lists. One `focusId` apart. */
export const PLACES = [
  { id: aggregateId("task"), label: "The week" },
  { id: aggregateId("list"), label: "The lists" },
] as const;

export const HOME = PLACES[1].id;
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, focusId: HOME };

/**
 * The day the rules are judged against.
 *
 * Read HERE, at the edge, and threaded through the invariant context — never
 * inside a rule. An invariant that read the clock would give a different
 * answer every morning, could not be tested, and would stop `preview` being
 * able to say what a change would break before it happened. Purity is not
 * fussiness; it is what makes the whole tier answerable.
 *
 * The example data is dated, so a fixed day is what makes its rules fire for
 * a reader who opens it — but freezing the app in September is the sort of
 * thing somebody notices and mistrusts. So the real clock is the default, and
 * `?today=` overrides it for the tests and for the screenshots.
 */
export function today(): string {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("today");
    if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) return asked;
  }
  return new Date().toISOString().slice(0, 10);
}

/** The day the shipped example is written around, for tests and harnesses. */
export const EXAMPLE_TODAY = "2026-09-01";

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
}

export function TodoApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  initialScheme = "light",
  onSchemeChange,
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

/** Where you are, remembered while you wander into a task and back. */
function usePlace(): (typeof PLACES)[number] {
  const { view } = useNavigation();
  const [last, setLast] = useState<(typeof PLACES)[number]>(PLACES[1]);
  const current = PLACES.find((place) => place.id === view.focusId);
  useEffect(() => {
    if (current) setLast(current);
  }, [current]);
  return current ?? last;
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
      <BackOutHere />
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
        <Scene renderer={renderer} {...(attachRenderer ? { attachRenderer } : {})} />
        <RelationKey<S> />
        <Inspector />
      </div>
      <JackedIn />
    </div>
  );
}

/** Escape backs out to whichever place you were in, not always the first. */
function BackOutHere() {
  const place = usePlace();
  return <BackOut home={place.id} />;
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
  const place = usePlace();
  if (syncUrl) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUrlSync();
  }
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
      <Wordmark<S> />
      {/* Every stop is a URL, so back and forward are the browser's. This
          only makes them visible, because nobody should have to know that. */}
      <Backtrack />
      <Places />
      {/* No home crumb: the pressed pill in <Places /> already names the
          place and already goes there. */}
      <Trail home={place.id} />
      {/* WHERE YOU ARE STANDING, all in one group.
          Rising to the Graview is a change of place like the others, and it
          sat at the far right among the buttons that DO things — so the two
          halves of navigation were at opposite ends of the bar with eight
          hundred pixels between them. */}
      <OverviewButton />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <Standing clean="Nothing is out of order" />
        <ActivityRail calls={calls} />
        <TidyButton onCall={onCall} />
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

/** Switching place is switching `focusId`, so history and the URL come free. */
function Places() {
  const { focus } = useNavigation();
  const place = usePlace();
  return (
    <div
      role="group"
      aria-label="View"
      data-testid="places"
      style={{
        display: "flex",
        gap: 2,
        padding: 2,
        borderRadius: 999,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-panel-muted)",
      }}
    >
      {PLACES.map((candidate) => {
        const here = candidate.id === place.id;
        return (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={here}
            onClick={() => focus(candidate.id)}
            style={{
              padding: "3px 11px",
              fontSize: 12.5,
              borderRadius: 999,
              whiteSpace: "nowrap",
              border: "1px solid transparent",
              background: here ? "var(--graview-panel)" : "transparent",
              color: here ? "var(--graview-ink)" : "var(--graview-ink-muted)",
              boxShadow: here ? "var(--graview-lift-low)" : "none",
            }}
          >
            {candidate.label}
          </button>
        );
      })}
    </div>
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
