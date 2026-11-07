import type { AnySchema, Repair, Violation } from "@graview/core";
import type { AiInteraction } from "@graview/core/catalog";
import { useGraview, useSelection, type HostNotification } from "@graview/react/provider";
import type { ToolCall } from "@graview/tools";
import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SuggestedList, SuggestedUpdates } from "./bar-suggested.js";
import { problemSentence } from "./problem-sentence.js";
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
.graview-inbox-part{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0}
.graview-inbox-part+.graview-inbox-part{margin-top:10px}
.graview-inbox-part>h3{margin:0;font-size:.75rem;font-weight:600;color:var(--graview-ink-muted)}
.graview-inbox-problem{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;font-size:.8125rem;line-height:1.45;overflow-wrap:anywhere}
.graview-inbox-problem-words{all:unset;box-sizing:border-box;min-height:24px;cursor:pointer;color:var(--graview-ink);overflow-wrap:anywhere}
.graview-inbox-problem-words:hover{text-decoration:underline;text-underline-offset:2px}
.graview-inbox-problem-words:focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px;border-radius:4px}
.graview-inbox-fixes{display:flex;flex-wrap:wrap;gap:4px}
.graview-inbox-fixes button{min-height:24px;padding:1px 10px;font-size:.75rem}
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
  /** The rules broken: those this seat could do something about, and the others. */
  readonly rules: { readonly yours: readonly Violation[]; readonly others: readonly Violation[] };
  readonly asks: readonly AiInteraction[];
  /** Whether the tray may hold anything: a suggestion in the log, or what was done while the reader was away. */
  readonly tray: boolean;
  /** How many suggestions and proposals wait for this person. */
  readonly waiting: number;
  readonly activityHas: boolean;
  readonly calls: readonly ToolCall[];
  readonly seat?: ReactNode;
  readonly remembers: boolean;
  readonly close: () => void;
}

