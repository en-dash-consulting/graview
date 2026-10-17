import type { AnySchema } from "@graview/core";
import { aggregateId, kindCardId } from "@graview/layout/view";
import { QuickAskDoor } from "@graview/primitives/pages";
import { useGraviewIfAny } from "@graview/react/provider";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { kindOfSlug } from "./registry.js";
import type { PageContext } from "./pages.js";

/**
 * THE QUICK ASK ON EVERY PAGE — the same one as on the scene (Roadmap
 * f-quick-ask-framework): ⌘K opens the command bar beside what the page is
 * about, and an answer is a card beside the record's heading or the list.
 *
 * WHAT "THIS" MEANS HERE IS THE ROUTE. On a record it is that record; on a
 * kind's page, that kind; on a picture, the kind it is a picture of. The
 * provider's selection is set from the address, so the bar is opened on
 * the same thing on both faces.
 */
export function PageQuickAsk<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const here = useGraviewIfAny<S>();
  if (!here) return null;
  return (
    <>
      <RouteSubject context={context} />
      <QuickAskDoor face="pages" on={context.quickAsk ?? true} />
    </>
  );
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
