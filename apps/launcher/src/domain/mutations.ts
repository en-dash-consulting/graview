import { bindSchema, nodeRef, type AnyMutationDefinition, type GraphReader } from "@graview/core";
import { z } from "zod";
import { launcherSchema, type LauncherSchema } from "./schema.js";

const { defineMutation } = bindSchema(launcherSchema);

type M = AnyMutationDefinition<LauncherSchema>;
type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;

const labelOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return node && "label" in node ? String(node["label"]) : id;
};

/**
 * The desk's writes.
 *
 * `show-app` is the one worth arguing about. Putting an app in front of you
 * is state, and it used to be React state plus a query string — which meant
 * the single most interesting thing this surface does was invisible to the op
 * log, could not be undone, and sat outside the model the whole framework is
 * about. It is an edge now, so opening an app appears in the activity rail,
 * undo closes it, and the agent seat can do it. That is either pedantic or
 * exactly the point, and it is the same argument Graview makes about
 * everyone else's software.
 */

export const showApp = defineMutation(
  "show-app",
  {
    title: "Open it",
    description: "Put an app in front of you.",
    subject: { kinds: ["app"], arg: "appId" },
    connects: ["showing"],
    severs: ["showing"],
    input: z.object({ appId: nodeRef(["app"]) }),
    describe: (args, graph) => `Open ${labelOf(graph as Reader, args.appId)}`,
    apply(ctx, args) {
      const desk = ctx.graph.allNodes().find((node) => node.kind === "desk");
      if (!desk) throw new Error("No desk to show it on.");
      // One at a time: showing a second app puts the first away, and the log
      // records one gesture rather than a mysterious pair.
      for (const current of ctx.graph.out(desk.id, "showing")) {
        ctx.removeEdge({ kind: "showing", from: desk.id, to: current.id });
      }
      ctx.addEdge({ kind: "showing", from: desk.id, to: args.appId });
    },
  },
) as M;

export const closeApp = defineMutation(
  "close-app",
  {
    title: "Back to the desk",
    description: "Put away whatever is in front of you.",
    subject: { kinds: ["desk"], arg: "deskId" },
    severs: ["showing"],
    input: z.object({ deskId: nodeRef(["desk"]) }),
    describe: () => "Back to the desk",
    apply(ctx, args) {
      for (const current of ctx.graph.out(args.deskId, "showing")) {
        ctx.removeEdge({ kind: "showing", from: args.deskId, to: current.id });
      }
    },
  },
) as M;

export const retireCapability = defineMutation(
  "retire-capability",
  {
    title: "Stop tracking it",
    description: "Remove a capability from the things the desk watches.",
    destructive: true,
    subject: { kinds: ["capability"], arg: "id" },
    input: z.object({ id: nodeRef(["capability"]) }),
    describe: (args, graph) => `Stop tracking ${labelOf(graph as Reader, args.id)}`,
    apply(ctx, args) {
      ctx.removeNode(args.id);
    },
  },
) as M;

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const justify = defineMutation(
  "justify",
  {
    title: "Note why this is here",
    description: "Attach a reason to this, so the argument for keeping it outlives whoever made it.",
    subject: { kinds: "*", arg: "id" },
    connects: ["justifies"],
    input: z.object({ id: nodeRef("*"), text: z.string().min(1) }),
    describe: (args, graph) => `Explain ${labelOf(graph as Reader, args.id)}`,
    apply(ctx, args) {
      const id = `why-${slug(args.text)}`;
      if (!ctx.graph.getNode(id)) {
        ctx.addNode({ id, kind: "rationale", text: args.text } as never);
      }
      ctx.addEdge({ kind: "justifies", from: id, to: args.id });
    },
  },
) as M;

export const noteCapability = defineMutation(
  "note-capability",
  {
    title: "Leave a note on it",
    description:
      "Attach a short working note to a capability — what you tried, what is odd about it, what to check next.",
    subject: { kinds: ["capability"], arg: "id" },
    input: z.object({ id: nodeRef(["capability"]), note: z.string().min(1) }),
    describe: (args, graph) => `Note on ${labelOf(graph as Reader, args.id)}`,
    apply(ctx, args) {
      ctx.patchNode(args.id, { note: args.note });
    },
  },
) as M;

export const launcherMutations: M[] = [
  showApp,
  closeApp,
  retireCapability,
  justify,
  noteCapability,
];
