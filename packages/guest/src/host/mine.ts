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
  /** Who is looking, for the write rate: a host may hand one `ViewerState` for every profile at a screen. */
  readonly viewer?: string;
  readonly state: ViewerState;
  /** A value was not kept, or the values could not be read, in a sentence for the host's problems. Never holds a value. */
  readonly onRefused?: (sentence: string) => void;
  /** Values came after the view was told they had not: what it was drawn with has moved. */
  readonly onLate?: () => void;
  /** How long a host has to say what the view keeps, before the view is drawn without it and each ask is answered in a sentence. 1 500 ms by default. */
  readonly readMs?: number;
  /** How long a view waits on one write before it is told the value is not kept yet. 10 000 ms by default. */
  readonly writeMs?: number;
  /** The clock, for tests. */
  readonly now?: () => number;
}

const UNREAD = "What this view keeps for you could not be read just now.";
const UNKEPT = "This value could not be kept just now.";
const NOT_YET = "The host has not answered yet, so this value is not kept yet.";
const TOO_MANY = "This view asked to keep too many values at once, so this one was not kept.";

/* A viewer's writes to a view in the last minute, per place they go: drawn again, it is the same view. */
const writesAt = new WeakMap<ViewerState, Map<string, number[]>>();
function writesOf(state: ViewerState, viewer: string, view: string): number[] {
  const views = writesAt.get(state) ?? new Map<string, number[]>();
  writesAt.set(state, views);
  const key = `${viewer}\u0000${view}`;
  const times = views.get(key) ?? [];
  views.set(key, times);
  return times;
}

/** One key's writes: the one under way, whether it is past its time, and the newest waiting to follow it. */
interface Line {
  late: boolean;
  landedLate: boolean;
  next?: { readonly value: string | null; told: ((answer: ViewerStateAnswer) => void)[] };
  readonly gets: (() => void)[];
}

/**
 * ONE VIEW'S VALUES, AS ONE DRAWING OF IT HOLDS THEM: read once from where they
 * are kept, handed at draw time, each write judged, and held here only once the
 * host has kept it. A view asks by key alone: which view it is is said here.
 *
 * ONE WRITE AT A TIME TO A KEY. A write cannot be called back, so one past its
 * time may still land: the view is told "not kept yet", which stays true, and
 * nothing is sent to that key until it settles. Only then does the newest value
 * asked for go, once, so an older write can never land over a newer, and what the
 * host ends holding is what the view last asked for. Resending the newest as
 * soon as it is asked and again after a late landing would do the same with two
 * writes and an interval where the host holds the older one anyway. What it
 * costs: a host that never answers a write never gets a later value for that
 * key, which then lasts only as long as this drawing, and the view has been told
 * so. A host's silence costs a key's asks one `writeMs`, then none: they are
 * answered at once, and other keys go on as they were.
 */
export function createMine({ view, viewer = "", state, onRefused, onLate, readMs = 1_500, writeMs = 10_000, now = Date.now }: MineOptions): Mine {
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
  const lines = new Map<string, Line>();
  const writes = writesOf(state, viewer, view);

  const drain = (line: Line) => {
    for (const get of line.gets.splice(0)) get();
  };
  /** What became of the line once what is under way has settled: the newest waiting goes, or the key is free. */
  const follow = (key: string, line: Line) => {
    line.late = false;
    const next = line.next;
    line.next = undefined;
    if (next) return send(key, line, next.value, next.told);
    lines.delete(key);
    drain(line);
    if (line.landedLate) onLate?.();
  };
  function send(key: string, line: Line, value: string | null, told: readonly ((answer: ViewerStateAnswer) => void)[]): void {
    const at = now();
    while (writes.length > 0 && writes[0]! <= at - 60_000) writes.shift();
    if (writes.length >= MINE_WRITES_A_MINUTE) {
      const over = refused(TOO_MANY);
      for (const one of told) one(over);
      return follow(key, line);
    }
    writes.push(at);
    let answered = false;
    const timer = setTimeout(() => {
      /* Told once, now, and true: what happens later is said by what the view is next handed. */
      answered = true;
      line.late = true;
      const notYet = refused(NOT_YET);
      for (const one of [...told, ...(line.next?.told ?? [])]) one(notYet);
      if (line.next) line.next.told = [];
      drain(line);
    }, writeMs);
    void Promise.resolve()
      .then(() => state.write(view, key, value))
      .catch(() => undefined) // A host's own error can name what it holds: the view is told only that it was not kept.
      .then((said) => {
        clearTimeout(timer);
        const kept = said?.ok === true;
        if (kept) {
          if (value === null) held.delete(key);
          else held.set(key, value);
        }
        const sentence = said && !said.ok && typeof said.sentence === "string" && said.sentence ? said.sentence : UNKEPT;
        if (answered) {
          if (kept) line.landedLate = true;
          else onRefused?.(sentence);
        } else {
          const answer: ViewerStateAnswer = kept ? { ok: true } : refused(sentence);
          for (const one of told) one(answer);
        }
        follow(key, line);
      });
  }

  return {
    ready,
    values: () => Object.fromEntries(held),
    get: (key) =>
      ready.then(
        () =>
          new Promise<GuestMineAnswer<string | null>>((resolve) => {
            const answer = () => {
              if (!read) return resolve({ ok: false, sentence: UNREAD });
              const line = lines.get(key);
              if (!line) return resolve({ ok: true, value: held.get(key) ?? null });
              if (line.late) return resolve({ ok: false, sentence: NOT_YET });
              line.gets.push(answer);
            };
            answer();
          }),
      ),
    set(key, value) {
      const refusal = mineRefusal(key, value);
      if (refusal) return Promise.resolve(refused(refusal));
      const asked = key as string;
      const wanted = value as string | null;
      return ready.then(
        () =>
          new Promise<ViewerStateAnswer>((resolve) => {
            if (!read) return resolve(refused(`${UNREAD} So this value was not kept.`));
            const line = lines.get(asked);
            if (!line) {
              const opened: Line = { late: false, landedLate: false, gets: [] };
              lines.set(asked, opened);
              return send(asked, opened, wanted, [resolve]);
            }
            /* The newest waits for what is under way, and anything older that waited with it is answered as the newest is. */
            line.next = { value: wanted, told: line.late ? [] : [...(line.next?.told ?? []), resolve] };
            if (line.late) resolve(refused(NOT_YET));
          }),
      );
    },
  };
}
