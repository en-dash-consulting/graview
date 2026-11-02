import type { AiInteraction } from "@graview/core/catalog";
import type { HostNotification } from "@graview/react/provider";
import type { ToolCall } from "@graview/tools";
import { Suspense, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { SuggestedList } from "./bar-suggested.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { ActivityFeed, InteractionRow, UndoTurn } from "./workbench/activity.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * WHAT THE INBOX OPENS TO (Roadmap f-app-bar-calm): its three tabs and
 * what each holds, fetched with the bar's panes when the bell is first
 * pressed — the bell, its count and the seat it keeps are the bar's
 * (`inbox.tsx`); a page whose inbox is never opened carries none of this.
 */

/** Which tab the inbox shows. */
export type InboxTab = "for-you" | "activity" | "asks";

const TABS: readonly { readonly tab: InboxTab; readonly label: string }[] = [
  { tab: "for-you", label: "For you" },
  { tab: "activity", label: "Activity" },
  { tab: "asks", label: "Your asks" },
];

const INBOX_CSS = `
.graview-inbox-tabs{display:flex;gap:4px;padding:6px 8px 0;border-bottom:1px solid var(--graview-edge);position:sticky;top:0;background:var(--graview-float)}
.graview-inbox-tabs button{display:inline-flex;align-items:center;gap:6px;min-height:34px;margin:0 0 -1px;padding:0 8px;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;box-shadow:none;font:inherit;font-size:.8125rem;font-weight:500;white-space:nowrap;color:var(--graview-ink-muted);cursor:pointer}
.graview-inbox-tabs button[aria-selected=true]{color:var(--graview-ink);font-weight:600;border-bottom-color:var(--graview-accent)}
.graview-inbox-tab-count{font-size:.6875rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--graview-ink-faint)}
.graview-inbox-row{display:grid;gap:2px;width:100%;box-sizing:border-box;padding:7px 8px;border:0;border-radius:7px;background:none;box-shadow:none;font:inherit;font-size:.8125rem;line-height:1.4;text-align:left;text-decoration:none;color:var(--graview-ink)}
:is(a,button).graview-inbox-row{cursor:pointer}
:is(a,button).graview-inbox-row:hover{background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-inbox-unread{flex:none;width:7px;height:7px;border-radius:50%;background:var(--graview-accent);transform:translateY(-1px)}`;

/** A count as a badge says it: up to 99, then "99+". */
const badgeCount = (count: number): string => (count > 99 ? "99+" : String(count));

export interface InboxPaneProps {
  readonly tab: InboxTab;
  readonly choose: (tab: InboxTab) => void;
  /** Whether "Your asks" is offered: not where the host says AI is off. */
  readonly asksOn: boolean;
  readonly counts: { readonly "for-you": number; readonly activity: number; readonly asks: number };
  readonly notifications: readonly HostNotification[];
  readonly asks: readonly AiInteraction[];
  /** Whether the tray may hold anything: a suggestion in the log, or what was done while the reader was away. */
  readonly tray: boolean;
  /** Whether For you holds anything to say. */
  readonly waits: boolean;
  readonly activityHas: boolean;
  readonly calls: readonly ToolCall[];
  readonly seat?: ReactNode;
  readonly remembers: boolean;
  readonly close: () => void;
}

export function InboxPane({ tab, choose, asksOn, counts, notifications, asks, tray, waits, activityHas, calls, seat, remembers, close }: InboxPaneProps) {
  const tabs = useRef<HTMLDivElement>(null);
  const id = useId();
  const shown = TABS.filter((one) => one.tab !== "asks" || asksOn);
  const focusTab = (which: InboxTab) => requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>(`[data-inbox-tab="${which}"]`)?.focus());
  // Arrived after the pane opened, the keyboard goes on from the pane to the tab it shows.
  useEffect(() => {
    const pane = tabs.current?.parentElement;
    if (pane && document.activeElement === pane) tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, []);
  // Arrows move between the tabs, as a tab list's do; Home and End to its ends.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = shown.findIndex((one) => one.tab === tab);
    const to = event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? shown.length - 1 : null;
    if (to === null) return;
    event.preventDefault();
    const next = shown[(to + shown.length) % shown.length]!.tab;
    choose(next);
    focusTab(next);
  };
  const toActivity = () => {
    choose("activity");
    focusTab("activity");
  };
  return (
    <>
      <style>{INBOX_CSS}</style>
      <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>Inbox</h2>
      <div ref={tabs} role="tablist" aria-label="Inbox" className="graview-inbox-tabs" onKeyDown={onTabKey}>
        {shown.map((one) => {
          const chosen = one.tab === tab;
          const n = counts[one.tab];
          return (
            <button
              key={one.tab}
              type="button"
              role="tab"
              id={`${id}-${one.tab}`}
              data-testid={`inbox-tab-${one.tab}`}
              data-inbox-tab={one.tab}
              aria-selected={chosen}
              aria-controls={`${id}-${one.tab}-panel`}
              tabIndex={chosen ? 0 : -1}
              onClick={() => choose(one.tab)}
            >
              {one.label}
              {n > 0 ? <span className="graview-inbox-tab-count">{badgeCount(n)}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}`} data-testid={`inbox-panel-${tab}`} style={{ display: "flex", flexDirection: "column", gap: 9, padding: 12, minWidth: 0 }}>
        {tab === "for-you" ? (
          <>
            <Notifications notifications={notifications} close={close} />
            {tray ? (
              <Suspense fallback={null}>
                <SuggestedList close={close} done={toActivity} />
              </Suspense>
            ) : null}
            {waits || notifications.length > 0 ? null : <Empty>Nothing waits for you.</Empty>}
          </>
        ) : tab === "activity" ? (
          <div data-testid="activity" aria-label="Activity" style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
            <ActivityFeed calls={calls} remembers={remembers} close={close} headed={false} {...(seat !== undefined ? { seat } : {})} />
            {activityHas ? null : <Empty>Nothing has happened here yet.</Empty>}
          </div>
        ) : (
          <Asks asks={asks} />
        )}
      </div>
    </>
  );
}

/** A tab with nothing in it, said in a line. */
function Empty({ children }: { readonly children: ReactNode }) {
  return (
    <p data-testid="inbox-empty" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
      {children}
    </p>
  );
}

/** When a notification came, said as a day and a time. */
function when(at: string | undefined): string {
  if (!at) return "";
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The host's notifications: each a line, unread ones marked, a link or a press where the host gives one. */
function Notifications({ notifications, close }: { readonly notifications: readonly HostNotification[]; readonly close: () => void }) {
  if (notifications.length === 0) return null;
  return (
    <ol data-testid="inbox-notifications" aria-label="From the host" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, minWidth: 0 }}>
      {notifications.map((one) => {
        const words = (
          <>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              {one.read ? null : <span className="graview-inbox-unread" aria-hidden="true" />}
              <span style={{ fontWeight: one.read ? 400 : 600, overflowWrap: "anywhere" }}>{one.title}</span>
              {one.read ? null : <span style={VISUALLY_HIDDEN}>, unread</span>}
            </span>
            {one.body ? <span style={{ color: "var(--graview-ink-muted)", overflowWrap: "anywhere" }}>{one.body}</span> : null}
            {when(one.at) ? <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>{when(one.at)}</span> : null}
          </>
        );
        const Row = (one.href !== undefined ? "a" : one.onSelect ? "button" : "div") as "a";
        return (
          <li key={one.id}>
            <Row
              className="graview-inbox-row"
              data-testid="inbox-notification"
              {...(one.read ? {} : { "data-unread": "" })}
              {...(one.href !== undefined ? { href: one.href, ...(one.target ? { target: one.target, rel: "noopener" } : {}) } : one.onSelect ? { type: "button" as const } : {})}
              {...(one.href !== undefined || one.onSelect
                ? {
                    onClick: () => {
                      one.onSelect?.();
                      close();
                    },
                  }
                : {})}
            >
              {words}
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

/** What this person asked the app, newest first, each with what became of it and its way back. */
function Asks({ asks }: { readonly asks: readonly AiInteraction[] }) {
  if (asks.length === 0) return <Empty>What you ask the app is kept here, with what came of it.</Empty>;
  return (
    <ol data-testid="inbox-asks" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: "0.8125rem", minWidth: 0 }}>
      {asks.slice(0, 20).map((entry) => (
        <Suspense key={entry.id} fallback={null}>
          <InteractionRow entry={entry} undo={(batch) => <UndoTurn batch={batch} />} />
        </Suspense>
      ))}
    </ol>
  );
}
