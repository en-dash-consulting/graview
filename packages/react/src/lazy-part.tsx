import { createContext, createElement, lazy, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode, type RefObject } from "react";

/**
 * A PART OF THE PAGE FETCHED WHEN IT IS FIRST DRAWN, THAT NEVER BREAKS THE
 * PAGE WHEN IT DOES NOT ARRIVE (FR-139).
 *
 * The person's menu, the problems' rows, the faces, the studio and the
 * views are each a chunk of their own, fetched as they are first drawn
 * (FR-57, FR-131). Drawn with `React.lazy`, one that failed to arrive — the
 * network away for a moment, a train, a tunnel — threw into the embed on
 * every draw from then on, and `React.lazy` keeps its failure as the
 * browser keeps the failed module: only a reload brought the menu back.
 *
 * A lazy module here is fetched by a loader that asks again after a failure
 * (`retryingImport` in `@graview/core/retry`, which defeats the browser's kept
 * failure with a URL of its own), and a part drawn from it never throws for
 * want of it. Until it is here, the place it goes says so in one line with
 * a "Try again" button; it is asked for again when the browser says it is
 * back online, when the part is drawn again, when somebody reaches for what
 * holds it (`prefetch`), and when "Try again" is pressed — which asks for
 * every part that failed, since one network was missing for all of them.
 *
 *   const panes = lazyModule(retryingImport(() => import("./panes.js")));
 *   const Menu = panes.part((module, props: MenuProps) => <module.Menu {...props} />, { what: "Your menu" });
 *
 * Drawn before its first attempt has settled, a part suspends, so the
 * nearest `<Suspense>` says what stands in for it meanwhile; drawn once the
 * module is here, it draws in that same commit, and stays the element it
 * was (a change of element would draw it again from nothing).
 */
export interface LazyModule<M> {
  /** The module, fetched now or joined on its way. Rejects when this attempt failed; the next call tries again. */
  load(): Promise<M>;
  /** Fetch it now if it is not here, and never reject: for a pointer over a button, or an idle moment. */
  prefetch(): void;
  /** The module once it is here. */
  readonly current: M | undefined;
  /** Whether the last attempt failed and none has succeeded since. */
  readonly failed: boolean;
  /** A component drawing what `draw` makes of the module, with the line in its place until it is here. */
  part<P extends object>(draw: (module: M, props: P) => ReactNode, options?: LazyPartOptions): ComponentType<P>;
}

export interface LazyPartOptions {
  /** What the part is, as the line says it: "Your menu", "This view". "This part" by default. */
  readonly what?: string;
  /**
   * Draw nothing in its place while it is missing: for a second part of a
   * place that already says so once (the rest of a menu whose top said it).
   * It is still asked for again, all the same ways.
   */
  readonly quiet?: boolean;
  /** The line's element, where the part's place wants one: `li` inside a list. A paragraph by default. */
  readonly as?: "p" | "li" | "div";
}

/** Every module whose last attempt failed: asked for again together. */
const failing = new Set<() => void>();

/*
 * WHAT IS DRAWN AND STILL ON ITS WAY (FR-188). A part drawn before its
 * module is here suspends, and the page around it looks finished while the
 * part's place stands empty; a host picturing the place needs to know there
 * is more to come. Counted from the moment a drawn part asks for its module
 * to the moment the module arrives or does not — never a fetch nobody drew
 * (a prefetch, the other face fetched while idle).
 */
let onTheirWay = 0;

/** The loader of something drawn as it is first needed, counted while it is on its way (`partsArriving`). */
export function partArriving<T>(load: () => Promise<T>): () => Promise<T> {
  return () => {
    onTheirWay += 1;
    const going = load();
    going.then(
      () => void (onTheirWay -= 1),
      () => void (onTheirWay -= 1),
    );
    return going;
  };
}

/** How many parts are drawn and still on their way: none once every drawn part has arrived, or said it did not. */
export const partsArriving = (): number => onTheirWay;

/*
 * A PART IS ON ITS WAY UNTIL IT HAS DRAWN, NOT UNTIL ITS MODULE ARRIVED.
 * A part that suspended is revealed by React in a commit of its own, and
 * React holds that commit back for up to 300 ms after the place's other
 * content first drew, so its fallback does not flash: the module was here,
 * `partsArriving` said nothing was on its way, the page did not move for a
 * moment, and a declared lens's place was said drawn — and photographed by
 * `graview shots` — with its title and nothing under it. What watches a
 * place settle (`data-graview-drawn`) hands its parts a `PartsWatch`; each
 * part that suspends under it is waited for until it has drawn (or said it
 * did not arrive) there.
 */
