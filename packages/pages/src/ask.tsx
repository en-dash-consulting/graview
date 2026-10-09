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
  const box = useRef<HTMLDivElement | null>(null);
  useInsideItsEmbed(box, here !== null);
  if (!here) return null;
  return (
    <>
      <RouteSubject context={context} />
      <div
        ref={box}
        data-testid="page-seat"
        /*
         * The box the seat stands at the foot of: the window, or the part
         * of an embed's box that shows. It takes no pointer and no room; the
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
        />
      </div>
    </>
  );
}

/** The least the closed field needs of the box it stands in. */
const NEED = { width: 160, height: 40 };

/**
 * IN AN EMBED, THE SEAT STAYS IN THE EMBED'S BOX (see `ask-place.ts`):
 * placed in that box as it shows on the screen, again as the host's page
 * scrolls or the box changes size, and put away while too little of it
 * shows. A face that is the whole page keeps the window.
 */
function useInsideItsEmbed(anchor: RefObject<HTMLDivElement | null>, drawn: boolean) {
  useLayoutEffect(() => {
    const element = anchor.current;
    const embed = element?.parentElement?.closest<HTMLElement>("[data-embed-content]");
    if (!element || !embed) return;
    const place = () => {
      const at = askPlace(embed.getBoundingClientRect(), { width: document.documentElement.clientWidth || innerWidth, height: innerHeight }, NEED);
      element.style.width = `${at.width}px`;
      element.style.height = `${at.height}px`;
      pin(element, at, at.shown);
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(embed);
    return () => {
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [anchor, drawn]);
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
