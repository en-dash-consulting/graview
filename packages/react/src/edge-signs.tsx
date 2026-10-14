import { pluralLabel, SCENE_LAYERS, type AnySchema } from "@graview/core";
import { districtsPastTheEdge, type Layout, type PastTheEdge } from "@graview/layout";
import type { CSSProperties, ReactElement } from "react";

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
  onGo,
}: {
  readonly result: Pick<Layout, "nodes" | "width" | "height" | "city" | "visible">;
  readonly schema: AnySchema;
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
  const signs: ReactElement[] = [];
  for (const side of ["left", "right", "top", "bottom"] as const) {
    // The reader's window: a panel over the scene is not part of it (`Layout.visible`).
    const seen = result.visible ?? result;
    const span = side === "left" || side === "right" ? seen.height : seen.width;
    let last = -Infinity;
    const onSide = past.filter((one) => one.side === side).sort((a, b) => a.along - b.along);
    for (const one of onSide) {
      const plural = pluralLabel(schema, one.kind);
      const { at, inset } = clearOf(showings, side, Math.max(MARGIN, Math.min(span - MARGIN, Math.max(one.along, last + SPACING))), signLength(plural), seen, span);
      last = at;
      const place: CSSProperties =
        side === "left"
          ? { left: inset, top: at, transform: "translateY(-50%)" }
          : side === "right"
            ? { right: `calc(${inset}px + var(--graview-dock, 0px))`, top: at, transform: "translateY(-50%)" }
            : side === "top"
              ? { top: inset, left: at, transform: "translateX(-50%)" }
              : { bottom: `calc(${inset}px + var(--graview-sheet, 0px))`, left: at, transform: "translateX(-50%)" };
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
  const box = (along: number) =>
    across
      ? { left: side === "left" ? EDGE_INSET : seen.width - EDGE_INSET - length, right: side === "left" ? EDGE_INSET + length : seen.width - EDGE_INSET, top: along - HALF_TALL, bottom: along + HALF_TALL }
      : { left: along - length / 2, right: along + length / 2, top: side === "top" ? EDGE_INSET : seen.height - EDGE_INSET - SPACING, bottom: side === "top" ? EDGE_INSET + SPACING : seen.height - EDGE_INSET };
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
