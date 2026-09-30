export type Plane = 0 | 1 | 2;

/**
 * An aggregate node is first-class, not a scale fallback. "People" is a
 * legitimate view of a kind, which is why grouping and semantic zoom are one
 * mechanism running in both directions.
 */
export interface Aggregate {
  readonly kind: string;
  readonly memberIds: readonly string[];
  /** Plural label from the kind's declaration, e.g. "People". */
  readonly label: string;
  /**
   * How many members sit BEHIND the horizon — retired under their kind's
   * declared lifecycle and not in memberIds while the view is on "now".
   * Advertised, never hidden: archived must not mean invisible-and-
   * forgotten.
   */
  readonly retired?: number;
  /**
   * Where pressing it goes, for an aggregate the relation band drew because
   * not all could stand (docs/scale.md): a group opens in place, through the
   * `expanded` stop; "+N more" opens the kind's picture, filtered by the
   * relation. Absent on a kind's own group, which travels as it always did.
   */
  readonly opens?: Opens;
}

/** Where pressing a band aggregate goes: open in place, or through to the kind's picture. */
export type Opens =
  | { readonly in: "place" }
  | { readonly in: "picture"; readonly focus: string; readonly within: Readonly<Record<string, string>> };

/**
 * Why a node is on plane 1 at all: the edge that reached it, in the schema's
 * own words.
 *
 * Every edge declaration already carries a description — "who does the run",
 * "a nap that must not be interrupted" — and until now nothing in the
 * interface ever showed it. Carrying it through the layout means a raised
 * node can say what its relationship to the focus IS, rather than merely
 * sitting near it and leaving the reader to guess.
 */
export interface Via {
  readonly edgeKind: string;
  readonly direction: "out" | "in";
  /**
   * How the relation reads FROM THE FOCUS: the declaration's `description`
   * along an outgoing edge, its `inverse` along an incoming one. Absent when
   * the declaration has no words for this direction.
   */
  readonly description?: string;
}

export interface LayoutNode {
  /** A real node id, or `aggregate:<kind>` for a group. */
  readonly id: string;
  readonly kind: string;
  readonly plane: Plane;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Set when this node stands in for a group rather than one graph node. */
  readonly aggregate?: Aggregate;
  /**
   * The size this view should LAY ITSELF OUT at, when that differs from the
   * size it is drawn at.
   *
   * A view asked to lay out at a third of its intended width has no reason
   * to work, and none of the lenses was written to: the coverage matrix
   * piles its rotated headers into a corner and clips its rows. Shrinking
   * should mean the same picture, smaller — render at the natural size and
   * scale the result, which is what a captured texture would do anyway.
   */
  readonly natural?: { readonly width: number; readonly height: number };
  /**
   * How far back this node sits WITHIN its plane. 1 is fully at the plane's
   * depth, 0 is pulled forward toward the one in front of it.
   *
   * The planes are discrete because the model is discrete, but a row of ten
   * cards all at exactly plane 2 reads as a flat strip pinned to the bottom
   * of the screen. Giving each a depth of its own turns the row into an arc
   * curving away, and turns the thing in focus into something you are
   * standing in front of.
   */
  readonly depth?: number;
  /** Set on plane 1 when this node was reached by following an edge. */
  readonly via?: Via;
  /**
   * A group whose members are currently raised onto plane 1.
   *
   * It stays where it was, emptied, so the eye can tie the relation plane
   * back to where it came from. Without it the only evidence of what is
   * raised is the breadcrumb, and a spatial interface should not need to be
   * read.
   */
  readonly raised?: boolean;
  /**
   * How near this kind is to the one in focus: one declared edge away, or
   * further.
   *
   * Nine kinds as nine identical thumbnails says nothing about which of them
   * matter. The rank comes from the SCHEMA rather than the graph, so an
   * unrelated edit can never promote a kind and shuffle the strip.
   */
  readonly rank?: "primary" | "secondary";
  /**
   * The kind card this one hangs off, when it is reachable only THROUGH that
   * one. A nested relationship should read as nested rather than being
   * flattened into a sibling.
   */
  readonly nestedUnder?: string;
  /**
   * The kinds this card STANDS FOR, when the row could not hold them all at
   * a width their names can be read at.
   *
   * A district is read, not glanced at, so the row never squeezes a name
   * below a word: past what it can hold it keeps the ones that fit and hands
   * the rest to one card that names them. Not a kind of its own — it has no
   * members and no figure — which is why it is said here rather than by
   * giving it a kind nobody declared.
   */
  readonly beyond?: readonly string[];
  /**
   * A group standing for the kind currently in focus.
   *
   * It stays on the kinds plane rather than being removed, so the strip is a
   * constant map and you can see that the picture above IS this kind.
   */
  readonly focused?: boolean;
  /**
   * An aggregate card OPENED IN PLACE — from altitude, a district showing
   * its members without dissolving into them. Inside the stack an expanded
   * aggregate dissolves instead; up on the ring dissolving would re-flow
   * every stop and break the map.
   */
  readonly opened?: boolean;
  /**
   * HOW MANY ROWS OF MEMBERS an opened district has room for: what the
   * layout reserved under its nameplate, in rows of `ROSTER_ROW`. The view
   * lists that many and counts the rest, so the roster ends where the room
   * does rather than running under the district below.
   */
  readonly openedRows?: number;
  /**
   * A card in a CROWDED band: drawn as a chip whatever its slot's size. Its
   * row is sized for a group card's two lines, which is short of a record's
   * summary, and a summary cut to its title and a sliver read as broken.
   */
  readonly compact?: boolean;
  /**
   * WHERE THIS DISTRICT STANDS IN THE CITY, in lattice cells — its address.
   *
   * Set on a kind card at altitude, from the declaration's own map
   * (`cityMap`), never from the data: the corner a person remembers is the
   * corner they get back. `side` is how many cells it takes today.
   */
  readonly plot?: { readonly col: number; readonly row: number; readonly side: number };
  /**
   * THE SCREEN OF A DRIVE-IN: this plane-0 node is a kind's own picture,
   * standing on that kind's plot from altitude rather than floating in the
   * middle. Names the kind, so the audience strip in front of it can be
   * found (`whereIs("screen:<kind>")`) and the tween can carry it.
   */
  readonly screenOf?: string;
  /** True when the user pinned this position rather than the layout choosing it. */
  readonly pinned: boolean;
}

