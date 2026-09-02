import { humaniseField, labelOf, type AnySchema, type Store } from "@graview/core";
import { edgeOfSelection, kindsOf, withoutMoves, withOverview, withPast, withZoom } from "@graview/layout";
import {
  useAffordances,
  useApplyAffordance,
  useAttention,
  useGraph,
  useBacktrack,
  useGraview,
  useJackIn,
  useNavigation,
  useSelection,
  useViolations,
} from "@graview/react";
import {
  createInAppAdapter,
  createToolRuntime,
  loadPins,
  togglePin,
  type Affordance,
  type PinOverrides,
  type InAppAgent,
  type OpenParameter,
  type ToolCall,
  type ToolRuntime,
} from "@graview/tools";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /*
   * A selected KIND CARD names its kind, in the plural the declaration
   * already carries — "Gardeners", never "kind:gardener". In an empty app
   * the kind card is the first thing anyone selects, so the raw id here was
   * the first string the interface ever showed them.
   */
  const edge = edgeOfSelection(id);
  if (edge) return humaniseField(edge.kind);
  const kinds = kindsOf(id);
  if (kinds.length > 0) {
    return kinds
      .map((kind) => {
        const definition = store.schema.tryDefinition(kind);
        return definition?.plural ?? `${kind}s`;
      })
      .join(" + ");
  }
  const node = store.graph.getNode(id);
  if (!node) return id;
  return labelOf(store.schema.tryDefinition(node.kind), node as never);
}

/* ---------------------------------------------------------------- inspector */

/**
 * What is selected, what is true about it, and what can legally be done —
 * as a LEFT PANE beside the focus.
 *
 * It has lived bottom-right (a 340px column over the scene), bottom-centre
 * (a strip that sat on the kinds shelf), and now where the room actually
 * is: the left gutter beside a centred focus, which every state leaves
 * open, which a widened or zoomed view only makes wider, and which covers
 * neither the shelf below nor the picture you are acting on. In the
 * Graview the relation key holds the top of the same rail and this pane
 * takes the run of it below.
 */
