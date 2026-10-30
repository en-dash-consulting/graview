import { retryingImport } from "@graview/core/retry";
import type { AnySchema, KeptViews } from "@graview/core";
import { viewPlaceOf } from "@graview/react/drawing";
import { placeOfSection } from "./section-words.js";
import { lazyModule, useGraview, type AiDesk, type MenuSection, type MenuTarget, type MenuViewSection } from "@graview/react/provider";
import { Suspense, useEffect, useId, useMemo, useSyncExternalStore, type ComponentType } from "react";
import type { SectionDrawnProps } from "./section-better.js";
import { SectionOutline } from "./section-outline.js";

/*
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better): the menu's
 * section and the door, fetched with the first right-click inside a worker
 * view (`section-door.tsx` asks it beside the section finder). The outline
 * and the card are fetched in turn, as the menu is prepared.
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

/* The card asked, per desk, and the doors drawn (only the first draws, so a routed face inside a scene's shell draws once). */
interface Held {
  ask: SectionAsk | null;
  readonly doors: string[];
  readonly heard: Set<() => void>;
}
const HELD = /* @__PURE__ */ new WeakMap<AiDesk, Held>();
const heldOf = (desk: AiDesk): Held => {
  let held = HELD.get(desk);
  if (!held) HELD.set(desk, (held = { ask: null, doors: [], heard: new Set() }));
  return held;
};
const tell = (held: Held) => held.heard.forEach((listener) => listener());
let asked = 0;

/** Opens the section's card on this app's desk; null puts it away. */
export function askSection(desk: AiDesk, ask: Omit<SectionAsk, "at"> | null): void {
  const held = heldOf(desk);
  held.ask = ask ? { ...ask, at: ++asked } : null;
  tell(held);
}

/* The outline over a section a menu is open on and the card asked for, fetched with the first right-click inside a view (the menu's `prepare`). */
const drawn = /* @__PURE__ */ lazyModule(retryingImport(() => import("./section-better.js")));
const Drawn = /* @__PURE__ */ drawn.part((module, props: SectionDrawnProps) => {
  const Part = module.SectionDrawn as ComponentType<SectionDrawnProps>;
  return <Part {...props} />;
}, { what: "Make this better" });

/** "Make “This week” better" for a menu opened on a section, or nothing where it is not this seat's to offer. */
export function sectionFor(target: MenuTarget, aiDesk: AiDesk, keptViews: KeptViews): MenuSection | null {
  const section = target.section;
  // Asked as the menu opens: the host says who may change views now, and the view's place must lend a revision.
  if (!section || keptViews.current().may.views !== true || !viewPlaceOf(placeOfSection(section))) return null;
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
    prepare: () => drawn.prefetch(),
  };
}

/** Where the outline and the card are drawn: nothing at all until a menu is open on a section or a card is asked for. */
export function SectionDoor() {
  const { aiDesk, menuAt } = useGraview<AnySchema>();
  const held = heldOf(aiDesk);
  const id = useId();
  const subscribe = useMemo(
    () => (listener: () => void) => {
      held.heard.add(listener);
      return () => void held.heard.delete(listener);
    },
    [held],
  );
  useEffect(() => {
    held.doors.push(id);
    tell(held);
    return () => {
      held.doors.splice(held.doors.indexOf(id), 1);
      tell(held);
    };
  }, [held, id]);
  const mine = useSyncExternalStore(subscribe, () => held.doors[0] === id, () => false);
  const ask = useSyncExternalStore(subscribe, () => held.ask, () => null);
  const open = menuAt?.section;
  if (!mine || (!ask && !open)) return null;
  /* The outline at once, over the section a menu is open on; the card fetched when asked for. */
  if (!ask) return <SectionOutline elements={open!.elements} />;
  return (
    <Suspense fallback={null}>
      <Drawn ask={ask} close={() => askSection(aiDesk, null)} />
    </Suspense>
  );
}
