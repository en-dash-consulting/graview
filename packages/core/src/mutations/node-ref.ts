import { z } from "zod";

const NODE_REFS = new WeakMap<object, readonly string[]>();

/**
 * A mutation argument that names a node. Declaring the acceptable kinds is
 * what lets the affordance layer bind a selection to an argument without
 * anyone writing per-selection code, and lets an agent tool schema say
 * which ids are legal.
 */
export function nodeRef<const K extends string>(
  kinds: readonly K[] | "*" = "*",
): z.ZodString {
  const schema = z.string().min(1);
  NODE_REFS.set(schema, kinds === "*" ? ["*"] : kinds);
  return schema;
}

/** The node kinds an argument accepts, or undefined if it is not a node ref. */
export function nodeRefKinds(schema: unknown): readonly string[] | undefined {
  if (typeof schema !== "object" || schema === null) return undefined;
  const direct = NODE_REFS.get(schema);
  if (direct) return direct;
  // Unwrap optional/default/nullable wrappers so `nodeRef([...]).optional()`
  // keeps its meaning.
  const inner = (schema as { _def?: { innerType?: unknown } })._def?.innerType;
  return inner ? nodeRefKinds(inner) : undefined;
}

/** Reads the node-ref arguments off a mutation input object schema. */
export function nodeRefArgs(
  input: z.ZodType,
): { name: string; kinds: readonly string[]; optional: boolean }[] {
  const shape = (input as { shape?: Record<string, z.ZodType> }).shape;
  if (!shape) return [];
  const args: { name: string; kinds: readonly string[]; optional: boolean }[] = [];
  for (const [name, field] of Object.entries(shape)) {
    const kinds = nodeRefKinds(field);
    if (!kinds) continue;
    args.push({ name, kinds, optional: field.safeParse(undefined).success });
  }
  return args;
}
