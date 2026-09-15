import type { GraphReader } from "@graview/core";

/**
 * PHOTOGRAPHS, AND THE QUOTA THEY WILL OTHERWISE EAT.
 *
 * A photograph off a modern phone is three to six megabytes. The browser
 * adapter in this package keeps the whole graph — snapshot, log and meta —
 * in `localStorage`, which is about five megabytes in total. So the failure
 * mode of doing nothing is not "photographs are big"; it is that the
 * twelfth photograph throws a `QuotaExceededError` somewhere inside a save
 * and **the graph does not persist** — every node, every op, every hour
 * anyone logged, gone on the next reload, because somebody photographed a
 * gutter.
 *
 * That is a trap this package sets and therefore a trap this package should
 * spring. Three defences, in order:
 *
 * 1. **Downscale before anything is stored** (`downscale`, in
 *    `@graview/primitives` where a canvas is at hand). Nothing a model is
 *    asked to look at needs 4032 pixels.
 * 2. **A declared budget**, checked before the write, with the number and
 *    the reason both written down rather than discovered.
 * 3. **A loud, catchable refusal** when the budget is gone — never a
 *    silently truncated graph. The person is told which photograph could
 *    not be kept and how much room is left.
 *
 * Everything here is pure, so it runs in the domain tier where the check
 * belongs: before the act, not after the write.
 *
 * Found by a product that stores a photograph on a sighting. Its numbers
 * are the defaults, and any of them can be said again.
 */

/**
 * What to spend on photographs, in bytes.
 *
 * `localStorage` is ~5 MB per origin and the adapter stores a snapshot AND
 * an append-only log, so a graph's own text can easily be another megabyte
 * after a few seasons. 2 MB for photographs leaves room for both and for
 * the log to keep growing, which matters more: a lost photograph is an
 * annoyance and a lost log is the whole record.
 */
export const PHOTO_BUDGET_BYTES = 2 * 1024 * 1024;

/** A single photograph over this is refused outright, before the budget. */
export const PHOTO_MAX_BYTES = 400 * 1024;

export class PhotoTooLarge extends Error {
  constructor(
    message: string,
    readonly bytes: number,
    readonly remaining: number,
  ) {
    super(message);
    this.name = "PhotoTooLarge";
  }
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kB`;

/**
 * How many bytes a data URL actually costs in storage.
 *
 * Base64 is 4 characters per 3 bytes, and `localStorage` stores UTF-16, so
 * a data URL costs roughly TWICE its character count in real terms on some
 * engines. Counting characters and doubling is the pessimistic reading, and
 * pessimistic is the right direction for a budget whose overrun destroys
 * the graph.
 */
export function storageBytes(dataUrl: string): number {
  return dataUrl.length * 2;
}

/** Where a graph keeps its photographs: a kind, and a field on it. */
export interface PhotoField {
  readonly kind: string;
  readonly field: string;
}

/** What every photograph in the graph is costing, together. */
export function photosUsed(
  graph: GraphReader<{ id: string; kind: string } & Record<string, unknown>>,
  where: readonly PhotoField[],
): number {
  let total = 0;
  for (const node of graph.allNodes()) {
    for (const at of where) {
      if (node.kind !== at.kind) continue;
      const photo = node[at.field];
      if (typeof photo === "string") total += storageBytes(photo);
    }
  }
  return total;
}

export interface PhotoBudget {
  readonly total?: number;
  readonly each?: number;
  /** What the installation is called, for the refusal's own sentence. */
  readonly of?: string;
  /**
   * What to do about it, in the product's own words — "Remove a photograph
   * from an older sighting". A refusal that does not say what to do next is
   * half a refusal, and only the product knows what the older thing is
   * called.
   */
  readonly advice?: string;
}

/**
 * Whether one more photograph fits, and a readable refusal if it does not.
 *
 * Called BEFORE the act that would store it. Throwing after the write is
 * the bug this exists to prevent.
 */
export function assertPhotoFits(dataUrl: string, alreadyUsed: number, budget: PhotoBudget = {}): void {
  const total = budget.total ?? PHOTO_BUDGET_BYTES;
  const each = budget.each ?? PHOTO_MAX_BYTES;
  const bytes = storageBytes(dataUrl);
  if (bytes > each) {
    throw new PhotoTooLarge(
      `That photograph is ${kb(bytes)} and the most one may take is ${kb(each)}. ` +
        `It should have been made smaller before it got here — this is a bug rather than your fault.`,
      bytes,
      total - alreadyUsed,
    );
  }
  const remaining = total - alreadyUsed;
  if (bytes > remaining) {
    throw new PhotoTooLarge(
      `There is no room for this photograph: it needs ${kb(bytes)} and ${kb(remaining)} is left of ` +
        `the ${kb(total)} ${budget.of ?? "this installation"} keeps for photographs. ` +
        `Everything else you have written down is safe. ` +
        `${budget.advice ?? "Remove a photograph from an older one to make room."}`,
      bytes,
      remaining,
    );
  }
}
