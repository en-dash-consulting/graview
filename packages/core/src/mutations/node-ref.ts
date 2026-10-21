import * as classic from "zod";
import * as z from "../schema/zod.js";
import { defOf } from "../schema/zod.js";

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
): classic.ZodString {
  return markRef(classic.string().min(1), kinds);
}

/**
 * `nodeRef` in zod/mini: what the framework's own acts — a compiled
 * document's, a derived edit's — are made of, so a page that never wrote a
 * classic schema loads none of classic zod (FR-57). `nodeRef` stays classic
 * for a product to chain on (`nodeRef(["plot"]).optional()`).
 */
export function refTo(kinds: readonly string[] | "*" = "*"): z.ZodMiniString<string> {
  return markRef(z.string().check(z.minLength(1)), kinds);
}

/** Marks a string schema as naming a node of these kinds. */
function markRef<T extends object>(schema: T, kinds: readonly string[] | "*"): T {
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
  mark(defOf(schema));
  return schema;
}

/** The node kinds an argument accepts, or undefined if it is not a node ref. */
export function nodeRefKinds(schema: unknown): readonly string[] | undefined {
  if (typeof schema !== "object" || schema === null) return undefined;
  const direct = marked(schema);
  if (direct) return direct;
  const def = defOf(schema);
  const byDef = marked(def);
  if (byDef) return byDef;
  // Unwrap optional/default/nullable wrappers so `nodeRef([...]).optional()`
  // keeps its meaning.
  const inner = def?.innerType;
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
  input: unknown,
): { name: string; kinds: readonly string[]; optional: boolean }[] {
  const shape = (input as { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> }).shape;
  if (!shape) return [];
  const args: { name: string; kinds: readonly string[]; optional: boolean }[] = [];
  for (const [name, field] of Object.entries(shape)) {
    const kinds = nodeRefKinds(field);
    if (!kinds) continue;
    args.push({ name, kinds, optional: field.safeParse(undefined).success });
  }
  return args;
}

