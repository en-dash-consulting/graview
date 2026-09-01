import {
  describeNode,
  labelOf,
  readableFields,
  type AnySchema,
  type KindOfSchema,
} from "@graview/core";
import { kindCardId } from "@graview/layout";
import {
  createViews,
  useNavigation,
  useSelection,
  type ReactViewRegistry,
  type ViewProps,
} from "@graview/react";
import { Connections } from "./connections.js";
import { EditableTitle, Fields } from "./editable.js";
import { Aggregate, Chip, Panel, Roster } from "./primitives/index.js";

/**
 * A generic view for every cell of the matrix, derived from the declaration.
 *
 * This is what makes "a new node kind renders acceptably at all three
 * fidelities with zero custom view code" true rather than aspirational: the
 * declaration already carries the label, the plural and the fields, so a
 * sensible rendering exists the moment the kind does. An author overrides
 * only the cells they actually care about.
 */

/** Stable hue per kind, so a kind looks the same everywhere it appears. */
export function hueFor(kind: string): number {
  let h = 2166136261;
  for (let i = 0; i < kind.length; i++) {
    h ^= kind.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 360) / 360;
}


/**
 * The field a shortened label was shortened FROM, when there is one.
 *
 * Matched by stem rather than by name, because which field a label came from
 * is the app's business — `label: (node) => summarise(node.text)` names no
 * field the framework can see, and asking every app to declare it would be
 * asking them to repeat themselves.
 */
function longFormOf(
  node: Record<string, unknown>,
  short: string,
): string | undefined {
  if (!short.endsWith("…") && !short.endsWith("...")) return undefined;
  const stem = short.replace(/[…]|\.\.\.$/g, "").trim();
  if (stem.length < 12) return undefined;
  for (const value of Object.values(node)) {
    if (typeof value !== "string") continue;
    if (value.length > stem.length && value.startsWith(stem)) return value;
  }
  return undefined;
}

