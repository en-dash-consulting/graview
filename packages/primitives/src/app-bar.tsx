import { OVERVIEW_PATH, OVERVIEW_SLUG, orderKinds, overviewTitle, placeSlug, type AnySchema, type Brand, type PagesArrangement, type Place, type Principal, type Store } from "@graview/core";
import { POPOVER_STYLE, usePopover } from "@graview/react/provider";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { AppMark } from "./app-title.js";

/*
 * ONE APP BAR ON EVERY FACE (FR-131), AND THE SCENE AS A PLACE (FR-132).
 *
 * Two bars were stacked over every hosted app: the embed's strip said the
 * app's name, the way into the scene and the state of the rules, and the
 * routed face's masthead said the name, the way into the scene and the
 * state of the rules again, with "Scene", "Pages", "Pictures" and "Map" as
 * four words for overlapping ideas. This is the one bar: the app — its mark
 * and its name, said once, as the page's heading, the way home — then its
 * places as plain tabs, the one you are on marked, the rest of a row too
 * long for its room under "More"; then the tools, one size, each named:
 * Find, the standing of the rules, and the person.
 *
 * The scene is one of the places: "Overview" unless the declaration calls
 * it something else (`pages.overview`), at `/places/overview` whatever it
 * is called.
 */

/** One of the app's places on the bar: what it is called, and where it is on the routed face. */
export interface BarPlace {
  readonly key: string;
  readonly label: string;
  /** Its path on the routed face — `/places/overview` for the scene. */
  readonly path: string;
}

/** The key the scene's place has on the bar. */
export const OVERVIEW_KEY = OVERVIEW_SLUG;

const upper = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * THE APP'S PLACES, IN THE BAR'S ORDER: the overview (when the face can draw
 * the scene), each named picture, each kind's list in the declaration's
 * order, and how the kinds connect, when they do. What a seat may not see
 * is not offered: a kind kept from it, a disabled module's kind, a picture
 * over either.
 */
export function barPlaces(input: {
  readonly store: Store<AnySchema>;
  readonly principal?: Principal | undefined;
  readonly views?: { places(): readonly Place[]; arrangement?(): PagesArrangement | undefined } | undefined;
  /** Whether the scene is one of the places here. */
  readonly overview: boolean;
}): readonly BarPlace[] {
  const { store, principal, views } = input;
  const kept = store.kindsKeptFrom(principal);
  const live = (store.schema.kinds as readonly string[]).filter((kind) => !store.modules.disabledKinds.has(kind) && !kept.has(kind));
  const arrangement = views?.arrangement?.();
  const plural = (kind: string): string => (store.schema.tryDefinition(kind)?.plural as string | undefined) ?? `${kind}s`;
  const out: BarPlace[] = [];
  if (input.overview) out.push({ key: OVERVIEW_KEY, label: overviewTitle(arrangement), path: OVERVIEW_PATH });
  const all = views?.places() ?? [];
  for (const place of all) {
    if (!live.includes(place.kind) || place.as === OVERVIEW_SLUG) continue;
    // Two kinds' pictures of one name say whose with `?of=` (as the routed face addresses them).
    const shared = all.some((other) => other.as === place.as && other.kind !== place.kind);
    const path = `/places/${encodeURIComponent(place.as)}${shared ? `?of=${placeSlug(plural(place.kind))}` : ""}`;
    if (!out.some((held) => held.path === path)) out.push({ key: `place:${place.kind}:${place.as}`, label: place.title, path });
  }
  for (const kind of orderKinds(live, arrangement?.order)) out.push({ key: `kind:${kind}`, label: upper(plural(kind)), path: `/${placeSlug(plural(kind))}` });
  const connects = live.some((kind) => Object.keys((store.schema.tryDefinition(kind)?.edges ?? {}) as object).length > 0);
  if (connects) out.push({ key: "connections", label: "Connections", path: "/map" });
  return out;
}

