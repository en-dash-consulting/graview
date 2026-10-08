import { hueFor, orderKinds, OVERVIEW_SLUG, placeSlug, type AnySchema, type Brand, type PagesArrangement, type Place, type Principal, type Store } from "@graview/core";
import { POPOVER_STYLE, usePopover } from "@graview/react/provider";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { AppMark } from "./app-title.js";

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
}

/** The key the home's place has (FR-136): the app's front page, first in the list, at the app's own address. */
export const HOME_KEY = "home";
/** The home's address on the routed face: the app's own. */
export const HOME_PATH = "/";
/** The key of the scene's first place (FR-144): the whole thing, no picture in view. */
export const WHOLE_KEY = "scene:whole";

const upper = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

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
  const plural = (kind: string): string => (store.schema.tryDefinition(kind)?.plural as string | undefined) ?? `${kind}s`;
  const out: BarPlace[] = [{ key: HOME_KEY, label: "Home", path: HOME_PATH, group: "home" }];
  for (const kind of orderKinds(live, arrangement?.order)) out.push({ key: `kind:${kind}`, label: upper(plural(kind)), path: `/${placeSlug(plural(kind))}`, group: "lists", kind });
  const all = views?.places() ?? [];
  for (const place of all) {
    // A place at the scene's address is not offered: the address is the scene's (FR-132).
    if (!live.includes(place.kind) || place.as === OVERVIEW_SLUG) continue;
    // Two kinds' pictures of one name say whose with `?of=` (as the routed face addresses them).
    const shared = all.some((other) => other.as === place.as && other.kind !== place.kind);
    const path = `/places/${encodeURIComponent(place.as)}${shared ? `?of=${placeSlug(plural(place.kind))}` : ""}`;
    if (!out.some((held) => held.path === path)) out.push({ key: `place:${place.kind}:${place.as}`, label: place.title, path, group: "pictures", kind: place.kind });
  }
  const connects = live.some((kind) => Object.keys((store.schema.tryDefinition(kind)?.edges ?? {}) as object).length > 0);
  if (connects) out.push({ key: "connections", label: "Connections", path: "/map", group: "pictures" });
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
}

/** THE SWITCH (FR-137): the scene and the pages, the app's two faces. */
export interface BarFaces {
  readonly scene: BarFace;
  readonly pages: BarFace;
}

/** How the switch is drawn: its words beside its marks where there is room, or its marks alone (the words its names). */
export type BarSwitch = "words" | "icons";

/** One size for every tool on the bar (FR-131). */
export const TOOL = 30;
/** The bar's one row, its rule under it included, on a desk and a phone alike (FR-138). */
export const BAR_HEIGHT = 48;

/** Below this width of its own the bar is a phone's: the place is the page's first line, and Find a magnifier that opens the box over the row. */
export const BAR_PHONE = 640;

/** The room between two places standing on the row (FR-145). */
export const PLACE_GAP = 4;
/** The fewest places that stand on the row: fewer, and the one control says the same in less room. */
export const FEWEST_STANDING = 2;