export interface Connector {
  readonly id: string;
  /** The edge kind, so stroke treatment can carry meaning. */
  readonly kind: string;
  /**
   * Both ends resolve to the same drawn thing — "a task waits for a task".
   *
   * Real and worth drawing: it is a fact about the domain, and the one place
   * you would look for it is the picture of the whole domain. Drawn as a loop
   * rather than as a line of zero length.
   */
  readonly loop?: boolean;
  /**
   * The ONE graph edge this line stands for, when it stands for exactly
   * one — both drawn endpoints are the real nodes. A line into a group
   * bundles many edges and says "some of these"; only a single line is an
   * honest thing to select and act on.
   */
  readonly single?: { readonly from: string; readonly to: string };
  /**
   * EVERY graph edge this line stands for, in the order the walk met them.
   *
   * A line into a group is a bundle, and a bundle that only knew its count
   * could not be unpicked: the week's panel draws each session as its own
   * span, and a renderer that can see the span wants to start the session's
   * line THERE rather than at the panel's centre. That needs the real ends
   * of each edge, not just the drawn ends of the line. `single` is the
   * one-edge case of this, kept because a line that stands for one edge is
   * the only honest thing to select.
   */
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly from: string;
  readonly to: string;
  /** Endpoints in layout space, centre to centre. */
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * THE LATTICE THE CITY WAS DRAWN ON, so the ground can draw the same one
 * and the camera can know how far the city reaches. `cell` is one lattice
 * cell's width in pixels (its height is half); `originX/Y` is where cell
 * (0,0) meets the canvas before the pan. `extent` is the city's bounding
 * box in canvas pixels, unpanned.
 */
export interface CityFrame {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
  /**
   * THE PAN THIS CITY WAS PLACED WITH, so the ground can ride the same
   * tween its cards do.
   *
   * The pan is baked into every card's coordinates at layout time, which
   * is what lets two layouts be interpolated into motion. The lattice and
   * the plots under them were drawn from the LIVE pan instead — so the
   * ground snapped to its destination on the frame the view changed while
   * the cards were still on their way, which reads as the picture flashing
   * to the new place and the buildings catching up.
   */
  readonly pan: { readonly x: number; readonly y: number };
  readonly extent: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** How much of an opened district's roster the city kept room for: 1 is all of it. */
  readonly openedShare?: number;
}

export interface Layout {
  readonly nodes: readonly LayoutNode[];
  readonly connectors: readonly Connector[];
  readonly width: number;
  readonly height: number;
  /** Present at altitude: the lattice the districts were placed on. */
  readonly city?: CityFrame;
}

export interface LayoutOptions {
  readonly width?: number;
  readonly height?: number;
  /** Size of the focus view at plane 0. */
  readonly focusSize?: { width: number; height: number };
  readonly relationSize?: { width: number; height: number };
  readonly contextSize?: { width: number; height: number };
  readonly gap?: number;
  /**
   * WHAT ONE `rem` IS WORTH, IN PIXELS — the reader's own text size.
   *
   * The cards in this layout hold text, and that text is sized in `rem` so
   * a reader who asks for bigger words gets them everywhere. The cards were
   * sized in pixels off the stage, so they did not hear about it: at 200%
   * every name in the city doubled inside a district card that stayed
   * exactly 230×97, and the picture came apart — a headline in a glyph.
   *
   * Sizing them in this unit instead makes the city grow WITH the reader.
   * It grows until the ring is full and then stops, because a card is only
   * worth making bigger while it still has somewhere to stand.
   *
   * 16 is the browser's own default and therefore the no-op: every existing
   * caller lays out exactly as it did.
   */
  readonly unit?: number;
  /** Plural labels by kind, from the schema. */
  readonly plurals?: Readonly<Record<string, string>>;
  /**
   * The day the horizon is judged against (ISO date). Injectable so a test
   * or a pinned survey judges a different day; defaults to the real one.
   */
  readonly today?: string;
  /**
   * Node kinds this installation has turned OFF — a workspace's disabled
   * modules, projected once by the store. Their nodes stay in the graph and
   * simply are not drawn: no kind card, no membership, no raised plane.
   * Turning a module back on is the whole undo.
   */
  readonly hiddenKinds?: readonly string[];
  /**
   * WHAT A NODE JUDGES, by its id: the nodes its current violations name.
   * A rule has no edges, so a focused rule used to raise nothing — or,
   * with a relation named, every node of that kind wholesale — and its
   * card said nothing was connected while the picture showed twelve. What
   * a rule is about is derivable from its violations; the scene supplies
   * them here so the layout can draw them as its neighbourhood.
   */
  readonly judged?: Readonly<Record<string, readonly string[]>>;
  /**
   * WHAT STANDS AS ITSELF when a relation does not fit the band: the
   * selection and its reach, the search's hits, the flagged, the recently
   * written. The scene knows them; the layout only ranks by them.
   */
  readonly relevance?: {
    readonly chosen?: ReadonlySet<string>;
    readonly hits?: ReadonlySet<string>;
    readonly flagged?: ReadonlySet<string>;
    readonly touched?: ReadonlyMap<string, number>;
  };
  /**
   * Room the picture must leave for chrome that lives ON the scene — the
   * left rail at altitude, where the relation key and the inspector sit.
   * The ring and the focused card centre within what is left, so a
   * district is never drawn under a pane. Nothing is reserved by default.
   */
  readonly inset?: { readonly left?: number; readonly right?: number };
  /**
   * Kinds whose group is shown by the framework's own list rather than a
   * view the app wrote. From altitude a focused group of such a kind is its
   * district, opened — drawing the list scaled in the middle AND the same
   * names in the district was the same thing twice. A group with a real
   * view — a week, a board — keeps its scaled card, since that picture is
   * the thing you were standing in.
   */
  readonly plainGroups?: readonly string[];
  /**
   * THE ORDER A BLANK INSTALLATION FILLS ITS KINDS — `beginning(app).order`
   * — which is the order the city is walked in. Sorted ids otherwise, which
   * is deterministic too, only less meaningful.
   */
  readonly cityOrder?: readonly string[];
  /** Hand-laid plots by kind, from a brand kit; a kind's own `plot` wins first. */
  readonly plots?: Readonly<Record<string, { readonly col: number; readonly row: number }>>;
  /**
   * THE SHOWINGS each kind has — its named Places — so a focused picture
   * from altitude can stand on its kind's plot as a screen, and a picture
   * over two kinds (`across`) on the road between them. A kind with none
   * has no drive-in: its group opens in place, as it always did.
   */
  readonly screens?: Readonly<Record<string, readonly { readonly as: string; readonly title: string; readonly across?: string }[]>>;
  /**
   * FLY CLOSER. A factor on the city's cell from altitude — 1 is the whole
   * map fitted to the window; 1.5 is the camera brought in toward the
   * picture a person chose, plots and villages and roads all bigger, the
   * city allowed past the window's edge (the camera pans to reach it).
   */
  readonly cityZoom?: number;
  /**
   * HOW TALL THE PICTURE ON THE BILLBOARD ACTUALLY DRAWS, in the lens's own
   * natural pixels, measured by whoever renders it. A lens is laid out in a
   * box as tall as the window so it never scrolls, but a short lens fills
   * only the top of it — and a billboard sized to the whole box stood its
   * picture a village's height above the kerb, floating over the next
   * district with empty room beneath. Cut to what is drawn, the picture's
   * foot is on the kerb. Absent (or not yet measured): the whole box.
   */
  readonly screenHeight?: number;
}

/**
 * Three bands, chosen so the planes never overlap at their own scales.
 *
 * Sizes are in layout units; the plane's scale shrinks the drawn box in
 * place, so a band's height is its size times that scale.
 */
/**
 * Sizes here are CAPS, not fixed boxes: a band fits its contents across the
 * canvas and never exceeds the cap. Heights come from the band proportions in
 * `layout()`, which is what keeps the composition together at any size.
 */
export const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, "plurals" | "today" | "hiddenKinds" | "inset" | "plainGroups" | "judged" | "relevance" | "cityOrder" | "plots" | "screens" | "cityZoom" | "screenHeight">> = {
  width: 1200,
  height: 760,
  focusSize: { width: 1200, height: 420 },
  relationSize: { width: 240, height: 140 },
  /*
   * A kind card is a GLYPH: a name, a count, and how much of it is in
   * trouble. At 150 it was sized for two clamped lines of prose that have
   * since moved to the tooltip, and the band it sits in took a fifth of the
   * window to hold cards covering a tenth of it.
   */
  contextSize: { width: 300, height: 104 },
  gap: 16,
  unit: 16,
};
