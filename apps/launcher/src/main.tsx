import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import {
  Chip,
  Connections,
  FAINT_TEXT,
  Inspector,
  MUTED_TEXT,
  Panel,
  Roster,
  Trail,
  createCoverageLens,
  hueFor,
  registerDefaultViews,
  themeCss,
  type Scheme,
} from "@graview/primitives";
import {
  GraviewProvider,
  Scene,
  createViews,
  useGraview,
  type ViewComponent,
  type ViewProps,
} from "@graview/react";
import { HouseholdApp } from "the household example/ui";
import { BidDeskApp } from "the bid-desk example/ui";
import { CoachingApp } from "the coaching example/ui";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { APPS } from "./apps.js";
import { launcherSchema, type LauncherSchema } from "./graph.js";
import { createLauncherStore } from "./graph.js";

type S = LauncherSchema;

/**
 * A way between the Graview apps on this machine — and, because it is built
 * out of their own declarations, a view OF them rather than a list of links.
 *
 * Each app is mounted in place rather than linked to a port. One server, one
 * theme, instant switching, and no arguing with three terminals about which
 * of them is running. The port and command are still on the card, because
 * sometimes you do want the app on its own.
 */

const MATRIX = aggregateId("app", "capability");
const HOME: ViewState = { ...EMPTY_VIEW, focusId: MATRIX };

/**
 * Apps against framework capabilities.
 *
 * The coverage lens for the fourth time, and the first time pointed at the
 * framework itself. An empty ROW is a capability nothing uses — dead weight
 * worth arguing about. An empty COLUMN would be an app exercising nothing.
 */
const capabilityLens = createCoverageLens<S>({
  rows: "capability",
  columns: "app",
  link: "uses",
  rowGroup: "area",
  groupOrder: ["lens", "declaration", "behaviour"],
});

const MatrixView = ((props: ViewProps<S>) => (
  <capabilityLens.View {...props} label="What each app exercises" />
)) as ViewComponent<S>;

function AppView({ node, fidelity, selected }: ViewProps<S, "app">) {
  const [, setOpen] = useOpenApp();
  if (!node) return null;
  if (fidelity === "glyph") {
    return <Chip label={node.label} hue={hueFor("app")} selected={selected} />;
  }
  return (
    <Panel title={node.label} meta={`:${node.port}`} selected={selected} fit>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...MUTED_TEXT }}>{node.tagline}</p>
      <Roster
        max={5}
        items={[
          { id: "kinds", label: `${node.kinds} kinds` },
          { id: "edges", label: `${node.edges} edge kinds` },
          { id: "mutations", label: `${node.mutations} mutations` },
          { id: "invariants", label: `${node.invariants} rules` },
          { id: "lenses", label: `${node.lenses} lenses` },
        ]}
      />
      {fidelity === "full" ? (
        <>
          <button
            type="button"
            data-testid={`open-${node.id}`}
            onClick={() => setOpen(node.id)}
            style={{ alignSelf: "flex-start", fontSize: 13 }}
          >
            Open {node.label}
          </button>
          <p style={{ margin: 0, fontSize: 11.5, ...FAINT_TEXT }}>
            On its own: <code>{node.command}</code>
          </p>
          <Connections id={node.id} empty="It exercises nothing the launcher tracks." />
        </>
      ) : null}
    </Panel>
  );
}

/** Which app is mounted, if any. Kept in the URL so a reload lands back. */
function useOpenApp(): [string | null, (id: string | null) => void] {
  const [open, setOpen] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("app"),
  );
  return [
    open,
    (id) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("app", id);
      else url.searchParams.delete("app");
      url.hash = "";
      window.history.replaceState(null, "", url);
      setOpen(id);
    },
  ];
}

function launcherViews() {
  const registry = registerDefaultViews(launcherSchema, createViews(launcherSchema));
  registry
    .register("app", { cardinality: "one", fidelity: "full" }, AppView as never)
    .register("app", { cardinality: "one", fidelity: "summary" }, AppView as never)
    .register("app", { cardinality: "one", fidelity: "glyph" }, AppView as never)
    .register("app", { cardinality: "many", fidelity: "full" }, MatrixView)
    .register("app", { cardinality: "many", fidelity: "summary" }, MatrixView)
    .register("capability", { cardinality: "many", fidelity: "full" }, MatrixView)
    .register("capability", { cardinality: "many", fidelity: "summary" }, MatrixView);
  return registry;
}

/* --------------------------------------------------------------- the shell */

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

function Launcher() {
  const [open, setOpen] = useOpenApp();
  const [scheme, setScheme] = useState<Scheme>(initialScheme);
  const store = useMemo(() => createLauncherStore(), []);
  const views = useMemo(() => launcherViews(), []);

  const changeScheme = (next: Scheme) => {
    setScheme(next);
    applyScheme(next);
  };

  if (open) {
    const entry = APPS.find((candidate) => candidate.id === open);
    const Mounted =
      entry === undefined
        ? null
        : entry.id === "the household example"
          ? HouseholdApp
          : entry.id === "proposal"
            ? BidDeskApp
            : entry.id === "the coaching example"
              ? CoachingApp
              : null;
    if (Mounted && entry) {
      return (
        <>
          {/*
            * Mounted in place, not linked to.
            *
            * Each app is an ordinary component with its own provider, so the
            * launcher does not need three dev servers running to move between
            * them — and the theme, which lives on one stylesheet, follows you
            * across without a flash.
            */}
          <Mounted
            key={entry.id}
            syncUrl
            renderer="dom"
            initialScheme={scheme}
            onSchemeChange={changeScheme}
          />
          <Switcher current={entry.id} onChoose={setOpen} />
        </>
      );
    }
  }

  return (
    <GraviewProvider store={store} views={views} initialView={HOME} scheme={scheme}>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
      >
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
            }}
          >
            graview
          </span>
          <Trail home={MATRIX} homeLabel="What each app exercises" />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {APPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-testid={`launch-${entry.id}`}
                onClick={() => setOpen(entry.id)}
                style={{ fontSize: 12.5, whiteSpace: "nowrap" }}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              data-testid="scheme"
              aria-label={`Switch to ${scheme === "dark" ? "light" : "dark"} mode`}
              onClick={() => changeScheme(scheme === "dark" ? "light" : "dark")}
              style={{ padding: "6px 9px", lineHeight: 1 }}
            >
              {scheme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <Scene renderer="dom" />
          <Inspector />
        </div>
      </div>
    </GraviewProvider>
  );
}

/** A way back, and a way sideways, from inside a mounted app. */
function Switcher({
  current,
  onChoose,
}: {
  current: string;
  onChoose: (id: string | null) => void;
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
                onChoose(entry.id);
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
              onChoose(null);
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

applyScheme(initialScheme());
const root = document.getElementById("root");
if (!root) throw new Error("no #root");
createRoot(root).render(<Launcher />);
