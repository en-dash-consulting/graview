import { retryingImport } from "@graview/core/retry";
import { isCurrent, type AnySchema } from "@graview/core";
import { viewPlaceOf } from "@graview/react/drawing";
import { placeOfSection } from "./section-words.js";
import { lensNarrows, nudgesFor, pageMayChange, pagePartOf, PARTS, type PagePart } from "./page-parts.js";
import { aboutTheLook, mayChangeDeclaration } from "@graview/tools/section";
import { lazyModule, useGoTo, useGraview, type AiDesk, type GraviewContextValue, type MenuPage, type MenuSection, type MenuTarget, type MenuViewSection } from "@graview/react/provider";
import { pluralLabel } from "@graview/core";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
import { Suspense, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ComponentType } from "react";
import type { SectionDrawnProps } from "./section-better.js";
import { SectionOutline } from "./section-outline.js";
import { FACE_EVENT } from "./frame.js";

/*
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better): the menu's
 * section and the door, fetched with the first right-click inside a worker
 * view (`section-door.tsx` asks it beside the section finder). The outline
 * and the card are fetched in turn, as the menu is prepared.
 */

/** How the card was asked for. */
/** How the card was asked for: at once, in words, by pointing — or opened to choose (Better UI with nothing typed); or the switch between other ways to show the page. */
export type SectionMode = "just" | "describe" | "highlight" | "choose" | "options";

