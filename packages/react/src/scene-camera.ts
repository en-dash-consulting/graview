import { toIso } from "@graview/core";
import { cameraLimit, kindCardId, kindsOfAggregate, type InterpolatedLayout, type Layout, type ViewState } from "@graview/layout";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/*
 * WHERE THE CAMERA GOES ON ITS OWN. The camera is not a move: its offset is
 * derived from the focus rather than made by a hand, so it lives in the
 * scene, added to whatever the person panned, and never in the URL. Two
 * things fly it — a drive-in on the far side of a large city, which lights
 * up off-screen unless the camera goes to it, and the descent from
 * altitude, which lands in the village it left.
 */

/** How long the focus stands where the village stood before the camera glides to rest. */
const GLIDE_AFTER_MS = 180;

export function useCameraFlights({
  view,
  result,
  frame,
  panned,
  closer,
  screenId,
  setCamera,
}: {
  readonly view: ViewState;
  /** The layout at rest, with the pan in it. */
  readonly result: Layout;
  /** The frame being drawn, mid-tween. */
  readonly frame: InterpolatedLayout;
  /** The person's pan plus the camera's offset: where the city is now. */
  readonly panned: { readonly x: number; readonly y: number };
  /** How much closer the camera has flown, when a picture was chosen from altitude. */
  readonly closer: number;
  /** The drive-in in this layout, if there is one: focusing it brings the camera to its plot. */
  readonly screenId: string | null;
  readonly setCamera: Dispatch<SetStateAction<{ x: number; y: number }>>;
}): { readonly gliding: () => boolean } {
  /*
   * THE DESCENT LANDS IN THE VILLAGE. Double-clicking a district from
   * altitude used to fly it to the stage's centre while the rest
   * reorganised around it — the picture rearranging rather than you coming
   * down. The plot is the pivot now: the stack's focus is landed where the
   * village stood, so it grows in place, and the camera then glides to
   * rest so the world slides to meet it. Every way down — the Down
   * control, a marquee's showing, Escape — is a change of view from
   * outside the scene, so the scene watches the view itself: `stood`
   * remembers where each district's plot was in the last altitude frame.
   */
  const stood = useRef<Map<string, { x: number; y: number }>>(new Map());
  const wasAloft = useRef(view.overview ?? false);
  const glide = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!view.overview || !screenId || !result.city) {
      if (wasAloft.current && !view.overview) return; // the descent effect below owns the camera on the way down
      setCamera((current) => (current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 }));
      return;
    }
    const screen = result.nodes.find((node) => node.id === screenId);
    if (!screen) return;
    /*
     * FLOWN CLOSER, the camera centres on the whole drive-in — the
     * billboard and the village under it — rather than only keeping the
     * picture inside the edge; a person chose that plot, and it is what
     * they are looking at.
     */
    const village = closer > 1 && screen.screenOf ? result.nodes.find((node) => node.id === kindCardId(screen.screenOf!)) : undefined;
    const want = village
      ? {
          x: Math.min(screen.x, village.x),
          y: Math.min(screen.y, village.y),
          width: Math.max(screen.x + screen.width, village.x + village.width) - Math.min(screen.x, village.x),
          height: Math.max(screen.y + screen.height, village.y + village.height) - Math.min(screen.y, village.y),
        }
      : screen;
    const inside = want.x >= 0 && want.y >= 0 && want.x + want.width <= result.width && want.y + want.height <= result.height;
    if (inside && !village) return;
    /*
     * THE SMALLEST MOVE THAT BRINGS THE SCREEN IN. Centring it dragged the
     * rest of the city off the far side — six districts fit the window and
     * four of them left it — so the camera goes only as far as it must for
     * the screen to clear the edge, and the rest stays where it was.
     */
    const EDGE = 24;
    const shift = (start: number, size: number, span: number): number =>
      start < EDGE ? EDGE - start : start + size > span - EDGE ? span - EDGE - (start + size) : 0;
    // The whole offset — the person's pan plus the camera — stays inside the
    // camera limit, so the screen can be reached and nothing is dropped off the edge.
    const limit = cameraLimit(result);
    const pan = view.pan ?? { x: 0, y: 0 };
    const wantedX = village ? panned.x + (result.width / 2 - (want.x + want.width / 2)) : panned.x + shift(want.x, want.width, result.width);
    // Centred on the drive-in — but the PICTURE is what was chosen, so when the
    // drive-in is taller than the window the picture's top stays in and the
    // village hangs below rather than the picture losing its head.
    const centredY = result.height / 2 - (want.y + want.height / 2);
    const wantedY = village
      ? panned.y + (screen.y + centredY < EDGE ? EDGE - screen.y : centredY)
      : panned.y + shift(want.y, want.height, result.height);
    // Flown closer, the billboard stands above the city's extent, which the
    // limit does not know about: the camera goes where the drive-in is.
    setCamera({
      x: (village ? wantedX : Math.max(-limit.x, Math.min(limit.x, wantedX))) - pan.x,
      y: (village ? wantedY : Math.max(-limit.y, Math.min(limit.y, wantedY))) - pan.y,
    });
    // Only when the focus lands, or the camera flies closer: a person's own pan afterwards is theirs.
  }, [screenId, view.overview, closer]);
  if (frame.city) {
    // Remembered every altitude frame: where each plot's centre is on the canvas right now.
    const remembered = new Map<string, { x: number; y: number }>();
    for (const node of frame.nodes) {
      if (!node.plot || Math.round(node.plane) !== 2) continue;
      const centre = toIso(node.plot.col + node.plot.side / 2, node.plot.row + node.plot.side / 2, frame.city.cell);
      remembered.set(node.id, { x: frame.city.originX + panned.x + centre.x, y: frame.city.originY + panned.y + centre.y });
    }
    stood.current = remembered;
  }
  useEffect(() => {
    const aloft = view.overview ?? false;
    const descending = wasAloft.current && !aloft;
    wasAloft.current = aloft;
    if (aloft && glide.current) {
      // Back up before the glide landed: the altitude camera owns the offset now.
      clearTimeout(glide.current);
      glide.current = null;
    }
    if (!descending) return;
    const kind = view.focusId ? kindsOfAggregate(view.focusId)[0] : undefined;
    const from = kind ? stood.current.get(kindCardId(kind)) : undefined;
    const focus = result.nodes.find((node) => node.id === view.focusId);
    if (!from || !focus) {
      setCamera({ x: 0, y: 0 });
      return;
    }
    // Land the focus where the village stood; then let go, and the world slides to meet it.
    setCamera({ x: from.x - (focus.x + focus.width / 2), y: from.y - (focus.y + focus.height / 2) });
    if (glide.current) clearTimeout(glide.current);
    glide.current = setTimeout(() => {
      glide.current = null;
      setCamera({ x: 0, y: 0 });
    }, GLIDE_AFTER_MS);
    // Only when the altitude changes: a glide in progress is not restarted by what it moves.
  }, [view.overview]);
  useEffect(() => () => {
    if (glide.current) clearTimeout(glide.current);
  }, []);
  return { gliding: () => glide.current !== null };
}