/**
 * WHICH PLACES STAND ON THE ROW (FR-145), from their widths and the room:
 * every one when all fit; else the first ones in their order, the current
 * one always among them (in its own place in the order, the last of the
 * first ones giving way to it), with "More" after them; else none — null,
 * the one control. Fewer than `FEWEST_STANDING` is none. A width that is
 * not measured (nothing laid out) is none too.
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
}): readonly number[] | null {
  const { widths, current, room, more, gap = PLACE_GAP } = input;
  if (widths.length === 0 || !(room > 0) || !(more > 0) || widths.some((width) => !(width > 0))) return null;
  const span = (set: readonly number[], folded: boolean) => set.reduce((sum, at) => sum + widths[at]!, 0) + gap * Math.max(0, set.length - 1) + (folded ? gap + more : 0);
  const all = widths.map((_, at) => at);
  if (span(all, false) <= room) return all;
  for (let count = widths.length - 1; count >= FEWEST_STANDING; count--) {
    const set = current < count ? all.slice(0, count) : [...all.slice(0, count - 1), current];
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
 * line and never inside one; the switch keeps its size, and draws its marks
 * alone when its words do not fit (`roomForWords`).
 *
 * Where the places stand on the row (FR-145), Find gives first — down to
 * its least — then the places fold into "More", then into the one control,
 * which gives as above. The places are weighed with the switch's words
 * kept: the words are worth more than a third place on the row.
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
.graview-bar-home,.graview-bar-face,.graview-bar-place,.graview-bar-item,.graview-bar-at{display:inline-flex;align-items:center;box-sizing:border-box;min-width:0;margin:0;border:0;background:none;box-shadow:none;font:inherit;letter-spacing:normal;text-transform:none;text-decoration:none;color:var(--graview-ink);cursor:pointer;text-align:left}
.graview-bar-app{display:flex;flex:0 1 auto;max-width:50%}
.graview-bar-app::after{content:"";flex:0 100000 auto;width:2px;min-width:0}
.graview-bar-name{margin:0;display:flex;font-family:var(--graview-font-display,var(--graview-font-body,system-ui));font-size:.9375rem;font-weight:600;line-height:1.25}
.graview-bar-home{gap:8px;min-width:auto;min-height:30px;padding:0;letter-spacing:-.005em}
.graview-bar-app-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-break:normal}
.graview-bar-faces{display:inline-flex;flex:0 0 auto;box-sizing:border-box;height:30px;margin:0;padding:2px;gap:2px;border:1px solid var(--graview-edge);border-radius:8px}
.graview-bar-face{gap:6px;padding:0 10px;border-radius:6px;font-size:.8125rem;white-space:nowrap;color:var(--graview-ink-muted)}
.graview-bar-face span{min-width:0;max-width:11em;overflow:hidden;text-overflow:ellipsis}
.graview-bar-face[aria-pressed=true]{color:var(--graview-ink);font-weight:600;background:color-mix(in srgb,var(--graview-accent) 16%,transparent)}
[data-switch-drawn=icons] .graview-bar-face{padding:0 8px}
[data-switch-drawn=icons] .graview-bar-face span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.graview-bar-mid{display:flex;flex:1 100 0;min-width:0}
.graview-bar-mid[data-place]{min-width:9em;flex-basis:auto}
.graview-bar-place-at{position:relative;display:inline-flex;min-width:0;max-width:100%}
.graview-bar-place{gap:6px;height:30px;max-width:100%;padding:0 8px;border:1px solid transparent;border-radius:8px;font-size:.875rem;font-weight:600}
.graview-bar-face:hover,.graview-bar-place:hover{border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-place-words{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.graview-bar-mid[data-places=standing]{flex:0 0 auto}
.graview-bar-places{display:flex;align-items:center;gap:${PLACE_GAP}px;min-width:0;margin:0;padding:0}
.graview-bar-at{gap:6px;flex:0 0 auto;height:30px;padding:0 8px;border-block:2px solid transparent;border-radius:0;font-size:.875rem;font-weight:500;white-space:nowrap;color:var(--graview-ink-muted)}
.graview-bar-at:is(:hover,[aria-current],[aria-expanded=true]){color:var(--graview-ink)}
.graview-bar-at[aria-current]{font-weight:600;border-bottom-color:var(--graview-accent)}
.graview-bar-ruler{position:absolute;left:0;top:0;display:flex;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none}
.graview-bar-ruler .graview-bar-at{font-weight:600}
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
.graview-bar-find{position:relative;display:flex;min-width:7.5rem;flex:0 600 9rem;--graview-bar-find-end:3.25em}
.graview-bar-find-slot{display:flex;flex:1;min-width:0}
.graview-bar-find-keys{position:absolute;right:10px;line-height:30px;pointer-events:none;font-size:.75rem;color:var(--graview-ink-faint)}
.graview-bar-find:is(:focus-within,:has(input:not(:placeholder-shown))){flex-basis:16rem;--graview-bar-find-end:10px}
:is(:focus-within,:has(input:not(:placeholder-shown)))>.graview-bar-find-keys,.graview-bar-find-open{display:none}
.graview-bar-line{display:flex;flex:0 0 auto;padding:6px 8px;background:var(--graview-ground);border-bottom:1px solid var(--graview-edge);font-family:var(--graview-font-body,system-ui)}
.graview-bar-line .graview-bar-place{height:auto;min-height:32px}
.graview-bar-line .graview-bar-place-words{white-space:normal}
@media (pointer:coarse){.graview-bar-find-keys{display:none}}
@container graview-bar (max-width: ${BAR_PHONE - 1}px){
.graview-bar-row{gap:10px;padding:0 12px}
.graview-bar-app{max-width:none;flex:1 1 auto}
.graview-bar-mid,.graview-bar-find{display:none}
.graview-bar-find-open{display:inline-flex}
.graview-bar[data-finding] :is(.graview-bar-app,.graview-bar-faces,.graview-bar-find-open){display:none}
.graview-bar[data-finding] .graview-bar-find{display:flex;flex:1 1 auto;min-width:0}
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
 * the way home — then the switch between the scene and the pages (FR-137),
 * then, on Pages, the place you are on (FR-138), and the tools at the
 * right: the Find a face puts in it, then `tools` (the standing and the
 * person). One row of one height on a desk and a phone; on a phone the
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
  switch: switchForm = "words",
  scenePlaces,
}: {
  readonly brand: Brand | undefined;
  readonly name: string;
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
   * How the switch is drawn: `"words"` (the default) says "Scene" and
   * "Pages" beside their marks where the bar has room and draws the marks
   * alone where it is narrow; `"icons"` draws the marks alone at every
   * width. Either way the words are the buttons' names and their titles.
   */
  readonly switch?: BarSwitch;
  /**
   * On the scene, what it can show (FR-144): the whole thing and each
   * picture, the one in view, and the way to each (`useScenePlaces`). None,
   * and the scene's bar names no place.
   */
  readonly scenePlaces?: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo } | undefined;
}) {
  const bar = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [finding, setFinding] = useState(false);
  // Whether the switch's words fit beside everything else the row holds (`roomForWords`).
  const [roomy, setRoomy] = useState(true);
  // Which places stand on the row, by their place in the list ("0,1,2"); null, the one control (FR-145).
  const [standing, setStanding] = useState<string | null>(null);
  // The places on the face drawn: the routed face's, or the scene's (FR-144).
  const onPages = !faces || faces.pages.current;
  const shown = onPages ? { places, current, reach } : scenePlaces;
  const list = shown && shown.places.length > 0 ? shown : null;
  const currentAt = list ? list.places.findIndex((place) => place.key === list.current) : -1;
  const wordsAsked = Boolean(faces) && switchForm === "words";
  const weigh = useCallback(() => {
    const element = bar.current;
    if (!element) return;
    const stand = standsIn(element, currentAt, wordsAsked);
    if (stand !== undefined) setStanding(stand);
    // Standing places were weighed with the switch's words kept.
    const room = stand ? true : roomForWords(element);
    if (room !== null) setRoomy(room);
  }, [currentAt, wordsAsked]);
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const read = () => {
      const width = element.getBoundingClientRect().width;
      setCompact(width < BAR_PHONE);
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
    return () => {
      watch.disconnect();
      fonts?.removeEventListener?.("loadingdone", weigh);
    };
  }, [weigh]);
  const told = useRef(onFind);
  told.current = onFind;
  useLayoutEffect(() => {
    told.current?.(find && slot ? { slot, compact } : null);
  }, [find, slot, compact]);
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
  const Heading = heading === false ? "span" : (`h${heading}` as const);
  const Home = (home.href !== undefined ? "a" : "button") as "a";
  const press = (go: (() => void) | undefined) => (event: MouseEvent) => {
    if (!go || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go();
  };
  // The place control: in the bar on a desk, as the page's first line on a phone; the places themselves on the row when they fit (FR-145).
  const scene = !onPages;
  const stands = list && !compact && standing !== null ? standing.split(",").map(Number).filter((at) => at < list.places.length) : null;
  const placeControl = list ? <Places places={list.places} current={list.current} reach={list.reach} scene={scene} stands={stands} /> : null;
  const said = list ? list.places.map((place) => place.label).join("\n") : "";
  // What the row holds changed — the name, the places, the face, the brand — so the places and the words may fit now, or no longer.
  useLayoutEffect(weigh, [weigh, name, brand, said, list?.current, onPages, compact, switchForm, find]);
  // The marks alone on a phone's bar, when asked, or when the words do not fit.
  const drawn: BarSwitch = switchForm === "icons" || !roomy || compact ? "icons" : "words";
  return (
    <>
      <header
        ref={bar}
        className="graview-bar"
        data-testid="app-bar"
        data-graview-app-bar=""
        {...(finding && compact ? { "data-finding": "" } : {})}
      >
        <style>{BAR_CSS}</style>
        <div className="graview-bar-row">
          <div className="graview-bar-app">
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
          </div>
          {faces ? <FaceSwitch faces={faces} form={switchForm} drawn={drawn} /> : null}
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
                <div
                  className="graview-bar-find"
                  data-testid="app-find"
                  onBlur={(event) => {
                    // Put away on a phone when the keyboard leaves it with nothing typed.
                    const next = event.relatedTarget;
                    if (next instanceof Node && event.currentTarget.contains(next)) return;
                    if (!event.currentTarget.querySelector<HTMLInputElement>("input")?.value) putAway();
                  }}
                  onKeyDownCapture={(event) => {
                    if (event.key === "Escape" && compact) escaping.current = true;
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape" || !compact) return;
                    // The scene's Find takes Escape for its words first; an empty box is put away.
                    if (!event.defaultPrevented || !event.currentTarget.querySelector<HTMLInputElement>("input")?.value) putAway();
                    else escaping.current = false;
                  }}
                >
                  {/* The face's box goes here; the shortcut is said over its end until it is used. */}
                  <div ref={setSlot} className="graview-bar-find-slot">
                    {findBox}
                  </div>
                  <span className="graview-bar-find-keys" data-testid="app-find-keys" aria-hidden="true">
                    {findKeys()}
                  </span>
                </div>
              </>
            ) : null}
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