/** The card asked for: on which section of a view, or which part of a built-in page; how; and the words, where the menu was typed in. */
export type SectionAsk = ({ readonly section: MenuViewSection; readonly part?: undefined } | { readonly part: PagePart; readonly section?: undefined }) & {
  readonly mode: SectionMode;
  readonly words?: string;
  /** Asked with a right-click in the scene, and opened on the part's page: the card says so. */
  readonly fromScene?: boolean;
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
/* The helds with a door drawn now: where a page's card goes when the door it was in is drawn again elsewhere. */
const OPEN = /* @__PURE__ */ new Set<Held>();
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
/* A conversation may draw the page again many times, each a moment apart, while a model thinks for minutes. */
const CARRIED_MS = 60_000;

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

/* The switch between other ways to show a page (Roadmap f-display-options-switch), fetched as the menu is prepared. */
const optionsSwitch = /* @__PURE__ */ lazyModule(retryingImport(() => import("./display-options-switch.js")));
const OptionsSwitch = /* @__PURE__ */ optionsSwitch.part((module, props: { readonly ask: Extract<SectionAsk, { part: object }>; readonly close: () => void }) => <module.DisplaySwitch {...props} />, { what: "Other ways to show this" });

/** What the menu's section reads of the provider as it opens: the desk, the host's views and its door to a change to the app. */
export type SectionHere = Pick<GraviewContextValue<AnySchema>, "aiDesk" | "ai" | "keptViews" | "store" | "principal" | "onProposeChange" | "composeChange" | "app" | "views">;

/*
 * ✨ BETTER UI, A WAY TO ASK UNDER THE MENU'S FIELD (Roadmap
 * f-make-any-page-better): its button beside Chat, lit where the Fast slot
 * reads typed words as about how the part looks (`aboutTheLook`); pressed
 * with words, the card asks them at once; with none, it opens to choose —
 * Just do it, Describe changes…, Highlight area….
 */
const betterMode = (here: SectionHere, name: string, open: (words?: string) => void, nudges: () => readonly string[], prepare: () => void): MenuSection => ({
  id: "make-better",
  at: "start",
  mode: {
    id: "better",
    label: "Better UI",
    mark: "✨",
    claims: async (words) => (await aboutTheLook(here.ai, words, name)).about === "look",
    open,
    nudges,
  },
  prepare,
});

/*
 * ✨ BETTER UI IN THE SCENE (Roadmap f-make-any-page-better). A right-click
 * on a place or a record in the scene offered Chat alone: Better UI came
 * only from the routed face's page parts. The scene draws a place and a
 * kind's records with the same declaration the pages draw them with, and a
 * new design is made and judged on a page, so the scene offers Better UI
 * for what is under the pointer — the place ("The lists"), or the kind's
 * list a record is on ("Tasks") — and opens it on that page: the pages are
 * switched to, the page gone to, and the card opened there, saying it came
 * from the scene. Carried across the switch in this tab's session, which a
 * host that draws the pages at their own address reloads into.
 */
const CARRY = "graview.better.from-scene";
/** How long a Better UI asked in the scene waits for its page to be drawn. */
const CARRY_MS = 30_000;
interface Carried {
  readonly to: { readonly list: string } | { readonly place: string };
  readonly mode: SectionMode;
  readonly words?: string;
  readonly at: number;
}

/** The part of the pages a right-click in the scene is about: a place by its title, or the list of the kind it is on. */
function scenePartOf(target: MenuTarget, here: SectionHere): { readonly name: string; readonly to: Carried["to"]; readonly part: PagePart } | undefined {
  const schema = here.store.schema;
  const places = here.views.places?.() ?? [];
  const placed = (as: string) => places.find((one) => one.as === as);
  const one = target.on ?? (target.about.length === 1 ? target.about[0] : undefined);
  const aggregate = one?.startsWith("aggregate:") ? one.slice("aggregate:".length) : undefined;
  const node = one && !aggregate ? here.store.graph.getNode(one) : undefined;
  const place = target.place !== undefined ? placed(target.place) : aggregate && !aggregate.includes("+") ? places.find((each) => each.kind === aggregate) : undefined;
  if (place) return { name: place.title, to: { place: place.as }, part: { name: place.title, slot: "place", kind: place.kind, place: place.as, elements: [], main: null } };
  const kind = aggregate && !aggregate.includes("+") && schema.tryDefinition(aggregate) ? aggregate : node?.kind;
  if (!kind) return undefined;
  const name = pluralLabel(schema, kind);
  return { name, to: { list: kind }, part: { name, slot: "list", kind, elements: [], main: null } };
}

/** ✨ Better UI for a menu opened on a section of a view or on a page's part, or nothing where it is not this seat's to offer. */
export function sectionFor(target: MenuTarget, here: SectionHere): MenuSection | null {
  const { aiDesk, keptViews } = here;
  const section = target.section;
  const returnTo = target.element ?? null;
  if (!section && target.face === "scene") {
    // The pages are a row of the app menu (Roadmap f-app-bar-calm), drawn only while it is open: its control says the bar holds them, and is asked to go there.
    const door = typeof document === "undefined" ? null : document.querySelector<HTMLElement>('[data-testid="app-menu-open"][data-pages]');
    const pages = door ? { click: () => door.dispatchEvent(new CustomEvent(FACE_EVENT, { detail: "pages" })) } : null;
    const scene = scenePartOf(target, here);
    if (!pages || !scene || !pageMayChange(scene.part, here)) return null;
    const open = (words?: string) => {
      try {
        sessionStorage.setItem(CARRY, JSON.stringify({ to: scene.to, mode: words ? "describe" : "choose", ...(words ? { words } : {}), at: Date.now() } satisfies Carried));
      } catch {
        return;
      }
      pages.click();
    };
    return betterMode(here, scene.name, open, () => [`Make “${scene.name}” easier to read at a glance`], () => drawn.prefetch());
  }
  if (section) {
    // Asked as the menu opens: the host says who may change views now, and the view's place must lend a revision.
    if (!keptViews?.revise || keptViews.current().may.views !== true || !viewPlaceOf(placeOfSection(section))) return null;
    const open = (words?: string) => askSection(aiDesk, words ? { section, mode: "describe", words, returnTo } : { section, mode: "choose", returnTo });
    return betterMode(here, section.name, open, () => [`Make “${section.name}” easier to read at a glance`], () => drawn.prefetch());
  }
  const part = target.page && target.face === "pages" ? pagePartOf(target.page, here) : undefined;
  if (!part || !pageMayChange(part, here)) return null;
  PARTS.set(target.page!.at, part);
  const open = (words?: string) => askSection(aiDesk, words ? { part, mode: "describe", words, returnTo } : { part, mode: "choose", returnTo });
  return betterMode(here, part.name, open, () => nudgesFor(part, here), () => drawn.prefetch());
}

/**
 * "OTHER WAYS TO SHOW THIS" (Roadmap f-display-options-switch): on a kind's
 * list or a place a lens draws, for a seat that may change the app where the
 * host lends the change. It needs no model. Nothing on a kind with no
 * records: there would be nothing to show.
 *
 * NOR ON A LIST THAT WOULD NOT CHANGE. `listStands` is the face's word for
 * a kind's list keeping one could not reach: a product design drew its own,
 * or the address asks for the list the app draws by itself. A page never
 * says it now shows as something while it draws the same thing. A place is
 * still offered, whatever the design: its lens is what draws it.
 */
export function displayOptionsSection(target: MenuTarget, here: SectionHere, listStands?: (kind: string) => boolean): MenuSection | null {
  const { aiDesk, app, composeChange, onProposeChange, principal, store } = here;
  if (target.face !== "pages" || target.section || !target.page) return null;
  if (onProposeChange === undefined || composeChange === undefined || !mayChangeDeclaration(store, principal)) return null;
  const part = pagePartOf(target.page, here);
  if (!part?.kind || (part.slot !== "list" && part.slot !== "group" && part.slot !== "place")) return null;
  // A place somebody wrote as a view is not one the declaration can draw another way.
  if (part.slot !== "place" && listStands?.(part.kind)) return null;
  if (part.slot === "place") {
    const lens = ((app as { readonly lenses?: readonly { readonly title?: string; readonly name?: unknown; readonly options?: unknown }[] } | undefined)?.lenses ?? []).find((one) => one.title === part.name);
    if (!lens || lensNarrows(lens, part.kind)) return null;
  }
  // The records the page would show: a kind with only retired ones has nothing to show another way.
  const definition = store.schema.tryDefinition(part.kind);
  if (!store.graph.nodesOfKind(part.kind).some((node) => isCurrent(definition, node))) return null;
  // A group's heading is on its kind's list: the list is what is shown another way.
  const whole: PagePart = part.slot === "group" ? { name: pluralLabel(store.schema, part.kind), slot: "list", kind: part.kind, elements: part.main ? [part.main] : [], main: part.main } : part;
  const returnTo = target.element ?? null;
  return { id: "display-options", items: [{ id: "other-ways", label: "Other ways to show this", run: () => askSection(aiDesk, { part: whole, mode: "options", returnTo }) }], prepare: () => optionsSwitch.prefetch() };
}

/** The elements of the page's part a menu is open on, where "Make … better" named one. */
const outlinedPart = (page: NonNullable<MenuTarget["page"]>): readonly Element[] | undefined => PARTS.get(page.at)?.elements;

/** Where the outline and the card are drawn: nothing at all until a menu is open on a section or a card is asked for. */
export function SectionDoor() {
  const here = useGraview<AnySchema>();
  const { aiDesk, menuAt } = here;
  const goTo = useGoTo();
  const latest = useRef({ here, goTo });
  latest.current = { here, goTo };
  /* A Better UI asked in the scene: once the pages are drawn here, its page is gone to and its card opened on it. */
  useEffect(() => {
    let carried: Carried | null = null;
    try {
      carried = JSON.parse(sessionStorage.getItem(CARRY) ?? "null") as Carried | null;
    } catch {
      return;
    }
    if (!carried || Date.now() - carried.at > CARRY_MS) return;
    const to = carried.to;
    try {
      sessionStorage.removeItem(CARRY);
    } catch {
      // Kept or not, it is taken now.
    }
    // The page asked for, gone to at once; the card opened on it once it is drawn.
    if ("list" in to) latest.current.goTo.list(to.list);
    else latest.current.goTo.place(to.place);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      // A page drawn: its own region, else the region around its title (a product's own design marks no region).
      const title = document.querySelector("[data-graview-page-title]");
      const pages = document.querySelector("[data-graview-page-main]") ?? title?.closest("main") ?? title?.parentElement?.parentElement ?? null;
      if (!pages || tries < 4) {
        if (tries > 150) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      const page: MenuPage = "place" in to ? { at: pages, place: to.place } : { at: pages, about: [`aggregate:${to.list}`] };
      const part = pagePartOf(page, latest.current.here);
      if (!part || !pageMayChange(part, latest.current.here)) return;
      PARTS.set(pages, part);
      askSection(latest.current.here.aiDesk, carried!.words ? { part, mode: "describe", words: carried!.words, fromScene: true } : { part, mode: carried!.mode, fromScene: true });
    }, 120);
    return () => clearInterval(timer);
  }, []);
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
    OPEN.add(held);
    if (!held.ask && carried && carried.ask.part && Date.now() - carried.at < CARRIED_MS) held.ask = carried.ask;
    carried = null;
    tell(held);
    return () => {
      held.doors.splice(held.doors.indexOf(id), 1);
      if (held.doors.length === 0) {
        OPEN.delete(held);
        if (held.ask?.part) {
          // Carried to a door already drawn again on another desk — the page drawn anew before this one went — else to the next one drawn.
          const next = [...OPEN].find((one) => !one.ask);
          if (next) {
            next.ask = held.ask;
            tell(next);
          } else carried = { ask: held.ask, at: Date.now() };
        }
      }
      tell(held);
    };
  }, [held, id]);
  const mine = useSyncExternalStore(subscribe, () => held.doors[0] === id, () => false);
  const ask = useSyncExternalStore(subscribe, () => held.ask, () => null);
  const open = menuAt?.section?.elements ?? (menuAt?.page ? outlinedPart(menuAt.page) : undefined);
  if (!mine || (!ask && !open)) return null;
  /* The outline at once, over the section or the part a menu is open on; the card fetched when asked for. */
  if (!ask) return <SectionOutline elements={open!} />;
  if (ask.mode === "options" && ask.part) {
    return (
      <Suspense fallback={null}>
        <OptionsSwitch ask={ask} close={() => askSection(aiDesk, null)} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <Drawn ask={ask} close={() => askSection(aiDesk, null)} />
    </Suspense>
  );
}
