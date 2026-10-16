import { pluralLabel, SCENE_LAYERS, type AnySchema } from "@graview/core";
import { districtsPastTheEdge, type Layout, type PastTheEdge } from "@graview/layout";
import { useLayoutEffect, useState, type CSSProperties, type ReactElement, type RefObject } from "react";

/**
 * THE SIGNS AT THE EDGE OF THE GROUND. A city wider than the window keeps
 * its shape and is reached by panning; what it did not do was say so. On a
 * phone the conference's Topics and Staff stood wholly past the left edge,
 * and nothing on the screen said they were there or which way to go — a
 * pointer could not press them, because there was nothing to press.
 *
 * Each district past an edge gets a sign on that edge, at the height (or
 * across the width) it lies, in its own name and pointing at it. Pressing
 * the sign pans the ground to bring the district in; the district itself
 * is then pressed like any other. A sign is a way to somewhere, not a
 * second way to do what the district does.
 */
const ARROW: Record<PastTheEdge["side"], string> = { left: "←", right: "→", top: "↑", bottom: "↓" };
/** How far apart two signs on one edge stand, at the least: one sign's height and a gap. */
const SPACING = 36;
/** Room kept clear at the canvas's ends: the zoom in one corner, the way in at the other. */
const MARGIN = 56;

export function EdgeSigns({
  result,
  schema,
  chrome = [],
  onGo,
}: {
  readonly result: Pick<Layout, "nodes" | "width" | "height" | "city" | "visible">;
  readonly schema: AnySchema;
  /**
   * The controls standing on the ground, in canvas pixels (the layout's
   * `chrome`): the altitude control and the key in the top right corner.
   */
  readonly chrome?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  /** Pan the ground by this much. */
  readonly onGo: (by: { readonly x: number; readonly y: number }) => void;
}): ReactElement | null {
  const past = districtsPastTheEdge(result);
  if (past.length === 0) return null;
  /*
   * CLEAR OF THE SHOWINGS. A district a lens is open on hangs the names of
   * its pictures under its own; on a phone the sign for a district past the
   * left edge stood on them, over "The quarter". A sign whose place along
   * its edge would cover them steps past them, down (or right) if there is
   * room and else up (or left).
   */
  const showings = (result.city?.showings ?? []).flatMap((hung) => {
    const card = result.nodes.find((node) => node.id === hung.id);
    return card ? [{ left: card.x + hung.x, top: card.y + hung.y, right: card.x + hung.x + hung.width, bottom: card.y + hung.y + hung.height }] : [];
  });
  /*
   * AND CLEAR OF THE CORNER. On a phone the city runs past the right edge
   * near the top, and the sign for the district there stood under "Close
   * the map", its name read through the control. The corner the altitude
   * control and the key stand in is ground a sign steps past too.
   */
  const taken = [...showings, ...chrome.map((box) => ({ left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }))];
  const signs: ReactElement[] = [];
  for (const side of ["left", "right", "top", "bottom"] as const) {
    // The reader's window: a panel over the scene is not part of it (`Layout.visible`).
    const seen = result.visible ?? result;
    const span = side === "left" || side === "right" ? seen.height : seen.width;
    const across = side === "left" || side === "right";
    /*
     * ONE SIGN NEVER STANDS ON ANOTHER (the tenth walk's carried pass: the
     * watch's `control-covered`). Along the foot a sign is as long as its
     * name, not 36 pixels, so "Plots" stood on "Gardeners"; and where more
     * districts lay past an edge than it had room for, the last were all
     * held at its end, one on another. Each stands past the one before by
     * its own length; one with no room left on its edge is not drawn —
     * its district is still panned to, and listed with the folded ones.
     * The foot's far end is the zoom's, and so is each side's foot: on a
     * phone the zoom runs most of the way across.
     */
    const end = side === "bottom" ? ZOOM_ROOM : side === "top" ? MARGIN : ZOOM_TALL + MARGIN / 2;
    let reached = -Infinity;
    const placed: { left: number; top: number; right: number; bottom: number }[] = [];
    const onSide = past.filter((one) => one.side === side).sort((a, b) => a.along - b.along);
    for (const one of onSide) {
      const plural = pluralLabel(schema, one.kind);
      const length = signLength(plural);
      const half = across ? HALF_TALL : length / 2;
      const limit = span - end - (across ? 0 : half);
      const wanted = Math.max(MARGIN, one.along, reached + half + SIGN_GAP);
      if (wanted > limit) continue;
      const { at, inset } = clearOf([...taken, ...placed], side, wanted, length, seen, span);
      if (at > limit + 0.5) continue;
      reached = at + half;
      placed.push(signBox(side, at, length, seen, inset));
      const place: CSSProperties =
        side === "left"
          ? { left: inset, top: at, transform: "translateY(-50%)" }
          : side === "right"
            ? { right: `calc(${inset}px + var(--graview-dock, 0px))`, top: at, transform: "translateY(-50%)" }
            : side === "top"
              ? { top: inset, left: at, transform: "translateX(-50%)" }
              : // Above what stands at the foot, as the zoom is (`--graview-scene-foot`), and above a sheet.
                { bottom: `calc(${inset}px + var(--graview-scene-foot, var(--graview-sheet, 0px)))`, left: at, transform: "translateX(-50%)" };
      signs.push(
        <button
          key={one.id}
          type="button"
          className="graview-edge-sign"
          data-graview-past-edge={one.id}
          aria-label={`${plural}, past the ${side} edge — bring it into view`}
          title={`${plural} is past the ${side} edge`}
          /*
           * Not a tab stop: the keys reach the district itself, and focus
           * brings it into the window. Seven more stops in front of every
           * district was the price a keyboard paid for the pointer's sign.
           */
          tabIndex={-1}
          // A press on a sign is not the start of a pan.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onGo(one.by);
          }}
          style={{ ...SIGN, ...place }}
        >
          {side === "right" || side === "bottom" ? `${plural} ${ARROW[side]}` : `${ARROW[side]} ${plural}`}
        </button>,
      );
    }
  }
  return <>{signs}</>;
}

