import { withFocus, withoutMoves, withOverview, withoutSearch, kindsOfAggregate } from "@graview/layout/view";
import { layer } from "@graview/core";
import { useGraview, useJackIn, useNavigation, useSelection } from "@graview/react/provider";
import { useEffect } from "react";
import { descentTarget } from "./descent.js";

/**
 * WHERE THE KEYBOARD GOES WHEN ESCAPE TAKES AWAY WHAT IT STOOD ON.
 *
 * Backing out of a record removes its card; the keyboard was on the card, or
 * on the title renamed in it a moment ago, and fell to `<body>`. Chromium
 * then tabs on from wherever the card was, into the zoom buttons, and WebKit
 * from somewhere else again. The honest place is the card that still draws
 * what was left — the district holding its chip — and failing that any card
 * in the scene, so the next arrow or Enter still means the picture.
 *
 * Asked for a while rather than once, because a card leaving on a rise may
 * fade out before it is removed; and only while the keyboard is still on
 * nothing, so a person who moved it in the meantime keeps where they went.
 */
export function landTheKeyboard(stoodOn: HTMLElement, left: string | null, tries = 40): void {
  const attempt = (remaining: number) => {
    const active = document.activeElement;
    const onNothing = active === null || active === document.body || active === stoodOn;
    if (!onNothing) return;
    if (stoodOn.isConnected) {
      if (remaining > 0) setTimeout(() => attempt(remaining - 1), 25);
      return;
    }
    const escaped = left === null ? null : left.replace(/["\\]/g, "\\$&");
    const target =
      (escaped === null
        ? null
        : (document.querySelector<HTMLElement>(`[data-graview-view="${escaped}"]`) ??
          document.querySelector<HTMLElement>(`[data-graview-pick="${escaped}"]`)?.closest<HTMLElement>("[data-graview-view]"))) ??
      document.querySelector<HTMLElement>("[data-graview-view][tabindex]");
    target?.focus({ preventScroll: true });
  };
  attempt(tries);
}


/**
 * Escape backs out one level: leave the full page, then the Graview, then
 * drop the selection, then the raised relation, then the focus. A spatial
 * interface has to have a way out that does not require finding the right
 * small × in a trail.
 *
 * THE OVERVIEW IS ONLY A RUNG WHEN IT IS SOMETHING YOU CLIMBED TO. An app
 * that OPENS from altitude — which is what `graview create` writes, and what
 * every app with no in-stack default does — is already home up there, and
 * leaving it would be going further IN. It is also, until this was fixed, the
 * state in which Escape did nothing at all: the provider lands a focusless
 * descent back on the overview (deliberately, so the key is never a void),
 * which means the rung neither moved nor fell through, and every rung below
 * it — the selection, the moves, the raised relation — was unreachable from
 * the first screen of every scaffolded app.
 */
export function BackOut({ home }: { readonly home: string | null }) {
  const { view, focus, show, go } = useNavigation();
  const { homeView } = useGraview();
  const { selection, clear } = useSelection();
  const { isJackedIn, exit } = useJackIn();
  // Up here on purpose, with somewhere below to land: only then is rising
  // something Escape can undo.
  const overview = (view.overview ?? false) && homeView.overview !== true;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Never steal Escape from a field someone is typing in.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      /*
       * A POPOVER IS THE OUTERMOST RUNG, and it climbs down by itself.
       *
       * The activity rail, the problems list and the chat each close on
       * Escape with a listener of their own — and this one ran too, so one
       * press closed the rail AND dropped the selection under it (or, on
       * the ground, backed out of the focus). Whatever is open over the
       * scene owns the press; the ladder takes the next one.
       *
       * Asked in the CAPTURE phase, because the popover's own listener sits
       * on the document, runs first in the bubble, and React commits its
       * closing in the microtask between listeners — by the time a bubble
       * listener on the window looked, the popover was already gone.
       */
      // A pane kept in the tree but hidden — the profile, shut — is not open over anything.
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      // The keyboard, if it is on the picture: the rung may take its card away.
      const stoodOn =
        active instanceof HTMLElement && active.closest("[data-graview-view]") !== null ? active : null;
      if (stoodOn) landTheKeyboard(stoodOn, view.focusId ?? null);
      /*
       * Outermost first, and the full page is the outermost thing there is.
       *
       * It is a modal dialog covering everything, and Escape did not close it
       * — the first press dropped the selection underneath it instead, which
       * from inside the page looked like Escape doing nothing at all. A modal
       * that cannot be dismissed from the keyboard is a trap; the only way
       * out was the button.
       */
      if (isJackedIn) exit();
      // A search lights the whole picture, so it comes off first, and the
      // emphasis goes back to what the selection reaches.
      else if (view.q) go(withoutSearch(view));
      // Then the Graview: rising is the biggest change of place Escape can
      // undo, and it should not also drop a selection on the way past.
      else if (overview) go(withOverview(view, false));
      else if (selection.length > 0) clear();
      // A move is an adjustment of where you are, so it comes off before the
      // things that decide where you are.
      else if (view.pan !== undefined || Object.keys(view.pins).length > 0) {
        go(withoutMoves(view));
      } else if (view.relation) show(null);
      else if (view.focusId !== home) focus(home);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view, focus, show, go, selection, clear, home, overview, isJackedIn, exit]);

  return null;
}