/**
 * THE SWITCH (FR-137): the scene and the pages, side by side, an icon and a
 * word each — the words the accessible names alone on a phone — the one
 * drawn pressed. Choosing the scene draws it under the bar; choosing the
 * pages goes back to the page you were on.
 */
function FaceSwitch({ faces, form, drawn }: { readonly faces: BarFaces; readonly form: BarSwitch; readonly drawn: BarSwitch }) {
  const face = (which: "scene" | "pages") => {
    const one = faces[which];
    return (
      <button
        type="button"
        className="graview-bar-face"
        data-testid={`app-face-${which}`}
        aria-pressed={one.current}
        title={one.label}
        onClick={() => {
          if (!one.current) one.go();
        }}
      >
        {which === "scene" ? <SceneMark /> : <PagesMark />}
        <span>{one.label}</span>
      </button>
    );
  };
  return (
    <div className="graview-bar-faces" role="group" aria-label={`${faces.scene.label} or ${faces.pages.label}`} data-testid="app-faces" data-switch={form} data-switch-drawn={drawn}>
      {face("scene")}
      {face("pages")}
    </div>
  );
}

/**
 * WHETHER THE SWITCH'S WORDS FIT (the switch left to say its words where
 * there is room). The row is weighed as it is drawn: the room the middle
 * has past what the place wants (its words, up to 14em; none on the
 * scene), less what Find has given up; none when the app's name has
 * wrapped. The words fit when that room holds them — the words
 * drawn already, or their width to come when the marks are drawn alone —
 * so the switch never flips back and forth at one width. Not weighed while
 * Find is in use (it is drawn wide then), on a phone's bar (the marks
 * alone), or where nothing is laid out (null).
 */
