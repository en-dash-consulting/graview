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
  rowGroup: "area",
  groupOrder: ["lens", "declaration", "behaviour"],
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
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...MUTED_TEXT }}>{node.tagline}</p>
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
            style={{ alignSelf: "flex-start", fontSize: 13 }}
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
              href={`http://localhost:${node.port}/`}
              style={{ fontSize: 12, color: "var(--graview-accent)" }}
            >
              Or open it on its own port ↗
            </a>
          ) : (
            <p style={{ margin: 0, fontSize: 11.5, ...FAINT_TEXT }}>
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
        <p style={{ margin: 0, fontSize: 12.5, ...MUTED_TEXT }}>{node.note}</p>
      ) : null}
      {fidelity === "full" ? (
        <Connections id={node.id} empty="Nothing uses this." />
      ) : null}
    </Panel>
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
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...MUTED_TEXT }}>{node.rationale}</p>
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
