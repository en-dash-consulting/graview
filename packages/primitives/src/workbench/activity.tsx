import { humaniseField, type AnySchema } from "@graview/core";
import { useGraph, useGraview } from "@graview/react";
import type { ToolCall } from "@graview/tools";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chip } from "../primitives/index.js";
import { nameOf } from "./answer-args.js";


export interface Change {
  readonly intent: string;
  readonly author: string;
  /** The author's own id, for seats that are not the person at the keyboard. */
  readonly authorId?: string;
  readonly touched: readonly string[];
  readonly batch: string;
}

/**
 * The last few changes, with who made them — READ FROM THE LOG, not
 * accumulated from a subscription.
 *
 * The difference showed up the moment the desk started recording its own
 * navigation: opening an app unmounts the rail, so the subscription version
 * lost exactly the change it had just made, and anything that happened before
 * the rail first mounted had never been there at all. The op log is the
 * state; deriving from it means nothing is lost by a component coming and
 * going, which is the whole reason history is a fold rather than a stack.
 *
 * A human edit and an agent edit render the same way, because the log cannot
 * tell them apart.
 */
export function useRecentChanges(limit = 4): readonly Change[] {
  const { store } = useGraview<AnySchema>();
  const nodes = useGraph();
  return useMemo(
    () =>
      [...store.batches()]
        .reverse()
        .slice(0, limit)
        .map((batch) => ({
          intent: batch.intent,
          author: batch.author.kind,
          ...(batch.author.id ? { authorId: batch.author.id } : {}),
          touched: [...new Set(batch.ops.flatMap((op) => op.writes))],
          batch: batch.id,
        })),
    [store, nodes, limit],
  );
}

/**
 * Drop one turn, keeping everything since.
 *
 * Undoing out of order is legal exactly when no later live op read something
 * it wrote — a checkable condition rather than a policy — so when it fails
 * the button says how many other turns would have to come along, which is
 * what the check already returns.
 */
export function UndoTurn({ batch }: { readonly batch: string }) {
  /*
   * WHO IS UNDOING. Undo is a change and the store judges it like one —
   * "what you may undo is what you may have done" — so it has to be told
   * who is asking, exactly as every act taken from the strip is. It was not:
   * the control called `store.undo(batch)` with no author, so the store
   * judged an anonymous principal, who may do nothing once a policy exists.
   * In any app with one, a person could not take back the edit they had
   * just made, and the row they made it on said "you".
   */
  const { store, principal, noteSeat } = useGraview<AnySchema>();
  const nodes = useGraph();
  const [refused, setRefused] = useState<string | null>(null);
  const check = useMemo(
    () => store.canUndo(batch),
    [store, batch, nodes],
  );

  if (!check.ok && check.ops.length === 0) return null;
  const blocked = !check.ok;
  const alsoNeeded = blocked ? check.includeBatches : [];

  return (
    <span style={{ marginLeft: "auto", flex: "0 0 auto", display: "grid", justifyItems: "end", gap: 2 }}>
    <button
      type="button"
      data-testid="undo-turn"
      title={
        blocked ? `${check.message} — undo those too` : "Take this back, keeping everything since"
      }
      /*
       * A REFUSAL IS A RESULT, said on the control that asked for it.
       *
       * `store.canUndo` answers the questions the LOG can answer — a later
       * op read what this one wrote — and not the one the SCHEMA answers:
       * taking back a migration that added a required field leaves a node
       * the declaration refuses. That threw out of the click handler, which
       * is an unhandled error in a console nobody is reading and a button
       * that looked like it did nothing.
       */
      onClick={() => {
        setRefused(null);
        try {
          /* Taking an agent's turn back walks its body home: the log and the body agree. */
          const turned = store.log.all().find((op) => op.batch === batch && op.author.kind === "agent");
          store.undo(blocked ? [batch, ...alsoNeeded] : batch, { author: principal });
          if (turned) noteSeat({ type: "home", author: turned.author });
        } catch (error) {
          setRefused(error instanceof Error ? error.message : String(error));
        }
      }}
      /*
       * A TARGET, not just a word. At 11px in a 1px-tall padding this was a
       * 38x18 control — the only way to take a turn back, and under the 24
       * WCAG 2.2 asks for on both counts. The rail row grows by six pixels;
       * the alternative is an undo you have to aim at.
       */
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
        padding: "1px 8px",
        fontSize: "0.6875rem",
        ...(blocked ? { borderColor: "var(--graview-warn)", color: "var(--graview-warn)" } : {}),
      }}
    >
      {blocked ? `undo +${alsoNeeded.length}` : "undo"}
    </button>
      {refused ? (
        <span
          data-testid="undo-refused"
          role="alert"
          style={{ fontSize: "0.6875rem", lineHeight: 1.4, color: "var(--graview-warn)", maxWidth: 260, textAlign: "right" }}
        >
          {refused}
        </span>
      ) : null}
    </span>
  );
}

