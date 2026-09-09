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

/** The views for the garden — or for a chapter of it, which may not have plots yet. */
export function seedbedViews(schema: SeedbedSchema = seedbedSchema) {
  const registry = registerDefaultViews(schema, createViews(schema));
  if (!(schema.kinds as readonly string[]).includes("plot")) return registry;
  /*
   * Summary only. At full fidelity the generic view already shows the
   * plot's fields and what it is connected to — and this one, which only
   * has the warning to add, showed a large empty card instead. The rule in
   * the skill applies to the framework's own example: override a fidelity
   * when the generic view is genuinely wrong there, not on principle.
   */
  return registry.register("plot", { cardinality: "one", fidelity: "summary" }, PlotView as ViewComponent<S>);
}
