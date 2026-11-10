import { LOCAL_LAYERS, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { toolStyle } from "@graview/primitives/pages";
import { lazyPart } from "@graview/react/provider";
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useHref, useLocation } from "react-router";
import { useStoreTick, type PageContext } from "./page-context.js";
import { liveKinds, pluralOf } from "./page-typography.js";
import { kindOfSlug } from "./registry.js";
import { pageBox, setBack } from "./step-back-geometry.js";

/**
 * STEPPING BACK FROM THE PAGE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Nick: "almost like a slider … that slides from viewing this page, into
 * viewing the page, but I just backed up 20 steps and a few to the left,
 * and now I can see the cityscape of data behind the page, with some
 * lightweight connected pipe/line things that show where on the page it's
 * related to connected datas."
 *
 * Two states, for now. In, the page is the page. Out, the page under the bar
 * is the same page, still drawn, scaled down as one plane and moved up and to
 * the left, and the app's city — the scene's own map of the data — stands
 * in the room it leaves, with a line from each part of the page that shows a
 * record to that record's building. Back in, the page is where it was: the
 * scroll, the keyboard and the address.
 *
 * This is not the scene and the pages trading places (the bar's app menu,
 * the scene's altitude): the page never leaves. The city is fetched when a
 * person first steps back (`city-behind.tsx`), so a page that is only read
 * carries none of it.
 *
 * THE SEAM FOR DRAWING THE PAGE INTO THE CITY. Today the page is DOM over
 * the city, a CSS transform on one element, in every engine. Where a browser
 * can draw a live element into a canvas (WICG HTML-in-canvas, now in
 * Chrome's spec), the stepped-back page could be drawn INTO the city's own
 * picture — lit, set on the ground and passed behind with it — and the
 * element to draw is this one sheet (`[data-graview-step-back]`), whole,
 * with nothing of the page moved out of it. That capture is
 * the render package's to make (`platform/html-in-canvas.ts`, the one module
 * every call into that API passes through), and this face reaches no part
 * of it (a-page-draws-with-what-it-needs): a city drawn that way is a
 * second `CityBehind`, fetched from there, with this sheet handed to it.
 */

/** In, stepping back, stepped back, or coming back in. */
export type StepBackPhase = "in" | "leaving" | "out" | "returning";

interface StepBackValue {
  readonly phase: StepBackPhase;
  readonly toggle: () => void;
  readonly control: React.RefObject<HTMLButtonElement | null>;
}

const StepBackContext = createContext<StepBackValue | null>(null);

/** The city behind the page, behind its door: fetched the first time a person steps back. */
const CityBehind = lazyPart(retryingImport(() => import("./city-behind.js").then((module) => ({ default: module.CityBehind }))));

/** How long the step takes, each way. A person who asked for less motion is shown where it ends, with no travel. */
const TRAVEL_MS = 420;
const lessMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the person was when they stepped back: what comes back with them. */
interface Kept {
  readonly scrollX: number;
  readonly scrollY: number;
  /** The page's own focused element, when the keyboard was on the page: the stepped-back page is not where the keyboard can be. */
  readonly focus: HTMLElement | null;
  /** The address they stepped back from: a different one on the way in means they went somewhere, and nothing is put back. */
  readonly address: string;
}

/**
 * THE FRAME: the bar, untouched, and under it the page in a sheet that is
 * nothing at all while the page is in (`display: contents`, so the shell's
 * layout is the shell's) and a fixed plane while it is out. The same
 * elements either way — stepping back mounts nothing in the page and
 * unmounts nothing, so a half-typed field and an open group stay as they are.
 */
