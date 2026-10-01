import type { AnySchema, Place } from "@graview/core";
import { aggregateId, withFocus, withOverview, withWithin } from "@graview/layout";
import { useGraview, useNavigation } from "@graview/react";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * THE NAMED PLACES, as pills.
 *
 * A group view registered with a title is somewhere to go: "Who tends what"
 * over the gardeners, "What grows where" over the plots. Each pill is the
 * stop that shows it — the group in focus, on the ground — and is pressed
 * while you are there. Nothing renders for an app with no named places, so
 * the bar of an app that never registered a lens is exactly as it was.
 *
 * This exists because a lens was only reachable by focusing the group it
 * was registered on: click into one member and the picture was gone, with
 * nothing on the screen to say it had ever been there.
 */
/**
 * The named pictures over the graph, as pills — or, `compact`, as one
 * select. Eight pills wrapped to four rows on a phone-width embed and took
 * half its height before the picture began; a select says the same eight
 * places in one row and opens to the same stops.
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
   * anywhere; the pill was drawn anyway, and pressing it focused a district
   * that is not there. The kinds a seat is kept from are already worked out
   * once, for the scene and the shelf; the bar reads the same answer.
   */
  const places = views.places().filter((place) => !hiddenKinds.has(place.kind));
  /* Hooks first, before any early return: a bar whose places arrive a
     render later must not change how many hooks it calls. */
  const row = useRef<HTMLElement>(null);
  const widths = useRef<number[]>([]);
  const [shown, setShown] = useState(places.length);
  const MORE = 92;
  /* Which place you are on, so the menu keeps room for its name when it holds it. */
  const current = places.findIndex(
    (place) =>
      !view.overview &&
      view.focusId === aggregateId(place.kind) &&
      (view.within?.["view"] === undefined
        ? places.filter((other) => other.kind === place.kind).at(-1)?.as === place.as
        : view.within["view"] === place.as),
  );
  useLayoutEffect(() => {
    const element = row.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // The ROOM is the region the row stands in, not the row's own width:
      // the row shrinks to what it shows, and measuring it could only ever
      // agree with what was already shown.
      const room = (element.parentElement ?? element).getBoundingClientRect().width - 8;
      const sizes = widths.current;
      if (sizes.length < places.length) return;
      let used = 0;
      let fit = 0;
      for (let i = 0; i < places.length; i += 1) {
        const next = used + (sizes[i] ?? 0) + (i > 0 ? 2 : 0);
        /*
         * THE MORE MENU IS AS WIDE AS WHAT IT SAYS. Standing on a place it
         * holds, the select shows that place's name, not "+2 more" — and
         * "The rotation" is wider than the 92 pixels kept for it, so the
         * row ran seven pixels past its own edge. Keep room for the name of
         * the place you are on when it would be in the menu; otherwise the
         * menu says "+N more", and 92 holds that.
         */
        const reserve =
          i < places.length - 1 ? Math.max(MORE, current > i ? (sizes[current] ?? 0) + 14 : 0) : 0;
        if (next + reserve > room) break;
        used = next;
        fit = i + 1;
      }
      setShown((was) => (was === fit ? was : fit));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(element.parentElement ?? element);
    return () => watch.disconnect();
  }, [places.length, current]);
  if (places.length === 0) return null;
  /*
   * Which picture a group draws when the address names none: the LAST
   * registration for the cell, because that is what the registry resolves
   * to and a pill must agree with what is actually on screen.
   */
  const isDefault = (all: readonly Place[], place: Place): boolean =>
    all.filter((other) => other.kind === place.kind).at(-1)?.as === place.as;
  const showing = view.within?.["view"];
  const isHere = (place: Place) =>
    !view.overview &&
    view.focusId === aggregateId(place.kind) &&
    (showing === undefined ? isDefault(places, place) : showing === place.as);
  const goTo = (place: Place) =>
    go(withWithin(withOverview(withFocus(view, aggregateId(place.kind)), false), "view", place.as));
  if (compact) {
    const here = places.find(isHere);
    return (
      <select
        aria-label="Places"
        data-testid="places"
        value={here ? `${here.kind}:${here.as}` : ""}
        onChange={(event) => {
          const place = places.find((candidate) => `${candidate.kind}:${candidate.as}` === event.target.value);
          if (place) goTo(place);
        }}
        style={{
          minHeight: 28,
          maxWidth: "100%",
          padding: "3px 8px",
          borderRadius: 999,
          fontSize: "0.875rem",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: here ? "var(--graview-accent)" : "var(--graview-edge)",
          color: here ? "var(--graview-accent)" : "var(--graview-ink-muted)",
          backgroundColor: "var(--graview-panel)",
          // WebKit ignores the floor on a native select (W-121): the look off, a chevron drawn.
          paddingRight: 24,
          appearance: "none",
          WebkitAppearance: "none",
          backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
          backgroundPosition: "calc(100% - 13px) 55%, calc(100% - 9px) 55%",
          backgroundSize: "4px 4px, 4px 4px",
          backgroundRepeat: "no-repeat",
        }}
      >
        <option value="">Places…</option>
        {places.map((place) => (
          <option key={`${place.kind}:${place.as}`} value={`${place.kind}:${place.as}`} data-place-kind={place.kind}>
            {place.title}
          </option>
        ))}
      </select>
    );
  }
  /*
   * ONE ROW, WHATEVER THE WIDTH. The places are the app's own navigation
   * and read as one control — a segmented row with the current picture
   * filled — rather than a run of loose pills. What the row cannot hold
   * goes into a "More" menu at its end instead of wrapping the bar into a
   * second line: the bar is one line, and the picture starts under it.
   */
  const rest = places.slice(shown);
  const restHere = rest.find(isHere);
  return (
    <nav
      ref={row}
      aria-label="Places"
      data-testid="places"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        minWidth: 0,
        maxWidth: "100%",
        borderRadius: 999,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-panel-muted)",
        overflow: "hidden",
      }}
    >
      {places.map((place, index) => {
        const here = isHere(place);
        return (
          <button
            key={`${place.kind}:${place.as}`}
            ref={(el) => {
              if (el) widths.current[index] = el.getBoundingClientRect().width;
            }}
            type="button"
            aria-pressed={here}
            data-testid={`place-${place.as}`}
            data-place-kind={place.kind}
            title={`${place.title} — a picture over the ${place.kind}s`}
            onClick={() => goTo(place)}
            style={{
              // A full fingertip whatever the brand's line height: Groundskeeper's
              // pills measured 22px and its audit counted every one.
              minHeight: 28,
              padding: "3px 13px",
              borderRadius: 999,
              fontSize: "0.875rem",
              fontWeight: here ? 600 : 500,
              borderWidth: 1,
              borderStyle: "solid",
              boxShadow: "none",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              color: here ? "var(--graview-ink)" : "var(--graview-ink-muted)",
              background: here ? "var(--graview-panel)" : "transparent",
              borderColor: here ? "var(--graview-edge)" : "transparent",
              // Measured at full width, then parked off the row's left edge
              // if the row cannot hold it: still measurable, never part of
              // anything's scrollable overflow (which only extends rightward),
              // so no box on the bar reads as cut.
              ...(index >= shown ? { position: "absolute" as const, left: -9999, top: 0, visibility: "hidden" as const } : {}),
            }}
          >
            {place.title}
          </button>
        );
      })}
      {rest.length > 0 ? (
        <select
          aria-label="More places"
          data-testid="places-more"
          value={restHere ? `${restHere.kind}:${restHere.as}` : ""}
          onChange={(event) => {
            const place = rest.find((candidate) => `${candidate.kind}:${candidate.as}` === event.target.value);
            if (place) goTo(place);
          }}
          style={{
            minHeight: 28,
            padding: "3px 22px 3px 12px",
            borderRadius: 999,
            fontSize: "0.875rem",
            fontWeight: restHere ? 600 : 500,
            borderWidth: 1,
            borderStyle: "solid",
            flex: "0 0 auto",
            color: restHere ? "var(--graview-ink)" : "var(--graview-ink-muted)",
            // backgroundColor, not background: the shorthand beside the chevron's
            // backgroundImage and friends is overwritten by them on every change of place.
            backgroundColor: restHere ? "var(--graview-panel)" : "transparent",
            // The browser's own arrow is wide and grey; a small chevron of the text's colour instead.
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 13px) 55%, calc(100% - 9px) 55%",
            backgroundSize: "4px 4px, 4px 4px",
            backgroundRepeat: "no-repeat",
            borderColor: restHere ? "var(--graview-edge)" : "transparent",
          }}
        >
          <option value="">{restHere ? restHere.title : `+${rest.length} more`}</option>
          {rest.map((place) => (
            <option key={`${place.kind}:${place.as}`} value={`${place.kind}:${place.as}`}>
              {place.title}
            </option>
          ))}
        </select>
      ) : null}
    </nav>
  );
}