/** What a watched place waits for: each part drawn in it that suspended and has not drawn since, stamped with the watch's `at` when it suspended. */
export interface PartsWatch {
  readonly waiting: Map<object, number>;
  /** How many times the watch has begun again on another place. */
  at: number;
}

/** The watch the parts drawn here are waited for under, or none where nothing watches the place settle. */
export const PartsWatchContext = createContext<PartsWatch | null>(null);

/** A watch for one embed's places, begun again (`partsWatchMoved`) each time the place it watches moves. */
export function createPartsWatch(): PartsWatch {
  return { waiting: new Map(), at: 0 };
}

/**
 * The watch begins again on another place: a part that waited on a place
 * left behind and has not suspended again since is waited for no longer,
 * since the boundary it would have drawn in may be gone. Called once the
 * new place has committed, so what it suspended is stamped with the
 * watch's present and kept.
 */
export function partsWatchMoved(watch: PartsWatch): void {
  for (const [part, at] of watch.waiting) if (at < watch.at) watch.waiting.delete(part);
  watch.at += 1;
}

/** How many parts drawn under `watch` suspended and have not drawn since. */
export const partsWaiting = (watch: PartsWatch | null | undefined): number => watch?.waiting.size ?? 0;

/** Said as a part suspends under a watch. */
function waitingFor(watch: PartsWatch | null, part: object): void {
  watch?.waiting.set(part, watch.at);
}

/** Said in the commit a part draws in, under the watch it is drawn under. */
function useDrawnPart(part: object): void {
  const watch = useContext(PartsWatchContext);
  useLayoutEffect(() => {
    watch?.waiting.delete(part);
  }, [watch, part]);
}

/**
 * `React.lazy` over a component's module, waited for by the watch it is
 * drawn under until it has drawn (`PartsWatch`), as a lazy module's part
 * is. Its failure is React.lazy's — thrown to the nearest error boundary —
 * and is then waited for no longer.
 */
export function lazyPart<C extends (props: never) => ReactNode>(load: () => Promise<{ readonly default: C }>): C {
  type P = object;
  const part = {};
  let here = false;
  const watches = new Set<PartsWatch>();
  const Lazy = lazy(
    partArriving(() =>
      load().then(
        (module) => {
          here = true;
          const Inner = module.default as unknown as ComponentType<P>;
          function Arrived(props: P) {
            useDrawnPart(part);
            return createElement(Inner, props);
          }
          return { default: Arrived };
        },
        (error: unknown) => {
          for (const watch of watches) watch.waiting.delete(part);
          throw error;
        },
      ),
    ),
  ) as unknown as ComponentType<P>;
  function Part(props: P) {
    const watch = useContext(PartsWatchContext);
    if (!here && watch) {
      watches.add(watch);
      waitingFor(watch, part);
    }
    return createElement(Lazy, props);
  }
  return Part as unknown as C;
}

/*
 * WHAT IS FETCHED EARLY WAITS FOR THE FIRST DRAW (FR-194). A part fetched
 * before it is wanted — the acts' pane when the page is idle, a date's
 * editor, the other face — was asked for while the place was still
 * drawing, on a phone's network beside the parts the place waited for.
 * Where an embed watches its place settle (`data-graview-drawn`), they wait
 * until it first has; where nothing watches, at once.
 */
let watched = false;
let drawnOnce = false;
const afterDrawn = new Set<() => void>();
/** Said by what watches a place settle: from now, an early fetch waits for the first draw. */
export function placeWatched(): void {
  watched = true;
}
/** Said once the place has drawn and settled: every early fetch waiting goes. */
export function placeDrawn(): void {
  drawnOnce = true;
  for (const run of [...afterDrawn]) run();
  afterDrawn.clear();
}
/** Whether the first draw is behind us, or nothing watches for it. */
export const firstDrawn = (): boolean => drawnOnce || !watched;
/** Run `then` once the first draw is behind us (at once if it is); the answer forgets it. */
export function afterFirstDraw(then: () => void): () => void {
  if (firstDrawn()) {
    then();
    return () => undefined;
  }
  afterDrawn.add(then);
  return () => void afterDrawn.delete(then);
}
let listening = false;

/** Ask again for every part that failed to arrive: what "Try again" and the browser's `online` do. */
export function retryLazyParts(): void {
  for (const again of [...failing]) again();
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("online", retryLazyParts);
}

