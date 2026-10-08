import { createElement, lazy, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode, type RefObject } from "react";

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
      function Settled(props: P) {
        useSyncExternalStore(subscribe, snapshot, snapshot);
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
      const First = lazy(() => attempt().then(
        () => ({ default: Settled }),
        () => ({ default: Settled }),
      ));
      function Part(props: P) {
        const [settled] = useState(() => arrived || failed);
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
