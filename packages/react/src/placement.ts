import type { Presence } from "@graview/core";
import { fromUrl, kindsOfAggregate } from "@graview/layout/view";
import type { DrawnBox } from "./context.js";

/*
 * Where the others stand on a picture: a file of its own, apart from the
 * presence the frame keeps from the first paint, since only a drawn picture
 * places anybody.
 */

export type Placed =
  | {
      readonly kind: "person";
      readonly presence: Presence;
      readonly point: { x: number; y: number };
      /** What they stand at: a plot, or the audience row of a screen. */
      readonly at: string;
      readonly index: number;
      readonly of: number;
      readonly audience: boolean;
    }
  | { readonly kind: "edge"; readonly presence: Presence; readonly point: { x: number; y: number } }
  | { readonly kind: "count"; readonly at: string; readonly point: { x: number; y: number }; readonly n: number }
  | { readonly kind: "robot"; readonly presence: Presence; readonly point: { x: number; y: number }; readonly mode: string }
  | { readonly kind: "over"; readonly presence: Presence; readonly box: DrawnBox };

/** How many stand in a row before the rest are a number. */
export const AUDIENCE_ROW = 3;

/** Where a stop puts somebody: the audience row of the showing they are watching, else the plot their focus names. */
export function anchorOf(stop: string): { readonly at: string; readonly audience: boolean } | null {
  const view = fromUrl(stop);
  const focus = view.focusId;
  if (!focus) return null;
  const showing = view.within?.["view"];
  if (showing) {
    const [kind] = kindsOfAggregate(focus);
    if (kind) return { at: `screen:${kind}`, audience: true };
  }
  return { at: focus, audience: false };
}

/**
 * THE OTHERS, PLACED. Pure — a test can ask what a viewer would draw from
 * a list of presences and a `whereIs`. People at one anchor stand in a
 * row; past `AUDIENCE_ROW` the rest are "+n". Anonymous viewers are a count
 * at their plot, never a figure. Somebody whose stop is nowhere on this
 * map is an indicator at the edge, named. A robot stands where its owner's
 * presence says, captioned as theirs; a shared hover is an outline.
 */
export function placeOthers(
  who: readonly Presence[],
  whereIs: (id: string) => DrawnBox | null,
  width: number,
): Placed[] {
  const placed: Placed[] = [];
  const rows = new Map<string, Presence[]>();
  const counts = new Map<string, { n: number; box: DrawnBox }>();
  let edges = 0;
  for (const presence of who) {
    const anchor = anchorOf(presence.stop);
    const box = anchor ? whereIs(anchor.at) : null;
    if (!anchor || !box) {
      if (presence.name) {
        placed.push({ kind: "edge", presence, point: { x: width - 8, y: 40 + edges++ * 28 } });
      }
      continue;
    }
    if (!presence.name) {
      const held = counts.get(anchor.at);
      counts.set(anchor.at, { n: (held?.n ?? 0) + 1, box });
      continue;
    }
    const row = rows.get(anchor.at) ?? [];
    row.push(presence);
    rows.set(anchor.at, row);
    if (row.length > AUDIENCE_ROW) continue;
    const anchorBox = box;
    const index = row.length - 1;
    // A row in front of the screen; a huddle at a plot's foot, a little left of its robot.
    const point = anchor.audience
      ? { x: anchorBox.x + anchorBox.width * 0.5 + (index - 1) * 26, y: anchorBox.y + Math.min(anchorBox.height, 24) }
      : { x: anchorBox.x + anchorBox.width * 0.5 - 26 - index * 22, y: anchorBox.y + anchorBox.height - 4 };
    placed.push({ kind: "person", presence, point, at: anchor.at, index, of: row.length, audience: anchor.audience });
  }
  for (const [at, row] of rows) {
    if (row.length <= AUDIENCE_ROW) continue;
    const box = whereIs(at);
    if (!box) continue;
    placed.push({ kind: "count", at, point: { x: box.x + box.width * 0.5 + 2 * 26 + 18, y: box.y + box.height - 4 }, n: row.length - AUDIENCE_ROW });
  }
  for (const [at, { n, box }] of counts) {
    placed.push({ kind: "count", at, point: { x: box.x + box.width * 0.5 + 40, y: box.y + box.height - 4 }, n });
  }
  for (const presence of who) {
    if (!presence.name) continue;
    if (presence.robot?.at && presence.robot.mode !== "docked") {
      const box = whereIs(presence.robot.at);
      if (box) placed.push({ kind: "robot", presence, point: { x: box.x + box.width / 2 + 22, y: box.y + box.height - 4 }, mode: presence.robot.mode });
    }
    if (presence.over) {
      const box = whereIs(presence.over);
      if (box) placed.push({ kind: "over", presence, box });
    }
  }
  return placed;
}

