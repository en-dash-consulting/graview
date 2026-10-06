import { arrange } from "@graview/core/arrange";
import {
  describeNode,
  humaniseField,
  labelOf,
  nounOf,
  readableFields,
  type AnySchema,
  type KindOfSchema,
  type NodeOfSchema,
  violationsTouching,
} from "@graview/core";
import { withComputed } from "@graview/core/blocks";
import { aggregateId, kindCardId, marqueeHeightFor, rosterRows, withFocus, withJackIn, withOverview, withPast, withWithin } from "@graview/layout/view";
import { useKit, useReached } from "@graview/react/drawing";
import {
  createViews,
  useFound,
  useGraview,
  useNavigation,
  useSelection,
  useViolations,
  isDefaultView,
  type ReactViewRegistry,
  type ViewComponent,
  type ViewProps,
 markDefaultView } from "@graview/react/provider";
import { lazy, Suspense } from "react";
import { arrangementOf, withArrangement } from "./arrangement.js";
/*
 * THE ROW THAT ARRANGES A DISTRICT, fetched when a district is opened full
 * with more than one member in it: every other card draws without it, and a
 * page's first chunk does not carry it (FR-57).
 */
const ArrangeBar = lazy(() => import("./arrange-bar.js").then((bar) => ({ default: bar.ArrangeBar })));
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

// The canonical hue lives beside the other colour logic in @graview/render;
// re-exported here because every view author already imports it from views.
import { hueFor } from "@graview/render";
import { hasFigure, KindFigure } from "./figure.js";
export { hueFor };

