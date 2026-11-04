import { allLabel, arrangedEntries, hueFor, isInlineSvg, kindPath, MOST_STANDING, offeredPlaces, onePerPicture, OVERVIEW_SLUG, placeLabel, placePath, pluralLabel, primaryOf, samePicture, sharesItsName, supportingKinds, type AnySchema, type Brand, type PagesArrangement, type Place, type Principal, type Store } from "@graview/core";
import { POPOVER_STYLE, useGraviewIfAny, usePopover } from "@graview/react/provider";
import { useQuickAskDrawn } from "./quick-ask-desk.js";
import { createContext, Suspense, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { AppMark } from "./app-title.js";
import { useMarkup } from "./markup.js";
import { barPanes } from "./bar-panes-door.js";
/* The places' foot, Hidden and Recently deleted (Roadmap f-place-menu-views): fetched with the panes, and the tidying with it, once there is something to list and the list is open. */
const TidyFoot = barPanes.part((panes, props: { readonly id: string; readonly scene: boolean; readonly reach: BarGo; readonly done: () => void }) => <panes.TidyFoot {...props} />, { quiet: true });

/* The app menu's rows (Roadmap f-app-bar-calm): fetched with the panes when it is first reached for. */
const AppMenuRows = barPanes.part((panes, props: { readonly faces?: BarFaces | undefined; readonly rows: readonly AppMenuRow[]; readonly scheme?: BarScheme | undefined; readonly close: () => void }) => <panes.AppMenuPane {...props} />, { what: "The app menu" });

/* Who else is here (FR-155): drawn once somebody is, so a reader alone never fetches it. */
const Here = barPanes.part((panes, props: { readonly scene: boolean; readonly compact: boolean }) => <panes.Here {...props} />, { quiet: true });
/**
 * A CHANGE MADE AWAY FROM THIS KEYBOARD IS SAID ALOUD, whether or not anybody
 * is shown here (Roadmap f-changes-heard-without-presence). It was said
 * from the bar's "who is here", which is drawn only once somebody is: a
 * change arriving from a served store with nobody shown present redrew the
 * page in silence. The polite region is always on the bar, empty; an op that
 * is not this reader's own fetches what says it (`changeSaid`, with the
 * bar's panes), politely, once, emptied a beat before so the same words
 * said twice are heard twice. Where the keyboard is, it stays.
 */
function TheirChanges() {
  const graview = useGraviewIfAny();
  const [said, setSaid] = useState("");
  useEffect(
    () =>
      graview?.store.subscribe((_diff, ops) => {
        if (ops.some((op) => op.author.id !== graview.principal.id)) void barPanes.load().then((panes) => panes.sayTheirChange(ops, graview, setSaid), String);
      }),
    [graview],
  );
  return (
    <span role="status" className="graview-bar-said">
      {said}
    </span>
  );
}

/*
 * ONE APP BAR ON EVERY FACE (FR-131), THE SCENE AND THE PAGES AS TWO THINGS
 * (FR-137), AND THE PLACES OUT OF THE BAR (FR-138).
 *
 * The bar is the app — its mark and its name, said once, as the page's
 * heading, the way home — then one switch between the app's two faces,
 * "Scene" and "Pages", an icon and a word each; then, on Pages, the place
 * you are on as one control, its name and a chevron, that opens every place
 * the app has: its home first, then its Lists (one per kind) and its
 * Pictures (the named lenses); then the tools, one size, each named: Find,
 * the standing of the rules, and the person.
 *
 * FR-131 laid the places along the bar as tabs, the scene among them as
 * "Overview". On a real app the bar grew with the app — lenses named in
 * sentences beside kind lists — and wrapped, and the scene was one of seven
 * equal words; a reader could no longer see how to get to it. The bar is a
 * fixed row now whatever the app holds: the switch says where the scene is,
 * and the places are two presses away.
 *
 * THE SCENE HAS ITS PLACES TOO (FR-144): what is in view — the whole thing,
 * or the picture showing — and every picture the scene has, in the same
 * control, grouped as on Pages (`useScenePlaces`).
 *
 * AND THE PLACES STAND IN THE BAR WHEN THERE IS ROOM (FR-145): measured from
 * the bar's own width, the first places in their order — the one you are on
 * always among them — stand on the row as words, the one you are on
 * underlined, and the rest fold into "More". When too few would stand, the
 * one control comes back. The row stays one row; a phone keeps the control.
 *
 * AND THE BAR CALMER (Roadmap f-app-bar-calm): ten things in seven shapes
 * on Homeflow's bar — the name, a Scene | Pages pill, the pages, Find, "25
 * Suggested", "4 Activity", a host's words, the people and the person. Now
 * the app and its pages on the left — the name opens the app menu, which
 * holds the scene and the pages, a host's rows and the scheme — and on the
 * right Find, one inbox (a bell, one count), the host's tools, the people
 * and a host's Share, and you: every tool the bar's one size, every count a
 * badge, nothing drawn as a primary button. Find stays a box where the bar
 * has room and is the magnifier sooner, below `BAR_FIND_FOLDS`.
 */

/** Which of the places a place is: the home, a kind's list, or a picture. */
export type BarPlaceGroup = "home" | "lists" | "pictures";

/** One of the app's places, as the bar's place control lists it: what it is called, and where it is on the routed face. */
export interface BarPlace {
  readonly key: string;
  readonly label: string;
  /** Its path on the routed face. */
  readonly path: string;
  readonly group: BarPlaceGroup;
  /** The kind it is a list or a picture of, for its mark. */
  readonly kind?: string;
  /**
   * Whether it may stand on the bar's row (FR-145, ranked): the main kinds
   * and their pictures do, the machinery folds into "More", and so does a
   * kind with no records yet. Unsaid is yes.
   */
  readonly primary?: boolean;
  /**
   * Kept off the places — a kind's list `pages.hide` names, a picture hidden
   * from the place menu — and so never offered, on the row or in the
   * drop-down, not even while it is the place you are on (`offeredPlaces`);
   * the one control still names it as where you are. Its address, Find and
   * the links to it still reach it.
   */
  readonly hidden?: boolean;
}

/** The key the home's place has (FR-136): the app's front page, first in the list, at the app's own address. */
export const HOME_KEY = "home";
/** The home's address on the routed face: the app's own. */
export const HOME_PATH = "/";
/** The key of the scene's first place (FR-144): the whole thing, no picture in view. */
export const WHOLE_KEY = "scene:whole";

/**
 * THE APP'S PLACES, IN THE LIST'S ORDER (FR-138): the home; each kind's list
 * in the declaration's order; each named picture, then how the kinds
 * connect, when they do. What a seat may not see is not offered: a kind
 * kept from it, a disabled module's kind, a picture over either. The scene
 * is not a place here: it is the switch's (FR-137).
 */
export function barPlaces(input: {
  readonly store: Store<AnySchema>;
  readonly principal?: Principal | undefined;
  readonly views?: { places(): readonly Place[]; arrangement?(): PagesArrangement | undefined } | undefined;
}): readonly BarPlace[] {
  const { store, principal, views } = input;
  const kept = store.kindsKeptFrom(principal);
  const live = (store.schema.kinds as readonly string[]).filter((kind) => !store.modules.disabledKinds.has(kind) && !kept.has(kind));
  const arrangement = views?.arrangement?.();
  const all = views?.places() ?? [];
  /*
   * WHICH STAND: what `pages.primary` names, or — unsaid — every kind but
   * the ones that support the others (`supportingKinds`: the ones the home
   * leaves off, the installation's people, notes about other things), with
   * their pictures. Connections is a way to read the declaration, not a
   * place of the work: it folds.
   *
   * AND NOT A KIND WITH NOTHING IN IT YET, declared or derived alike: a
   * tree that has no constraints yet does not say "Constraints" beside the
   * work, and its first record brings it back. A graph with nothing in any
   * kind folds none — nothing yet says which matter. The place you are on
   * stands whatever it holds, and an open list keeps the row it opened
   * over (FR-158).
   */
  const declared = primaryOf(arrangement, store.schema, all);
  const supporting = supportingKinds(store.schema, arrangement, [...store.modules.administered.values()].flatMap((module) => module.kinds ?? []));
  // Which kinds hold anything, from the counts the graph keeps as records come and go: never a walk of every record.
  const stands = (kind: string, as?: string): boolean => (!store.graph.size.nodes || store.graph.count(kind) > 0) && (declared ? (as ? declared.places.has(`${kind}|${as}`) : declared.kinds.has(kind)) : !supporting.has(kind));
  const out: BarPlace[] = [{ key: HOME_KEY, label: "Home", path: HOME_PATH, group: "home", primary: true }];
  // A place at the scene's address is not offered: the address is the scene's (FR-132). Nor one kept off the lists (`hidden`): a link reaches it.
  const pictured = all.filter((place) => live.includes(place.kind) && place.as !== OVERVIEW_SLUG);
  const seen = pictured.filter((place) => !place.hidden);
  /*
   * A PLACE TITLED AS A KIND'S LIST IS (`pages-place-named-as-a-list`):
   * the place the declaration drew is the one by that name — it stands, as
   * `openingOf` and `pages.primary` already read the word — and the kind's
   * list folds into More as "All root causes", still at its address. Two
   * tabs both reading "Root causes" left a reader to guess which was which.
   */
  const titled = new Set(onePerPicture(seen).map((place) => placeLabel(place, all, store.schema).toLowerCase()));
  // Two DIFFERENT pictures of one name say whose, at `?of=` and beside the name (as the routed face addresses and lists them).
  const pathOf = (place: Place) => placePath(place.as, sharesItsName(place, all) ? kindPath(store.schema, place.kind).slice(1) : undefined);
  const hidden = new Set(arrangement?.hide ?? []);
  /*
   * THE KINDS' LISTS, AND A HOST'S VIEW WHERE `pages.order` NAMES IT
   * (`view:<name>`): the view stands among the lists at its place in the
   * order — a way in the app is about, not one more picture at the foot —
   * on the bar's row unless `pages.primary` says other places. A kind
   * `pages.hide` keeps off is marked `hidden`, and the bar offers it nowhere.
   */
  const arranged = arrangedEntries(live, arrangement?.order, seen);
  for (const { kind, view } of arranged) {
    if (view) {
      out.push({ key: `place:${view.kind}:${view.as}`, label: placeLabel(view, all, store.schema), path: pathOf(view), group: "lists", kind, primary: declared ? declared.places.has(`${kind}|${view.as}`) : true });
      continue;
    }
    const label = pluralLabel(store.schema, kind);
    const named = titled.has(label.toLowerCase());
    out.push({ key: `kind:${kind}`, label: named ? allLabel(store.schema, kind) : label, path: kindPath(store.schema, kind), group: "lists", kind, primary: named || hidden.has(kind) ? false : stands(kind), ...(hidden.has(kind) ? { hidden: true } : {}) });
  }
  /*
   * Each picture once: one over several kinds is one entry, under the first
   * of them this seat sees. One kept off the lists (`hidden`) is marked, here
   * only to say where you are when it is open, and offered nowhere
   * (`offeredPlaces`, Roadmap f-hidden-view-leaves-the-bar).
   */
  for (const place of onePerPicture(pictured)) {
    if (arranged.some((entry) => entry.view && samePicture(entry.view, place))) continue;
    const path = pathOf(place);
    const standing = [place.kind, ...(place.over ?? [])].some((kind) => live.includes(kind) && stands(kind, place.as));
    if (!out.some((held) => held.path === path)) out.push({ key: `place:${place.kind}:${place.as}`, label: placeLabel(place, all, store.schema), path, group: "pictures", kind: place.kind, primary: standing, hidden: place.hidden });
  }
  const connects = live.some((kind) => Object.keys((store.schema.tryDefinition(kind)?.edges ?? {}) as object).length > 0);
  if (connects) out.push({ key: "connections", label: "Connections", path: "/map", group: "pictures", primary: false });
  return out;
}

/** Which of the places a path on the routed face is: its own, a record's kind's, or none (Find, the problems). */
export function barPlaceAt(places: readonly BarPlace[], path: string): string | null {
  const [pathname = "/", search = ""] = path.split("?");
  const exact = places.find((place) => place.path === (search ? `${pathname}?${search}` : pathname)) ?? places.find((place) => place.path === pathname);
  if (exact) return exact.key;
  const first = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  // A record's page is under its kind's list.
  return places.find((place) => place.group === "lists" && place.path === first)?.key ?? null;
}

/**
 * WHERE A FACE PUTS ITS FIND BOX (FR-131). The bar draws the place; the
 * face drawn under it — the scene's Find, or the routed face's — puts its
 * own box there, so Find is one box in one place whichever face is drawn.
 */
export interface BarFind {
  readonly slot: HTMLElement;
  /** A phone's bar: the box opens over the bar's row when it is asked for. */
  readonly compact: boolean;
  /**
   * Where the face puts a tool of its own, after Find and before the
   * standing: the scene's Activity — what happened, the turns to take back,
   * the seat's agent — which only the scene's face holds, so a page that
   * opens on the pages never fetches it.
   */
  readonly own: HTMLElement | null;
}
export const BarFindContext = createContext<BarFind | null>(null);
/** The bar's place for a Find box, when a bar above this face has one. */
export const useBarFind = (): BarFind | null => useContext(BarFindContext);

/** How a place is reached: a link when it has an address, a press when the bar decides. */
export interface BarGo {
  /** The address a place's link carries; none, and the entry is a button. */
  readonly href?: (path: string) => string | undefined;
  /** Goes to a place; a link's ordinary press is handed here rather than followed. */
  readonly go?: (place: BarPlace) => void;
}

/** One of the switch's two faces: what it is called, whether it is drawn, and the way to it. */
export interface BarFace {
  readonly label: string;
  readonly current: boolean;
  readonly go: () => void;
  /** A hand or the keyboard reaching for it (the pointer over it, or on it, or the keyboard on it): fetch what drawing it needs before the press. */
  readonly reach?: () => void;
}

/** THE SWITCH (FR-137): the scene and the pages, the app's two faces. */
export interface BarFaces {
  readonly scene: BarFace;
  readonly pages: BarFace;
}

/**
 * ONE OF A HOST'S BUTTONS ON THE BAR (FR-227, Roadmap
 * f-host-buttons-in-the-app-bar): a press, named by its label, with a mark
 * beside the word where the host gives one — an emoji, a glyph, or an
 * inline `<svg>`, hidden from a reader who cannot see it. A host's only —
 * never a declaration's, never a sandboxed view's: it reaches the bar from
 * `barActions` on an embed, a frame or the Shell, and from nowhere else.
 */
export interface BarAction {
  readonly label: string;
  readonly icon?: string;
  /**
   * THE MARK ALONE (Roadmap f-app-bar-calm): drawn as one of the bar's
   * tools, its label the button's name and its tooltip — Graview Cloud's
   * "Send feedback" as a speech bubble. Needs an `icon`; without one the
   * label is drawn. Folded into the list on a narrow bar, the label is said
   * beside the mark.
   */
  readonly iconOnly?: boolean;
  readonly onSelect: () => void;
}

/**
 * ONE OF A HOST'S ROWS IN THE APP MENU (Roadmap f-app-bar-calm): Graview
 * Cloud's "App settings", "Connections". A link (`href`, and `target` if it
 * opens elsewhere) or a press (`onSelect`), with a mark beside its words
 * where the host gives one — an emoji, a glyph or an inline `<svg>`.
 */
export interface AppMenuRow {
  readonly label: string;
  readonly icon?: string;
  readonly href?: string;
  readonly target?: string;
  readonly onSelect?: () => void;
}

/** One of the schemes a person may choose: the system's, or light or dark whatever it says. */
export type SchemeChoice = "system" | "light" | "dark";

/**
 * THE SCHEME, CHOSEN IN THE APP MENU (Roadmap f-scheme-choice-mount): the
 * one chosen and the way to choose another. `offers` narrows the choices —
 * the Shell, which owns no system setting of its own, offers light and
 * dark. The host keeps the choice and applies it; the menu only asks.
 */
export interface BarScheme {
  readonly value: SchemeChoice;
  readonly onChoose: (value: SchemeChoice) => void;
  readonly offers?: readonly SchemeChoice[];
}

/**
 * A HOST'S SHARE, BESIDE THE PEOPLE (Roadmap f-app-bar-calm, which takes in
 * f-bar-status-item): a button with a small mark and a word — "Share" unless
 * the host says other — whose popover says in a sentence who can open the
 * app, with a link to where that changes. The sentence is the button's
 * description too: said on hover and to a screen reader.
 */
export interface BarShare {
  /** The button's word: "Share" when unsaid. */
  readonly label?: string;
  /** The mark: `"lock"` (only some people), `"globe"` (anyone), `"people"`, or the host's own glyph or inline `<svg>`. A lock when unsaid. */
  readonly mark?: "lock" | "globe" | "people" | (string & {});
  /** Who can open the app, in a sentence. */
  readonly description: string;
  /** Where that changes: a link (`href`, `target`) or a press (`onSelect`). */
  readonly link?: { readonly label: string; readonly href?: string; readonly target?: string; readonly onSelect?: () => void };
}

/** One size for every tool on the bar (FR-131). */
export const TOOL = 30;
/** The bar's one row, its rule under it included, on a desk and a phone alike (FR-138). */
export const BAR_HEIGHT = 48;

/** Below this width of its own the bar is a phone's: the place is the page's first line. */
export const BAR_PHONE = 640;
/** Below this width of its own Find is the magnifier, which opens the box over the row (Roadmap f-app-bar-calm): sooner than a phone's. */
export const BAR_FIND_FOLDS = 900;

/** The room between two places standing on the row (FR-145). */
export const PLACE_GAP = 4;
/** The fewest places that stand on the row: fewer, and the one control says the same in less room. */
export const FEWEST_STANDING = 2;

/**
 * WHICH PLACES STAND ON THE ROW (FR-145), from their widths and the room —
 * RANKED: only the primary places stand (`primary`, every one when unsaid),
 * and never more than `most` (`MOST_STANDING`) however wide the row; the
 * place the reader is on stands too, in its own place in the order. Every
 * one of those when they fit, with "More" after them when anything folds;
 * else the first ones, the current one always among them (the last of the
 * first ones giving way to it); else none — null, the one control. Fewer
 * than `FEWEST_STANDING` is none. A width that is not measured (nothing
 * laid out) is none too.
 *
 * Ten words of equal weight on a bar — Home, Lists, Tasks, Rules, Reasons,
 * People, Invitations and three pictures — said nothing about which of
 * them the app is about; the bar says it now, and the rest are one press
 * further, in "More".
 */
export function placesThatStand(input: {
  /** Each place's width as it would stand, in the order of the list. */
  readonly widths: readonly number[];
  /** Where the current place is in the list; -1 for none. */
  readonly current: number;
  /** The room the row has for them. */
  readonly room: number;
  /** "More"'s width. */
  readonly more: number;
  readonly gap?: number;
  /** Which places may stand, by their place in the list; every one when unsaid. */
  readonly primary?: readonly boolean[];
  /** The most that stand. */
  readonly most?: number;
}): readonly number[] | null {
  const { widths, current, room, more, gap = PLACE_GAP, primary, most = MOST_STANDING } = input;
  if (widths.length === 0 || !(room > 0) || !(more > 0) || widths.some((width) => !(width > 0))) return null;
  const span = (set: readonly number[], folded: boolean) => set.reduce((sum, at) => sum + widths[at]!, 0) + gap * Math.max(0, set.length - 1) + (folded ? gap + more : 0);
  // The first `count` of a list, the current place kept among them in its own place in the order.
  const first = (list: readonly number[], count: number): readonly number[] =>
    current < 0 || !list.includes(current) || list.slice(0, count).includes(current) ? list.slice(0, count) : [...list.filter((at) => at !== current).slice(0, count - 1), current].sort((a, b) => a - b);
  const ranked = first(widths.map((_, at) => at).filter((at) => primary?.[at] !== false || at === current), most);
  if (span(ranked, ranked.length < widths.length) <= room) return ranked.length >= FEWEST_STANDING ? ranked : null;
  for (let count = ranked.length - 1; count >= FEWEST_STANDING; count--) {
    const set = first(ranked, count);
    if (span(set, true) <= room) return set;
  }
  return null;
}

/*
 * THE BAR FITS ITS BOX. Every rule here reads the bar's own width (it is
 * its own container), never the screen's: an embed in a 650 px box on a
 * 1440 desk is a narrow bar, not a desk's bar squeezed. When the row is
 * short, Find gives first (a small box that says its shortcut, drawn wide
 * while it is used), then the place down to 9em of its name (whole in its
 * title), then the app's name, which wraps between its words onto a second
 * line and never inside one; the app menu's chevron keeps its size. Whether
 * the places stand is weighed with the name as it would stand on one line
 * (`nameGiven`), never as it is drawn now: the name drawn on two lines because
 * the places stood would fold them, and the name back on one would stand
 * them again, frame after frame.
 *
 * Where the places stand on the row (FR-145), Find gives first — down to
 * its least — then the places fold into "More", then into the one control,
 * which gives as above.
 *
 * The order is the shrink factors: Find 600, the place 100, the app 1. A
 * factor under 1 would not do — the free space is scaled by the factors
 * left when the others have reached their least, so an app at 0.001 would
 * give 0.1% of what is still needed and the row would run out of its box.
 * At 1 the app gives a fraction of a pixel while the others still can,
 * which would wrap its last word; its 2 px spacer (`::after`) takes that.
 * The tools (`display:contents`) stand on the row themselves, so Find's
 * box is what gives, not a column around it.
 */
const BAR_CSS = `
.graview-bar{display:block;margin:0;padding:0;container:graview-bar/inline-size;flex:0 0 auto;position:relative;background:var(--graview-bar);border-bottom:1px solid var(--graview-edge);color:var(--graview-ink);font-family:var(--graview-font-body,system-ui)}
.graview-bar-row{display:flex;flex-wrap:nowrap;align-items:center;gap:16px;height:${BAR_HEIGHT - 1}px;margin:0;padding:0 16px}
.graview-bar-home,.graview-bar-place,.graview-bar-item,.graview-bar-at{display:inline-flex;align-items:center;box-sizing:border-box;min-width:0;margin:0;border:0;background:none;box-shadow:none;font:inherit;letter-spacing:normal;text-transform:none;text-decoration:none;color:var(--graview-ink);cursor:pointer;text-align:left}
.graview-bar-app{display:flex;align-items:center;gap:2px;flex:0 1 auto;max-width:50%}
.graview-bar-app::after{content:"";flex:0 100000 auto;width:2px;min-width:0}
.graview-bar-name{margin:0;display:flex;font-family:var(--graview-font-display,var(--graview-font-body,system-ui));font-size:.9375rem;font-weight:600;line-height:1.25}
.graview-bar-home{gap:8px;min-width:auto;min-height:30px;padding:0;letter-spacing:-.005em}
.graview-bar-app-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-break:normal}
.graview-bar-said{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.graview-bar-menu-open{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;box-sizing:border-box;width:24px;height:30px;margin:0;padding:0;border:1px solid transparent;border-radius:6px;background:none;box-shadow:none;color:var(--graview-ink-muted);cursor:pointer}
.graview-bar-menu-open:is(:hover,[aria-expanded=true]){border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-tool{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;box-sizing:border-box;min-width:${TOOL}px;height:${TOOL}px;margin:0;padding:0;border-radius:8px;border:1px solid transparent;background:none;box-shadow:none;font:inherit;font-size:.875rem;font-weight:500;letter-spacing:normal;text-transform:none;white-space:nowrap;color:var(--graview-ink-muted);cursor:pointer;text-decoration:none}
.graview-bar-tool:is(:hover,[aria-expanded=true]){border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-tool[data-running]{color:var(--graview-accent)}
.graview-bar-badge{position:absolute;top:-3px;right:-5px;box-sizing:border-box;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--graview-accent);color:var(--graview-accent-ink);font-size:.625rem;font-weight:700;line-height:16px;text-align:center;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px var(--graview-bar);pointer-events:none}
.graview-bar-badge[data-dot]{min-width:8px;width:8px;height:8px;padding:0;top:2px;right:2px}
.graview-bar-badge[data-tone=warn]{background:var(--graview-warn)}
.graview-bar-share{gap:6px;padding:0 10px}
.graview-bar-share-pane{display:grid;gap:10px;width:min(300px,calc(100vw - 24px));padding:14px;border-radius:10px;border:1px solid var(--graview-edge);background:var(--graview-float);box-shadow:var(--graview-lift-high);color:var(--graview-ink);font-size:.875rem;line-height:1.45}
.graview-bar-share-pane[hidden]{display:none}
.graview-bar-share-pane p{margin:0}
.graview-bar-share-pane a,.graview-bar-share-pane button{justify-self:start;display:inline-flex;align-items:center;min-height:28px;padding:0;border:0;background:none;box-shadow:none;font:inherit;font-weight:600;color:var(--graview-accent);text-decoration:none;cursor:pointer}
.graview-bar-mid{display:flex;flex:1 100 0;min-width:0}
.graview-bar-mid[data-place]{min-width:9em;flex-basis:auto}
.graview-bar-place-at{position:relative;display:inline-flex;min-width:0;max-width:100%}
.graview-bar-place{gap:6px;height:30px;max-width:100%;padding:0 8px;border:1px solid transparent;border-radius:8px;font-size:.875rem;font-weight:600}
.graview-bar-place:hover{border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-place-words{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.graview-bar-mid[data-places=standing]{flex:0 0 auto}
.graview-bar-places{display:flex;align-items:center;gap:${PLACE_GAP}px;min-width:0;margin:0;padding:0}
.graview-bar-at{gap:6px;flex:0 0 auto;height:30px;padding:0 8px;border-block:2px solid transparent;border-radius:0;font-size:.875rem;font-weight:500;white-space:nowrap;color:var(--graview-ink-muted)}
.graview-bar-at:is(:hover,[aria-current],[aria-expanded=true]){color:var(--graview-ink)}
.graview-bar-at[aria-current]{font-weight:600;border-bottom-color:var(--graview-accent)}
.graview-bar-ruler{position:absolute;left:0;top:0;display:flex;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none}
.graview-bar-ruler .graview-bar-at{font-weight:600}
.graview-bar-ruler>.graview-bar-name{flex:none;white-space:nowrap;letter-spacing:-.005em}
.graview-bar-list{display:grid;align-content:start;width:min(320px,calc(100vw - 24px));height:auto;max-height:min(70vh,560px);overflow:auto;margin:0;padding:6px;border-radius:10px;border:1px solid var(--graview-edge);background:var(--graview-float);box-shadow:var(--graview-lift-high);color:var(--graview-ink)}
.graview-bar-list[hidden]{display:none}
.graview-bar-list p{margin:8px 8px 2px;font-size:.6875rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--graview-ink-muted)}
.graview-bar-list ul,.graview-bar-list li{display:grid;margin:0;padding:0;list-style:none}
.graview-bar-item{align-items:flex-start;gap:10px;width:100%;padding:7px 8px;border-radius:7px;font-size:.875rem;line-height:1.3;overflow-wrap:anywhere}
.graview-bar-item:hover{background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-bar-item[aria-current]{font-weight:600;background:color-mix(in srgb,var(--graview-accent) 14%,transparent)}
.graview-bar-mark{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:14px;height:1.3em;color:var(--graview-ink-muted)}
.graview-bar :focus-visible{outline:2px solid var(--graview-accent);outline-offset:1px}
.graview-bar-tools{display:contents}
.graview-bar-tools>*{margin-left:-8px}
.graview-bar-tools>:is(.graview-bar-find,.graview-bar-find-open){margin-left:auto}
.graview-bar-own{display:flex;align-items:center;flex:0 0 auto}
.graview-bar-own:empty{display:none}
.graview-bar-host{display:flex;align-items:center;gap:2px;flex:0 0 auto}
.graview-bar-host-action{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;min-width:${TOOL}px;height:${TOOL}px;margin:0;padding:0 10px;border-radius:8px;border:1px solid transparent;background:none;box-shadow:none;font:inherit;font-size:.875rem;font-weight:500;letter-spacing:normal;text-transform:none;white-space:nowrap;color:var(--graview-ink-muted);cursor:pointer}
.graview-bar-host-action:is(:hover,[aria-expanded=true]){border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-host-action:is([data-folded],[data-icon-only]){padding:0;justify-content:center}
.graview-bar-host-mark{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:16px;height:16px;font-size:.9375rem;line-height:1}
.graview-bar-host-mark svg{width:16px;height:16px}
.graview-bar-list .graview-bar-host-action{width:100%;justify-content:flex-start;white-space:normal;overflow-wrap:anywhere}
.graview-bar-host-action[data-icon-only]>.graview-bar-host-words{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.graview-bar-find{position:relative;display:flex;min-width:7.5rem;flex:0 600 9rem;--graview-bar-find-end:3.25em}
.graview-bar-find-slot{display:flex;flex:1;min-width:0}
.graview-bar-find-keys{position:absolute;right:10px;line-height:30px;pointer-events:none;font-size:.75rem;color:var(--graview-ink-faint)}
.graview-bar-find:is(:focus-within,:has(input:not(:placeholder-shown))){flex-basis:16rem;--graview-bar-find-end:10px}
:is(:focus-within,:has(input:not(:placeholder-shown)))>.graview-bar-find-keys,.graview-bar-find-open{display:none}
.graview-bar-line{display:flex;flex:0 0 auto;padding:6px 8px;background:var(--graview-ground);border-bottom:1px solid var(--graview-edge);font-family:var(--graview-font-body,system-ui)}
.graview-bar-line .graview-bar-place{height:auto;min-height:32px}
.graview-bar-line .graview-bar-place-words{white-space:normal}
@media (pointer:coarse){.graview-bar-find-keys{display:none}}
@container graview-bar (max-width: ${BAR_FIND_FOLDS - 1}px){
.graview-bar-find{display:none}
.graview-bar-find-open{display:inline-flex}
.graview-bar-tools>.graview-bar-find-open{margin-left:auto}
.graview-bar[data-finding] :is(.graview-bar-app,.graview-bar-mid,.graview-bar-find-open){display:none}
.graview-bar[data-finding] .graview-bar-find{display:flex;flex:1 1 auto;min-width:0;margin-left:0}
}
@container graview-bar (max-width: ${BAR_PHONE - 1}px){
.graview-bar-row{gap:10px;padding:0 12px}
.graview-bar-app{max-width:none;flex:1 1 auto;min-width:28px}
.graview-bar-home{min-width:28px}
.graview-bar-name,.graview-bar-app-name{min-width:0}
.graview-bar-mid{display:none}
.graview-bar-share{padding:0}
.graview-bar-share>.graview-bar-share-words{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
}
@container graview-bar (max-width: 300px){
.graview-bar-row{gap:4px;padding:0 10px}
}`;

/** A tool's own box: one size, square, its name in words for whoever cannot see the mark. */
export const toolStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minWidth: TOOL,
  height: TOOL,
  padding: 0,
  borderRadius: 8,
  border: "1px solid transparent",
  background: "none",
  boxShadow: "none",
  color: "var(--graview-ink-muted)",
  font: "inherit",
  fontSize: "0.875rem",
  cursor: "pointer",
  flex: "0 0 auto",
};

