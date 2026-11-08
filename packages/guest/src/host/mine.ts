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
  /** This drawing has gone: a write it asked for still lands, and it hears no more. */
  dispose(): void;
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
const TOO_MANY_OPEN = "The host has not answered for too many values, so this one was not kept.";
/** The most keys a view may have writes open on at once, for a host that never answers: what a host's own caps would stop. */
const MOST_OPEN = 200;

/** One drawing of a view, as what it shares hears of it. */
interface Drawing {
  /** A value was kept: it holds it now. */
  landed(key: string, value: string | null): void;
  readonly onRefused: ((sentence: string) => void) | undefined;
  readonly onLate: (() => void) | undefined;
}

/** Somebody waiting to hear what became of a value: the drawing that asked, and its answer. */
interface Told {
  readonly drawing: Drawing;
  answer(answer: ViewerStateAnswer): void;
}

/** One key's writes: whether the one under way is past its time, the newest waiting to follow it, and who to tell once it is all settled. */
interface Line {
  late: boolean;
  next?: { readonly value: string | null; told: readonly Told[]; readonly writeMs: number };
  readonly gets: (() => void)[];
  readonly moved: Set<Drawing>;
}

/** What every drawing of a view shares, for one viewer, per place it is kept: a view drawn again is the same view. */
interface Shared {
  readonly writes: number[];
  readonly lines: Map<string, Line>;
  readonly drawings: Set<Drawing>;
}
const sharedAt = new WeakMap<ViewerState, Map<string, Shared>>();
function sharedOf(state: ViewerState, viewer: string, view: string): Shared {
  const views = sharedAt.get(state) ?? new Map<string, Shared>();
  sharedAt.set(state, views);
  const key = `${viewer}\u0000${view}`;
  const shared = views.get(key) ?? { writes: [], lines: new Map(), drawings: new Set() };
  views.set(key, shared);
  return shared;
}

/**
 * ONE VIEW'S VALUES, AS ONE DRAWING OF IT HOLDS THEM: read once from where they
 * are kept, handed at draw time, each write judged, and held here only once the
 * host has kept it. A view asks by key alone: which view it is is said here.
 *
 * ONE WRITE AT A TIME TO A KEY, ON THIS PAGE. A write cannot be called back, so
 * one past its time may still land: the view is told "not kept yet", which stays
 * true, and nothing is sent to that key until it settles. Only then does the
 * newest value asked for go, once, so an older write can never land over a
 * newer, and what the host ends holding is what the view last asked for. The
 * line belongs to the view, not the drawing: a page draws a view again when its
 * definition, its store or its seat moves, with a write of the last drawing
 * still on its way, and the new drawing joins that line and hears what lands.
 * Resending the newest as soon as it is asked and again after a late landing
 * would do the same with two writes and an interval where the host holds the
 * older one anyway. Another tab is another line: two tabs can only be held
 * apart by the host, by the order it takes writes in.
 *
 * What it costs: a host that never answers a write never gets a later value for
 * that key. That value is in no drawing's values and `get` rejects: it waits
 * here, sent if the host ever answers, gone with the page, and the view has been
 * told it is not kept. A host's silence costs a key's asks one `writeMs`, then
 * none: they are answered at once, and other keys go on, up to `MOST_OPEN`.
 */
export function createMine({ view, viewer = "", state, onRefused, onLate, readMs = 1_500, writeMs = 10_000, now = Date.now }: MineOptions): Mine {
  let held = new Map<string, string>();
  let read = false;
  let waited = false;
  /* What landed while this drawing was still reading: newer than what it will read. */
  const landedWhileReading = new Map<string, string | null>();
  const hold = (key: string, value: string | null) => {
    if (value === null) held.delete(key);
    else held.set(key, value);
  };
  const shared = sharedOf(state, viewer, view);
  const { writes, lines, drawings } = shared;
  const drawing: Drawing = {
    landed(key, value) {
      if (read) hold(key, value);
      else landedWhileReading.set(key, value);
    },
    onRefused,
    onLate,
  };
  drawings.add(drawing);
  const refused = (sentence: string): ViewerStateAnswer => {
    onRefused?.(sentence);
    return { ok: false, sentence };
  };
  const reading = (async () => {
    try {
      held = new Map(Object.entries(await state.read(view)).filter(([, value]) => typeof value === "string"));
      for (const [key, value] of landedWhileReading) hold(key, value);
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
            const told: Told = { drawing, answer: resolve };
            const line = lines.get(asked);
            if (!line) {
              if (lines.size >= MOST_OPEN) return resolve(refused(TOO_MANY_OPEN));
              /* Only what opens a line is held to the rate: what follows was asked for inside it, and the view was told it would go. */
              const at = now();
              while (writes.length > 0 && writes[0]! <= at - 60_000) writes.shift();
              if (writes.length >= MINE_WRITES_A_MINUTE) return resolve(refused(TOO_MANY));
              writes.push(at);
              const opened: Line = { late: false, gets: [], moved: new Set() };
              lines.set(asked, opened);
              return send(state, view, shared, asked, opened, wanted, [told], writeMs);
            }
            /* The newest waits for what is under way, and anything older that waited with it is answered as the newest is. */
            line.next = { value: wanted, told: line.late ? [] : [...(line.next?.told ?? []), told], writeMs };
            if (line.late) resolve(refused(NOT_YET));
          }),
      );
    },
    dispose() {
      drawings.delete(drawing);
    },
  };
}

/** Say one thing to whoever waits: each answered, each drawing told of a refusal once. */
function tell(told: readonly Told[], answer: ViewerStateAnswer): void {
  if (!answer.ok) for (const one of new Set(told.map((waiting) => waiting.drawing))) one.onRefused?.(answer.sentence);
  for (const waiting of told) waiting.answer(answer);
}

/** Write one value, and once it has settled, the newest that waited behind it; or free the key, and tell the drawings what moved. */
function send(state: ViewerState, view: string, shared: Shared, key: string, line: Line, value: string | null, told: readonly Told[], writeMs: number): void {
  let past = false;
  const timer = setTimeout(() => {
    /* Told once, now, and true: what happens later is said by what the view is next handed. */
    past = true;
    line.late = true;
    tell([...told, ...(line.next?.told ?? [])], { ok: false, sentence: NOT_YET });
    if (line.next) line.next.told = [];
    for (const get of line.gets.splice(0)) get();
  }, writeMs);
  void Promise.resolve()
    .then(() => state.write(view, key, value))
    .catch(() => undefined) // A host's own error can name what it holds: the view is told only that it was not kept.
    .then((said) => {
      clearTimeout(timer);
      const kept = said?.ok === true;
      const sentence = said && !said.ok && typeof said.sentence === "string" && said.sentence ? said.sentence : UNKEPT;
      if (kept) {
        /* Every drawing holds it, and is pushed it, but one told just now that it was kept. */
        const answered = new Set(past ? [] : told.map((waiting) => waiting.drawing));
        for (const drawing of shared.drawings) {
          drawing.landed(key, value);
          if (!answered.has(drawing)) line.moved.add(drawing);
        }
      }
      if (!past) tell(told, kept ? { ok: true } : { ok: false, sentence });
      else if (!kept) for (const drawing of shared.drawings) drawing.onRefused?.(sentence);
      line.late = false;
      const next = line.next;
      line.next = undefined;
      if (next) return send(state, view, shared, key, line, next.value, next.told, next.writeMs);
      shared.lines.delete(key);
      for (const get of line.gets.splice(0)) get();
      for (const drawing of line.moved) if (shared.drawings.has(drawing)) drawing.onLate?.();
    });
}
