import { MARKS } from "../graph/archived.js";
import { actingAs, grantsTo, isSystem } from "../permissions/policy.js";
import type { Policy, Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { FIELD_SIGHT, partialSight } from "../permissions/sight.js";
import type { Judged } from "../seen.js";
import { fieldsWrittenBy, subjectKindsOf } from "./derive-edits.js";
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

/**
 * THE ARGUMENTS OF AN ACT NO RECORD WOULD LET A SEAT WRITE, read off the
 * declaration alone (Roadmap f-field-sight): each writes a field that no
 * sight granting the seat that kind shows — on the kind the act makes, or
 * every kind its subject takes. An agent's tool for the act lists none of
 * them, so its schema never names a field the seat may not see; a field
 * the seat sees on some records (its own child's phone) stays, and the
 * store refuses the write on the rest, as `keptArguments` says per record.
 * Judged as the policy says it whether or not field sight is loaded.
 */
export function argumentsNeverShown<S extends AnySchema>(
  schema: S,
  policy: Policy | undefined,
  principal: Principal,
  mutation: AnyMutationDefinition<S>,
): ReadonlySet<string> {
  const out = new Set<string>();
  const sights = policy?.sees ?? [];
  if (isSystem(principal) || !sights.some(partialSight)) return out;
  const acting = actingAs(principal);
  /** Whether a seat is shown a kind's field on some record: a sight granting it the kind shows it. */
  const shown = (kind: string, field: string): boolean => {
    const granted = sights.filter((sight) => sight.kinds.includes(kind) && grantsTo(sight, acting));
    if (!granted.some(partialSight)) return true;
    return MARKS.has(field) || granted.some((sight) => !partialSight(sight) || ((sight.fields === undefined || sight.fields.includes(field)) && !sight.hide?.includes(field)));
  };
  const shape = Object.keys((mutation.input as { shape?: Record<string, unknown> }).shape ?? {});
  const written = new Map<string, boolean>();
  const write = (field: string, seen: boolean) => written.set(field, written.get(field) === true || seen);
  for (const kind of mutation.creates ?? []) {
    const declared = Object.keys(((schema.tryDefinition(kind) as AnyNodeDefinition | undefined)?.fields.shape ?? {}) as Record<string, unknown>);
    for (const name of shape) if (declared.includes(name)) write(name, shown(kind, name));
  }
  for (const kind of subjectKindsOf(schema, mutation)) {
    const definition = schema.tryDefinition(kind) as AnyNodeDefinition | undefined;
    if (definition) for (const name of fieldsWrittenBy(mutation, definition)) if (shape.includes(name)) write(name, shown(kind, name));
  }
  for (const [name, seen] of written) if (!seen) out.add(name);
  return out;
}