/**
 * The way out to the Graview, and back — one control, two directions.
 *
 * The framework's own name for the view of the whole thing, which is the
 * right name: everything else here is a lens over part of the graph, and this
 * is the graph. It is a TOGGLE and presents as one: labeled "Graview" from
 * the ground (the place it takes you) and "Focus" from altitude (the way back
 * down), with the pressed state saying the same thing to a screen reader.
 *
 * THE MARK MORPHS. The scene's own rising is a morph rather than a cut — the
 * grid dissolves into the iso lattice, the districts grow out of their cards,
 * all riding one registered number. The control sits beside the scene rather
 * than inside it, so it carries its OWN copy of that number, transitioned on
 * the same 640ms curve (`.graview-altitude-control` in the theme): the three
 * kinds on their ring gather into one node inside one ring as the scene
 * rises, and open back out as it lands. Where an engine cannot register the
 * property the scene cuts, and so does the mark — the same mechanism, so they
 * cannot disagree.
 */
export { descentTarget };

export function OverviewButton() {
  const { view, go } = useNavigation();
  const { store, views, hiddenKinds } = useGraview();
  const overview = view.overview ?? false;
  const driveIns = views.places().map((place) => place.kind).filter((kind) => !hiddenKinds.has(kind));
  const target = descentTarget(view, store.schema.kinds as readonly string[], driveIns);
  const descend = () => {
    go(withFocus(withOverview(view, false), target));
  };
  /*
   * UP AND DOWN. "Graview" and "Focus" said neither: a person meeting the
   * control for the first time had to press it to learn what it did. Up is
   * up; down says where you land — the place whose picture is showing, or
   * the district the focus names, in its own words.
   */
  const landing = (() => {
    if (!target) return null;
    const kind = kindsOfAggregate(target)[0];
    // The showing that is showing, else the kind's first place.
    const showing = view.within?.["view"];
    const place =
      (showing ? views.places().find((one) => one.as === showing) : undefined) ??
      (kind ? views.places().find((one) => one.kind === kind) : undefined);
    if (place) return place.title;
    if (kind) return store.schema.tryDefinition(kind)?.plural ?? kind;
    return store.graph.getNode(target)?.label ?? null;
  })();
  const label = overview ? (landing ? `Down to ${landing}` : "Down") : "Up";
  return (
    <button
      type="button"
      data-testid="overview"
      className="graview-altitude-control"
      aria-pressed={overview}
      aria-label={label}
      title={overview ? `${label} — back down into the view` : "Up — the whole thing, from above"}
      // A view state, so it is a URL, the back button works, and the cards
      // already on screen fly out into the ring rather than being replaced.
      onClick={() => (overview ? descend() : go(withOverview(view, true)))}
      /*
       * SCENE FURNITURE, in the scene's corner — the way a map carries its
       * own altitude control.
       *
       * It has lived in two wrong places: floating over the scene as a
       * labeled pill ("awkwardly slammed on top", twice), and then in the
       * command bar, where it spent prime chrome on a control that is about
       * the CANVAS, not the app. The bar is for what the app is; rising and
       * descending is something you do to the picture, so the control sits
       * on the picture — quiet, in the one corner every state leaves empty.
       */
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: layer("overview"),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: 38,
        padding: "0 13px 0 11px",
        // A quiet button on the picture, not a capsule: the scene's one way up or down (FR-117).
        borderRadius: 8,
        borderColor: "transparent",
        fontSize: "0.875rem",
        whiteSpace: "nowrap",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-low)",
        // The number the mark rides. Inline, like the ground's own, so the
        // theme's transition on the class carries it between the two.
        ["--graview-altitude" as string]: overview ? 1 : 0,
        ...(overview ? { color: "var(--graview-accent)" } : {}),
      }}
    >
      {/* The mark: three kinds and the relations between them — the Graview —
          which gather into one node in one ring — the focus — as you rise. */}
      <svg
        className="graview-altitude-mark"
        width="16"
        height="16"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <ellipse
          className="graview-altitude-mark-ring"
          cx="6"
          cy="6.6"
          rx="5"
          ry="2.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
        />
        <circle className="graview-altitude-mark-apex" cx="6" cy="4" r="1.5" fill="currentColor" />
        <circle
          className="graview-altitude-mark-wing"
          data-side="left"
          cx="1.6"
          cy="7.4"
          r="1.2"
          fill="currentColor"
        />
        <circle
          className="graview-altitude-mark-wing"
          data-side="right"
          cx="10.4"
          cy="7.4"
          r="1.2"
          fill="currentColor"
        />
      </svg>
      {/* Where it takes you, in a word: the place from the ground, the way
          back from altitude. */}
      <span className="graview-altitude-label">{label}</span>
    </button>
  );
}
