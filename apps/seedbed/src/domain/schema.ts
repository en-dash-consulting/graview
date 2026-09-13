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
  figure: "person",
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
  figure: "plot",
});

export const planting = defineNode("planting", {
  description: "Something in the ground, from sowing to harvest.",
  fields: z.object({
    label: z.string().min(1),
    sown: isoDate,
    /*
     * WHEN IT CAME IN, which is what makes a planting a SPAN rather than a
     * moment. Sown in March and harvested in July is one thing that happens
     * over four months, and a calendar that could only show the day it
     * began would answer a different question than the one anybody asks a
     * garden. Optional because a growing planting has no answer yet, which
     * is exactly the case the horizon is about.
     */
    harvested: isoDate.optional(),
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
  figure: "box",
  /*
   * The HORIZON, in the app people meet first: a harvested bed leaves the
   * counts but never the graph, and last season is one `past=1` stop away.
   */
  lifecycle: { field: "status", retired: ["harvested", "failed"] },
});

export const rotation = defineNode("rotation", {
  description: "What a plot grows through a season, before it moves on to the next family.",
  fields: z.object({
    label: z.string().min(1),
    /*
     * The four families a bed turns through, and the year it rests. This is
     * the whole reason a garden thinks in years rather than in months: the
     * brassicas that went in this spring say where the legumes go in three
     * springs' time, and no month grid can show that.
     */
    family: z.enum(["brassicas", "legumes", "roots", "alliums", "resting"]),
    from: isoDate,
    to: isoDate,
  }),
  edges: {
    "turns-over": {
      to: ["plot"],
      cardinality: "one",
      description: "the plot it turns over",
      inverse: "what it grows, year by year",
      // Which plot grew what is a fact about the past, like where a planting
      // went into the ground: a rotation is the record, never a pointer that
      // moves.
      appendOnly: true,
    },
  },
  plural: "Rotations",
  label: (node) => node.label,
  figure: "plot",
});

// One rule type today; the second becomes a union member here rather than a
// schema redesign — the same shape the other apps grew along.
const ruleSpec = z.object({ type: z.literal("every-plot-tended") });

export const rule = defineNode("rule", {
  description: "An agreement the garden holds itself to.",
  fields: z.object({ spec: ruleSpec, label: z.string().min(1) }),
  plural: "Rules",
  label: (node) => node.label,
  figure: "rule",
  // The dispatch key: a rule whose spec type has no registered invariant is
  // a rule nobody wrote, and `graview check` says so at build time.
  requiresInvariant: (node) => node.spec.type,
});

export const seedbedSchema = createSchema([gardener, plot, planting, rotation, rule]);
export type SeedbedSchema = typeof seedbedSchema;
