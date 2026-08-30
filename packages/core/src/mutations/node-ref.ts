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

/**
 * What sort of answer an argument wants, read off its own declaration.
 *
 * The affordance layer could already say "this needs a `label`" and offer
 * candidate ids for a node reference — but for a plain string or a date it
 * offered a list of nothing, so half the actions in an interface were dead
 * ends that looked live. The mutation's schema knows perfectly well that
 * `label` is a non-empty string and `date` is `YYYY-MM-DD`; nothing had
 * asked it.
 */
export type ArgShape =
  | { readonly type: "text" }
  | { readonly type: "date" }
  | { readonly type: "number"; readonly min?: number; readonly max?: number }
  | { readonly type: "choice"; readonly options: readonly string[] }
  | { readonly type: "unknown" };

/** Unwraps optional/default/nullable so a wrapped field still describes itself. */
function unwrap(schema: unknown): unknown {
  const inner = (schema as { _def?: { innerType?: unknown } })._def?.innerType;
  return inner === undefined ? schema : unwrap(inner);
}

/**
 * Zod 4 keeps the primitive type on `_def.type` and the refinements a UI
 * actually needs — bounds, patterns — in `_zod.bag`. Reading them here, in
 * one place, keeps every other layer free of zod internals.
 */
export function describeArg(schema: unknown): ArgShape {
  const field = unwrap(schema) as
    | { _def?: { type?: string; entries?: Record<string, string> }; _zod?: { bag?: Record<string, unknown> } }
    | undefined;
  const type = field?._def?.type;
  const bag = field?._zod?.bag ?? {};

  if (type === "enum") return { type: "choice", options: Object.keys(field?._def?.entries ?? {}) };

  if (type === "number") {
    const min = typeof bag["minimum"] === "number" ? (bag["minimum"] as number) : undefined;
    const max = typeof bag["maximum"] === "number" ? (bag["maximum"] as number) : undefined;
    return {
      type: "number",
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    };
  }

  if (type === "string") {
    // A date is a string with a date-shaped pattern. Recognising it means
    // the interface offers a date picker instead of a free text box, which
    // is the difference between an action anyone can run and one only its
    // author knows the format for.
    const patterns = bag["patterns"];
    const sources =
      patterns instanceof Set ? [...patterns].map((pattern) => String((pattern as RegExp).source)) : [];
    if (sources.some((source) => source.includes("\\d{4}"))) return { type: "date" };
    return { type: "text" };
  }

  return { type: "unknown" };
}

/** The declared shape of one named argument of a mutation input object. */
export function argShape(input: unknown, name: string): ArgShape {
  const shape = (input as { shape?: Record<string, unknown> })?.shape;
  if (!shape || !(name in shape)) return { type: "unknown" };
  return describeArg(shape[name]);
}
