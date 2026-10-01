import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Which of the face's own controls a shell placed itself — so the face's
 * root (face-controls.tsx) draws only the ones it did not.
 */
export type FaceControl = "find" | "undo";

export interface Placed {
  readonly count: (control: FaceControl) => number;
  readonly place: (control: FaceControl) => () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export const FaceControls = createContext<Placed | null>(null);

export function createPlaced(): Placed {
  const counts = new Map<FaceControl, number>();
  const listeners = new Set<() => void>();
  const tell = () => {
    for (const listener of listeners) listener();
  };
  return {
    count: (control) => counts.get(control) ?? 0,
    place(control) {
      counts.set(control, (counts.get(control) ?? 0) + 1);
      tell();
      return () => {
        counts.set(control, (counts.get(control) ?? 1) - 1);
        tell();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A control a shell drew itself: the face's root then draws no second one. */
export function usePlacedOnTheFace(control: FaceControl): void {
  const placed = useContext(FaceControls);
  useLayoutEffect(() => placed?.place(control), [placed, control]);
}

export function usePlaced(placed: Placed, control: FaceControl): boolean {
  return useSyncExternalStore(
    placed.subscribe,
    () => placed.count(control) > 0,
    () => false,
  );
}

