import type { Operation } from "./ops/types.js";
import type { GraphSnapshot } from "./graph/types.js";
import { FRAMEWORK_VERSION } from "./version.js";

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
 * Everything written before stamps existed is format 1: nothing has changed
 * format yet. Ops and primitives are the stable contract — a format change
 * within a major is additive and needs no step; a major brings its steps.
 */
export const FORMATS = { snapshot: 1, op: 1 } as const;
export type FormatName = keyof typeof FORMATS;

/** What a stored thing says about who wrote it and in what shape. */
export interface FormatStamp {
  /** The framework version that wrote it (`FRAMEWORK_VERSION`). */
  readonly framework: string;
  readonly formats: { readonly [K in FormatName]: number };
}

/** The stamp this build writes. */
export function formatStamp(): FormatStamp {
  return { framework: FRAMEWORK_VERSION, formats: { ...FORMATS } };
}

/** Something written in a format newer than this build reads. Fold the log, or upgrade the framework. */
export class NewerFormatError extends Error {
  constructor(
    readonly what: FormatName,
    readonly found: number,
    readonly supported: number,
    readonly writtenBy?: string,
  ) {
    super(
      `This ${what} is in a newer format (${found}${writtenBy ? `, written by @graview ${writtenBy}` : ""}) than @graview ${FRAMEWORK_VERSION} reads (${supported}). ` +
        (what === "snapshot" ? "Refold it from the log, or upgrade the framework." : "Upgrade the framework to read it."),
    );
    this.name = "NewerFormatError";
  }
}

/** Throws `NewerFormatError` when a stamp says a format this build cannot read; absent formats are format 1. */
export function assertReadable(stamp: { readonly framework?: string; readonly formats?: Partial<Record<FormatName, number>> } | null | undefined): void {
  for (const what of Object.keys(FORMATS) as FormatName[]) {
    const found = stamp?.formats?.[what] ?? 1;
    if (found > FORMATS[what]) throw new NewerFormatError(what, found, FORMATS[what], stamp?.framework);
  }
}

type Step<T> = (from: T) => T;
/**
 * One step per format change, keyed by the format it upgrades FROM. Empty
 * while nothing has changed format; the next format change adds its step
 * here, and a fixture of the format before it under tests/fixtures/formats.
 */
const SNAPSHOT_STEPS: Readonly<Record<number, Step<GraphSnapshot>>> = {};
const OP_STEPS: Readonly<Record<number, Step<Operation>>> = {};

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
  return upgrade("op", op, from, OP_STEPS);
}
