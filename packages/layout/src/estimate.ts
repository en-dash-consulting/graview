/*
 * How wide a line of text draws: a file of its own, so a view that only
 * measures reaches it without the fitting of a label (`./label-fit.ts`).
 */

/**
 * HOW WIDE A STRING WILL BE.
 *
 * Injected, because the honest answer depends on where you are. A browser
 * has a 2D canvas context that will measure text synchronously with the same
 * engine that will draw it; a test and a server have nothing, and have to
 * estimate. The estimate is what this defaults to and it is deliberately
 * PESSIMISTIC: the failure it guards is overflow, and being a little small
 * is not a failure at all.
 *
 * The first version only estimated, at 0.52 of the size per character, and
 * that was wrong by enough to matter — a display serif runs from 0.28 for an
 * "i" to 0.86 for a "W", so a name full of wide letters measured short and
 * was drawn running off the picture. Which is the exact fault the fitting
 * exists to prevent, arrived at from the other side.
 */
export type Measure = (text: string, fontSize: number) => number;

const ADVANCE = 0.58;
export const estimateWidth: Measure = (text, fontSize) => text.length * fontSize * ADVANCE;
