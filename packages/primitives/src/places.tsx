import type { AnySchema, Place } from "@graview/core";
import { aggregateId, withPicture } from "@graview/layout/view";
import { useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useRef, useState, type WheelEvent } from "react";
import { VISUALLY_HIDDEN } from "./primitives/index.js";

/**
 * THE NAMED PLACES, as text tabs.
 *
 * A group view registered with a title is somewhere to go: "Who tends what"
 * over the gardeners, "What grows where" over the plots. Each tab is the
 * stop that shows it — the group in focus, on the ground — and is pressed
 * while you are there. Nothing renders for an app with no named places, so
 * the bar of an app that never registered a lens is exactly as it was.
 *
 * This exists because a lens was only reachable by focusing the group it
 * was registered on: click into one member and the picture was gone, with
 * nothing on the screen to say it had ever been there.
 *
 * TABS, NOT PILLS, AND NOT A MENU (FR-117, FR-118). The places were a row of
 * capsules that handed what it could not hold to a "+N more" select — and,
 * on a phone, one select for all of them. En Dash Org's eight places were
 * eight capsules on a desk, cut to "What slices call for" at 54 of its 107
 * pixels, and on a phone a name you had to open a menu to read. A capsule
 * means "press this to choose" or "this is its state"; the places are the
 * app's own navigation, read at a glance, so they are words on one line with
 * the current one underlined, and a row longer than its room scrolls rather
 * than cutting a name or hiding it behind a press. Every name is whole,
 * everywhere, and the place you are on is scrolled into view.
 */
export function Places<S extends AnySchema>({ compact = false }: { compact?: boolean } = {}) {
  const { views, hiddenKinds } = useGraview<S>();
  const { view, go } = useNavigation();
  /*
   * A PLACE OVER A KIND THIS SEAT CANNOT SEE IS A DOOR TO AN EMPTY ROOM.
   *
   * The reach lens registered over the people is "Who may do what" — a
   * picture of the installation, named on the bar. A member may not
   * administer the installation, so its kinds are not drawn for them
   * anywhere; the tab was drawn anyway, and pressing it focused a district
   * that is not there. The kinds a seat is kept from are already worked out
   * once, for the scene and the shelf; the bar reads the same answer.
   */
  const places = views.places().filter((place) => !hiddenKinds.has(place.kind));
  /*
   * Which picture a group draws when the address names none: the LAST
   * registration for the cell, because that is what the registry resolves
   * to and a tab must agree with what is actually on screen.
   */
  const isDefault = (all: readonly Place[], place: Place): boolean => all.filter((other) => other.kind === place.kind).at(-1)?.as === place.as;
  const showing = view.within?.["view"];
  const isHere = (place: Place) => !view.overview && view.focusId === aggregateId(place.kind) && (showing === undefined ? isDefault(places, place) : showing === place.as);
  const here = places.find(isHere);
  const row = useRef<HTMLElement>(null);
  /* The place you are on, in view: a row that scrolls never hides the tab that says where you are. */
  useEffect(() => {
    const element = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const scroller = row.current;
    if (!element || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const left = element.offsetLeft - scroller.offsetLeft;
    if (left < scroller.scrollLeft || left + element.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = Math.max(0, left - 24);
    }
  }, [here?.as, here?.kind, places.length]);
  /*
   * WHICH EDGE HAS MORE. A row that scrolls says so by fading the edge with
   * more beyond it, so a name at that edge reads as continuing rather than
   * cut — and the fade goes when there is nothing more that way.
   */
  const [more, setMore] = useState<"" | "start" | "end" | "both">("");
  useEffect(() => {
    const scroller = row.current;
    if (!scroller) return;
    const read = () => {
      const start = scroller.scrollLeft > 1;
      const end = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
      const next = start && end ? "both" : start ? "start" : end ? "end" : "";
      setMore((was) => (was === next ? was : next));
    };
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    watch?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", read);
      watch?.disconnect();
    };
  }, [places.length]);
  if (places.length === 0) return null;
  const fade = more === "" ? undefined : `linear-gradient(to right, ${more === "end" ? "#000" : "transparent"} 0, #000 28px, #000 calc(100% - 28px), ${more === "start" ? "#000" : "transparent"} 100%)`;
  const goTo = (place: Place) => go(withPicture(view, place.kind, place.as));
  /* A mouse's wheel scrolls the row sideways when the row is longer than its room: a desk has no swipe. */
  const onWheel = (event: WheelEvent<HTMLElement>) => {
    const scroller = event.currentTarget;
    if (scroller.scrollWidth <= scroller.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    scroller.scrollLeft += event.deltaY;
  };
  return (
    <nav
      ref={row}
      aria-label="Places"
      data-testid="places"
      data-graview-places={compact ? "row" : "inline"}
      className="graview-places"
      onWheel={onWheel}
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 2,
        minWidth: 0,
        maxWidth: "100%",
        // Its own row on a phone, the room that is left on a desk; either way it scrolls rather than cuts.
        flex: compact ? "1 1 100%" : "1 1 12rem",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        overscrollBehaviorX: "contain",
        ...(fade ? { maskImage: fade, WebkitMaskImage: fade } : {}),
      }}
      data-graview-more={more || undefined}
    >
      {/* A heading for the region (FR-25), named as its landmark is; out of the row's flow. */}
      <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>Places</h2>
      {places.map((place) => {
        const pressed = isHere(place);
        return (
          <button
            key={`${place.kind}:${place.as}`}
            type="button"
            aria-pressed={pressed}
            data-testid={`place-${place.as}`}
            data-place-kind={place.kind}
            className="graview-place-tab"
            title={`${place.title} — a picture over the ${place.kind}s`}
            onClick={() => goTo(place)}
            style={{
              // A full fingertip whatever the brand's line height.
              minHeight: 32,
              padding: "4px 10px",
              margin: 0,
              border: 0,
              // The place you are on is underlined: a baseline, not a capsule.
              borderBottom: `2px solid ${pressed ? "var(--graview-accent)" : "transparent"}`,
              borderRadius: 0,
              background: "transparent",
              boxShadow: "none",
              fontSize: "0.875rem",
              fontWeight: pressed ? 600 : 500,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              cursor: "pointer",
              color: pressed ? "var(--graview-ink)" : "var(--graview-ink-muted)",
            }}
          >
            {place.title}
          </button>
        );
      })}
    </nav>
  );
}