/**
 * THE BAR. The app at the left — its mark, its name as the page's heading,
 * the way home — and the app menu beside it, which holds the scene and the
 * pages (FR-137, Roadmap f-app-bar-calm), then, on Pages, the place you are
 * on (FR-138), and the tools at the right: the Find a face puts in it, the
 * inbox, a host's buttons, the people and a host's Share, then `tools` (the
 * standing and the person). One row of one height on a desk and a phone; on a phone the
 * place is the page's first line, under the bar.
 */
export function AppBar({
  brand,
  name,
  heading = 1,
  home,
  faces,
  places,
  current,
  reach,
  tools,
  find = true,
  description,
  findBox,
  onFind,
  scenePlaces,
  skips,
  named = true,
  actions,
  appMenu = NO_ROWS,
  scheme,
  share,
}: {
  readonly brand: Brand | undefined;
  readonly name: string;
  /** Whether the app's mark and name are drawn, the way home: not under a host's own bar that says them. */
  readonly named?: boolean;
  /** The level the app's name is said at: 1 when the page is the app's, `false` when the host's own heading already says it. */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /** The way home, and whether the reader is there. */
  readonly home: { readonly href?: string | undefined; readonly go?: (() => void) | undefined; readonly current: boolean };
  /** The switch between the scene and the pages; none where the face cannot draw the scene. */
  readonly faces?: BarFaces | undefined;
  readonly places: readonly BarPlace[];
  /** The key of the place the reader is on; null at Find, at the problems. */
  readonly current: string | null;
  readonly reach: BarGo;
  /** The standing and the person, after Find. */
  readonly tools: ReactNode;
  /** Whether a face puts a Find box in the bar. */
  readonly find?: boolean;
  /** The line under the app's name (the brand's `subtitle`): said on the home, and as the name's hover here. */
  readonly description?: string | undefined;
  /** A Find box the bar is handed to draw in its place, for a face drawn inside the bar's own tree; otherwise the face puts its own there. */
  readonly findBox?: ReactNode;
  /** Told where the bar keeps the Find box, for the face under it (`BarFindContext`). */
  readonly onFind?: (find: BarFind | null) => void;
  /**
   * On the scene, what it can show (FR-144): the whole thing and each
   * picture, the one in view, and the way to each (`useScenePlaces`). None,
   * and the scene's bar names no place.
   */
  readonly scenePlaces?: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo } | undefined;
  /** The ways past the bar (`SkipLinks`), the first stops Tab reaches: the face says where they go. */
  readonly skips?: ReactNode;
  /**
   * THE HOST'S BUTTONS (FR-227): presses drawn on the row before the tools,
   * where the bar has their width over a phone's, and folded into one
   * control that lists them where it does not. None, and nothing is drawn.
   */
  readonly actions?: readonly BarAction[] | undefined;
  /** THE HOST'S ROWS IN THE APP MENU (Roadmap f-app-bar-calm), after the scene and the pages. */
  readonly appMenu?: readonly AppMenuRow[] | undefined;
  /** THE SCHEME, CHOSEN IN THE APP MENU (Roadmap f-scheme-choice-mount); none, and the menu offers none. */
  readonly scheme?: BarScheme | undefined;
  /** A HOST'S SHARE, after the people (Roadmap f-app-bar-calm); none, and nothing is drawn. */
  readonly share?: BarShare | undefined;
}) {
  const bar = useRef<HTMLElement>(null);
  // Anybody else here, by the provider's presence (FR-155); none where no provider is.
  const company = useGraviewIfAny()?.who.size;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [own, setOwn] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  // Whether Find is the magnifier (below `BAR_FIND_FOLDS`), which opens the box over the row.
  const [folded, setFolded] = useState(false);
  const [finding, setFinding] = useState(false);
  // Which places stand on the row, by their place in the list ("0,1,2"); null, the one control (FR-145).
  const [standing, setStanding] = useState<string | null>(null);
  // Whether the host's buttons stand on the row (FR-227): where the bar has their width over a phone's; folded where it does not.
  const [hostStands, setHostStands] = useState(true);
  // The places on the face drawn: the routed face's, or the scene's (FR-144) — a scene with no pages to switch to has its places too.
  const onPages = faces ? faces.pages.current : !scenePlaces;
  /*
   * A PLACE KEPT OFF THE LISTS (`hidden`) IS OFFERED NOWHERE (Roadmap
   * f-hidden-view-leaves-the-bar): hidden from the place menu while it is
   * the one open, it leaves the row and the drop-down at once, and the one
   * control names it only as where you are.
   */
  const from = onPages ? { places, current, reach } : scenePlaces;
  const shown = from && { ...from, places: offeredPlaces(from.places), here: from.places.find((place) => place.key === from.current)?.label };
  const list = shown && shown.places.length > 0 ? shown : null;
  const currentAt = list ? list.places.findIndex((place) => place.key === list.current) : -1;
  // Which places may stand, as one word for the weighing to depend on ("110010…").
  const ranks = list ? list.places.map((place) => (place.primary === false ? "0" : "1")).join("") : "";
  const weigh = useCallback(() => {
    const element = bar.current;
    if (!element) return;
    const stand = standsIn(element, currentAt, ranks);
    if (stand !== undefined) setStanding(stand);
  }, [currentAt, ranks]);
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const read = () => {
      const width = element.getBoundingClientRect().width;
      setCompact(width < BAR_PHONE);
      setFolded(width < BAR_FIND_FOLDS);
      // The host's buttons as they would stand, off their ruler: they stand where the bar has their width over a phone's.
      const host = element.querySelector<HTMLElement>("[data-graview-bar-host-ruler]");
      // Two of the bar's tools drawn as marks alone stand at every width, as the bar's own do.
      setHostStands(width >= BAR_PHONE + (host?.getBoundingClientRect().width ?? 0));
      // What hangs from the bar as wide as it (a phone's Find sheet) is told the bar's width, not the screen's.
      element.style.setProperty("--graview-bar-width", `${Math.round(width)}px`);
      weigh();
    };
    read();
    // The brand's face, once it has come, is wider or narrower than the one the row was first weighed in.
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    void fonts?.ready.then(weigh);
    fonts?.addEventListener?.("loadingdone", weigh);
    if (typeof ResizeObserver === "undefined") return () => fonts?.removeEventListener?.("loadingdone", weigh);
    const watch = new ResizeObserver(read);
    watch.observe(element);
    // What stands beside the places — the tools, a count on the standing — changes their room without changing the bar's width.
    for (const tool of element.querySelectorAll(".graview-bar-tools > *")) watch.observe(tool);
    // And a tool that comes later — who else is here, a host's buttons — is watched from when it does.
    const tools = element.querySelector(".graview-bar-tools");
    const arrivals = typeof MutationObserver === "undefined" || !tools ? null : new MutationObserver(() => {
      for (const tool of tools.children) watch.observe(tool);
    });
    arrivals?.observe(tools!, { childList: true });
    return () => {
      arrivals?.disconnect();
      watch.disconnect();
      fonts?.removeEventListener?.("loadingdone", weigh);
    };
  }, [weigh]);
  const told = useRef(onFind);
  told.current = onFind;
  useLayoutEffect(() => {
    told.current?.(find && slot ? { slot, compact: folded, own } : null);
  }, [find, slot, folded, own]);
  useLayoutEffect(() => () => told.current?.(null), []);
  const openFind = useCallback(() => {
    setFinding(true);
    requestAnimationFrame(() => slot?.querySelector<HTMLInputElement>("input")?.focus());
  }, [slot]);
  /*
   * Put away on a phone by Escape, the box gives the keyboard back to the
   * magnifier that opened it — never to the page's body.
   */
  const opener = useRef<HTMLButtonElement>(null);
  const escaping = useRef(false);
  const putAway = useCallback(() => {
    setFinding(false);
    if (!escaping.current) return;
    escaping.current = false;
    requestAnimationFrame(() => opener.current?.focus());
  }, []);
  /*
   * HEARD ON THE ELEMENT ITSELF, not through React: the face's box is a
   * portal from the face drawn under the bar, so its keys and its blur
   * bubble through the face's tree and never reach a handler written here.
   * Put away when folded (`BAR_FIND_FOLDS`) as the keyboard leaves it with
   * nothing typed, or by Escape once its words are gone.
   */
  const findAt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = findAt.current;
    if (!at || !folded) return;
    const typed = () => Boolean(at.querySelector<HTMLInputElement>("input")?.value);
    const left = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && at.contains(next)) return;
      if (!typed()) putAway();
    };
    const marked = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") escaping.current = true;
    };
    const escaped = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The scene's Find takes Escape for its words first; an empty box is put away. Weighed once the face's own handler (React's, at its root, after this one) has had the key.
      queueMicrotask(() => {
        if (!event.defaultPrevented || !typed()) putAway();
        else escaping.current = false;
      });
    };
    at.addEventListener("focusout", left);
    at.addEventListener("keydown", marked, true);
    at.addEventListener("keydown", escaped);
    return () => {
      at.removeEventListener("focusout", left);
      at.removeEventListener("keydown", marked, true);
      at.removeEventListener("keydown", escaped);
    };
  }, [folded, putAway]);
  const Heading = heading === false ? "span" : (`h${heading}` as const);
  const Home = (home.href !== undefined ? "a" : "button") as "a";
  const press = (go: (() => void) | undefined) => (event: MouseEvent) => {
    if (!go || !plain(event)) return;
    event.preventDefault();
    go();
  };
  // The place control: in the bar on a desk, as the page's first line on a phone; the places themselves on the row when they fit (FR-145).
  const scene = !onPages;
  /*
   * ON A PLACE KEPT OFF THE LISTS, THE ONE CONTROL, at every width: it says
   * where you are ("People"), and the row of places it is not among would
   * say nowhere. Saying where you are is not offering it.
   */
  const stands = list && !compact && standing !== null && !(currentAt < 0 && list.here) ? standing.split(",").map(Number).filter((at) => at < list.places.length) : null;
  const placeControl = list ? <Places places={list.places} current={list.current} here={list.here} reach={list.reach} scene={scene} stands={stands} /> : null;
  const said = list ? list.places.map((place) => place.label).join("\n") : "";
  // What the row holds changed — the name, the places, the face, the brand — so the places and the words may fit now, or no longer.
  useLayoutEffect(weigh, [weigh, name, brand, said, list?.current, onPages, compact, folded, find]);
  // The app menu: the scene and the pages, the host's rows, the scheme — drawn where it holds anything.
  const menuHolds = Boolean(faces) || appMenu.length > 0 || Boolean(scheme);
  return (
    <>
      <header
        ref={bar}
        className="graview-bar"
        data-testid="app-bar"
        data-graview-app-bar=""
        {...(finding && folded ? { "data-finding": "" } : {})}
      >
        <style>{BAR_CSS}</style>
        {skips}
        <div className="graview-bar-row">
          {named ? <div className="graview-bar-app">
            <Heading className="graview-bar-name">
              {/* A link where home has an address; a press where the embed keeps its places in memory. */}
              <Home
                {...(home.href !== undefined ? { href: home.href, onClick: press(home.go) } : { type: "button" as const, onClick: home.go })}
                data-testid="app-home"
                {...(home.current ? { "aria-current": "page" as const } : {})}
                title={description ? `${name} — ${description}` : `${name} — home`}
                className="graview-bar-home"
              >
                <AppMark brand={brand} size={20} />
                <span className="graview-bar-app-name" data-testid="app-name">
                  {name}
                </span>
              </Home>
            </Heading>
            {menuHolds ? <AppMenu name={name} faces={faces} rows={appMenu} scheme={scheme} /> : null}
          </div> : menuHolds ? <AppMenu name={name} faces={faces} rows={appMenu} scheme={scheme} /> : null}
          <div className="graview-bar-mid" {...(stands ? { "data-places": "standing" } : !compact && placeControl ? { "data-place": "" } : {})}>
            {compact ? null : placeControl}
          </div>
          {/* The places as they would stand, unseen, for the row to be weighed by (FR-145). */}
          {!compact && list && list.places.length > 1 ? (
            <span className="graview-bar-ruler" aria-hidden="true" data-graview-bar-ruler="">
              {list.places.map((place) => (
                <span key={place.key} className="graview-bar-at">
                  {place.label}
                </span>
              ))}
              <span className="graview-bar-at">
                {MORE}
                <Chevron />
              </span>
            </span>
          ) : null}
          {/* The host's buttons as they would stand, unseen, for the row to be weighed by (FR-227). */}
          {actions && actions.length > 0 ? (
            <span className="graview-bar-ruler" aria-hidden="true" data-graview-bar-host-ruler="">
              <span className="graview-bar-host">
                {actions.map((action) => (
                  <span key={action.label} className="graview-bar-host-action" {...(action.iconOnly && action.icon ? { "data-icon-only": "" } : {})}>
                    {action.icon ? <HostMark icon={action.icon} /> : null}
                    <span className="graview-bar-host-words">{action.label}</span>
                  </span>
                ))}
              </span>
            </span>
          ) : null}
          {/* The app's name on one line, unseen, for the row to be weighed by as if it stood so (`nameGiven`). */}
          {named ? (
            <span className="graview-bar-ruler" aria-hidden="true">
              <span className="graview-bar-name">{name}</span>
            </span>
          ) : null}
          <div className="graview-bar-tools">
            {find ? (
              <>
                <button
                  type="button"
                  className="graview-bar-find-open"
                  ref={opener}
                  data-testid="app-find-open"
                  aria-label="Find"
                  title="Find"
                  onClick={openFind}
                  style={{ ...toolStyle, display: undefined }}
                >
                  <FindMark />
                </button>
                <div ref={findAt} className="graview-bar-find" data-testid="app-find">
                  {/* The face's box goes here; the shortcut is said over its end until it is used. */}
                  <div ref={setSlot} className="graview-bar-find-slot">
                    {findBox}
                  </div>
                  <FindKeys />
                </div>
              </>
            ) : null}
            {/* The face's own tool (`BarFind.own`): the one inbox, when it holds anything (Roadmap f-app-bar-calm). */}
            <div ref={setOwn} className="graview-bar-own" data-graview-bar-own="" />
            {/* The host's own buttons (FR-227), before the people: standing, or behind one control on a narrow bar. */}
            {actions && actions.length > 0 ? <HostButtons actions={actions} folded={!(actions.length <= 2 && actions.every((action) => action.iconOnly && action.icon)) && (compact || !hostStands)} /> : null}
            {company ? (
              <Suspense fallback={null}>
                <Here scene={!onPages} compact={compact} />
              </Suspense>
            ) : null}
            {/* A host's Share, beside the people: who can open the app, in a sentence (Roadmap f-app-bar-calm). */}
            {share ? <ShareSlot share={share} /> : null}
            <TheirChanges />
            {tools}
          </div>
        </div>
      </header>
      {/* On a phone the place is the page's first line, under the bar's one row (FR-138). */}
      {compact && placeControl ? (
        <div className="graview-bar-line" data-graview-place-line="" data-testid="app-place-line">
          {placeControl}
        </div>
      ) : null}
    </>
  );
}