export function StepBackFrame<S extends AnySchema>({ context, bar, children }: { readonly context: PageContext<S>; readonly bar: ReactNode; readonly children: ReactNode }) {
  const offered = !context.embedded;
  const [phase, setPhase] = useState<StepBackPhase>("in");
  // The region under the bar, in the window, measured as the person steps back; and how far up the page had been scrolled in it.
  const [region, setRegion] = useState<{ readonly top: number; readonly shift: number; readonly width: number; readonly height: number } | null>(null);
  const [settled, setSettled] = useState(false);
  const kept = useRef<Kept | null>(null);
  const control = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const address = `${location.pathname}${location.search}${location.hash}`;
  const base = useHref("/").replace(/\/$/, "");
  const tick = useStoreTick(context.store);

  const toggle = useCallback(() => {
    if (phase === "in") {
      const first = inner.current?.firstElementChild;
      const top = first ? first.getBoundingClientRect().top : 0;
      const active = document.activeElement;
      const onPage = active instanceof HTMLElement && inner.current?.contains(active) ? active : null;
      kept.current = { scrollX: window.scrollX, scrollY: window.scrollY, focus: onPage, address };
      // The bar's foot, in the document: where the region under it begins once the page stands still.
      setRegion({ top: Math.max(0, top + window.scrollY), shift: Math.min(0, top), width: window.innerWidth, height: window.innerHeight });
      setSettled(false);
      setPhase(lessMotion() ? "out" : "leaving");
      return;
    }
    if (phase === "out" || phase === "leaving") {
      setSettled(false);
      setPhase(lessMotion() ? "in" : "returning");
    }
  }, [phase, address]);

  /* STEPPING BACK: the page stands still where it was seen, then recedes — one frame later, so the travel is drawn from where it stood. */
  useLayoutEffect(() => {
    if (phase !== "leaving") return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("out")));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  /* The keyboard was on the page, which cannot hold it stepped back: it goes to the control that brings the page back. */
  useLayoutEffect(() => {
    if (phase === "in") return;
    if (kept.current?.focus && document.activeElement !== control.current) control.current?.focus({ preventScroll: true });
  }, [phase]);

  /* At rest, out: the lines are drawn from where the page's parts stand now, so they wait for the step to end. */
  useEffect(() => {
    if (phase !== "out") return;
    if (lessMotion()) {
      setSettled(true);
      return;
    }
    const element = sheet.current;
    const done = () => setSettled(true);
    element?.addEventListener("transitionend", done, { once: true });
    const timer = setTimeout(done, TRAVEL_MS + 120);
    return () => {
      element?.removeEventListener("transitionend", done);
      clearTimeout(timer);
    };
  }, [phase]);

  /* COMING BACK IN: the travel back, then the page is the page again. */
  useEffect(() => {
    if (phase !== "returning") return;
    const element = sheet.current;
    const done = () => setPhase("in");
    element?.addEventListener("transitionend", done, { once: true });
    const timer = setTimeout(done, TRAVEL_MS + 120);
    return () => {
      element?.removeEventListener("transitionend", done);
      clearTimeout(timer);
    };
  }, [phase]);

  /* IN AGAIN: where they were — the scroll, then the keyboard — unless the address moved meanwhile, which is a new page. */
  useLayoutEffect(() => {
    if (phase !== "in" || !kept.current) return;
    const was = kept.current;
    kept.current = null;
    setRegion(null);
    if (was.address !== address) return;
    window.scrollTo({ left: was.scrollX, top: was.scrollY, behavior: "instant" as ScrollBehavior });
    if (was.focus?.isConnected) was.focus.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* Going somewhere while stepped back (Back, a link the bar holds): the new page opens in, as a page does. */
  const at = useRef(address);
  useEffect(() => {
    if (at.current === address) return;
    at.current = address;
    if (phase !== "in") {
      setSettled(false);
      setPhase("in");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  /* Escape steps back in, and so does pressing the page; a window resized while out is measured again. */
  useEffect(() => {
    if (phase === "in") return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      event.preventDefault();
      toggle();
    };
    const resized = () => setRegion((was) => (was ? { ...was, width: window.innerWidth, height: window.innerHeight } : was));
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resized);
    return () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resized);
    };
  }, [phase, toggle]);

  const away = phase !== "in" && region !== null;
  const room = region ? { width: region.width, height: Math.max(0, region.height - region.top) } : { width: 0, height: 0 };
  const back = setBack(room);
  const receded = phase === "out";
  const travel = lessMotion() ? "none" : `transform ${TRAVEL_MS}ms cubic-bezier(.2,.7,.2,1)`;
  const sheetStyle: CSSProperties = away
    ? {
        position: "fixed",
        left: 0,
        top: region.top,
        width: room.width,
        height: room.height,
        overflow: "hidden",
        zIndex: LOCAL_LAYERS.raised,
        background: "var(--graview-ground)",
        transformOrigin: "0 0",
        transform: receded ? `translate(${back.x}px, ${back.y}px) scale(${back.scale})` : "none",
        transition: travel,
        // The page's own edge, as a sheet standing over the ground has one; at its size the line is a pixel and a half.
        outline: receded ? "2px solid var(--graview-edge)" : "none",
        boxShadow: receded ? "var(--graview-lift-high, 0 24px 60px rgba(0,0,0,0.18))" : "none",
        cursor: receded ? "zoom-in" : undefined,
      }
    : { display: "contents" };
  const innerStyle: CSSProperties = away ? { display: "flex", flexDirection: "column", minHeight: room.height, marginTop: region.shift, pointerEvents: "none" } : { display: "contents" };

  const value = { phase, toggle, control };
  /* What the city draws by, read here so the city's own module brings nothing of this face's with it; and where it stands, kept while the window does. */
  const seen = useMemo(() => (away ? seenBy(context, base) : null), [away, context, base, tick]);
  const top = region?.top ?? 0;
  const cityRegion = useMemo(() => ({ x: 0, y: top, width: room.width, height: room.height }), [top, room.width, room.height]);
  const cityPage = useMemo(() => pageBox({ width: room.width, height: room.height }), [room.width, room.height]);
  return (
    <StepBackContext.Provider value={offered ? value : null}>
      {bar}
      {away ? (
        <Suspense fallback={null}>
          <CityBehind
            context={context as unknown as PageContext<AnySchema>}
            seen={seen!}
            tick={tick}
            subject={seen!.recordAt(`${base}${location.pathname}`)}
            region={cityRegion}
            page={cityPage}
            sheet={sheet}
            shown={receded}
            settled={settled && receded}
          />
        </Suspense>
      ) : null}
      <div
        ref={sheet}
        data-graview-step-back={phase}
        style={sheetStyle}
        {...(receded ? { onClick: () => toggle(), title: "Back to the page" } : {})}
      >
        <div ref={inner} style={innerStyle} {...(away ? { inert: true } : {})}>
          {children}
        </div>
      </div>
    </StepBackContext.Provider>
  );
}

/** The kinds this seat sees, what each is called, and the record an address is: what the city behind the page draws by. */
function seenBy<S extends AnySchema>(context: PageContext<S>, base: string) {
  const { store } = context;
  const kinds = liveKinds(store, context.principal);
  return {
    kinds,
    plurals: Object.fromEntries(kinds.map((kind) => [kind, pluralOf(store, kind)])),
    recordAt: (pathname: string): string | null => {
      const path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
      const segments = path.split("/").filter(Boolean);
      const kind = segments.length === 2 ? kindOfSlug(store.schema, segments[0]!) : undefined;
      if (!kind) return null;
      let id: string;
      try {
        id = decodeURIComponent(segments[1]!);
      } catch {
        return null;
      }
      return store.graph.getNode(id)?.kind === kind ? id : null;
    },
  };
}

/**
 * THE CONTROL: one press out, one press in, a toggle a screen reader hears
 * as pressed or not. In the bar, which does not step back, so it is where it
 * was either way. Draws nothing outside a frame that offers it (an embed's
 * face, whose page is the host's).
 */
export function StepBackControl() {
  const step = useContext(StepBackContext);
  if (!step) return null;
  const out = step.phase === "out" || step.phase === "leaving";
  const label = out ? "Back to the page" : "Step back to the city";
  return (
    <button
      ref={step.control}
      type="button"
      data-testid="step-back"
      aria-pressed={out}
      aria-label={label}
      title={label}
      onClick={step.toggle}
      style={{
        ...toolStyle,
        ...(out ? { color: "var(--graview-ink)", background: "var(--graview-panel-muted)", border: "1px solid var(--graview-edge)" } : {}),
      }}
    >
      <CityMark out={out} />
    </button>
  );
}

/** Its mark: a page in front of three blocks on the ground — the page smaller and to the left once it has stepped back. */
function CityMark({ out }: { readonly out: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M9 9.5l4-2 4 2-4 2z M13 11.5v3.5l4-2v-3.5" opacity={out ? 1 : 0.55} />
      <path d="M5 12.5l3-1.5 3 1.5-3 1.5z M8 14v2.5l3-1.5v-2.5" opacity={out ? 1 : 0.55} />
      {out ? <rect x="1" y="1" width="7" height="6" rx="0.8" /> : <rect x="1" y="1" width="11" height="9" rx="1" />}
    </svg>
  );
}
