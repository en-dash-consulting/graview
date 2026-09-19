/**
 * THE POINTER OVER THE SCENE, for whoever asks — and NOBODY listening
 * costs nothing.
 *
 * A quiet scene must not run a listener on every pointer move on the off
 * chance something wants it. So this is a store with a subscriber count:
 * the scene attaches its listener when the first subscriber arrives and
 * detaches it when the last one leaves. `useScenePointer` reads it through
 * `useSyncExternalStore`, which is what makes the count exact.
 */
export interface ScenePoint {
  /** In scene coordinates — the same space the layout places things in. */
  readonly x: number;
  readonly y: number;
}

export interface PointerStore {
  subscribe(listener: () => void): () => void;
  snapshot(): ScenePoint | null;
  /** The scene calls this; nobody else does. */
  set(point: ScenePoint | null): void;
  /** How many are listening right now. */
  readonly listeners: number;
  /** Told when the count crosses zero either way — attach or detach. */
  onActive(listener: (active: boolean) => void): () => void;
}

export function createPointerStore(): PointerStore {
  let point: ScenePoint | null = null;
  const listeners = new Set<() => void>();
  const watchers = new Set<(active: boolean) => void>();
  const tell = (active: boolean) => {
    for (const watcher of watchers) watcher(active);
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) tell(true);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          point = null;
          tell(false);
        }
      };
    },
    snapshot: () => point,
    set(next) {
      if (point === next || (point && next && point.x === next.x && point.y === next.y)) return;
      point = next;
      for (const listener of listeners) listener();
    },
    get listeners() {
      return listeners.size;
    },
    onActive(watcher) {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
  };
}