const NO_ROWS: readonly AppMenuRow[] = [];

/**
 * THE APP MENU'S CONTROL (Roadmap f-app-bar-calm): a chevron beside the
 * app's name — the name stays the way home, the page's heading — that opens
 * the menu: the scene and the pages, a host's rows, the scheme. Its rows
 * are fetched with the bar's panes when a hand first reaches for it.
 */
/**
 * GOING TO THE OTHER FACE WITHOUT A BUTTON ON THE ROW (Roadmap
 * f-app-bar-calm, f-make-any-page-better). The scene and the pages are rows
 * of the app menu, drawn only while it is open, so a part that must switch
 * faces — Better UI asked in the scene, opened on its page — cannot press
 * them. It dispatches this on the app menu's control
 * (`[data-testid="app-menu-open"]`, which says `data-pages` where the bar
 * holds both faces), with the face as its detail, and the bar goes there as
 * the menu's row would.
 */
export const FACE_EVENT = "graview:go-to-face";

function AppMenu({ name, faces, rows, scheme }: { readonly name: string; readonly faces?: BarFaces | undefined; readonly rows: readonly AppMenuRow[]; readonly scheme?: BarScheme | undefined }) {
  const popover = usePopover("app-menu", { align: "start" });
  const reach = () => barPanes.prefetch();
  /* A part asked to go to the other face (`FACE_EVENT`): gone to as the menu's row would, without opening the menu. */
  const opener = useRef<HTMLElement | null>(null);
  const held = useRef(faces);
  held.current = faces;
  useEffect(() => {
    const element = opener.current;
    if (!element) return;
    const go = (event: Event) => {
      const one = held.current?.[(event as CustomEvent<"scene" | "pages">).detail];
      if (!one || one.current) return;
      one.reach?.();
      one.go();
    };
    element.addEventListener(FACE_EVENT, go);
    return () => element.removeEventListener(FACE_EVENT, go);
  }, []);
  return (
    <>
      <button
        type="button"
        className="graview-bar-menu-open"
        data-testid="app-menu-open"
        {...popover.trigger}
        ref={(element: HTMLElement | null) => {
          popover.trigger.ref(element);
          opener.current = element;
        }}
        onClick={popover.toggle}
        onPointerEnter={reach}
        onFocus={reach}
        aria-label={`${name} — app menu`}
        title="App menu"
        // What the scene and the pages are called here, for a first look's hint before the menu has been opened.
        {...(faces ? { "data-scene": faces.scene.label, "data-pages": faces.pages.label } : {})}
      >
        <Chevron />
      </button>
      <div {...popover.pane} data-testid="app-menu" hidden={!popover.open} className="graview-bar-list graview-app-menu" style={POPOVER_STYLE} aria-label={`${name} — app menu`} role="group">
        {popover.open ? (
          <Suspense fallback={null}>
            <AppMenuRows faces={faces} rows={rows} scheme={scheme} close={() => popover.setOpen(false)} />
          </Suspense>
        ) : null}
      </div>
    </>
  );
}