/** Which of the places a path on the routed face is: its own, a record's kind's, or none (the home, Find, the problems). */
export function barPlaceAt(places: readonly BarPlace[], path: string): string | null {
  const [pathname = "/", search = ""] = path.split("?");
  const exact = places.find((place) => place.path === (search ? `${pathname}?${search}` : pathname)) ?? places.find((place) => place.path === pathname);
  if (exact) return exact.key;
  const first = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  // A record's page is under its kind's list.
  return places.find((place) => place.key.startsWith("kind:") && place.path === first)?.key ?? null;
}

/**
 * WHERE A FACE PUTS ITS FIND BOX (FR-131). The bar draws the place; the
 * face drawn under it — the scene's Find, or the routed face's — puts its
 * own box there, so Find is one box in one place whichever face is drawn.
 */
export interface BarFind {
  readonly slot: HTMLElement;
  /** A phone's bar: the box opens over the bar's first row when it is asked for. */
  readonly compact: boolean;
}
export const BarFindContext = createContext<BarFind | null>(null);
/** The bar's place for a Find box, when a bar above this face has one. */
export const useBarFind = (): BarFind | null => useContext(BarFindContext);

/** How a place is reached: a link when it has an address, a press when the bar decides. */
export interface BarGo {
  /** The address a place's link carries; none, and the tab is a button. */
  readonly href?: (path: string) => string | undefined;
  /** Goes to a place; a link's ordinary press is handed here rather than followed. */
  readonly go?: (place: BarPlace) => void;
}

/** One size for every tool on the bar (FR-131). */
export const TOOL = 30;

