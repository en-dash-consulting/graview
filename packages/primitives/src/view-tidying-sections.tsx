import type { Place } from "@graview/core";
import { aggregateId, withOverview, withPicture } from "@graview/layout/view";
import { MenuSections } from "@graview/react/drawing";
import { useNavigation, type MenuSectionSource } from "@graview/react/provider";
import { useCallback, useMemo, type ReactNode } from "react";
import { useViewTidyingSection } from "./view-tidying.js";

/*
 * Its own module: the bar reads the tidying (`./view-tidying.tsx`) up front,
 * and `MenuSections` is the drawn faces' (`@graview/react/drawing`), fetched
 * with them.
 */

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with Hide and Delete in it for a place this viewer may tidy (Roadmap f-place-menu-views). */
export function ViewTidyingSections({ children }: { readonly children: ReactNode }) {
  /* The scene showing a picture just deleted goes to its kind's own picture, else up to the whole thing. */
  const { view, go } = useNavigation();
  const away = useCallback(
    (place: Place, after: Place | undefined) => {
      const showing = view.within?.["view"];
      const on = view.focusId === aggregateId(place.kind) && (showing === undefined || showing === place.as);
      if (on) go(after ? withPicture(view, after.kind, after.as) : withOverview(view, true));
    },
    [view, go],
  );
  const section = useViewTidyingSection(away);
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}
