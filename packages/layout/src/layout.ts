import { isCurrent, toIso, type AnySchema, type GraphReader, type NodeOfSchema } from "@graview/core";
import {
  DEFAULT_OPTIONS,
  type Aggregate,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
  type Plane,
} from "./types.js";
import { placeCity } from "./city.js";
import { rankKinds } from "./rank.js";
import type { ViewState } from "./view-state.js";

import { byStableKey, kindCardId, kindsOfAggregate, BEYOND_CARD } from "./ids.js";
import { connectorsFor, pluralOf, relatedNodes } from "./related.js";

/**
 * Lays the kinds out as a flat shelf: one baseline, even spacing.
 *
 * It used to bow upward in an arc, middle cards lifted and receded. The bow
 * carried no meaning — the row is not curved in the model, and the lift
 * mostly existed to negotiate room with chrome that no longer reserves any.
 * A shelf is a map; a map lies flat. Depth within the plane still separates
 * a secondary kind from a primary one, without moving anything.
 */
const SHELF_DEPTH = 0.85;

/*
 * A kind card holds a name and a count, and that is a fixed number of
 * pixels. Both the ring and the shelf are held to it: the ring has to reason
 * about the height that will be DRAWN, which is this one whenever its own
 * proportional answer lands under it.
 */
const CARD_MIN_HEIGHT = 60;

/*
 * The width a district card needs to hold its own name on one line.
 *
 * Measured rather than chosen: at a 16px root a seven- or eight-letter
 * plural reads on one line down to about 132px of card and breaks between
 * 132 and 98 — the label box is roughly a third of the card, the rest being
 * the figure, the count and the padding. In the reader's own unit, like
 * everything else here.
 */
/* 160, not 132: the type scale went up a step, and "COMPONENTS" in 14px
   capitals — drawn at plane two's 0.9, so 12.6 — needs the room 11.25px
   did not. */
const DISTRICT_MIN_WIDTH = 160;

/**
 * A billboard cut to its picture is never shorter than this, in the lens's
 * own pixels. An empty lens — a header over no rows yet — measured to a
 * strip one line tall, which read as a label, not a screen; at this height
 * the room under the header is visibly an empty screen.
 */
/**
 * HOW FAR A BILLBOARD MAY BE MOVED FROM ITS OWN PLOT, in city cells.
 *
 * Cells rather than pixels so the same pin holds at every zoom: a board
 * nudged two cells north is two cells north whether the city is flown close
 * or seen whole. Two is about a village's width — enough to shift a board
 * off whatever it was covering, not enough for it to read as a picture of
 * somewhere else.
 */
export const SCREEN_LEASH_CELLS = 2;

const SCREEN_MIN_NATURAL_HEIGHT = 240;

/*
 * The width a drive-in screen is never drawn under: the picture is the
 * interface scaled, and below this its words are not words. In the
 * reader's unit, like the districts.
 */
const DRIVE_IN_MIN_WIDTH = 300;

/*
 * THE ROOM A DRIVE-IN'S MARQUEE TAKES under the nameplate: its showings as
 * buttons, wrapped to the card's width. It was one fixed row, and Rota's
 * three long titles wrapped to three and stood on the landmark below. The
 * estimate is the pill's own metrics — eleven-pixel type, eight of padding
 * a side, a four-pixel gap, a twenty-eight-pixel row — so the band is the
 * height the buttons will actually take, and nothing else moves.
 */
/*
 * The showings are PICTURES now: one thumbnail per lens with its name
 * under it — a single showing at 120×72, two or more in two columns of
 * 58×36 — so the band is the rows of thumbnails they make. `cardWidth` is
 * kept for the call sites; the columns are fixed by the thumbnail size.
 */
export const THUMB_ONE = { width: 120, height: 72 };
export const THUMB_TWO = { width: 58, height: 36 };
const THUMB_TITLE = 16;
const MARQUEE_GAP = 4;
export function marqueeHeightFor(titles: readonly string[], cardWidth: number): number {
  void cardWidth;
  if (titles.length === 0) return 0;
  if (titles.length === 1) return 10 + THUMB_ONE.height + THUMB_TITLE;
  const rows = Math.ceil(titles.length / 2);
  return 10 + rows * (THUMB_TWO.height + THUMB_TITLE) + (rows - 1) * MARQUEE_GAP;
}

/*
 * A district's nameplate is a pill drawn by the stylesheet, not the card's
 * box: on a landmark it floats above the box by its own height and a gap,
 * and it is as wide as its words. The screen keeps this much clear of the
 * box's top, and other districts' boxes reach this much further sideways,
 * so a screen never stands on a plate.
 */
const PLATE_CLEARANCE = 52;
const PLATE_REACH = 60;

function shelf(
  count: number,
  size: { width: number; height: number },
  gap: number,
  canvasWidth: number,
  baseY: number,
  depth: number = SHELF_DEPTH,
): { x: number; y: number; depth: number }[] {
  const total = count * size.width + Math.max(0, count - 1) * gap;
  const startX = Math.max(gap, (canvasWidth - total) / 2);
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (size.width + gap),
    y: baseY,
    depth,
  }));
}

/** Lays a row of equal boxes out, centred on the canvas. */
function row(
  count: number,
  size: { width: number; height: number },
  gap: number,
  canvasWidth: number,
  y: number,
): { x: number; y: number }[] {
  const total = count * size.width + Math.max(0, count - 1) * gap;
  const startX = Math.max(gap, (canvasWidth - total) / 2);
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (size.width + gap),
    y,
  }));
}

/**
 * Where everything sits, as a pure function of (focus, relation, graph),
 * overlaid with user pins.
 *
 * Same graph and same view always produce the same picture — that is what
 * lets spatial memory survive, and what lets any two states be interpolated
 * into an animated transition.
 */
