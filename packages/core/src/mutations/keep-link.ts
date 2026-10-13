import * as z from "../schema/zod.js";
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
 * permitted to whoever may make or break links or make records
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
      ctx.removeEdge({ kind, from, to });
      ctx.addEdge({ kind, from, to });
    },
  } as AnyMutationDefinition<S>;
}

/**
 * Who may keep a link: whoever may run a declared act that makes or breaks
 * links, or makes records — the policy's own grants, read again.
 */
export const keepLinkVia = <S extends AnySchema>(mutations: Iterable<AnyMutationDefinition<S>>): readonly string[] =>
  [...mutations].filter((one) => !one.derived && one.name !== KEEP_LINK && (one.connects?.length || one.severs?.length || one.creates?.length)).map((one) => one.name);