/**
 * What has happened, and what is happening: the agent's tool calls and every
 * applied change, in one list.
 *
 * A diff says what CHANGED and never what was considered, so an agent turn
 * without this is a spinner and a toast. Reads are the interesting half.
 * Every node named here is a target, so checking the work is one click.
 */
/**
 * The way back to the example.
 *
 * An app that remembers its edits in the browser needs a visible way OUT of
 * them: a demo that can be edited into a corner with no exit teaches
 * distrust, and "clear your site data" is not an affordance. The control
 * goes to the same address with `fresh=1` — the framework's own convention,
 * read by `browserStartsFresh` in `@graview/ship` — so it is a navigation
 * like any other stop: the seed loads, the flag is dropped from the address,
 * and what you do next is remembered again.
 */
export function StartFresh() {
  const href = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", "1");
    return url.toString();
  };
  return (
    <a
      href="#fresh"
      data-testid="start-fresh"
      title="Forget every edit made in this browser and return to the example"
      onClick={(event) => {
        event.preventDefault();
        window.location.assign(href());
      }}
      /*
       * The same target the routed face's copy of this link already is
       * (`StartFreshLink` in @graview/pages): inline text at 12px is a
       * 50x16 control, and the fix landed on one face only.
       */
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
        fontSize: "0.75rem",
        color: "var(--graview-ink-muted)",
        textDecoration: "underline",
        textDecorationColor: "var(--graview-edge-bright)",
        textUnderlineOffset: 3,
      }}
    >
      Start fresh
    </a>
  );
}

