import type { AnySchema } from "@graview/core";
import type { HostNotification } from "@graview/react/provider";
import { POPOVER_STYLE, useGraph, useGraview, usePopover } from "@graview/react/provider";
import type { ToolCall } from "@graview/tools";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { barPanes } from "./bar-panes-door.js";
import { SuggestedCount } from "./bar-suggested.js";
import type { InboxPaneProps, InboxTab } from "./inbox-pane.js";
import { useActivityHas } from "./workbench/activity.js";
import { useInteractions } from "./workbench/ai-feed.js";

/*
 * ONE INBOX ON THE BAR (Roadmap f-app-bar-calm).
 *
 * The bar said "25 Suggested" and "4 Activity" side by side, two words and
 * two counts for two lists a person reads as one: what is new here. They
 * are one tool now, the bar's one size — a bell with one count — that opens
 * three tabs:
 *
 *   For you — what waits on this person: what people proposed, what the
 *             app's own actor suggests, what was done while they were away,
 *             and what the host tells them (`notifications`);
 *   Activity — what has happened, each change with its way back, and the
 *             agent's seat where the face gives one;
 *   Your asks — what this person asked the app (the quick ask and the
 *             inline AI's kept interactions, `ai.interactions`), each with
 *             what became of it. Not drawn where the host says AI is off.
 *
 * The count is what waits for you and what has happened, as the two words
 * said it; the button's name says the two apart. Nothing is drawn while
 * none of the three has anything. The tabs and what they hold are fetched
 * with the bar's panes as the bell is first pressed (`inbox-pane.tsx`).
 */

export type { InboxTab } from "./inbox-pane.js";

const Pane = barPanes.part((panes, props: InboxPaneProps) => <panes.InboxPane {...props} />, { what: "The inbox" });

const NO_CALLS: readonly ToolCall[] = [];
const NO_NOTIFICATIONS: readonly HostNotification[] = [];

/** A count as a badge says it: up to 99, then "99+". */
export const badgeCount = (count: number): string => (count > 99 ? "99+" : String(count));

/** What the bell is called, its count said in words: "Inbox — 2 waiting for you, 4 changes". */
export function inboxWords(waiting: number, changes: number): string {
  const parts = [waiting > 0 ? `${waiting} waiting for you` : "", changes > 0 ? `${changes === 1 ? "1 change" : `${changes} changes`}` : ""].filter(Boolean);
  return parts.length > 0 ? `Inbox — ${parts.join(", ")}` : "Inbox";
}

export interface InboxProps {
  /** The calls a seat made, newest first (the scene's `useCallLog`). */
  readonly calls?: readonly ToolCall[];
  /** The seat the face gives an agent, held in Activity. */
  readonly seat?: ReactNode;
  /** Whether this browser remembers the edits; Activity says so, with the way back. */
  readonly remembers?: boolean;
}

