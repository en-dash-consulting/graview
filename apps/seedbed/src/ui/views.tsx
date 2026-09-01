import { createViews, type ViewProps, type ViewComponent } from "@graview/react";
import { Chip, hueFor, Panel, registerDefaultViews } from "@graview/primitives";
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

export function seedbedViews() {
  const registry = registerDefaultViews(seedbedSchema, createViews(seedbedSchema));
  return registry
    .register("plot", { cardinality: "one", fidelity: "full" }, PlotView as ViewComponent<S>)
    .register("plot", { cardinality: "one", fidelity: "summary" }, PlotView as ViewComponent<S>);
}