/** A module behind a loader, with what has become of it; see `LazyModule`. */
export function lazyModule<M>(load: () => Promise<M>): LazyModule<M> {
  let current: M | undefined;
  let arrived = false;
  let failed = false;
  let pending: Promise<M> | undefined;
  let version = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  const snapshot = () => version;
  const again = () => void attempt().catch(() => undefined);

  function attempt(): Promise<M> {
    if (arrived) return Promise.resolve(current as M);
    if (pending) return pending;
    const going = load().then(
      (module) => {
        current = module;
        arrived = true;
        failed = false;
        pending = undefined;
        failing.delete(again);
        notify();
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        failed = true;
        failing.add(again);
        listen();
        notify();
        throw error;
      },
    );
    // Handled here, so an attempt nobody waits on is never an unhandled rejection (a page error).
    going.catch(() => undefined);
    pending = going;
    return going;
  }

  return {
    load: attempt,
    prefetch: again,
    get current() {
      return current;
    },
    get failed() {
      return failed;
    },
    part<P extends object>(draw: (module: M, props: P) => ReactNode, options: LazyPartOptions = {}): ComponentType<P> {
      const what = options.what ?? "This part";
      // This part, as the watch of the place it is drawn on waits for it.
      const part = {};
      function Settled(props: P) {
        useSyncExternalStore(subscribe, snapshot, snapshot);
        // Drawn, or its line drawn in its place: the place waits for it no longer.
        useDrawnPart(part);
        const button = useRef<HTMLButtonElement>(null);
        const sentinel = useRef<HTMLSpanElement>(null);
        const keyboardWasHere = useRef(false);
        // Drawn again after it failed: ask again.
        useEffect(() => {
          if (failed && pending === undefined) again();
        }, []);
        /*
         * THE KEYBOARD, WHERE THE LINE WAS. The part arriving takes the
         * line and its button away; had the keyboard been on the button, it
         * would land on <body>. Read before the commit that removes it, and
         * put on the first control the part drew.
         */
        if (arrived && typeof document !== "undefined" && button.current !== null && document.activeElement === button.current) keyboardWasHere.current = true;
        useLayoutEffect(() => {
          if (!arrived || !keyboardWasHere.current) return;
          keyboardWasHere.current = false;
          for (let at = sentinel.current?.nextElementSibling ?? null; at !== null; at = at.nextElementSibling) {
            const target = at.matches(FOCUSABLE) ? at : at.querySelector(FOCUSABLE);
            if (target instanceof HTMLElement) {
              target.focus();
              return;
            }
          }
        });
        if (arrived) {
          return (
            <>
              {keyboardWasHere.current ? <span ref={sentinel} hidden /> : null}
              {draw(current as M, props)}
            </>
          );
        }
        return options.quiet ? null : <PartMissing what={what} button={button} {...(options.as ? { as: options.as } : {})} />;
      }
      // The first attempt suspends; it never rejects into React, so nothing is thrown at the page.
      const First = lazy(partArriving(() => attempt().then(
        () => ({ default: Settled }),
        () => ({ default: Settled }),
      )));
      function Part(props: P) {
        const watch = useContext(PartsWatchContext);
        const [settled] = useState(() => arrived || failed);
        // Suspending: waited for until it draws here, in a commit React may hold back.
        if (!arrived && !failed) waitingFor(watch, part);
        return createElement(settled ? Settled : (First as unknown as ComponentType<P>), props);
      }
      return Part;
    },
  };
}

const FOCUSABLE = "button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])";

/**
 * THE ONE LINE IN A MISSING PART'S PLACE: what did not arrive, and a real
 * button that asks again. Its words a status, so a screen reader hears them
 * politely; the button stays put while it asks, so the keyboard stays on it.
 */
function PartMissing({ what, button, as: Line = "p" }: { readonly what: string; readonly button: RefObject<HTMLButtonElement | null>; readonly as?: "p" | "li" | "div" }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const said = offline ? `${what} will load when you're back online.` : `${what} didn't load.`;
  return (
    <Line
      data-testid="lazy-part-missing"
      style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}
    >
      <span role="status">{said}</span>{" "}
      <button
        ref={button}
        type="button"
        data-testid="lazy-part-retry"
        onClick={retryLazyParts}
        style={{ font: "inherit", fontWeight: 600, color: "var(--graview-ink)", background: "none", border: "1px solid var(--graview-edge)", borderRadius: 6, padding: "2px 10px" }}
      >
        Try again
      </button>
    </Line>
  );
}
