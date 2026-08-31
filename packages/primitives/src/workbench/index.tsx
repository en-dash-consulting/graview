import { labelOf, type AnySchema, type Store } from "@graview/core";
import { withOverview } from "@graview/layout";
import {
  useAffordances,
  useApplyAffordance,
  useGraph,
  useGraview,
  useJackIn,
  useNavigation,
  useSelection,
  useViolations,
} from "@graview/react";
import type { Affordance, OpenParameter, ToolCall } from "@graview/tools";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chip } from "../primitives/index.js";

/**
 * The parts of an interface that are not about the domain.
 *
 * The household example's shell came to a thousand lines, and building a second app made
 * it obvious how little of that was about households: what is selected and
 * what can be done with it, whether the rules hold, what the agent just did
 * and how to take it back, how to back out of a view. None of that knows
 * anything about a week or a bid — it is derived from the schema, the
 * invariants and the op log, which is the whole premise.
 *
 * So it lives here, and an app supplies what is genuinely its own: a name, a
 * home view, and whatever seat it wants to give an agent. The second app's
 * shell is about eighty lines, which is the number the claim rests on.
 */

/* ------------------------------------------------------------------ actions */

/**
 * The controls for one action's unanswered arguments, walked in order.
 *
 * One at a time and in sequence, because an action can need several: drafting
 * work needs both what it is and how big it is, and asking for the first
 * while ignoring the second would produce a deliverable with an invented
 * size. Each argument draws the control its declared shape asks for — a
 * picker when it names a node, a date field when it is a date, an enum's own
 * options when it is a choice.
 */
export function AnswerArgs({
  affordance,
  onApply,
  onCancel,
}: {
  readonly affordance: Affordance;
  onApply: (args: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { store } = useGraview<AnySchema>();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState("");

  const remaining = affordance.open.filter((parameter) => !(parameter.name in answers));
  const parameter = remaining[0];

  useEffect(() => setDraft(""), [parameter?.name]);

  if (!parameter) return null;

  const answer = (value: unknown) => {
    const next = { ...answers, [parameter.name]: value };
    const outstanding = affordance.open.filter((other) => !(other.name in next));
    if (outstanding.length === 0) onApply(next);
    else setAnswers(next);
  };

  const shape = parameter.shape ?? { type: "unknown" as const };
  const choices = choicesFor(parameter, shape);

  return (
    <div style={{ display: "grid", gap: 4, padding: "5px 0 2px" }}>
      {affordance.open.length > 1 ? (
        <span style={{ fontSize: 10.5, color: "var(--graview-ink-faint)" }}>
          {parameter.name} · {affordance.open.length - remaining.length + 1} of{" "}
          {affordance.open.length}
        </span>
      ) : null}

      {choices.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {choices.slice(0, 10).map((choice) => (
            <button
              key={choice}
              type="button"
              style={{ padding: "3px 9px", fontSize: 12 }}
              onClick={() => answer(choice)}
            >
              {nameOf(store, choice)}
            </button>
          ))}
        </div>
      ) : (
        <form
          style={{ display: "flex", gap: 4 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim().length === 0) return;
            answer(shape.type === "number" ? Number(draft) : draft);
          }}
        >
          <input
            autoFocus
            type={shape.type === "date" ? "date" : shape.type === "number" ? "number" : "text"}
            aria-label={parameter.name}
            placeholder={parameter.name}
            value={draft}
            {...(shape.type === "number" && shape.min !== undefined ? { min: shape.min } : {})}
            {...(shape.type === "number" && shape.max !== undefined ? { max: shape.max } : {})}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              font: "inherit",
              fontSize: 13,
              padding: "5px 8px",
              borderRadius: 7,
              border: "1px solid var(--graview-edge)",
              background: "var(--graview-panel)",
              color: "var(--graview-ink)",
            }}
          />
          <button type="submit" disabled={draft.trim().length === 0} style={{ fontSize: 12 }}>
            {remaining.length > 1 ? "Next" : "Apply"}
          </button>
        </form>
      )}
    </div>
  );
}

function choicesFor(
  parameter: OpenParameter,
  shape: NonNullable<OpenParameter["shape"]>,
): readonly string[] {
  if (parameter.candidates && parameter.candidates.length > 0) return parameter.candidates;
  return shape.type === "choice" ? shape.options : [];
}

/** A node's own label where there is one, so a picker never offers raw ids. */
export function nameOf(store: Store<AnySchema>, id: string): string {
  const node = store.graph.getNode(id);
  if (!node) return id;
  return labelOf(store.schema.tryDefinition(node.kind), node as never);
}