export function layout<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  schema: S,
  state: ViewState,
  options: LayoutOptions = {},
): Layout {
  const opts: typeof DEFAULT_OPTIONS & LayoutOptions = { ...DEFAULT_OPTIONS, ...options };
  /*
   * THE SPAN: the canvas less the rail reserved for chrome. Every card is
   * sized and centred within it, in every mode — the inspector and the
   * quick relations live on the left edge whether the picture is the whole
   * domain or one thing, and a lens that takes the full focus width was
   * drawn under them. The reported width stays the canvas's own.
   */
  /*
   * WHAT ONE `rem` IS WORTH. Every card here holds text sized in `rem`, so
   * the cards follow the same number the text does — the whole city grows
   * when a reader asks for bigger words. 16 is the browser's own default,
   * so an app that says nothing lays out exactly as it always has.
   */
  const unit = Math.max(8, opts.unit ?? 16) / 16;
  const railLeft = opts.inset?.left ?? 0;
  const spanW = opts.width - railLeft - (opts.inset?.right ?? 0);
  const nodes: LayoutNode[] = [];
  const placed = new Map<string, LayoutNode>();

  // A group may be focused as readily as a node: "show me the week" and
  // "show me this run" are the same gesture at different granularities.
  /*
   * THE HORIZON. A node retired under its kind's declared lifecycle is not
   * in the picture unless the view has deliberately widened to the past —
   * and everything that drops out is COUNTED where it dropped from, so the
   * archive is one step away rather than gone.
   */
  const current = (node: NodeOfSchema<S>): boolean =>
    state.past === true || isCurrent(schema.tryDefinition(node.kind), node, opts.today);

  /*
   * MODULES OFF are not drawn at all — no card, no members, no raised
   * plane. Unlike the horizon there is no advert and no count: a workspace
   * that turned Vehicles off did not archive its cars, it scoped its
   * interface, and a "+2 elsewhere" pill would reintroduce the very concept
   * the toggle removed. The nodes stay in the graph untouched.
   */
  const hidden = new Set(options.hiddenKinds ?? []);
  const visible = (node: NodeOfSchema<S>): boolean => !hidden.has(node.kind);

  /*
   * A GROUP IS A PLACE WHETHER OR NOT ANYBODY IS IN IT.
   *
   * The kinds are read from the ADDRESS, and then checked against the
   * declaration: `aggregate:nonsense` is a focus id nothing resolves and
   * falls back to the default view below, while `aggregate:item` with no
   * items is a real place holding nobody — which is exactly the picture a
   * blank app needs, and exactly where a lens's empty state lives.
   */
  let focusKinds = state.focusId
    ? kindsOfAggregate(state.focusId)
        .filter((kind) => schema.tryDefinition(kind) !== undefined)
        .filter((kind) => !hidden.has(kind))
    : [];
  /*
   * A URL can point where this workspace cannot go — a bookmarked vehicle
   * in a workspace that turned the module off. The honest landing is the
   * default view, not a void with that node's name on it.
   */
  if (state.focusId && kindsOfAggregate(state.focusId).length > 0 && focusKinds.length === 0) {
    state = { ...state, focusId: null };
  }
  const hiddenFocus = state.focusId ? graph.getNode(state.focusId) : undefined;
  if (hiddenFocus && !visible(hiddenFocus)) {
    state = { ...state, focusId: null };
    focusKinds = [];
  }
  const focusAll =
    focusKinds.length > 0
      ? [...graph.allNodes()]
          .filter((node) => focusKinds.includes(node.kind))
          .sort(byStableKey)
      : [];
  const focusGroup = focusAll.filter(visible).filter(current);
  const focusRetired = focusAll.length - focusGroup.length;
  const focus =
    state.focusId && focusKinds.length === 0 ? graph.getNode(state.focusId) : undefined;

  /*
   * Bands are PROPORTIONS of the canvas, and they tile it.
   *
   * Fixed pixel bands in a scene that is now sized to its container left
   * more than half the height empty — the focus panel floating in the top
   * third with a void beneath it. Every band is a share of the height, so
   * the composition holds at any size, and the three planes read as one
   * arrangement rather than three rows that happen to be stacked.
   *
   * A DETAIL gets a tighter set than a group. The week's calendar fills 56%
   * of the height honestly; one nap does not, and holding the same band open
   * for it puts a small card alone in the top half with several hundred
   * pixels of nothing under it before its relations begin.
   */
  /*
   * Every band ends inside the canvas. This is checked, because it was not
   * true: the group set ran to 1.03 of the height, so the bottom 3% of every
   * context card was cut off on every screen, in every app, from the day the
   * bands became proportional. Nothing scrolls — a scene is sized to its
   * container on purpose — so an overflowing band is content nobody can
   * reach rather than content below the fold.
   */
  /*
   * ZOOMED IN CLOSE, the focus takes most of the scene — most, not all.
   *
   * The shelf and any raised relation keep thin bands at the bottom,
   * receded: the zoomed stop is still a place in the same picture, with its
   * connectors, not a document that replaced it. This is what the jack-in
   * gesture lands on now; the modal page it used to open isolated the view
   * from every relation it had.
   */
  const zoomed = state.zoom === true && !state.overview && state.focusId !== null;
  /*
   * THE SHELF'S OWN HEIGHT HAS A FLOOR, SO ITS TOP CANNOT BE A PROPORTION.
   *
   * A zoomed band put the kinds plane at 89.5% of the height and gave it
   * `max(56, height * 0.062)` — which agree only while the proportion is the
   * larger of the two. On a short canvas the floor wins and the row runs off
   * the bottom: at 390x242, 0.895 puts its top at 217 and 56 more is 273, a
   * card thirty pixels below the screen with nothing to scroll. Every other
   * band in this function ends inside the canvas by arithmetic; this one
   * ended inside it by luck, and a generated declaration at a phone's
   * proportions is where the luck ran out.
   *
   * The floor decides where the top is, not the other way round.
   */
  const zoomedContextH = Math.max(56, opts.height * 0.062);
  const zoomedContextY = Math.min(opts.height * 0.895, opts.height - zoomedContextH);
  const band = zoomed
    ? focus !== undefined
      ? {
          // A zoomed RECORD is a reading column with its neighbourhood
          // under it at full size: the column does not need the height a
          // dense picture does, and a neighbourhood squeezed into a sliver
          // clipped its own cards.
          focusY: opts.height * 0.03,
          focusH: opts.height * 0.58,
          relationY: opts.height * 0.645,
          relationH: opts.height * 0.2,
          contextY: zoomedContextY,
          contextH: zoomedContextH,
        }
      : {
          // A zoomed PLACE is the dense picture: most of the scene, with a
          // raised relation kept usable and the shelf receded below.
          focusY: opts.height * 0.03,
          focusH: opts.height * 0.71,
          relationY: opts.height * 0.765,
          relationH: opts.height * 0.1,
          contextY: zoomedContextY,
          contextH: zoomedContextH,
        }
    : focus === undefined
      ? {
          /*
           * Checked WITH a relation raised, which is the state that broke:
           * the old proportions left plane 1's bottom edge minus one pixel
           * from plane 2's top, and the raised cards sat directly on the
           * kinds shelf. Every band boundary here keeps clear ground below
           * it at any canvas height the surveys cover.
           */
          focusY: opts.height * 0.045,
          focusH: opts.height * 0.62,
          relationY: opts.height * 0.68,
          relationH: opts.height * 0.2,
          contextY: opts.height * 0.918,
          contextH: opts.height * 0.082,
        }
      : (() => {
          /*
           * A SHORT CANVAS gives the focus more of itself. At a window's
           * height 42% is a card with room to spare; in a box the height of
           * a paragraph it is a card cut across its own facts. The focus
           * takes up to 56% until it has 300 pixels, and the relations band
           * gives up what the focus took; at 715 and above nothing changes.
           */
          const h = opts.height;
          const focusY = h * 0.04;
          const focusH = Math.max(h * 0.42, Math.min(h * 0.56, 300));
          const relationY = focusY + focusH + h * 0.06;
          return {
            focusY,
            focusH,
            relationY,
            relationH: Math.max(h * 0.12, h * 0.878 - h * 0.068 - relationY),
            contextY: h * 0.878,
            contextH: h * 0.092,
          };
        })();

  /*
   * A group gets the whole width; a single node does not.
   *
   * The week's calendar has five columns to fill and earns 1040 pixels. One
   * nap, with a name, a time and one person at it, drawn across the same
   * width is a letterbox with four words in it. Narrowing the detail box is
   * the difference between a card and an empty page.
   */
  // Zoomed, a group runs nearly wall to wall; a record stays a readable
  // column even with the room — 880 is a document's width, not a letterbox.
  /*
   * The margin a focused card keeps from the span's edges: six gaps on a
   * screen with room, and never more than a tenth of a narrow one — 96
   * pixels off a 240-pixel span left a lens too thin to draw its own
   * label column, on a frame where the margin was buying nothing.
   */
  const focusMargin = (gaps: number) => Math.min(opts.gap * gaps, Math.round(spanW * 0.1));
  const detailWidth = zoomed
    ? Math.min(880, spanW - focusMargin(5))
    : Math.min(700, spanW - focusMargin(6));
  const groupWidth = zoomed
    ? spanW - focusMargin(5)
    : Math.min(opts.focusSize.width, spanW - focusMargin(6));

  /** Fits `count` boxes across the canvas, never wider than the cap. */
  const fit = (count: number, cap: number, height: number) => ({
    width:
      count === 0
        ? cap
        : Math.min(cap, (spanW - opts.gap * (count + 1)) / count),
    height,
  });

  /*
   * A DISTRICT IS READ, SO IT IS NEVER SQUEEZED BELOW A WORD.
   *
   * `fit` divides the span by the count with no floor, and past a handful of
   * kinds in a narrow host that is a row of one letter per line: measured,
   * a district card needs about 132px at a 16px root to hold a seven- or
   * eight-letter plural on one line, and it breaks somewhere between 132 and
   * 98. Four kinds at 390px gave 46px cards and five lines of "Lists";
   * thirteen kinds at 700px gave 72px and three lines of "Rules". The chips
   * already know how to shed detail — they drop the count and the disclosure
   * before the label — and the missing step was shedding the ROW.
   *
   * So the row holds as many as fit at the floor and hands the rest to one
   * card that names them. Squeezing to one glyph per line is the one answer
   * that communicates nothing.
   */
  const districtRow = (count: number, cap: number, height: number) => {
    const size = fit(count, cap, height);
    /*
     * The floor is a floor until the ROOM runs out, and then the room wins.
     *
     * At the reader's largest text on a phone the unit doubles, so the floor
     * is 264 of a span that is 262 — and a card held to a floor wider than
     * the ground it stands on paints off the edge with nothing to scroll.
     * Wrapping a name is bad; drawing it past the screen is worse.
     */
    const floor = Math.min(cap, DISTRICT_MIN_WIDTH * unit, spanW - opts.gap * 2);
    return size.width >= floor ? size : { width: floor, height };
  };
  /** How many districts fit at the floor, before the row has to shed. */
  const districtCapacity = (cap: number) =>
    Math.max(
      1,
      Math.floor(
        (spanW - opts.gap) /
          (Math.min(cap, DISTRICT_MIN_WIDTH * unit, spanW - opts.gap * 2) + opts.gap),
      ),
    );
  const expanded = new Set(state.expanded);

  // Nothing is raised while you are above the stack: the ring IS the
  // relation plane up here.
  const related = state.overview
    ? []
    : relatedNodes(graph, schema, focus, state.relation, opts.judged)
        .filter((entry) => visible(entry.node))
        .filter((entry) => current(entry.node));

  /*
   * With plane 1 empty, the focus takes the relation band too.
   *
   * The alternative is a void: context used to slide up under the focus
   * whenever nothing was raised, which avoided a dead stripe through the
   * middle but left a bigger one along the bottom, and the week's calendar
   * stayed squeezed into 56% of a screen it could have filled. Growing the
   * focus keeps the context row anchored where it always is, so raising
   * something moves one band rather than re-composing the whole scene.
   */
  const focusHeight =
    related.length > 0
      ? band.focusH
      : band.contextY - band.focusY - opts.gap * 2;

  /*
   * Above the stack your interface STAYS, shrunk, in the middle of the ring.
   *
   * Not a picture of it and not a card standing in for it: the same view, at
   * plane 0, at full fidelity, still live — the board is still a board, the
   * calendar is still a calendar, and anything the platform lets you do to it
   * you can still do. That is the whole point of rising: seeing what you are
   * working on IN RELATION to everything else, rather than swapping it for a
   * diagram of the schema.
   *
   * It can coexist with its own kind card now because the kinds plane has its
   * own namespace — `aggregate:position` and `kind:position` are different
   * things, which they always were.
   */
  /*
   * The slot keeps the proportions of the thing it is showing, so the scale
   * is uniform and the picture is not stretched.
   */
  const naturalW = groupWidth;
  /*
   * Generous on purpose: the view lays itself out here, so a short box means
   * a scrollbar in the middle of the Graview showing one row of nine.
   * Complete and small beats partial and larger.
   *
   * The whole canvas height rather than most of it, because the slot's own
   * size does not depend on this — the scale is what absorbs it. At 0.92 the
   * week and the board each came up a handful of pixels short and put a
   * scroll region inside a picture drawn at 46%, which is a scrollbar nobody
   * can use. Measured in `scripts/verify-shrunk.mjs`.
   */
  const naturalH = opts.height;
  /*
   * The live view is the TALLEST STRUCTURE in the picture, not a peer stamp.
   *
   * At 0.4 by 0.42 the shrunk interface read as one more card among the
   * kinds — the same visual rank as a district of five nodes — and most of
   * the scene was empty ground. Half the width and nearly half the height
   * says what is actually true from up here: this is the thing you were
   * standing in, and everything else is arranged around it.
   */
  const overviewScale = Math.min((spanW * 0.5) / naturalW, (opts.height * 0.48) / naturalH);
  const overviewW = naturalW * overviewScale;
  const overviewH = naturalH * overviewScale;

  // ------------------------------------------------------- plane 0: focus
  /*
   * A focused GROUP, from altitude, is its district when its picture is only
   * the framework's list: the district opens in place instead. A group with
   * its own view keeps the scaled card — and then its district stays shut,
   * so the same names are never drawn twice.
   */
  const plain = new Set(options.plainGroups ?? []);
  const groupFocus = state.overview && !focus && focusKinds.length > 0 && state.focusId !== null;
  const groupIsPlain = groupFocus && focusKinds.length > 0 && focusKinds.every((kind) => plain.has(kind));
  if (groupFocus) {
    /*
     * THE DISTRICT OF THE KIND IN FOCUS IS NOT THE PERSON'S TO OPEN, and
     * that is deliberate: its members are already the picture above, and
     * drawing the same ten names twice is the one thing this layout will
     * not do. A plain group opens in place INSTEAD of the framework's list;
     * a group with a view of its own keeps its card shut.
     *
     * Which means the card must not OFFER to open it. It did — the control
     * wrote `expand=kind:shift` into the stop, this threw it away on the
     * next frame, and nothing moved. See the district card in
     * `@graview/primitives`, which now says where the members are instead.
     */
    for (const kind of focusKinds) {
      if (groupIsPlain) expanded.add(kindCardId(kind));
      else expanded.delete(kindCardId(kind));
    }
  }
  /**
   * A DRIVE-IN, when the focused group's kind has a named picture: the
   * screen will stand on that kind's plot once the city is placed, so the
   * city need not slide aside for it. The showing is the one the address
   * names, or the first the kind has.
   */
  const screenKind = groupFocus && !groupIsPlain && focusKinds.length === 1 ? focusKinds[0]! : undefined;
  const showings = screenKind ? (options.screens?.[screenKind] ?? []) : [];
  const showing = showings.find((one) => one.as === state.within?.["view"]) ?? showings[0];
  const driveIn = screenKind !== undefined && showing !== undefined;
  /** The picture standing in the middle from altitude, when there is one: ground the city must not take. */
  let stamp: { x: number; y: number; width: number; height: number } | undefined;
  if (state.overview && (focus || focusKinds.length > 0) && state.focusId && !groupIsPlain) {
    stamp = {
      x: railLeft + (spanW - overviewW) / 2,
      y: opts.height * 0.53 - overviewH / 2,
      width: overviewW,
      height: overviewH,
    };
    push({
      id: state.focusId,
      kind: focus ? focus.kind : focusKinds[0]!,
      plane: 0,
      // Centred in the span the city uses, so the picture and its city agree.
      x: stamp.x,
      y: stamp.y,
      width: overviewW,
      height: overviewH,
      // Lay out as if it had the whole scene, then draw it small. The view
      // is the view; only the picture is scaled.
      natural: { width: naturalW, height: naturalH },
      ...(focus
        ? {}
        : {
            aggregate: {
              kind: focusKinds.join("+"),
              memberIds: focusGroup.map((node) => node.id),
              label:
                options.plurals?.[state.focusId] ??
                focusKinds.map((kind) => pluralOf(schema, kind)).join(" and "),
              ...(focusRetired > 0 ? { retired: focusRetired } : {}),
            },
          }),
    });
  } else if (state.overview) {
    // nothing focused: the ring is the whole picture
  } else if (focus) {
    push({
      id: focus.id,
      kind: focus.kind,
      plane: 0,
      x: railLeft + (spanW - detailWidth) / 2,
      y: band.focusY,
      width: detailWidth,
      height: focusHeight,
    });
  } else if (focusKinds.length > 0 && state.focusId) {
    push({
      id: state.focusId,
      kind: focusKinds[0]!,
      plane: 0,
      x: railLeft + (spanW - groupWidth) / 2,
      y: band.focusY,
      width: groupWidth,
      height: focusHeight,
      aggregate: {
        kind: focusKinds.join("+"),
        memberIds: focusGroup.map((node) => node.id),
        label:
          options.plurals?.[state.focusId] ??
          focusKinds.map((kind) => pluralOf(schema, kind)).join(" and "),
        ...(focusRetired > 0 ? { retired: focusRetired } : {}),
      },
    });
  }

  // --------------------------------------------------- plane 1: relations
  /*
   * A run of one or two cards takes wider ones. The cap exists to fit a
   * crowd; holding a lone neighbour to crowd width drew one small slip in
   * the middle distance of an otherwise empty band, with its caption
   * stretched past both its edges.
   */
  /*
   * A CROWD WRAPS. Twelve neighbours in one row gave each a slot 57 pixels
   * wide under a chip 150 wide, and the band was a heap of overlapping
   * labels with the lines between them cut to confetti. A slot is never
   * narrower than a chip can be read in; past that the band takes another
   * row, each row sharing the band's height.
   */
  const minRelationW = Math.round(opts.relationSize.width * 0.75);
  const perRow = Math.max(1, Math.floor((spanW - opts.gap) / (minRelationW + opts.gap)));
  const relationRows = Math.max(1, Math.ceil(related.length / perRow));
  const rowH = relationRows === 1 ? band.relationH : (band.relationH - opts.gap * (relationRows - 1)) / relationRows;
  const relationSize = fit(
    Math.min(related.length, perRow),
    related.length <= 2 ? Math.round(opts.relationSize.width * 1.35) : opts.relationSize.width,
    rowH,
  );
  const relationPositions: { x: number; y: number }[] = [];
  for (let r = 0; r < relationRows; r++) {
    const inRow = Math.min(perRow, related.length - r * perRow);
    for (const position of row(inRow, relationSize, opts.gap, spanW, band.relationY + r * (rowH + opts.gap))) {
      relationPositions.push({ ...position, x: position.x + railLeft });
    }
  }
  related.forEach((entry, index) => {
    const position = relationPositions[index]!;
    push({
      id: entry.node.id,
      kind: entry.node.kind,
      plane: 1,
      x: position.x,
      y: position.y,
      width: relationSize.width,
      height: relationSize.height,
      ...(entry.via ? { via: entry.via } : {}),
    });
  });

  /* ----------------------------------------------------- plane 2: the kinds
   *
   * EVERY declared kind, always, in the same place.
   *
   * This used to be "whatever is not on screen", which meant the row's
   * membership changed as you navigated: the kind you were looking at
   * vanished from it, and reappeared somewhere else the moment you looked
   * at something else. That is unreadable as a map — you could not tell that
   * the board WAS Positions, and Positions turning up at the bottom when you
   * switched to training looked like a bug rather than the same card.
   *
   * A constant strip is what makes the plane a map: the kind in focus is
   * marked as focused rather than removed, a raised kind is marked as
   * raised, and nothing ever moves.
   */
  const shown = new Set(placed.keys());
  for (const member of focusGroup) shown.add(member.id);
  const groups = new Map<string, NodeOfSchema<S>[]>();
  for (const node of graph.allNodes()) {
    const list = groups.get(node.kind);
    if (list) list.push(node);
    else groups.set(node.kind, [node]);
  }

  const focusedKinds = new Set(focusKinds.length > 0 ? focusKinds : focus ? [focus.kind] : []);
  const entries: {
    id: string;
    kind: string;
    members: NodeOfSchema<S>[];
    retired: number;
    raised?: boolean;
    focused?: boolean;
  }[] = [];
  for (const kind of schema.kinds as readonly string[]) {
    if (hidden.has(kind)) continue;
    const all = groups.get(kind) ?? [];
    const members = all.filter(current);
    entries.push({
      id: kindCardId(kind),
      kind,
      members: members.sort(byStableKey),
      retired: all.length - members.length,
      ...(focusedKinds.has(kind) ? { focused: true } : {}),
    });
  }
  /*
   * A raised kind keeps its place, emptied.
   *
   * Raising a kind moves every member to plane 1, which used to delete the
   * group from the context plane entirely — so the only sign of what was
   * raised was the breadcrumb. The id is unchanged, so it sorts into exactly
   * the position it held before: the picture you remember is the picture you
   * get, and clicking it again drops the relation.
   */
  for (const entry of entries) {
    if (entry.kind === state.relation) entry.raised = true;
  }
  entries.sort(byStableKey);

  /*
   * RANKED, not merely listed.
   *
   * A strip of nine identical thumbnails says which kinds exist and nothing
   * about which of them matter. What the focus actually touches is drawn full
   * size; what it reaches only through something else is drawn smaller and
   * tucked behind whatever it hangs off, so a nested relationship reads as
   * nested. The ranking comes from the schema, which is what makes it stable:
   * adding a node can never promote a kind and shuffle the row.
   */
  const ranking = rankKinds(schema, focusedKinds);
  /*
   * Ranking only says something when something is actually near. A focus
   * whose kind declares no edges makes EVERY other kind secondary, and a
   * strip where all nine cards shrank together carries no more information
   * than one where none did — only less legibility.
   *
   * On the ring nothing ranks and nothing nests: up there every kind is a
   * district of the same city, what-touches-what is the connectors' job,
   * and a card tucked behind another is a pile — which is exactly the thing
   * altitude exists to undo.
   */
  const ranked =
    !state.overview &&
    (schema.kinds as readonly string[]).some((kind) => ranking.rankOf(kind) === "primary");

  // Expanding an aggregate and collapsing it run through this one loop:
  // an open group contributes its members, a closed one contributes itself.
  const contextItems: {
    id: string;
    kind: string;
    /** The kinds this card stands for, when the row could not hold them all. */
    beyond?: readonly string[];
    aggregate?: Aggregate;
    raised?: boolean;
    focused?: boolean;
    opened?: boolean;
    rank?: "primary" | "secondary";
    nestedUnder?: string;
  }[] = [];
  for (const entry of entries) {
    /*
     * In the stack an expanded aggregate DISSOLVES into its members. From
     * altitude it OPENS instead: the card keeps its ring stop and shows its
     * members in place, because dissolving up there would hand every member
     * its own stop and re-flow the whole map.
     */
    if (!state.overview && expanded.has(entry.id) && entry.members.length > 0) {
      for (const member of entry.members) {
        contextItems.push({ id: member.id, kind: member.kind });
      }
    } else {
      const rank = ranked ? ranking.rankOf(entry.kind) : undefined;
      const parent = rank === "secondary" ? ranking.parentOf(entry.kind) : undefined;
      contextItems.push({
        id: entry.id,
        kind: entry.kind,
        ...(entry.raised ? { raised: true } : {}),
        ...(entry.focused ? { focused: true } : {}),
        ...(state.overview && expanded.has(entry.id) ? { opened: true } : {}),
        ...(rank ? { rank } : {}),
        // Only nest under a card that is actually on the plane: an expanded
        // parent has dissolved into its members and has nothing to hang off.
        ...(parent && !expanded.has(kindCardId(parent))
          ? { nestedUnder: kindCardId(parent) }
          : {}),
        aggregate: {
          kind: entry.kind,
          memberIds: entry.members.map((m) => m.id),
          label: options.plurals?.[entry.kind] ?? pluralOf(schema, entry.kind),
          ...(entry.retired > 0 ? { retired: entry.retired } : {}),
        },
      });
    }
  }

  /*
   * A nested card takes no slot of its own: it hangs off its parent's.
   *
   * Drawn first so the card it belongs to paints over it — same plane, same
   * z-index, so the order here IS the stacking, and "behind" is the whole
   * reading.
   */

  /*
   * TWO of them, at most, and the rest take ordinary slots.
   *
   * Nesting is an emphasis device: "these hang off that". Six kinds sharing a
   * parent turned it into the opposite — the fan divides the parent's width
   * between them, so the coaching week drew FIXTURES, PLAYERS, POSITIONS,
   * RULES, SQUADS and UNAVAILABILITY as six seventy-pixel slivers whose
   * labels ran into each other and whose longest wrapped mid-word. An
   * emphasis that costs legibility is not emphasis, it is damage.
   *
   * The overflow is not demoted — it keeps `rank: "secondary"`, so it is
   * still drawn smaller and further back in its own slot. The ranking
   * survives; only the pile does not. Which two nest is decided by the same
   * stable sort everything else here uses, so this stays a pure function of
   * the view.
   */
  const FANNED_PER_PARENT = 2;
  const fannedSoFar = new Map<string, number>();
  for (const item of contextItems) {
    if (item.nestedUnder === undefined) continue;
    const already = fannedSoFar.get(item.nestedUnder) ?? 0;
    if (already >= FANNED_PER_PARENT) delete (item as { nestedUnder?: string }).nestedUnder;
    else fannedSoFar.set(item.nestedUnder, already + 1);
  }

  const tucked = contextItems.filter((item) => item.nestedUnder !== undefined);
  const inRow = contextItems.filter((item) => item.nestedUnder === undefined);

  /*
   * PAST WHAT THE ROW CAN READ, THE ROW SHEDS.
   *
   * With every card floored at a legible width, a domain with more kinds
   * than the host is wide would run its districts off the edge — so the row
   * holds as many as fit and hands the rest to one card that names them.
   * That card is a district-shaped thing standing for several kinds, and
   * pressing one of the names it lists goes to that district: no new
   * vocabulary, the same gesture the row itself offers.
   *
   * Not at altitude: the ring lays every kind out around the ellipse and has
   * the room, which is the whole reason to rise to it.
   */
  const rowCap = districtCapacity((zoomed ? 240 : opts.contextSize.width) * unit);
  const sheds = !state.overview && inRow.length > rowCap;
  /*
   * The card that names the rest TAKES A SLOT, so the row keeps room for it
   * — and where there is room for only one card, that one card is it. At
   * the reader's largest text on a phone that is the honest answer: one
   * legible list of every district, rather than two cards painting off the
   * edge of the screen.
   */
  const keep = Math.max(0, rowCap - 1);
  const slotted = sheds
    ? [
        ...inRow.slice(0, keep),
        { id: BEYOND_CARD, kind: "", beyond: inRow.slice(keep).map((item) => item.kind) },
      ]
    : inRow;

  /*
   * The overview is the SAME CARDS, on a ring instead of a row.
   *
   * Not a different surface. The kinds plane is already a constant map of
   * every kind, so rising to the overview only has to move those cards —
   * which means `interpolate` tweens them from the strip out into the ellipse
   * for free, and what you were looking at recedes into the middle rather
   * than being replaced by a picture of something else.
   *
   * The ellipse is a circle under a vertical squash, which is affine, so this
   * is the same class of transform the plane model already uses.
   */
  const contextSize = state.overview
    ? // Squat cards: a kind card holds a name, a count and a bar, and a tall
      // one from altitude was mostly empty tint — a sticky note, not a
      // building face.
      // The base a district card has always been. The ring applies the
      // reader's unit itself, because only the ring knows how much room is
      // left to grow into.
      { width: Math.min(220, spanW / 6.5), height: Math.min(92, opts.height * 0.125) }
    : districtRow(slotted.length, (zoomed ? 240 : opts.contextSize.width) * unit, band.contextH);
  /*
   * THE CITY. From altitude the kinds are districts on the declaration's
   * own map — a plot each, on the 2:1 lattice, one uniform scale and
   * translate — so the picture has the same shape at every width and a
   * district is on the corner a person remembers. `placeCity` keeps the
   * collision shrink as a safety net; the placement is the map's.
   */
  const city = state.overview
    ? placeCity(
        slotted.map((item) => ({
          id: item.id,
          kind: item.kind,
          count: item.aggregate?.memberIds.length ?? 0,
          // An opened district lays its members out inside its plot: room
          // for a small grid, in the reader's unit.
          opened: expanded.has(item.id) ? 96 * unit : 0,
          // A district with showings carries their marquee under its name:
          // its buttons, wrapped to the card, in the reader's unit.
          ...((options.screens?.[item.kind]?.length ?? 0) > 0
            ? { marquee: marqueeHeightFor((options.screens?.[item.kind] ?? []).map((place) => place.title), DISTRICT_MIN_WIDTH * unit) * unit }
            : {}),
        })),
        schema,
        contextSize,
        { width: opts.width, height: opts.height },
        opts.inset ?? {},
        {
          ...(opts.cityOrder ? { order: opts.cityOrder } : {}),
          ...(opts.plots ? { plots: opts.plots } : {}),
          scale: unit,
          minHeight: CARD_MIN_HEIGHT * unit,
          ...(options.cityZoom && options.cityZoom !== 1 ? { zoom: options.cityZoom } : {}),
          // Recorded, not applied: the cards already carry it, and the ground reads it to ride the same tween.
          pan: { x: state.pan?.x ?? 0, y: state.pan?.y ?? 0 },
          ...(stamp && !driveIn ? { avoid: [stamp] } : {}),
        },
      )
    : null;
  const plotOf = new Map(city?.placed.map((card) => [card.id, card.plot]) ?? []);
  const contextPositions: {
    x: number;
    y: number;
    depth: number;
    width?: number;
    height?: number;
  }[] = city
    ? city.placed.map(({ x, y, depth, width, height }) => ({ x, y, depth, width, height }))
    : shelf(
        slotted.length,
        contextSize,
        opts.gap,
        spanW,
        band.contextY,
        // Zoomed in, the shelf recedes further — present, quieter.
        zoomed ? 0.97 : SHELF_DEPTH,
      ).map((position) => ({ ...position, x: position.x + railLeft }));

  /*
   * A secondary kind is drawn SMALLER and further back inside its own slot,
   * sitting on the same baseline as its neighbours. Same row, same order,
   * different weight — the eye reads the primaries first without anything
   * having moved.
   */
  const SECONDARY = 0.74;
  /*
   * A tucked card still has to hold a name and a count. Half was sized
   * against a context card twice as tall and clipped the moment the band
   * became a strip of glyphs. It does not go much beyond this: at nearly the
   * parent's size the two cards coincide, which reads as a rendering fault
   * and puts the tucked one out of reach of a click.
   */
  const NESTED = 0.8;
  /*
   * A kind card holds a name and a count, and that is a fixed number of
   * pixels. Every shrink here is proportional — secondary at 0.74, tucked at
   * 0.8 of that, and tucked again by how many share a parent — so at a
   * glyph-sized band the multiplications land under the content and the card
   * clips. Proportion is right until it crosses the floor.
   */
  const TUCK_MIN_HEIGHT = 52 * unit;
  const TUCK_MIN_WIDTH = 86 * unit;
  /** Further back within the plane. 1 is the plane's own depth. */
  const recede = (depth: number, by: number) => Math.min(1, depth + (1 - depth) * by);

  interface Slot {
    x: number;
    y: number;
    depth: number;
    width: number;
    height: number;
  }
  const slotOf = new Map<string, Slot>();
  slotted.forEach((item, index) => {
    const position = contextPositions[index]!;
    // A ring stop carries its own size — nearness grows it. A shelf slot is
    // uniform, and rank shrinks into it.
    const slotW = position.width ?? contextSize.width;
    const slotH = position.height ?? contextSize.height;
    const shrink = item.rank === "secondary" ? SECONDARY : 1;
    /*
     * A SECONDARY DISTRICT IS QUIETER, NOT ILLEGIBLE.
     *
     * The height has had a floor since the band became a strip of glyphs;
     * the width had none, so a rank shrink applied after the row's own
     * sizing took a card that had just been floored at a readable width and
     * put it back under it — 0.74 of 132 is 98, which is where a plural
     * starts wrapping. The same mistake as the row's, one multiplication
     * later. Proportion is right until it crosses the floor.
     */
    const width = Math.max(Math.min(slotW, DISTRICT_MIN_WIDTH * unit), slotW * shrink);
    const height = Math.max(CARD_MIN_HEIGHT * unit, slotH * shrink);
    slotOf.set(item.id, {
      // Centred across the slot it was allotted, sitting on its baseline.
      x: position.x + (slotW - width) / 2,
      y: position.y + (slotH - height),
      depth: item.rank === "secondary" ? recede(position.depth, 0.5) : position.depth,
      width,
      height,
    });
  });

  type PlacedCard = (typeof contextItems)[number] & Slot;
  const placedContext: PlacedCard[] = [];
  const lastSlot = contextPositions[contextPositions.length - 1];

  /*
   * Several kinds can hang off the same one, and stacking them at one point
   * would draw a single card with two others hidden underneath it. They climb
   * off their parent's top-right corner instead — a small pile, each one
   * still a target, each one further back than the last.
   */
  const siblings = new Map<string, number>();
  for (const item of tucked) {
    siblings.set(item.nestedUnder!, (siblings.get(item.nestedUnder!) ?? 0) + 1);
  }
  const seen = new Map<string, number>();

  for (const item of tucked) {
    const parent = slotOf.get(item.nestedUnder!);
    if (parent) {
      const count = siblings.get(item.nestedUnder!) ?? 1;
      const index = seen.get(item.nestedUnder!) ?? 0;
      seen.set(item.nestedUnder!, index + 1);
      /*
       * PEEKING OVER the parent's top edge, from behind.
       *
       * Behind means further, and further means higher on screen — the same
       * reading the whole depth model uses — so a kind reached through
       * another stands behind it the way a building stands behind the one in
       * front. The room above exists now that the focus stops clear of the
       * shelf instead of reaching down over an arc.
       *
       * Below the parent was the old place, and it broke clicking: hovering
       * the parent grows it downward to reveal its note, which covered the
       * tuck under the pointer — the card you were reaching for disappeared
       * under the one it hangs off, and stayed covered while the pointer was
       * on it.
       *
       * Overlap is capped at just under half a card, because a card whose
       * MIDDLE is covered cannot be clicked — the point at the centre belongs
       * to whatever is drawn over it. Where several share a parent they
       * shrink to fit rather than piling up.
       */
      /*
       * Offset enough to read as a pile, not enough to hide a label.
       *
       * At 0.55 each card covered forty-five per cent of the one to its left
       * — and a kind card's label sits along its top edge, so the left card
       * of every pair read as half a word running into the next: "FIXTURES"
       * and "PLAYERS" drawn as "FIXTURESPLAYERS". The offset is a depth cue;
       * it does not have to cost the thing it is a cue about.
       */
      /*
       * AND THE STEP HAS TO CLEAR THE PLANE'S OWN SHRINK.
       *
       * A fan is laid out in layout units and DRAWN at the kinds plane's
       * scale, about each card's centre — so the drawn gap between two
       * tucks is `step − scale` of a card. At 0.86 against a plane drawn at
       * 0.78 that was eight per cent of air; drawn at 0.9 so the words can
       * be read, the same 0.86 became six pixels of one card sitting on the
       * next, and a pile that covers its neighbour's label is the thing
       * this number was lowered to stop.
       */
      const step = 0.98;
      const roomy = contextSize.width * NESTED;
      /*
       * Never smaller than the card's own content.
       *
       * The height followed the width so a fan of two shrank both, and at a
       * glyph-sized band that landed exactly on the height of a name plus a
       * count — so every tucked card in a pair clipped by four or five
       * pixels. A proportional rule is right until it crosses the floor;
       * below that the card is not smaller, it is broken.
       */
      /*
       * The whole fan fits the parent's slot plus its gap, never more.
       *
       * At 1.02 of the parent's width the fan of two spread to 1.86 widths,
       * centred — so it spilled almost half a card into the slot on either
       * side, and "PLAYERS" ran into "UNAVAILABILITY" while every automated
       * check counted the pile as deliberate. A tuck that leaves its
       * parent's ground is not tucked behind anything.
       */
      /*
       * The parent's own ground, and not the air beside it.
       *
       * This allowed the fan `parent.width + gap`, and the gap is not spare
       * room — it is the space that keeps one district off the next. With
       * the kinds plane drawn at 78% the spill fitted anyway; drawn at 90%
       * so its words can be read, the outermost tuck reached into the
       * neighbour and the audit counted the two as one pile. A tuck that
       * leaves its parent's ground is not tucked behind anything.
       */
      const width = Math.max(
        TUCK_MIN_WIDTH,
        Math.min(roomy, parent.width / (step * (count - 1) + 1)),
      );
      const height = Math.max(
        TUCK_MIN_HEIGHT,
        contextSize.height * NESTED * (width / roomy),
      );
      const spread = width * step;
      const fan = (count - 1) * spread + width;
      placedContext.push({
        ...item,
        x: parent.x + (parent.width - fan) / 2 + index * spread,
        /*
         * A FIXED bite behind the parent, not half the tuck.
         *
         * Sixteen pixels of the tuck's bottom sit behind the parent's top
         * edge — enough to read as "behind that one" at any card size,
         * little enough that the tuck's own label and its centre stay
         * clickable above the edge. The parent paints over the overlap, so
         * its name and its trouble bar are never covered.
         *
         * Never above the canvas: a card pushed off the top of the screen is
         * not tucked, it is gone.
         */
        y: Math.max(0, parent.y - height + Math.min(height * 0.5, 16)),
        width,
        height,
        depth: recede(parent.depth, 0.8),
      });
    } else if (lastSlot) {
      const width = contextSize.width * NESTED;
      const height = contextSize.height * NESTED;
      // A parent that never got a slot leaves nothing to hang off. The card
      // is still drawn, at the end of the row, rather than silently dropped.
      placedContext.push({
        ...item,
        x: lastSlot.x,
        y: lastSlot.y,
        width,
        height,
        depth: recede(lastSlot.depth ?? 1, 0.8),
      });
    }
  }
  for (const item of slotted) {
    placedContext.push({ ...item, ...slotOf.get(item.id)! });
  }

  placedContext.forEach((item) => {
    push({
      id: item.id,
      kind: item.kind,
      /*
       * Plane 2 on the ring as well as in the strip.
       *
       * Not because they are peripheral — up here they are the whole subject —
       * but because plane 2 asks for GLYPH fidelity, which is the view that
       * says what a kind IS and how many there are. On plane 1 the position
       * aggregate rendered as the board lens's summary, so half the ring
       * described lenses and half described kinds.
       */
      plane: 2,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      ...(item.aggregate ? { aggregate: item.aggregate } : {}),
      ...(item.raised ? { raised: true } : {}),
      ...(item.focused ? { focused: true } : {}),
      ...(item.opened ? { opened: true } : {}),
      ...(item.rank ? { rank: item.rank } : {}),
      ...(item.nestedUnder ? { nestedUnder: item.nestedUnder } : {}),
      ...(item.beyond ? { beyond: item.beyond } : {}),
      ...(plotOf.has(item.id) ? { plot: plotOf.get(item.id)! } : {}),
      depth: item.depth,
    });
  });

  /*
   * THE SCREEN STANDS ON ITS PLOT. Anchored to the plot's far edge — the
   * top vertex of its diamond — centred on the plot, sized by the plot's
   * side so a bigger neighbourhood has a bigger screen, floored so its
   * words can be read, and shrunk only as a last resort until it covers
   * no other district's nameplate. A picture over two kinds stands on the
   * road between their plots. The same natural size and shrink as before:
   * the interface, scaled, never re-laid-out small.
   */
  if (driveIn && city && stamp && state.focusId) {
    const frame = city.frame;
    const own = city.map.get(screenKind!);
    const other = showing?.across ? city.map.get(showing.across) : undefined;
    if (own) {
      const cornerOf = (plot: { col: number; row: number; side: number }) => {
        const top = toIso(plot.col, plot.row, frame.cell);
        const centre = toIso(plot.col + plot.side / 2, plot.row + plot.side / 2, frame.cell);
        return {
          top: { x: frame.originX + top.x, y: frame.originY + top.y },
          centre: { x: frame.originX + centre.x, y: frame.originY + centre.y },
        };
      };
      const mine = cornerOf(own);
      /*
       * ON ITS OWN PLOT, always. A picture across two kinds — skills down,
       * drills across — used to stand on the road between their plots, and
       * landed on the other village with its own district's signpost and
       * board buried under it: the lens read as the drills', not the
       * skills'. Its rows are its kind; it stands at that village's back
       * kerb, and the road to the other kind is already on the ground.
       */
      void other;
      const anchorX = mine.centre.x;
      /*
       * Its foot is on the plot's far kerb — the back vertex of the diamond.
       * The nameplate no longer stands there (it is a signpost at the front
       * corner from altitude), so the screen needs no clearance above its
       * own card: it is a billboard at the back of the village.
       */
      const anchorBottom = mine.top.y + frame.cell * 0.1;
      /*
       * Cut to the picture. The lens lays itself out in a box as tall as the
       * window (`naturalH`) so nothing in it ever scrolls; the billboard
       * shows only as much of that box as the lens actually drew, when the
       * scene has measured it. Never taller than the box — a lens cannot
       * draw past it.
       */
      const drawnH =
        opts.screenHeight !== undefined && opts.screenHeight > 0
          ? Math.min(naturalH, Math.max(SCREEN_MIN_NATURAL_HEIGHT, Math.round(opts.screenHeight)))
          : naturalH;
      const aspect = drawnH / naturalW;
      /*
       * THE BILLBOARD IS THE POINT OF FLYING CLOSER. Chosen from altitude,
       * a lens is what the reader came to see, and it was capped at half
       * the span and under half the height — a window into the picture
       * rather than the picture — and the caps were the window's, so
       * zooming grew the city under it and never the board. It may take
       * most of the span now, and the caps grow with the zoom past the
       * "closer" the choice already brought, so zooming in enlarges the
       * board the way it enlarges everything else.
       */
      const grown = Math.max(1, (options.cityZoom ?? 1) / 1.5);
      const roomW = spanW * 0.78 * grown;
      const roomH = opts.height * 0.72 * grown;
      const floor = Math.min(DRIVE_IN_MIN_WIDTH * unit, spanW * 0.5);
      let width = Math.max(floor, Math.min(roomW, own.side * frame.cell * 2.4));
      if (width * aspect > roomH) width = roomH / aspect;
      const others = [...placed.values()].filter((node) => node.plane === 2 && node.id !== kindCardId(screenKind!));
      const boxAt = (w: number) => {
        const h = w * aspect;
        // Its foot on the kerb, wherever that is: a billboard held inside the
        // window's top slid down over its own village; the camera brings it in.
        const y = anchorBottom - h;
        return { x: anchorX - w / 2, y, width: w, height: h };
      };
      let box = boxAt(width);
      /*
       * Another district's NAMEPLATE is wider than its box and floats above
       * it — a label overflows its building the way a map label does — so
       * the box is inflated by what the plate can reach before the screen
       * is judged against it.
       */
      /*
       * The plate is a SIGNPOST at the plot's front corner now, so the reach
       * to guard is below the card's foot, not above its top — and a
       * district's own village fills its box, so the box itself counts.
       */
      const covers = (b: { x: number; y: number; width: number; height: number }) =>
        others.some((card) => {
          const unpanned = {
            x: card.x - (state.pan?.x ?? 0) - PLATE_REACH * unit,
            y: card.y - (state.pan?.y ?? 0),
            width: card.width + PLATE_REACH * unit * 2,
            height: card.height + PLATE_CLEARANCE * unit,
          };
          return b.x < unpanned.x + unpanned.width && unpanned.x < b.x + b.width && b.y < unpanned.y + unpanned.height && unpanned.y < b.y + b.height;
        });
      for (let w = width; covers(box) && w > floor + 1; w = Math.max(floor, w * 0.92)) box = boxAt(w);
      const at = nodes.findIndex((node) => node.id === state.focusId);
      if (at !== -1) {
        /*
         * A BILLBOARD CAN BE MOVED, ON A LEASH.
         *
         * Its home is the back kerb of its own plot, which is where it
         * belongs: a picture of a kind, standing on that kind's land. But a
         * board planted to the millimetre is furniture, and a person wants
         * to nudge it off whatever it is covering.
         *
         * So a pin moves it, and the leash is what keeps it a picture OF
         * this village rather than a sheet floating over the city. Measured
         * in the city's own cells, so the same pin holds at every zoom —
         * pin it two cells north and it is two cells north whether you are
         * flown close or looking down on the whole map.
         *
         * Clamped HERE rather than where the drag is made, because a pin
         * arrives from a link as readily as from a hand, and a leash that
         * only the hand respects is not a leash.
         */
        const home = { x: box.x, y: box.y };
        const held = state.pins[nodes[at]!.id];
        const wandered = held ? { x: held.x - home.x, y: held.y - home.y } : { x: 0, y: 0 };
        const reach = Math.hypot(wandered.x, wandered.y);
        const leash = SCREEN_LEASH_CELLS * frame.cell;
        const pulled = reach > leash ? leash / reach : 1;
        const stand = {
          x: home.x + wandered.x * pulled,
          y: home.y + wandered.y * pulled,
        };
        const raised: LayoutNode = {
          ...nodes[at]!,
          x: stand.x + (state.pan?.x ?? 0),
          y: stand.y + (state.pan?.y ?? 0),
          width: box.width,
          height: box.height,
          natural: { width: naturalW, height: drawnH },
          screenOf: screenKind!,
          ...(held ? { pinned: true } : {}),
        };
        nodes[at] = raised;
        placed.set(raised.id, raised);
      }
    }
  }

  return {
    nodes,
    connectors: connectorsFor(graph, placed, state),
    width: opts.width,
    height: opts.height,
    ...(city ? { city: city.frame } : {}),
  };

  function push(node: Omit<LayoutNode, "pinned">): void {
    // A user pin overrides the computed position and survives graph changes
    // underneath: the layout keeps recomputing, the pin keeps winning.
    const pin = state.pins[node.id];
    const placedNode: LayoutNode = pin
      ? { ...node, x: pin.x, y: pin.y, pinned: true }
      : { ...node, pinned: false };
    /*
     * The camera moves LAST, and moves everything.
     *
     * Applied here rather than as a transform on the stage, so it is part of
     * the one function that decides where things are: connectors are drawn
     * from these coordinates, the frame planner reads them, and both
     * renderers get panning without either of them learning about it. A pin
     * is stored unpanned for the same reason — pan the camera back and the
     * card is where you left it, relative to everything else.
     */
    const final: LayoutNode = state.pan
      ? { ...placedNode, x: placedNode.x + state.pan.x, y: placedNode.y + state.pan.y }
      : placedNode;
    nodes.push(final);
    placed.set(final.id, final);
  }
}

