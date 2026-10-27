import { bareOp } from "./ops/inverse.js";
import type { Operation } from "./ops/types.js";
import type { GraphSnapshot } from "./graph/types.js";
import type { Epoch } from "./ops/log.js";
import { FRAMEWORK_VERSION } from "./version.js";
import { assertKnownPrimitives, FORMATS, NewerFormatError, type FormatName } from "./format-error.js";

/**
 * STORED FORMATS CARRY THEIR VERSION (FR-31).
 *
 * What a version writes, the version before it must read — or know not to.
 * A snapshot and an op are stamped with the format they were written in;
 * a reader meeting a NEWER format than it knows says so (`NewerFormatError`)
 * rather than folding what it would misread, so a host refolds from the log
 * or rolls forward. An older format is brought up by `upgradeSnapshot` and
 * `upgradeOp`, one step per format change, each shipped with a test over
 * the previous format's fixtures.
 *
 * Everything written before stamps existed is format 1. Ops and primitives
 * are the stable contract — a format change within a major is additive and
 * needs no step; a major brings its steps.
 *
 * OP FORMAT 2 (0.1.43) keeps no `inverse`: it is the primitives inverted,
 * derived where it is read (`inverseOf`). A format-1 op reads on this build
 * as it did (its step drops an inverse that is its primitives' own), and a
 * build before 0.1.43 meeting a store stamped `op: 2` refuses it with
 * `NewerFormatError` rather than undo an op it would find no inverse on.
 *
 * OP FORMAT 3 adds the `splice-text` primitive (collaborative text,
 * phase 1). A format-2 op reads as it was written; a build before it
 * meeting a store stamped `op: 3`, or a splice, refuses it.
 *
 * SNAPSHOT FORMAT 2 is a stored state whose checkpoint lies past what
 * stood published (`Epoch.published` keeps the app as readers are served
 * it there, Roadmap f-publishing-lifecycle). A build before it would serve
 * those readers the horizon — changes never published — so such a store
 * and its bundles are stamped `snapshot: 2`, and that build refuses them
 * with `NewerFormatError`. Every other store is stamped 1, as before: a
 * host that must stay readable by an older build passes
 * `pins: [store.publishedSeq]` to the compaction, and its checkpoint
 * never passes the publish. A format-1 snapshot reads as written.
 *
 * FAIL CLOSED (1.0). A new primitive raises `FORMATS.op` and travels only
 * to a reader that said it reads it (`opFormat`); a reader that meets a
 * primitive it does not know — a log a newer build wrote, an op handed
 * over by hand — refuses it with `NewerFormatError` wherever ops are
 * folded, never skips it. A field value `{ $type, … }` is a typed value,
 * reserved as `$archived` is: one whose type this build does not know is
 * refused where it would be applied, and passed through as written
 * everywhere else (`format-error.ts`).
 */
export { FORMATS, NewerFormatError, PRIMITIVE_OPS, VALUE_TYPES } from "./format-error.js";
export type { FormatName } from "./format-error.js";

/** What a stored thing says about who wrote it and in what shape. */
export interface FormatStamp {
  /** The framework version that wrote it (`FRAMEWORK_VERSION`). */
  readonly framework: string;
  readonly formats: { readonly [K in FormatName]: number };
}

/**
 * The stamp this build writes for what begins at `checkpoint` (a store's
 * horizon epoch, a bundle's checkpoint): snapshot format 2 when it lies
 * past what stood published at its seq and keeps the app as readers were
 * served there — what a build before format 2 would misread — else 1.
 */
export function formatStamp(checkpoint?: Pick<Epoch, "published" | "publishedThrough">): FormatStamp {
  const past = checkpoint?.published?.some((kept) => kept.seq === checkpoint.publishedThrough) === true;
  return { framework: FRAMEWORK_VERSION, formats: { ...FORMATS, snapshot: past ? 2 : 1 } };
}

/** Throws `NewerFormatError` when a stamp says a format this build (or `reads`, the formats another reads) cannot read; absent formats are format 1. */
export function assertReadable(
  stamp: { readonly framework?: string; readonly formats?: Partial<Record<FormatName, number>> } | null | undefined,
  reads: { readonly [K in FormatName]: number } = FORMATS,
): void {
  for (const what of Object.keys(reads) as FormatName[]) {
    const found = stamp?.formats?.[what] ?? 1;
    if (found > reads[what]) throw new NewerFormatError(what, found, reads[what], stamp?.framework);
  }
}

type Step<T> = (from: T) => T;
/**
 * One step per format change, keyed by the format it upgrades FROM, each
 * with a fixture of the format before it under tests/fixtures/formats.
 */
const SNAPSHOT_STEPS: Readonly<Record<number, Step<GraphSnapshot>>> = {
  // Format 2 is a checkpoint past what stood published; a format-1 snapshot is a format-2 one as written.
  1: (snapshot) => snapshot,
};
const OP_STEPS: Readonly<Record<number, Step<Operation>>> = {
  // Format 1 wrote the inverse beside the primitives; format 2 derives it.
  1: bareOp,
  // Format 3 added a primitive, `splice-text`; a format-2 op is a format-3 op as written.
  2: (op) => op,
};

function upgrade<T>(what: FormatName, value: T, from: number, steps: Readonly<Record<number, Step<T>>>): T {
  if (!Number.isInteger(from) || from < 1) throw new Error(`No ${what} format ${from}: formats start at 1.`);
  if (from > FORMATS[what]) throw new NewerFormatError(what, from, FORMATS[what]);
  let current = value;
  for (let at = from; at < FORMATS[what]; at++) {
    const step = steps[at];
    if (!step) throw new Error(`No step upgrades a ${what} from format ${at} to ${at + 1}.`);
    current = step(current);
  }
  return current;
}

/** A snapshot written in format `from`, brought up to the format this build writes. */
export function upgradeSnapshot(snapshot: GraphSnapshot, from: number): GraphSnapshot {
  return upgrade("snapshot", snapshot, from, SNAPSHOT_STEPS);
}

/** An op written in format `from`, brought up to the format this build writes. */
export function upgradeOp(op: Operation, from: number): Operation {
  assertKnownPrimitives(op);
  return upgrade("op", op, from, OP_STEPS);
}
