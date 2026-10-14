import * as z from "../schema/zod.js";
import { MissingRecordError } from "../graph/graph.js";
import { edgeId } from "../graph/types.js";
import { labelOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyMutationDefinition } from "./types.js";

/** The name of the act that accepts a provisional link (FR-172). */
export const KEEP_LINK = "keep-link";

/**
 * "KEEP THIS LINK" (FR-172): a person accepting a link something less sure
 * made. It takes the link away and puts it back in one op — the graph is as
 * it was — so the log holds a person's op naming it, which is what makes a
 * provisional link ordinary (`linkProvenances`); undone, the link is
 * provisional again. Its arguments are the link: `{ kind, from, to }`.
 *
 * Every store answers to it and no list offers it: it is not one of the
 * app's acts, and a face offers it beside the link it would keep (a line's
 * acts, a record page's mark). It goes over the wire like any call, and is
 * permitted to whoever may make or break links of its relation
 * (`keepLinkVia`).
 */
export function keepLinkMutation<S extends AnySchema>(schema: S): AnyMutationDefinition<S> {
  const name = (graph: { getNode(id: string): unknown }, id: string) => {
    const node = graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
    return node ? labelOf(schema.tryDefinition(node.kind), node) : id;
  };
  return {
    name: KEEP_LINK,
    title: "Keep this link",
    input: z.object({ kind: z.string(), from: z.string(), to: z.string() }) as never,
    describe: (args, graph) => `Keep the link from ${name(graph, (args as { from: string }).from)} to ${name(graph, (args as { to: string }).to)}`,
    // A link that is not there is refused by the graph itself, as missing.
    apply(ctx, args) {
      const { kind, from, to } = args as { kind: string; from: string; to: string };
      /*
       * AND ONE TO A RECORD THE SEAT MAY NOT SEE IS NOT THERE FOR IT (FR-55):
       * its ends are plain ids, which a seat can guess, so it is refused in
       * the graph's own words, alike whether the hidden record holds the
       * link or nothing does. `ctx.graph` is what the seat is served.
       */
      if (!ctx.graph.getNode(from) || !ctx.graph.getNode(to)) {
        const id = edgeId({ kind, from, to });
        throw new MissingRecordError(id, `Cannot remove missing edge ${id}`);
      }
      ctx.removeEdge({ kind, from, to });
      ctx.addEdge({ kind, from, to });
    },
  } as AnyMutationDefinition<S>;
}

/**
 * Who may keep a link of a relation: whoever may run a declared act that
 * makes or breaks links of THAT relation — the policy's own grants, read
 * again. A seat that may link a lease to its property may keep such a link,
 * and is not thereby the judge of a link between two people; a link of a
 * relation no act makes or breaks is kept by nobody a policy names.
 */
export const keepLinkVia = <S extends AnySchema>(mutations: Iterable<AnyMutationDefinition<S>>, relation: unknown): readonly string[] =>
  [...mutations].filter((one) => !one.derived && one.name !== KEEP_LINK && typeof relation === "string" && (one.connects?.includes(relation) || one.severs?.includes(relation))).map((one) => one.name);
