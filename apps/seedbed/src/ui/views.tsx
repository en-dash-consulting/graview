import type { GraviewApp } from "@graview/core";
import { createViews, type ViewProps, type ViewComponent } from "@graview/react";
import { createStudioLens } from "@graview/studio";

/**
 * The day the garden is judged and drawn against.
 *
 * The seedbed seeds its plantings around a season; a calendar reading the
 * clock would open on an empty month for anyone visiting out of season, and
 * no harness could photograph it twice.
 */
export const SEEDBED_TODAY = "2026-04-01";
import { Chip, createBoardLens, createCalendarLens, createCoverageLens, hueFor, Panel, reachLens, registerDefaultViews } from "@graview/primitives";
import { seedbedSchema, type SeedbedSchema } from "../domain/schema.js";
import { GardenMapView } from "./garden-map.js";

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

/** The views for the garden — or for a chapter of it, which may not have plots yet. */
export function seedbedViews(
  schema: SeedbedSchema = seedbedSchema,
  options: {
    lens?: boolean;
    board?: boolean;
    map?: boolean;
    reach?: boolean;
    season?: boolean;
    /** Whether the garden looks out over the years it turns its beds through. */
    rotation?: boolean;
    today?: string;
    studio?: GraviewApp;
  } = {},
) {
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
    registry = registry.register("plot", { cardinality: "one", fidelity: "summary" }, PlotView);
  }
  if (options.board && kinds.includes("plot") && kinds.includes("planting")) {
    // Titled, so the lens is a PLACE: listed by name in the bar, pressable
    // from anywhere, and findable again after you have clicked into a plot.
    registry = registry
      .register("plot", { cardinality: "many", fidelity: "full" }, beds.View, { title: "What grows where" })
      .register("plot", { cardinality: "many", fidelity: "summary" }, beds.View, { title: "What grows where" });
  }
  if (options.map && kinds.includes("plot")) {
    // The garden's own lens over its plots, in place of the board: the same
    // registry cell, a drawing the garden made of itself.
    registry = registry
      .register("plot", { cardinality: "many", fidelity: "full" }, GardenMapView, { title: "The garden map" })
      .register("plot", { cardinality: "many", fidelity: "summary" }, GardenMapView, { title: "The garden map" });
  }
  if (options.season && kinds.includes("planting")) {
    /*
     * THE SEASON: what was in the ground, and when.
     *
     * The framework's calendar lens, bound to the garden's own fields —
     * sown, harvested, and the label. A planting is a SPAN, so the month
     * draws it across every day between the two, which is the shape of a
     * growing season and the thing a garden is actually planned around.
     */
    const season = createCalendarLens<S>({
      bindings: { planting: { start: "sown", end: "harvested", label: "label" } },
      today: options.today ?? SEEDBED_TODAY,
      range: "month",
    });
    /*
     * AND THE YEAR, which is the unit a garden is actually planned in.
     *
     * One binding, no second declaration: the same lens, one grain coarser.
     * A month per cell, and a planting sown in March and lifted in July
     * drawn across the five cells it was in the ground for — which is the
     * sentence a gardener says about it and the one a month grid could only
     * answer four times in a row.
     */
    const Year = season.at("year");
    const YearView = ((props: ViewProps<S>) => <Year {...props} label="The year" />) as ViewComponent<S>;
    registry = registry
      .register("planting" as never, { cardinality: "many", fidelity: "full" }, YearView, { title: "The year" })
      .register("planting" as never, { cardinality: "many", fidelity: "summary" }, YearView, { title: "The year" })
      .register("planting" as never, { cardinality: "many", fidelity: "full" }, season.View as ViewComponent<S>, { title: "The season" })
      .register("planting" as never, { cardinality: "many", fidelity: "summary" }, season.View as ViewComponent<S>, { title: "The season" });
  }
  if (options.rotation && kinds.includes("rotation")) {
    /*
     * THE ROTATION, over as many years as this garden turns its beds
     * through — which is four, because that is how many families it grows,
     * and the framework has no opinion about it.
     *
     * The same calendar lens again, bound to the rotation's own fields. A
     * garden whose subject is years had no lens at all before this: it had
     * a month grid it could page through forty-eight times.
     */
    const turning = createCalendarLens<S>({
      bindings: { rotation: { start: "from", end: "to", label: "label" } },
      today: options.today ?? SEEDBED_TODAY,
      range: "years",
      horizon: { years: 4, title: "The rotation" },
    });
    registry = registry
      .register("rotation" as never, { cardinality: "many", fidelity: "full" }, turning.View as ViewComponent<S>, { title: "The rotation" })
      .register("rotation" as never, { cardinality: "many", fidelity: "summary" }, turning.View as ViewComponent<S>, { title: "The rotation" });
  }
  if (options.studio && kinds.includes("kind")) {
    // The studio over a declaration: what the checker says about it as it
    // now stands, a place over the kinds.
    const check = createStudioLens(options.studio);
    registry = registry
      .register("kind" as never, { cardinality: "many", fidelity: "full" }, check.View as unknown as ViewComponent<S>, { title: "What the checker says" })
      .register("kind" as never, { cardinality: "many", fidelity: "summary" }, check.View as unknown as ViewComponent<S>, { title: "What the checker says" });
  }
  if (options.reach && kinds.includes("user")) {
    // What each role reaches, read from the policy the store refuses with:
    // a place, for the seat that keeps the installation.
    registry = registry
      .register("user" as never, { cardinality: "many", fidelity: "full" }, reachLens.View as ViewComponent<S>, { title: "Who may do what" })
      .register("user" as never, { cardinality: "many", fidelity: "summary" }, reachLens.View as ViewComponent<S>, { title: "Who may do what" });
  }
  if (options.lens && kinds.includes("gardener")) {
    // The lens, for a group of gardeners. The lens supplies the picture.
    registry = registry
      .register("gardener", { cardinality: "many", fidelity: "full" }, tending.View, { title: "Who tends what" })
      .register("gardener", { cardinality: "many", fidelity: "summary" }, tending.View, { title: "Who tends what" });
  }
  return registry;
}
