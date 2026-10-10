import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { isTakeBackKey, lastChangeOf, takeBackLast, takeBackWords, type LastChange } from "@graview/primitives/pages";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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

/* What can be taken back, and its words: judged and said alike on the scene (`@graview/primitives`, FR-152). */
export { lastChangeOf, takeBackWords, type LastChange };

/** The way back, behind its door (take-back.tsx). */
const TakeBack = lazy(retryingImport(() => import("./take-back.js").then((module) => ({ default: module.TakeBack }))));

/**
 * THE WAY BACK, on the routed face: one control that says what it takes
 * back — "Take back “Rename to …”" — and takes it back as the person at the
 * keyboard, judged by the policy like any change.
 *
 * Exported for a shell that wants it somewhere of its own, where it stands
 * while there is a change to take back; a shell that does not place it gets
 * it anyway, floating over the face at its foot like a notice (FR-133), for
 * as long as a notice stands (FR-152).
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
  return <WayBack context={context} docked={docked} at="" />;
}

/**
 * THE WAY BACK, FETCHED WHEN IT COULD OFFER SOMETHING: docked, once the
 * store has changed since the face was drawn (an offer comes only with an
 * act, FR-152); placed in a shell's row, once there is any change at all.
 */
function WayBack<S extends AnySchema>({ context, docked, at }: { readonly context: PageContext<S>; readonly docked: boolean; readonly at: string }) {
  const { store } = context;
  const tick = useStoreTick(store);
  const [since] = useState(() => store.batches().length);
  const wanted = useRef(false);
  wanted.current ||= tick > 0 || (!docked && since > 0);
  return wanted.current ? (
    <Suspense fallback={null}>
      {/* The door's component is not generic: the context is the face's own. */}
      <TakeBack context={context as unknown as PageContext<AnySchema>} docked={docked} at={at} since={since} />
    </Suspense>
  ) : null;
}

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
      if (!isTakeBackKey(event)) return;
      const target = event.target;
      const inFace = target instanceof Node && root.current?.contains(target);
      const onNothing = target === document.body || target === document.documentElement || target === document;
      if (!inFace && !(onNothing && !embedded)) return;
      if (!lastChangeOf(store, principal)) return;
      event.preventDefault();
      try {
        takeBackLast(store, principal);
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
      {!undoPlaced && !without.has("undo") ? <WayBack context={context} docked at={location.pathname + location.search} /> : null}
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
