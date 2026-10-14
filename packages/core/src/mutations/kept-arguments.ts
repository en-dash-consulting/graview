import type { Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { FIELD_SIGHT } from "../permissions/sight.js";
import type { Judged } from "../seen.js";
import { fieldsWrittenBy } from "./derive-edits.js";
import type { AnyMutationDefinition } from "./types.js";

/**
 * THE ARGUMENTS OF AN ACT A SEAT IS NOT ASKED FOR (Roadmap f-field-sight):
 * the ones that write a field its sight keeps from it — on the record it
 * acts on, or on one it makes (judged as its own, as the store judges it).
 * The store refuses such a write as an argument the act does not take, so
 * a form that offered it would offer a refusal.
 */
export function keptArguments<S extends AnySchema>(
  store: Judged & { readonly schema: S },
  principal: Principal,
  mutation: AnyMutationDefinition<S>,
  subject?: string,
): ReadonlySet<string> {
  const kept = FIELD_SIGHT.keptFrom?.(store, principal);
  const out = new Set<string>();
  if (!kept) return out;
  const shape = Object.keys((mutation.input as { shape?: Record<string, unknown> }).shape ?? {});
  for (const kind of mutation.creates ?? []) {
    const fields = kept({ id: "\u0000new", kind });
    for (const name of shape) if (fields?.(name)) out.add(name);
  }
  const node = subject === undefined ? undefined : store.graph.getNode(subject);
  const definition = node && (store.schema.tryDefinition(node.kind) as AnyNodeDefinition | undefined);
  const fields = node && kept(node);
  if (definition && fields) for (const name of fieldsWrittenBy(mutation, definition)) if (fields(name) && shape.includes(name)) out.add(name);
  return out;
}