export function Inspector() {
  const { store, menuAt, setMenuAt, view } = useGraview<AnySchema>();
  const { selection, set, clear } = useSelection();
  /*
   * THE PERSON'S OWN PINS, loaded once per mount and passed into the same
   * derivation every surface reads — so a pin made here reorders the strip,
   * the pointer menu and nothing else invents a second action system.
   */
  const [pins, setPins] = useState<PinOverrides>(() => loadPins());
  const deriveOptions = useMemo(() => ({ pins }), [pins]);
  // Which acts the app itself pinned — the star on those demotes rather
  // than doubling up, so pressing it always visibly does something.
  const declaredPins = useMemo(
    () => new Set(store.allMutations().filter((mutation) => mutation.pinned).map((mutation) => mutation.name)),
    [store],
  );
  const { affordances, withheld, observations } = useAffordances(deriveOptions);
  const { apply, preview } = useApplyAffordance();
  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /*
   * The searcher's text. Chrome that is mostly not there must not be
   * there: the field only renders once the list outgrows the fold.
   */
  const [query, setQuery] = useState("");
  /*
   * A REFUSAL IS A RESULT, said where the button was pressed.
   *
   * A mutation that throws — a validation failure, a guard's own sentence —
   * used to vanish into the console, and the strip read as a button that
   * does nothing. The seat already surfaces its refusals on itself; this is
   * the same honesty for every action.
   */
  const [failed, setFailed] = useState<string | null>(null);

  const act = (affordance: Affordance, args?: Record<string, unknown>): boolean => {
    try {
      preview(affordance, args);
      apply(affordance, args);
      setFailed(null);
      setMenuAt(null);
      return true;
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const kinds = [
    ...new Set(
      selection.flatMap((id) => {
        const node = store.graph.getNode(id);
        return node ? [node.kind] : [];
      }),
    ),
  ];

  /*
   * A selected LINE. The pane's job flips from "what is this thing" to
   * "what is this relation": the declaration's own sentence for the edge,
   * both ends as pressable names, and the derived actions below — which
   * the schema provider has already pointed at this exact edge.
   */
  const edge = selection.length === 1 ? edgeOfSelection(selection[0]!) : null;
  const edgeEnds = edge
    ? { from: store.graph.getNode(edge.from), to: store.graph.getNode(edge.to) }
    : null;
  const edgeSaid = edge
    ? (() => {
        for (const definition of store.schema.definitions) {
          const declared = (definition.edges as Record<string, { description?: string }>)[
            edge.kind
          ];
          if (declared?.description) return declared.description;
        }
        return null;
      })()
    : null;

  useEffect(() => {
    setPending(null);
    setExpanded(false);
    setFailed(null);
    setQuery("");
  }, [selection]);

  /*
   * The strip reserves NOTHING. It is a transient elevated surface, and it
   * floats in front of the scene the way a menu floats in front of a page —
   * with the elevation drawn honestly, so covering reads as "nearer", not as
   * a collision. Reserving a permanent band of the scene's height for it
   * squeezed every band on every screen for chrome that mostly is not there,
   * and insetting only while something is selected would reflow the picture
   * under a double-click. Floating is the only answer that moves nothing.
   */

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

  /*
   * Whether the strip should say what is selected.
   *
   * It should not when the page you are looking at IS that thing: the document
   * has a heading, and the same string twice on one screen reads as a mistake
   * even when both are correct. The same holds after travelling — the focus
   * panel already carries the name at full size, and the strip repeating it
   * from the bottom of the window read as a stale leftover of the previous
   * stop.
   */
  const named = !(selection.length === 1 && selection[0] === view.focusId);

  const atPointer = menuAt !== null;

  /*
   * Nine rows before "Show N more", and the ranking has already put what
   * answers the current question first — which is what makes hiding the
   * tail honest. Everything past nine scrolls inside the pane's own box
   * once shown.
   */
  const fits = Math.max(1, Math.min(9, affordances.length));

  /*
   * ORDERED FOR READING, not only for ranking: what a broken rule demands,
   * then the acts somebody PINNED (the person's own before the app's — a
   * small fixed head-section), then what you can do to the THING, then its
   * TIES (the connects/severs acts, gathered under one heading instead of
   * shuffled among the rest), then — always last — what cannot be taken
   * back. Repairs first and destructive last are inviolate; pins and usage
   * only ever shuffle inside those walls.
   */
  const arranged = [
    ...affordances.filter((entry) => entry.provider === "invariant" && !entry.destructive),
    ...affordances.filter(
      (entry) => entry.pinned && entry.provider !== "invariant" && !entry.destructive,
    ),
    ...affordances.filter(
      (entry) => !entry.ties && !entry.destructive && !entry.pinned && entry.provider !== "invariant",
    ),
    ...affordances.filter(
      (entry) => entry.ties && !entry.destructive && !entry.pinned && entry.provider !== "invariant",
    ),
    ...affordances.filter((entry) => entry.destructive),
  ];
  /*
   * THE SEARCHER filters the same derived list — by label and by why, the
   * two sentences a person actually reads — and appears only when the list
   * outgrows the fold. Enter runs a sole survivor; Escape clears.
   */
  const searchable = arranged.length > fits && !atPointer;
  const trimmedQuery = query.trim().toLowerCase();
  const matched =
    searchable && trimmedQuery.length > 0
      ? arranged.filter((entry) =>
          `${entry.label} ${entry.why}`.toLowerCase().includes(trimmedQuery),
        )
      : null;
  const shown = matched ?? (expanded || atPointer ? arranged : arranged.slice(0, fits));
  const hidden = matched ? 0 : arranged.length - shown.length;
  /*
   * GROUPED BY WHAT THEY ANSWER. A repair arrives carrying the violation
   * that produced it, and without that sentence over it, "Cut X from
   * Thursday" offered on a selection of Y reads as a non sequitur. The
   * ranked order is untouched — consecutive repairs of one violation
   * gather under its sentence; everything else runs on below.
   */
  const sections: {
    heading: string | null;
    tone: "violation" | "ties" | null;
    items: typeof affordances;
  }[] = [];
  for (const affordance of shown) {
    const violation = !atPointer && affordance.provider === "invariant";
    const held = !atPointer && !violation && affordance.pinned !== undefined && !affordance.destructive;
    const tie = !atPointer && !violation && !held && affordance.ties === true && !affordance.destructive;
    const heading = violation ? affordance.why : held ? "pinned" : tie ? "its ties" : null;
    const tone = violation ? ("violation" as const) : held || tie ? ("ties" as const) : null;
    const last = sections[sections.length - 1];
    if (last && last.heading === heading) (last.items as Affordance[]).push(affordance);
    else sections.push({ heading, tone, items: [affordance] });
  }
  const open = affordances.find((affordance) => affordance.id === pending);

  /*
   * An observation that OPENS by restating the name is trimmed, not dropped.
   *
   * The strip read "Pay the deposit · task · \"Pay the deposit\" was due
   * 2026-08-28" — the same four words twice in one line, three inches apart,
   * which reads as a rendering fault rather than as two facts. The fact in it
   * is the date, and that is worth keeping; only the restatement goes. A name
   * appearing mid-sentence is left alone, because there it is doing work.
   */
  const title = selection.length === 1 ? nameOf(store, selection[0]!) : null;
  const trim = (text: string): string => {
    if (!title) return text;
    // Quoted or bare: a sentence that OPENS by restating the selected
    // name says it again three inches under the title.
    const restated = text.startsWith(`"${title}"`)
      ? text.slice(title.length + 2)
      : text.startsWith(title)
        ? text.slice(title.length)
        : null;
    if (restated === null) return text;
    const rest = restated.trimStart();
    return rest.length === 0 ? text : rest[0]!.toUpperCase() + rest.slice(1);
  };
  /*
   * A violation is stated ONCE. The invariant provider hands its message
   * out twice — as an observation, and as the `why` on every repair — so
   * whenever the repairs' own ⚠ heading is on screen, the observation
   * restating it is dropped. Where the heading is not shown (the pointer
   * menu, a violation whose repairs fell past the fold), the observation
   * remains the one statement of the trouble.
   */
  const headed = new Set(
    atPointer
      ? []
      : shown
          .filter((affordance) => affordance.provider === "invariant")
          .map((affordance) => affordance.why),
  );
  const said = observations
    .filter((observation) => !headed.has(observation.text))
    .map((observation) => ({ ...observation, text: trim(observation.text) }));

  return (
    <aside
      aria-label="Inspector"
      // Chrome, not scene: the ties layer must never anchor a line to the
      // node names this pane repeats.
      data-graview-offstage=""
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
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        // The high lift on both faces: the strip floats in FRONT of the
        // scene now rather than beside it in reserved room, and the shadow
        // is what makes covering read as "nearer" instead of as a collision.
        boxShadow: "var(--graview-lift-high)",
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
              /*
               * The left rail. Under the bar; in the Graview the relation
               * key holds the top of the rail, so the pane starts below it.
               * Everything past the viewport scrolls inside the pane.
               */
              left: 14,
              top: view.overview ? 352 : 100,
              // Inside the gutter beside a 1040-wide centred focus at the
              // surveyed width, so the pane sits NEXT to the picture rather
              // than on its title.
              width: 236,
              /*
               * The pane stops ABOVE the raised band (plane 1 begins at 68%
               * of the stage) and scrolls inside itself: a tall list of
               * repairs must not buy its height with the first raised card.
               */
              maxHeight: view.overview ? "calc(100vh - 372px)" : "calc(68vh - 94px)",
              overflow: "auto",
            }),
      }}
    >
      {/*
        * The heading row disappears entirely when it would hold nothing but
        * the dismiss control. An empty bar with one × in it reads as a
        * rendering that lost its contents.
        */}
      <div
        style={{
          display: named || !atPointer ? "flex" : "none",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "2px 8px",
          minWidth: 0,
          // Room for the dismiss control pinned to the pane's corner.
          paddingRight: atPointer ? 0 : 24,
        }}
      >
        {/*
          * The name, unless the page you are on is already that name.
          *
          * Jacked into one thing, the header says what it is and the strip
          * said it again three inches below — and the same string twice on one
          * screen reads as a mistake even when both are correct. What the
          * strip is FOR here is the actions.
          */}
        {!named ? null : (
          <>
            <strong style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>
              {selection.length === 1
                ? nameOf(store, selection[0]!)
                : `${selection.length} selected`}
            </strong>
            {kinds.length > 0 || edge ? (
              <span
                style={{ fontSize: 11, color: "var(--graview-ink-faint)", whiteSpace: "nowrap" }}
              >
                {edge ? "relation" : kinds.join(" · ")}
              </span>
            ) : null}
            {/* The onward gesture, said at the moment it applies — picking a
                thing is exactly when "how do I go into it" arises, and the
                jacked-in header was the one place that answered, which is
                after you had already found out. */}
            {selection.length === 1 && !edge ? (
              <span
                style={{ fontSize: 11, color: "var(--graview-ink-faint)", whiteSpace: "nowrap" }}
              >
                · double-click opens
              </span>
            ) : null}
          </>
        )}

        <span style={{ flex: "1 1 auto" }} />

        {/* A menu needs no close control — Escape, click-away and choosing an
            action all close it, and a × in a context menu reads as a dialog
            that lost its way. The docked strip keeps it: clearing the
            selection is a real act there. */}
      </div>
      {atPointer ? null : (
        <button
          type="button"
          onClick={() => {
            setMenuAt(null);
            clear();
          }}
          aria-label="Clear selection"
          title="Clear selection"
          // Pinned to the pane's corner: a real 24px target that a narrow
          // header cannot push off the edge.
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            flex: "0 0 auto",
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            padding: 0,
            fontSize: 13,
            lineHeight: 1,
            borderRadius: 7,
          }}
        >
          ×
        </button>
      )}

      {/*
        * A selected relation says WHAT IT MEANS — the declaration's own
        * sentence — and offers both of its ends as the next place to stand.
        */}
      {edge && edgeEnds ? (
        <div style={{ display: "grid", gap: 6 }}>
          {edgeSaid ? (
            <p
              data-testid="edge-said"
              style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
            >
              {edgeSaid}
            </p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {([
              ["from", edgeEnds.from],
              ["to", edgeEnds.to],
            ] as const).map(([which, end], index) => (
              <Fragment key={which}>
                {index === 1 ? (
                  <span aria-hidden="true" style={{ color: "var(--graview-ink-faint)" }}>
                    →
                  </span>
                ) : null}
                {end ? (
                  <button
                    type="button"
                    data-testid={`edge-${which}`}
                    onClick={() => set([end.id])}
                    title={`Select ${nameOf(store, end.id)}`}
                    style={{ fontSize: 12, padding: "3px 9px", borderRadius: 999 }}
                  >
                    {nameOf(store, end.id)}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--graview-ink-faint)" }}>gone</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}

      {/* What is true about it. The pane has the room to say the whole
          sentence; anything beyond the first two stays a count with the
          full list in the tooltip. */}
      {said.length > 0 ? (
        <div
          data-testid="observations"
          title={said.map((observation) => observation.text).join("\n")}
          style={{ display: "grid", gap: 3 }}
        >
          {said.slice(0, 2).map((observation) => (
            <p
              key={observation.id}
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.45,
                color: "var(--graview-ink-muted)",
              }}
            >
              {observation.text}
              {observation === said[1] && said.length > 2 ? (
                <span style={{ color: "var(--graview-ink-faint)" }}> +{said.length - 2}</span>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}

      {failed ? (
        <p
          data-testid="refused"
          style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--graview-warn)" }}
        >
          {failed}
        </p>
      ) : null}

      {searchable ? (
        <input
          data-testid="action-filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${arranged.length} actions…`}
          aria-label="Filter actions"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Clearing the filter must not also clear the selection —
              // the document-level Escape stays out of it either way.
              event.stopPropagation();
              if (query.length > 0) setQuery("");
              // An empty field releases the key: blurred, the NEXT Escape
              // reaches the product-wide back-out instead of dying here.
              else event.currentTarget.blur();
              return;
            }
            if (event.key === "Enter" && matched?.length === 1) {
              const sole = matched[0]!;
              // What cannot be taken back is never one generic keystroke:
              // the destructive tail keeps requiring the aimed click.
              if (sole.destructive) return;
              if (sole.open.length > 0) setPending(sole.id);
              else if (act(sole)) setQuery("");
            }
          }}
          style={{
            font: "inherit",
            fontSize: 12.5,
            padding: "5px 9px",
            borderRadius: 8,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-panel)",
            color: "var(--graview-ink)",
          }}
        />
      ) : null}
      {matched !== null && matched.length === 0 ? (
        <p
          data-testid="no-matches"
          style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
        >
          Nothing offered here matches “{query.trim()}”.
        </p>
      ) : null}
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
                edge ? "this relation" : kinds.length === 1 ? `a ${kinds[0]}` : "this mix of kinds"
              } — ${withheld.length} action${withheld.length === 1 ? "" : "s"} withheld.`
            : edge
              ? `Nothing can be done with this line yet — no mutation declares that it makes or breaks "${edge.kind}".`
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
            // A pane and a menu both read as a column. Same list, same
            // components, same order.
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: 2,
          }}
        >
          {sections.map((section, index) => (
            <Fragment key={`${section.heading ?? "plain"}-${index}`}>
              {/* The violation these repairs answer, said over them — or,
                  for the tie group, a quiet caption: a heading is not a
                  warning unless a rule is actually broken. */}
              {section.heading ? (
                <li
                  role="presentation"
                  style={{
                    fontSize: 11,
                    lineHeight: 1.4,
                    color:
                      section.tone === "violation"
                        ? "var(--graview-warn)"
                        : "var(--graview-ink-faint)",
                    ...(section.tone !== "violation"
                      ? { letterSpacing: "0.12em", textTransform: "uppercase" as const, fontSize: 10 }
                      : {}),
                    padding: "2px 2px 1px",
                    marginTop: index > 0 ? 6 : 0,
                  }}
                >
                  {section.tone === "violation" ? "⚠ " : ""}
                  {section.tone === "violation" ? trim(section.heading) : section.heading}
                </li>
              ) : index > 0 ? (
                <li
                  aria-hidden="true"
                  style={{ borderTop: "1px solid var(--graview-edge)", margin: "6px 0 3px" }}
                />
              ) : null}
              {section.items.map((affordance) => (
                <li key={affordance.id} style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
                  <button
                    type="button"
                    data-affordance={affordance.id}
                    data-graview-destructive={affordance.destructive || undefined}
                    aria-pressed={pending === affordance.id}
                    title={affordance.why}
                    style={{
                      padding: "5px 10px",
                      fontSize: 12.5,
                      borderRadius: 8,
                      width: "100%",
                      textAlign: "left",
                      /*
                       * In the pane an action looks PRESSABLE — border and
                       * ground, like every other button in the product. Rows
                       * of bare text read as a list of remarks, and nobody
                       * presses a remark. The pointer menu keeps menu rows;
                       * a menu's own frame already says "choose one".
                       */
                      ...(atPointer
                        ? {
                            border: "1px solid transparent",
                            background: "none",
                            boxShadow: "none",
                          }
                        : {
                            border: "1px solid var(--graview-edge)",
                            background: "var(--graview-panel)",
                            boxShadow: "none",
                          }),
                      // What cannot be taken back says so before it is
                      // pressed — and the ranking has already put it last.
                      ...(affordance.destructive ? { color: "var(--graview-warn)" } : {}),
                      ...(pending === affordance.id
                        ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
                        : {}),
                    }}
                    onClick={() => {
                      if (affordance.open.length > 0) {
                        setPending(pending === affordance.id ? null : affordance.id);
                        return;
                      }
                      act(affordance);
                    }}
                  >
                    {affordance.label}
                    {affordance.open.length > 0 ? (
                      <span style={{ color: "var(--graview-ink-faint)" }}> …</span>
                    ) : null}
                    {matched?.length === 1 &&
                    matched[0]?.id === affordance.id &&
                    !affordance.destructive ? (
                      // The searcher's promise, made visible exactly when
                      // it holds: Enter runs the one act left standing.
                      <span
                        aria-hidden="true"
                        title="Enter runs it"
                        style={{ float: "right", color: "var(--graview-ink-faint)", fontSize: 11 }}
                      >
                        ↵
                      </span>
                    ) : null}
                  </button>
                  {/*
                    * The other hand on the pin. The dev pinned an act by
                    * declaring it; this is the person's side of the same
                    * fact, kept in their browser, outranking the dev's.
                    * Unpinning is the same gesture.
                    */}
                  <button
                    type="button"
                    data-testid="pin-toggle"
                    data-pin-for={affordance.mutation}
                    aria-pressed={affordance.pinned !== undefined}
                    aria-label={
                      affordance.pinned !== undefined
                        ? `Unpin ${affordance.label}`
                        : `Pin ${affordance.label}`
                    }
                    title={
                      affordance.pinned === "declared"
                        ? "Pinned by the app — unpin it for yourself"
                        : affordance.pinned === "user"
                          ? "Unpin"
                          : "Pin to the top"
                    }
                    onClick={() =>
                      setPins(togglePin(pins, affordance.mutation, declaredPins.has(affordance.mutation)))
                    }
                    style={{
                      flex: "0 0 auto",
                      width: 24,
                      minHeight: 24,
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      fontSize: 11,
                      border: "1px solid transparent",
                      background: "none",
                      boxShadow: "none",
                      borderRadius: 7,
                      /*
                       * WHOSE pin, said in the ink: the person's in the
                       * accent, the app's in quiet body ink. Two filled
                       * stars in one colour left no way to tell which pin
                       * was yours to regret.
                       */
                      color:
                        affordance.pinned === "user"
                          ? "var(--graview-accent)"
                          : affordance.pinned === "declared"
                            ? "var(--graview-ink-muted)"
                            : "var(--graview-ink-faint)",
                    }}
                  >
                    {affordance.pinned !== undefined ? "★" : "☆"}
                  </button>
                </li>
              ))}
            </Fragment>
          ))}
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                // What it DOES, not what is behind it. "+9 more" is a label
                // on a quantity; this is a control, and a control says what
                // pressing it will do.
                title={`Show all ${affordances.length} actions`}
                style={{ padding: "4px 10px", fontSize: 12.5, borderRadius: 8 }}
              >
                Show {hidden} more
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
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: 2,
          }}
        >
          {withheld.slice(0, atPointer ? withheld.length : 3).map((action) => (
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
                  width: "100%",
                  textAlign: "left",
                  background: "none",
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
          // On a refusal the prompt stays put with the reason beside it, so
          // a rejected answer can be corrected rather than retyped blind.
          onApply={(args) => {
            if (act(open, args)) setPending(null);
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
export function ActivityRail({
  calls,
  seat,
}: {
  readonly calls: readonly ToolCall[];
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

  if (seat === undefined && calls.length === 0 && changes.length === 0) return null;

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
          data-graview-offstage=""
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
                  fontSize: 10,
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
                        {/*
                          * WHO, by its own id. "claude" was hardcoded for
                          * every agent, so the chat seat's turn wore
                          * another seat's name — and a system author (a
                          * calendar sync) would have read as "you".
                          */}
                        {change.author === "human"
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
        </aside>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- agent */

export interface AgentSeatProps<S extends AnySchema> {
  /** What the seat would do right now, given how much there is to do. */
  label(count: number): string;
  /** Shown while the turn is running. */
  readonly busyLabel: string;
  /** How many things it would touch. Zero means there is nothing to do. */
  readonly count: number;
  /** Said in the tooltip when there is nothing to do. */
  readonly idle: string;
  /**
   * The mutation this seat is really asking for.
   *
   * Named so the seat can be refused BEFORE it is pressed rather than after:
   * the store already knows what this principal may run, and a button that
   * looks live and throws is the worst of both.
   */
  readonly gate?: string;
  readonly testId: string;
  onCall(call: ToolCall): void;
  /** The turn itself. Everything the app knows and the framework does not. */
  run(agent: InAppAgent<S>, runtime: ToolRuntime<S>): Promise<void>;
}

/**
 * A seat an agent sits in, with the chrome that is not about the domain.
 *
 * Four apps had the same forty lines around four different scripts, and the
 * same three faults in all of them: the button never said how much there was
 * to do, it stayed live and silently did nothing when there was none, and a
 * refusal from the store surfaced as an unhandled rejection in the console.
 * The turn is the app's; the rest of this is not.
 *
 * The seat runs as an AGENT ACTING FOR the person sitting in it — same roles,
 * different author. That is what makes "one policy narrows the interface and
 * the agent seat alike" a thing you can watch happen: change seat, and the
 * button is refused in the same breath the actions strip is.
 */
export function AgentSeat<S extends AnySchema>({
  label,
  busyLabel,
  count,
  idle,
  gate,
  testId,
  onCall,
  run,
}: AgentSeatProps<S>) {
  const { store, principal } = useGraview<S>();
  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        author: {
          kind: "agent",
          id: "claude",
          session: "ui",
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
        // Read per call: a pin toggled in the menu after this runtime was
        // built must still reach the seat's tool list — the strip, the
        // pointer menu and the agent must never disagree about the acts.
        derive: () => ({ pins: loadPins() }),
      }),
    [store, principal],
  );
  const agent = useMemo(() => createInAppAdapter(runtime), [runtime]);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => runtime.onCall(onCall), [runtime, onCall]);
  // What it LOOKED AT, into the picture. A read leaves no diff, so the
  // runtime is the only thing that can say it happened.
  useAttention(runtime);
  useEffect(() => setRefused(null), [principal]);

  const permitted =
    gate === undefined || runtime.definitions.some((tool) => tool.name === gate);
  const nothing = count === 0;
  const off = busy || nothing || !permitted;

  const why = !permitted
    ? `Not yours to do from this seat. The store refuses ${gate}, and the actions strip refuses it too.`
    : nothing
      ? idle
      : `${runtime.definitions.length} tools, generated from the schema. Its edits produce the diffs yours do, and Activity can take the turn back.`;

  return (
    <button
      type="button"
      data-testid={testId}
      data-agent-permitted={permitted || undefined}
      disabled={off}
      title={refused ?? why}
      onClick={() => {
        setBusy(true);
        setRefused(null);
        void (async () => {
          try {
            await run(agent, runtime);
          } catch (error) {
            /*
             * A refusal is a RESULT, said on the control that asked for it.
             * Unhandled, it was a console error nobody sees and a button that
             * appeared to do nothing at all.
             */
            setRefused(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(false);
          }
        })();
      }}
      style={{ whiteSpace: "nowrap" }}
    >
      {busy ? busyLabel : nothing ? idle : label(count)}
    </button>
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
      // A move is an adjustment of where you are, so it comes off before the
      // things that decide where you are.
      else if (view.pan !== undefined || Object.keys(view.pins).length > 0) {
        go(withoutMoves(view));
      } else if (view.relation) show(null);
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
       * SCENE FURNITURE, in the scene's corner — the way a map carries its
       * own altitude control.
       *
       * It has lived in two wrong places: floating over the scene as a
       * labelled pill ("awkwardly slammed on top", twice), and then in the
       * command bar, where it spent prime chrome on a control that is about
       * the CANVAS, not the app. The bar is for what the app is; rising and
       * descending is something you do to the picture, so the control sits
       * on the picture — quiet, glyph-first, in the one corner every state
       * leaves empty.
       */
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 5,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        minWidth: 38,
        height: 38,
        padding: overview ? "0 13px" : 0,
        borderRadius: 999,
        fontSize: 12.5,
        whiteSpace: "nowrap",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-low)",
        ...(overview
          ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
          : {}),
      }}
    >
      {/* The mark: three kinds and the relations between them, which is what
          the view itself is. */}
      <svg width="16" height="16" viewBox="0 0 12 12" aria-hidden="true">
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
      {/* Standing in the Graview the control says so, and is the way back;
          idle it is a quiet glyph with its meaning in the tooltip. */}
      {overview ? "Graview" : null}
    </button>
  );
}

/* --------------------------------------------------------------------- trail */

/**
 * Where you are, and the way back. The view used to be printed as a raw URL
 * fragment; the same information reads as a trail.
 */
/**
 * Back and forward, because every stop here is a URL.
 *
 * Travelling into a task changes `focusId`, which changes the address, which
 * means the browser's own back button already works — and that is exactly the
 * problem: the person using the app has to KNOW that its navigation is the
 * browser's. On a screen you reached by double-clicking, the only way out was
 * a breadcrumb crumb or a keyboard shortcut nobody was told about.
 *
 * Disabled rather than hidden at the ends of the history, so the control does
 * not appear and disappear as you move — and never enabled when there is
 * nowhere to go, since an arrow that does nothing is worse than no arrow.
 */
export function Backtrack() {
  const { canGoBack, canGoForward, back, forward } = useBacktrack();
  const style = {
    minWidth: 30,
    height: 26,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 9px",
    fontSize: 13,
    lineHeight: 1,
    borderRadius: 999,
  } as const;
  return (
    <div style={{ display: "inline-flex", gap: 2 }} data-testid="backtrack">
      <button
        type="button"
        onClick={back}
        disabled={!canGoBack}
        aria-label="Back"
        title="Back"
        style={style}
      >
        ←
      </button>
      <button
        type="button"
        onClick={forward}
        disabled={!canGoForward}
        aria-label="Forward"
        title="Forward"
        style={style}
      >
        →
      </button>
    </div>
  );
}

export function Trail({
  home,
  homeLabel,
  children,
}: {
  readonly home: string | null;
  /**
   * The name of the place you are in — omit it when something else on screen
   * already says it.
   *
   * An app with more than one place draws a switcher whose current pill IS
   * the home crumb: it names the place and clicking it goes there. Printing
   * the same words again an inch to the right is the "same string twice on
   * one screen" fault this codebase keeps finding, and it was on every screen
   * of two of the four apps.
   */
  readonly homeLabel?: string;
  readonly children?: ReactNode;
}) {
  const { view, focus, show, go } = useNavigation();
  const { store } = useGraview<AnySchema>();
  const moved = view.pan !== undefined || Object.keys(view.pins).length > 0;
  const focused =
    view.focusId && view.focusId !== home ? store.graph.getNode(view.focusId) : undefined;
  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

  const chip = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    // A crumb is a control, and a control is at least a fingertip tall.
    minHeight: 24,
    padding: "3px 9px",
    fontSize: 13,
    borderRadius: 999,
    borderColor: "var(--graview-accent)",
    color: "var(--graview-accent)",
  } as const;

  /*
   * The home crumb appears only once you have LEFT home.
   *
   * Standing on it, it was a control that did nothing — clicking "This
   * week" while looking at This week goes nowhere — printed an inch
   * above a panel whose own heading said the same three words. Two
   * faults from one element: a dead control and a duplicated string, on
   * every screen of three of the four apps. Away from home it is the way
   * back, which is the entire reason it exists.
   */
  /*
   * Only once FOCUSED away from home. A raised relation is a state OF home,
   * not a departure from it: the panel below still carries home's own title,
   * so the crumb duplicated it an inch above, and the raised chip already
   * holds the way back from the only thing that changed.
   */
  const crumb = homeLabel !== undefined && focused !== undefined;

  const chips: { key: string; node: ReactNode }[] = [];
  if (focused) {
    chips.push({
      key: "focused",
      node: (
        <button
          type="button"
          data-testid="focused"
          // Dropping the focus drops the zoom with it: zoomed into nothing
          // is not a place.
          onClick={() => go(withZoom({ ...view, focusId: home }, false))}
          style={chip}
        >
          {nameOf(store, focused.id)}
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  /*
   * ZOOMED IN says so, and offers the way back out. The state is a stop like
   * the others — Escape backs out of it first, this chip is the visible
   * version of the same move.
   */
  /*
   * THE PAST says so, and offers the way back to now. Widening the horizon
   * is a stop; the chip is the visible version of leaving it.
   */
  if (view.past) {
    chips.push({
      key: "past",
      node: (
        <button
          type="button"
          data-testid="past"
          onClick={() => go(withPast(view, false))}
          title="Back to now — retired things leave the picture again"
          style={chip}
        >
          the past
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  if (view.zoom) {
    chips.push({
      key: "zoomed",
      node: (
        <button
          type="button"
          data-testid="zoomed"
          onClick={() => go(withZoom(view, false))}
          title="Zoom back out"
          style={chip}
        >
          zoomed in
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  /*
   * WHAT YOU MOVED, and the way to put it back.
   *
   * Panning and dragging are ordinary view state, so they are in the URL
   * and they survive a reload — which means without a way to undo them
   * a scene someone nudged stays nudged for ever. It sits in the trail
   * with the other things you can back out of, because that is what it
   * is.
   */
  if (moved) {
    chips.push({
      key: "moved",
      node: (
        <button
          type="button"
          data-testid="moved"
          onClick={() => go(withoutMoves(view))}
          title="Put the camera and everything you dragged back where the layout wanted them"
          style={chip}
        >
          moved
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  if (view.relation) {
    chips.push({
      key: "raised",
      node: (
        <button
          type="button"
          data-testid="raised"
          onClick={() => show(null)}
          title={`Stop showing ${plural(view.relation!)}`}
          style={chip}
        >
          {plural(view.relation)}
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }

  return (
    <nav
      aria-label="View"
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, minWidth: 0 }}
    >
      {crumb ? (
        <button
          type="button"
          onClick={() => focus(home)}
          style={{
            border: "none",
            background: "none",
            padding: "3px 0",
            minHeight: 24,
            whiteSpace: "nowrap",
            color: "var(--graview-ink-muted)",
          }}
        >
          {homeLabel}
        </button>
      ) : null}
      {/* A separator separates: it appears between two things, never as a
          leader on the first. With no home crumb the first chip opens the
          trail bare, because a "›" pointing at nothing was read as a
          rendering fault — which it was. */}
      {chips.map(({ key, node }, index) => (
        <Fragment key={key}>
          {crumb || index > 0 ? <span style={{ color: "var(--graview-ink-faint)" }}>›</span> : null}
          {node}
        </Fragment>
      ))}
      {children}
    </nav>
  );
}