export function registerDefaultViews<S extends AnySchema>(
  schema: S,
  registry: ReactViewRegistry<S> = createViews(schema),
): ReactViewRegistry<S> {
  for (const kind of schema.kinds as readonly KindOfSchema<S>[]) {
    const definition = schema.tryDefinition(kind as string);
    const hue = hueFor(kind as string);
    const plural = definition?.plural ?? `${String(kind)}s`;

    const Full = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      /*
       * On a page, the heading is the WHOLE thing.
       *
       * A kind whose label is its own prose shortened — a rationale, a note, a
       * reason — gets a heading cut at sixty characters, which is right on a
       * card in the scene and wrong on a page that has room for all of it.
       * Shortening then ALSO listing the full text below is worse again: the
       * same sentence twice, one of them mutilated.
       *
       * So the page looks for the long form of its own heading and uses that,
       * and `Fields` then drops it as already said. The abbreviation was for
       * the card.
       */
      const short = labelOf(definition, node);
      const heading =
        props.mode === "fullscreen" ? (longFormOf(node, short) ?? short) : short;
      return (
        <Panel
          // The name is the rename control. Nothing else on the page repeats
          // it, so the thing you click to change it is the thing itself.
          title={<EditableTitle<S> nodeId={node.id}>{heading}</EditableTitle>}
          /*
           * What THIS node is, when the declaration can say — and only the
           * kind's own description as a fallback.
           *
           * A subtitle that is the kind's description is identical on every
           * node of that kind, which makes it furniture rather than
           * information: it tells you what a rationale is, on a page you
           * reached by choosing one particular rationale.
           */
          subtitle={
            // `describeNode` falls back to "<kind> <label>", which would put
            // the heading back under the heading — so only take it when the
            // declaration actually supplied one.
            definition?.describe
              ? describeNode(definition, node)
              : (definition?.description ?? String(kind))
          }
          selected={props.selected}
          // Something broken is marked WHERE IT IS. A violation implicating
          // two people has to show on those people, not only in a list
          // somebody has to go and open.
          {...(props.flagged?.includes(node.id) ? { tone: "warning" as const } : {})}
          // A card in the scene; a document on a page. Same component, and the
          // only difference is which of those two things it is sitting on.
          fit
        >
          {/*
            * Fields and relationships side by side, both filling the panel.
            *
            * A focused node used to be a short column of raw fields in the
            * corner of a very large white box, which read as an empty page
            * with a debug dump in it. What the panel is FOR is the answer to
            * "what is this and what is it caught up in" — so the graph gets
            * equal billing with the record.
            */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(200px, 1fr) minmax(220px, 1.4fr)",
              gap: "22px 34px",
              alignItems: "start",
            }}
          >
            {/*
              * Every value is editable where a mutation writes it, and
              * visibly read-only where none does. Reading a node closely is
              * when you most want to change it, and the alternative was
              * finding a named mutation in the strip and answering its
              * arguments in a form.
              */}
            <Fields<S>
              id={node.id}
              // What the panel already said: its title and its subtitle. A
              // record repeating its own heading is what made this read as a
              // debug dump rather than as a page about something.
              shown={[heading, short, definition?.description]}
            />
            <Connections
              id={node.id}
              empty={`Nothing is connected to this ${String(kind)} yet.`}
            />
          </div>
        </Panel>
      );
    };

    /**
     * Summary is not "full, but smaller". Receded text must stay LEGIBLE, so
     * this drops to a denser arrangement rather than scaling the same content
     * down into mush — that is the whole reason fidelity is an axis.
     */
    const Summary = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      // The same question the record on a page asks, answered by the same
      // function — they used to answer it separately and diverge.
      const fields = readableFields(node, definition, {
        limit: 3,
        said: [labelOf(definition, node)],
      });
      return (
        <Panel
          title={labelOf(definition, node)}
          selected={props.selected}
          tone={props.flagged?.includes(node.id) ? "warning" : "muted"}
          fit
        >
          <Roster
            items={fields.map((field) => ({
              id: field.key,
              label: field.value,
              hue,
            }))}
            max={3}
          />
        </Panel>
      );
    };

    const Glyph = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      const broken = props.flagged?.includes(node.id) ?? false;
      return (
        <Chip
          label={broken ? `${labelOf(definition, node)} ⚠` : labelOf(definition, node)}
          hue={hue}
          selected={props.selected}
          title={broken ? `${String(kind)} — implicated in a problem` : String(kind)}
        />
      );
    };

    const Group = (props: ViewProps<S>) => (
      <Aggregate
        label={props.label ?? plural}
        count={props.nodes?.length ?? 0}
        // A receded group still has to report trouble inside it, or the only
        // way to find a problem is to open every group in turn.
        flagged={(props.nodes ?? []).some((member) => props.flagged?.includes(member.id))}
        items={(props.nodes ?? []).map((member) => ({
          id: member.id,
          label: labelOf(schema.tryDefinition(member.kind), member as never),
          hue: hueFor(member.kind),
        }))}
      />
    );

    /**
     * A group at glyph fidelity.
     *
     * It names its MEMBERS, not just how many there are. "4 AGREEMENTS" tells
     * you a number and nothing you wanted to know; the whole point of a
     * context plane is to be glanceable, and a count is not a glance at
     * anything. What fits, fits; the rest is "+n".
     */
    /**
     * A group at glyph fidelity — the card the kinds plane is made of.
     *
     * Its name, how many there are, and what it is FOR on hover. The members
     * used to be listed and it was the wrong answer: ten cards each showing
     * three truncated names is ten unreadable things, and "which kinds exist
     * and how big are they" is the question a map of kinds is asked. The
     * description has been on every declaration since the first commit and
     * nothing has ever shown it.
     */
    const GroupGlyph = (props: ViewProps<S>) => {
      const members = props.nodes ?? [];
      const { selection } = useSelection();
      const { toggle } = useNavigation();
      const broken = members.filter((member) => props.flagged?.includes(member.id)).length;
      const trouble = broken > 0;
      const accent = props.focused || props.raised;
      /*
       * A kind the focus does not touch is QUIETER, not hidden.
       *
       * The layout already draws it smaller and further back; this is the
       * other half of the same reading, so the card does not look like a
       * full-size one that merely shrank. It stays a real card with a real
       * name — a secondary relation is still somewhere you can go.
       */
      const secondary = props.rank === "secondary" && !accent;
      const nested = props.nestedUnder !== undefined;
      /*
       * How many of this kind's members the SELECTION reaches, one edge away.
       *
       * "What is this thing actually tied to" was unanswerable from the
       * shelf: you selected a span in the calendar and every kind card sat
       * unchanged. The implicated set has always known; the card just never
       * read it. Selected members themselves do not count — a card does not
       * announce a tie to the thing that IS the selection.
       */
      const chosen = new Set(selection);
      const tied = accent
        ? 0
        : members.filter(
            (member) => props.implicated?.includes(member.id) && !chosen.has(member.id),
          ).length;
      /*
       * The block's height from altitude, in viewBox units: population under
       * a square root, so one giant kind is a tall building rather than a
       * tower the scene scrolls for.
       */
      const rise = nested ? 8 : Math.min(46, 10 + Math.round(Math.sqrt(members.length) * 8));
      return (
        <div
          className="graview-kind-card"
          data-graview-rank={props.rank}
          data-graview-nested={nested || undefined}
          data-graview-tied={tied || undefined}
          /*
           * The description lives in the TOOLTIP, on every card.
           *
           * It used to be two clamped lines of prose in the body, which is
           * how a map of ten kinds spent a fifth of the window telling you
           * what a fixture is — a sentence you read once and then look past
           * for ever, cut mid-word ("A match: who, when, what it c…") because
           * it never fit. The card's job is name, count, trouble. The sentence
           * is still one hover away.
           */
          {...(definition?.description || nested
            ? {
                title: nested
                  ? [props.label ?? plural, definition?.description].filter(Boolean).join(" — ")
                  : definition!.description!,
              }
            : {})}
          style={{
            position: "relative",
            height: "100%",
            ["--graview-hue" as string]: Math.round(hue * 360),
          }}
        >
          {/*
            * The DISTRICT, drawn only from altitude (the stylesheet keeps it
            * hidden inside the stack): an isometric block — a roof and two
            * shaded walls — whose height is the kind's population. This is
            * the city: the ground is an iso lattice, and each kind stands on
            * it as a building rather than lying on it as a card.
            */}
          <svg
            className="graview-kind-block"
            viewBox={`0 0 100 ${45 + rise}`}
            aria-hidden="true"
          >
            <polygon className="graview-iso-left" points={`1,22 50,43 50,${43 + rise} 1,${22 + rise}`} />
            <polygon className="graview-iso-right" points={`99,22 50,43 50,${43 + rise} 99,${22 + rise}`} />
            <polygon className="graview-iso-roof" points="50,1 99,22 50,43 1,22" />
          </svg>
          <div
          className="graview-kind-face"
          data-graview-opened={props.opened || undefined}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: nested ? 1 : 3,
            padding: nested ? "5px 7px" : "7px 10px",
            borderRadius: "var(--graview-radius-sm, 9px)",
            /*
             * PLANE 2 IS A GLYPH. Its own fidelity says so.
             *
             * These were 190 by 107 holding a name, a number and a mark, and
             * the band they sit in took a fifth of the window. A card sized
             * for content it does not have is not a map, it is a margin.
             */
            justifyContent: "center",
            position: "relative",
            height: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
            border: accent
              ? "1px solid var(--graview-accent)"
              : tied > 0
                ? "1px solid var(--graview-accent-dim)"
                : `1px solid hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / 0.34)`,
            // The kind you are looking at is brighter and lit, not labelled:
            // a ninety-pixel card has no room for a word that says so.
            /*
             * An OPAQUE face under the tint. A card that was only a wash of
             * colour let every connector show through it — a road running
             * through a building rather than behind it — and in daylight the
             * wash alone read as a pastel sticky note.
             */
            backgroundColor: "var(--graview-panel)",
            backgroundImage: `linear-gradient(hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * ${
              accent ? 1.1 : secondary ? 0.28 : 0.5
            })), hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * ${
              accent ? 1.1 : secondary ? 0.28 : 0.5
            })))`,
            boxShadow: accent ? "0 0 0 1px var(--graview-accent-dim)" : undefined,
          }}
        >
          {/*
            * How much of this is in TROUBLE, as a bar rather than as dots.
            *
            * The count answers "how many" and never "how many of them are
            * broken", which is the question a map of kinds is actually asked.
            * One mark per member answered it and cost forty pixels of card;
            * the same reading fits in three, and a proportion is quicker to
            * take in than a row of squares you have to count.
            *
            * Along the TOP edge, because a card that has something tucked
            * behind it is bitten at the bottom — and a bar drawn there was
            * covered by exactly the card it sits next to. Nothing ever
            * overlaps the top.
            */}
          {!nested && members.length > 0 ? (
            <div
              data-graview-tally={members.length}
              data-graview-broken={broken || undefined}
              aria-hidden="true"
              style={{
                // On the card's own edge, out of the flow: a glyph this size
                // has no spare rows, and taking one made the content overflow.
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                display: "flex",
                height: 3,
                background: `hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / 0.4)`,
              }}
            >
              {broken > 0 ? (
                <span
                  style={{
                    width: `${Math.max(6, Math.round((broken / members.length) * 100))}%`,
                    background: "var(--graview-warn)",
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {/* Title on its own line, marks on the next. Nothing shares a line
              with anything that could grow, so nothing can ever collide —
              which is what a single flex row of title, badge, warning and
              count did at ninety pixels wide. */}
          <span
            style={{
              fontSize: nested ? 10.5 : 13,
              lineHeight: 1.25,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: accent ? "var(--graview-accent)" : "var(--graview-ink-muted)",
              /*
               * A tucked card is a corner peeking out from behind its parent,
               * so its name gets one line. "Unavailability" wrapped to two and
               * pushed the count out of a card that has no spare rows — and
               * the alternative, growing the tuck until it fits, makes it the
               * same size as the thing it is meant to be behind.
               */
              ...(nested
                ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                : { overflowWrap: "anywhere" }),
            }}
          >
            {props.label ?? plural}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                color: trouble ? "var(--graview-warn)" : "var(--graview-ink-faint)",
              }}
            >
              {/*
                * "0" and an empty rectangle reads as a card that failed to
                * load. "none yet" is the same fact and says which of the two
                * it is — the same honesty the actions strip gives when a kind
                * has no verbs.
                */}
              {members.length === 0 ? "none yet" : `${trouble ? "⚠ " : ""}${members.length}`}
            </span>
            {/* The selection's reach into this kind, said in place. */}
            {tied > 0 ? (
              <span style={{ fontSize: 11.5, color: "var(--graview-accent)" }}>
                {tied} tied
              </span>
            ) : null}
            {/*
              * Whether this kind has a picture of its own to go into.
              * Derived: a view the app registered rather than the generic one
              * the framework fell back to.
              */}
            {props.hasOwnView ? (
              <span
                title={`${plural} has a view of its own`}
                aria-label="has its own view"
                style={{ fontSize: 9.5, color: "var(--graview-accent)" }}
              >
                ◆
              </span>
            ) : null}
            {/*
              * OPEN THE DISTRICT: from altitude, show who is in it, in
              * place — the ring never re-flows and every member is a real
              * pick target, so selection and ties land on the members
              * themselves. Ordinary expanded view state: a URL, a stop, the
              * back button knows. The stylesheet hides this control inside
              * the stack, where expanding dissolves the card instead.
              */}
            {!nested && members.length > 0 ? (
              <button
                type="button"
                className="graview-kind-open"
                data-testid={`open-${String(kind)}`}
                aria-expanded={props.opened ?? false}
                title={props.opened ? "Close it up" : `See the ${plural} in here`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(kindCardId(String(kind)));
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {props.opened ? "▾" : "▸"}
              </button>
            ) : null}
          </div>
          {props.opened ? (
            <div className="graview-kind-members">
              {members.slice(0, 12).map((member) => (
                <Chip
                  key={member.id}
                  pickId={member.id}
                  label={labelOf(definition, member as never)}
                  hue={hue}
                  selected={chosen.has(member.id)}
                />
              ))}
              {members.length > 12 ? (
                <span style={{ fontSize: 11, color: "var(--graview-ink-faint)", alignSelf: "center" }}>
                  +{members.length - 12} more
                </span>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>
      );
    };

    // Marked so the interface can tell a view the app chose from one the
    // framework fell back to.
    (Group as unknown as { generic?: boolean }).generic = true;
    (GroupGlyph as unknown as { generic?: boolean }).generic = true;

    registry
      .register(kind, { cardinality: "one", fidelity: "full" }, Full)
      .register(kind, { cardinality: "one", fidelity: "summary" }, Summary)
      .register(kind, { cardinality: "one", fidelity: "glyph" }, Glyph)
      .register(kind, { cardinality: "many", fidelity: "full" }, Group)
      .register(kind, { cardinality: "many", fidelity: "summary" }, Group)
      .register(kind, { cardinality: "many", fidelity: "glyph" }, GroupGlyph);
  }

  return registry;
}
