import type { AnySchema } from "@graview/core";
import { aggregateId, withFocus, withOverview } from "@graview/layout";
import { useGraview, useNavigation } from "@graview/react";

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
export function Places<S extends AnySchema>() {
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
  if (places.length === 0) return null;
  return (
    <nav aria-label="Places" data-testid="places" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {places.map((place) => {
        const stop = aggregateId(place.kind);
        const here = !view.overview && view.focusId === stop;
        return (
          <button
            key={place.kind}
            type="button"
            aria-pressed={here}
            data-testid={`place-${place.kind}`}
            title={`${place.title} — a picture over the ${place.kind}s`}
            onClick={() => go(withOverview(withFocus(view, stop), false))}
            style={{
              padding: "3px 11px",
              borderRadius: 999,
              fontSize: "0.78125rem",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: here ? "var(--graview-accent)" : "var(--graview-edge)",
              color: here ? "var(--graview-accent)" : "var(--graview-ink-muted)",
              background: here ? "var(--graview-panel)" : "transparent",
            }}
          >
            {place.title}
          </button>
        );
      })}
    </nav>
  );
}
