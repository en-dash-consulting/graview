import { SCENE_LAYERS, type AnySchema } from "@graview/core";
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
  readonly result: Pick<Layout, "nodes" | "width" | "height" | "city">;
  readonly schema: AnySchema;
  /** Pan the ground by this much. */
  readonly onGo: (by: { readonly x: number; readonly y: number }) => void;
}): ReactElement | null {
  const past = districtsPastTheEdge(result);
  if (past.length === 0) return null;
  const signs: ReactElement[] = [];
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const span = side === "left" || side === "right" ? result.height : result.width;
    let last = -Infinity;
    const onSide = past.filter((one) => one.side === side).sort((a, b) => a.along - b.along);
    for (const one of onSide) {
      const at = Math.max(MARGIN, Math.min(span - MARGIN, Math.max(one.along, last + SPACING)));
      last = at;
      const plural = schema.tryDefinition(one.kind)?.plural ?? one.kind;
      const place: CSSProperties =
        side === "left"
          ? { left: 6, top: at, transform: "translateY(-50%)" }
          : side === "right"
            ? { right: 6, top: at, transform: "translateY(-50%)" }
            : side === "top"
              ? { top: 6, left: at, transform: "translateX(-50%)" }
              : { bottom: 6, left: at, transform: "translateX(-50%)" };
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
  borderRadius: 999,
  boxShadow: "0 2px 8px rgb(0 0 0 / 0.12)",
  cursor: "pointer",
};
