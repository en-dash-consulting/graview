import { retryingImport } from "@graview/core/retry";
import type { AnySchema } from "@graview/core";
import { MenuSections, placeOfSection, viewPlaceOf } from "@graview/react/drawing";
import { lazyModule, useGraview, type AiDesk, type MenuSectionSource, type MenuTarget, type MenuViewSection } from "@graview/react/provider";
import { inlineAiOn } from "@graview/tools/frame";
import { Suspense, useEffect, useId, useMemo, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { SectionCardProps } from "./section-better.js";

/**
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better): the door.
 *
 * A right-click inside a worker view finds the section under it ("This
 * week", `sectionUnder`) — the menu is headed with its name and the section
 * outlined while the menu is open — and, for a seat that may change the
 * app's views, offers "Make “This week” better": Just do it, Describe
 * changes…, Highlight area…. Each opens the section's card
 * (`section-better.tsx`), fetched the first time one is asked for, which
 * revises that section alone, shows the revision as a draft in place, and
 * keeps it through the host's view door (`KeptViews.revise`) on Keep.
 *
 * Offered where the host gave a model and did not turn AI off, where its
 * views lend `revise`, where it says this seat may change views
 * (`current().may.views`), and where the view's code is a plain script the
 * page holds.
 */

/** How the card was asked for. */
export type SectionMode = "just" | "describe" | "highlight";

/** The card asked for: on which section, how. */
export interface SectionAsk {
  readonly section: MenuViewSection;
  readonly mode: SectionMode;
  readonly at: number;
  readonly returnTo?: HTMLElement | null;
}

interface Held {
  ask: SectionAsk | null;
  /** The doors drawn, first first: only the first draws, so a routed face inside a scene's shell draws once. */
  readonly doors: string[];
  readonly listeners: Set<() => void>;
}
const HELD = new WeakMap<AiDesk, Held>();
const heldOf = (desk: AiDesk): Held => {
  let held = HELD.get(desk);
  if (!held) HELD.set(desk, (held = { ask: null, doors: [], listeners: new Set() }));
  return held;
};
let asked = 0;

/** Opens the section's card on this app's desk; null puts it away. */
export function askSection(desk: AiDesk, ask: Omit<SectionAsk, "at"> | null): void {
  const held = heldOf(desk);
  held.ask = ask ? { ...ask, at: ++asked } : null;
  for (const listener of [...held.listeners]) listener();
}

const cardModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./section-better.js")));
/* The outline over a section a menu is open on: fetched with the card, as the menu is prepared. */
const Outline = /* @__PURE__ */ cardModule.part(
  (module, props: { readonly elements: readonly Element[] }) => {
    const Drawn = module.SectionOutline as ComponentType<{ readonly elements: readonly Element[] }>;
    return <Drawn {...props} />;
  },
  { quiet: true },
);
const Card = /* @__PURE__ */ cardModule.part(
  (module, props: SectionCardProps) => {
    const Drawn = module.SectionCard as ComponentType<SectionCardProps>;
    return <Drawn {...props} />;
  },
  { what: "Make this better" },
);

/** "Make “This week” better" on the context menu, or nothing where it is not this seat's to offer. */
export function useSectionBetterSection(): MenuSectionSource | null {
  const { ai, aiDesk, keptViews } = useGraview<AnySchema>();
  const on = inlineAiOn(ai) && typeof keptViews?.revise === "function";
  return useMemo<MenuSectionSource | null>(
    () =>
      on
        ? (target: MenuTarget) => {
            const section = target.section;
            // Asked as the menu opens: the host says who may change views now.
            if (!section || keptViews?.current().may.views !== true) return null;
            if (!viewPlaceOf(placeOfSection(section))) return null;
            const open = (mode: SectionMode) => () => askSection(aiDesk, { section, mode, returnTo: target.element ?? null });
            return {
              id: "make-better",
              heading: `Make “${section.name}” better`,
              // First: the menu was opened on the section, and is named for it.
              at: "start",
              items: [
                { id: "section-just-do-it", label: "Just do it", hint: "You see it before it is kept", run: open("just") },
                { id: "section-describe", label: "Describe changes…", run: open("describe") },
                { id: "section-highlight", label: "Highlight area…", run: open("highlight") },
              ],
              prepare: () => cardModule.prefetch(),
            };
          }
        : null,
    [on, aiDesk, keptViews],
  );
}

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with "Make this better" in it where it is offered. */
export function SectionBetterSections({ children }: { readonly children: ReactNode }) {
  const section = useSectionBetterSection();
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}

/**
 * WHERE THE OUTLINE AND THE CARD ARE DRAWN: the section a menu is open on,
 * outlined; the card asked for, fetched and drawn.
 */
export function SectionBetterDoor() {
  const { aiDesk, menuAt } = useGraview<AnySchema>();
  const held = heldOf(aiDesk);
  const subscribe = useMemo(
    () => (listener: () => void) => {
      held.listeners.add(listener);
      return () => void held.listeners.delete(listener);
    },
    [held],
  );
  const id = useId();
  useEffect(() => {
    held.doors.push(id);
    for (const listener of [...held.listeners]) listener();
    return () => {
      held.doors.splice(held.doors.indexOf(id), 1);
      for (const listener of [...held.listeners]) listener();
    };
  }, [held, id]);
  const mine = useSyncExternalStore(subscribe, () => held.doors[0] === id, () => false);
  const ask = useSyncExternalStore(subscribe, () => held.ask, () => null);
  const open = menuAt?.section;
  if (!mine) return null;
  return (
    <>
      {open && !ask ? (
        <Suspense fallback={null}>
          <Outline elements={open.elements} />
        </Suspense>
      ) : null}
      {ask ? (
        <Suspense fallback={null}>
          <Card key={ask.at} ask={ask} close={() => askSection(aiDesk, null)} />
        </Suspense>
      ) : null}
    </>
  );
}
