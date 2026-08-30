import { labelOf, type AnySchema, type Store } from "@graview/core";
import {
  useAffordances,
  useApplyAffordance,
  useGraph,
  useGraview,
  useNavigation,
  useSelection,
  useViolations,
} from "@graview/react";
import type { Affordance, OpenParameter, ToolCall } from "@graview/tools";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
 * What is selected, what is true about it, and what can legally be done.
 *
 * Everything in it is DERIVED. No menu is authored anywhere, in either app.
 */
export function Inspector() {
  const { store } = useGraview<AnySchema>();
  const { selection, clear } = useSelection();
  const { affordances, observations } = useAffordances();
  const { apply, preview } = useApplyAffordance();
  const [pending, setPending] = useState<string | null>(null);

  const kinds = [
    ...new Set(
      selection.flatMap((id) => {
        const node = store.graph.getNode(id);
        return node ? [node.kind] : [];
      }),
    ),
  ];

  if (selection.length === 0) return null;

  return (
    <aside
      aria-label="Inspector"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        width: 340,
        boxSizing: "border-box",
        zIndex: 10,
        maxHeight: "min(56vh, calc(100% - 40px))",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 14,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>
          {selection.length === 1
            ? nameOf(store, selection[0]!)
            : `${selection.length} selected`}
        </strong>
        {kinds.length > 0 ? (
          <span style={{ fontSize: 11.5, color: "var(--graview-ink-faint)" }}>
            {kinds.join(" · ")}
          </span>
        ) : null}
        <button
          type="button"
          onClick={clear}
          style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }}
        >
          clear
        </button>
      </div>

      {observations.length > 0 ? (
        <ul
          data-testid="observations"
          style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--graview-ink-muted)",
          }}
        >
          {observations.slice(0, 3).map((observation) => (
            <li key={observation.id}>{observation.text}</li>
          ))}
        </ul>
      ) : null}

      {affordances.length === 0 ? (
        /*
         * An empty action list is a RESULT, not a blank space. Saying which
         * kind has no mutations declaring it as a subject is the same honesty
         * the check CLI gives an agent, pointed at a person.
         */
        <p
          data-testid="no-affordances"
          style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--graview-ink-muted)" }}
        >
          Nothing can be done with {kinds.length === 1 ? `a ${kinds[0]}` : "this mix of kinds"} yet
          — no mutation declares {kinds.length === 1 ? "it" : "them"} as a subject.
        </p>
      ) : null}

      <ol
        data-testid="affordances"
        style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 5 }}
      >
        {affordances.slice(0, 6).map((affordance) => (
          <li key={affordance.id}>
            <button
              type="button"
              data-affordance={affordance.id}
              title={affordance.why}
              style={{ width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13 }}
              onClick={() => {
                if (affordance.open.length > 0) {
                  setPending(pending === affordance.id ? null : affordance.id);
                  return;
                }
                preview(affordance);
                apply(affordance);
              }}
            >
              {affordance.label}
              {affordance.open.length > 0 ? (
                <span style={{ color: "var(--graview-ink-faint)" }}>
                  {" "}
                  · needs {affordance.open.map((parameter) => parameter.name).join(", ")}
                </span>
              ) : null}
            </button>
            {pending === affordance.id ? (
              <AnswerArgs
                affordance={affordance}
                onApply={(args) => {
                  apply(affordance, args);
                  setPending(null);
                }}
                onCancel={() => setPending(null)}
              />
            ) : null}
          </li>
        ))}
      </ol>
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
  const count = violations.length;

  return (
    <div style={{ position: "relative" }}>
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
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            width: 360,
            margin: 0,
            padding: 8,
            listStyle: "none",
            display: "grid",
            gap: 4,
            borderRadius: 12,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {violations.map((violation, index) => (
            <li key={`${violation.invariant}:${index}`}>
              <button
                type="button"
                onClick={() => {
                  set(violation.nodeIds);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  padding: "7px 10px",
                }}
              >
                <span style={{ display: "block", color: "var(--graview-ink)" }}>
                  {violation.message}
                </span>
                <span style={{ color: "var(--graview-ink-faint)", fontSize: 11.5 }}>
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
  const [open, setOpen] = useState(true);
  if (calls.length === 0 && changes.length === 0) return null;

  return (
    <aside
      aria-label="Activity"
      data-testid="activity"
      style={{
        // Top left: the upper left of a scene is genuinely empty, because the
        // focus panel is centred and never reaches it.
        position: "fixed",
        left: 20,
        top: 76,
        width: 250,
        boxSizing: "border-box",
        zIndex: 10,
        maxHeight: "calc(100vh - 140px)",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 9,
        padding: open ? 14 : "8px 14px",
        borderRadius: 14,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "none",
          padding: 0,
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--graview-ink-faint)",
        }}
      >
        Activity
        <span aria-hidden="true" style={{ marginLeft: "auto" }}>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && calls.length > 0 ? (
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

      {open && changes.length > 0 ? (
        <ol
          data-testid="diff-log"
          style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}
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
  );
}

/* ------------------------------------------------------------------ backing out */

/**
 * Escape backs out one level: drop the selection, then the raised relation,
 * then the focus. A spatial interface has to have a way out that does not
 * require finding the right small × in a trail.
 */
export function BackOut({ home }: { readonly home: string | null }) {
  const { view, focus, show } = useNavigation();
  const { selection, clear } = useSelection();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Never steal Escape from a field someone is typing in.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (selection.length > 0) clear();
      else if (view.relation) show(null);
      else if (view.focusId !== home) focus(home);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, focus, show, selection, clear, home]);

  return null;
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
