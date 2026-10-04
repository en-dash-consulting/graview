import type { AnySchema } from "@graview/core";
import { withoutMoves, withPast, withZoom } from "@graview/layout/view";
import { useBacktrack, useGraview, useNavigation } from "@graview/react/provider";
import { Fragment, type ReactNode } from "react";
import { nameOf } from "./answer-args.js";


/**
 * Where you are, and the way back. The view used to be printed as a raw URL
 * fragment; the same information reads as a trail.
 */
/**
 * Back and forward, because every stop here is a URL.
 *
 * Travelling into a task changes `focusId`, which changes the address, which
 * means the browser's own back button already works — and that is exactly the
 * problem: the person using the app has to KNOW that its navigation is the
 * browser's. On a screen you reached by double-clicking, the only way out was
 * a breadcrumb crumb or a keyboard shortcut nobody was told about.
 *
 * Disabled rather than hidden at the ends of the history, so the control does
 * not appear and disappear as you move — and never enabled when there is
 * nowhere to go, since an arrow that does nothing is worse than no arrow.
 */
export function Backtrack() {
  const { canGoBack, canGoForward, back, forward } = useBacktrack();
  // Ghost buttons: the way back is furniture, not a call to action.
  const style = {
    minWidth: 30,
    height: 30,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 8px",
    fontSize: "0.9375rem",
    lineHeight: 1,
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    boxShadow: "none",
    color: "var(--graview-ink-muted)",
  } as const;
  return (
    <div style={{ display: "inline-flex", gap: 2 }} data-testid="backtrack">
      <button
        type="button"
        onClick={back}
        disabled={!canGoBack}
        aria-label="Back"
        title="Back"
        style={style}
      >
        ←
      </button>
      <button
        type="button"
        onClick={forward}
        disabled={!canGoForward}
        aria-label="Forward"
        title="Forward"
        style={style}
      >
        →
      </button>
    </div>
  );
}

export function Trail({
  home,
  homeLabel,
  children,
}: {
  readonly home: string | null;
  /**
   * The name of the place you are in — omit it when something else on screen
   * already says it.
   *
   * An app with more than one place draws a switcher whose current pill IS
   * the home crumb: it names the place and clicking it goes there. Printing
   * the same words again an inch to the right is the "same string twice on
   * one screen" fault this codebase keeps finding, and it was on every screen
   * of two of the four apps.
   */
  readonly homeLabel?: string;
  readonly children?: ReactNode;
}) {
  const { view, focus, show, go } = useNavigation();
  const { store } = useGraview<AnySchema>();
  /*
   * "moved" MEANS A HAND MOVED SOMETHING. A pan carried in a link, or a
   * pin the layout remembered, is a state to arrive in, not a move to put
   * back; the chip appears only after a gesture in this tab.
   */
  const { movedByHand } = useGraview<AnySchema>();
  const moved = movedByHand && (view.pan !== undefined || Object.keys(view.pins).length > 0);
  const focused =
    view.focusId && view.focusId !== home ? store.graph.getNode(view.focusId) : undefined;
  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

  const chip = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    // A crumb is a control, and a control is at least a fingertip tall.
    // A crumb of where you are: quiet, since the picture already shows it.
    minHeight: 26,
    padding: "2px 10px",
    fontSize: "0.8125rem",
    borderRadius: 999,
    border: "1px solid transparent",
    boxShadow: "none",
    background: "var(--graview-panel-muted)",
    color: "var(--graview-ink-muted)",
    whiteSpace: "nowrap",
  } as const;

  /*
   * The home crumb appears only once you have LEFT home.
   *
   * Standing on it, it was a control that did nothing — clicking "This
   * week" while looking at This week goes nowhere — printed an inch
   * above a panel whose own heading said the same three words. Two
   * faults from one element: a dead control and a duplicated string, on
   * every screen of three of the four apps. Away from home it is the way
   * back, which is the entire reason it exists.
   */
  /*
   * Only once FOCUSED away from home. A raised relation is a state OF home,
   * not a departure from it: the panel below still carries home's own title,
   * so the crumb duplicated it an inch above, and the raised chip already
   * holds the way back from the only thing that changed.
   */
  const crumb = homeLabel !== undefined && focused !== undefined;

  const chips: { key: string; node: ReactNode }[] = [];
  if (focused) {
    chips.push({
      key: "focused",
      node: (
        <button
          type="button"
          data-testid="focused"
          // Dropping the focus drops the zoom with it: zoomed into nothing
          // is not a place.
          onClick={() => go(withZoom({ ...view, focusId: home }, false))}
          // A name of a hundred characters gives way to the bar, whole on hover.
          title={nameOf(store, focused.id)}
          style={{ ...chip, maxWidth: "min(14rem, 15vw)" }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(store, focused.id)}</span>
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  /*
   * ZOOMED IN says so, and offers the way back out. The state is a stop like
   * the others — Escape backs out of it first, this chip is the visible
   * version of the same move.
   */
  /*
   * THE PAST says so, and offers the way back to now. Widening the horizon
   * is a stop; the chip is the visible version of leaving it.
   */
  if (view.past) {
    chips.push({
      key: "past",
      node: (
        <button
          type="button"
          data-testid="past"
          onClick={() => go(withPast(view, false))}
          title="Back to now — retired things leave the picture again"
          style={chip}
        >
          the past
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  if (view.zoom) {
    chips.push({
      key: "zoomed",
      node: (
        <button
          type="button"
          data-testid="zoomed"
          onClick={() => go(withZoom(view, false))}
          title="Zoom back out"
          style={chip}
        >
          zoomed in
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  /*
   * WHAT YOU MOVED, and the way to put it back.
   *
   * Panning and dragging are ordinary view state, so they are in the URL
   * and they survive a reload — which means without a way to undo them
   * a scene someone nudged stays nudged for ever. It sits in the trail
   * with the other things you can back out of, because that is what it
   * is.
   */
  if (moved) {
    chips.push({
      key: "moved",
      node: (
        <button
          type="button"
          data-testid="moved"
          onClick={() => go(withoutMoves(view))}
          title="Put the camera and everything you dragged back where the layout wanted them"
          style={chip}
        >
          moved
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }
  if (view.relation) {
    chips.push({
      key: "raised",
      node: (
        <button
          type="button"
          data-testid="raised"
          onClick={() => show(null)}
          title={`Stop showing ${plural(view.relation!)}`}
          style={chip}
        >
          {plural(view.relation)}
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ×
          </span>
        </button>
      ),
    });
  }

  return (
    <nav
      aria-label="View"
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", minWidth: 0 }}
    >
      {crumb ? (
        <button
          type="button"
          onClick={() => focus(home)}
          style={{
            border: "none",
            background: "none",
            padding: "3px 0",
            minHeight: 24,
            whiteSpace: "nowrap",
            color: "var(--graview-ink-muted)",
          }}
        >
          {homeLabel}
        </button>
      ) : null}
      {/* A separator separates: it appears between two things, never as a
          leader on the first. With no home crumb the first chip opens the
          trail bare, because a "›" pointing at nothing was read as a
          rendering fault — which it was. */}
      {chips.map(({ key, node }, index) => (
        <Fragment key={key}>
          {crumb || index > 0 ? <span style={{ color: "var(--graview-ink-faint)" }}>›</span> : null}
          {node}
        </Fragment>
      ))}
      {children}
    </nav>
  );
}
