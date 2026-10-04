import {
  Chip,
  Connections,
  FAINT_TEXT,
  MUTED_TEXT,
  Panel,
  Roster,
  createCoverageLens,
  hueFor,
  registerDefaultViews,
} from "@graview/primitives";
import {
  createViews,
  useApplyAffordance,
  useGraview,
  type ReactViewRegistry,
  type ViewComponent,
  type ViewProps,
} from "@graview/react";
import { addressOf, APPS } from "../domain/survey.js";
import { launcherSchema, type LauncherSchema } from "../domain/schema.js";
import { useLiveness } from "./liveness.js";

type S = LauncherSchema;

/**
 * Apps against framework capabilities — the coverage lens for the fourth
 * time, and the first pointed at the framework rather than at a domain.
 *
 * An empty ROW is a capability nothing uses. An empty COLUMN would be an app
 * exercising nothing. Both are questions about Graview, asked with Graview.
 */
export const capabilityLens = createCoverageLens<S>({
  rows: "capability",
  columns: "app",
  link: "uses",
  /*
   * IN THE ORDER A PERSON MEETS THEM, not in the order a taxonomy would
   * put them. The list is an onboarding — declare it, look at it, lenses
   * and places, the routed face, who may do what, brand and embed,
   * remember and ship, the agent and the studio — and grouping it by
   * whether a thing is "a lens" or "a declaration" was answering a
   * question about the framework's own filing rather than about what
   * somebody needs to be shown next.
   */
  rowGroup: "at",
});

const MatrixView = ((props: ViewProps<S>) => (
  <capabilityLens.View {...props} label="What each app exercises" />
)) as ViewComponent<S>;

function AppView({ node, fidelity, selected, flagged }: ViewProps<S, "app">) {
  const { store } = useGraview<S>();
  const { apply } = useApplyAffordance<S>();
  const live = useLiveness();
  if (!node) return null;
  const broken = flagged?.includes(node.id) ?? false;
  const showing = store.graph.in(node.id, "showing").length > 0;

  if (fidelity === "glyph") {
    return <Chip label={node.label} hue={hueFor("app")} selected={selected} />;
  }
  return (
    <Panel
      title={node.label}
      meta={showing ? "open" : live[node.id] ? `live :${node.port}` : `:${node.port}`}
      selected={selected}
      tone={broken ? "warning" : fidelity === "summary" ? "muted" : "default"}
      fit
    >
      <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.5, ...MUTED_TEXT }}>{node.tagline}</p>
      <Roster
        max={4}
        items={[
          { id: "kinds", label: `${node.kinds} kinds` },
          { id: "edges", label: `${node.edgeKinds} edge kinds` },
          { id: "mutations", label: `${node.mutations} mutations` },
          { id: "rules", label: `${node.rules} rules` },
        ]}
      />
      {fidelity === "full" ? (
        <>
          <button
            type="button"
            data-testid={`open-${node.id}`}
            /*
             * Opening runs the MUTATION, not a setState. It goes through the
             * same path a repair or an agent would take, so it lands in the
             * op log with an author and it can be undone.
             */
            onClick={() =>
              apply(
                {
                  id: "open",
                  label: "Open",
                  provider: "schema",
                  mutation: "show-app",
                  args: { appId: node.id },
                  open: [],
                  score: 0,
                  why: "you asked for it",
                  nodeIds: [node.id],
                },
                {},
              )
            }
            style={{ alignSelf: "flex-start", fontSize: "0.8125rem" }}
          >
            Open {node.label}
          </button>
          {/*
            * Two ways in, and the second is honest about whether it will
            * work: mounting always does, and the link only appears when
            * something is actually answering on that port. A launcher that
            * offers dead links is worse than one that offers none.
            */}
          {live[node.id] ? (
            <a
              data-testid={`visit-${node.id}`}
              href={`${addressOf(APPS.find((entry) => entry.id === node.id) ?? node)}/`}
              style={{ fontSize: "0.75rem", color: "var(--graview-accent)" }}
            >
              Or open it on its own port ↗
            </a>
          ) : (
            <p style={{ margin: 0, fontSize: "0.71875rem", ...FAINT_TEXT }}>
              Not serving. <code>{node.command}</code> to run it on :{node.port}.
            </p>
          )}
          <Connections id={node.id} empty="It exercises nothing the desk tracks." />
        </>
      ) : null}
    </Panel>
  );
}

