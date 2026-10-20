import type { MutationCall } from "./types.js";

/*
 * A RECORD AN EARLIER CALL OF THE SAME CHANGE MADE (FR-193).
 *
 * `applyAll` takes several calls as one change, one undo. A change that
 * makes a record and then links it — a moment made from a photograph and
 * linked to the day it was dropped on — could not say the second half: the
 * new record's id is minted as the first call is applied, so nothing
 * asking for the change knows it. An argument may instead say `{ $made: n }`
 * — the first record the call at index `n` of the same change made — and
 * the store reads it as that record's id when it comes to apply the call
 * that names it, and judges that call then. A call may name only a call
 * before it that made a record; anything else refuses the whole change,
 * which keeps none of it.
 *
 * The calls are kept and sent as they were asked, so a host that applies
 * them again (a server, a rebase) reads the same records the same way; the
 * op the log keeps holds the id it was read as.
 */

/** The first record the call at `index` of the same change made: `{ $made: 0 }`. */
export interface MadeRef {
  readonly $made: number;
}

/** Name the record the call at `index` of the same change makes. */
export const made = (index: number): MadeRef => ({ $made: index });

/** Whether a value names a record an earlier call made: `{ $made: <a whole number> }`, and nothing else. */
export const isMadeRef = (value: unknown): value is MadeRef =>
  typeof value === "object" && value !== null && Object.keys(value).join() === "$made" && Number.isInteger((value as MadeRef).$made) && (value as MadeRef).$made >= 0;

/** Each argument, and each of a list's items. */
const each = (call: MutationCall, read: (value: unknown) => unknown) => Object.fromEntries(Object.entries(call.args ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value.map(read) : read(value)]));

/** Whether a call names a record an earlier call made. */
export const namesMade = (call: MutationCall): boolean => Object.values(call.args ?? {}).some((value) => isMadeRef(value) || (Array.isArray(value) && value.some(isMadeRef)));

/** The call with each `{ $made: n }` read as the id of the record call `n` made (`madeIds`); throws where no earlier call made one. */
export const resolveMade = (call: MutationCall, madeIds: readonly (string | undefined)[], at: number): MutationCall => ({
  ...call,
  args: each(call, (value) => {
    if (!isMadeRef(value)) return value;
    const id = value.$made < at ? madeIds[value.$made] : undefined;
    if (id === undefined) throw new Error(`“${call.name}” names the record call ${value.$made + 1} makes, and no call before it made that record.`);
    return id;
  }),
});