export function InboxPane({ tab, choose, asksOn, counts, notifications, rules, asks, tray, waiting, activityHas, calls, seat, remembers, close }: InboxPaneProps) {
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
          <ForYou notifications={notifications} rules={rules} tray={tray} waiting={waiting} close={close} done={toActivity} />
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

/**
 * FOR YOU, IN TWO PARTS (Roadmap f-inbox-needs-you-first): Needs you, each
 * thing a person is being asked, and Updates, what they may like to know.
 * Spacing and a heading between them, not a box, and each says so in a line
 * when it holds nothing.
 */
function ForYou({ notifications, rules, tray, waiting, close, done }: Pick<InboxPaneProps, "notifications" | "rules" | "tray" | "waiting" | "close"> & { readonly done: () => void }) {
  const needs = notifications.filter((one) => one.needs);
  const rest = notifications.filter((one) => !one.needs);
  const asksNothing = waiting === 0 && rules.yours.length === 0 && needs.length === 0;
  return (
    <>
      <section className="graview-inbox-part" data-testid="inbox-needs-you" aria-labelledby="graview-inbox-needs-you">
        <h3 id="graview-inbox-needs-you">Needs you</h3>
        {tray ? (
          <Suspense fallback={null}>
            <SuggestedList close={close} done={done} />
          </Suspense>
        ) : null}
        {rules.yours.length > 0 ? <BrokenRules violations={rules.yours} close={close} /> : null}
        <Notifications notifications={needs} close={close} label="From the host, needing you" />
        {asksNothing ? (
          <p data-testid="inbox-needs-you-empty" style={EMPTY}>
            Nothing needs you right now.
          </p>
        ) : null}
      </section>
      <section className="graview-inbox-part" data-testid="inbox-updates" aria-labelledby="graview-inbox-updates">
        <h3 id="graview-inbox-updates">Updates</h3>
        <Notifications notifications={rest} close={close} label="From the host" />
        {rules.others.length > 0 ? <BrokenRules violations={rules.others} close={close} told /> : null}
        {tray ? (
          <Suspense fallback={null}>
            <SuggestedUpdates alone={rest.length === 0 && rules.others.length === 0} />
          </Suspense>
        ) : null}
        {rest.length === 0 && rules.others.length === 0 && !tray ? (
          <p data-testid="inbox-updates-empty" style={EMPTY}>
            No updates.
          </p>
        ) : null}
      </section>
    </>
  );
}

/**
 * THE RULES BROKEN, IN WORDS (Roadmap f-inbox-needs-you-first): the sentence
 * the rule says, by the record's name and the field's label — "Crumbs Bakery
 * is booked but has no quote" — and each fix under it, by its own label. The
 * sentence pressed selects what it names and opens the acts on it, where its
 * repairs lead (W-179). A fix that needs nothing more is made at a press; one
 * that asks for something opens those acts, to ask there. Only a fix this seat
 * could make is offered: an act offered and refused is the watch's. `told`,
 * for a seat that may do nothing about it: no fixes, and its sentence still
 * goes to what it names, where the acts say why not.
 */
function BrokenRules({ violations, close, told = false }: { readonly violations: readonly Violation[]; readonly close: () => void; readonly told?: boolean }) {
  const { store, principal, setMenuAt } = useGraview<AnySchema>();
  const { set } = useSelection();
  const [refused, setRefused] = useState<string | null>(null);
  const may = (repair: Repair) => {
    try {
      return store.permits({ name: repair.mutation, args: (repair.args ?? {}) as never }, principal).ok;
    } catch {
      return false;
    }
  };
  const openActs = (violation: Violation, button: HTMLElement) => {
    const box = button.closest('[data-testid="inbox"]')!.getBoundingClientRect();
    set(violation.nodeIds);
    close();
    setMenuAt({ x: box.left, y: box.top, on: violation.subjectId });
  };
  const press = (violation: Violation, repair: Repair, button: HTMLElement) => {
    setRefused(null);
    if (repair.missing !== undefined && repair.missing.length > 0) return openActs(violation, button);
    try {
      store.apply({ name: repair.mutation, args: (repair.args ?? {}) as never }, { author: principal });
      // The row it was on is gone: the keyboard goes on to the next fix, else the tab, never <body>.
      requestAnimationFrame(() => {
        const inbox = document.querySelector('[data-testid="inbox"]');
        (inbox?.querySelector<HTMLElement>('[data-testid="inbox-problem-fix"]') ?? inbox?.querySelector<HTMLElement>('[aria-selected="true"]'))?.focus();
      });
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <ol data-testid="problems" aria-label="Rules broken" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, minWidth: 0 }}>
      {violations.map((violation, at) => {
        // A rule over many records names a fix for each: the first few here, and every one in the acts its sentence opens.
        const fixes = told ? [] : violation.repairs.filter(may).slice(0, 3);
        return (
          <li key={`${violation.invariant}:${at}`} className="graview-inbox-problem" data-testid="inbox-problem">
            <button type="button" className="graview-inbox-problem-words" data-testid="inbox-problem-words" onClick={(event) => openActs(violation, event.currentTarget)}>
              {problemSentence(violation)}
            </button>
            {fixes.length > 0 ? (
              <span className="graview-inbox-fixes">
                {fixes.map((repair) => (
                  <button key={repair.label} type="button" data-testid="inbox-problem-fix" onClick={(event) => press(violation, repair, event.currentTarget)}>
                    {repair.label}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        );
      })}
      {refused ? (
        <li data-testid="inbox-problem-refused" role="alert" style={{ fontSize: "0.75rem", color: "var(--graview-warn)", overflowWrap: "anywhere" }}>
          {refused}
        </li>
      ) : null}
    </ol>
  );
}

/** A part of For you with nothing in it, said in a line. */
const EMPTY = { margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" } as const;

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
function Notifications({ notifications, close, label }: { readonly notifications: readonly HostNotification[]; readonly close: () => void; readonly label: string }) {
  if (notifications.length === 0) return null;
  return (
    <ol data-testid="inbox-notifications" aria-label={label} style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, minWidth: 0 }}>
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
