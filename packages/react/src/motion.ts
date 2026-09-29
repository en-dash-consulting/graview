import { useSyncExternalStore } from "react";
import { useGraview } from "./context.js";

/**
 * WHETHER THE SCENE IS MOVING — a drag, a wheel, a transition — for the few
 * things that should wait for it to stop (docs/scale.md): a drive-in's
 * thumbnail is a lens drawn small, and building one while the camera flies
 * spends a frame on a picture nobody can read yet. A store, not context
 * state: setting it re-renders only what subscribed.
 */
export interface MotionStore {
  moving(): boolean;
  /** The scene calls this; nobody else does. */
  set(moving: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createMotionStore(): MotionStore {
  let moving = false;
  const listeners = new Set<() => void>();
  return {
    moving: () => moving,
    set(next) {
      if (next === moving) return;
      moving = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** True while the scene is still. */
export function useSceneStill(): boolean {
  const { motion } = useGraview();
  return useSyncExternalStore(motion.subscribe, () => !motion.moving(), () => true);
}