function roomForWords(header: HTMLElement): boolean | null {
  const faces = header.querySelector<HTMLElement>(".graview-bar-faces");
  const mid = header.querySelector<HTMLElement>(".graview-bar-mid");
  const find = header.querySelector<HTMLElement>(".graview-bar-find");
  if (!faces || !mid || find?.matches(":focus-within")) return null;
  const row = header.getBoundingClientRect().width;
  if (row < BAR_PHONE) return null;
  // The words to come, beside each mark: the word, the gap before it, and the button's wider padding.
  const words = wordsOf(faces);
  const place = mid.querySelector<HTMLElement>(".graview-bar-place-words");
  const em = place ? Number.parseFloat(getComputedStyle(place).fontSize) || 14 : 0;
  // The place's words, its chevron, its gap, padding and frame: up to 14em of them.
  const wanted = place ? Math.min(place.scrollWidth + 34, 14 * em) : 0;
  let spare = mid.getBoundingClientRect().width - wanted;
  if (find && find.getBoundingClientRect().width > 0) {
    const basis = Number.parseFloat(getComputedStyle(find).flexBasis);
    if (Number.isFinite(basis)) spare -= Math.max(0, basis - find.getBoundingClientRect().width);
  }
  // The app's name on two lines has given its room already: no room for the words.
  const name = header.querySelector(".graview-bar-app-name");
  if (name && name.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(name).lineHeight) * 1.5) return false;
  return faces.getAttribute("data-switch-drawn") === "icons" ? spare >= words + 2 : spare >= -1;
}

/** Find's shortcut as the keyboard says it: ⌘K on a Mac (and an iPad's keyboard), Ctrl K elsewhere. */
function findKeys(): string {
  const platform = typeof navigator === "undefined" ? "" : (navigator.platform ?? "");
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "⌘K" : "Ctrl K";
}

