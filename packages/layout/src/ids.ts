import { toggleExpanded, withFocus, withOverview, withWithin, withZoom, type ViewState } from "./view-state.js";

/*
 * WHAT AN ID MEANS in the picture. A node's id is its own; the picture adds
 * ids of its own for the things only it draws — a group (`aggregate:`) and a
 * kind's card on the kinds plane (`kind:`) — and these say how to make one,
 * read one, and go into one.
 */

export const AGGREGATE_PREFIX = "aggregate:";

/**
 * The kinds plane's cards have ids of their own.
 *
 * They cannot share `aggregate:<kind>` with a focusable group, because an app
 * whose primary view IS one kind — the coaching example's formation is
 * `aggregate:position` — would then place the same id twice: once as the
 * focus and once as its own card in the strip. The strip is a MAP of kinds,
 * not a set of groups you focus, so it gets its own namespace.
 */
export const KIND_PREFIX = "kind:";

export function kindCardId(kind: string): string {
  return `${KIND_PREFIX}${kind}`;
}

export function kindOfCard(id: string): string | null {
  return id.startsWith(KIND_PREFIX) ? id.slice(KIND_PREFIX.length) : null;
}

/**
 * The card that stands for the districts the row could not hold.
 *
 * Its own id rather than a kind's, because it is not a kind: it is the row
 * saying what it had to leave out, and naming them.
 */
export const BEYOND_CARD = "kinds:beyond";

/** The kinds an id stands for, whichever namespace it is in. */
export function kindsOf(id: string): string[] {
  const card = kindOfCard(id);
  return card ? [card] : kindsOfAggregate(id);
}

/**
 * The id of a group standing in for one or more kinds.
 *
 * Several kinds because a group is a view of a SET of kinds, not a synonym
 * for one: the household example's week is its blocks and its runs together, and no node
 * kind called "week" exists or should. Kinds are sorted so the same group is
 * always the same id, which keeps it stable in a URL.
 */
export function aggregateId(...kinds: readonly string[]): string {
  return `${AGGREGATE_PREFIX}${[...kinds].sort().join("+")}`;
}

export function isAggregateId(id: string): boolean {
  return id.startsWith(AGGREGATE_PREFIX);
}

/** The kinds a group id names, or an empty list if it is not a group id. */
export function kindsOfAggregate(id: string): string[] {
  // A band's group ("aggregate:song|by|in|…") stands for SOME members, not a kind.
  if (!isAggregateId(id) || id.includes("|")) return [];
  return id.slice(AGGREGATE_PREFIX.length).split("+").filter(Boolean);
}

/**
 * Going deeper into a card, as view state.
 *
 * A record ZOOMS: the same scene with the record grown to most of it, and
 * the same gesture on the zoomed record zooms back out. A KIND CARD stands
 * for a group, so deeper means the group: on the ground it zooms into the
 * group as a place (`aggregate:<kind>`), and from altitude it opens the
 * district in place — the exploded view — and the same gesture closes it.
 *
 * UNLESS THE KIND HAS A PICTURE OF ITS OWN. A district explodes into a ring
 * of chips because a bag of names is the best a generic card can do with its
 * members. A kind with a lens registered over it has something better, and
 * the card already says so with its ◆ — so "deeper" there means that
 * picture, and the district stays shut. Exploding it replaced a designed
 * view with the fallback it exists to improve on.
 *
 * The card's own id (`kind:<kind>`) is never made the focus. A focus
 * resolves to a node or to a group's kinds, and a kind card is neither: a
 * focus on one laid out an empty scene with the card's name in the URL,
 * which is what double-clicking a group looked like before this existed.
 */
export function withJackIn(
  state: ViewState,
  id: string,
  options: {
    readonly ownPicture?: boolean;
    /**
     * Words to carry into a district: the search that lit it. Descending
     * into a lit district opens it already narrowed — the arrangement's own
     * `in.q` — so the row shows why, and clearing the row clears only that.
     */
    readonly carry?: string;
  } = {},
): ViewState {
  const kind = kindOfCard(id);
  if (kind !== null && state.overview && options.ownPicture !== true) {
    return toggleExpanded(state, id);
  }
  const target = kind !== null ? aggregateId(kind) : id;
  /*
   * Carrying words is never the way back out. Standing zoomed in the very
   * district the search lit, its count or its row narrows it where you are;
   * only a bare jack-in on the zoomed district is the toggle out.
   */
  if (state.zoom && state.focusId === target && !(kind !== null && options.carry)) return withZoom(state, false);
  if (kind !== null && options.carry) {
    /*
     * A SEARCH'S DESCENT COMES DOWN. From altitude every village still
     * stands, every member a building, and a district "opened narrowed"
     * up there reads as not narrowed at all. The words took you to it, so
     * it opens on the ground, close, with only what they found.
     */
    const down = withOverview({ ...withFocus(state, target), relation: null }, false);
    return withWithin(withZoom(down, true), "q", options.carry);
  }
  return withZoom({ ...withFocus(state, target), relation: null }, true);
}

/**
 * Going down into one of a kind's pictures, as view state: the kind's
 * district in focus, on the ground, with that picture `in.view`.
 *
 * ONE WAY DOWN TO A PICTURE. The bar's place list, Find, a host's `go.place`
 * and a lens double-clicked on its district from altitude all arrive at the
 * same stop, so they all say it here rather than each spelling it out.
 */
export function withPicture(state: ViewState, kind: string, as: string): ViewState {
  return withWithin(withOverview(withFocus(state, aggregateId(kind)), false), "view", as);
}

/**
 * Ranks by a STABLE key — the node id — and never by a mutable count.
 *
 * This is the single rule that protects spatial memory. Ordering people by
 * "how many runs they have" would reshuffle the whole plane the moment
 * anything is reassigned, and the picture you remember would stop being the
 * picture you get.
 */
export function byStableKey(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const BAND_PREFIX = "aggregate:";

/** Whether an id names a band aggregate — a group or the rest of a relation — rather than a kind's group. */
export function isBandAggregate(id: string): boolean {
  return id.startsWith(BAND_PREFIX) && id.includes("|");
}
