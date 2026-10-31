import { retryingImport } from "@graview/core/retry";
import type { AnySchema } from "@graview/core";
import { viewPlaceOf } from "@graview/react/drawing";
import { placeOfSection } from "./section-words.js";
import { pageMayChange, pagePartOf, PARTS, type PagePart } from "./page-parts.js";
import { aboutTheLook } from "@graview/tools/section";
import { lazyModule, useGraview, type AiDesk, type GraviewContextValue, type MenuSection, type MenuTarget, type MenuViewSection } from "@graview/react/provider";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
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

/** The card asked for: on which section of a view, or which part of a built-in page; how; and the words, where the menu was typed in. */
export type SectionAsk = ({ readonly section: MenuViewSection; readonly part?: undefined } | { readonly part: PagePart; readonly section?: undefined }) & {
  readonly mode: SectionMode;
  readonly words?: string;
  readonly at: number;
  readonly returnTo?: HTMLElement | null;
};

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

/*
 * A PAGE'S CARD OUTLIVES THE APP IT CHANGED (Roadmap f-make-any-page-better):
 * a host that hands the page a changed app (`setApp`) may draw it all again
 * — a new provider, a new desk — for a draft shown or a change kept. A
 * page's card asked when its last door went is carried to the next door
 * drawn within a few seconds, so the draft keeps its Keep and the change
 * its Undo.
 */
let carried: { readonly ask: SectionAsk; readonly at: number } | null = null;
const CARRIED_MS = 5_000;

/** Opens the section's card on this app's desk; null puts it away. */
export function askSection(desk: AiDesk, ask: DistributiveOmit<SectionAsk, "at"> | null): void {
  const held = heldOf(desk);
  held.ask = ask ? ({ ...ask, at: ++asked } as SectionAsk) : null;
  tell(held);
}

/* The outline over a section a menu is open on and the card asked for, fetched with the first right-click inside a view (the menu's `prepare`). */
const drawn = /* @__PURE__ */ lazyModule(retryingImport(() => import("./section-better.js")));
const Drawn = /* @__PURE__ */ drawn.part((module, props: SectionDrawnProps) => {
  const Part = module.SectionDrawn as ComponentType<SectionDrawnProps>;
  return <Part {...props} />;
}, { what: "Make this better" });

/** What the menu's section reads of the provider as it opens: the desk, the host's views and its door to a change to the app. */
export type SectionHere = Pick<GraviewContextValue<AnySchema>, "aiDesk" | "ai" | "keptViews" | "store" | "principal" | "onProposeChange" | "composeChange" | "app" | "views">;

/** The three ways in, the same on a view's section and on a page's part. */
const ways = (name: string, open: (mode: SectionMode) => () => void, takesWords: (words: string) => Promise<boolean>, prepare: () => void): MenuSection => ({
  id: "make-better",
  heading: `Make “${name}” better`,
  // First: the menu was opened on it, and is named for it.
  at: "start",
  items: [
    { id: "section-just-do-it", label: "Just do it", hint: "You see it before it is kept", run: open("just") },
    { id: "section-describe", label: "Describe changes…", run: open("describe") },
    { id: "section-highlight", label: "Highlight area…", run: open("highlight") },
  ],
  prepare,
  takesWords,
});

/*
 * WORDS ABOUT THE LOOK (Roadmap f-make-any-page-better): words typed in the
 * menu are asked of the Fast slot — about how this looks or is laid out,
 * or about the records — and taken here when they are about the look, the
 * card opened with them already asked.
 */
const lookWords = (here: SectionHere, name: string, ask: (words: string) => void) => async (words: string): Promise<boolean> => {
  const routed = await aboutTheLook(here.ai, words, name);
  if (routed.about !== "look") return false;
  ask(words);
  return true;
};

/** "Make “This week” better" for a menu opened on a section of a view, or "Make “Tasks” better" on a page's part, or nothing where it is not this seat's to offer. */
export function sectionFor(target: MenuTarget, here: SectionHere): MenuSection | null {
  const { aiDesk, keptViews } = here;
  const section = target.section;
  const returnTo = target.element ?? null;
  if (section) {
    // Asked as the menu opens: the host says who may change views now, and the view's place must lend a revision.
    if (!keptViews?.revise || keptViews.current().may.views !== true || !viewPlaceOf(placeOfSection(section))) return null;
    const open = (mode: SectionMode) => () => askSection(aiDesk, { section, mode, returnTo });
    return ways(section.name, open, lookWords(here, section.name, (words) => askSection(aiDesk, { section, mode: "describe", words, returnTo })), () => drawn.prefetch());
  }
  const part = target.page && target.face === "pages" ? pagePartOf(target.page, here) : undefined;
  if (!part || !pageMayChange(part, here)) return null;
  PARTS.set(target.page!.at, part);
  const open = (mode: SectionMode) => () => askSection(aiDesk, { part, mode, returnTo });
  return ways(part.name, open, lookWords(here, part.name, (words) => askSection(aiDesk, { part, mode: "describe", words, returnTo })), () => drawn.prefetch());
}

/** The elements of the page's part a menu is open on, where "Make … better" named one. */
const outlinedPart = (page: NonNullable<MenuTarget["page"]>): readonly Element[] | undefined => PARTS.get(page.at)?.elements;

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
    if (!held.ask && carried && carried.ask.part && Date.now() - carried.at < CARRIED_MS) held.ask = carried.ask;
    carried = null;
    tell(held);
    return () => {
      held.doors.splice(held.doors.indexOf(id), 1);
      if (held.doors.length === 0 && held.ask?.part) carried = { ask: held.ask, at: Date.now() };
      tell(held);
    };
  }, [held, id]);
  const mine = useSyncExternalStore(subscribe, () => held.doors[0] === id, () => false);
  const ask = useSyncExternalStore(subscribe, () => held.ask, () => null);
  const open = menuAt?.section?.elements ?? (menuAt?.page ? outlinedPart(menuAt.page) : undefined);
  if (!mine || (!ask && !open)) return null;
  /* The outline at once, over the section or the part a menu is open on; the card fetched when asked for. */
  if (!ask) return <SectionOutline elements={open!} />;
  return (
    <Suspense fallback={null}>
      <Drawn ask={ask} close={() => askSection(aiDesk, null)} />
    </Suspense>
  );
}
