import { createSchema, defineNode, isoDate } from "@graview/core";
import { z } from "zod";

/**
 * A community garden, declared — and shipped EMPTY.
 *
 * Every other example arrives full of fixture data, which means the
 * framework's real first screen — a declared schema with nothing in it —
 * had never been rendered once. This app is that screen. Everything below
 * is an ordinary declaration; what is missing on purpose is the data, so
 * that filling it in IS the walkthrough.
 */

export const gardener = defineNode("gardener", {
  description: "Someone with soil under their nails.",
  fields: z.object({ label: z.string().min(1) }),
  plural: "Gardeners",
  label: (node) => node.label,
});

export const plot = defineNode("plot", {
  description: "A patch of ground with a number and a caretaker.",
  fields: z.object({
    label: z.string().min(1),
    beds: z.number().int().min(1),
    // Where it lies in the garden, 0..1 across and down: what the board
    // lens reads to draw the plots where they are rather than in a list.
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  }),
  edges: {
    // One edge, two readings: the plot's page asks who looks after it, the
    // gardener's page says what she looks after. Every surface reads from
    // the end it is standing on.
    "tended-by": { to: ["gardener"], description: "who looks after it", inverse: "what they look after" },
  },
  plural: "Plots",
  label: (node) => node.label,
});

export const planting = defineNode("planting", {
  description: "Something in the ground, from sowing to harvest.",
  fields: z.object({
    label: z.string().min(1),
    sown: isoDate,
    status: z.enum(["growing", "harvested", "failed"]),
  }),
  edges: {
    // Where it went into the ground is a fact about the past: a planting is
    // harvested (a field write), never uprooted from the record.
    "grows-in": {
      to: ["plot"],
      description: "the plot it is planted in",
      inverse: "what is planted here",
      appendOnly: true,
    },
  },
  plural: "Plantings",
  label: (node) => node.label,
  /*
   * The HORIZON, in the app people meet first: a harvested bed leaves the
   * counts but never the graph, and last season is one `past=1` stop away.
   */
  lifecycle: { field: "status", retired: ["harvested", "failed"] },
});

// One rule type today; the second becomes a union member here rather than a
// schema redesign — the same shape the other apps grew along.
const ruleSpec = z.object({ type: z.literal("every-plot-tended") });

export const rule = defineNode("rule", {
  description: "An agreement the garden holds itself to.",
  fields: z.object({ spec: ruleSpec, label: z.string().min(1) }),
  plural: "Rules",
  label: (node) => node.label,
  // The dispatch key: a rule whose spec type has no registered invariant is
  // a rule nobody wrote, and `graview check` says so at build time.
  requiresInvariant: (node) => node.spec.type,
});

export const seedbedSchema = createSchema([gardener, plot, planting, rule]);
export type SeedbedSchema = typeof seedbedSchema;
