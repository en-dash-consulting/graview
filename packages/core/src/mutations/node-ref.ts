import { z } from "zod";

/**
 * WHERE A NODE REFERENCE KEEPS ITS KINDS: on the schema itself, under a
 * registry symbol.
 *
 * It was a WeakMap in this module, so a reference was only a reference to
 * the copy of the framework that made it — a host that bundled its own copy
 * (Graview Cloud's worker) read every act it compiled as taking plain
 * strings (FR-33). `Symbol.for` is one key across every copy, and zod's
 * clones (`.describe()`, `.meta()`, a refinement) carry it, because they
 * share or spread the def it is written on.
 */
const NODE_REF = Symbol.for("@graview/core:node-ref");

type Marked = { [NODE_REF]?: readonly string[] };

const marked = (value: unknown): readonly string[] | undefined =>
  typeof value === "object" && value !== null ? (value as Marked)[NODE_REF] : undefined;

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
  const accepted: readonly string[] = Object.freeze(kinds === "*" ? ["*"] : [...kinds]);
  const mark = (target: object | undefined) => {
    if (target) Object.defineProperty(target, NODE_REF, { value: accepted, enumerable: true, configurable: true });
  };
  mark(schema);
  /*
   * `.describe()` and `.meta()` CLONE the schema and share its def, so a
   * described node reference — the natural thing to write, since the
   * description is the question a decision provider is asked — used to
   * come back as a plain string. The def is the stable identity.
   */
  mark((schema as { _def?: object })._def);
  return schema;
}

/** The node kinds an argument accepts, or undefined if it is not a node ref. */
export function nodeRefKinds(schema: unknown): readonly string[] | undefined {
  if (typeof schema !== "object" || schema === null) return undefined;
  const direct = marked(schema);
  if (direct) return direct;
  const def = (schema as { _def?: object })._def;
  const byDef = marked(def);
  if (byDef) return byDef;
  // Unwrap optional/default/nullable wrappers so `nodeRef([...]).optional()`
  // keeps its meaning.
  const inner = (schema as { _def?: { innerType?: unknown } })._def?.innerType;
  return inner ? nodeRefKinds(inner) : undefined;
}

/** One argument of an act that names a record: its name, the kinds it accepts, and whether it may be left out. */
export interface NodeRefArg {
  readonly name: string;
  readonly kinds: readonly string[];
  readonly optional: boolean;
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
  /**
   * A DATE, AND WITH `time` A TIME OF DAY IN IT. A workshop's start is
   * `YYYY-MM-DDTHH:MM`; read as a plain date it got a date picker, whose
   * `YYYY-MM-DD` the act's own pattern refused — on every face, so the
   * workshop could not be made and the talk could not be given its slot.
   */
  | { readonly type: "date"; readonly time?: true }
  | { readonly type: "number"; readonly min?: number; readonly max?: number }
  | { readonly type: "choice"; readonly options: readonly string[] }
  /**
   * YES OR NO — an argument that takes a boolean.
   *
   * Undescribable until now, for the same reason a list was: an interface
   * can only offer what it can ask for, so "Add a field" — whose `required`
   * is a plain boolean — was derived NOWHERE. The studio's central act, in
   * the studio, unreachable, because nothing could ask one question.
   */
  | { readonly type: "boolean" }
  /**
   * SEVERAL OF A THING — an argument that takes a list.
   *
   * "Invite somebody as coordinator and gardener" is one act with two roles
   * in one argument, and without this shape it described itself as `unknown`:
   * an interface can only offer what it can ask for, so the act was offered
   * NOWHERE. Not hidden behind a refusal — simply never derived, in every
   * installation the framework ships.
   */
  | { readonly type: "several"; readonly of: ArgShape }
  | { readonly type: "unknown" };

/** Unwraps optional/default/nullable so a wrapped field still describes itself. */
export function unwrap(schema: unknown): unknown {
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
    | {
        _def?: { type?: string; entries?: Record<string, string>; element?: unknown };
        _zod?: { bag?: Record<string, unknown> };
      }
    | undefined;
  const type = field?._def?.type;
  const bag = field?._zod?.bag ?? {};

  if (type === "enum") return { type: "choice", options: Object.keys(field?._def?.entries ?? {}) };

  if (type === "boolean") return { type: "boolean" };

  /*
   * A list describes itself through what it holds. An array of something
   * nothing can describe is still unknown — saying "several unknowns" would
   * make an unaskable argument look askable, which is the failure this whole
   * shape exists to prevent.
   */
  if (type === "array") {
    const of = describeArg((field as { _def?: { element?: unknown } })._def?.element);
    return of.type === "unknown" ? { type: "unknown" } : { type: "several", of };
  }

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
    if (sources.some((source) => source.includes("\\d{4}"))) {
      // A time of day in the pattern as well: `T\d{2}:\d{2}`, or a space before it.
      return sources.some((source) => source.includes("\\d{2}:\\d{2}")) ? { type: "date", time: true } : { type: "date" };
    }
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
