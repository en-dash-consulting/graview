import { FRAMEWORK_VERSION } from "./version.js";

/**
 * THE FORMATS THIS BUILD WRITES, AND THE ERROR IT RAISES ON ONE IT CANNOT
 * READ. Its own module, importing nothing but the version, so the graph,
 * the primitives and every fold can refuse what they do not know without
 * reaching the upgrade steps (`formats.ts`), which import the ops.
 */
export const FORMATS = { snapshot: 1, op: 2 } as const;
export type FormatName = keyof typeof FORMATS;

/**
 * Something written in a format newer than this build reads. Fold the log, or upgrade the framework.
 *
 * `unknown` names what this build met and does not know, when it was
 * not a stamp: a primitive (`primitive "splice-text"`) or a typed value
 * (`value type "rich-text"`) a newer build wrote. Its `found` is then the
 * format after the one this build reads, the least the writer was on.
 */
export class NewerFormatError extends Error {
  constructor(
    readonly what: FormatName | "sync state",
    readonly found: number,
    readonly supported: number,
    readonly writtenBy?: string,
    readonly unknown?: string,
  ) {
    super(
      unknown !== undefined
        ? `This ${what} holds a ${unknown} that @graview ${FRAMEWORK_VERSION} does not know: upgrade the framework to read it.`
        : `This ${what} is in a newer format (${found}${writtenBy ? `, written by @graview ${writtenBy}` : ""}) than @graview ${FRAMEWORK_VERSION} reads (${supported}). ` +
            (what === "snapshot" ? "Refold it from the log, or upgrade the framework." : "Upgrade the framework to read it."),
    );
    this.name = "NewerFormatError";
  }
}

/**
 * THE PRIMITIVES THIS BUILD FOLDS. A new one raises `FORMATS.op` and is
 * negotiated per reader (`opFormat`); a reader meeting one not in this list
 * refuses the op (`unknownPrimitive`) rather than skip it, since a graph
 * that skipped a primitive is a graph that diverged without saying so.
 */
export const PRIMITIVE_OPS = ["add-node", "remove-node", "patch-node", "add-edge", "remove-edge"] as const;
const KNOWN_PRIMITIVES: ReadonlySet<unknown> = new Set(PRIMITIVE_OPS);

/** A primitive this build does not know, refused: the default of every switch that folds one. */
export function unknownPrimitive(primitive: unknown): never {
  throw new NewerFormatError("op", FORMATS.op + 1, FORMATS.op, undefined, `primitive "${(primitive as { readonly op?: unknown } | null)?.op}"`);
}

/**
 * THE TYPED-VALUE ENVELOPE, RESERVED. A field's value that is an object
 * with a `$type` is a typed value — `{ $type: "rich-text", … }` —
 * as `$archived` is reserved on a record. No build before one that names a
 * type folds it: applying an op that writes a value whose `$type` this build
 * does not know is refused with `NewerFormatError`, because writing it as an
 * opaque object would let a later edit through this build mangle it. What
 * only passes a value through — the log, an adapter, an export, the wire,
 * a seat's view of an op — keeps it as written. This build knows none.
 */
export const VALUE_TYPES: ReadonlySet<string> = new Set<string>();

/** Refuses a record's fields that hold a typed value this build does not know (`VALUE_TYPES`). */
export function assertKnownValues(fields: Readonly<Record<string, unknown>>): void {
  for (const key in fields) {
    const type = (fields[key] as { readonly $type?: unknown } | null)?.$type;
    if (type !== undefined && !VALUE_TYPES.has(type as string)) throw new NewerFormatError("op", FORMATS.op + 1, FORMATS.op, undefined, `value type "${type}" in "${key}"`);
  }
}

/** Refuses an op whose primitives this build cannot fold: one it does not know. Values are judged where they are applied. */
export function assertKnownPrimitives(op: { readonly primitives: readonly unknown[] }): void {
  for (const primitive of op.primitives) if (!KNOWN_PRIMITIVES.has((primitive as { readonly op?: unknown } | null)?.op)) unknownPrimitive(primitive);
}
