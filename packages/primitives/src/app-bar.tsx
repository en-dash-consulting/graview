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
 * and the places are two presses away, never on the row.
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
.graview-bar-home,.graview-bar-face,.graview-bar-place,.graview-bar-item{display:inline-flex;align-items:center;box-sizing:border-box;min-width:0;margin:0;border:0;background:none;box-shadow:none;font:inherit;letter-spacing:normal;text-transform:none;text-decoration:none;color:var(--graview-ink);cursor:pointer;text-align:left}
.graview-bar-app{display:flex;flex:0 1 auto;max-width:50%}
.graview-bar-app::after{content:"";flex:0 100000 auto;width:2px;min-width:0}
.graview-bar-name{margin:0;display:flex;font-family:var(--graview-font-display,var(--graview-font-body,system-ui));font-size:.9375rem;font-weight:600;line-height:1.25}
.graview-bar-home{gap:8px;min-width:auto;min-height:30px;padding:0;letter-spacing:-.005em}
.graview-bar-app-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-break:normal;hyphens:manual}
.graview-bar-faces{display:inline-flex;flex:0 0 auto;box-sizing:border-box;height:30px;margin:0;padding:2px;gap:2px;border:1px solid var(--graview-edge);border-radius:8px}
.graview-bar-face{gap:6px;padding:0 10px;border-radius:6px;font-size:.8125rem;white-space:nowrap;color:var(--graview-ink-muted)}
.graview-bar-face span{min-width:0;max-width:11em;overflow:hidden;text-overflow:ellipsis}
.graview-bar-face[aria-pressed=true]{color:var(--graview-ink);font-weight:600;background:color-mix(in srgb,var(--graview-accent) 16%,transparent)}
.graview-bar-faces:is([data-switch=icons],[data-switch-drawn=icons]) .graview-bar-face{padding:0 8px}
.graview-bar-faces:is([data-switch=icons],[data-switch-drawn=icons]) .graview-bar-face span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.graview-bar-mid{display:flex;flex:1 100 0;min-width:0}
.graview-bar-mid[data-place]{min-width:9em;flex-basis:auto}
.graview-bar-place-at{position:relative;display:inline-flex;min-width:0;max-width:100%}
.graview-bar-place{gap:6px;height:30px;max-width:100%;padding:0 8px;border:1px solid transparent;border-radius:8px;font-size:.875rem;font-weight:600}
.graview-bar-face:hover,.graview-bar-place:hover{border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-bar-place-words{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.graview-bar-list{display:grid;width:min(320px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;margin:0;padding:6px;border-radius:10px;border:1px solid var(--graview-edge);background:var(--graview-float);box-shadow:var(--graview-lift-high);color:var(--graview-ink)}
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
.graview-bar-find{position:relative;display:flex;box-sizing:border-box;min-width:6.5rem;flex:0 600 9rem;container:graview-bar-find/inline-size;--graview-bar-find-end:3.25em;transition:flex-basis 140ms ease-out}
.graview-bar-find-slot{display:flex;flex:1 1 auto;min-width:0}
.graview-bar-find-keys{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;font:inherit;font-size:.75rem;line-height:1;color:var(--graview-ink-faint,var(--graview-ink-muted));white-space:nowrap}
.graview-bar-find:focus-within,.graview-bar-find:has(input:not(:placeholder-shown)){flex-basis:16rem;min-width:9rem;--graview-bar-find-end:10px}
.graview-bar-find:focus-within .graview-bar-find-keys,.graview-bar-find:has(input:not(:placeholder-shown)) .graview-bar-find-keys{display:none}
.graview-bar-find-open{display:none}
.graview-bar-line{display:flex;flex:0 0 auto;padding:6px 8px;background:var(--graview-ground);border-bottom:1px solid var(--graview-edge);font-family:var(--graview-font-body,system-ui)}
.graview-bar-line .graview-bar-place{height:auto;min-height:32px}
.graview-bar-line .graview-bar-place-words{white-space:normal}
@media (hover:none) and (pointer:coarse){.graview-bar-find{--graview-bar-find-end:10px}.graview-bar-find-keys{display:none}}
@media (prefers-reduced-motion:reduce){.graview-bar-find{transition:none}}
@container graview-bar-find (max-width: 7.5rem){.graview-bar-find-slot{--graview-bar-find-end:10px}.graview-bar-find-keys{display:none}}
@container graview-bar (max-width: ${BAR_PHONE - 1}px){
.graview-bar-face{padding:0 8px}
.graview-bar-face span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.graview-bar-row{gap:10px;padding:0 12px}
.graview-bar-app{max-width:none;flex:1 1 auto}
.graview-bar-mid,.graview-bar-find{display:none}
.graview-bar-find-open{display:inline-flex}
.graview-bar[data-finding] :is(.graview-bar-app,.graview-bar-faces,.graview-bar-find-open){display:none}
.graview-bar[data-finding] .graview-bar-find{display:flex;flex:1 1 auto;min-width:0;--graview-bar-find-end:10px}
.graview-bar[data-finding] .graview-bar-find-keys{display:none}
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
}) {
  const bar = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [finding, setFinding] = useState(false);
  // Whether the switch's words fit beside everything else the row holds (`roomForWords`).
  const [roomy, setRoomy] = useState(true);
  const weigh = useCallback(() => {
    const element = bar.current;
    const room = element ? roomForWords(element) : null;
    if (room !== null) setRoomy(room);
  }, []);
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
    void (typeof document === "undefined" ? undefined : document.fonts?.ready.then(weigh));
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
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
  // The place control stands on Pages: in the bar on a desk, as the page's first line on a phone.
  const onPages = !faces || faces.pages.current;
  const placeControl = onPages && places.length > 0 ? <PlaceControl places={places} current={current} reach={reach} /> : null;
  // What the row holds changed — the name, the place, the face — so the words may fit now, or no longer.
  useLayoutEffect(weigh, [weigh, name, current, onPages, compact, switchForm, places.length]);
  const drawn: BarSwitch = switchForm === "icons" || !roomy ? "icons" : "words";
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
          <div className="graview-bar-mid" {...(!compact && placeControl ? { "data-place": "" } : {})}>
            {compact ? null : placeControl}
          </div>
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

/** A text's width on one line in its own face, for a row that has wrapped or cut it. */
let ruler: CanvasRenderingContext2D | null | undefined;
function lineWidth(element: Element): number {
  if (ruler === undefined) {
    try {
      ruler = document.createElement("canvas").getContext("2d");
    } catch {
      ruler = null;
    }
  }
  if (!ruler) return element.getBoundingClientRect().width;
  ruler.font = getComputedStyle(element).font;
  return ruler.measureText(element.textContent ?? "").width;
}

/**
 * WHETHER THE SWITCH'S WORDS FIT (the switch left to say its words where
 * there is room). The row is weighed as it is drawn: the room the middle
 * has past what the place wants (its words, up to 14em; none on the
 * scene), less what Find has given up and what the app's name has given
 * up by wrapping. The words fit when that room holds them — the words
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
  const words = [...faces.querySelectorAll<HTMLElement>(".graview-bar-face span")].reduce((sum, span) => sum + span.scrollWidth + 10, 0);
  const place = mid.querySelector<HTMLElement>(".graview-bar-place-words");
  const em = place ? Number.parseFloat(getComputedStyle(place).fontSize) || 14 : 0;
  // The place's words, its chevron, its gap, padding and frame: up to 14em of them.
  const wanted = place ? Math.min(place.scrollWidth + 34, 14 * em) : 0;
  let spare = mid.getBoundingClientRect().width - wanted;
  if (find && find.getBoundingClientRect().width > 0) {
    const basis = Number.parseFloat(getComputedStyle(find).flexBasis);
    if (Number.isFinite(basis)) spare -= Math.max(0, basis - find.getBoundingClientRect().width);
  }
  const name = header.querySelector(".graview-bar-app-name");
  if (name) spare -= Math.max(0, lineWidth(name) - name.getBoundingClientRect().width - 1);
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

/**
 * THE PLACE YOU ARE ON, AND EVERY OTHER (FR-138): one control, the place's
 * name and a chevron, that opens the app's places — the home first, then
 * the Lists and the Pictures, each with its mark, a long name wrapped
 * rather than cut. Every place is two presses away, and the bar is one row
 * of one height however many there are.
 */
function PlaceControl({ places, current, reach }: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo }) {
  const popover = usePopover("places");
  const here = places.find((place) => place.key === current);
  const said = here?.label ?? "Places";
  const entry = (place: BarPlace) => {
    const at = place.key === current;
    const href = reach.href?.(place.path);
    const common = {
      className: "graview-bar-item",
      "data-testid": `app-place-${place.key}`,
      "data-place-path": place.path,
      ...(at ? { "aria-current": "page" as const } : {}),
      onClick: (event: MouseEvent) => {
        popover.setOpen(false);
        if (!reach.go) return;
        if (href !== undefined && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        reach.go(place);
      },
    };
    const Entry = (href !== undefined ? "a" : "button") as "a";
    return (
      <Entry key={place.key} {...common} {...(href !== undefined ? { href } : { type: "button" as const })}>
        <span className="graview-bar-mark">
          <PlaceMark place={place} />
        </span>
        <span>{place.label}</span>
      </Entry>
    );
  };
  return (
    <span className="graview-bar-place-at">
      <button
        type="button"
        className="graview-bar-place"
        data-testid="app-places-open"
        {...popover.trigger}
        onClick={popover.toggle}
        aria-label={`${said} — every place`}
        title={said}
      >
        <span className="graview-bar-place-words" data-testid="app-place-current">
          {said}
        </span>
        <Chevron />
      </button>
      <nav {...popover.pane} data-testid="app-places" aria-label="The app’s places" hidden={!popover.open} className="graview-bar-list" style={POPOVER_STYLE}>
        {GROUPS.map(({ group, heading }) => {
          const listed = places.filter((place) => place.group === group);
          if (listed.length === 0) return null;
          const id = `${popover.pane.id}-${group}`;
          return (
            <div key={group} role="group" {...(heading ? { "aria-labelledby": id } : { "aria-label": "Home" })} data-place-group={group}>
              {heading ? (
                <p id={id}>
                  {heading}
                </p>
              ) : null}
              <ul>
                {listed.map((place) => (
                  <li key={place.key}>{entry(place)}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </span>
  );
}