/** The declared accent when the installation named one, else the hash. */
export function useHue(kind: string): number {
  const { brand } = useGraview();
  return hueFor(kind, brand?.accents);
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

/**
 * WHAT AN OPENED DISTRICT LISTS: the rows the layout kept room for
 * (`openedRows`), in as many columns as its names can be READ in. Two
 * columns of ninety-five pixels turned every vehicle into "2026 Ma…"; a
 * name needs about seven and a half pixels a character in a 212-pixel
 * roster, and a district of long names keeps one column.
 */
export function rosterOf(names: readonly string[], rows: number): { readonly columns: number; readonly shown: number } {
  const widest = Math.max(0, ...names.slice(0, rows * 2).map((name) => name.length));
  const columns = widest * 7.5 + 28 <= 212 / 2 ? 2 : 1;
  const room = rows * columns;
  // The count line needs no row of its own: it is part of the room reserved.
  return { columns, shown: Math.min(names.length, room) };
}

/** How many members a pile draws as rows before it says how many more. */
const ROWS_SHOWN = 8;

/**
 * Members drawn as their kind's own row (FR-37): one line each, a target
 * for its record, at most `ROWS_SHOWN` and then "+n more".
 */
function MemberRows<S extends AnySchema>({
  View,
  members,
  mode,
  flagged,
}: {
  readonly View: ViewComponent<S>;
  readonly members: readonly NodeOfSchema<S>[];
  readonly mode: ViewProps<S>["mode"];
  readonly flagged?: readonly string[];
}) {
  const { isSelected } = useSelection();
  const shown = members.slice(0, ROWS_SHOWN);
  return (
    <div data-graview-rows="" style={{ display: "grid", gap: 4, minWidth: 0 }}>
      {shown.map((member) => (
        <div key={member.id} data-graview-pick={member.id} style={{ minWidth: 0, cursor: "pointer" }}>
          <View
            node={member as never}
            cardinality="one"
            fidelity="glyph"
            mode={mode}
            selected={isSelected(member.id)}
            {...(flagged?.includes(member.id) ? { flagged: [member.id] } : {})}
          />
        </div>
      ))}
      {members.length > shown.length ? <Chip label={`+${members.length - shown.length} more`} /> : null}
    </div>
  );
}

export function registerDefaultViews<S extends AnySchema>(
  schema: S,
  registry: ReactViewRegistry<S> = createViews(schema),
): ReactViewRegistry<S> {
  for (const kind of schema.kinds as readonly KindOfSchema<S>[]) {
    const definition = schema.tryDefinition(kind as string);
    const plural = definition?.plural ?? `${String(kind)}s`;

    const Full = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      /*
       * WHAT IS WRONG WITH IT, ON IT.
       *
       * A flagged record wore the warning TONE and said nothing: a
       * background tint, no words, no mark, nothing in the accessibility
       * tree. The chips in a district get a "⚠" in their own label and the
       * routed record page carries the rule's sentence — the biggest drawing
       * of the same record, the one you travelled to, was the only place the
       * problem existed purely as a shade. That is W-014's shape, one view
       * along: emphasis painted and not said.
       */
      const violations = useViolations<S>();
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
      const touching = violationsTouching(violations, [node.id]);
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
              empty={`Nothing is connected to this ${nounOf(definition, String(kind))} yet.`}
            />
          </div>
          {touching.length > 0 ? (
            <p
              data-graview-broken=""
              style={{
                margin: "14px 0 0",
                paddingTop: 12,
                borderTop: "1px solid var(--graview-edge)",
                fontSize: "0.875rem",
                color: "var(--graview-warn)",
              }}
            >
              {/* The rule's own sentence, as the problems page says it. The
                  repair is offered in the strip rather than here: this says
                  what is wrong, once. */}
              {touching.map((violation) => violation.message).join(" · ")}
            </p>
          ) : null}
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
      // A glance may say a computed field (FR-83): worked out over the graph this seat sees.
      const { store } = useGraview<S>();
      const read = (definition as { computed?: object } | undefined)?.computed ? (withComputed(store.schema as AnySchema, store.graph as never, node as never) as typeof node) : node;
      const fields = readableFields(read, definition, {
        limit: 3,
        said: [labelOf(definition, node)],
        glance: true,
      });
      const hue = useHue(kind as string);
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
              // Alone on a chip a number or a yes/no is no fact at all.
              label: field.alone,
              hue,
            }))}
            max={3}
          />
        </Panel>
      );
    };

    const Glyph = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      const hue = useHue(kind as string);
      // The mark a broken rule leaves is the kit's, not a literal here.
      const flag = useKit().marks.flag;
      if (!node) return null;
      const broken = props.flagged?.includes(node.id) ?? false;
      return (
        <Chip
          label={broken ? `${labelOf(definition, node)} ${flag}` : labelOf(definition, node)}
          hue={hue}
          selected={props.selected}
          title={broken ? `${humaniseField(nounOf(definition, String(kind)))} — implicated in a problem` : humaniseField(nounOf(definition, String(kind)))}
        />
      );
    };

    const Group = (props: ViewProps<S>) => {
      const { brand, store, views } = useGraview<S>();
      const { view, go } = useNavigation();
      const members = props.nodes ?? [];
      /*
       * A MEMBER DRAWN AS A ROW IS A CELL A VIEW CAN CLAIM (FR-37). One ×
       * glyph is the one line a record is drawn as among many; when the app
       * gave the kind one of its own — a component or a spec's `row` — the
       * focused group draws each member as that line, a target for its
       * record, instead of a chip with the label alone.
       */
      const RowView = views.lookup(String(kind), { cardinality: "one", fidelity: "glyph" });
      const rows = RowView !== undefined && !isDefaultView(RowView) ? RowView : undefined;
      /*
       * THE DEFAULT PICTURE ARRANGES TOO. What a kind can be sorted, filtered
       * and grouped by is in its declaration, and the choice travels in the
       * stop (`in.sort`, `in.filter`, `in.group`, `in.q`) like the calendar's
       * month does — so an arranged district is a link, and Back restores it.
       * The row is drawn at full fidelity, where there is room to read it;
       * the arrangement holds at every fidelity, because the stop does.
       */
      const arrangement = arrangementOf(view);
      const arranged = arrange(members, arrangement, { schema, graph: store.graph, flagged: new Set(props.flagged ?? []) });
      const item = (member: (typeof members)[number]) => ({
        id: member.id,
        label: labelOf(schema.tryDefinition(member.kind), member),
        hue: hueFor(member.kind, brand?.accents),
      });
      const bar =
        props.fidelity === "full" && members.length > 1 ? (
          <Suspense fallback={null}>
            <ArrangeBar
              schema={schema}
              graph={store.graph}
              kind={String(kind)}
              arrangement={arrangement}
              onChange={(next) => go(withArrangement(view, next))}
              kept={{ shown: arranged.nodes.length, of: members.length }}
              style={{ marginBottom: 8 }}
            />
          </Suspense>
        ) : null;
      // A receded group still has to report trouble inside it, or the only
      // way to find a problem is to open every group in turn.
      const flagged = (nodes: readonly { id: string }[]) => nodes.some((member) => props.flagged?.includes(member.id));
      const pile = (label: string, nodes: typeof members, key?: string) =>
        rows ? (
          <Panel key={key} title={label} meta={flagged(nodes) ? `⚠ ${nodes.length}` : nodes.length} tone={flagged(nodes) ? "warning" : "muted"}>
            <MemberRows<S> View={rows} members={nodes} mode={props.mode} {...(props.flagged ? { flagged: props.flagged } : {})} />
          </Panel>
        ) : (
          <Aggregate key={key} label={label} count={nodes.length} flagged={flagged(nodes)} items={nodes.map(item)} />
        );
      if (!arranged.grouped) {
        return (
          <div style={{ display: "grid", gap: 4 }}>
            {bar}
            {pile(props.label ?? plural, arranged.nodes)}
          </div>
        );
      }
      return (
        <div style={{ display: "grid", gap: 8 }} data-graview-grouped={arrangement.group?.by}>
          {bar}
          {arranged.groups.map((group) => pile(`${props.label ?? plural} · ${group.label}`, group.nodes, group.key || "-"))}
        </div>
      );
    };

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
      const roster = rosterOf(
        members.map((member) => labelOf(definition, member)),
        props.openedRows ?? rosterRows(members.length),
      );
      const hue = useHue(kind as string);
      /*
       * THE KIND'S OWN DRAWING, where it has one.
       *
       * The isometric city gives every kind the same block; a figure is
       * what makes one of them a person and another a plot of ground. The
       * brand's say comes first, so an installation with its own drawing
       * keeps the domain's declaration as the domain's.
       */
      const { brand } = useGraview();
      const figure = hasFigure(String(kind), schema, brand);
      const flag = useKit().marks.flag;
      const { selection } = useSelection();
      const { toggle, view, go } = useNavigation();
      const { views, hiddenKinds } = useGraview<S>();
      /*
       * THE DRIVE-IN'S MARQUEE. A kind with a named picture has a drive-in
       * from altitude: a dark screen on its plot and, under it, the showings
       * as real buttons. Pressing one focuses the kind with that showing and
       * descends in one gesture — the lens is already drawn at the plot, so
       * the descent reads as walking up to the screen. On the drive-in that
       * is focused, pressing another showing switches the picture without
       * descending; pressing the one already showing walks up to it.
       */
      const showings = view.overview && !hiddenKinds.has(String(kind)) ? views.places().filter((place) => place.kind === String(kind)) : [];
      const showingNow = props.focused ? (view.within?.["view"] ?? showings[0]?.as) : undefined;
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
      // What the selection reaches — never what a search lit, which is counted apart below.
      const reached = useReached();
      const tied = accent
        ? 0
        : members.filter((member) => reached.includes(member.id) && !chosen.has(member.id)).length;
      /*
       * WHAT THE WORDS FOUND HERE. With a search open, a district with hits
       * is lit and says how many; one with none recedes. Pressing the count
       * descends into the district already narrowed by the same words — the
       * arrangement's `in.q` — so search hands off to the arrangement rather
       * than competing with it.
       */
      const found = useFound();
      const hits = found && !nested ? (found.byKind[String(kind)] ?? 0) : 0;
      /*
       * The block's height from altitude, in viewBox units: population under
       * a square root, so one giant kind is a tall building rather than a
       * tower the scene scrolls for.
       */
      const rise = nested ? 8 : Math.min(46, 10 + Math.round(Math.sqrt(members.length) * 8));
      /*
       * The district's NAME, lifted out of the markup because a figure stands
       * beside it and a name written twice is a name that drifts.
       */
      const name = (
        <span
          style={{
            /*
             * A DISTRICT'S NAME IS READ, not glanced at. Thirteen pixels
             * before the kinds plane's own recession put it on the screen at
             * ten, and the kind above it at under eight — small enough that
             * the bottom of the picture was a row of grey marks rather than
             * a map of the domain.
             */
            fontSize: nested ? "0.75rem" : "0.9375rem",
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
      );
      return (
        <div
          className="graview-kind-card"
          data-graview-rank={props.rank}
          /*
           * A district whose building is its own drawing rather than a box:
           * the nameplate floats clear above it instead of sitting on a roof,
           * because a drawing's top is a head or a lid and a label across it
           * hides the one thing the drawing had to say.
           */
          data-graview-landmark={figure || undefined}
          data-graview-nested={nested || undefined}
          data-graview-tied={tied || undefined}
          data-graview-hits={found && !nested ? hits : undefined}
          data-graview-emphasis={found && !nested ? (hits > 0 ? "lit" : "dimmed") : undefined}
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
            ["--graview-hue" as string]: Math.round(hue),
            /*
             * THE ROOM THE MARQUEE TAKES, told to the drawing under it. The
             * building is sized from the card's height, and the layout grew
             * the card by the marquee's band — so the building grew into the
             * band and the showings stood on its roof. The band's height is
             * the layout's own estimate, and the building sizes from what is
             * left.
             */
            ["--graview-marquee-room" as string]: showings.length > 0 ? `${marqueeHeightFor(showings.map((place) => place.title), 132) + (figure ? 4 : 42)}px` : "0px",
          }}
        >
          {/*
            * The DISTRICT, drawn only from altitude (the stylesheet keeps it
            * hidden inside the stack). This is the city: the ground is an iso
            * lattice, and each kind stands on it as a building rather than
            * lying on it as a card.
            *
            * WHAT IT STANDS AS is the kind's own drawing, where it has one.
            * A figure reduced to an eighteen-pixel chip on the nameplate
            * while an anonymous box carried the whole landmark had the
            * emphasis exactly backwards: the box is what every kind looks
            * like, and the figure is the only thing on the screen that says
            * which kind this is. From altitude the drawing IS the building.
            *
            * The population still reads, in the drawing's SIZE rather than a
            * box's height — same fact, same square root, a channel that does
            * not need the thing to be a box. A kind with no figure keeps the
            * block it always had: a roof and two shaded walls, the height its
            * population.
            */}
          {figure ? (
            <span
              className="graview-kind-block graview-kind-landmark"
              data-graview-opened={props.opened || undefined}
              aria-hidden="true"
              style={{ ["--graview-rise" as string]: rise }}
            >
              <KindFigure kind={String(kind)} schema={schema} {...(brand ? { brand } : {})} size={96} />
            </span>
          ) : /*
           * A KIND WITH NO DRAWING STANDS AS ITS VILLAGE. The anonymous iso
           * block — one box for every kind, its population a height nobody
           * read — is retired at altitude: the members stand as buildings
           * on the plot the scene draws under this card, and the population
           * is the size of the cluster.
           */
          null}
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
                : `1px solid hsl(${Math.round(hue)} 55% var(--graview-tint-lightness) / 0.34)`,
            // The kind you are looking at is brighter and lit, not labelled:
            // a ninety-pixel card has no room for a word that says so.
            /*
             * An OPAQUE face under the tint. A card that was only a wash of
             * colour let every connector show through it — a road running
             * through a building rather than behind it — and in daylight the
             * wash alone read as a pastel sticky note.
             */
            backgroundColor: "var(--graview-panel)",
            backgroundImage: `linear-gradient(hsl(${Math.round(hue)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * ${
              accent ? 1.1 : secondary ? 0.28 : 0.5
            })), hsl(${Math.round(hue)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * ${
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
                background: `hsl(${Math.round(hue)} 55% var(--graview-tint-lightness) / 0.4)`,
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
              count did at ninety pixels wide.

              THE FIGURE GOES BESIDE THE NAME, on the name's own line, because
              the line it wanted for itself is a line this card does not have.
              On the ground a district card is a glyph — seventy pixels holding
              a name, a count, a trouble mark and a control — and a drawing
              above the name pushed the content past the card's own edge on
              every card in the strip: by six pixels where the name is short
              and fourteen where the card is shortest, clipped rather than
              visibly broken, which is why only a measurement caught it.
              Beside the name it costs nothing, the line being already as tall
              as the drawing.

              It is pinned to the TOP of that line, so a name that wraps to two
              grows downward past a drawing that stays where it was — the
              worry that put it on its own row in the first place. A kind
              without a figure is drawn exactly as it always was, because
              nothing about a figure is required. */}
          {figure ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: nested ? 4 : 6 }}>
              <KindFigure
                kind={String(kind)}
                schema={schema}
                {...(brand ? { brand } : {})}
                /*
                 * The size the LINE can carry, not the size the card looks
                 * like it could: the name beside it sets the row's height, and
                 * a drawing taller than that grows the row and puts the card's
                 * content over its own edge again — which is what twenty-six
                 * did on the shortest card in the strip.
                 */
                size={nested ? 14 : 18}
              />
              {name}
            </div>
          ) : (
            name
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.875rem" }}>
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
              {members.length === 0 ? "none yet" : `${trouble ? `${flag} ` : ""}${members.length}`}
            </span>
            {/*
              * What sits BEHIND THE HORIZON, advertised where it dropped
              * from. Pressing it widens the view to the past — an ordinary
              * stop, with the trail carrying the way back — after which the
              * count includes everyone and this control has nothing to say.
              */}
            {(props.retired ?? 0) > 0 ? (
              <button
                type="button"
                className="graview-kind-past"
                data-graview-retired={props.retired}
                title={`${props.retired} retired ${plural.toLowerCase()} — press to widen the view to the past`}
                onClick={(event) => {
                  event.stopPropagation();
                  go(withPast(view, true));
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                +{props.retired} past
              </button>
            ) : null}
            {hits > 0 ? (
              <button
                type="button"
                className="graview-kind-hits"
                data-testid={`hits-${String(kind)}`}
                title={`${hits} ${hits === 1 ? "match" : "matches"} for “${view.q ?? ""}” — press to go in, narrowed`}
                onClick={(event) => {
                  event.stopPropagation();
                  // The same descent a double-click on the lit district makes: one transition, not three.
                  go(withJackIn(view, kindCardId(String(kind)), { ownPicture: true, ...(view.q ? { carry: view.q } : {}) }));
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {hits} match
              </button>
            ) : null}
            {/* The selection's reach into this kind, said in place. */}
            {tied > 0 ? (
              <span style={{ fontSize: "0.8125rem", color: "var(--graview-accent)" }}>
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
                style={{ fontSize: "0.6875rem", color: "var(--graview-accent)" }}
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
            {/*
              * A DISTRICT WHOSE MEMBERS ARE THE PICTURE ABOVE CANNOT BE
              * OPENED, so it must not offer to be.
              *
              * The layout refuses to open the district of the kind in focus
              * — its members are already drawn, at size, and the same names
              * twice is what the ring exists to avoid. The control was
              * offered anyway: pressing it wrote `expand=` into the stop,
              * the next frame dropped it, the card still read "open ▾" and
              * nothing moved. Saying where they are is the honest answer;
              * a button that cannot do its own job is not.
              */}
            {/* The focused district's picture stands on its own plot as a screen; the plate says nothing about it, the screen does. */}
            {!nested && members.length > 0 && !props.focused ? (
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
                <span className="graview-kind-open-word">{props.opened ? "close" : "open"}</span> {props.opened ? "▴" : "▾"}
              </button>
            ) : null}
          </div>
          {props.opened ? (
            /*
             * BUILDINGS. An opened neighbourhood lays its members out inside
             * its plot as a small grid on the lattice — `side` to a row, the
             * plot's own width in cells — rather than a column of chips. Each
             * is still a Chip with a pick id, so measuring, ties and the
             * keyboard work for free; past `side × side` the rest are counted.
             */
            <div
              className="graview-kind-members"
              data-graview-buildings={props.plot?.side ?? 1}
              style={{
                display: "grid",
                /*
                 * A NAME YOU CAN READ BEATS A GRID THAT MATCHES THE PLOT.
                 *
                 * The members were laid out `side` to a row so the chips
                 * echoed the buildings on the lattice — which at a district's
                 * own width meant sixty pixels a chip, and "Enough bodies for
                 * the drill" arrived as "Eno…". Opening a district is the
                 * gesture that asks WHICH ONE; a row of initials cannot
                 * answer it. So the columns are set by what the widest name
                 * needs, and a district only wide enough for one keeps one.
                 */
                gridTemplateColumns: `repeat(${roster.columns}, minmax(0, 1fr))`,
                gap: 3,
              }}
            >
              {members.slice(0, roster.shown).map((member) => {
                /*
                 * WHICH ONE. The card's own count already says "⚠ 1" —
                 * opening the district to find out which member that is was
                 * the whole point of opening it, and every chip came out
                 * unmarked. The glyph view marks a flagged node exactly this
                 * way; the members inside a district simply never asked.
                 */
                const broken = props.flagged?.includes(member.id) ?? false;
                const name = labelOf(definition, member);
                return (
                  <Chip
                    key={member.id}
                    pickId={member.id}
                    label={broken ? `${name} ${flag}` : name}
                    title={broken ? `${name} — implicated in a problem` : undefined}
                    hue={hue}
                    selected={chosen.has(member.id)}
                  />
                );
              })}
              {members.length > roster.shown ? (
                <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", padding: "2px 4px", gridColumn: "1 / -1" }}>
                  +{members.length - roster.shown} more — double-click to go in
                </span>
              ) : null}
            </div>
          ) : null}
          </div>
          {!nested && showings.length > 0 ? (
            <div
              className="graview-drive-in"
              data-testid={`drive-in-${String(kind)}`}
              data-graview-showing={showingNow}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              {/*
                * THE SHOWINGS, BY NAME (FR-118). A marquee says what is
                * showing in letters a person can read from the street. Each
                * showing was its lens drawn at a seventeenth of its size, cut
                * to a 54-pixel thumbnail with its name under it — "Who o…",
                * "Strengt…", a picture of a place nobody could read and a name
                * cut short. The picture is the billboard's, at its own size,
                * once a showing is pressed; the marquee says each name whole,
                * wrapped onto a second line rather than cut. Pressing one
                * STAYS ALOFT: the kind is focused with that showing, the
                * billboard on its plot shows it, and the camera flies closer.
                */}
              <div className="graview-drive-in-marquee" role="group" aria-label={`${plural}: pictures`} data-graview-thumbs={showings.length === 1 ? "one" : "two"}>
                {showings.map((place) => {
                  const showing = showingNow === place.as;
                  return (
                    <div key={place.as} className="graview-drive-in-thumb" data-graview-pressed={showing || undefined}>
                      <span className="graview-drive-in-thumb-title" aria-hidden="true">{place.title}</span>
                      <button
                        type="button"
                        className="graview-drive-in-thumb-press"
                        data-testid={`showing-${place.as}`}
                        aria-label={`${plural}: ${place.title}`}
                        aria-pressed={showing}
                        title={showing ? `${place.title} is showing` : `Show ${place.title} on the billboard`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (showing && props.focused) return;
                          go(withWithin(withFocus(withOverview(view, true), aggregateId(String(kind))), "view", place.as));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      );
    };

    // Marked so the interface can tell a view the app chose from one the
    // framework fell back to.
    (Group as { generic?: boolean }).generic = true;
    (GroupGlyph as { generic?: boolean }).generic = true;

    registry
      .register(kind, { cardinality: "one", fidelity: "full" }, markDefaultView(Full))
      .register(kind, { cardinality: "one", fidelity: "summary" }, markDefaultView(Summary))
      .register(kind, { cardinality: "one", fidelity: "glyph" }, markDefaultView(Glyph))
      .register(kind, { cardinality: "many", fidelity: "full" }, markDefaultView(Group))
      .register(kind, { cardinality: "many", fidelity: "summary" }, markDefaultView(Group))
      .register(kind, { cardinality: "many", fidelity: "glyph" }, markDefaultView(GroupGlyph));
  }

  return registry;
}
