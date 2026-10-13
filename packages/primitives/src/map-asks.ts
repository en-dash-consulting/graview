/*
 * WHAT THE MAP HAS BEEN ASKED TO REVEAL. A district's "⚠ 3" is a control:
 * pressing it chooses the district — the panel beside the map opens — and
 * asks that panel to bring its problems up. The press and the panel are in
 * different chunks and the panel may not be drawn yet, so the ask is kept
 * here, a few lines with no imports, which both can reach and neither drags
 * the other in. `n` counts the asks, so a second press on an open panel is
 * heard too.
 */
export interface ProblemsAsked {
  readonly kind: string;
  readonly n: number;
}

let asked: ProblemsAsked | null = null;
const listeners = new Set<() => void>();

export const askForProblems = (kind: string): void => {
  asked = { kind, n: (asked?.n ?? 0) + 1 };
  for (const listen of listeners) listen();
};
export const problemsAsked = (): ProblemsAsked | null => asked;
export const subscribeToProblemsAsked = (listen: () => void): (() => void) => {
  listeners.add(listen);
  return () => listeners.delete(listen);
};
/** The ask is spent when its panel goes: the next district chosen by other means does not scroll to anything. */
export const putDownProblemsAsked = (): void => {
  asked = null;
};
