import { SchemaError, type AnySchema } from "./schema/schema.js";
import { nodeRefArgs } from "./mutations/node-ref.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { InvariantDefinition } from "./invariants/types.js";

/**
 * Carries declarations written against a base schema over to a schema that
 * EXTENDS it.
 *
 * Adding a node kind should not mean rewriting the mutations and invariants
 * that never mentioned it — but a mutation typed for seven kinds is not
 * automatically typed for eight, because the reader it is handed is
 * contravariant in the node union. That is a real typing fact, not a bug, and
 * pretending otherwise with a bare cast would hide the moment it stops being
 * true.
 *
 * So this is a checked crossing rather than an assertion: every kind the
 * declarations name must exist in the wider schema, and anything that does
 * not is reported by name. The cast that follows is then sound, and the
 * reason it is sound has been verified rather than asserted.
 */
export function extendMutations<Wide extends AnySchema>(
  schema: Wide,
  mutations: readonly AnyMutationDefinition<never>[],
): AnyMutationDefinition<Wide>[] {
  const kinds = new Set<string>(schema.kinds as readonly string[]);
  for (const mutation of mutations) {
    const named = new Set<string>();
    const subject = mutation.subject;
    if (subject && subject.kinds !== "*") {
      for (const kind of subject.kinds as readonly string[]) named.add(kind);
    }
    for (const ref of nodeRefArgs(mutation.input)) {
      for (const kind of ref.kinds) {
        if (kind !== "*") named.add(kind);
      }
    }
    const missing = [...named].filter((kind) => !kinds.has(kind));
    if (missing.length > 0) {
      throw new SchemaError(
        `Mutation "${mutation.name}" names node kinds the extended schema does not declare: ${missing.join(", ")}`,
        `Declared kinds: ${[...kinds].join(", ")}`,
      );
    }
  }
  return mutations as unknown as AnyMutationDefinition<Wide>[];
}

/** The same checked crossing, for invariants. */
export function extendInvariants<Wide extends AnySchema>(
  schema: Wide,
  invariants: readonly InvariantDefinition<never>[],
): InvariantDefinition<Wide>[] {
  const kinds = new Set<string>(schema.kinds as readonly string[]);
  for (const invariant of invariants) {
    if (invariant.scope === "graph") continue;
    if (!kinds.has(invariant.scope.kind)) {
      throw new SchemaError(
        `Invariant "${invariant.name}" is scoped to "${invariant.scope.kind}", which the extended schema does not declare`,
        `Declared kinds: ${[...kinds].join(", ")}`,
      );
    }
  }
  return invariants as unknown as InvariantDefinition<Wide>[];
}
