import { z } from "zod";
import { labelOf } from "../schema/define-node.js";
import { humaniseField } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { nodeRef, nodeRefArgs } from "./node-ref.js";
import type { AnyMutationDefinition } from "./types.js";

/**
 * A FIELD YOU COULD SET AT CREATION, YOU CAN CHANGE.
 *
 * Every app here had the same hole: a drill's minimum players asked for
 * when the drill was made, shown on its card, and then frozen — no
 * mutation took it, so the in-place edit honestly said "read-only" and
 * there was nothing to reach for. The culture is right that every change
 * is a named act, so the fix is not an anonymous `update`: it is a DERIVED,
 * titled edit act per kind, covering exactly the settable fields nothing
 * else writes, flowing through the policy like any named mutation. Opting
 * out is a declaration (`fixed`, with the reason); and the checker warns
 * when a field is still out of everyone's reach.
 */

/** The fields of a kind a person could change: declared, and not fixed. */
export function settableFields(definition: AnyNodeDefinition): readonly string[] {
  const shape = definition.fields.shape as Record<string, unknown>;
  return Object.keys(shape).filter((field) => !(field in (definition.fixed ?? {})));
}

/** The kinds a mutation's subject accepts, resolved against the schema. */
export function subjectKindsOf<S extends AnySchema>(
  schema: S,
  mutation: AnyMutationDefinition<S>,
): readonly string[] {
  const subject = mutation.subject;
  if (!subject) return [];
  return subject.kinds === "*"
    ? (schema.kinds as readonly string[])
    : (subject.kinds as readonly string[]);
}

/**
 * Which fields a mutation writes on a given subject kind: its declaration
 * when it has one, the name-match guess when it does not.
 */
export function fieldsWrittenBy<S extends AnySchema>(
  mutation: AnyMutationDefinition<S>,
  definition: AnyNodeDefinition,
): readonly string[] {
  const subject = mutation.subject;
  if (!subject) return [];
  const declared = new Set(Object.keys(definition.fields.shape as Record<string, unknown>));
  if (mutation.writes) return mutation.writes.filter((field) => declared.has(field));
  const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
  const refs = new Set(nodeRefArgs(mutation.input).map((ref) => ref.name));
  return Object.keys(shape).filter(
    (name) => name !== subject.arg && declared.has(name) && !refs.has(name),
  );
}

/** kind → field → the declared mutations that write it. */
export function fieldWriters<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
): ReadonlyMap<string, ReadonlyMap<string, readonly string[]>> {
  const writers = new Map<string, Map<string, string[]>>();
  for (const mutation of mutations) {
    for (const kind of subjectKindsOf(schema, mutation)) {
      const definition = schema.tryDefinition(kind);
      if (!definition) continue;
      for (const field of fieldsWrittenBy(mutation, definition)) {
        const byField = writers.get(kind) ?? new Map<string, string[]>();
        byField.set(field, [...(byField.get(field) ?? []), mutation.name]);
        writers.set(kind, byField);
      }
    }
  }
  return writers;
}

/** The settable fields of a kind that no declared mutation writes. */
export function unwrittenFields<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
  kind: string,
): readonly string[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) return [];
  const written = fieldWriters(schema, mutations).get(kind);
  return settableFields(definition).filter((field) => !written?.has(field));
}

/** The name the derived edit act for a kind carries. */
export const editMutationName = (kind: string): string => `edit-${kind}`;

/**
 * The declared acts a derived edit resolves its PERMISSION through: those
 * that already write a field of the kind, and those that create it. Who may
 * edit a drill is whoever the policy already lets change or make a drill —
 * there is no second list.
 */
export function editVia<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
  kind: string,
): readonly string[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) return [];
  const via = new Set<string>();
  for (const mutation of mutations) {
    if (mutation.derived) continue;
    if ((mutation.creates ?? []).includes(kind as never)) via.add(mutation.name);
    if (
      subjectKindsOf(schema, mutation).includes(kind) &&
      fieldsWrittenBy(mutation, definition).length > 0
    ) {
      via.add(mutation.name);
    }
  }
  return [...via];
}

/**
 * One edit act per kind that has something nobody else writes.
 *
 * Its input is the subject plus each uncovered field as an optional
 * argument carrying the kind's OWN field schema, so validation is the
 * declaration's; `writes` names those fields, so `editableFields` needs no
 * guess. A kind whose every settable field is already written derives
 * nothing, and an app that declares its own `edit-<kind>` keeps it.
 */
export function deriveEditMutations<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
): AnyMutationDefinition<S>[] {
  const taken = new Set(mutations.map((mutation) => mutation.name));
  const derived: AnyMutationDefinition<S>[] = [];
  for (const definition of schema.definitions) {
    const kind = definition.kind;
    const name = editMutationName(kind);
    if (taken.has(name)) continue;
    const fields = unwrittenFields(schema, mutations, kind);
    if (fields.length === 0) continue;
    const shape = definition.fields.shape as Record<string, z.ZodType>;
    const noun = humaniseField(kind).toLowerCase();
    const said = fields.map((field) => humaniseField(field).toLowerCase());
    derived.push({
      name,
      derived: { edit: kind },
      title: `Change the ${noun}`,
      description: `Change what was set when this ${noun} was made: ${said.join(", ")}.`,
      subject: { kinds: [kind] as never, arg: "id" },
      writes: fields,
      input: z.object({
        id: nodeRef([kind]),
        ...Object.fromEntries(fields.map((field) => [field, shape[field]!.optional()])),
      }),
      describe: (args, graph) => {
        const node = graph.getNode((args as { id: string }).id);
        const label = node ? labelOf(definition, node as never) : (args as { id: string }).id;
        const changes = fields
          .filter((field) => (args as Record<string, unknown>)[field] !== undefined)
          .map(
            (field) =>
              `${humaniseField(field).toLowerCase()} → ${JSON.stringify(
                (args as Record<string, unknown>)[field],
              )}`,
          );
        return `Change ${label}: ${changes.join(", ") || "nothing"}`;
      },
      apply(ctx, args) {
        const patch: Record<string, unknown> = {};
        for (const field of fields) {
          const value = (args as Record<string, unknown>)[field];
          if (value !== undefined) patch[field] = value;
        }
        if (Object.keys(patch).length === 0) {
          throw new Error(`Nothing to change — give at least one of ${said.join(", ")} a value.`);
        }
        ctx.patchNode((args as { id: string }).id, patch);
      },
    } as AnyMutationDefinition<S>);
  }
  return derived;
}