/** Share's marks: a lock, a globe, two people. */
function ShareMark({ mark = "lock" }: { readonly mark?: BarShare["mark"] }) {
  if (mark === "lock")
    return (
      <Mark size={14}>
        <rect x="2.75" y="6.25" width="8.5" height="6" rx="1.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4.75 6.25 V4.5 a2.25 2.25 0 0 1 4.5 0 V6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </Mark>
    );
  if (mark === "globe")
    return (
      <Mark size={14}>
        <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.75 7 H12.25 M7 1.75 C4.75 4.5 4.75 9.5 7 12.25 M7 1.75 C9.25 4.5 9.25 9.5 7 12.25" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </Mark>
    );
  if (mark === "people")
    return (
      <Mark size={14}>
        <circle cx="5" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 12 a3.5 3.5 0 0 1 7 0" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10" cy="5.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9.5 9 a3 3 0 0 1 3.5 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Mark>
    );
  return <HostMark icon={mark} />;
}

/**
 * A HOST'S SHARE (Roadmap f-app-bar-calm, f-bar-status-item): its mark and
 * its word, the sentence its description — on hover and to a screen reader —
 * and, pressed, the sentence again with the link to where it changes. One
 * of the bar's family of popovers.
 */
function ShareSlot({ share }: { readonly share: BarShare }) {
  const popover = usePopover("share");
  const said = `graview-share-said-${useId().replace(/:/g, "")}`;
  const label = share.label ?? "Share";
  const link = share.link;
  return (
    <div className="graview-bar-share-at">
      <button type="button" className="graview-bar-tool graview-bar-share" data-testid="app-share-open" {...popover.trigger} onClick={popover.toggle} aria-describedby={said} title={share.description}>
        <ShareMark mark={share.mark} />
        <span className="graview-bar-share-words">{label}</span>
      </button>
      <span id={said} className="graview-bar-said">
        {share.description}
      </span>
      <div {...popover.pane} data-testid="app-share" hidden={!popover.open} className="graview-bar-share-pane" style={POPOVER_STYLE} role="group" aria-label={label}>
        <p data-testid="app-share-said">{share.description}</p>
        {link ? (
          link.href !== undefined ? (
            <a
              href={link.href}
              data-testid="app-share-link"
              {...(link.target ? { target: link.target, rel: "noopener" } : {})}
              onClick={() => {
                link.onSelect?.();
                popover.setOpen(false);
              }}
            >
              {link.label}
            </a>
          ) : (
            <button
              type="button"
              data-testid="app-share-link"
              onClick={() => {
                popover.setOpen(false);
                link.onSelect?.();
              }}
            >
              {link.label}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

/**
 * HOW FAR THE ROW RUNS PAST ITS END, in pixels: what stands last on it — a
 * tool, the person — measured against the row's own end inside its padding.
 * Find's end was the measure of the room, and Find stops giving at its
 * least: once the tools after it had more than the row left (the scene's
 * Activity arriving after the places were weighed, an iPad's 1024 px with
 * five places standing), Find's end went past the row with them, the room
 * read as enough, and the person stood off the screen. What runs over is
 * room the places do not have.
 */
function overrun(header: HTMLElement): number {
  const row = header.querySelector<HTMLElement>(".graview-bar-row");
  const box = header.getBoundingClientRect();
  if (!row || !(box.width > 0)) return 0;
  const end = box.right - (parseFloat(getComputedStyle(row).paddingRight) || 0);
  let last = end;
  for (const one of row.querySelectorAll<HTMLElement>(":scope > *, .graview-bar-tools > *")) {
    if (one.classList.contains("graview-bar-tools") || one.classList.contains("graview-bar-ruler") || one.classList.contains("graview-bar-said")) continue;
    const rect = one.getBoundingClientRect();
    if (rect.width > 0) last = Math.max(last, rect.right);
  }
  return Math.max(0, last - end);
}

/**
 * THE ROOM THE APP'S NAME HAS GIVEN, weighed by the name as it would stand
 * on one line: how much narrower the app is drawn now than it would stand
 * so (its mark, its gap, its words unwrapped off the ruler and the 2 px
 * spacer beside them) — the room the name has given to what stands after
 * it. Null when the name is wider on one line than its room (the app's
 * `max-width`, half the row inside its padding), when it is on two lines
 * whatever stands beside it. Weighing by the name as it is drawn would
 * weigh the row by what the weighing did: places standing squeeze the name
 * onto two lines, a name on two lines folds the places, the name is back
 * on one, and the places stand again.
 */
function nameGiven(header: HTMLElement): number | null {
  const app = header.querySelector<HTMLElement>(".graview-bar-app");
  const probe = header.querySelector(".graview-bar-ruler>.graview-bar-name");
  if (!app || !probe) return 0;
  const width = (one: Element | null) => one?.getBoundingClientRect().width ?? 0;
  const one = width(app.firstElementChild) - width(header.querySelector(".graview-bar-app-name")) + width(probe) + 2;
  const room = (parseFloat(getComputedStyle(app).maxWidth) / 100) * (app.parentElement!.clientWidth - 2 * app.offsetLeft) || Infinity;
  return one > room + 0.5 ? null : Math.max(0, one - width(app));
}

/** A press a page should follow itself: the main button, no key held (a new tab, a new window, a download). */
const plain = (event: MouseEvent): boolean => event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/** Find's shortcut as the keyboard says it: ⌘K on a Mac (and an iPad's keyboard), Ctrl K elsewhere. */
function findKeys(): string {
  const platform = globalThis.navigator?.platform ?? "";
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "⌘K" : "Ctrl K";
}

/** Find's shortcut said over its box's end: `/` where the quick ask holds ⌘K (Roadmap f-quick-ask-framework), else ⌘K. */
function FindKeys() {
  const asks = useQuickAskDrawn(useGraviewIfAny()?.aiDesk);
  return (
    <span className="graview-bar-find-keys" data-testid="app-find-keys" aria-hidden="true">
      {asks ? "/" : findKeys()}
    </span>
  );
}

/** A mark of the bar's, drawn in the ink it stands in, hidden from whoever reads its words. */
function Mark({ size, box = size, children }: { readonly size: number; readonly box?: number; readonly children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      {children}
    </svg>
  );
}

/** The scene's mark: a plot of the city, seen from above at an angle. */
function SceneMark() {
  return (
    <Mark size={14}>
      <path d="M7 1.5 L12.5 4.5 L7 7.5 L1.5 4.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1.5 7.5 L7 10.5 L12.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </Mark>
  );
}

/** The way a menu opens: a chevron drawn, not a glyph a face may draw as a dot. */
function Chevron() {
  return (
    <Mark size={10}>
      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Mark>
  );
}

/** A magnifier: the mark for Find where there is no room for the box. */
function FindMark() {
  return (
    <Mark size={16}>
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Mark>
  );
}

/** A place's mark in the list: the home's house, a kind's plot in its own hue. */
function PlaceMark({ place }: { readonly place: BarPlace }) {
  // The scene's whole thing: the scene's own mark, as on the switch (FR-144).
  if (place.key === WHOLE_KEY) return <SceneMark />;
  if (place.group === "home") {
    return (
      <Mark size={13} box={14}>
        <path d="M2 6.5 L7 2 L12 6.5 V12 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </Mark>
    );
  }
  // A kind's plot, as the scene draws it from altitude (the mark FR-117 gave a kind with no drawing); a picture of it wears its outline; how the kinds connect, the ink's.
  const hue = place.kind ? `hsl(${Math.round(hueFor(place.kind))} 55% 52%` : "rgb(128 128 128";
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 12,
        height: 8,
        clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        background: place.group === "lists" ? `${hue})` : `linear-gradient(${hue}), ${hue})) center / 6px 4px no-repeat, ${hue} / 0.35)`,
      }}
    />
  );
}

const GROUPS: readonly { readonly group: BarPlaceGroup; readonly heading?: string }[] = [{ group: "home" }, { group: "lists", heading: "Lists" }, { group: "pictures", heading: "Pictures" }];

/** The word the places that do not stand on the row fold under (FR-145). */
const MORE = "More";

/**
 * THE HOST'S BUTTONS ON THE ROW (FR-227): each a button named by its label,
 * its mark hidden from the reader, in the order the host gave; folded, one
 * control named "More" and what it holds, whose list is the same buttons,
 * one of the bar's own family of popovers (closed by a press, Escape, or a
 * press away, the keyboard back on the control).
 */
function HostButtons({ actions, folded }: { readonly actions: readonly BarAction[]; readonly folded: boolean }) {
  const popover = usePopover("host-actions", { popover: folded });
  const names = actions.map((action) => action.label).join(", ");
  const buttons = (done: () => void) =>
    actions.map((action) => (
      <button
        key={action.label}
        type="button"
        className={folded ? "graview-bar-host-action graview-bar-item" : "graview-bar-host-action"}
        data-testid="host-bar-action"
        {...(!folded && action.iconOnly && action.icon ? { "data-icon-only": "", title: action.label } : {})}
        onClick={() => {
          done();
          action.onSelect();
        }}
      >
        {action.icon ? <HostMark icon={action.icon} /> : null}
        <span className="graview-bar-host-words">{action.label}</span>
      </button>
    ));
  if (!folded) {
    return (
      <div className="graview-bar-host" data-testid="host-bar-actions-standing" role="group" aria-label="From the host">
        {buttons(() => undefined)}
      </div>
    );
  }
  return (
    <div className="graview-bar-host">
      <button
        type="button"
        className="graview-bar-host-action"
        data-testid="host-bar-actions-open"
        data-folded=""
        {...popover.trigger}
        onClick={popover.toggle}
        aria-label={`${MORE} — ${names}`}
        title={names}
      >
        <Mark size={16}>
          <circle cx="3" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="13" cy="8" r="1.4" fill="currentColor" />
        </Mark>
      </button>
      <div {...popover.pane} data-testid="host-bar-actions" hidden={!popover.open} className="graview-bar-list" style={POPOVER_STYLE} aria-label="From the host">
        {buttons(() => popover.setOpen(false))}
      </div>
    </div>
  );
}

/** A host button's mark: an inline `<svg>` drawn as one, anything else as the glyph it is; hidden from a reader who cannot see it, the label says it. */
function HostMark({ icon }: { readonly icon: string }) {
  const markup = useMarkup(isInlineSvg(icon) ? icon : undefined);
  return markup ? <span className="graview-bar-host-mark" aria-hidden="true" dangerouslySetInnerHTML={markup} /> : <span className="graview-bar-host-mark" aria-hidden="true">{icon}</span>;
}

/**
 * ONE PLACE, AS THE BAR OFFERS IT — in the list, or standing on the row: a
 * link where it has an address, a press where the bar decides; marked
 * `aria-current` where the reader is. Whichever way it is drawn it is
 * `app-place-<key>` and says its path (`data-place-path`), once in the bar.
 */
function PlaceEntry({ place, current, reach, standing, done }: { readonly place: BarPlace; readonly current: string | null; readonly reach: BarGo; readonly standing: boolean; readonly done: () => void }) {
  const at = place.key === current;
  const href = reach.href?.(place.path);
  const Entry = (href !== undefined ? "a" : "button") as "a";
  return (
    <Entry
      className={standing ? "graview-bar-at" : "graview-bar-item"}
      data-testid={`app-place-${place.key}`}
      data-place-path={place.path}
      {...(at ? { "aria-current": "page" as const } : {})}
      {...(href !== undefined ? { href } : { type: "button" as const })}
      onClick={(event: MouseEvent) => {
        done();
        if (!reach.go) return;
        if (href !== undefined && !plain(event)) return;
        event.preventDefault();
        reach.go(place);
      }}
    >
      {standing ? null : (
        <span className="graview-bar-mark">
          <PlaceMark place={place} />
        </span>
      )}
      {/* Where the reader is, said where a harness and a reader find it whichever way the places are drawn. */}
      {standing && at ? <span data-testid="app-place-current">{place.label}</span> : <span>{place.label}</span>}
    </Entry>
  );
}

/** The places of a list, grouped — the home (or the whole thing), the Lists, the Pictures — each group with its heading. */
function PlaceGroups({ places, current, reach, id, done }: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo; readonly id: string; readonly done: () => void }) {
  return (
    <>
      {GROUPS.map(({ group, heading }) => {
        const listed = places.filter((place) => place.group === group);
        if (listed.length === 0) return null;
        const named = `${id}-${group}`;
        return (
          <div key={group} role="group" {...(heading ? { "aria-labelledby": named } : { "aria-label": listed[0]!.label })} data-place-group={group}>
            {heading ? <p id={named}>{heading}</p> : null}
            <ul>
              {listed.map((place) => (
                <li key={place.key}>
                  <PlaceEntry place={place} current={current} reach={reach} standing={false} done={done} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/**
 * THE PLACE YOU ARE ON, AND EVERY OTHER (FR-138): one control, the place's
 * name and a chevron, that opens the app's places — the home first, then
 * the Lists and the Pictures, each with its mark, a long name wrapped
 * rather than cut. Every place is two presses away, and the bar is one row
 * of one height however many there are. On the scene, what is in view and
 * every picture it can show (FR-144).
 *
 * WHERE THEY FIT, THE PLACES THEMSELVES (FR-145): the ones that stand, as
 * words in their order, the one you are on underlined; then "More", which
 * opens the rest, grouped as the one control's list is — no "More" when
 * every place stands. "More" is `app-places-open` and its list
 * `app-places`, as the one control and its list are, so a place that does
 * not stand is reached by the same two presses either way.
 */
function Places({ places, current, here: named, reach, scene, stands: weighed }: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly here?: string | undefined; readonly reach: BarGo; readonly scene: boolean; readonly stands: readonly number[] | null }) {
  const popover = usePopover("places");
  /*
   * THE LIST RENDERS ONCE AS IT OPENS (FR-158). The row is weighed again
   * whenever its room may have changed — a face arriving, a count on the
   * standing, someone else coming in; were that answer taken while the list
   * is open, entries would move between the row and the list under a press
   * already on its way, and the press land on an element no longer in the
   * document. While it is open the places stay as they stood when it opened.
   */
  const held = useRef(weighed);
  if (!popover.open) held.current = weighed;
  const stands = held.current;
  const here = places.find((place) => place.key === current);
  // Where you are, though a place kept off the lists is not among them.
  const said = here?.label ?? named ?? "Places";
  const rest = stands ? places.filter((_, at) => !stands.includes(at)) : places;
  // The place menu (Roadmap f-place-menu-views): each place's Open, and Hide and Delete where the viewer may tidy it.
  const gestures = usePlaceGestures(places, current, scene);
  // What the drop-down's foot lists, Hidden and Recently deleted: the list opens for them when every place stands on the row.
  /*
   * WHETHER THE PLACES' FOOT MAY HAVE ANYTHING TO LIST — a hidden place, a
   * deleted view — so the list opens for it when every place stands; what
   * this viewer may bring back the foot says itself. Read as drawn: what
   * the host lists changes the registry the provider hands down.
   */
  const graview = useGraviewIfAny();
  const tidied = graview?.keptViews?.current();
  const tidies = Boolean(tidied && (tidied.removed.length > 0 || graview!.views.places().some((place) => place.hidden) || (tidied.may.lenses && (graview!.views.arrangement?.()?.hide?.length ?? 0) > 0)));
  return (
    <nav className={stands ? "graview-bar-places" : "graview-bar-place-at"} aria-label={scene ? "What the scene shows" : "The app’s places"} {...(stands ? { "data-testid": "app-places-standing" } : {})} {...gestures}>
      {stands?.map((at) => <PlaceEntry key={places[at]!.key} place={places[at]!} current={current} reach={reach} standing done={() => undefined} />)}
      {rest.length > 0 || tidies ? (
        <>
          <button
            type="button"
            className={stands ? "graview-bar-at" : "graview-bar-place"}
            data-testid="app-places-open"
            {...popover.trigger}
            onClick={popover.toggle}
            aria-label={stands ? `${MORE} — ${rest.length} more ${scene ? "pictures" : "places"}` : `${said} — ${scene ? "what the scene shows" : "every place"}`}
            title={stands ? rest.map((place) => place.label).join(", ") : said}
          >
            {stands ? (
              MORE
            ) : (
              <span className="graview-bar-place-words" data-testid="app-place-current">
                {said}
              </span>
            )}
            <Chevron />
          </button>
          <div {...popover.pane} data-testid="app-places" hidden={!popover.open} className="graview-bar-list" style={POPOVER_STYLE}>
            <PlaceGroups places={rest} current={current} reach={reach} id={popover.pane.id} done={() => popover.setOpen(false)} />
            {tidies && popover.open ? (
              <Suspense fallback={null}>
                <TidyFoot id={popover.pane.id} scene={scene} reach={reach} done={() => popover.setOpen(false)} />
              </Suspense>
            ) : null}
          </div>
        </>
      ) : null}
    </nav>
  );
}

/**
 * THE PLACE MENU'S GESTURES (Roadmap f-place-menu-views), heard once on the
 * places: a right-click, Shift+F10 or the menu key, or a finger resting on a
 * place opens its menu, as on Pages; Shift held keeps the browser's own.
 * Only the gesture is heard here — a place by its path, or the one control,
 * which is the place you are on; which place, whether a finger rested, and
 * the menu itself (`placeGesture`) are fetched with the bar's panes on the
 * first.
 */
function usePlaceGestures(places: readonly BarPlace[], current: string | null, scene: boolean) {
  const setMenuAt = useGraviewIfAny()?.setMenuAt;
  const heard = (event: MouseEvent | KeyboardEvent | PointerEvent) => {
    const element = (event.target as Element).closest?.<HTMLElement>("[data-place-path],[data-testid=app-places-open]");
    if (!element || !setMenuAt) return;
    // A finger resting is only a finger until it has rested: when it lifted, for `placeGesture` to tell.
    const lifted = { at: 0 };
    if (event.type === "pointerdown") document.addEventListener("pointerup", () => (lifted.at ||= Date.now()), { once: true });
    else event.preventDefault();
    const native = event.nativeEvent;
    void barPanes.load().then((panes) => panes.placeGesture(native, element, places, current, scene, setMenuAt, lifted), String);
  };
  return {
    onContextMenu: (event: MouseEvent) => event.shiftKey || heard(event),
    onKeyDown: (event: KeyboardEvent) => (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && heard(event),
    onPointerDown: (event: PointerEvent) => event.pointerType !== "mouse" && event.isPrimary && heard(event),
  };
}

/**
 * WHICH PLACES STAND ON THE ROW, WEIGHED FROM THE ROW AS DRAWN (FR-145):
 * the places' widths read off the ruler (each at its weight as the place
 * you are on, so marking one never moves the others), and the room from
 * where the places begin to where Find ends, less Find at its least. The same answer whichever way
 * the places are drawn, so the row never flips between the two at one
 * width. The places begin where they would with the app's name on one
 * line (`nameGiven`), so they stand only where they leave it there, and the
 * name they would squeeze onto two lines never folds them back. Not weighed
 * while Find is in use (`undefined`); none on a phone's bar, when the app's
 * name is wider on one line than its room, or where nothing is laid out
 * (null).
 */
function standsIn(header: HTMLElement, current: number, ranks: string): string | null | undefined {
  const ruler = header.querySelector<HTMLElement>("[data-graview-bar-ruler]");
  const mid = header.querySelector<HTMLElement>(".graview-bar-mid");
  if (!ruler || !mid) return null;
  const find = header.querySelector<HTMLElement>(".graview-bar-find");
  if (find?.matches(":focus-within")) return undefined;
  if (header.getBoundingClientRect().width < BAR_PHONE) return null;
  const given = nameGiven(header);
  if (given === null) return null;
  const widths = [...ruler.children].map((one) => one.getBoundingClientRect().width);
  const more = widths.pop() ?? 0;
  const from = mid.getBoundingClientRect().left + given;
  const end = find && getComputedStyle(find).display !== "none" ? find.getBoundingClientRect() : undefined;
  /*
   * To Find's end, less Find at its least and the room between them — the
   * row's whole gap: Find stands at `margin-left:auto`, which is nothing
   * once the row is full, not the tools' pull of 8 px, which would weigh
   * the places 8 px roomier than the row and squeeze the app's name by it.
   * With no Find, the middle's own room.
   */
  const room = (end && end.width > 0 ? end.right - from - (parseFloat(getComputedStyle(find!).minWidth) || 0) - 16 : mid.getBoundingClientRect().width - given) - overrun(header);
  const primary = [...ranks].map((rank) => rank !== "0");
  return placesThatStand({ widths, current, room: Math.floor(room), more, primary })?.join(",") ?? null;
}