const BAR_CSS = `
.graview-bar{container-type:inline-size;flex:0 0 auto;position:relative;background:var(--graview-bar);border-bottom:1px solid var(--graview-edge);color:var(--graview-ink);font-family:var(--graview-font-body,system-ui)}
.graview-bar-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"app places tools";align-items:stretch;column-gap:20px;padding:0 16px;min-height:48px}
.graview-bar-app{grid-area:app;display:flex;align-items:center;min-width:0}
.graview-bar-name{margin:0;min-width:0;display:flex;font-family:var(--graview-font-display,var(--graview-font-body,system-ui));font-size:.9375rem;font-weight:600;line-height:1.3;letter-spacing:-.005em}
.graview-bar-home{display:inline-flex;align-items:center;gap:8px;min-width:0;min-height:30px;color:var(--graview-ink);text-decoration:none;font:inherit;letter-spacing:inherit;overflow-wrap:anywhere;margin:0;padding:0;border:0;background:none;box-shadow:none;cursor:pointer;text-align:left}
.graview-bar-more{display:grid;min-width:200px;max-width:calc(100vw - 32px);margin:0;padding:4px;list-style:none;border-radius:10px;border:1px solid var(--graview-edge);background:var(--graview-float);box-shadow:var(--graview-lift-high)}
.graview-bar-more[hidden]{display:none}
.graview-bar-item{display:flex;align-items:center;width:100%;min-height:32px;padding:0 10px;border:0;border-left:2px solid transparent;border-radius:7px;background:none;box-shadow:none;font:inherit;font-size:.875rem;text-align:left;text-decoration:none;color:var(--graview-ink);cursor:pointer}
.graview-bar-item[aria-current="page"]{font-weight:600;border-left-color:var(--graview-accent)}
.graview-bar-places{grid-area:places;display:flex;align-items:stretch;min-width:0}
.graview-bar-tools{grid-area:tools;display:flex;align-items:center;gap:8px;min-width:0}
.graview-bar-find{display:flex;align-items:center;width:15rem;min-width:0}
.graview-bar-find-open{display:none;align-items:center;justify-content:center}
.graview-bar-tab{display:inline-flex;align-items:center;gap:4px;padding:0 10px;margin:0;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;box-shadow:none;font:inherit;font-size:.875rem;line-height:1.2;white-space:nowrap;color:var(--graview-ink-muted);text-decoration:none;cursor:pointer;flex:0 0 auto}
.graview-bar-tab:hover{color:var(--graview-ink)}
.graview-bar-tab[aria-current="page"]{color:var(--graview-ink);border-bottom-color:var(--graview-accent);font-weight:600}
.graview-bar-tab:focus-visible{outline:2px solid var(--graview-accent);outline-offset:-4px}
.graview-bar-measure{position:absolute;visibility:hidden;pointer-events:none;display:flex;white-space:nowrap;height:0;overflow:hidden}
@container (max-width: 639px){
.graview-bar-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"app tools" "places places";padding:0 12px;min-height:0;column-gap:12px}
.graview-bar-app,.graview-bar-tools{min-height:48px}
.graview-bar-places{border-top:1px solid var(--graview-edge);margin:0 -12px;padding:0 2px;min-height:40px}
.graview-bar-find{display:none;width:auto;flex:1 1 auto}
.graview-bar-find-open{display:inline-flex}
.graview-bar[data-finding] .graview-bar-app{display:none}
.graview-bar[data-finding] .graview-bar-row{grid-template-areas:"tools tools" "places places"}
.graview-bar[data-finding] .graview-bar-tools{flex:1 1 auto}
.graview-bar[data-finding] .graview-bar-find{display:flex}
.graview-bar[data-finding] .graview-bar-find-open{display:none}
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
 * the way home — its places in the middle, and the tools at the right: the
 * Find a face puts in it, then `tools` (the standing and the person). One
 * row at a desk; on a phone the places take a second row of their own.
 */
export function AppBar({
  brand,
  name,
  heading = 1,
  home,
  places,
  current,
  reach,
  tools,
  find = true,
  description,
  findBox,
  onFind,
}: {
  readonly brand: Brand | undefined;
  readonly name: string;
  /** The level the app's name is said at: 1 when the page is the app's, `false` when the host's own heading already says it. */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /** The way home, and whether the reader is there. */
  readonly home: { readonly href?: string | undefined; readonly go?: (() => void) | undefined; readonly current: boolean };
  readonly places: readonly BarPlace[];
  /** The key of the place the reader is on; null at the home, at Find, at the problems. */
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
}) {
  const bar = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [finding, setFinding] = useState(false);
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const read = () => setCompact(element.getBoundingClientRect().width < 640);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
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
  const Heading = heading === false ? "span" : (`h${heading}` as const);
  const press = (go: (() => void) | undefined) => (event: MouseEvent) => {
    if (!go || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go();
  };
  return (
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
            {home.href !== undefined ? (
              <a href={home.href} onClick={press(home.go)} data-testid="app-home" {...(home.current ? { "aria-current": "page" as const } : {})} title={description ? `${name} — ${description}` : `${name} — home`} className="graview-bar-home">
                <AppMark brand={brand} size={20} />
                <span data-testid="app-name">{name}</span>
              </a>
            ) : (
              <button type="button" onClick={home.go} data-testid="app-home" {...(home.current ? { "aria-current": "page" as const } : {})} title={description ? `${name} — ${description}` : `${name} — home`} className="graview-bar-home">
                <AppMark brand={brand} size={20} />
                <span data-testid="app-name">{name}</span>
              </button>
            )}
          </Heading>
        </div>
        <BarPlaces places={places} current={current} reach={reach} />
        <div className="graview-bar-tools">
          {find ? (
            <>
              <button
                type="button"
                className="graview-bar-find-open"
                data-testid="app-find-open"
                aria-label="Find"
                title="Find"
                onClick={openFind}
                style={{ ...toolStyle, display: undefined }}
              >
                <FindMark />
              </button>
              <div
                ref={setSlot}
                className="graview-bar-find"
                data-testid="app-find"
                onBlur={(event) => {
                  // Put away on a phone when the keyboard leaves it with nothing typed.
                  const next = event.relatedTarget;
                  if (next instanceof Node && event.currentTarget.contains(next)) return;
                  if (!event.currentTarget.querySelector<HTMLInputElement>("input")?.value) setFinding(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && compact && !event.defaultPrevented) setFinding(false);
                }}
              >
                {findBox}
              </div>
            </>
          ) : null}
          {tools}
        </div>
      </div>
    </header>
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

/**
 * THE PLACES AS PLAIN TABS. As many as the row holds, in order; the rest
 * under "More". The tab you are on is marked — and when it is one of the
 * rest, "More" says its name, marked, so where you are is never hidden.
 */
function BarPlaces({ places, current, reach }: { readonly places: readonly BarPlace[]; readonly current: string | null; readonly reach: BarGo }) {
  const row = useRef<HTMLElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(places.length);
  const popover = usePopover("places");
  const signature = places.map((place) => place.label).join("|");
  const currentAt = places.findIndex((place) => place.key === current);
  useLayoutEffect(() => {
    const element = row.current;
    const ruler = measure.current;
    if (!element || !ruler) return;
    const fit = () => {
      const room = element.getBoundingClientRect().width + 0.5;
      const widths = [...ruler.children].map((child) => child.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      const sum = (list: readonly number[]) => list.reduce((total, width) => total + width, 0);
      let count = widths.length;
      if (sum(widths) > room) {
        // As many as fit beside "More" — the place you are on among them, in the last one's room when it is further along.
        count = widths.length - 1;
        while (count > 0) {
          const seen = currentAt >= count ? [...widths.slice(0, count - 1), widths[currentAt]!] : widths.slice(0, count);
          if (sum(seen) + more <= room) break;
          count -= 1;
        }
      }
      setFits((was) => (was === count ? was : count));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(fit);
    watch.observe(element);
    return () => watch.disconnect();
  }, [signature, currentAt]);
  if (places.length === 0) return <div className="graview-bar-places" data-testid="app-places" ref={row as never} />;
  // The place you are on is on the row: in the last tab's room when it is one the row could not otherwise hold.
  const shown = currentAt >= fits && fits > 0 ? [...places.slice(0, fits - 1), places[currentAt]!] : places.slice(0, fits);
  const rest = places.filter((place) => !shown.includes(place));
  const tab = (place: BarPlace, inMenu: boolean) => {
    const here = place.key === current;
    const href = reach.href?.(place.path);
    const common = {
      className: inMenu ? "graview-bar-item" : "graview-bar-tab",
      "data-testid": `app-place-${place.key}`,
      "data-place-path": place.path,
      ...(here ? { "aria-current": "page" as const } : {}),
      onClick: (event: MouseEvent) => {
        if (inMenu) popover.setOpen(false);
        if (!reach.go) return;
        if (href !== undefined && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        reach.go(place);
      },
    };
    return href !== undefined ? (
      <a key={place.key} {...common} href={href}>
        {place.label}
      </a>
    ) : (
      <button key={place.key} {...common} type="button">
        {place.label}
      </button>
    );
  };
  return (
    <nav ref={row} className="graview-bar-places" aria-label="The app’s places" data-testid="app-places" style={{ position: "relative" }}>
      {/* The row as it would be, measured and never seen: how many tabs the room holds. */}
      <div ref={measure} className="graview-bar-measure" aria-hidden="true">
        {places.map((place) => (
          <span key={place.key} className="graview-bar-tab" style={{ fontWeight: 600 }}>
            {place.label}
          </span>
        ))}
        <span className="graview-bar-tab">
          More
          <Chevron />
        </span>
      </div>
      {shown.map((place) => tab(place, false))}
      {rest.length > 0 ? (
        <span style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            className="graview-bar-tab"
            data-testid="app-places-more"
            {...popover.trigger}
            onClick={popover.toggle}
            aria-label="More places"
          >
            More
            <Chevron />
          </button>
          <ul
            {...popover.pane}
            data-testid="app-places-more-list"
            aria-label="More places"
            hidden={!popover.open}
            className="graview-bar-more"
            style={POPOVER_STYLE}
          >
            {rest.map((place) => (
              <li key={place.key}>{tab(place, true)}</li>
            ))}
          </ul>
        </span>
      ) : null}
    </nav>
  );
}
