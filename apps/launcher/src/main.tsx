import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  ActivityRail,
  BackOut,
  Inspector,
  OverviewButton,
  Standing,
  Trail,
  themeCss,
  type Scheme,
} from "@graview/primitives";
import { GraviewProvider, Scene, useGraph, useGraview, useUrlSync } from "@graview/react";
import { createInAppAdapter, createToolRuntime, type ToolCall } from "@graview/tools";
import { HouseholdApp } from "the household example/ui";
import { BidDeskApp } from "the bid-desk example/ui";
import { CoachingApp } from "the coaching example/ui";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createLauncherStore, type LauncherStore } from "./domain/app.js";
import { APPS } from "./domain/survey.js";
import type { LauncherSchema } from "./domain/schema.js";
import { LivenessProvider, useLiveness } from "./ui/liveness.js";
import { launcherViews } from "./ui/views.js";

type S = LauncherSchema;

/**
 * The desk, and it is a Graview app now rather than a Graview scene.
 *
 * Which changes one thing that matters: WHICH APP IS IN FRONT OF YOU LIVES IN
 * THE GRAPH. It was React state and a query string, so the single most
 * interesting thing this surface does was invisible to the op log, could not
 * be undone, and sat outside the model. It is a `showing` edge now, so
 * opening an app appears in the activity rail with an author, undo closes it,
 * and the agent seat can do it — through exactly the same mutation a person
 * uses.
 */

const MATRIX = aggregateId("app", "capability");
const HOME: ViewState = { ...EMPTY_VIEW, focusId: MATRIX };

const MOUNTS: Record<string, (props: Record<string, unknown>) => ReactElement> = {
  the household example: HouseholdApp,
  proposal: BidDeskApp,
  the coaching example: CoachingApp,
};

/* ------------------------------------------------------------------- theme */

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [...(document.adoptedStyleSheets ?? []), sheet];
const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const forced = new URLSearchParams(window.location.search).get("theme");
  if (forced === "light" || forced === "dark") return forced;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private windows and blocked storage are ordinary, not exceptional.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
}

/* -------------------------------------------------------------------- desk */

/** What the graph says is in front of you. */
function useShowing(): string | null {
  const { store } = useGraview<S>();
  const nodes = useGraph<S>();
  return useMemo(() => {
    const desk = store.graph.nodesOfKind("desk")[0];
    return desk ? (store.graph.out(desk.id, "showing")[0]?.id ?? null) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, nodes]);
}

/** Runs a launcher mutation as a person would: through the store, into the log. */
function useDesk() {
  const { store } = useGraview<S>();
  return useMemo(
    () => ({
      show: (appId: string) =>
        store.apply({ name: "show-app", args: { appId } }, { author: { kind: "human" } }),
      close: () => {
        const desk = store.graph.nodesOfKind("desk")[0];
        if (desk) {
          store.apply({ name: "close-app", args: { deskId: desk.id } }, { author: { kind: "human" } });
        }
      },
    }),
    [store],
  );
}

function Desk({
  scheme,
  onScheme,
}: {
  scheme: Scheme;
  onScheme: (scheme: Scheme) => void;
}) {
  const showing = useShowing();
  const desk = useDesk();
  const [calls, setCalls] = useState<readonly ToolCall[]>([]);
  const onCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      const settling =
        call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);

  /*
   * The graph decides; the URL follows, so a link still lands where it says.
   *
   * The hash is cleared on the way in and out because it belongs to whoever
   * is on screen: the desk's own `#focus=aggregate:app+capability` names a
   * node that does not exist in the household example, and the mounted app adopts the
   * fragment on load — so leaving it there pointed a freshly opened app at
   * nothing.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (showing) url.searchParams.set("app", showing);
    else url.searchParams.delete("app");
    url.hash = "";
    window.history.replaceState(null, "", url);
  }, [showing]);

  if (showing) {
    const Mounted = MOUNTS[showing];
    const entry = APPS.find((candidate) => candidate.id === showing);
    if (Mounted && entry) {
      return (
        <>
          <Mounted
            key={entry.id}
            syncUrl
            renderer="dom"
            initialScheme={scheme}
            onSchemeChange={onScheme}
          />
          <Switcher current={entry.id} onShow={desk.show} onClose={desk.close} />
        </>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <CommandBar scheme={scheme} onScheme={onScheme} onCall={onCall} />
      <BackOut home={MATRIX} />
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {/* Both, always: the overview lays the scene down rather than
            replacing it, so you can see where you were. */}
        <Scene renderer="dom" />
        <ActivityRail calls={calls} />
        <OverviewButton />
        <Inspector />
      </div>
    </div>
  );
}

