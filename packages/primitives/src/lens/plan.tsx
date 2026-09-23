/**
 * THE MAP LENS: regions drawn where they are, with points inside them.
 *
 * A timeline places by time. A matrix places by two sets. A board places by
 * coordinates on its own nodes. This places by an OUTLINE — a closed shape
 * the domain gave a region — and that is a different picture from all three,
 * because the thing you recognise ground by is its shape and its neighbours,
 * not its position in a list.
 *
 * It knows nothing about grass. It knows there are regions, each with an
 * outline; that some of them nest inside others; that markers stand at a
 * point and belong to a region. A building's floor plan is rooms and
 * fixtures and reuses every line of this unchanged, which is the test in
 * `tests/lens-reuse.test.ts`.
 *
 * WHAT IT EXISTS TO SHOW is the same shape of thing the board's empty slot
 * shows: an absence. Ground somebody named and never drew is invisible on
 * every list ever written and obvious the moment you look at a map with a
 * hole in it — and a thing that stands nowhere is a record nobody can act
 * on, because "go and look at it" has no answer.
 */

export * from "./plan-state.js";
export * from "./plan-view.js";
export * from "./plan-lens.js";