/** Which plane a node ended up on, or null if it is not in the layout. */
export function planeOf(result: Layout, id: string): Plane | null {
  return result.nodes.find((node) => node.id === id)?.plane ?? null;
}

/**
 * THE PAN, APPLIED AFTER THE FACT — the same answer, without the arithmetic.
 *
 * The pan is baked into every card's coordinates at layout time, and that is
 * right: it is what lets two layouts be interpolated into motion, and it is
 * why connectors, the frame planner and both renderers get panning without
 * any of them learning about it.
 *
 * But it is applied at the END of a function that has already decided
 * everything else — communities, plots, band packing, the drive-in's own
 * sizing loop — and a drag changes nothing but the pan. Running all of that
 * again per pointer move cost rota's city 169 dropped frames and ten
 * seconds of blocked main thread in a two-second drag.
 *
 * So the pan comes out: lay the world out once at rest, and translate it.
 * The result is the same object `layout` would have returned — held to that
 * by `the-pan-is-a-translation` — and the caller can hold the expensive half
 * still while a hand is moving.
 *
 * The city's own origin and extent are unpanned by definition (the ground
 * rides `city.pan`), so only the cards, the lines between them and the
 * recorded pan move.
 */
export function panLayout(placed: Layout, pan: { x: number; y: number }): Layout {
  if (pan.x === 0 && pan.y === 0) return placed;
  return {
    ...placed,
    nodes: placed.nodes.map((node) => ({ ...node, x: node.x + pan.x, y: node.y + pan.y })),
    connectors: placed.connectors.map((connector) => ({
      ...connector,
      x1: connector.x1 + pan.x,
      y1: connector.y1 + pan.y,
      x2: connector.x2 + pan.x,
      y2: connector.y2 + pan.y,
    })),
    ...(placed.city ? { city: { ...placed.city, pan: { x: pan.x, y: pan.y } } } : {}),
  };
}
