/**
 * A PERSON'S OWN PINS, kept in their browser.
 *
 * The dev pins an act by declaring `pinned: true` on the mutation; a person
 * pins one from the menu itself. Their choices live here — per browser,
 * beside the intelligence config, never in the repo or the graph — and win
 * in BOTH directions: their pin outranks the dev's, and their unpin demotes
 * an act the dev pinned. Without the second half the star on a declared pin
 * was a control that did nothing visible, which teaches people not to press
 * controls.
 */

const STORED = "graview:pins";

export interface PinOverrides {
  /** Acts this person pinned. Outrank the dev's declared pins. */
  readonly pinned: readonly string[];
  /** Declared pins this person turned off. */
  readonly unpinned: readonly string[];
}

export const NO_PINS: PinOverrides = { pinned: [], unpinned: [] };

const names = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((name) => typeof name === "string") : [];

/** The saved overrides, or none — never a throw. Reads the old plain-array shape too. */
export function loadPins(): PinOverrides {
  try {
    const raw = globalThis.localStorage?.getItem(STORED);
    if (!raw) return NO_PINS;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { pinned: names(parsed), unpinned: [] };
    if (typeof parsed === "object" && parsed !== null) {
      const shaped = parsed as { pinned?: unknown; unpinned?: unknown };
      return { pinned: names(shaped.pinned), unpinned: names(shaped.unpinned) };
    }
    return NO_PINS;
  } catch {
    return NO_PINS;
  }
}

export function savePins(overrides: PinOverrides): void {
  try {
    globalThis.localStorage?.setItem(STORED, JSON.stringify(overrides));
  } catch {
    // A pin that cannot be remembered still applies for this visit.
  }
}

/**
 * One gesture, both directions: pin what is unpinned, unpin what is pinned
 * — including a pin the DEV declared, which the person demotes rather than
 * deletes (the declaration is not theirs to edit). Returns the new
 * overrides, saved.
 */
export function togglePin(
  overrides: PinOverrides,
  mutation: string,
  declaredPinned = false,
): PinOverrides {
  const without = (list: readonly string[]) => list.filter((name) => name !== mutation);
  const next: PinOverrides = declaredPinned
    ? overrides.unpinned.includes(mutation)
      ? { pinned: without(overrides.pinned), unpinned: without(overrides.unpinned) }
      : { pinned: without(overrides.pinned), unpinned: [...overrides.unpinned, mutation] }
    : overrides.pinned.includes(mutation)
      ? { pinned: without(overrides.pinned), unpinned: without(overrides.unpinned) }
      : { pinned: [...overrides.pinned, mutation], unpinned: without(overrides.unpinned) };
  savePins(next);
  return next;
}
