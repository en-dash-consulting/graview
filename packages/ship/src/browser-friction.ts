import { isVisitorAuthor } from "@graview/core";
import { keptFriction, type FrictionEvent, type HeldFriction } from "@graview/core/friction";
import type { StorageLike } from "./browser-adapter.js";

/**
 * THE FRICTION LOG KEPT IN A BROWSER (Roadmap f-friction-log), for a page
 * that holds its own store (`createBrowserAdapter`): one key of its own in
 * the storage it is handed, beside the log's, the old let go on every
 * write — a thousand at most. A page whose store is served posts to the
 * server instead (`openRemote`, `/graview/friction`).
 */
export function browserFriction(storage: StorageLike, options: { readonly key: string; readonly retentionDays?: number; readonly most?: number }): HeldFriction {
  const keep = { most: 1000, ...options };
  const read = (): readonly FrictionEvent[] => {
    try {
      const text = storage.getItem(options.key);
      return text ? ((JSON.parse(text) as { events?: FrictionEvent[] }).events ?? []) : [];
    } catch {
      return [];
    }
  };
  return {
    add(event) {
      if (isVisitorAuthor(event.by)) return;
      try {
        storage.setItem(options.key, JSON.stringify({ events: keptFriction([...read(), event], keep) }));
      } catch {
        // Storage full or refused: what could not be done is never why a page fails.
      }
    },
    list: () => keptFriction(read(), keep),
  };
}