function CommandBar({
  scheme,
  onScheme,
  onCall,
}: {
  scheme: Scheme;
  onScheme: (scheme: Scheme) => void;
  onCall: (call: ToolCall) => void;
}) {
  const desk = useDesk();
  const live = useLiveness();
  useUrlSync();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
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
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "var(--graview-ink-muted)",
          whiteSpace: "nowrap",
        }}
      >
        graview
      </span>
      <Trail home={MATRIX} homeLabel="What each app exercises" />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <Standing clean="Every capability is earned" />
        <AuditButton onCall={onCall} />
        {APPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`launch-${entry.id}`}
            onClick={() => desk.show(entry.id)}
            title={
              live[entry.id]
                ? `Open here — also serving on :${entry.port}`
                : `Open here. ${entry.command} runs it on :${entry.port}.`
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden="true"
              title={live[entry.id] ? "serving" : "not serving"}
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: live[entry.id] ? "var(--graview-accent)" : "var(--graview-edge)",
              }}
            />
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          data-testid="scheme"
          aria-label={`Switch to ${scheme === "dark" ? "light" : "dark"} mode`}
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
 * An agent seat for the desk, and the least comfortable one here.
 *
 * It reads the survey and opens the app with the most unexercised
 * capabilities — the app most likely to be worth working on next. Its edits
 * are `show-app` calls, so they arrive in the activity rail exactly like a
 * person's and undo takes them back.
 */
function AuditButton({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const runtime = useMemo(
    () => createToolRuntime(store, { author: { kind: "agent", id: "claude", session: "desk" } }),
    [store],
  );
  const agent = useMemo(() => createInAppAdapter(runtime), [runtime]);
  const [busy, setBusy] = useState(false);
  useEffect(() => runtime.onCall(onCall), [runtime, onCall]);

  return (
    <button
      type="button"
      data-testid="agent-audit"
      disabled={busy}
      title="Open whichever app exercises the least of the framework"
      onClick={() => {
        setBusy(true);
        void (async () => {
          try {
            const graph = (await agent.run("get_graph", {})) as {
              nodes: ({ id: string; kind: string } & Record<string, unknown>)[];
              edges: { kind: string; from: string; to: string }[];
            };
            const uses = graph.edges.filter((edge) => edge.kind === "uses");
            const ranked = graph.nodes
              .filter((node) => node.kind === "app")
              .map((node) => ({ node, used: uses.filter((edge) => edge.from === node.id).length }))
              .sort((a, b) => a.used - b.used);
            const thinnest = ranked[0];
            if (!thinnest) return;
            await agent.run("get_node", { id: thinnest.node.id });
            await agent.run("show-app", { appId: thinnest.node.id });
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      {busy ? "Looking…" : "Show me the thinnest"}
    </button>
  );
}

/** A way back, and a way sideways, from inside a mounted app. */
function Switcher({
  current,
  onShow,
  onClose,
}: {
  current: string;
  onShow: (id: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 60,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-start",
        gap: 6,
      }}
    >
      <button
        type="button"
        data-testid="switcher"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="Switch app"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 999,
          fontSize: 12.5,
          background: "var(--graview-float)",
          boxShadow: "var(--graview-lift-high)",
        }}
      >
        <span aria-hidden="true" style={{ letterSpacing: "0.2em", fontSize: 9 }}>
          GV
        </span>
        {APPS.find((entry) => entry.id === current)?.label ?? current}
      </button>
      {open ? (
        <div
          style={{
            display: "grid",
            gap: 4,
            padding: 8,
            borderRadius: 12,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {APPS.filter((entry) => entry.id !== current).map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-testid={`switch-${entry.id}`}
              onClick={() => {
                setOpen(false);
                onShow(entry.id);
              }}
              style={{ fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap" }}
            >
              {entry.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="switch-home"
            onClick={() => {
              setOpen(false);
              onClose();
            }}
            style={{ fontSize: 12.5, textAlign: "left" }}
          >
            All apps
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Launcher() {
  const [scheme, setScheme] = useState<Scheme>(initialScheme);
  const store: LauncherStore = useMemo(
    () => createLauncherStore(new URLSearchParams(window.location.search).get("app") ?? undefined),
    [],
  );
  const views = useMemo(() => launcherViews(), []);
  const changeScheme = (next: Scheme) => {
    setScheme(next);
    applyScheme(next);
  };

  return (
    <GraviewProvider store={store} views={views} initialView={HOME} scheme={scheme}>
      <LivenessProvider>
        <Desk scheme={scheme} onScheme={changeScheme} />
      </LivenessProvider>
    </GraviewProvider>
  );
}

applyScheme(initialScheme());
const root = document.getElementById("root");
if (!root) throw new Error("no #root");
createRoot(root).render(<Launcher />);
