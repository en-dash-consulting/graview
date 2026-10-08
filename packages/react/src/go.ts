import type { AnySchema } from "@graview/core";
import { withFocus, withOverview, withPicture } from "@graview/layout/view";
import { createContext, useContext, useMemo } from "react";
import { useGraviewIfAny } from "./context.js";

/**
 * WHERE A VIEW SENDS THE READER, ON WHICHEVER FACE IT IS DRAWN.
 *
 * A view that is not React — a guest in a worker (FR-93) — can name a
 * record or a place of the app and nothing else, and has no router to
 * name it with. On the Graview face going to a record is focusing and
 * choosing it, and going to a place is focusing the kind it is a picture
 * of with that picture; the routed face says otherwise, with its own
 * addresses, by providing `GoToContext`.
 */
export interface GoTo {
  /** Go to a record, by id. */
  record(id: string): void;
  /** Go to a named place, by its slug (`placeSlug(title)`). */
  place(as: string): void;
}

/** What a face says going somewhere means there. The Graview face's own, when none is given. */
export const GoToContext = createContext<GoTo | null>(null);

/** How to go to a record or a place from here. */
export function useGoTo<S extends AnySchema>(): GoTo {
  const given = useContext(GoToContext);
  const graview = useGraviewIfAny<S>();
  return useMemo<GoTo>(
    () =>
      given ?? {
        record: (id) => {
          if (!graview) return;
          graview.setView((view) => withFocus(withOverview(view, false), id));
          graview.setSelection([id]);
        },
        place: (as) => {
          const place = graview?.views.places().find((candidate) => candidate.as === as);
          if (place) graview!.setView((view) => withPicture(view, place.kind, place.as));
        },
      },
    [given, graview],
  );
}