/** The scene's mark: a plot of the city, seen from above at an angle. */
function SceneMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <path d="M7 1.5 L12.5 4.5 L7 7.5 L1.5 4.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1.5 7.5 L7 10.5 L12.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The pages' mark: a page of lines. */
function PagesMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <rect x="2.25" y="1.75" width="9.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 5 H9.5 M4.5 7.25 H9.5 M4.5 9.5 H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** The way a menu opens: a chevron drawn, not a glyph a face may draw as a dot. */
function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A magnifier: the mark for Find where there is no room for the box. */
function FindMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A place's mark in the list: the home's house, a kind's plot in its own hue. */
function PlaceMark({ place }: { readonly place: BarPlace }) {
  // The scene's whole thing: the scene's own mark, as on the switch (FR-144).
  if (place.key === WHOLE_KEY) return <SceneMark />;
  if (place.group === "home") {
    return (
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <path d="M2 6.5 L7 2 L12 6.5 V12 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
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
        if (href !== undefined && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
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
function Places({ places, current, reach, scene, stands }: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo; readonly scene: boolean; readonly stands: readonly number[] | null }) {
  const popover = usePopover("places");
  const said = places.find((place) => place.key === current)?.label ?? "Places";
  const rest = stands ? places.filter((_, at) => !stands.includes(at)) : places;
  return (
    <nav className={stands ? "graview-bar-places" : "graview-bar-place-at"} aria-label={scene ? "What the scene shows" : "The app’s places"} {...(stands ? { "data-testid": "app-places-standing" } : {})}>
      {stands?.map((at) => <PlaceEntry key={places[at]!.key} place={places[at]!} current={current} reach={reach} standing done={() => undefined} />)}
      {rest.length > 0 ? (
        <>
          <button
            type="button"
            className={stands ? "graview-bar-at" : "graview-bar-place"}
            data-testid="app-places-open"
            {...popover.trigger}
            onClick={popover.toggle}
            aria-label={stands ? `${MORE} — ${rest.length} more ${scene ? "pictures" : "places"}` : `${said} — ${scene ? "everything the scene shows" : "every place"}`}
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
          </div>
        </>
      ) : null}
    </nav>
  );
}

/**
 * WHICH PLACES STAND ON THE ROW, WEIGHED FROM THE ROW AS DRAWN (FR-145):
 * the places' widths read off the ruler (each at its weight as the place
 * you are on, so marking one never moves the others), and the room from
 * where the places begin to where Find ends, less Find at its least, less
 * the switch's words when they are asked for. The same answer whichever way
 * the places are drawn, so the row never flips between the two at one
 * width. Not weighed while Find is in use (`undefined`); none on a phone's
 * bar, when the app's name has wrapped, or where nothing is laid out (null).
 */
function standsIn(header: HTMLElement, current: number, wordsAsked: boolean): string | null | undefined {
  const ruler = header.querySelector<HTMLElement>(".graview-bar-ruler");
  const mid = header.querySelector<HTMLElement>(".graview-bar-mid");
  if (!ruler || !mid) return null;
  const find = header.querySelector<HTMLElement>(".graview-bar-find");
  if (find?.matches(":focus-within")) return undefined;
  if (header.getBoundingClientRect().width < BAR_PHONE) return null;
  const name = header.querySelector(".graview-bar-app-name");
  if (name && name.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(name).lineHeight) * 1.5) return null;
  const widths = [...ruler.children].map((one) => one.getBoundingClientRect().width);
  const more = widths.pop() ?? 0;
  const faces = header.querySelector<HTMLElement>(".graview-bar-faces");
  const words = faces && wordsAsked ? wordsOf(faces) : 0;
  const drawnWords = faces?.getAttribute("data-switch-drawn") === "words" ? words : 0;
  const from = mid.getBoundingClientRect().left;
  const end = find?.getBoundingClientRect();
  // To Find's end, less Find at its least and the room between them (the row's gap, less the tools' pull); with no Find, the middle's own room.
  const room = end && end.width > 0 ? end.right - from - (Number.parseFloat(getComputedStyle(find!).minWidth) || 0) - 8 : mid.getBoundingClientRect().width;
  return placesThatStand({ widths, current, room: Math.floor(room + drawnWords - words), more })?.join(",") ?? null;
}

/** The switch's words, beside each mark: the word, the gap before it, and the button's wider padding. */
function wordsOf(faces: HTMLElement): number {
  return [...faces.querySelectorAll<HTMLElement>(".graview-bar-face span")].reduce((sum, span) => sum + span.scrollWidth + 10, 0);
}
