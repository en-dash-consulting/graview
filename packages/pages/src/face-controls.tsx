import { layer, type AnySchema, type Principal, type Store } from "@graview/core";
import { FOOT_MOVED, placeAtTheFoot } from "@graview/primitives/pages";
import { inTopLayer } from "@graview/react/provider";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useBarFind } from "@graview/primitives/pages";
import type { PageContext } from "./page-context.js";
import { useStoreTick } from "./page-context.js";
import { kindOfSlug, type PageRegistry } from "./registry.js";
import { PageFind } from "./page-shell.js";
import { createPlaced, FaceControls, usePlaced, usePlacedOnTheFace, type FaceControl, type Placed } from "./face-placed.js";

/**
 * WHAT THE ROUTED FACE OFFERS WHICHEVER SHELL DRAWS IT.
 *
 * Finding a record by part of its name and taking the last change back are
 * core jobs, not chrome a design may happen to remember. The Find box lived
 * in the derived shell only, so an app that replaced the shell — every
 * example does — had Find exactly when its author thought to put
 * `<PageFind>` in, and rota had none. Undo lived nowhere on this face at
 * all: the scene's Activity rail takes a turn back, and on the pages a
 * person who renamed the wrong record could not.
 *
 * So the face's root owns both. A shell that places `<PageFind>` or
 * `<PageUndo>` itself says where they go, and the root sees them placed and
 * draws nothing more; a shell that places neither still gets them — Find in
 * a bar above it, the way back in a dock at the corner. Only a registry that
 * says so (`surface("shell", Shell, { without: ["find"] })`) goes without.
 */
export type { FaceControl } from "./face-placed.js";

/* ------------------------------------------------------------------ */
/* The last change                                                     */
/* ------------------------------------------------------------------ */

export interface LastChange {
  readonly batch: string;
  /** What it did, in the store's own words — the line the Activity rail shows. */
  readonly intent: string;
}

/**
 * The change this person can take back: their own latest turn that is not
 * already taken back, is not itself a take-back, that the log lets go of on
 * its own, and that the policy lets them take back — undo is judged like a
 * change ("what you may undo is what you may have done"), so a turn the
 * store would refuse is never offered.
 *
 * "Their own" is the rule the Activity rail uses for "you": a human author
 * who is this principal, or either side has no id to tell them apart. On a
 * served store two seats share one log, and one person's corner should not
 * offer to take back another's work.
 */
export function lastChangeOf<S extends AnySchema>(store: Store<S>, principal?: Principal): LastChange | undefined {
  const batches = store.batches();
  for (let at = batches.length - 1; at >= 0; at--) {
    const batch = batches[at]!;
    if (batch.undone || batch.ops.length === 0) continue;
    if (batch.ops.every((op) => op.undoes !== undefined)) continue;
    const author = batch.author;
    const mine = author.kind === "human" && (principal?.id === undefined || author.id === undefined || author.id === principal.id);
    if (!mine) continue;
    const check = store.canUndo(batch.id);
    if (!check.ok) continue;
    const permitted = check.ops.every((op) => !op.mutation || store.permits(op.mutation, principal).ok);
    if (!permitted) continue;
    return { batch: batch.id, intent: batch.intent };
  }
  return undefined;
}

/** "Take back “Rename to …”" — the words on the control and in the announcement. */
export const takeBackWords = (change: LastChange) => `Take back “${change.intent}”`;

const editable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));

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

