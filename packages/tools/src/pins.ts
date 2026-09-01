/**
 * A PERSON'S OWN PINS, kept in their browser.
 *
 * The dev pins an act by declaring `pinned: true` on the mutation; a person
 * pins one from the menu itself. Their pins live here — per browser, beside
 * the intelligence config, never in the repo or the graph — and outrank the
 * dev's wherever actions are offered.
 */

const STORED = "graview:pins";

/** The saved pin list, or nothing — never a throw. */
export function loadPins(): readonly string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

export function savePins(pins: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(STORED, JSON.stringify(pins));
  } catch {
    // A pin that cannot be remembered still applies for this visit.
  }
}

/** Pin if unpinned, unpin if pinned; returns the new list, saved. */
export function togglePin(pins: readonly string[], mutation: string): readonly string[] {
  const next = pins.includes(mutation)
    ? pins.filter((name) => name !== mutation)
    : [...pins, mutation];
  savePins(next);
  return next;
}