export function ActivityRail({
  calls,
  seat,
  remembers = false,
}: {
  readonly calls: readonly ToolCall[];
  /**
   * Whether this browser is remembering the edits. When it is, the popover
   * says so and carries the way back to the example — history is where you
   * would look for the way out of it.
   */
  readonly remembers?: boolean;
  /**
   * The agent seat, if the app gives one. It lives HERE, not in the bar:
   * Activity is "what has happened, and what is happening", which is the
   * agent's own surface and where you would be looking to watch a turn —
   * and a run-a-turn control that is disabled most of the time was a
   * permanently-visible ghost in prime bar space. See the recorded
   * decision on the PRD task "Decide where the agent seat lives".
   */
  readonly seat?: ReactNode;
}) {
  const changes = useRecentChanges();
  const { store, principal } = useGraview<AnySchema>();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const running = calls.some((call) => call.phase === "running");

  /*
   * A POPOVER FROM THE BAR, not a rail pinned over the scene.
   *
   * It was in the way because it was always there, and moving it around the
   * corners did not change that. What happened is chrome — it belongs with
   * the other chrome, opening on demand, in the same language as the problems
   * list. The one thing that must stay visible without opening anything is
   * that an agent is mid-turn, and that is a dot on the button.
   */
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (seat === undefined && calls.length === 0 && changes.length === 0 && !remembers) return null;

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="activity-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={running ? "An agent is working" : "What has happened"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 11px",
          borderRadius: 999,
          fontSize: "0.78125rem",
          whiteSpace: "nowrap",
          ...(running ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" } : {}),
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: running ? "var(--graview-accent)" : "var(--graview-edge-bright)",
          }}
        />
        {changes.length > 0 ? changes.length : ""} Activity
      </button>

      {/*
        * THE SEAT IS SEATED WHETHER OR NOT THE RAIL IS OPEN. Its body stands
        * in the city from the first frame, docked, and that needs the seat
        * mounted — so while the rail is shut the seat is here, hidden, and
        * moves into the rail's row when it opens.
        */}
      {!open && seat !== undefined ? (
        <div hidden data-testid="agent-seat-seated">
          {seat}
        </div>
      ) : null}
      {open ? (
        <aside
          aria-label="Activity"
          data-testid="activity"
          data-graview-offstage=""
          data-graview-overlay=""
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            width: 300,
            maxHeight: "min(52cqh, 460px)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 9,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {seat !== undefined ? (
            <div
              data-testid="agent-seat-row"
              style={{
                display: "grid",
                gap: 5,
                paddingBottom: calls.length > 0 || changes.length > 0 ? 9 : 0,
                ...(calls.length > 0 || changes.length > 0
                  ? { borderBottom: "1px solid var(--graview-edge)" }
                  : {}),
              }}
            >
              <span
                style={{
                  fontSize: "0.625rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--graview-ink-faint)",
                }}
              >
                The agent's seat
              </span>
              {seat}
            </div>
          ) : null}
          {calls.length > 0 ? (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
              {calls.slice(0, 6).map((call, index) => (
                <li
                  key={`${call.at}:${index}`}
                  style={{ display: "grid", gap: 2, fontSize: "0.75rem", lineHeight: 1.45 }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        flex: "0 0 auto",
                        background:
                          call.phase === "running"
                            ? "var(--graview-accent)"
                            : call.phase === "failed"
                              ? "var(--graview-warn)"
                              : "var(--graview-edge-bright)",
                      }}
                    />
                    {/*
                      * THE ACT'S OWN TITLE, not the name it is registered
                      * under. "changed · close-item" is the tool surface's
                      * identifier read out in the one place a person looks
                      * to see what an agent just did — the same smell as a
                      * card named by its node id. A call that names no
                      * declared mutation (a read tool) is still humanised
                      * rather than printed raw.
                      */}
                    <span style={{ color: "var(--graview-ink)" }}>
                      {call.mutating ? "changed" : "read"} ·{" "}
                      {store.allMutations().find((mutation) => mutation.name === call.name)?.title ??
                        humaniseField(call.name)}
                    </span>
                  </div>
                  {Object.values(call.args).some((value) => typeof value === "string") ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 12 }}>
                      {Object.values(call.args)
                        .filter((value): value is string => typeof value === "string")
                        .slice(0, 3)
                        .map((value) => (
                          <Chip key={value} label={nameOf(store, value)} pickId={value} />
                        ))}
                    </div>
                  ) : null}
                  {call.error ? (
                    <div style={{ paddingLeft: 12, color: "var(--graview-warn)" }}>{call.error}</div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {changes.length > 0 ? (
            <ol
              data-testid="diff-log"
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
                fontSize: "0.75rem",
              }}
            >
              {changes.map((change, index) => (
                <li key={`change:${index}`} style={{ display: "grid", gap: 3, lineHeight: 1.45 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontWeight: 600 }}>
                        {/*
                          * WHO, by its own id. "claude" was hardcoded for
                          * every agent, so the chat seat's turn wore
                          * another seat's name — and a system author (a
                          * calendar sync) would have read as "you".
                          */}
                        {/* "you" is the person at the keyboard, not any
                            human: two seats on one store read each other's
                            work as their own. */}
                        {change.author === "human" && (change.authorId === undefined || principal.id === undefined || change.authorId === principal.id)
                          ? "you"
                          : (change.authorId ?? change.author)}
                      </strong>{" "}
                      <span style={{ color: "var(--graview-ink-muted)" }}>{change.intent}</span>
                    </span>
                    {change.batch ? <UndoTurn batch={change.batch} /> : null}
                  </div>
                  <div
                    data-touched={change.touched.join(" ")}
                    style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                  >
                    {change.touched.slice(0, 4).map((id) => (
                      <Chip key={id} label={nameOf(store, id)} pickId={id} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {remembers ? (
            <div
              data-testid="remembered"
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                paddingTop: 8,
                borderTop: "1px solid var(--graview-edge)",
                fontSize: "0.75rem",
                color: "var(--graview-ink-faint)",
              }}
            >
              <span>Remembered in this browser</span>
              <StartFresh />
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