export function Inbox({ calls = NO_CALLS, seat, remembers = false }: InboxProps) {
  const { store, principal, whileAway, notifications = NO_NOTIFICATIONS, onNotificationsSeen, ai } = useGraview<AnySchema>();
  const nodes = useGraph();
  const activity = useActivityHas({ calls, seat, remembers });
  const interactions = useInteractions();
  const asksOn = ai.off !== true;
  const asks = useMemo(() => (principal.id === undefined ? [] : interactions.filter((entry) => entry.by.id === principal.id || entry.by.onBehalfOf?.id === principal.id)), [interactions, principal.id]);
  // The tray is fetched once the log holds a suggestion, or the host said what was done while the reader was away.
  const suggests = useMemo(() => store.log.all().some((op) => op.suggests !== undefined && !op.withheld), [store, nodes]);
  const away = (whileAway?.tidied ?? 0) > 0;
  const tray = suggests || away;
  const [waiting, setWaiting] = useState(0);
  const unread = notifications.filter((one) => !one.read);
  const forYou = waiting + unread.length;
  const count = forYou + activity.recent;
  const popover = usePopover("inbox");
  const open = popover.open;
  const [tab, setTab] = useState<InboxTab>("activity");
  // Each open lands on what waits for you, where anything does; else what has happened.
  const opened = useRef(false);
  if (open && !opened.current) {
    opened.current = true;
    const first: InboxTab = forYou > 0 || away ? "for-you" : activity.has ? "activity" : asks.length > 0 ? "asks" : "for-you";
    if (first !== tab) setTab(first);
  }
  if (!open) opened.current = false;
  // The host is told which of its notifications this person has now been shown.
  const told = useRef("");
  useEffect(() => {
    if (!open || tab !== "for-you" || unread.length === 0 || !onNotificationsSeen) return;
    const ids = unread.map((one) => one.id);
    if (told.current === ids.join("\n")) return;
    told.current = ids.join("\n");
    onNotificationsSeen(ids);
  }, [open, tab, unread, onNotificationsSeen]);
  const close = useCallback(() => popover.setOpen(false), [popover]);
  const counted = useCallback((next: number) => setWaiting(next), []);
  if (!(activity.has || tray || notifications.length > 0 || asks.length > 0)) return null;
  const words = inboxWords(forYou, activity.recent);
  const reach = () => barPanes.prefetch();
  return (
    <div className="graview-bar-inbox" style={{ position: "relative" }}>
      {tray ? (
        <Suspense fallback={null}>
          <SuggestedCount onCount={counted} />
        </Suspense>
      ) : null}
      <button
        type="button"
        className="graview-bar-tool"
        data-testid="inbox-button"
        data-count={count}
        {...popover.trigger}
        onClick={popover.toggle}
        onPointerEnter={reach}
        onFocus={reach}
        aria-label={activity.running ? `${words} — an agent is working` : words}
        title={activity.running ? "Inbox — an agent is working" : words}
        {...(activity.running ? { "data-running": "" } : {})}
      >
        <BellMark />
        {count > 0 ? (
          <span className="graview-bar-badge" data-testid="inbox-count" aria-hidden="true">
            {badgeCount(count)}
          </span>
        ) : activity.running ? (
          <span className="graview-bar-badge" data-dot="" aria-hidden="true" />
        ) : null}
      </button>
      {/*
        * THE SEAT IS SEATED WHETHER OR NOT ACTIVITY IS SHOWN. Its body stands
        * in the city from the first frame, docked, and that needs the seat
        * mounted — so while Activity is not shown the seat is here, hidden,
        * and moves into Activity's row when it is.
        */}
      {(!open || tab !== "activity") && seat !== undefined ? (
        <div hidden data-testid="agent-seat-seated">
          {seat}
        </div>
      ) : null}
      {open ? (
        <section
          {...popover.pane}
          aria-label="Inbox"
          data-testid="inbox"
          data-graview-offstage=""
          data-tab={tab}
          tabIndex={-1}
          style={{
            ...POPOVER_STYLE,
            // Never wider than the page, and what it holds wraps rather than widening it (FR-226).
            width: "min(360px, calc(100vw - 16px))",
            maxHeight: "min(70vh, 520px)",
            overflowX: "hidden",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: 0,
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
            outline: "none",
          }}
        >
          <Suspense fallback={null}>
            <Pane
              tab={tab}
              choose={setTab}
              asksOn={asksOn}
              counts={{ "for-you": forYou, activity: activity.recent, asks: asks.length }}
              notifications={notifications}
              asks={asks}
              tray={tray}
              waits={forYou > 0 || away}
              activityHas={activity.has}
              calls={calls}
              remembers={remembers}
              close={close}
              {...(seat !== undefined ? { seat } : {})}
            />
          </Suspense>
        </section>
      ) : null}
    </div>
  );
}

/** A bell: the inbox's mark. */
function BellMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <path d="M4 11.25 V7.25 a4 4 0 0 1 8 0 V11.25 L13.25 12.5 H2.75 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 14 h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
