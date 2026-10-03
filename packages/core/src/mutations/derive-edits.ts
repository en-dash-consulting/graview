import { z } from "zod";
import { labelOf } from "../schema/define-node.js";
import { humaniseField, nounOf } from "../schema/define-node.js";
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
    if ((mutation.creates ?? []).includes(kind)) via.add(mutation.name);
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
    const noun = nounOf(definition, kind);
    const said = fields.map((field) => humaniseField(field).toLowerCase());
    derived.push({
      name,
      derived: { kind, act: "edit" },
      idempotent: true,
      title: `Change the ${noun}`,
      description: `Change what was set when this ${noun} was made: ${said.join(", ")}.`,
      subject: { kinds: [kind], arg: "id" },
      writes: fields,
      input: z.object({
        id: nodeRef([kind]),
        ...Object.fromEntries(fields.map((field) => [field, shape[field]!.optional()])),
      }),
      describe: (args, graph) => {
        const node = graph.getNode((args as { id: string }).id);
        const label = node ? labelOf(definition, node) : (args as { id: string }).id;
        /*
         * THE CHANGE AS THE RECORD READS IT. The log said "price → 49900"
         * and "condition → \"cpo\"" beside a card that says "Price $49,900"
         * and "Certified pre-owned": the declaration's own labels and
         * formats are the words, and the raw value only where there is none.
         */
        const display = definition.display;
        const quietly = (label: string) => (label === label.toUpperCase() ? label : label.charAt(0).toLowerCase() + label.slice(1));
        const changes = fields
          .filter((field) => (args as Record<string, unknown>)[field] !== undefined)
          .map((field) => {
            const value = (args as Record<string, unknown>)[field];
            const format = display?.format?.[field];
            let said: string;
            try {
              said = format ? String(format(value)) : JSON.stringify(value);
            } catch {
              said = JSON.stringify(value);
            }
            return `${quietly(display?.labels?.[field] ?? humaniseField(field))} → ${said}`;
          });
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

/** The name the derived remove act for a kind carries. */
export const removeMutationName = (kind: string): string => `remove-${kind}`;

/**
 * The declared acts a derived remove resolves its PERMISSION through: the
 * ones that bring the kind into being. Who may make a plot may take one
 * out — narrower than the edit's reading on purpose, because a role that
 * may re-time a drill has not been trusted with losing it.
 */
export function removeVia<S extends AnySchema>(
  mutations: readonly AnyMutationDefinition<S>[],
  kind: string,
): readonly string[] {
  return mutations
    .filter((mutation) => !mutation.derived && (mutation.creates ?? []).includes(kind))
    .map((mutation) => mutation.name);
}

/** The declared acts a derived act rides, whichever act it is. */
export function derivedVia<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
  mutation: AnyMutationDefinition<S>,
): readonly string[] | undefined {
  if (!mutation.derived) return undefined;
  return mutation.derived.act === "edit"
    ? editVia(schema, mutations, mutation.derived.kind)
    : removeVia(mutations, mutation.derived.kind);
}

/**
 * WHAT WAS MADE CAN BE UNMADE.
 *
 * Every app had a way to add a task and, mostly, no way to lose one — so an
 * agent redesigning a board, or a seed being brought in step with a live
 * store, had nothing to call and rewrote the seed instead. The culture is
 * right that every change is a named act, so the fix is a DERIVED, titled
 * remove act per kind: destructive, so it ranks last and is marked; taking
 * the node's edges with it, as `removeNode` does; logged and undoable like
 * everything else; and permitted through the acts that create the kind.
 * An app that declares its own `remove-<kind>` keeps it.
 */
export function deriveRemoveMutations<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
): AnyMutationDefinition<S>[] {
  const taken = new Set(mutations.map((mutation) => mutation.name));
  const derived: AnyMutationDefinition<S>[] = [];
  for (const definition of schema.definitions) {
    const kind = definition.kind;
    const name = removeMutationName(kind);
    if (taken.has(name)) continue;
    const noun = nounOf(definition, kind);
    derived.push({
      name,
      derived: { kind, act: "remove" },
      title: `Remove the ${noun}`,
      description: `Take this ${noun} out of the graph, with every tie it has. Undo puts it back.`,
      subject: { kinds: [kind], arg: "id" },
      destructive: true,
      idempotent: true,
      input: z.object({ id: nodeRef([kind]) }),
      describe: (args, graph) => {
        const id = (args as { id: string }).id;
        const node = graph.getNode(id);
        return `Remove ${node ? labelOf(definition, node) : id}`;
      },
      apply(ctx, args) {
        ctx.removeNode((args as { id: string }).id);
      },
    } as AnyMutationDefinition<S>);
  }
  return derived;
}

/** Every act the framework derives for a declaration: the edits, then the removes. */
export function deriveMutations<S extends AnySchema>(
  schema: S,
  mutations: readonly AnyMutationDefinition<S>[],
): AnyMutationDefinition<S>[] {
  return [...deriveEditMutations(schema, mutations), ...deriveRemoveMutations(schema, mutations)];
}
