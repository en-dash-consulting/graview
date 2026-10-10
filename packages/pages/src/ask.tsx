import { layer, type AnySchema } from "@graview/core";
import { aggregateId, kindCardId } from "@graview/layout/view";
import { SeatField } from "@graview/primitives/pages";
import { useGraviewIfAny } from "@graview/react/provider";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { askPlace, pin } from "./ask-place.js";
import { useLocation, useNavigate } from "react-router-dom";
import { kindOfSlug, recordPath } from "./registry.js";
import type { PageContext } from "./pages.js";

/**
 * THE SEAT ON EVERY PAGE — the same one as on the scene, not a second.
 *
 * A quiet ask field at the foot-left of the window ("Ask Things…") that
 * grows into the conversation when asked, over the page and never pushing
 * it; on a phone, a bottom sheet. It is the scene's own seat
 * (`SeatField`), holding the app's one conversation, so a question asked
 * on the scene is still there on Pages.
 *
 * WHAT "THIS" MEANS HERE IS THE ROUTE. On a record it is that record; on a
 * kind's page, that kind; on a picture, the kind it is a picture of. The
 * provider's selection is set from the address, so the same question means
 * the same thing on both faces.
 */
export function PageAsk<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const navigate = useNavigate();
  const here = useGraviewIfAny<S>();
  const { pathname } = useLocation();
  const [, first, second] = pathname.split("/");
  const placeHere = first === "places" && second ? decodeURIComponent(second) : undefined;
  const box = useRef<HTMLDivElement | null>(null);
  useInItsBox(box, here !== null);
  if (!here) return null;
  return (
    <>
      <RouteSubject context={context} />
      <div
        ref={box}
        data-testid="page-seat"
        /*
         * The box the seat stands at the foot of: the page's reading
         * column, or the part of an embed's box that shows. It takes no pointer and no room; the
         * seat inside it is the only thing a press lands on.
         */
        style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100dvh", pointerEvents: "none", zIndex: layer("rail"), containerType: "size" }}
      >
        {/* A name in an answer goes to the record's page: there is no scene here to move. */}
        <SeatField<S>
          onPick={(id) => {
            const node = context.store.graph.getNode(id);
            if (node) navigate(recordPath(context.store.schema, node.kind as string, id));
          }}
          /*
           * WHERE AN ANSWER TAKES THE APP, ON THIS FACE: its address, through
           * the router, so Back walks out of it. The scene itself is the
           * other face's: the embed's way there, else its own address.
           */
          onMove={(move) => {
            if (here.seatTalk.get().draft) here.seatTalk.setDraft(null);
            if (move.to === "place" && (move.face === "scene" || move.slug === "overview")) {
              if (context.overview) context.overview("#");
              else if (!context.embedded) window.location.assign(context.sceneHref ?? "/");
              return;
            }
            navigate(move.address);
          }}
          {...(placeHere ? { place: placeHere } : {})}
          /* A view drawn stands in the main column, at its own address. */
          onDraft={() => {
            if (pathname !== "/~draft") navigate("/~draft");
          }}
        />
      </div>
    </>
  );
}

/** The least the closed field needs of the box it stands in. */
const NEED = { width: 160, height: 40 };

/**
 * THE SEAT STANDS IN THE PAGE'S OWN BOX (see `ask-place.ts`): in an embed,
 * the embed's box as it shows on the screen; on a face that is the whole
 * page, its reading column (`main`), so a field at the foot's left stands
 * under the page and not across the list of places beside it. Placed again
 * as the page scrolls, the box changes size or the route changes, and put
 * away while too little of the box shows.
 */
function useInItsBox(anchor: RefObject<HTMLDivElement | null>, drawn: boolean) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const embed = element.parentElement?.closest<HTMLElement>("[data-embed-content]") ?? null;
    const boxOf = () => embed ?? document.querySelector<HTMLElement>("main") ?? null;
    const place = () => {
      const box = boxOf();
      const view = { width: document.documentElement.clientWidth || innerWidth, height: innerHeight };
      const rect = box?.getBoundingClientRect() ?? { left: 0, top: 0, right: view.width, bottom: view.height };
      /*
       * AT THE WINDOW'S FOOT ON A SHORT PAGE TOO. The page's column ends
       * where its content does, and on a list of one reason the field stood
       * under that reason, mid-window. A column that ends above the window's
       * foot is the window's foot (an embed's box is its own).
       */
      const at = askPlace(embed ? rect : { left: rect.left, right: rect.right, top: rect.top, bottom: Math.max(rect.bottom, view.height) }, view, NEED);
      element.style.width = `${at.width}px`;
      element.style.height = `${at.height}px`;
      pin(element, at, at.shown);
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    /*
     * Placed in the next frame, not inside the observer's own delivery: the
     * box placed is one the seat's field measures too, and a size changed
     * while notifications are being delivered is a loop WebKit reports.
     */
    let frame = 0;
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    }) : null;
    const box = boxOf();
    if (box) grows?.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [anchor, drawn, pathname]);
}

/** The page's own subject, put where every surface reads it: the selection. */
function RouteSubject<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const { store } = context;
  const here = useGraviewIfAny<S>();
  const { pathname } = useLocation();
  /*
   * HELD IN A REF, because the setter is not stable: it closes over the
   * current view, so a new one arrives on every render — and an effect
   * that depended on it set the selection, re-rendered the provider, got a
   * new setter and set the selection again, nine hundred times a second.
   */
  const set = useRef(here?.setSelection);
  set.current = here?.setSelection;
  /* THE ADDRESS, ONCE PER ADDRESS: the path is the only thing that decides the subject. */
  useEffect(() => {
    const setSelection = set.current;
    if (!setSelection) return;
    const [, slug, id] = pathname.split("/");
    const chosen = ((): readonly string[] => {
      if (slug === "places") {
        const place = context.views?.places().find((one) => one.as === decodeURIComponent(id ?? ""));
        return place ? [aggregateId(place.kind)] : [];
      }
      const kind = slug ? kindOfSlug(store.schema, slug) : undefined;
      if (kind && id) return [decodeURIComponent(id)];
      return kind ? [kindCardId(kind)] : [];
    })();
    setSelection((current) =>
      current.length === chosen.length && current.every((one, at) => one === chosen[at]) ? current : chosen,
    );
  }, [pathname]);
  return null;
}
