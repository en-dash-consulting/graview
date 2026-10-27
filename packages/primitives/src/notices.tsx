import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { createContext, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";

/**
 * A HOST SPEAKS IN THE APP'S OWN NOTICES (FR-75).
 *
 * Graview Cloud said "a newer version is available", "offline — changes
 * will be sent when you reconnect", "held while a repair is checked", a
 * conflict with two choices and a refusal's sentence as furniture of its
 * own: elements fixed over the app on a stacking number of a thousand, in a copy of the
 * framework's floating panel kept in step by hand. A notice is the app's
 * to draw. A toast says something and goes; a banner stays until it is
 * cleared; either may carry the acts that answer it. They are drawn in the
 * floating panel's look, on the ladder's top rung — in the top layer,
 * raised again over any popover that opens after them — over the picture
 * they are about and never in its flow (FR-133): banners at its top, just
 * under the bar, and toasts at its foot, at the middle on a phone and the
 * left on a desk, clear of what stands there. Each is said aloud:
 * politely, or as an alert when its tone is bad.
 */
export type NoticeTone = "info" | "good" | "warn" | "bad";

export interface NoticeAction {
  readonly label: string;
  /** A press: told, and the notice closes. */
  readonly onSelect?: () => void;
  /** A link: followed (`target` where it opens elsewhere), and the notice closes. */
  readonly href?: string;
  readonly target?: string;
  /**
   * The keys that do the same from anywhere, as `aria-keyshortcuts` names
   * them ("Meta+Z Control+Z"): said on the control, to a screen reader and
   * in its title, so a person reading the offer learns the key once.
   */
  readonly keys?: string;
}

export interface Notice {
  /** A toast says something and goes; a banner stays until it is cleared. */
  readonly kind: "toast" | "banner";
  readonly sentence: string;
  /** `info` (the default), `good`, `warn` or `bad` — a bad one is said as an alert. */
  readonly tone?: NoticeTone;
  /** What answers it. A toast with an act waits for one rather than going by itself. */
  readonly action?: NoticeAction;
  readonly actions?: readonly NoticeAction[];
  /** A notice said again under the same id takes the place of the one before. */
  readonly id?: string;
  /** How long a toast stays, in milliseconds; `false` keeps it until it is cleared. Default 6000, or `false` with an act. */
  readonly timeout?: number | false;
  /** A refusal's code, when the sentence has one: handed on with a host's "Report this" (FR-237). */
  readonly code?: string;
  /**
   * Who said it. The app's own surfaces speak on the board `frameworkVoice`
   * hands them, which says `"framework"` here; a host's own notices, said
   * through the handle or on its own board, say nothing. A host's "Report
   * this" answers only what the framework said (FR-237).
   */
  readonly from?: "framework";
}

/**
 * WHAT A HOST'S "REPORT THIS" IS HANDED (FR-237): the toast's words, a
 * refusal's code when it had one, the place the reader is on and the record
 * when there is one, and the framework's version.
 */
export interface NoticeReport {
  readonly message: string;
  readonly code?: string;
  readonly place?: string;
  readonly record?: string;
  readonly version: string;
}

/**
 * A HOST'S "REPORT THIS" (FR-237), as the notices draw it: `tell` is the
 * host's hook, and `where` says the place and the record the reader is on
 * when a report is pressed.
 */
export interface NoticeReporting {
  readonly tell: (report: NoticeReport) => void;
  readonly where: () => Pick<NoticeReport, "place" | "record">;
}

export interface NoticeHandle {
  readonly id: string;
  /** Clears it. */
  dismiss(): void;
  /** Changes what it says, its tone or its acts, in place. */
  update(change: Partial<Omit<Notice, "kind" | "id">>): void;
}

/** A notice as the board holds it. */
export interface HeldNotice extends Notice {
  readonly id: string;
  /** Counts each time it is said, so a sentence said twice is announced twice. */
  readonly said: number;
}

export interface NoticeBoard {
  notify(notice: Notice): NoticeHandle;
  dismiss(id: string): void;
  /**
   * Whether the toasts are held — a pointer or the keyboard on them — asked
   * when a toast's time comes: held, it stands its whole time again, so none
   * goes from under either (FR-152). Set by what draws them.
   */
  hold?(held: () => boolean): void;
  list(): readonly HeldNotice[];
  subscribe(listener: () => void): () => void;
}

/** The time a toast with nothing to answer stays. */
export const TOAST_MS = 6000;

/**
 * THE BOARD AS THE APP'S OWN SURFACES SPEAK ON IT: what they say is the
 * framework's, so a host's "Report this" can answer it (FR-237) and leave
 * the host's own notices alone. The Shell and the embeds hand this to the
 * context; the host's handle speaks on the board itself.
 */
export function frameworkVoice(board: NoticeBoard): NoticeBoard {
  return { ...board, notify: (notice) => board.notify({ ...notice, from: "framework" }) };
}

/** Where a report says the scene's reader is: the overview, and the record the scene is focused on — a district (`aggregate:`, `kind:`) is no record. */
export const sceneReportWhere = (focusId: string | null | undefined): Pick<NoticeReport, "place" | "record"> => ({
  place: "overview",
  ...(focusId && !/^(aggregate|kind):/.test(focusId) ? { record: focusId } : {}),
});

/** One board of notices: what `notify` writes and `Notices` draws. */
export function createNoticeBoard(): NoticeBoard {
  let held: readonly HeldNotice[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let holding: (() => boolean) | undefined;
  const tell = () => {
    for (const listener of [...listeners]) listener();
  };
  const time = (notice: HeldNotice) => {
    clearTimeout(timers.get(notice.id));
    timers.delete(notice.id);
    if (notice.kind !== "toast") return;
    const acts = (notice.actions?.length ?? 0) + (notice.action ? 1 : 0);
    const after = notice.timeout ?? (acts > 0 ? false : TOAST_MS);
    if (after === false) return;
    timers.set(notice.id, setTimeout(() => (holding?.() ? time(notice) : dismiss(notice.id)), after));
  };
  const dismiss = (id: string) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    if (!held.some((one) => one.id === id)) return;
    held = held.filter((one) => one.id !== id);
    tell();
  };
  const put = (notice: HeldNotice) => {
    held = held.some((one) => one.id === notice.id) ? held.map((one) => (one.id === notice.id ? notice : one)) : [...held, notice];
    time(notice);
    tell();
  };
  return {
    notify(notice) {
      const id = notice.id ?? `notice-${++sequence}`;
      put({ ...notice, id, said: ++sequence });
      return {
        id,
        dismiss: () => dismiss(id),
        update: (change) => {
          const now = held.find((one) => one.id === id);
          if (now) put({ ...now, ...change, id, kind: now.kind, said: change.sentence !== undefined && change.sentence !== now.sentence ? ++sequence : now.said });
        },
      };
    },
    dismiss,
    hold(asked) {
      holding = asked;
    },
    list: () => held,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * SAID ALOUD, as each notice arrives: politely, or as an alert when its
 * tone is bad. Two live regions that are always there, so a reader is told
 * even when the notice itself is drawn in the top layer, and emptied a beat
 * before each sentence so the same words said twice are said twice.
 */
function Spoken({ notices }: { readonly notices: readonly HeldNotice[] }) {
  const latest = notices.reduce<HeldNotice | undefined>((last, one) => (!last || one.said > last.said ? one : last), undefined);
  const [polite, setPolite] = useState("");
  const [alarm, setAlarm] = useState("");
  const heard = useRef(0);
  useEffect(() => {
    if (!latest || latest.said === heard.current) return;
    heard.current = latest.said;
    const bad = latest.tone === "bad";
    (bad ? setAlarm : setPolite)("");
    const soon = setTimeout(() => (bad ? setAlarm : setPolite)(latest.sentence), 50);
    return () => clearTimeout(soon);
  }, [latest]);
  return (
    <>
      <div role="status" aria-live="polite" data-testid="notices-said" style={VISUALLY_HIDDEN}>
        {polite}
      </div>
      <div role="alert" data-testid="notices-alarm" style={VISUALLY_HIDDEN}>
        {alarm}
      </div>
    </>
  );
}

/**
 * THE BOARD THE APP SPEAKS ON, for what is drawn under it: the seat says
 * "Kept “X” as a lens" there, with Take back. Set by the Shell and the
 * embed; absent, a surface says it where it is instead.
 */
export const NoticeBoardContext = createContext<NoticeBoard | null>(null);

/**
 * The notices on a board, drawn over the picture `anchor` returns (the
 * embed's face, the Shell's scene): banners at its top, toasts at its foot.
 */
export function Notices({ board, anchor, report }: { readonly board: NoticeBoard; readonly anchor: () => HTMLElement | null; readonly report?: NoticeReporting | undefined }) {
  const notices = useSyncExternalStore(board.subscribe, board.list, board.list);
  // Fetched once the page is idle, so the first notice is drawn as it is said.
  useEffect(() => whenIdle(stacks.prefetch), []);
  return (
    <>
      {/* Its own boundary: a notice still arriving holds back nothing else on the page. */}
      {notices.length > 0 ? (
        <Suspense fallback={null}>
          <Stacks notices={notices} anchor={anchor} board={board} {...(report ? { report } : {})} />
        </Suspense>
      ) : null}
      <Spoken notices={notices} />
    </>
  );
}

/*
 * WHAT DRAWS A NOTICE, fetched with the first (the headroom after 0.1.29):
 * most pages are drawn and read without one, and the board, the two live
 * regions that say each aloud and this door are all a page needs before.
 */
const stacks = lazyModule(retryingImport(() => import("./notice-stacks.js")));
/** Fetch what draws a notice now, as `preload` does: resolved when it is here or did not arrive. */
export const fetchNotices = (): Promise<void> => stacks.load().then(
  () => undefined,
  () => undefined,
);
const Stacks = stacks.part((drawn, props: Parameters<typeof import("./notice-stacks.js").NoticeStacks>[0]) => <drawn.NoticeStacks {...props} />, { quiet: true });

/** When the page is idle and online — or, where the browser cannot say when it is idle, a little after it has drawn. */
function whenIdle(then: () => void): () => void {
  const go = () => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) then();
  };
  const idle = globalThis as { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (idle.requestIdleCallback) {
    const asked = idle.requestIdleCallback(go, { timeout: 5000 });
    return () => idle.cancelIdleCallback?.(asked);
  }
  const later = setTimeout(go, 2500);
  return () => clearTimeout(later);
}
