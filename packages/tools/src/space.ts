/**
 * A MODEL'S ANSWER ABOUT A SPACE, CHECKED AGAINST THE SPACE.
 *
 * `validateProposals` checks that a model's calls name acts that exist and
 * arguments that parse. That catches everything except the thing a model is
 * actually likely to get wrong when you hand it photographs and ask where
 * things are, which is WHERE THINGS ARE.
 *
 * A product asked one to place a property's areas on a plan. Its prompt said
 * — and had said since the first version — that an area inside another must
 * be drawn inside it and a thing must be placed inside the area it stands
 * in. Nothing looked. The answer came back as seven full-width horizontal
 * bands stacked down the page, every one of them lying across its
 * neighbours, and the app accepted it line for line and drew it.
 *
 * A stated rule nobody enforces is worse than no rule: it tells the model it
 * got away with something, and it tells the person the answer was checked.
 *
 * Bands-down-the-page is what this failure looks like nearly every time, and
 * it has one cause: no view from above, so the shapes are being guessed from
 * ground-level frames. The useful response is not to fix the coordinates but
 * to hand the sentences back and ask again.
 */

export interface SpacePoint {
  readonly x: number;
  readonly y: number;
}

export type Ring = readonly SpacePoint[];

/**
 * Ray casting. Whether a point is inside a ring.
 *
 * A point exactly ON an edge is decided by which edge the ray happens to
 * cross, so one side of a shape reads in and the other out. That is the
 * standard behaviour of this algorithm and it is fine for what this is for —
 * a model's coordinates are never exactly on a line — but it is not a thing
 * to build on.
 */
export function inside(point: SpacePoint, ring: Ring): boolean {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      within = !within;
    }
  }
  return within;
}

/** Whether every corner of one ring is inside another. */
export const within = (inner: Ring, outer: Ring): boolean => inner.every((corner) => inside(corner, outer));

/**
 * Whether two areas lie ACROSS each other, rather than merely touching.
 *
 * The test is mutual: each has a corner in the other. Two areas that share
 * an edge, or whose corners graze, fail this and should — a property is a
 * jigsaw and its pieces meet. What it catches is interpenetration, which is
 * the thing that cannot be true of two pieces of ground.
 */
export const across = (a: Ring, b: Ring): boolean =>
  a.some((corner) => inside(corner, b)) && b.some((corner) => inside(corner, a));
