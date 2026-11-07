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
  /** Once the view's values are here, or `readMs` has gone without them: what its first draw waits for. Never rejects. */
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
  /** The values came after `readMs`, so what was drawn was drawn without them. */
  readonly onLate?: () => void;
  /** How long a host has to say what the view keeps, before the view is drawn without it and each ask is answered in a sentence. 1 500 ms by default. */
  readonly readMs?: number;
  /** How long a host has to answer one write. 10 000 ms by default. */
  readonly writeMs?: number;
  /** The clock, for tests. */
  readonly now?: () => number;
}

const UNREAD = "What this view keeps for you could not be read just now.";
const UNKEPT = "This value could not be kept just now.";

/* A view's writes in the last minute, per place they go and per view: drawn again, it is the same view. */
const writesAt = new WeakMap<ViewerState, Map<string, number[]>>();
function writesOf(state: ViewerState, view: string): number[] {
  const views = writesAt.get(state) ?? new Map<string, number[]>();
  writesAt.set(state, views);
  const times = views.get(view) ?? [];
  views.set(view, times);
  return times;
}

/**
 * ONE VIEW'S VALUES, AS ONE DRAWING OF IT HOLDS THEM: read once from where they
 * are kept, handed at draw time, each write judged, then asked of the host in
 * the order it came, and held here only once the host has kept it. A view asks
 * by key alone: which view it is is said here. A host that does not answer
 * holds nobody up: past its time each ask is answered in a sentence.
 */
export function createMine({ view, state, onRefused, onLate, readMs = 1_500, writeMs = 10_000, now = Date.now }: MineOptions): Mine {
  let held = new Map<string, string>();
  let read = false;
  let waited = false;
  const refused = (sentence: string): ViewerStateAnswer => {
    onRefused?.(sentence);
    return { ok: false, sentence };
  };
  const reading = (async () => {
    try {
      held = new Map(Object.entries(await state.read(view)).filter(([, value]) => typeof value === "string"));
      read = true;
      if (waited) onLate?.();
    } catch {
      onRefused?.(UNREAD);
    }
  })();
  const ready = new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      waited = true;
      if (!read) onRefused?.(UNREAD);
      resolve();
    }, readMs);
    void reading.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
  /* Every write after the one before it, and every read after them: a get after a set sees the set. */
  let queue: Promise<unknown> = ready;
  const writes = writesOf(state, view);
  return {
    ready,
    values: () => Object.fromEntries(held),
    get: (key) => queue.then((): GuestMineAnswer<string | null> => (read ? { ok: true, value: held.get(key) ?? null } : { ok: false, sentence: UNREAD })),
    set(key, value) {
      const refusal = mineRefusal(key, value);
      if (refusal) return Promise.resolve(refused(refusal));
      const at = now();
      while (writes.length > 0 && writes[0]! <= at - 60_000) writes.shift();
      if (writes.length >= MINE_WRITES_A_MINUTE) return Promise.resolve(refused("This view asked to keep too many values at once, so this one was not kept."));
      writes.push(at);
      const answer = queue.then(async (): Promise<ViewerStateAnswer> => {
        if (!read) return refused(`${UNREAD} So this value was not kept.`);
        let said: ViewerStateAnswer | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          said = await Promise.race([state.write(view, key as string, value as string | null), new Promise<undefined>((resolve) => (timer = setTimeout(() => resolve(undefined), writeMs)))]);
        } catch {
          // A host's own error can name what it holds: the view is told only that it was not kept.
        } finally {
          clearTimeout(timer);
        }
        if (said?.ok !== true) return refused(said && typeof said.sentence === "string" && said.sentence ? said.sentence : UNKEPT);
        if (value === null) held.delete(key as string);
        else held.set(key as string, value as string);
        return { ok: true };
      });
      queue = answer;
      return answer;
    },
  };
}