/** How long a sign is across its edge, about: its words at 0.75rem, its arrow and its padding. */
const signLength = (plural: string) => (plural.length + 2) * 7.4 + 22;
/** How far a sign reaches along its edge from where it stands: half its height, or half its length. */
const HALF_TALL = SPACING / 2;
/** How far in from its edge a sign stands. */
const EDGE_INSET = 6;
/** The least ground between two signs along one edge. */
const SIGN_GAP = 6;
/** The foot's far end, the zoom's: its −, its level, its + and "From above", and its inset from the corner. */
const ZOOM_ROOM = 236;
/** How tall the zoom stands from the foot, its inset with it. */
const ZOOM_TALL = 56;

/** A sign's box at `along` on its edge, `inset` in from it, in the window's pixels. */
function signBox(side: PastTheEdge["side"], along: number, length: number, seen: { readonly width: number; readonly height: number }, inset = EDGE_INSET) {
  return side === "left" || side === "right"
    ? { left: side === "left" ? inset : seen.width - inset - length, right: side === "left" ? inset + length : seen.width - inset, top: along - HALF_TALL, bottom: along + HALF_TALL }
    : { left: along - length / 2, right: along + length / 2, top: side === "top" ? inset : seen.height - inset - SPACING, bottom: side === "top" ? inset + SPACING : seen.height - inset };
}

/**
 * Where a sign stands clear of the showings: where it was asked to, else
 * just past the showings along its edge, else — no room along it — beside
 * them, as far in from its edge as they reach.
 */
function clearOf(
  showings: readonly { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }[],
  side: PastTheEdge["side"],
  at: number,
  length: number,
  seen: { readonly width: number; readonly height: number },
  span: number,
): { readonly at: number; readonly inset: number } {
  const across = side === "left" || side === "right";
  // The sign's box at `along`, from the edge it stands on.
  const box = (along: number) => signBox(side, along, length, seen);
  const covers = (along: number) => showings.find((hung) => { const b = box(along); return b.left < hung.right && hung.left < b.right && b.top < hung.bottom && hung.top < b.bottom; });
  const hung = covers(at);
  if (!hung) return { at, inset: EDGE_INSET };
  const half = across ? HALF_TALL : length / 2;
  const after = (across ? hung.bottom : hung.right) + half + 4;
  const before = (across ? hung.top : hung.left) - half - 4;
  if (after <= span - MARGIN && !covers(after)) return { at: after, inset: EDGE_INSET };
  if (before >= MARGIN && !covers(before)) return { at: before, inset: EDGE_INSET };
  // Beside them: in from its edge past where they reach.
  const reach = side === "left" ? hung.right : side === "right" ? seen.width - hung.left : side === "top" ? hung.bottom : seen.height - hung.top;
  return { at, inset: Math.max(EDGE_INSET, reach + 4) };
}

const SIGN: CSSProperties = {
  position: "absolute",
  zIndex: SCENE_LAYERS.lines,
  minHeight: 28,
  maxWidth: "40%",
  padding: "3px 10px",
  font: "inherit",
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "var(--graview-ink)",
  background: "var(--graview-panel)",
  border: "1px solid var(--graview-edge)",
  // A sign naming a relation, not a choice: a sign's corners, not a capsule (FR-117).
  borderRadius: 6,
  boxShadow: "0 2px 8px rgb(0 0 0 / 0.12)",
  cursor: "pointer",
};

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/**
 * WHERE THE PICTURE'S TRAIL STANDS on the ground, in the ground's pixels,
 * while it says something: "Reset view" once the ground is panned by hand,
 * "zoomed in ×", the past. It stands over the top-left corner, and on a
 * phone a sign for a district past the top edge stood under it (W-224); a
 * sign steps past it as it steps past Up and the key. The trail is the
 * ground's sibling, drawn by the face around it, so it is measured.
 */
export function useTrailBox(ground: RefObject<HTMLElement | null>): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const at = ground.current;
    let trail: HTMLElement | null = null;
    for (let up = at?.parentElement ?? null, depth = 0; up && !trail && depth < 4; up = up.parentElement, depth++) {
      trail = up.querySelector<HTMLElement>(":scope > [data-graview-scene-trail]");
    }
    if (!at || !trail) return;
    const read = () => {
      const mine = at.getBoundingClientRect();
      const theirs = trail.getBoundingClientRect();
      const next = theirs.width > 0 && theirs.height > 0 ? { x: theirs.left - mine.left, y: theirs.top - mine.top, width: theirs.width, height: theirs.height } : null;
      setBox((now) => (now === next || (now && next && now.x === next.x && now.y === next.y && now.width === next.width && now.height === next.height) ? now : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(trail);
    return () => watch.disconnect();
  }, [ground]);
  return box;
}