function CapabilityView({ node, fidelity, selected, flagged }: ViewProps<S, "capability">) {
  const { store } = useGraview<S>();
  if (!node) return null;
  const broken = flagged?.includes(node.id) ?? false;
  const users = store.graph.in(node.id, "uses");
  if (fidelity === "glyph") {
    return (
      <Chip label={`${node.label}${broken ? " ⚠" : ""}`} hue={hueFor(node.area)} selected={selected} />
    );
  }
  return (
    <Panel
      title={node.label}
      meta={`${users.length} ${users.length === 1 ? "user" : "users"}`}
      subtitle={node.area}
      selected={selected}
      tone={broken ? "warning" : fidelity === "summary" ? "muted" : "default"}
      fit
    >
      {node.note ? (
        <p style={{ margin: 0, fontSize: "0.78125rem", ...MUTED_TEXT }}>{node.note}</p>
      ) : null}
      {/*
        * WHERE TO SEE IT. A list of capabilities you cannot press is a
        * brochure; this opens the demo on the thing. The stop is the
        * address the app itself understands — a focus, a picture, a
        * chapter, a routed path — so the desk needs to know nothing about
        * what any of them mean.
        */}
      {fidelity === "full" && node.shownIn && node.stop ? (
        <ShowMe app={node.shownIn} stop={node.stop} />
      ) : null}
      {fidelity === "full" ? (
        <Connections id={node.id} empty="Nothing uses this." />
      ) : null}
    </Panel>
  );
}

/**
 * The way to the demo that shows it.
 *
 * A link rather than a mount: the stop may be a routed path (`/pages`,
 * `/embed.html`) or a query the app reads on load (`?chapter=14`,
 * `?server=…`), and only the app at its own port understands all of them.
 * The desk says where and gets out of the way.
 */
function ShowMe({ app, stop }: { app: string; stop: string }) {
  const live = useLiveness();
  const entry = APPS.find((candidate) => candidate.id === app);
  if (!entry) return null;
  const serving = live[app] === true;
  const where = `${addressOf(entry)}${stop.startsWith("/") || stop.startsWith("?") ? stop : `/${stop}`}`;
  return serving ? (
    <a
      href={where}
      target="_blank"
      rel="noreferrer"
      data-testid={`show-me-${app}`}
      title={`Open ${entry.label} at ${stop}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: "0.78125rem",
        border: "1px solid var(--graview-edge)",
        color: "var(--graview-accent)",
        textDecoration: "none",
        justifySelf: "start",
      }}
    >
      See it in {entry.label} ↗
    </a>
  ) : (
    <span style={{ fontSize: "0.78125rem", ...MUTED_TEXT }} data-testid={`show-me-${app}`}>
      {entry.label} shows it — <code>{entry.command}</code> serves it on :{entry.port}.
    </span>
  );
}

function RuleView({ node, fidelity, selected }: ViewProps<S, "rule">) {
  if (!node) return null;
  if (fidelity === "glyph") {
    return <Chip label={node.label} hue={hueFor("rule")} selected={selected} />;
  }
  return (
    <Panel title={node.label} subtitle={node.spec.type} selected={selected} tone="warning" fit>
      {node.rationale ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.5, ...MUTED_TEXT }}>{node.rationale}</p>
      ) : null}
    </Panel>
  );
}

export function launcherViews(): ReactViewRegistry<S> {
  const registry = registerDefaultViews(launcherSchema, createViews(launcherSchema));
  const one = <K extends Parameters<typeof registry.register>[0]>(
    kind: K,
    view: Parameters<typeof registry.register>[2],
  ) => {
    registry
      .register(kind, { cardinality: "one", fidelity: "full" }, view)
      .register(kind, { cardinality: "one", fidelity: "summary" }, view)
      .register(kind, { cardinality: "one", fidelity: "glyph" }, view);
  };

  one("app", AppView as never);
  one("capability", CapabilityView as never);
  one("rule", RuleView as never);

  registry
    .register("app", { cardinality: "many", fidelity: "full" }, MatrixView)
    .register("app", { cardinality: "many", fidelity: "summary" }, MatrixView)
    .register("capability", { cardinality: "many", fidelity: "full" }, MatrixView)
    .register("capability", { cardinality: "many", fidelity: "summary" }, MatrixView);

  return registry;
}
