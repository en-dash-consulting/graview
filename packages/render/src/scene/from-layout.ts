import type { InterpolatedLayout, Layout } from "@graview/layout";
import type { PlannedConnector, PlannedView } from "./frame-plan.js";

/**
 * Turns what layout emitted into what the renderer draws.
 *
 * Deliberately trivial: layout decides positions and planes, the renderer
 * decides pixels, and this is the whole conversation between them. If this
 * function ever starts making decisions, the two have begun to overlap.
 */
export function fromLayout(
  result: Layout | InterpolatedLayout,
  dirty: ReadonlySet<string> = new Set(),
): { views: PlannedView[]; connectors: PlannedConnector[] } {
  // Planes may be fractional mid-transition; the frame plan mixes the two
  // plane styles rather than snapping, so this passes them straight through.
  const views: PlannedView[] = result.nodes.map((node) => ({
    id: node.id,
    plane: node.plane,
    x: node.x,
    y: node.y,
    // Whole-pixel boxes. A fractional size reallocates the texture on every
    // frame of a transition and desynchronises it from the element the
    // browser actually rasterises.
    width: Math.round(node.width),
    height: Math.round(node.height),
    // Mid-fade counts as dirty: the pixels on screen are not the pixels this
    // view will settle at.
    dirty: dirty.has(node.id) || ("opacity" in node && node.opacity < 1),
    opacity: "opacity" in node ? node.opacity : 1,
  }));

  const connectors: PlannedConnector[] = result.connectors.map((connector) => ({
    id: connector.id,
    kind: connector.kind,
    from: connector.from,
    to: connector.to,
    opacity: "opacity" in connector ? (connector as { opacity: number }).opacity : 1,
  }));

  return { views, connectors };
}