/* ---------------------------------------------------------------- inspector */

/**
 * What is selected, what is true about it, and what can legally be done —
 * as a STRIP, not a panel.
 *
 * It was a 340-pixel column parked over the bottom-right of the scene at up
 * to 56% of the height, which is a lot of furniture to put in front of the
 * thing you just clicked in order to tell you about it. A contextual surface
 * should be the smallest thing that carries the answer: one line of what this
 * is, one line of what is true about it, and the actions as inline controls
 * rather than a stack of full-width rows.
 *
 * Bottom-centre rather than bottom-right, because the right is where the
 * context plane's last cards sit and the middle is the one place a scene
 * built around a centred focus has to spare.
 */
export function Inspector() {
  const { store, menuAt, setMenuAt } = useGraview<AnySchema>();
  const { selection, clear } = useSelection();
  const { affordances, withheld, observations } = useAffordances();
  const { apply, preview } = useApplyAffordance();
  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const kinds = [
    ...new Set(
      selection.flatMap((id) => {
        const node = store.graph.getNode(id);
        return node ? [node.kind] : [];
      }),
    ),
  ];

  useEffect(() => {
    setPending(null);
    setExpanded(false);
  }, [selection]);

  /*
   * A menu at the pointer closes the way a menu does. The strip does not —
   * it is not covering anything and clearing the selection is what the × is
   * for.
   */
  useEffect(() => {
    if (!menuAt) return;
    const away = () => setMenuAt(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAt(null);
    };
    // A frame later, or the click that opened it closes it again.
    const timer = setTimeout(() => document.addEventListener("mousedown", away), 0);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [menuAt, setMenuAt]);

  if (selection.length === 0) return null;

  const INLINE = 4;
  // At the pointer there is room for the lot; in the strip there is not.
  const atPointer = menuAt !== null;
  const shown = expanded || atPointer ? affordances : affordances.slice(0, INLINE);
  const hidden = affordances.length - shown.length;
  const open = affordances.find((affordance) => affordance.id === pending);

  return (
    <aside
      aria-label="Inspector"
      data-testid={atPointer ? "context-menu" : "inspector-strip"}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        /*
         * Above the jacked-in page, not only above the scene.
         *
         * Lifting a view out to read it left you with no way to act on it —
         * the strip was behind the full page, so a jacked-in node was
         * read-only by accident. The actions are the same derived ones; only
         * the backdrop changed.
         */
        zIndex: 60,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "9px 12px",
        borderRadius: 12,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        // Lighter than the rails: this appears and disappears constantly, and
        // a heavy shadow made every selection feel like opening a dialog.
        boxShadow: atPointer ? "var(--graview-lift-high)" : "var(--graview-lift-low)",
        ...(atPointer
          ? {
              // Clamped so a right click near an edge does not open a menu
              // half off the screen.
              left: Math.min(menuAt.x, Math.max(8, window.innerWidth - 320)),
              top: Math.min(menuAt.y, Math.max(8, window.innerHeight - 260)),
              width: 300,
              maxHeight: "min(52vh, 420px)",
              overflow: "auto",
            }
          : {
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: "min(860px, calc(100vw - 40px))",
            }),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <strong style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>
          {selection.length === 1 ? nameOf(store, selection[0]!) : `${selection.length} selected`}
        </strong>
        {kinds.length > 0 ? (
          <span style={{ fontSize: 11, color: "var(--graview-ink-faint)", whiteSpace: "nowrap" }}>
            {kinds.join(" · ")}
          </span>
        ) : null}

        {/* What is true about it, in one line. The rest is a count, not a
            list — a strip that grows to five bullet points is a panel again. */}
        {observations.length > 0 ? (
          <span
            data-testid="observations"
            title={observations.map((observation) => observation.text).join("\n")}
            style={{
              minWidth: 0,
              flex: "1 1 auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 12,
              color: "var(--graview-ink-muted)",
            }}
          >
            {observations[0]!.text}
            {observations.length > 1 ? (
              <span style={{ color: "var(--graview-ink-faint)" }}>
                {" "}
                +{observations.length - 1}
              </span>
            ) : null}
          </span>
        ) : (
          <span style={{ flex: "1 1 auto" }} />
        )}

        <button
          type="button"
          onClick={() => {
            setMenuAt(null);
            clear();
          }}
          aria-label="Clear selection"
          style={{ padding: "1px 7px", fontSize: 11, flex: "0 0 auto" }}
        >
          ×
        </button>
      </div>

      {affordances.length === 0 ? (
        /*
         * An empty action list is a RESULT, not a blank space. Saying which
         * kind has no mutations declaring it as a subject is the same honesty
         * the check CLI gives an agent, pointed at a person.
         */
        <p
          data-testid="no-affordances"
          style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
        >
          {withheld.length > 0
            ? // "Nothing can be done" would be a lie here: things can be
              // done, by somebody else. Which is a different sentence.
              `Nothing you may do with ${
                kinds.length === 1 ? `a ${kinds[0]}` : "this mix of kinds"
              } — ${withheld.length} action${withheld.length === 1 ? "" : "s"} withheld.`
            : `Nothing can be done with ${
                kinds.length === 1 ? `a ${kinds[0]}` : "this mix of kinds"
              } yet — no mutation declares ${kinds.length === 1 ? "it" : "them"} as a subject.`}
        </p>
      ) : (
        <ol
          data-testid="affordances"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            // At the pointer a menu reads as a column; in a strip the same
            // actions read as a row. Same list, same components.
            flexDirection: atPointer ? "column" : "row",
            flexWrap: atPointer ? "nowrap" : "wrap",
            gap: atPointer ? 2 : 5,
          }}
        >
          {shown.map((affordance) => (
            <li key={affordance.id}>
              <button
                type="button"
                data-affordance={affordance.id}
                aria-pressed={pending === affordance.id}
                title={affordance.why}
                style={{
                  padding: "4px 10px",
                  fontSize: 12.5,
                  borderRadius: 8,
                  ...(atPointer
                    ? {
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid transparent",
                        background: "none",
                        boxShadow: "none",
                      }
                    : { whiteSpace: "nowrap" }),
                  ...(pending === affordance.id
                    ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
                    : {}),
                }}
                onClick={() => {
                  if (affordance.open.length > 0) {
                    setPending(pending === affordance.id ? null : affordance.id);
                    return;
                  }
                  preview(affordance);
                  apply(affordance);
                  setMenuAt(null);
                }}
              >
                {affordance.label}
                {affordance.open.length > 0 ? (
                  <span style={{ color: "var(--graview-ink-faint)" }}> …</span>
                ) : null}
              </button>
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                style={{ padding: "4px 10px", fontSize: 12.5, borderRadius: 8 }}
              >
                +{hidden} more
              </button>
            </li>
          ) : null}
        </ol>
      )}

      {/*
        * Actions you may not take are SHOWN, disabled, with the reason.
        *
        * Hiding them teaches people the software is broken — they saw a
        * colleague do this yesterday and now the button is gone, so the
        * software is unreliable rather than the permission being deliberate.
        * The framework already treats an empty action list as a result and
        * explains it; this is the same honesty pointed at a different cause.
        */}
      {withheld.length > 0 ? (
        <ul
          data-testid="withheld"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: atPointer ? "column" : "row",
            flexWrap: "wrap",
            gap: atPointer ? 2 : 5,
          }}
        >
          {withheld.slice(0, atPointer ? withheld.length : INLINE).map((action) => (
            <li key={action.id}>
              <button
                type="button"
                disabled
                data-affordance={action.id}
                data-withheld={action.refusal.wouldNeed.join(",") || "nobody"}
                title={action.refusal.message}
                style={{
                  padding: "4px 10px",
                  fontSize: 12.5,
                  borderRadius: 8,
                  borderStyle: "dashed",
                  ...(atPointer ? { width: "100%", textAlign: "left", background: "none" } : {}),
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The arguments appear in place, under the action that asked for them,
          rather than turning the strip into a form. */}
      {open ? (
        <AnswerArgs
          affordance={open}
          onApply={(args) => {
            apply(open, args);
            setPending(null);
            setMenuAt(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </aside>
  );
}

/* ----------------------------------------------------------------- standing */

/**
 * Whether the rules hold, stated where it can always be seen.
 *
 * Zero is an answer too: a person wants the reassurance as much as the alarm,
 * so a clean state reads as a statement rather than as a disabled control.
 * Opening a problem SELECTS what it names, and the repairs arrive through the
 * ordinary inspector because repairs already outrank every other provider
 * there — no second path and no second rendering of an action.
 */
export function Standing({
  clean = "All rules hold",
}: {
  /** What to say when nothing is broken, in the app's own words. */
  readonly clean?: string;
}) {
  const violations = useViolations<AnySchema>();
  const { set } = useSelection();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const count = violations.length;

  /*
   * Click away or press Escape to close.
   *
   * A popover that only closes by pressing the thing that opened it is a
   * popover you end up dragging around the screen, and this one sits over
   * the scene.
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

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="standing"
        aria-expanded={open}
        disabled={count === 0}
        onClick={() => setOpen((current) => !current)}
        title={count === 0 ? clean : "Open what is broken, and what would fix it"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12.5,
          whiteSpace: "nowrap",
          ...(count === 0
            ? { border: "1px solid transparent", background: "none", opacity: 1 }
            : { borderColor: "var(--graview-warn)", color: "var(--graview-warn)" }),
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            flex: "0 0 auto",
            background: count === 0 ? "var(--graview-edge-bright)" : "var(--graview-warn)",
          }}
        />
        {count === 0 ? clean : `${count} ${count === 1 ? "problem" : "problems"}`}
      </button>

      {open && count > 0 ? (
        <ol
          data-testid="problems"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            width: 300,
            maxHeight: "min(48vh, 420px)",
            overflow: "auto",
            margin: 0,
            padding: 4,
            listStyle: "none",
            display: "grid",
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {violations.map((violation, index) => (
            <li
              key={`${violation.invariant}:${index}`}
              style={{
                // A hairline between rows, not a card around each. Bordered
                // buttons inside a bordered panel is two boxes doing one job,
                // and it made a two-item list look like a dialog.
                borderTop: index === 0 ? "none" : "1px solid var(--graview-edge)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  set(violation.nodeIds);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  fontSize: 12,
                  lineHeight: 1.4,
                  padding: "7px 8px",
                  border: "1px solid transparent",
                  background: "none",
                  boxShadow: "none",
                  borderRadius: 7,
                }}
              >
                <span style={{ display: "block", color: "var(--graview-ink)" }}>
                  {violation.message}
                </span>
                <span style={{ color: "var(--graview-ink-faint)", fontSize: 11 }}>
                  {violation.label}
                  {violation.repairs.length > 0
                    ? ` · ${violation.repairs.length} ${violation.repairs.length === 1 ? "way" : "ways"} to fix`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- activity */

export interface Change {
  readonly intent: string;
  readonly author: string;
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
          touched: [...new Set(batch.ops.flatMap((op) => op.writes))],
          batch: batch.id,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { store } = useGraview<AnySchema>();
  const nodes = useGraph();
  const check = useMemo(
    () => store.canUndo(batch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, batch, nodes],
  );

  if (!check.ok && check.ops.length === 0) return null;
  const blocked = !check.ok;
  const alsoNeeded = blocked ? check.includeBatches : [];

  return (
    <button
      type="button"
      data-testid="undo-turn"
      title={
        blocked ? `${check.message} — undo those too` : "Take this back, keeping everything since"
      }
      onClick={() => store.undo(blocked ? [batch, ...alsoNeeded] : batch)}
      style={{
        marginLeft: "auto",
        flex: "0 0 auto",
        padding: "1px 7px",
        fontSize: 11,
        ...(blocked ? { borderColor: "var(--graview-warn)", color: "var(--graview-warn)" } : {}),
      }}
    >
      {blocked ? `undo +${alsoNeeded.length}` : "undo"}
    </button>
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
export function ActivityRail({ calls }: { readonly calls: readonly ToolCall[] }) {
  const changes = useRecentChanges();
  const { store } = useGraview<AnySchema>();
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

  if (calls.length === 0 && changes.length === 0) return null;

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
          fontSize: 12.5,
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

      {open ? (
        <aside
          aria-label="Activity"
          data-testid="activity"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            width: 300,
            maxHeight: "min(52vh, 460px)",
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
          {calls.length > 0 ? (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
              {calls.slice(0, 6).map((call, index) => (
                <li
                  key={`${call.at}:${index}`}
                  style={{ display: "grid", gap: 2, fontSize: 12, lineHeight: 1.45 }}
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
                    <span style={{ color: "var(--graview-ink)" }}>
                      {call.mutating ? "changed" : "read"} · {call.name}
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
                fontSize: 12,
              }}
            >
              {changes.map((change, index) => (
                <li key={`change:${index}`} style={{ display: "grid", gap: 3, lineHeight: 1.45 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontWeight: 600 }}>
                        {change.author === "agent" ? "claude" : "you"}
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
        </aside>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ backing out */

/**
 * Escape backs out one level: leave the full page, then the Graview, then
 * drop the selection, then the raised relation, then the focus. A spatial
 * interface has to have a way out that does not require finding the right
 * small × in a trail.
 */
export function BackOut({ home }: { readonly home: string | null }) {
  const { view, focus, show, go } = useNavigation();
  const { selection, clear } = useSelection();
  const { isJackedIn, exit } = useJackIn();
  const overview = view.overview ?? false;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Never steal Escape from a field someone is typing in.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      /*
       * Outermost first, and the full page is the outermost thing there is.
       *
       * It is a modal dialog covering everything, and Escape did not close it
       * — the first press dropped the selection underneath it instead, which
       * from inside the page looked like Escape doing nothing at all. A modal
       * that cannot be dismissed from the keyboard is a trap; the only way
       * out was the button.
       */
      if (isJackedIn) exit();
      // Then the Graview: rising is the biggest change of place Escape can
      // undo, and it should not also drop a selection on the way past.
      else if (overview) go(withOverview(view, false));
      else if (selection.length > 0) clear();
      else if (view.relation) show(null);
      else if (view.focusId !== home) focus(home);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, focus, show, go, selection, clear, home, overview, isJackedIn, exit]);

  return null;
}

/**
 * The way out to the Graview, and back.
 *
 * The framework's own name for the view of the whole thing, which is the
 * right name: everything else here is a lens over part of the graph, and this
 * is the graph. A small mark at the foot of the scene rather than a labelled
 * control in the bar — it is a change of altitude, not a command, and the bar
 * is for what you are doing rather than where you are standing.
 */
export function OverviewButton() {
  const { view, go } = useNavigation();
  const overview = view.overview ?? false;
  return (
    <button
      type="button"
      data-testid="overview"
      aria-pressed={overview}
      aria-label={overview ? "Back into the view" : "See the Graview"}
      title={overview ? "Back into the view" : "The Graview — the whole thing, from outside"}
      // A view state, so it is a URL, the back button works, and the cards
      // already on screen fly out into the ring rather than being replaced.
      onClick={() => go(withOverview(view, !overview))}
      /*
       * A CONTROL IN THE BAR, not a pill floating over the scene.
       *
       * Twice now it has been "awkwardly slammed on top", and both times the
       * fix I reached for was a different set of coordinates. The problem was
       * never where it floated — it was that it floated at all while every
       * other view control lives in the bar. The Graview is a place you go,
       * like the others, so it goes where they are.
       */
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        borderRadius: 999,
        fontSize: 12.5,
        whiteSpace: "nowrap",
        ...(overview
          ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
          : {}),
      }}
    >
      {/* The mark: three kinds and the relations between them, which is what
          the view itself is. */}
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <ellipse
          cx="6"
          cy="6.6"
          rx="5"
          ry="2.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity="0.55"
        />
        <circle cx="6" cy="4" r="1.5" fill="currentColor" />
        <circle cx="1.6" cy="7.4" r="1.2" fill="currentColor" opacity="0.75" />
        <circle cx="10.4" cy="7.4" r="1.2" fill="currentColor" opacity="0.75" />
      </svg>
      Graview
    </button>
  );
}

/* --------------------------------------------------------------------- trail */

/**
 * Where you are, and the way back. The view used to be printed as a raw URL
 * fragment; the same information reads as a trail.
 */
export function Trail({
  home,
  homeLabel,
  children,
}: {
  readonly home: string | null;
  readonly homeLabel: string;
  readonly children?: ReactNode;
}) {
  const { view, focus, show } = useNavigation();
  const { store } = useGraview<AnySchema>();
  const focused =
    view.focusId && view.focusId !== home ? store.graph.getNode(view.focusId) : undefined;
  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

  const chip = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    fontSize: 13,
    borderRadius: 999,
    borderColor: "var(--graview-accent)",
    color: "var(--graview-accent)",
  } as const;

  return (
    <nav
      aria-label="View"
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, minWidth: 0 }}
    >
      <button
        type="button"
        onClick={() => focus(home)}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          whiteSpace: "nowrap",
          color:
            focused || view.relation ? "var(--graview-ink-muted)" : "var(--graview-ink)",
        }}
      >
        {homeLabel}
      </button>
      {focused ? (
        <>
          <span style={{ color: "var(--graview-ink-faint)" }}>›</span>
          <button type="button" data-testid="focused" onClick={() => focus(home)} style={chip}>
            {nameOf(store, focused.id)}
            <span aria-hidden="true" style={{ opacity: 0.7 }}>
              ×
            </span>
          </button>
        </>
      ) : null}
      {view.relation ? (
        <>
          <span style={{ color: "var(--graview-ink-faint)" }}>›</span>
          <button
            type="button"
            data-testid="raised"
            onClick={() => show(null)}
            title={`Stop showing ${plural(view.relation)}`}
            style={chip}
          >
            {plural(view.relation)}
            <span aria-hidden="true" style={{ opacity: 0.7 }}>
              ×
            </span>
          </button>
        </>
      ) : null}
      {children}
    </nav>
  );
}
