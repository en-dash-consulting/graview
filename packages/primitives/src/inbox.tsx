import { brokenWords, type AnySchema, type Principal, type Store, type Violation } from "@graview/core";
import type { HostNotification } from "@graview/react/provider";
import { POPOVER_STYLE, useGraph, useGraview, usePopover, useViolations } from "@graview/react/provider";
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
 *   For you — Needs you, what asks something of this person: what people
 *             proposed, what the app's own actor suggests, the rules broken
 *             that they may fix, what the host marks as needing them; and
 *             Updates, the rest (Roadmap f-inbox-needs-you-first);
 *   Activity — what has happened, each change with its way back, and the
 *             agent's seat where the face gives one;
 *   Your asks — what this person asked the app (the quick ask and the
 *             inline AI's kept interactions, `ai.interactions`), each with
 *             what became of it. Not drawn where the host says AI is off.
 *
 * The count is what needs this person, and nothing else: Activity asks
 * nothing of anyone, so its count is on its own tab. It opens on For you
 * whenever something there needs them, wherever it was left. Nothing is
 * drawn while none of the three has anything. The tabs and what they hold
 * are fetched with the bar's panes as the bell is first pressed
 * (`inbox-pane.tsx`).
 */

export type { InboxTab } from "./inbox-pane.js";

const Pane = barPanes.part((panes, props: InboxPaneProps) => <panes.InboxPane {...props} />, { what: "The inbox" });

const NO_CALLS: readonly ToolCall[] = [];
const NO_NOTIFICATIONS: readonly HostNotification[] = [];

/** A count as a badge says it: up to 99, then "99+". */
export const badgeCount = (count: number): string => (count > 99 ? "99+" : String(count));

/** What the bell is called, its count said in words, and the rules broken among it: "Inbox — 3 need you: 1 rule broken". */
export function inboxWords(needs: number, broken: string): string {
  if (needs === 0) return "Inbox";
  return `Inbox — ${needs} ${needs === 1 ? "needs" : "need"} you${broken ? `: ${broken}` : ""}`;
}

/**
 * THE RULES BROKEN THAT THIS SEAT COULD DO SOMETHING ABOUT, and the others.
 * A rule asks something of whoever may take one of its fixes; a rule with
 * none, of whoever may change anything here. Whoever may not reads it under
 * Updates, and is not told it needs them. Asked as the fix's press would be.
 */
export function rulesFor(store: Store<AnySchema>, violations: readonly Violation[], principal: Principal): { readonly yours: readonly Violation[]; readonly others: readonly Violation[] } {
  const asks = (name: string, args?: Readonly<Record<string, unknown>>): boolean => {
    try {
      return store.permits({ name, args: (args ?? {}) as never }, principal).ok;
    } catch {
      return false;
    }
  };
  let mayAct: boolean | undefined;
  const yours: Violation[] = [];
  const others: Violation[] = [];
  for (const violation of violations) {
    const may = violation.repairs.length > 0 ? violation.repairs.some((repair) => asks(repair.mutation, repair.args)) : (mayAct ??= store.allMutations().some((act) => asks(act.name)));
    (may ? yours : others).push(violation);
  }
  return { yours, others };
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
  const violations = useViolations<AnySchema>();
  const rules = useMemo(() => rulesFor(store, violations, principal), [store, violations, principal]);
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
  // What needs this person: all the bell counts. A host's notice stands under Needs you while it is handed, and is counted while unread.
  const count = waiting + rules.yours.length + unread.filter((one) => one.needs).length;
  const needsYou = count > 0 || notifications.some((one) => one.needs);
  const popover = usePopover("inbox");
  const open = popover.open;
  /*
   * WHERE IT OPENS IS WORKED OUT, NOT KEPT: on For you while anything there
   * needs this person or is new to them, else on what has happened, so a tab
   * left last time is not where it opens next. Worked out until the tray has
   * said how many wait, which may be just after the press; then it holds, so
   * that what a person does there, or somebody else does, never moves the
   * tab from under them.
   */
  const [chosen, setChosen] = useState<InboxTab | null>(null);
  const [heard, setHeard] = useState(false);
  const landing: InboxTab = needsYou || unread.length > 0 || away ? "for-you" : activity.has ? "activity" : asks.length > 0 ? "asks" : "for-you";
  const tab: InboxTab = chosen ?? landing;
  const known = !tray || heard;
  useEffect(() => {
    if (!open) setChosen(null);
    else if (known) setChosen((was) => was ?? landing);
  }, [open, known, landing]);
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
  const counted = useCallback((next: number) => {
    setWaiting(next);
    setHeard(true);
  }, []);
  if (!(activity.has || tray || notifications.length > 0 || asks.length > 0 || violations.length > 0)) return null;
  const words = inboxWords(count, rules.yours.length > 0 ? brokenWords(rules.yours) : "");
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
        data-changes={activity.recent}
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
              choose={setChosen}
              asksOn={asksOn}
              counts={{ "for-you": count, activity: activity.recent, asks: asks.length }}
              notifications={notifications}
              rules={rules}
              asks={asks}
              tray={tray}
              waiting={waiting}
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
