import { labelOf, type AnySchema, type ArrangeOption, type Arrangement, type NodeOfSchema } from "@graview/core";
import { useArranging } from "./arranging.js";
import { useGraview, useViolations, type ViewProps } from "@graview/react";
import { onTheHorizon } from "./horizon.js";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";

/**
 * The board lens: things arranged where the DOMAIN says they go.
 *
 * The third picture, and the first one whose geometry the framework does not
 * own. A timeline places by time; a matrix places by two sets; a board places
 * by coordinates the app declares on its own nodes — a formation on a pitch,
 * desks in an office, a stage plot, seats at a table, bays in a warehouse.
 *
 * That distinction matters more than it looks. Everywhere else, layout is a
 * pure function of (focus, relation, graph) and the framework decides where
 * things sit. Here the arrangement is DATA: a left back is at the left back's
 * place because the position node says so, and moving it is an ordinary
 * mutation rather than a change to the layout engine.
 *
 * A slot with nothing in it is the point. On a pitch it is the hole in the
 * team; on a seating plan it is the empty chair. That reads instantly in an
 * arrangement and not at all in a list.
 */

export const BOARD_REQUIRED_ROLES = ["slots", "x", "y", "fill"] as const;

export interface BoardOptions {
  /** Kind whose nodes are the slots. */
  readonly slots: string;
  /** Fields on a slot holding its place, each 0..1 across the board. */
  readonly x: string;
  readonly y: string;
  /** Edge kind between a slot and whatever occupies it. */
  readonly fill: string;
  /**
   * Which end of that edge is the slot. A seating plan says the seat is
   * "taken-by" a guest; a garden says a planting "grows-in" a plot. Both are
   * one edge from slot to occupant, read from opposite ends, and a lens that
   * only knew one of them would make a domain redraw its edges to fit.
   */
  readonly fillFrom?: "slot" | "occupant";
  /**
   * Field holding a short code for the slot, e.g. "LB".
   *
   * WHAT THE CODE IS DECIDES WHAT THE MARK IS. A board whose every code is
   * three characters or fewer — "GK", "LB", "7" — draws discs, the pitch's
   * own idiom. Any code longer than that is a WORD, and a word does not fit
   * in a 34-pixel circle however the circle is drawn: "Outbound" spilled
   * past its ring and "Prop-fin" wrapped at the hyphen inside it. So a board
   * of words draws tokens — a pill sized to its code, the occupants inside
   * it — and it decides once, for the whole board, because a picture that
   * mixed discs and pills would be two pictures. Unbound, the code is the
   * slot's label, which is nearly always a word.
   */
  readonly slotCode?: string;
  /** Bands drawn behind the slots, in the same 0..1 space. */
  readonly zones?: readonly { readonly label: string; readonly from: number; readonly to: number }[];
  /** Width divided by height. A pitch is taller than it is wide, seen this way. */
  readonly aspect?: number;
  /** What an empty slot is called, in the app's words. */
  readonly emptyLabel?: string;
  /**
   * What a chip click selects. Default `"occupant"`: a sole-filled slot's
   * disc is that person (lineup / pitch). `"slot"` always selects the slot
   * itself — Load map wants the component, not the sole owner.
   */
  readonly pickTarget?: "slot" | "occupant";
  /**
   * Whether the occupants may be sorted and filtered from the picture.
   * On unless declined; a board has no place to GROUP, so that part is
   * never offered. `arrangedBy` is what it opens arranged by.
   */
  readonly arranging?: ArrangeOption;
  readonly arrangedBy?: Arrangement;
  /**
   * HOW THE SLOTS ARE LAID OUT. Default `"exact"`: each slot at the point
   * its x and y name, which is a pitch, a seating plan, a warehouse floor —
   * an arrangement whose geometry means something. `"shelf"`: the x and y
   * are CATEGORIES, not coordinates — a load map whose rows are "still
   * owns", "shared", "handoff" — so each zone becomes a band with its name
   * as a heading, and its slots flow into rows in the domain's order, sized
   * to what they hold. Nothing on a shelf can overlap anything, which on a
   * load map with shared seats is the difference between a picture and a
   * collision. The order is still the domain's; only the pixels are not.
   */
  readonly arrange?: "exact" | "shelf";
}

export interface BoardSlot {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /**
   * Whoever is in it — none, one, or several. A plot with two plantings
   * showed one and listed the other as "not in", which was a picture
   * stating something untrue: the second planting was in the ground.
   */
  readonly occupants: readonly { readonly id: string; readonly label: string }[];
}

export interface BoardState {
  readonly slots: readonly BoardSlot[];
  /** Slots with nothing in them. The reason the lens exists. */
  readonly empty: readonly string[];
  /** Candidates not placed in any slot — the bench. */
  readonly spare: readonly { readonly id: string; readonly label: string }[];
}

