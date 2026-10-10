import { layer } from "@graview/core";
import { inTopLayer, raiseOverPopovers } from "@graview/react/provider";
import { createContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { FOOT_MOVED, placeAtTheFoot, placeAtTheTop } from "./notice-place.js";
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

const TONE: Record<NoticeTone, string> = {
  info: "var(--graview-accent)",
  good: "var(--graview-good)",
  warn: "var(--graview-warn)",
  bad: "var(--graview-bad)",
};

/** A stack of notices in the top layer, placed at the top or the foot of the picture it is about. */
function Stack({ notices, at, anchor, board }: { readonly notices: readonly HeldNotice[]; readonly at: "top" | "foot"; readonly anchor: () => HTMLElement | null; readonly board: NoticeBoard }) {
  const pane = useRef<HTMLDivElement | null>(null);
  const shown = notices.length > 0;
  useLayoutEffect(() => {
    const element = pane.current;
    if (!shown || !element) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over every rail where the top layer is not there.
      }
    }
    const place = () => (at === "top" ? placeAtTheTop : placeAtTheFoot)(element, anchor());
    place();
    // Held while pointed at or in the keyboard's hands: no toast goes from under either (FR-152).
    if (at === "foot") board.hold?.(() => element.matches(":hover, :focus-within"));
    const unraise = raiseOverPopovers(element);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    // Placed again when what stands at the foot comes, moves or goes, and when a notice joins the stack.
    if (at === "foot") addEventListener(FOOT_MOVED, place);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(element);
    return () => {
      unraise();
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      removeEventListener(FOOT_MOVED, place);
      if (element.isConnected && inTopLayer(element)) {
        try {
          element.hidePopover();
        } catch {
          // Gone already.
        }
      }
    };
  }, [shown, at, anchor, board]);
  if (!shown) return null;
  return (
    <div
      ref={pane}
      popover="manual"
      role="region"
      aria-label={at === "top" ? "Notices" : "Messages"}
      data-testid={at === "top" ? "notices-banners" : "notices-toasts"}
      data-graview-offstage=""
      style={{
        position: "fixed",
        inset: "auto",
        margin: 0,
        padding: 0,
        border: "none",
        background: "none",
        overflow: "visible",
        zIndex: layer("toast"),
        width: "max-content",
        // Its own height: under the popover's `fit-content`, WebKit stands a grid as tall as the screen.
        height: "auto",
        maxWidth: "min(560px, calc(100vw - 32px))",
        display: "grid",
        gap: 8,
        color: "var(--graview-ink)",
      }}
    >
      {notices.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} board={board} />
      ))}
    </div>
  );
}

function NoticeCard({ notice, board }: { readonly notice: HeldNotice; readonly board: NoticeBoard }) {
  const tone = notice.tone ?? "info";
  const acts = [...(notice.action ? [notice.action] : []), ...(notice.actions ?? [])];
  const close = () => board.dismiss(notice.id);
  return (
    <div
      data-testid="notice"
      data-kind={notice.kind}
      data-tone={tone}
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 12px",
        padding: notice.kind === "banner" ? "8px 10px 8px 14px" : "10px 12px 10px 14px",
        borderRadius: "var(--graview-radius, 12px)",
        borderTop: "1px solid var(--graview-edge)",
        borderRight: "1px solid var(--graview-edge)",
        borderBottom: "1px solid var(--graview-edge)",
        borderLeft: `3px solid ${TONE[tone]}`,
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        fontSize: "0.875rem",
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, flex: "0 0 auto", background: TONE[tone] }} />
      <span style={{ flex: "1 1 16rem", minWidth: 0 }}>{notice.sentence}</span>
      {acts.length > 0 ? (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {acts.map((act, index) =>
            act.href !== undefined ? (
              <a
                key={act.label}
                href={act.href}
                {...(act.target ? { target: act.target, rel: "noopener" } : {})}
                data-testid="notice-action"
                onClick={() => {
                  act.onSelect?.();
                  close();
                }}
                style={{ ...ACT, ...(index === 0 ? FIRST : {}) }}
              >
                {act.label}
              </a>
            ) : (
              <button
                key={act.label}
                type="button"
                data-testid="notice-action"
                onClick={() => {
                  close();
                  act.onSelect?.();
                }}
                style={{ ...ACT, ...(index === 0 ? FIRST : {}) }}
              >
                {act.label}
              </button>
            ),
          )}
        </span>
      ) : null}
      <button type="button" data-testid="notice-dismiss" aria-label={`Dismiss: ${notice.sentence}`} title="Dismiss" onClick={close} style={DISMISS}>
        ×
      </button>
    </div>
  );
}

const ACT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "2px 12px",
  borderRadius: 9,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  font: "inherit",
  fontWeight: 500,
  textDecoration: "none",
  cursor: "pointer",
};

/** The first act is the one the notice asks for. */
const FIRST: CSSProperties = { background: "var(--graview-accent)", borderColor: "var(--graview-accent)", color: "var(--graview-accent-ink)" };

const DISMISS: CSSProperties = {
  minWidth: 28,
  minHeight: 28,
  padding: 0,
  border: "none",
  background: "none",
  boxShadow: "none",
  color: "var(--graview-ink-muted)",
  fontSize: "1rem",
  cursor: "pointer",
};

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
export function Notices({ board, anchor }: { readonly board: NoticeBoard; readonly anchor: () => HTMLElement | null }) {
  const notices = useSyncExternalStore(board.subscribe, board.list, board.list);
  return (
    <>
      <Stack notices={notices.filter((one) => one.kind === "banner")} at="top" anchor={anchor} board={board} />
      <Stack notices={notices.filter((one) => one.kind === "toast")} at="foot" anchor={anchor} board={board} />
      <Spoken notices={notices} />
    </>
  );
}
