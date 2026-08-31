import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  GraviewProvider,
  JackedIn,
  Scene,
  useAttention,
  useGraview,
  useNavigation,
  useUrlSync,
  type Scheme,
  type SceneProps,
} from "@graview/react";
import {
  ActivityRail,
  BackOut,
  Inspector,
  OverviewButton,
  RelationKey,
  Standing,
  Trail,
  Wordmark,
} from "@graview/primitives";
import { createInAppAdapter, createToolRuntime, type ToolCall } from "@graview/tools";
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
 * Threaded through the invariant context rather than read from the clock
 * inside a rule, so evaluation stays pure and a test can ask "what would be
 * overdue on the fourth" without moving anybody's system time.
 */
export const TODAY = "2026-09-01";

export function createTodoUiStore(): TodoStore {
  return createTodoStore({
    snapshot: example as never,
    invariantOptions: { context: { today: TODAY } },
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
      <Places />
      <Trail home={place.id} homeLabel={place.label} />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <Standing clean="Nothing is out of order" />
        <ActivityRail calls={calls} />
        <OverviewButton />
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
 * An agent seat, in about thirty lines.
 *
 * It reads through the same tools an external MCP client would, and its edits
 * produce the same diffs a person's do — which is why the activity list shows
 * its reasoning and its changes without anything here being built for it.
 */
function TidyButton({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const runtime = useMemo(
    () => createToolRuntime(store, { author: { kind: "agent", id: "claude", session: "ui" } }),
    [store],
  );
  const agent = useMemo(() => createInAppAdapter(runtime), [runtime]);
  const [busy, setBusy] = useState(false);

  useEffect(() => runtime.onCall(onCall), [runtime, onCall]);
  // What it LOOKED AT, into the picture. A read produces no diff.
  useAttention(runtime);

  return (
    <button
      type="button"
      data-testid="agent-tidy"
      disabled={busy}
      title={`Hand the list to the agent seat. ${runtime.definitions.length} tools, generated from the schema.`}
      onClick={() => {
        setBusy(true);
        void (async () => {
          try {
            // Ask the framework what is wrong, then apply the repairs it
            // names — rather than deciding what "tidy" means out here.
            const violations = (await agent.run("get_violations", {
              context: { today: TODAY },
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
              await agent.run("reschedule", { ...repair.args, due: TODAY });
            }
          } finally {
            setBusy(false);
          }
        })();
      }}
      style={{ padding: "6px 12px", whiteSpace: "nowrap" }}
    >
      {busy ? "Tidying…" : "Tidy up"}
    </button>
  );
}