export class BoardBindingError extends Error {
  constructor(message: string, readonly hint: string) {
    super(`${message}\n  ${hint}`);
    this.name = "BoardBindingError";
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Reads the arrangement out of the graph. Pure and exported, so a test can
 * assert on the holes rather than on the drawing of them.
 */
export function buildBoard<S extends AnySchema>(
  nodes: readonly NodeOfSchema<S>[],
  edges: readonly { kind: string; from: string; to: string }[],
  options: BoardOptions,
  schema?: S,
): BoardState {
  const record = (node: NodeOfSchema<S>) => node as Record<string, unknown>;
  const name = (node: NodeOfSchema<S>) =>
    schema
      ? labelOf(schema.tryDefinition(node.kind), node)
      : String(record(node)["label"] ?? node.id);

  /*
   * AN EMPTY GRAPH IS NOT A MISBINDING. See the same note in coverage.tsx:
   * a blank app has no slots yet and its board's title is already in the
   * bar, so throwing on "no slot nodes" took the scene down at exactly the
   * moment somebody was looking for the empty picture.
   */
  if (schema && schema.tryDefinition(options.slots) === undefined) {
    throw new BoardBindingError(
      `No kind is declared for "${options.slots}".`,
      `Check the lens bindings: { slots: "<kind>", x: "<field>", y: "<field>", fill: "<edge kind>" }`,
    );
  }
  const slotNodes = nodes.filter((node) => node.kind === options.slots);
  if (!schema && slotNodes.length === 0) {
    throw new BoardBindingError(
      `Nothing to arrange: no "${options.slots}" nodes.`,
      `Check the lens bindings: { slots: "<kind>", x: "<field>", y: "<field>", fill: "<edge kind>" }`,
    );
  }

  const filling = edges.filter((edge) => edge.kind === options.fill);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Occupants are drawn in the order the nodes came: an arrangement that
  // sorted them holds within a slot, and the graph's order otherwise.
  const rank = new Map(nodes.map((node, index) => [node.id, index]));

  const slots = slotNodes
    .map((node): BoardSlot => {
      const fields = record(node);
      const fromOccupant = options.fillFrom === "occupant";
      const occupants = filling
        .filter((candidate) => (fromOccupant ? candidate.to : candidate.from) === node.id)
        .map((edge) => byId.get(fromOccupant ? edge.from : edge.to))
        .filter((occupant): occupant is NodeOfSchema<S> => occupant !== undefined)
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
        .map((occupant) => ({ id: occupant.id, label: name(occupant) }));
      return {
        id: node.id,
        code: String(fields[options.slotCode ?? ""] ?? "").trim() || name(node),
        label: name(node),
        x: clamp01(Number(fields[options.x] ?? 0.5)),
        y: clamp01(Number(fields[options.y] ?? 0.5)),
        occupants,
      };
    })
    // Top to bottom, then left to right: a stable reading order for the
    // accessibility tree, which otherwise gets whatever order the graph
    // happened to be in.
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const placed = new Set(slots.flatMap((slot) => slot.occupants.map((occupant) => occupant.id)));
  const occupantKinds = new Set(
    [...placed]
      .map((id) => byId.get(id)?.kind)
      .filter((kind): kind is string => kind !== undefined),
  );
  const spare = nodes
    .filter((node) => occupantKinds.has(node.kind) && !placed.has(node.id))
    .map((node) => ({ id: node.id, label: name(node) }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  return {
    slots,
    empty: slots.filter((slot) => slot.occupants.length === 0).map((slot) => slot.id),
    spare,
  };
}

export interface BoardViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly options: BoardOptions;
  readonly schema?: S;
  /** The occupants to draw, in the order to draw them. Everyone, when unsaid. */
  readonly occupants?: readonly string[];
}

export function BoardView<S extends AnySchema>({
  nodes,
  occupants,
  label,
  fidelity,
  mode,
  options,
  schema,
  implicated = [],
  flagged = [],
}: BoardViewProps<S>) {
  const { store } = useGraview<AnySchema>();
  /*
   * The whole graph, not the aggregate's members.
   *
   * A board's occupants are a DIFFERENT kind from its slots, and an aggregate
   * of positions does not contain the players in them — so reading occupants
   * out of `props.nodes` made every slot report itself empty. The coverage
   * matrix gets away with `props.nodes` because both its kinds are in the
   * aggregate; a board never can. The aggregate still decides what is
   * focused; it just does not decide what can be looked up.
   */
  /*
   * WHO IS DRAWN. Every slot, always — a filter that hid a seat would redraw
   * the room — and the occupants an arrangement kept, in the order it put
   * them; everyone, when nothing was asked.
   */
  const everyone = onTheHorizon(store.graph, store.schema, nodes);
  const forBoard = occupants
    ? [
        ...everyone.filter((node) => node.kind === options.slots),
        ...occupants.map((id) => store.graph.getNode(id)).filter((node): node is NonNullable<typeof node> => node !== undefined),
      ]
    : everyone;
  const board = buildBoard<S>(
    forBoard,
    store.graph.allEdges(),
    options,
    schema,
  );
  const lit = new Set(implicated);
  const broken = new Set(flagged);
  /*
   * WHY a thing is marked, not only that it is.
   *
   * A slot drawn in the warning tone with nothing to explain it is the worst
   * kind of mark: "why is Hana a different colour?" is the question it
   * provokes, and the honest answer — the LEFT MIDFIELD position demands a
   * skill the week does not train — is nothing to do with Hana at all. The
   * violation messages are already computed; the picture just never read
   * them.
   */
  const violations = useViolations<AnySchema>();
  const why = new Map<string, string[]>();
  for (const violation of violations) {
    for (const id of violation.nodeIds) {
      why.set(id, [...(why.get(id) ?? []), violation.message]);
    }
  }
  const reasons = (id: string | null): string[] => (id ? (why.get(id) ?? []) : []);

  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${label ?? "Board"} · ${board.slots.length - board.empty.length}/${board.slots.length}`}
        hue={hueFor("board")}
      />
    );
  }

  if (fidelity === "summary") {
    const holes = board.slots.filter((slot) => board.empty.includes(slot.id));
    return (
      <Panel
        title={label ?? "Board"}
        meta={`${board.slots.length - board.empty.length}/${board.slots.length}`}
        tone={holes.length > 0 ? "warning" : "muted"}
        fit
      >
        {/* No shrunken pitch: a board at a third of its size is a smudge.
            The names of the holes are what someone glancing wants. */}
        {holes.length > 0 ? (
          <Roster
            pick
            max={5}
            items={holes.map((slot) => ({ id: slot.id, label: slot.code }))}
          />
        ) : (
          <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-faint)" }}>Every slot filled.</span>
        )}
      </Panel>
    );
  }

  const aspect = options.aspect ?? 0.68;

  /*
   * The arrangement TURNS to fit the room it is given.
   *
   * A portrait pitch in a landscape band shrinks in both directions at once:
   * height drives it, the aspect follows, and a 1040-pixel card ends up with
   * a 200-pixel pitch and four hundred empty pixels either side — thirteen
   * per cent of the card doing all of the card's work. A pitch has no
   * intrinsic reading direction; drawn side-on with attack to the right it
   * is the same arrangement, television's way round, using the width it was
   * actually given. Measured rather than guessed, because the same lens is
   * drawn in a band, on a page, and in a shrunk copy of either.
   */
  const room = useRef<HTMLDivElement | null>(null);
  const [turned, setTurned] = useState(false);
  /*
   * The room's measured height, because `height: 100%` + `aspect-ratio`
   * cannot be trusted to produce a width here. The board sits in a flex row
   * inside a stretched flex row inside a flexed panel, and in that chain
   * Firefox and WebKit treat the percentage height as indefinite when
   * transferring it through the aspect ratio — the pitch collapsed to its
   * two border pixels, taking every slot's hit target with it. Chromium was
   * lenient, which is how it shipped. The observer below already watches
   * the room, so the width is set from the same measurement.
   */
  const [tall, setTall] = useState<number | null>(null);
  /*
   * A ROOM WITH NO HEIGHT OF ITS OWN drives the board by its WIDTH.
   *
   * The height-driven sizing above assumes the room was given a height — a
   * band in the scene, a page region. In a chapter embed on the docs site
   * the panel sits in a column that is as tall as its content, so the room
   * measured four pixels, the board became six by four, and every slot on
   * it was a four-pixel target hanging off a nothing. Below a height a
   * board could be read at, the board takes the room's width instead and
   * its aspect gives it a height, which is what a board in a document is.
   */
  const LEAST_HEIGHT = 160;
  const [byWidth, setByWidth] = useState(false);
  useEffect(() => {
    const element = room.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const shallow = box.height < LEAST_HEIGHT;
      setByWidth(shallow);
      setTurned(!shallow && aspect < 1 && box.width / box.height > 1.3);
      setTall(shallow ? null : box.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  /** A slot's place on the DRAWN board: turned, attack ends up on the right. */
  const at = (x: number, y: number) => (turned ? { x: 1 - y, y: x } : { x, y });

  /**
   * Every slot carrying a mark, with the sentence that put it there — the
   * slot's own trouble first, then its occupant's, since that is the order a
   * reader's eye meets them on the board.
   */
  /*
   * ONE LINE PER SENTENCE, naming everyone it implicates.
   *
   * A violation about two positions used to print the same sentence twice,
   * once per code — "LM … Recovery runs …" directly above "RM … Recovery
   * runs …" — which reads as a stutter, not as two facts. The sentence is
   * the fact; the codes are who it touches.
   */
  const marked = (() => {
    const byText = new Map<string, { ids: string[]; codes: string[] }>();
    const note = (id: string, code: string, text: string) => {
      const entry = byText.get(text) ?? { ids: [], codes: [] };
      if (!entry.ids.includes(id)) {
        entry.ids.push(id);
        if (!entry.codes.includes(code)) entry.codes.push(code);
      }
      byText.set(text, entry);
    };
    for (const slot of board.slots) {
      for (const text of reasons(slot.id)) note(slot.id, slot.code, text);
      for (const occupant of slot.occupants)
        for (const text of reasons(occupant.id)) note(occupant.id, occupant.label, text);
    }
    return [...byText.entries()].map(([text, entry]) => ({
      id: entry.ids[0]!,
      code: entry.codes.join(", "),
      text,
    }));
  })();

  /*
   * On a full page the board is the PAGE, not a card sitting on one.
   *
   * Lifted out, it kept its border, its shadow and its content-sized height,
   * so "full screen" meant a 477-pixel card marooned in the middle of a
   * 1560-pixel window. `page` is the same view with the card furniture
   * dropped and permission to use the height it was given — which for a view
   * whose entire content is WHERE THINGS ARE is the only version worth
   * lifting out.
   */
  const page = mode === "fullscreen";

  /**
   * The KEY to the marks, in the app's own words.
   *
   * Every other mark on this board explains itself — a dashed outline is
   * visibly a hole, a name is visibly a name — and the warning tint was the
   * one that did not. Naming the flagged slots and the reason turns "why is
   * that one orange" into a sentence, and it is free: these are the same
   * violation messages the problems list already shows.
   */
  const keyList =
    marked.length === 0 ? null : (

        <ul
          data-graview-primitive="board-key"
          style={{
            margin: "2px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 3,
            flex: "0 0 auto",
          }}
        >
          {marked.slice(0, page ? 6 : 2).map((entry) => (
            <li
              key={entry.id}
              data-graview-pick={entry.id}
              // A target in the key is a mark like any other, and said
              // nothing about the selection.
              data-graview-emphasis={lit.size === 0 ? "plain" : lit.has(entry.id) ? "lit" : "dimmed"}
              title={entry.text}
              style={{
                display: page ? "grid" : "flex",
                gap: page ? 1 : 7,
                alignItems: page ? "start" : "baseline",
                fontSize: "0.8125rem",
                lineHeight: 1.45,
                color: "var(--graview-ink-muted)",
                /*
                 * A pick target is a CONTROL, and a control seventeen pixels
                 * tall and a thousand wide is neither hittable nor readable as
                 * one. Marking an element `data-graview-pick` makes the
                 * surface turn it into a button, so it has to be shaped like
                 * one — width to its content, height to a fingertip.
                 */
                minHeight: 24,
                width: "fit-content",
                maxWidth: "100%",
                padding: page ? "2px 0" : "3px 6px",
                marginLeft: page ? 0 : -6,
                borderRadius: 7,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  fontWeight: 600,
                  color: "var(--graview-warn)",
                  letterSpacing: "0.02em",
                }}
              >
                ⚠ {entry.code}
              </span>
              <span
                style={{
                  minWidth: 0,
                  // A column has room to wrap; a line under a card does not.
                  ...(page
                    ? {}
                    : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
                }}
              >
                {entry.text}
              </span>
            </li>
          ))}
          {marked.length > (page ? 6 : 2) ? (
            <li style={{ fontSize: "0.8125rem", color: "var(--graview-ink-faint)" }}>
              +{marked.length - (page ? 6 : 2)} more
            </li>
          ) : null}
        </ul>
    );

  const shelf = options.arrange === "shelf";
  /** Discs hold three characters; anything longer is a word, and a word gets a token. */
  const discs = board.slots.every((slot) => slot.code.length <= 3 && !/\s/.test(slot.code));

  /**
   * ONE SLOT, DRAWN. The mark is a disc or a token — decided for the whole
   * board above — and the wrapper takes its place from the caller: a point on
   * the field, or a spot in a shelf's row.
   */
  const renderSlot = (slot: BoardSlot, placement: React.CSSProperties) => {
    const hole = slot.occupants.length === 0;
    const dim =
      lit.size > 0 && !lit.has(slot.id) && !slot.occupants.some((occupant) => lit.has(occupant.id));
    /*
     * TWO different marks, because they are two different facts.
     *
     * The disc is the SLOT and the name under it is the PERSON, so a
     * rule that fails about the position must not paint the person's
     * badge — that is what made a midfielder look injured when what
     * was actually wrong was that nothing in the week trained the
     * skill her position demands. Marking both the same way was a
     * picture stating something untrue.
     */
    const slotBad = broken.has(slot.id);
    const occupantBad = slot.occupants.some((occupant) => broken.has(occupant.id));
    const bad = slotBad;
    const said = [
      ...reasons(slot.id),
      ...slot.occupants.flatMap((occupant) => reasons(occupant.id)),
    ];
    /*
     * WHO THE MARK STANDS FOR. Default (occupant): one occupant and
     * the mark is them; several and the mark is the slot, each name
     * its own target. pickTarget "slot" always selects the slot —
     * names on a multi-occupant mark stay person targets.
     */
    const one = slot.occupants.length === 1 ? slot.occupants[0]! : null;
    const pickId = options.pickTarget === "slot" ? slot.id : one ? one.id : slot.id;
    const nameProps = (occupant: { id: string }) =>
      one
        ? {}
        : {
            "data-graview-pick": occupant.id,
            /*
             * A MARK SAYS WHAT IT CLAIMS. The names on a slot holding
             * SEVERAL occupants are targets of their own, and they say
             * so in the tree, not only in opacity.
             */
            "data-graview-emphasis": lit.size === 0 ? "plain" : dim ? "dimmed" : "lit",
          };
    // The NAME carries the person's own trouble — an injury, a suspension —
    // and nothing else. A rule about the position has no business marking
    // the person in it.
    const nameColor = (occupant: { id: string }) =>
      broken.has(occupant.id) ? "var(--graview-warn)" : "var(--graview-ink-muted)";
    const emptyWord = options.emptyLabel ?? "empty";
    return (
      <div
        key={slot.id}
        data-graview-pick={pickId}
        data-graview-slot={slot.id}
        data-graview-mark={discs ? "disc" : "token"}
        data-graview-flagged={
          slotBad && occupantBad ? "both" : slotBad ? "slot" : occupantBad ? "occupant" : undefined
        }
        /*
         * Emphasis in the DOM as well as in the paint. A claim about
         * a picture that exists only as a colour cannot be checked by
         * anything — not a test, not a person reading the tree.
         */
        data-graview-emphasis={lit.size === 0 ? "plain" : dim ? "dimmed" : "lit"}
        title={[
          hole
            ? `${slot.label} — nobody in it`
            : `${slot.occupants.map((occupant) => occupant.label).join(", ")} at ${slot.label}`,
          ...said,
        ].join("\n")}
        style={{
          ...placement,
          display: "grid",
          justifyItems: discs ? "center" : "start",
          gap: 3,
          opacity: dim ? 0.5 : 1,
          transition: "opacity 160ms ease",
        }}
      >
        {discs ? (
          <span
            style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              fontSize: "0.75rem",
              letterSpacing: "0.02em",
              // An empty slot is drawn as an OUTLINE, not as a filled
              // shape with no name: the hole should look like a hole.
              border: hole
                ? "1.5px dashed var(--graview-warn)"
                : `1px solid ${bad ? "var(--graview-warn)" : "var(--graview-edge-bright)"}`,
              background: hole ? "transparent" : bad ? "var(--graview-panel-warning)" : "var(--graview-panel)",
              color: hole || bad ? "var(--graview-warn)" : "var(--graview-ink)",
              boxShadow: hole ? undefined : "var(--graview-lift-low)",
            }}
          >
            {slot.code}
            {/*
              * A MARK, not only a tint. Colour alone says "this one is
              * different" and leaves the reader to guess at what and at
              * whom; it is also the one channel a person with a colour
              * deficiency does not have. The badge sits on the disc
              * because the disc is the slot. Never on a hole: a dashed
              * ring has already said it.
              */}
            {slotBad && !hole ? (
              <span
                aria-hidden="true"
                style={{ position: "absolute", top: -3, right: -3, fontSize: "0.6875rem", lineHeight: 1, color: "var(--graview-warn)" }}
              >
                ⚠
              </span>
            ) : null}
          </span>
        ) : (
          /*
           * THE TOKEN: the code on one line, cut with an ellipsis past the
           * width of a long word and carried whole in the title; who is in
           * it on the line beneath, INSIDE the mark, so the mark is one box
           * whose size is known and nothing under it can collide with the
           * row below.
           */
          <span
            style={{
              display: "grid",
              gap: 1,
              minWidth: 0,
              maxWidth: 180,
              padding: "5px 10px 6px",
              borderRadius: 8,
              border: hole
                ? "1.5px dashed var(--graview-warn)"
                : `1px solid ${bad ? "var(--graview-warn)" : "var(--graview-edge-bright)"}`,
              background: hole ? "transparent" : bad ? "var(--graview-panel-warning)" : "var(--graview-panel)",
              boxShadow: hole ? undefined : "var(--graview-lift-low)",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 550,
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: hole || bad ? "var(--graview-warn)" : "var(--graview-ink)",
              }}
            >
              {slot.code}
              {slotBad && !hole ? " ⚠" : null}
            </span>
            {hole ? (
              <span style={{ fontSize: "0.75rem", lineHeight: 1.3, color: "var(--graview-warn)" }}>{emptyWord}</span>
            ) : (
              <span style={{ display: "flex", flexWrap: "wrap", gap: "0 8px", fontSize: "0.75rem", lineHeight: 1.3 }}>
                {slot.occupants.map((occupant) => (
                  <span key={occupant.id} {...nameProps(occupant)} style={{ whiteSpace: "nowrap", color: nameColor(occupant) }}>
                    {occupant.label}
                    {broken.has(occupant.id) ? " ⚠" : ""}
                  </span>
                ))}
              </span>
            )}
          </span>
        )}
        {discs ? (
          hole ? (
            <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap", color: "var(--graview-warn)" }}>{emptyWord}</span>
          ) : (
            slot.occupants.map((occupant) => (
              <span key={occupant.id} {...nameProps(occupant)} style={{ fontSize: "0.75rem", whiteSpace: "nowrap", color: nameColor(occupant) }}>
                {occupant.label}
                {broken.has(occupant.id) ? " ⚠" : ""}
              </span>
            ))
          )
        ) : null}
      </div>
    );
  };

  /**
   * THE SHELF'S BANDS: each zone with the slots whose y falls in it, in the
   * order the domain gave them (top to bottom, then left to right — the
   * board is already sorted so). A slot no zone claims, or a board with no
   * zones, goes in one band with no heading.
   */
  const zones = options.zones ?? [];
  const bands = zones.map((zone, index) => ({
    label: zone.label,
    slots: board.slots.filter(
      (slot) => slot.y >= zone.from && (slot.y < zone.to || (index === zones.length - 1 && slot.y <= zone.to)),
    ),
  }));
  const claimed = new Set(bands.flatMap((band) => band.slots.map((slot) => slot.id)));
  const unclaimed = board.slots.filter((slot) => !claimed.has(slot.id));
  if (unclaimed.length > 0 || bands.length === 0) bands.push({ label: "", slots: unclaimed });

  const field = {
    boxSizing: "border-box" as const,
    borderRadius: 12,
    border: "1px solid var(--graview-edge)",
    // A ground of its own, so the arrangement reads as a place rather
    // than as dots floating on the panel.
    background: "linear-gradient(var(--graview-panel-muted), var(--graview-panel-muted)), var(--graview-panel)",
    overflow: "hidden" as const,
  };

  return (
    <Panel
      title={label ?? "Board"}
      /*
       * Occupancy, stated as occupancy. "Complete" beside a key listing two
       * warnings read as a contradiction — both were true, because
       * "complete" was quietly about slots being filled and never said so.
       */
      meta={
        board.empty.length === 0
          ? `all ${board.slots.length} filled`
          : `${board.empty.length} unfilled`
      }
      {...(page ? { style: { flex: "1 1 auto", minHeight: 0, height: "100%" } } : {})}
    >
      {/* Centred: the focus band is as wide as the widest view an app has,
          and an arrangement hugging the left edge of it reads as unfinished
          rather than as a board with a bench beside it. */}
      {/*
        * An arrangement SCALES to the box it is given.
        *
        * A fixed pitch is the one thing a board must not have: on a short
        * screen it ran past its band and the defence disappeared, which for
        * a view whose entire content is "where things are" is the worst
        * possible failure. Height drives it and the aspect ratio follows, so
        * the formation stays a formation at any size. A shelf has no aspect:
        * it is as tall as its rows and scrolls inside itself past that.
        */}
      <div
        ref={room}
        style={{
          display: "flex",
          gap: 28,
          alignItems: "stretch",
          justifyContent: "center",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        {/*
          * On a page the key goes BESIDE the picture, in the room a tall
          * arrangement leaves on a wide screen.
          *
          * A pitch is 0.72 as wide as it is high, so a full page gives it
          * about a quarter of the width and four hundred empty pixels either
          * side — and the answer to "why is that one marked" was underneath
          * the fold in the middle of all that nothing. Same list, put where
          * the eye already is.
          */}
        {page && keyList ? (
          <div
            style={{
              width: 260,
              flex: "0 0 auto",
              alignSelf: "center",
              display: "grid",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--graview-ink-faint)",
              }}
            >
              What is marked
            </span>
            {keyList}
          </div>
        ) : null}
        {shelf ? (
          /*
           * THE SHELF. Each zone is a band with its name as a heading —
           * a heading row of its own, so it can never sit on a slot — and
           * its slots flow into rows sized to what they hold.
           */
          <div
            data-graview-primitive="board"
            data-graview-arrange="shelf"
            style={{
              ...field,
              overflow: "auto",
              flex: "1 1 auto",
              minWidth: 0,
              alignSelf: "stretch",
              display: "grid",
              alignContent: "start",
            }}
          >
            {bands.map((band, index) => (
              <section
                key={band.label || `band-${index}`}
                data-graview-zone={band.label || undefined}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "10px 14px 14px",
                  ...(index > 0 ? { borderTop: "1px dashed var(--graview-edge)" } : {}),
                }}
              >
                {band.label ? (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--graview-ink-faint)",
                    }}
                  >
                    {band.label}
                  </span>
                ) : null}
                {band.slots.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 12px", alignItems: "flex-start" }}>
                    {band.slots.map((slot) => renderSlot(slot, {}))}
                  </div>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>nothing here</span>
                )}
              </section>
            ))}
          </div>
        ) : (
        /*
          * The zone names live OUTSIDE the field.
          *
          * Inside, they were absolutely positioned at the top-left of each
          * band — which is exactly where a left back stands. "DEFENCE" and
          * the LB slot were drawn on top of each other and read "DEFENCELB",
          * and no arrangement of insets fixes that, because where the slots
          * go is the DOMAIN's decision and the label has no claim on it. A
          * rail beside the field can never collide with anything, and the
          * field stays purely what the graph says.
          */
        /* The rail belongs TO the field, so it travels with it rather than
            sitting a gap away looking like a separate column. Turned, it
            lies along the bottom edge instead of standing beside the left. */
        <div style={{ display: "flex", gap: 5, alignItems: "stretch", minWidth: 0, ...(byWidth ? { flex: "1 1 auto", alignSelf: "flex-start" } : {}) }}>
        {!turned && zones.length > 0 ? (
          <div
            aria-hidden="true"
            style={{ position: "relative", width: 15, flex: "0 0 auto", alignSelf: "stretch" }}
          >
            {zones.map((zone) => (
              <span
                key={zone.label}
                title={zone.label}
                style={{
                  position: "absolute",
                  top: `${zone.from * 100}%`,
                  height: `${(zone.to - zone.from) * 100}%`,
                  right: 0,
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  // A band shorter than its name shows what fits and says
                  // so, rather than the middle of the word.
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--graview-ink-faint)",
                }}
              >
                {zone.label}
              </span>
            ))}
          </div>
        ) : null}

        <div
          data-graview-primitive="board"
          data-graview-arrange="exact"
          style={{
            ...field,
            position: "relative",
            aspectRatio: `${turned ? 1 / aspect : aspect}`,
            ...(byWidth
              ? // The room's width, and the aspect gives the height — see `byWidth`.
                // Not stretched: a stretched flex item takes the row's height, and
                // the row's height is the four pixels this is escaping from.
                { width: "100%", height: "auto", flex: "1 1 auto", minWidth: 0, alignSelf: "flex-start" }
              : {
                  height: "100%",
                  flex: "0 1 auto",
                  // The measured width, once the room has spoken — see `tall`.
                  // The aspect ratio above stays as the first-paint estimate.
                  ...(tall !== null ? { width: Math.round(tall * (turned ? 1 / aspect : aspect)) } : {}),
                }),
            maxWidth: "100%",
          }}
        >
          {zones.map((zone) => (
            <div
              key={zone.label}
              aria-hidden="true"
              style={{
                position: "absolute",
                ...(turned
                  ? {
                      top: 0,
                      bottom: 0,
                      left: `${(1 - zone.to) * 100}%`,
                      width: `${(zone.to - zone.from) * 100}%`,
                      borderLeft: "1px dashed var(--graview-edge)",
                    }
                  : {
                      left: 0,
                      right: 0,
                      top: `${zone.from * 100}%`,
                      height: `${(zone.to - zone.from) * 100}%`,
                      borderBottom: "1px dashed var(--graview-edge)",
                    }),
              }}
            />
          ))}
          {/* Turned, the zone names lie along the field's own bottom edge —
              a rail beside a landscape pitch would push it off its height. */}
          {turned
            ? zones.map((zone) => (
                <span
                  key={`label-${zone.label}`}
                  aria-hidden="true"
                  title={zone.label}
                  style={{
                    position: "absolute",
                    bottom: 3,
                    left: `${(1 - zone.to) * 100}%`,
                    width: `${(zone.to - zone.from) * 100}%`,
                    textAlign: "center",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "var(--graview-ink-faint)",
                  }}
                >
                  {zone.label}
                </span>
              ))
            : null}

          {board.slots.map((slot) =>
            renderSlot(slot, {
              position: "absolute",
              left: `${at(slot.x, slot.y).x * 100}%`,
              top: `${at(slot.x, slot.y).y * 100}%`,
              transform: "translate(-50%, -50%)",
              /*
               * AS WIDE AS WHAT IT HOLDS. An absolutely placed box with no
               * width shrinks to the room between its `left` and the
               * field's edge, so a token placed at 82% of a phone-width
               * board was 22 pixels wide with its word broken inside it —
               * and 22 pixels is not a target. A disc never noticed, being
               * 34 pixels by declaration.
               */
              width: "max-content",
              maxWidth: "100%",
            }),
          )}
        </div>
        </div>
        )}

        {board.spare.length > 0 ? (
          <div style={{ display: "grid", gap: 6, alignContent: "start", minWidth: 0 }}>
            <span
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--graview-ink-faint)",
              }}
            >
              Not in
            </span>
            {/* The bench is made of targets too, and its chips said
                nothing about the selection either. */}
            <Roster
              pick
              max={10}
              items={board.spare.map((spare) => ({
                ...spare,
                emphasis: (lit.size === 0 ? "plain" : lit.has(spare.id) ? "lit" : "dimmed") as
                  | "plain"
                  | "lit"
                  | "dimmed",
              }))}
            />
          </div>
        ) : null}
      </div>

      {/* A page has room beside the picture; a card does not, so on a card
          the key sits underneath it. */}
      {page ? null : keyList}
    </Panel>
  );
}

export interface BoardLens<S extends AnySchema> {
  readonly name: "board";
  readonly requiredRoles: readonly string[];
  readonly options: BoardOptions;
  View(props: ViewProps<S>): ReactElement | null;
  build(
    nodes: readonly NodeOfSchema<S>[],
    edges: readonly { kind: string; from: string; to: string }[],
    schema?: S,
  ): BoardState;
}

export function createBoardLens<S extends AnySchema>(options: BoardOptions): BoardLens<S> {
  /*
   * A real COMPONENT, not a method that happens to call hooks.
   *
   * `View` is rendered as `<lens.View />`, so it is a component — but written
   * as a method on an object literal it looked like one to the hooks lint rule
   * and needed a disable in three files. A disable repeated three times is a
   * rule telling you something, and what it was telling us is that this wanted
   * to be a component.
   */
  function Bound(props: ViewProps<S>) {
    // The SCHEMA comes from the provider: `ViewProps` carries none, so a lens
    // rendered through the registry ran without it and every schema-aware
    // decision inside quietly took its fallback path.
    const { store } = useGraview<S>();
    /*
     * THE OCCUPANTS ARRANGE; THE SLOTS STAY. A filter that hid a slot would
     * redraw the pitch; a sort within a slot's occupants and a filter over
     * who is shown are what a board has room for.
     */
    /*
     * The occupants come from the STORE, not from `props.nodes`: in a scene
     * a board stands for its slots' kind, so the nodes it is handed are the
     * seats, and the people in them are found by the fill edge.
     */
    const state = buildBoard<S>(onTheHorizon(store.graph, store.schema, props.nodes), store.graph.allEdges(), options, store.schema);
    const seated = [...state.slots.flatMap((slot) => slot.occupants.map((occupant) => occupant.id)), ...state.spare.map((spare) => spare.id)];
    const subject = seated.map((id) => store.graph.getNode(id)).filter((node): node is NonNullable<typeof node> => node !== undefined);
    const { arranged, bar } = useArranging<S>(props, {
      ...(options.arranging !== undefined ? { allow: options.arranging } : {}),
      lensAllows: { group: false },
      ...(options.arrangedBy ? { arrangedBy: options.arrangedBy } : {}),
      subject,
    });
    const view = (
      <BoardView<S>
        schema={store.schema}
        {...props}
        options={options}
        {...(options.arranging === false ? {} : { occupants: arranged.nodes.map((node) => node.id) })}
      />
    );
    return bar ? (
      <div style={{ display: "grid", gap: 6, height: "100%", minHeight: 0, gridTemplateRows: "auto 1fr" }}>
        {bar}
        {view}
      </div>
    ) : (
      view
    );
  }

  return {
    name: "board",
    requiredRoles: [...BOARD_REQUIRED_ROLES],
    options,
    /*
     * The SCHEMA comes from the provider, not from the caller.
     *
     * `ViewProps` carries no schema — the registry never passes one — so a
     * lens rendered through the registry ran without it and every
     * schema-aware decision inside quietly took its fallback path. In the
     * timeline that meant an optional field absent on one node looked exactly
     * like a role nobody bound, and a single unplanned task threw for the
     * whole view.
     */
    View: Bound,
    build(nodes, edges, schema) {
      return buildBoard<S>(nodes, edges, options, schema);
    },
  };
}
