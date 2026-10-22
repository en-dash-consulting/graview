import type { AnySchema } from "@graview/core";
import { aggregateId, withFocus, withOverview, withWithin } from "@graview/layout/view";
import { createContext, useContext, useMemo } from "react";
import { useGraviewIfAny } from "./context.js";

/**
 * WHERE A VIEW SENDS THE READER, ON WHICHEVER FACE IT IS DRAWN.
 *
 * A view that is not React — a guest in a worker (FR-93) — can name a
 * record, a place of the app or a kind's list, and nothing else, and has
 * no router to name it with. On the Graview face going to a record is
 * focusing and choosing it, going to a place is focusing the kind it is a
 * picture of with that picture, and going to a list is focusing the kind's
 * district; the routed face says otherwise, with its own addresses, by
 * providing `GoToContext`.
 *
 * NARROWED, AND TO A SECTION. A list or a place may be gone to narrowed —
 * a `filter` in the words an address already carries it in (`stage:building`,
 * `?filter=` on a page, `in.filter` in a stop) — and any of them to a
 * section of the page: a heading's words or an element's id, `#<section>`
 * on the routed face (`revealSection`). A stop in the scene is a picture,
 * not a page of headings: the scene goes to the stop and leaves the
 * section unsought.
 */
export interface GoTo {
  /** Go to a record, by id; to one section of its page, given one. */
  record(id: string, also?: GoToAlso): void;
  /** Go to a named place, by its slug (`placeSlug(title)`), narrowed and to a section, given them. */
  place(as: string, also?: GoToAlso): void;
  /** Go to a kind's list, by the kind's name, narrowed and to a section, given them. */
  list(kind: string, also?: GoToAlso): void;
  /**
   * Show the view the seat (or the inline AI) just drew: the routed face
   * goes to its own address for it (`/~draft`); the scene draws it in place
   * of the picture already, and says nothing.
   */
  draft?(): void;
  /**
   * THE ADDRESS GOING THERE ARRIVES AT (0.1.47), on a face whose places are
   * addresses: a path on the page's own origin, with the face's base, its
   * filter and its section — what a worker view's `<a data-record>` carries
   * as its `href`, so it opens in a new tab and is copied as a link is. The
   * scene has none: going there is a picture, not an address.
   */
  href?(to: GoToTarget, also?: GoToAlso): string | undefined;
}

/** Where a destination is: a record by id, a named place by slug, a kind's list by the kind's name. */
export type GoToTarget = { readonly record: string } | { readonly place: string } | { readonly list: string };

/** Where on the page a destination is, and what it is narrowed to. */
export interface GoToAlso {
  /** What the list or the picture keeps, in the address's words: `stage:building`, `stage:building,owner:user:ada`. */
  readonly filter?: string;
  /** A section of the page: an element's id or a heading's words (`"Shipping soon"`, `"shipping-soon"`). */
  readonly section?: string;
}

/** What a face says going somewhere means there. The Graview face's own, when none is given. */
export const GoToContext = createContext<GoTo | null>(null);

/** How to go to a record, a place or a list from here. */
export function useGoTo<S extends AnySchema>(): GoTo {
  const given = useContext(GoToContext);
  const graview = useGraviewIfAny<S>();
  /*
   * A KIND'S DISTRICT, with a picture of it or its own stop, narrowed as
   * asked (`in.filter`, which the stop's arranging line reads) — or not at
   * all: a destination gone to without a filter is not narrowed by the last.
   */
  const stop = (kind: string, as: string | null, also?: GoToAlso) =>
    graview?.setView((view) => withWithin(withWithin(withOverview(withFocus(view, aggregateId(kind)), false), "view", as), "filter", also?.filter ?? null));
  return useMemo<GoTo>(
    () =>
      given ?? {
        record: (id) => {
          if (!graview) return;
          graview.setView((view) => withFocus(withOverview(view, false), id));
          graview.setSelection([id]);
        },
        place: (as, also) => {
          const place = graview?.views.places().find((candidate) => candidate.as === as);
          if (place) stop(place.kind, place.as, also);
        },
        list: (kind, also) => stop(kind, null, also),
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [given, graview],
  );
}
