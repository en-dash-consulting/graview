import { layer, type AnySchema } from "@graview/core";
import { FOOT_MOVED, freshChangeOf, lastChangeOf, placeAtTheFoot, takeBackLast, takeBackWords, WAY_BACK_MS } from "@graview/primitives/pages";
import { inTopLayer } from "@graview/react/provider";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PageContext } from "./page-context.js";
import { useStoreTick } from "./page-context.js";

/*
 * THE WAY BACK ITSELF, fetched once there is something it could offer: an
 * act since the face was drawn, or — placed in a shell's own row — any
 * change at all (`PageUndo`, face-controls.tsx). A face nobody changes
 * carries none of it.
 */

/** Where the keyboard goes when the control it pressed is gone: the page's heading, where the change shows. */
function landOnThePage(face: Element | null) {
  const active = document.activeElement;
  if (active !== null && active !== document.body && active !== document.documentElement && active.isConnected) return;
  const root = face ?? document;
  const main = root.querySelector("main") ?? root.querySelector("[data-graview-page]") ?? null;
  const target = root.querySelector<HTMLElement>("[data-graview-page-title]") ?? main?.querySelector<HTMLElement>("h1, h2") ?? main;
  if (!(target instanceof HTMLElement)) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

/** An offer that came with an act: the batch it takes back, the page it came on, and when. */
interface Offer {
  readonly batch: string;
  readonly at: string;
  readonly when: number;
}

/** A move this soon after an act is the act's own (a record made, and opened): its offer goes with it. */
const THE_ACTS_OWN_MOVE_MS = 1500;

function useTakeBack<S extends AnySchema>(context: PageContext<S>, at: string, since: number) {
  const { store, principal } = context;
  const tick = useStoreTick(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const change = useMemo(() => lastChangeOf(store, principal), [store, principal, tick]);
  /*
   * THE OFFER LEAVES (FR-152). It stood for the rest of the session, so
   * every page carried a stale "Take back". It comes with an act made here,
   * and goes with the next, with a move to another page, with its ×, or
   * after `WAY_BACK_MS` — ⌘Z, and the scene's Activity, still take it back.
   */
  // What the log held when the face was drawn: what was done before is no act to offer back.
  const seen = useRef(since);
  const [offer, setOffer] = useState<Offer | undefined>();
  useEffect(() => {
    const now = freshChangeOf(store, principal, seen.current);
    seen.current = store.batches().length;
    if (now) setOffer({ batch: now.batch, at, when: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, principal, tick]);
  useEffect(() => {
    setOffer((one) => (!one || one.at === at ? one : Date.now() - one.when < THE_ACTS_OWN_MOVE_MS ? { ...one, at } : undefined));
  }, [at]);
  const [refused, setRefused] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const close = useCallback(() => {
    setOffer(undefined);
    setRefused(null);
  }, []);
  const takeBack = useCallback(() => {
    setRefused(null);
    try {
      const taken = takeBackLast(store, principal);
      if (taken) setSaid(`Took back “${taken.intent}”`);
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
  }, [store, principal]);
  const offered = change && offer?.batch === change.batch && offer.at === at ? change : undefined;
  return { change, offered, close, takeBack, refused, said };
}

/**
 * THE WAY BACK, on the routed face: one control that says what it takes
 * back — "Take back “Rename to …”" — and takes it back as the person at the
 * keyboard, judged by the policy like any change.
 *
 * Exported for a shell that wants it somewhere of its own, where it stands
 * while there is a change to take back; a shell that does not place it gets
 * it anyway, floating over the face at its foot like a notice (FR-133), for
 * as long as a notice stands (FR-152).
/** The way back: docked, a notice over the face; placed, a control in a shell's row. `since` is how many batches the log held when the face was drawn. */
export function TakeBack<S extends AnySchema>({ context, docked, at, since }: { readonly context: PageContext<S>; readonly docked: boolean; readonly at: string; readonly since: number }) {
  const { change: last, offered, close, takeBack, refused, said } = useTakeBack(context, at, since);
  // Docked, it is a notice: only the offer an act brought. Placed in a shell's row, it is a control: whatever can be taken back.
  const change = docked ? offered : last;
  const dock = useRef<HTMLDivElement | null>(null);
  const shown = docked && (change !== undefined || refused !== null);
  useFloatingDock(dock, shown);
  /* Its time come while a pointer or the keyboard is on it, it stands its whole time again: it never goes from under either. */
  useEffect(() => {
    if (!shown) return;
    let going: ReturnType<typeof setTimeout>;
    const wait = () => (going = setTimeout(() => (dock.current?.matches(":hover, :has(:focus-visible)") ? wait() : close()), WAY_BACK_MS));
    wait();
    return () => clearTimeout(going);
  }, [shown, change?.batch, refused, close]);
  // What can be taken back, said politely as it comes (FR-133); what was taken back, once it is.
  const heard = said || (docked && change ? takeBackWords(change) : "");
  const corner: React.CSSProperties = docked
    ? {
        /*
         * A NOTICE, OVER THE FACE (FR-133): in the top layer, at the foot of
         * the picture it is about, and in no row of the page — sticky, it
         * opened a band of its own under an embed's strip and pushed the
         * page down. Placed by `placeAtTheFoot`: the middle on a phone, the
         * left on a desk, above the Ask.
         */
        position: "fixed",
        inset: "auto",
        margin: 0,
        padding: 0,
        border: "none",
        background: "none",
        overflow: "visible",
        zIndex: layer("toast"),
        width: "max-content",
        // Under the popover's `fit-content`, WebKit stands a grid as tall as the screen.
        height: "auto",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        left: 16,
        justifyItems: "start",
        color: "var(--graview-ink)",
        ...(shown ? {} : { display: "none" }),
      }
    : {};
  const control = change ? (
    <button
      type="button"
      data-testid="page-undo"
      title={`${takeBackWords(change)} — ⌘Z or Ctrl+Z`}
      aria-keyshortcuts="Meta+Z Control+Z"
      onClick={(event) => {
        const face = event.currentTarget.closest("[data-graview-face]");
        takeBack();
        // After the face has drawn the change gone: if this control went with it, the keyboard lands on the page.
        requestAnimationFrame(() => landOnThePage(face));
      }}
      style={docked ? DOCKED : PLACED}
    >
      <span aria-hidden="true">↶</span>
      <span style={docked ? WRAPPED : ONE_LINE}>{takeBackWords(change)}</span>
    </button>
  ) : null;
  return (
    <>
      {/* What can be taken back, and what was: said once to a screen reader, from outside the dock, which goes when there is nothing to take back. */}
      <span role="status" aria-live="polite" style={visuallyHidden}>
        {heard}
      </span>
      <div
        ref={dock}
        {...(docked ? { popover: "manual", "data-graview-foot": "", "data-graview-offstage": "" } : {})}
        data-testid={docked ? "face-undo-dock" : "page-undo-place"}
        style={{
          display: "grid",
          justifyItems: "end",
          gap: 4,
          maxWidth: "100%",
          minWidth: 0,
          ...corner,
        }}
      >
        {docked && change ? (
          /* The notice's own panel: the way back, and the × that closes it (FR-152). */
          <div data-testid="page-undo-notice" style={PANEL}>
            {control}
            <button
              type="button"
              data-testid="page-undo-dismiss"
              aria-label={`Dismiss: ${takeBackWords(change)}`}
              title="Dismiss"
              onClick={(event) => {
                const face = event.currentTarget.closest("[data-graview-face]");
                close();
                requestAnimationFrame(() => landOnThePage(face));
              }}
              style={DISMISS}
            >
              ×
            </button>
          </div>
        ) : (
          control
        )}
        {refused ? (
          <span
            data-testid="page-undo-refused"
            role="alert"
            style={{
              fontSize: "0.8125rem",
              lineHeight: 1.4,
              color: "var(--graview-warn)",
              background: docked ? "var(--graview-float)" : undefined,
              padding: docked ? "4px 8px" : undefined,
              borderRadius: 6,
            }}
          >
            {refused}
          </span>
        ) : null}
      </div>
    </>
  );
}

/**
 * The docked way back in the top layer, placed at the foot of the picture
 * it is about — an embed's content, or the screen — and placed again as
 * the screen scrolls or resizes, or its sentence changes. Says so to a
 * notice that stands above it.
 */
function useFloatingDock(dock: RefObject<HTMLDivElement | null>, shown: boolean) {
  useLayoutEffect(() => {
    const element = dock.current;
    if (!element || !shown) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over every rail where the top layer is not there.
      }
    }
    const anchor = () => element.parentElement?.closest<HTMLElement>("[data-embed-content]") ?? null;
    const place = () => {
      placeAtTheFoot(element, anchor());
      dispatchEvent(new Event(FOOT_MOVED));
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(element);
    return () => {
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      if (element.isConnected && inTopLayer(element)) {
        try {
          element.hidePopover();
        } catch {
          // Gone already.
        }
      }
      dispatchEvent(new Event(FOOT_MOVED));
    };
  }, [dock, shown]);
}

const PLACED: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 36,
  maxWidth: "100%",
  minWidth: 0,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  color: "var(--graview-ink)",
  font: "inherit",
  fontSize: "0.875rem",
  cursor: "pointer",
};

/** Docked, it is a notice: the floating panel's look, a quiet corner rather than a capsule (FR-117). */
const DOCKED: React.CSSProperties = {
  ...PLACED,
  textAlign: "start",
  lineHeight: 1.4,
  padding: "8px 4px 8px 14px",
  border: "none",
  background: "none",
  color: "inherit",
};

/** The notice the docked way back stands in: the way back, and its ×. */
const PANEL: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  maxWidth: "100%",
  minWidth: 0,
  paddingRight: 6,
  borderRadius: "var(--graview-radius, 12px)",
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  boxShadow: "var(--graview-lift-high)",
};

/** As a notice's ×: a glyph, no box. */
const DISMISS: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 28,
  minHeight: 28,
  padding: 0,
  border: "none",
  background: "none",
  boxShadow: "none",
  color: "var(--graview-ink-muted)",
  font: "inherit",
  fontSize: "1rem",
  cursor: "pointer",
};

const ONE_LINE: React.CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** Wrapped, not cut: four lines before anything is (FR-118), and what is cut is still whole in the button's name and title. */
const WRAPPED: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  overflowWrap: "anywhere",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4,
};

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
