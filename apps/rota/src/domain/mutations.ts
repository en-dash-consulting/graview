import { bindSchema, isoDate, nodeRef, type AnyMutationDefinition, type GraphReader } from "@graview/core";
import { z } from "zod";
import { rotaSchema, type RotaSchema } from "./schema.js";

const { defineMutation } = bindSchema(rotaSchema);
type M = AnyMutationDefinition<RotaSchema>;
type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;

/** A node's name for the history: an id in the interface is a bug you shipped. */
const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};

/**
 * The acts, and only the acts.
 *
 * Every one says what it writes, creates, connects or severs — not as
 * ceremony but because that is what the interface derives from: the actions
 * strip, the pointer menu, a rule's repairs, the calendar's drag, an
 * agent's tool list and the routed face's forms all read these declarations
 * and nothing else.
 */

export const addShift = defineMutation("add-shift", {
  title: "Add a shift",
  description: "Put a stretch of time on the roster that somebody has to be there for.",
  creates: ["shift"],
  connects: ["held-at"],
  input: z.object({
    label: z.string().min(1),
    on: isoDate,
    locationId: nodeRef(["location"]),
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    from: z.number().int().min(0).max(1439),
    until: z.number().int().min(0).max(1440),
  }),
  describe: (args, graph) => `Add "${args.label}" on ${args.on} at ${nameOf(graph as Reader, args.locationId)}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "shift");
    ctx.addNode({
      id,
      kind: "shift",
      label: args.label,
      on: args.on,
      day: args.day,
      from: args.from,
      until: args.until,
    });
    ctx.addEdge({ kind: "held-at", from: id, to: args.locationId });
  },
}) as M;

export const addLocation = defineMutation("add-location", {
  title: "Add a location",
  description: "Somewhere new that shifts can happen.",
  creates: ["location"],
  input: z.object({ label: z.string().min(1), directions: z.string().optional() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "location"),
      kind: "location",
      label: args.label,
      ...(args.directions ? { directions: args.directions } : {}),
    });
  },
}) as M;

export const holdAt = defineMutation("hold-at", {
  title: "Hold it somewhere else",
  description: "The same shift, in another location.",
  subject: { kinds: ["shift"], arg: "shiftId" },
  connects: ["held-at"],
  severs: ["held-at"],
  fromTheOtherEnd: "Hold a shift here",
  input: z.object({ shiftId: nodeRef(["shift"]), locationId: nodeRef(["location"]) }),
  describe: (args, graph) =>
    `Hold "${nameOf(graph as Reader, args.shiftId)}" at ${nameOf(graph as Reader, args.locationId)}`,
  apply(ctx, args) {
    // One place per shift: moving it is leaving the old one.
    for (const current of ctx.graph.out(args.shiftId, "held-at")) {
      if (current.id === args.locationId) return;
      ctx.removeEdge({ kind: "held-at", from: args.shiftId, to: current.id });
    }
    ctx.addEdge({ kind: "held-at", from: args.shiftId, to: args.locationId });
  },
}) as M;

export const cover = defineMutation("cover", {
  title: "Cover it",
  description: "Somebody takes the shift on.",
  subject: { kinds: ["shift"], arg: "shiftId" },
  connects: ["covered-by"],
  // How it reads standing on the VOLUNTEER: the same act, the other way up.
  fromTheOtherEnd: "Take on a shift",
  input: z.object({ shiftId: nodeRef(["shift"]), volunteerId: nodeRef(["volunteer"]) }),
  describe: (args, graph) =>
    `${nameOf(graph as Reader, args.volunteerId)} covers "${nameOf(graph as Reader, args.shiftId)}"`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "covered-by", from: args.shiftId, to: args.volunteerId });
  },
}) as M;

export const uncover = defineMutation("uncover", {
  title: "Take them off it",
  description: "Somebody can no longer make the shift they took on.",
  subject: { kinds: ["shift"], arg: "shiftId" },
  severs: ["covered-by"],
  fromTheOtherEnd: "Hand a shift back",
  input: z.object({ shiftId: nodeRef(["shift"]), volunteerId: nodeRef(["volunteer"]) }),
  describe: (args, graph) =>
    `${nameOf(graph as Reader, args.volunteerId)} hands back "${nameOf(graph as Reader, args.shiftId)}"`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "covered-by", from: args.shiftId, to: args.volunteerId });
  },
}) as M;

export const moveShift = defineMutation("move-shift", {
  title: "Move it",
  description: "The same shift, on another day.",
  subject: { kinds: ["shift"], arg: "shiftId" },
  // Said, so the calendar's drag finds this act rather than the derived edit.
  writes: ["on", "day"],
  input: z.object({ shiftId: nodeRef(["shift"]), on: isoDate }),
  describe: (args, graph) => `Move "${nameOf(graph as Reader, args.shiftId)}" to ${args.on}`,
  apply(ctx, args) {
    ctx.patchNode(args.shiftId, { on: args.on, day: weekdayOf(args.on) });
  },
}) as M;

export const addVolunteer = defineMutation("add-volunteer", {
  title: "Add a volunteer",
  description: "Somebody new who has said they will turn up.",
  creates: ["volunteer"],
  input: z.object({
    label: z.string().min(1),
    phone: z.string().min(3),
    limit: z.number().int().min(1).max(14),
  }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "volunteer"),
      kind: "volunteer",
      label: args.label,
      phone: args.phone,
      limit: args.limit,
      status: "available",
    });
  },
}) as M;

export const stepBack = defineMutation("step-back", {
  title: "They have stepped back",
  description: "Somebody is away for a while. They keep everything they did.",
  subject: { kinds: ["volunteer"], arg: "volunteerId" },
  writes: ["status"],
  input: z.object({ volunteerId: nodeRef(["volunteer"]) }),
  describe: (args, graph) => `${nameOf(graph as Reader, args.volunteerId)} steps back`,
  apply(ctx, args) {
    ctx.patchNode(args.volunteerId, { status: "away" });
  },
}) as M;

export const stepUp = defineMutation("step-up", {
  title: "They are back",
  description: "Somebody who stepped back is available again.",
  subject: { kinds: ["volunteer"], arg: "volunteerId" },
  writes: ["status"],
  input: z.object({ volunteerId: nodeRef(["volunteer"]) }),
  describe: (args, graph) => `${nameOf(graph as Reader, args.volunteerId)} is back`,
  apply(ctx, args) {
    ctx.patchNode(args.volunteerId, { status: "available" });
  },
}) as M;

export const setLimit = defineMutation("set-limit", {
  title: "Change what they can take",
  description: "The most somebody is willing to do in a week.",
  subject: { kinds: ["volunteer"], arg: "volunteerId" },
  writes: ["limit"],
  input: z.object({ volunteerId: nodeRef(["volunteer"]), limit: z.number().int().min(1).max(14) }),
  describe: (args, graph) => `${nameOf(graph as Reader, args.volunteerId)} can take ${args.limit} a week`,
  apply(ctx, args) {
    ctx.patchNode(args.volunteerId, { limit: args.limit });
  },
}) as M;

export const rename = defineMutation("rename", {
  title: "Rename it",
  description: "Give a shift, a location, a volunteer or a rule another name.",
  subject: { kinds: "*", arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["*"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
}) as M;

export const dropShift = defineMutation("drop-shift", {
  title: "Drop the shift",
  description: "It is not happening. Whoever was covering it is freed.",
  destructive: true,
  subject: { kinds: ["shift"], arg: "shiftId" },
  input: z.object({ shiftId: nodeRef(["shift"]) }),
  describe: (args, graph) => `Drop "${nameOf(graph as Reader, args.shiftId)}"`,
  apply(ctx, args) {
    if (!ctx.graph.getNode(args.shiftId)) throw new Error(`No shift "${args.shiftId}"`);
    ctx.removeNode(args.shiftId);
  },
}) as M;

/** 0 = Sunday, the way `getUTCDay` counts — and never a local `Date`. */
function weekdayOf(day: string): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const at = new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))),
  ).getUTCDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[at]!;
}

export const rotaMutations: M[] = [
  addShift,
  addLocation,
  holdAt,
  cover,
  uncover,
  moveShift,
  addVolunteer,
  stepBack,
  stepUp,
  setLimit,
  rename,
  dropShift,
];
