import type { AnySchema } from "@graview/core";
import { alsoWhenSectionsArrive, MenuSections } from "@graview/react/drawing";
import { useGraview, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { inlineAiOn } from "@graview/tools/frame";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

/**
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better): the door,
 * as small as a face can carry before it draws.
 *
 * A right-click inside a worker view finds the section under it ("This
 * week", `sectionUnder`) — the menu is headed with its name and the section
 * outlined while the menu is open — and, for a seat that may change the
 * app's views, offers "Make “This week” better": Just do it, Describe
 * changes…, Highlight area…. Each opens the section's card, which revises
 * that section alone, shows the revision as a draft in place, and keeps it
 * through the host's view door (`KeptViews.revise`) on Keep.
 *
 * Nothing of it is fetched before the first right-click inside a view: the
 * menu's section and the door (`section-menu.tsx`) arrive with the section
 * finder, and the menu opens once both are here; the outline, the card and
 * the revision arrive as the menu is prepared. Offered where the host gave
 * a model and did not turn AI off, where its views lend `revise`, where it
 * says this seat may change views (`current().may.views`), and where the
 * view's code is a plain script the page holds.
 */

export type { SectionAsk, SectionMode } from "./section-menu.js";

type Menu = typeof import("./section-menu.js");
let menu: Menu | undefined;
const heard = /* @__PURE__ */ new Set<() => void>();
const hear = (listener: () => void) => (heard.add(listener), () => void heard.delete(listener));
const load = () =>
  import("./section-menu.js").then((module) => {
    menu = module;
    heard.forEach((listener) => listener());
  });

/** "Make “This week” better" on the context menu, or nothing where it is not this seat's to offer. */
export function useSectionBetterSection(): MenuSectionSource | null {
  const { ai, aiDesk, keptViews } = useGraview<AnySchema>();
  alsoWhenSectionsArrive(load);
  const on = inlineAiOn(ai) && typeof keptViews?.revise === "function";
  return useMemo<MenuSectionSource | null>(() => (on ? (target: MenuTarget) => (target.section && menu && keptViews ? menu.sectionFor(target, aiDesk, keptViews) : null) : null), [on, aiDesk, keptViews]);
}

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with "Make this better" in it where it is offered. */
export function SectionBetterSections({ children }: { readonly children: ReactNode }) {
  const section = useSectionBetterSection();
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}

/** Where the outline and the card are drawn, once the first right-click inside a view has fetched them. */
export function SectionBetterDoor() {
  const Door = useSyncExternalStore(hear, () => menu?.SectionDoor, () => undefined);
  return Door ? <Door /> : null;
}
