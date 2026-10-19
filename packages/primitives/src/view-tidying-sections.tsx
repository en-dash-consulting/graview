import { MenuSections } from "@graview/react/drawing";
import type { MenuSectionSource } from "@graview/react/provider";
import { useMemo, type ReactNode } from "react";
import { useViewTidyingSection } from "./view-tidying.js";

/*
 * Its own module: the bar reads the tidying (`./view-tidying.tsx`) up front,
 * and `MenuSections` is the drawn faces' (`@graview/react/drawing`), fetched
 * with them.
 */

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with Hide and Delete in it for a place this viewer may tidy (Roadmap f-place-menu-views). */
export function ViewTidyingSections({ children }: { readonly children: ReactNode }) {
  const section = useViewTidyingSection();
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}
