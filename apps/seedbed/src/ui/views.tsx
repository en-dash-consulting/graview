import { createViews, useGraview, type ViewProps, type ViewComponent } from "@graview/react";
import { Chip, createBoardLens, createCoverageLens, hueFor, Panel, registerDefaultViews } from "@graview/primitives";
import { seedbedSchema, type SeedbedSchema } from "../domain/schema.js";

type S = SeedbedSchema;

/**
 * Almost nothing, on purpose.
 *
 * `registerDefaultViews` renders every kind at every fidelity from the
 * declarations alone, and for the onboarding example that IS the story:
 * the app you get before you have written a single view is already whole.
 * The one custom view says what an empty plot means — the generic card
 * cannot know that bare beds are an invitation rather than a fact.
 */
function PlotView({ node, fidelity, selected, mode, flagged }: ViewProps<S, "plot">) {
  if (!node) return null;
  const broken = flagged?.includes(node.id) ?? false;
  if (fidelity === "glyph") {
    return <Chip label={node.label} hue={hueFor("plot")} selected={selected} />;
  }
  return (
    <Panel
      title={node.label}
      meta={`${node.beds} ${node.beds === 1 ? "bed" : "beds"}`}
      selected={selected}
      tone={broken ? "warning" : "default"}
      variant={mode === "fullscreen" ? "page" : "card"}
    >
      {broken ? "Waiting for a caretaker — the rule below says so." : null}
    </Panel>
  );
}

/**
 * The coverage lens over the garden: gardeners down the side, plots across
 * the top, a mark where one tends the other. Written for requirements and
 * the tests that answer them; it has never heard of a garden.
 */
const tending = createCoverageLens<S>({ rows: "gardener", columns: "plot", link: "tended-by" });
const TendingView = ((props: ViewProps<S>) => {
  /*
   * A group of gardeners is the view's subject, but the grid is about two
   * kinds: the lens needs the plots too, or it draws rows with no columns.
   * The store has them; the view is what puts them in the lens's hands.
   */
  const { store } = useGraview<S>();
  const nodes = store.graph.allNodes().filter((node) => node.kind === "gardener" || node.kind === "plot");
  return <tending.View {...props} nodes={nodes as never} label="Who tends what" />;
}) as ViewComponent<S>;

/**
 * The board lens over the garden: every plot where it lies, holding what
 * grows in it — and the empty bed is the whole point. Written for a seating
 * plan; here the occupant is the end of the edge that names the slot.
 */
const beds = createBoardLens<S>({
  slots: "plot",
  x: "x",
  y: "y",
  fill: "grows-in",
  fillFrom: "occupant",
  emptyLabel: "nothing sown",
  aspect: 1.7,
});
const BedsView = ((props: ViewProps<S>) => {
  const { store } = useGraview<S>();
  const nodes = store.graph.allNodes().filter((node) => node.kind === "plot" || node.kind === "planting");
  return <beds.View {...props} nodes={nodes as never} label="What grows where" />;
}) as ViewComponent<S>;

/** The views for the garden — or for a chapter of it, which may not have plots yet. */
export function seedbedViews(schema: SeedbedSchema = seedbedSchema, options: { lens?: boolean; board?: boolean } = {}) {
  let registry = registerDefaultViews(schema, createViews(schema));
  const kinds = schema.kinds as readonly string[];
  /*
   * Summary only. At full fidelity the generic view already shows the
   * plot's fields and what it is connected to — and this one, which only
   * has the warning to add, showed a large empty card instead. The rule in
   * the skill applies to the framework's own example: override a fidelity
   * when the generic view is genuinely wrong there, not on principle.
   */
  if (kinds.includes("plot")) {
    registry = registry.register("plot", { cardinality: "one", fidelity: "summary" }, PlotView as ViewComponent<S>);
  }
  if (options.board && kinds.includes("plot") && kinds.includes("planting")) {
    registry = registry
      .register("plot", { cardinality: "many", fidelity: "full" }, BedsView)
      .register("plot", { cardinality: "many", fidelity: "summary" }, BedsView);
  }
  if (options.lens && kinds.includes("gardener")) {
    // The lens, for a group of gardeners. The lens supplies the picture.
    registry = registry
      .register("gardener", { cardinality: "many", fidelity: "full" }, TendingView)
      .register("gardener", { cardinality: "many", fidelity: "summary" }, TendingView);
  }
  return registry;
}
