import { AppBar, barPlaceAt, barPlaces, Profile, StandingDot, standingWords, toolStyle, useFavicon } from "@graview/primitives/pages";
import { PagesActivity } from "./pages-activity.js";
import { faviconHref, pagesTitle, pluralLabel, sceneTitle } from "@graview/core";
import type { AnySchema } from "@graview/core";
import { Link, useHref, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BarFind } from "@graview/primitives/pages";
import type { ReactNode } from "react";
import { kindOfSlug } from "./registry.js";
import { type PageContext, StartFreshLink, useStoreTick } from "./page-context.js";
import { usePlacedOnTheFace } from "./face-placed.js";
import { WIDE, column, h1, quiet } from "./page-typography.js";


/**
 * THE SHELL: the one app bar (FR-131) over the page, and a quiet foot.
 *
 * The bar is the app — its mark and name, the page's one heading, the way
 * home — then the switch between the scene and the pages (FR-137), the
 * place you are on, which opens every place the app has (FR-138); then
 * Find, the standing and, where there is a seat, the person. Under an embed's bar
 * (`barAbove`) the shell draws none of it: the embed's bar already says
 * every word, and the face's Find goes there.
 */
export function DefaultShell<S extends AnySchema>({
  context,
  children,
}: {
  context: PageContext<S>;
  children: ReactNode;
}) {
  const { store, brand } = context;
  useStoreTick(store);
  // On its own the routed face owns the page, and wears the brand's icon; embedded, the host's page keeps its own (FR-124).
  useFavicon(context.embedded ? undefined : faviconHref(brand));
  return (
    <div
      style={{
        /*
         * A WINDOW'S HEIGHT ONLY FOR A FACE THAT OWNS THE WINDOW. Embedded,
         * `100vh` is the host's viewport, or the frame's when the embed is
         * a chat's widget sized from its content: the page asked for the
         * frame's height, the frame grew to the page plus the bar, and
         * the page asked again, without end (FR-13).
         */
        ...(context.embedded ? {} : { minHeight: "100vh" }),
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-ground)",
        color: "var(--graview-ink)",
        fontFamily: "var(--graview-font-body, system-ui)",
        fontSize: "1.0625rem",
        lineHeight: 1.6,
      }}
    >
      {context.embedded ? null : <OwnBar context={context} />}
      <div style={{ flex: 1 }}>{children}</div>
      {/*
        * Whether this browser remembers, and the way back to the example: the
        * reader's own, at the foot, under whichever shell. What answers the
        * seat is the host's to decide (`ai`), so nothing here asks a reader.
        */}
      {context.remembers ? (
        <footer
          style={{
            borderTop: "1px solid var(--graview-edge)",
            padding: "14px 20px 20px",
            ...quiet,
            fontSize: "0.875rem",
          }}
        >
          <div style={{ maxWidth: WIDE, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <span data-testid="remembered">
              Remembered in this browser · <StartFreshLink />
            </span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

/**
 * WHERE THE OWN BAR KEEPS ITS FIND (set by the router): the bar tells the
 * face's root its slot, and the root puts the face's one Find box there —
 * unless the shell under the bar placed its own, or goes without. Unset,
 * the bar draws its own box.
 */
export const OwnBarFind = createContext<{ readonly onFind: (find: BarFind | null) => void; readonly find: boolean } | null>(null);

/**
 * The bar of a routed face that owns its page: the scene is on
 * its own address (`sceneHref`), every other place is this face's.
 */
function OwnBar<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const { store, brand, sceneHref = "/", invariantContext } = context;
  const location = useLocation();
  const navigate = useNavigate();
  const base = useHref("/").replace(/\/$/, "");
  const places = barPlaces({ store: store as never, principal: context.principal, views: context.views });
  const arrangement = context.views?.arrangement?.();
  const here = `${location.pathname}${location.search}`;
  const broken = store.violations(invariantContext);
  const problems = broken.length;
  const said = standingWords(broken, "All rules hold");
  const toldFind = useContext(OwnBarFind);
  return (
    <>
      <AppBar
        brand={brand}
        name={brand?.name ?? "Graview"}
        description={brand?.subtitle}
        home={{ href: `${base}/`, go: () => navigate("/"), current: location.pathname === "/" }}
        faces={{
          // The scene is on its own address (`sceneHref`); this face is the pages.
          scene: { label: sceneTitle(arrangement), current: false, go: () => window.location.assign(sceneHref) },
          pages: { label: pagesTitle(arrangement), current: true, go: () => undefined },
        }}
        places={places}
        current={barPlaceAt(places, here)}
        reach={{ href: (path) => `${base}${path}`, go: (place) => navigate(place.path) }}
        {...(toldFind ? { onFind: toldFind.onFind, find: toldFind.find } : { findBox: <PageFind context={context} /> })}
        tools={
          <>
            {/* The standing, as the problems' own page: a dot, a number only when a rule is broken (FR-131). */}
            <Link to="/problems" data-testid="standing-link" aria-label={said} title={said} style={{ ...toolStyle, padding: problems === 0 ? 0 : "0 8px", textDecoration: "none", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: problems === 0 ? "var(--graview-ink-muted)" : "var(--graview-warn)" }}>
              <StandingDot tone={problems === 0 ? "var(--graview-good)" : "var(--graview-warn)"} />
              {problems > 0 ? <span aria-hidden="true">{problems}</span> : null}
            </Link>
            {/* What has happened, each with its way back, as the scene's bar has it (FR-152). */}
            <PagesActivity context={context} />
            {context.views ? <Profile {...(context.signature ? { signature: true } : {})} /> : null}
          </>
        }
      />
    </>
  );
}

/**
 * A page's outer element: <main> when the face owns the document, a plain
 * section when it is embedded in a page that has its own — `main` allows no
 * other role, so the tag itself has to change.
 */
export function PageMain<S extends AnySchema>({
  context,
  style,
  children,
  ...rest
}: { context: PageContext<S>; style?: React.CSSProperties; children?: React.ReactNode } & Record<`data-${string}`, string>) {
  // Somebody above owns the landmark: the host page, or the app's own shell.
  const Tag = (context.embedded || context.framed ? "section" : "main") as "main";
  return (
    <Tag style={{ ...column, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A PAGE'S OWN TITLE (FR-131): said under the app's name, which the bar
 * says as the heading — so a level below it (`titleLevel`, `2` by default),
 * never a second `h1` on a page that is the app's.
 */
export function PageTitle<S extends AnySchema>({
  context,
  children,
  ...rest
}: { context: PageContext<S>; children?: ReactNode } & Record<`data-${string}`, string>) {
  // Under a shell of the app's own, which says the app however it likes, a page's title is its h1 again.
  const Tag = `h${context.titleLevel ?? (context.framed && !context.barAbove ? 1 : 2)}` as "h2";
  return (
    <Tag style={h1} data-graview-page-title="" {...rest}>
      {children}
    </Tag>
  );
}

/**
 * THE NAV'S FIND BOX. On a kind's list it narrows that list — `?q=` is the
 * list's own word — and anywhere else it goes to `/search`. Typing is an
 * adjustment of the page you are on, so each keystroke replaces the address
 * rather than piling up history; the first keystroke away from a list or
 * the search page is the one step Back undoes.
 *
 * Exported for a shell an app draws itself. `narrowsLists: false` is for an
 * app whose own list pages already carry a box for their words: then this
 * one always goes to `/search`, and a list never has two.
 *
 * Placed by a shell, it is THE face's Find box: the face's root sees it and
 * draws no second one above the shell (face-controls.tsx).
 */
export function PageFind<S extends AnySchema>({
  context,
  narrowsLists = true,
}: {
  context: PageContext<S>;
  narrowsLists?: boolean;
}) {
  usePlacedOnTheFace("find");
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const segments = location.pathname.split("/").filter(Boolean);
  const onList = narrowsLists && segments.length === 1 && kindOfSlug(context.store.schema, segments[0]!) !== undefined;
  const onSearch = location.pathname === "/search";
  const addressed = onList || onSearch ? (params.get("q") ?? "") : "";
  /*
   * "NARROW ALBUMS…" WHERE IT FITS, "NARROW…" WHERE IT DOES NOT. The box is
   * as wide as the bar can spare, and a placeholder cut at its edge
   * ("Narrow albu") says less than the short one: the words are measured
   * in the box's own face against the room inside it.
   */
  const narrowing = onList ? `Narrow ${pluralLabel(context.store.schema, kindOfSlug(context.store.schema, segments[0]!)!).toLowerCase()}…` : "";
  const [named, setNamed] = useState(true);
  useLayoutEffect(() => {
    const input = box.current;
    if (!input || !narrowing || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const style = getComputedStyle(input);
      const pen = document.createElement("canvas").getContext("2d");
      if (!pen) return;
      pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setNamed(pen.measureText(narrowing).width <= input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(input);
    return () => watch.disconnect();
  }, [narrowing]);
  const [typed, setTyped] = useState(addressed);
  /* ⌘K or Ctrl+K, from the keyboard anywhere in the app or on nothing at all: this box (FR-131). The scene's own Find hears its own. */
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const input = box.current;
      const root = input?.closest("[data-graview-embed]");
      const target = event.target;
      const nowhere = target === document.body || target === document.documentElement;
      if (!input || !(nowhere || !root || (target instanceof Node && root.contains(target)))) return;
      event.preventDefault();
      // A phone's bar keeps the box put away until it is asked for.
      input.closest<HTMLElement>("[data-graview-app-bar]")?.querySelector<HTMLButtonElement>('[data-testid="app-find-open"]')?.click();
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  /*
   * Back, a link, or the list's own row changed the words: the box follows
   * the address. But not its own words coming back: each keystroke writes the
   * address, and an address that caught up after the next key was taken for
   * a change and written over the box — a key typed quickly on a slow phone
   * was lost ("digital" searched as "dgtl"). Words the box handed over are
   * its own echo.
   */
  const handed = useRef(new Set<string>([addressed]));
  useEffect(() => {
    if (handed.current.has(addressed)) return;
    handed.current = new Set([addressed]);
    setTyped(addressed);
  }, [addressed]);
  const go = (words: string) => {
    setTyped(words);
    handed.current.add(words);
    if (onList) {
      const next = new URLSearchParams(params);
      if (words.trim()) next.set("q", words);
      else next.delete("q");
      setParams(next, { replace: true });
      return;
    }
    const to = words.trim() ? `/search?${new URLSearchParams({ q: words }).toString()}` : "/search";
    navigate(to, { replace: onSearch });
  };
  return (
    <form
      role="search"
      aria-label={onList ? "Narrow this list" : "Find anything"}
      style={{ display: "flex", minWidth: 0, flex: "1 1 auto" }}
      onSubmit={(event) => {
        event.preventDefault();
        // Enter from a list widens the look to everything the words find.
        if (onList && typed.trim()) navigate(`/search?${new URLSearchParams({ q: typed }).toString()}`);
      }}
    >
      <input
        ref={box}
        type="search"
        data-testid="nav-find"
        value={typed}
        onChange={(event) => go(event.target.value)}
        placeholder={onList ? (named ? narrowing : "Narrow…") : "Find…"}
        aria-keyshortcuts="Meta+K Control+K"
        aria-label={onList ? "Narrow this list" : "Find anything"}
        style={{
          width: "100%",
          minWidth: 0,
          height: 30,
          // Room at its end for the shortcut the bar says over it until it is used.
          padding: "0 var(--graview-bar-find-end, 10px) 0 10px",
          font: "inherit",
          fontSize: "0.875rem",
          color: "var(--graview-ink)",
          background: "var(--graview-ground)",
          border: "1px solid var(--graview-edge)",
          borderRadius: 8,
        }}
      />
    </form>
  );
}
