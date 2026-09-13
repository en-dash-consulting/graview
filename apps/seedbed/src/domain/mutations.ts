import {
  bindSchema,
  isoDate,
  nodeRef,
  type AnyMutationDefinition,
  type GraphReader,
} from "@graview/core";
import { z } from "zod";
import { seedbedSchema, type SeedbedSchema } from "./schema.js";

const { defineMutation } = bindSchema(seedbedSchema);
type M = AnyMutationDefinition<SeedbedSchema>;
type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;

const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};

/**
 * Every mutation that brings a kind into existence SAYS SO with `creates`.
 *
 * In a full app that is documentation; in an empty one it is the whole
 * interface. A blank kind card has nothing to select and nothing to act on —
 * the only honest thing it can offer is its own beginnings, and `creates` is
 * how the framework derives that offer instead of this app wiring a menu.
 */

export const addGardener = defineMutation("add-gardener", {
  title: "Welcome a gardener",
  description: "Add someone to the garden's roster.",
  creates: ["gardener"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Welcome ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "gardener"), kind: "gardener", label: args.label } as never);
  },
}) as M;

export const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add a patch of ground, with how many beds it holds.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), beds: z.number().int().min(1) }),
  describe: (args) => `Stake out ${args.label} (${args.beds} beds)`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "plot"),
      kind: "plot",
      label: args.label,
      beds: args.beds,
    } as never);
  },
}) as M;

export const sow = defineMutation("sow", {
  title: "Sow something",
  description: "Put a planting in the ground, in a plot.",
  creates: ["planting"],
  input: z.object({
    label: z.string().min(1),
    plotId: nodeRef(["plot"]),
    sown: isoDate,
  }),
  connects: ["grows-in"],
  describe: (args, graph) => `Sow ${args.label} in ${nameOf(graph as Reader, args.plotId)}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "planting");
    ctx.addNode({
      id,
      kind: "planting",
      label: args.label,
      sown: args.sown,
      status: "growing",
    } as never);
    ctx.addEdge({ kind: "grows-in", from: id, to: args.plotId });
  },
}) as M;

export const tend = defineMutation("tend", {
  title: "Name a caretaker",
  // Standing on the gardener, naming her the caretaker of a plot is her
  // taking one on — "Name a caretaker" there reads as naming HERS.
  fromTheOtherEnd: "Take on a plot",
  description: "Say who looks after a plot.",
  subject: { kinds: ["plot"], arg: "plotId" },
  connects: ["tended-by"],
  severs: ["tended-by"],
  input: z.object({ plotId: nodeRef(["plot"]), gardenerId: nodeRef(["gardener"]) }),
  describe: (args, graph) =>
    `${nameOf(graph as Reader, args.gardenerId)} takes on ${nameOf(graph as Reader, args.plotId)}`,
  apply(ctx, args) {
    // One caretaker per plot: naming a new one is a handover, not a committee.
    for (const current of ctx.graph.out(args.plotId, "tended-by")) {
      if (current.id === args.gardenerId) return;
      ctx.removeEdge({ kind: "tended-by", from: args.plotId, to: current.id });
    }
    ctx.addEdge({ kind: "tended-by", from: args.plotId, to: args.gardenerId });
  },
}) as M;

export const harvest = defineMutation("harvest", {
  title: "Harvest it",
  description: "Bring a planting in. It leaves the picture, never the record.",
  subject: { kinds: ["planting"], arg: "plantingId" },
  // Harvesting writes the status without asking for it; said, so the
  // status is offered as this act where it is shown.
  writes: ["status", "harvested"],
  input: z.object({ plantingId: nodeRef(["planting"]), on: isoDate }),
  describe: (args, graph) => `Harvest ${nameOf(graph as Reader, args.plantingId)}`,
  apply(ctx, args) {
    // The horizon at work: an ordinary field write is the whole archive —
    // and the DAY it happened, so the season calendar can draw the span
    // from sowing to harvest rather than a dot on the day it went in.
    ctx.patchNode(args.plantingId, { status: "harvested", harvested: args.on });
  },
}) as M;

export const adoptRule = defineMutation("adopt-rule", {
  title: "Agree every plot has a caretaker",
  description: "Adopt the garden's first rule, as a thing on the map.",
  creates: ["rule"],
  input: z.object({}),
  describe: () => "Adopt: every plot has a caretaker",
  apply(ctx) {
    ctx.addNode({
      id: ctx.freshId("every plot tended", "rule"),
      kind: "rule",
      label: "Every plot has a caretaker",
      spec: { type: "every-plot-tended" },
    } as never);
  },
}) as M;

export const seedbedMutations = [addGardener, addPlot, sow, tend, harvest, adoptRule];
