import type { ViewerState, ViewerStateAnswer } from "@graview/core";
import { mineRefusal, type GuestMineAnswer } from "../protocol.js";

/** The most values a view keeps for one viewer for a visit, and the bytes they hold: what a host's own caps would stop. */
const MOST_KEYS = 200;
const MOST_BYTES = 64 * 1024;
/** The most a view may ask a host to keep in a minute: a host's store is a network away. */
export const MINE_WRITES_A_MINUTE = 120;

const bytesOf = (text: string) => new TextEncoder().encode(text).length;

/**
 * WHERE VALUES GO WITH NO HOST TO KEEP THEM: memory, per view, for the visit.
 * Gone when the page is; never in a browser's storage, since the next person
 * at this screen is not this viewer.
 */
export function keptForTheVisit(): ViewerState {
  const views = new Map<string, Map<string, string>>();
  return {
    read: async (view) => Object.fromEntries(views.get(view) ?? []),
    write: async (view, key, value) => {
      const values = views.get(view) ?? new Map<string, string>();
      views.set(view, values);
      if (value === null) {
        values.delete(key);
        return { ok: true };
      }
      let bytes = bytesOf(value);
      for (const [one, held] of values) if (one !== key) bytes += bytesOf(held);
      if (bytes > MOST_BYTES || (!values.has(key) && values.size >= MOST_KEYS)) return { ok: false, sentence: "This view keeps as much as it can for this visit, so this value was not kept." };
      values.set(key, value);
      return { ok: true };
    },
  };
}

/* One visit's values per store and per viewer: a view drawn again finds them, and the next person signed in at this page does not. */
const visits = new WeakMap<object, Map<string, ViewerState>>();

/** The values kept for this viewer of this store for this visit. */
export function visitOf(store: object, viewer: string): ViewerState {
  const viewers = visits.get(store) ?? new Map<string, ViewerState>();
  visits.set(store, viewers);
  const kept = viewers.get(viewer) ?? keptForTheVisit();
  viewers.set(viewer, kept);
  return kept;
}

export interface Mine {
  /** Once the view's values are here: what its first draw waits for. Never rejects. */
  readonly ready: Promise<void>;
  /** The view's values now: `props.mine`. */
  values(): Readonly<Record<string, string>>;
  get(key: string): Promise<GuestMineAnswer<string | null>>;
  set(key: unknown, value: unknown): Promise<ViewerStateAnswer>;
}

export interface MineOptions {
  /** The view's registered name, the host's and never the view's to say: all it can reach. */
  readonly view: string;
  readonly state: ViewerState;
  /** A value was not kept, or the values could not be read, in a sentence for the host's problems. Never holds a value. */
  readonly onRefused?: (sentence: string) => void;
  /** The clock, for tests. */
  readonly now?: () => number;
}

/**
 * ONE VIEW'S VALUES, AS ONE DRAWING OF IT HOLDS THEM: read once from where they
 * are kept, handed at draw time, each write judged, then asked of the host in
 * the order it came, and held here only once the host has kept it. A view asks
 * by key alone: which view it is is said here.
 */
export function createMine({ view, state, onRefused, now = Date.now }: MineOptions): Mine {
  let held = new Map<string, string>();
  const refused = (sentence: string): ViewerStateAnswer => {
    onRefused?.(sentence);
    return { ok: false, sentence };
  };
  const ready = (async () => {
    try {
      held = new Map(Object.entries(await state.read(view)).filter(([, value]) => typeof value === "string"));
    } catch {
      onRefused?.(`What this view keeps for you could not be read just now.`);
    }
  })();
  /* Every write after the one before it, and every read after them: a get after a set sees the set. */
  let queue: Promise<unknown> = ready;
  const writes: number[] = [];
  return {
    ready,
    values: () => Object.fromEntries(held),
    get: (key) => queue.then(() => ({ ok: true as const, value: held.get(key) ?? null })),
    set(key, value) {
      const refusal = mineRefusal(key, value);
      if (refusal) return Promise.resolve(refused(refusal));
      const at = now();
      while (writes.length > 0 && writes[0]! <= at - 60_000) writes.shift();
      if (writes.length >= MINE_WRITES_A_MINUTE) return Promise.resolve(refused("This view asked to keep too many values at once, so this one was not kept."));
      writes.push(at);
      const answer = queue.then(async (): Promise<ViewerStateAnswer> => {
        let said: ViewerStateAnswer | undefined;
        try {
          said = await state.write(view, key as string, value as string | null);
        } catch {
          // A host's own error can name what it holds: the view is told only that it was not kept.
        }
        if (said?.ok !== true) return refused(said && typeof said.sentence === "string" && said.sentence ? said.sentence : "This value could not be kept just now.");
        if (value === null) held.delete(key as string);
        else held.set(key as string, value as string);
        return { ok: true };
      });
      queue = answer;
      return answer;
    },
  };
}