function useTakeBack<S extends AnySchema>(context: PageContext<S>) {
  const { store, principal } = context;
  const tick = useStoreTick(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const change = useMemo(() => lastChangeOf(store, principal), [store, principal, tick]);
  const [refused, setRefused] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const takeBack = useCallback(() => {
    const now = lastChangeOf(store, principal);
    if (!now) return false;
    setRefused(null);
    try {
      store.undo(now.batch, principal ? { author: principal } : {});
      setSaid(`Took back “${now.intent}”`);
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
    return true;
  }, [store, principal]);
  return { change, takeBack, refused, said };
}

/**
 * THE WAY BACK, on the routed face: one control that says what it takes
 * back — "Take back “Rename to …”" — and takes it back as the person at the
 * keyboard, judged by the policy like any change.
 *
 * Exported for a shell that wants it somewhere of its own; a shell that
 * does not place it gets it anyway, floating over the face at its foot
 * like a notice (FR-133).
 */
export function PageUndo<S extends AnySchema>({
  context,
  docked = false,
}: {
  readonly context: PageContext<S>;
  /** Held at the corner of the face rather than in a shell's own row. Set by the face's root. */
  readonly docked?: boolean;
}) {
  usePlacedOnTheFace("undo");
  return <TakeBack context={context} docked={docked} />;
}

function TakeBack<S extends AnySchema>({ context, docked }: { readonly context: PageContext<S>; readonly docked: boolean }) {
  const { change, takeBack, refused, said } = useTakeBack(context);
  const dock = useRef<HTMLDivElement | null>(null);
  const shown = docked && (change !== undefined || refused !== null);
  useFloatingDock(dock, shown);
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
        {change ? (
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
        ) : null}
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
  padding: "8px 14px",
  borderRadius: "var(--graview-radius, 12px)",
  boxShadow: "var(--graview-lift-high)",
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

/* ------------------------------------------------------------------ */
/* The root                                                            */
/* ------------------------------------------------------------------ */

/**
 * ⌘Z AND CTRL+Z, on the face — not in a text field, where they are the
 * field's own undo and a person typing a name expects the letters back, not
 * the last change. Heard on the document while the keyboard is in the face,
 * or on nothing at all when the face owns the document; never while it is
 * on the host page around an embed.
 */
function useTakeBackKeys<S extends AnySchema>(context: PageContext<S>, root: RefObject<HTMLElement | null>, on: boolean) {
  const { store, principal, embedded } = context;
  useEffect(() => {
    if (!on) return;
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if (editable(event.target)) return;
      const target = event.target;
      const inFace = target instanceof Node && root.current?.contains(target);
      const onNothing = target === document.body || target === document.documentElement || target === document;
      if (!inFace && !(onNothing && !embedded)) return;
      const change = lastChangeOf(store, principal);
      if (!change) return;
      event.preventDefault();
      try {
        store.undo(change.batch, principal ? { author: principal } : {});
      } catch {
        // The control says a refusal where it was asked; a key has nowhere to say it.
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [store, principal, embedded, root, on]);
}

/**
 * The face's root: it knows which of the face's controls a shell placed,
 * and draws the rest — Find in a bar above the shell, the way back docked
 * at the corner — before the shell in the document, so the keyboard reaches
 * them first.
 */
export function FaceControlsRoot<S extends AnySchema>({
  context,
  registry,
  root,
  children,
}: {
  readonly context: PageContext<S>;
  readonly registry: PageRegistry<S, unknown> | undefined;
  readonly root: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
}) {
  const placed = useMemo(createPlaced, []);
  const without = registry?.without() ?? new Set<FaceControl>();
  useTakeBackKeys(context, root, !without.has("undo"));
  return (
    <FaceControls.Provider value={placed}>
      <Fallbacks context={context} placed={placed} without={without} />
      {children}
    </FaceControls.Provider>
  );
}

function Fallbacks<S extends AnySchema>({
  context,
  placed,
  without,
}: {
  readonly context: PageContext<S>;
  readonly placed: Placed;
  readonly without: ReadonlySet<FaceControl>;
}) {
  // Drawn once the shell has had its say: its controls are placed in the same commit, before paint.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => setReady(true), []);
  const findPlaced = usePlaced(placed, "find");
  const undoPlaced = usePlaced(placed, "undo");
  const location = useLocation();
  // The app bar above the face keeps a place for Find (FR-131): the face's box goes there.
  const bar = useBarFind();
  if (!ready) return null;
  const segments = location.pathname.split("/").filter(Boolean);
  const listKind = segments.length === 1 ? kindOfSlug(context.store.schema, segments[0]!) : undefined;
  /*
   * `?q=` narrows the list you are on, the face's or the app's own: the
   * words are the shared grammar's, which an app's list reads as the
   * derived one does. A list page with a second box for the same words —
   * a "Find…" under the bar's "Find… ⌘K" — said one thing twice.
   */
  const narrows = listKind !== undefined;
  return (
    <>
      {!findPlaced && !without.has("find") && bar ? createPortal(<FindInBar context={context} narrowsLists={narrows} />, bar.slot) : null}
      {!findPlaced && !without.has("find") && !bar ? (
        <div
          data-testid="face-find-bar"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderBottom: "1px solid var(--graview-edge)",
            background: "var(--graview-bar)",
            minWidth: 0,
          }}
        >
          <FindInBar context={context} narrowsLists={narrows} />
        </div>
      ) : null}
      {!undoPlaced && !without.has("undo") ? <TakeBack context={context} docked /> : null}
    </>
  );
}

/** The bar's Find box: `PageFind` without counting as one the shell placed. */
function FindInBar<S extends AnySchema>({ context, narrowsLists }: { readonly context: PageContext<S>; readonly narrowsLists: boolean }) {
  return (
    <FaceControls.Provider value={null}>
      <PageFind context={context} narrowsLists={narrowsLists} />
    </FaceControls.Provider>
  );
}
