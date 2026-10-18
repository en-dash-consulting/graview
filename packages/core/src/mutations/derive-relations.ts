import * as z from "../schema/zod.js";
import { labelOf, nounOf } from "../schema/define-node.js";
import { humanizeField } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { EdgeDeclaration } from "../schema/types.js";
import { ActRefusal } from "../refused.js";
import { refTo } from "./node-ref.js";
import { RELATION_ACTS, relationActName, relationActTitles } from "./derived-names.js";
import type { AnyMutationDefinition } from "./types.js";

/**
 * EVERY RELATION COMES WITH ITS CONNECT AND DISCONNECT (Roadmap
 * f-relation-acts-derived).
 *
 * After an `add-relation` — a moment taken on a day, a moment that features
 * a traveler — nothing could link two records until somebody also wrote an
 * act that `connects`. A kind is given its edit, remove and archive; a
 * relation is now given its pair the same way, per kind that declares it:
 * `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, on the
 * record it leaves as `id` and the record it reaches as `to`.
 *
 * - Titled from the relation: a cardinality-one relation is set and
 *   cleared ("Set the day"), and connecting another replaces the link it
 *   had; a many one linked and unlinked ("Link a traveler"). Each reads
 *   from the other end too ("Link a moment"), so a line or the far
 *   record's page offers it in its own words.
 * - Replaced by what the app declares: any act that `connects` the
 *   relation replaces the derived connect, any that `severs` it the
 *   derived disconnect, and an act of the same name keeps its name.
 * - A relation declared `acts: "none"` is read from what was declared, and
 *   given neither.
 * - An `appendOnly` relation is never unmade, so it is given no
 *   disconnect.
 * - A relation to another app's kind (FR-171) is a field, which the
 *   derived edit already sets; it is given neither.
 * - Permitted through the acts that make or change the kind it leaves, as
 *   a derived edit is (`derivedVia`), or a grant naming it.
 *
 * Because each declares what it `connects` or `severs`, every face that
 * offers a tie — a line's acts, the far end's page, an agent's tools —
 * offers these with no second path.
 */
export function deriveRelationMutations<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
): AnyMutationDefinition<S>[] {
  const taken = new Set(mutations.map((mutation) => mutation.name));
  const declared = mutations.filter((mutation) => !mutation.derived);
  const connected = new Set(declared.flatMap((mutation) => mutation.connects ?? []));
  const severed = new Set(declared.flatMap((mutation) => mutation.severs ?? []));
  const derived: AnyMutationDefinition<S>[] = [];
  const named = (graph: { getNode(id: string): unknown }, id: unknown): string => {
    const node = graph.getNode(String(id)) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
    return node ? labelOf(schema.tryDefinition(node.kind), node) : String(id);
  };
  for (const definition of schema.definitions) {
    const kind = definition.kind;
    const edges = Object.entries((definition.edges ?? {}) as Readonly<Record<string, EdgeDeclaration>>);
    const reaches = (edge: EdgeDeclaration): string =>
      edge.to === "*" ? "record" : edge.to.map((target) => nounOf(schema.tryDefinition(target), target)).join(" or ");
    for (const [relation, edge] of edges) {
      const to = reaches(edge);
      const one = edge.cardinality === "one";
      // Another relation of this kind to the same kinds: each is told apart by its own words.
      const shared = edges.some(([other, spec]) => other !== relation && reaches(spec) === to);
      const words = { to, from: nounOf(definition, kind), one, also: shared ? humanizeField(relation).toLowerCase() : undefined };
      const noun = words.from;
      for (const act of RELATION_ACTS) {
        const name = relationActName(act, kind, relation);
        if (taken.has(name) || edge.acts === "none" || (act === "connect" ? connected.has(relation) : severed.has(relation) || edge.appendOnly)) continue;
        const { title, fromTheOtherEnd } = relationActTitles(act, words);
        const reading = edge.description ? `: ${edge.description.replace(/\.$/, "")}` : "";
        derived.push({
          name,
          derived: { kind, act, relation },
          title,
          fromTheOtherEnd,
          description:
            act === "connect"
              ? `Link this ${noun} to ${/^[aeiou]/i.test(to) ? "an" : "a"} ${to}${reading}.${one ? ` It has one, so this replaces the one it has.` : ""}`
              : `Take away the link between this ${noun} and ${/^[aeiou]/i.test(to) ? "an" : "a"} ${to}${reading}. Undo puts it back.`,
          subject: { kinds: [kind], arg: "id" },
          ...(act === "connect" ? { connects: [relation] } : { severs: [relation], destructive: true }),
          idempotent: true,
          // Strict, as every derived act is: an argument it does not take is refused, naming those it does.
          input: z.strictObject({ id: refTo([kind]), to: refTo(edge.to === "*" ? "*" : edge.to) }) as never,
          describe: (args: Record<string, unknown>, graph) =>
            act === "disconnect"
              ? `Unlink ${named(graph, args["id"])} from ${named(graph, args["to"])}`
              : one
                ? `Set the ${to} of ${named(graph, args["id"])} to ${named(graph, args["to"])}`
                : `Link ${named(graph, args["id"])} to ${named(graph, args["to"])}`,
          apply(ctx, args: Record<string, unknown>) {
            const from = String(args["id"]);
            const end = String(args["to"]);
            // `ctx.graph` is what the seat is served (FR-55): a record it may not see is not there for it.
            for (const id of [from, end]) if (!ctx.graph.getNode(id)) throw new ActRefusal(`there is no record "${id}"`, "invalid");
            const linked = ctx.graph.out(from, relation).some((node) => node.id === end);
            if (act === "disconnect") {
              if (!linked) throw new ActRefusal(`${named(ctx.graph, from)} is not linked to ${named(ctx.graph, end)}`, "invalid");
              ctx.removeEdge({ kind: relation, from, to: end });
              return;
            }
            // A cardinality-one relation holds one link: connecting another replaces it.
            if (one) for (const existing of ctx.graph.out(from, relation)) if (existing.id !== end) ctx.removeEdge({ kind: relation, from, to: existing.id });
            if (!linked) ctx.addEdge({ kind: relation, from, to: end });
          },
        } as AnyMutationDefinition<S>);
      }
    }
  }
  return derived;
}
