import { layer, type AnySchema } from "@graview/core";
import { withFocus, withOverview, withSelection } from "@graview/layout/view";
import { useGraph, useGraview, type ViewComponent } from "@graview/react/provider";
import { useEffect, useState, type MouseEvent } from "react";

/**
 * THE HOME VIEW ON THE GRAVIEW FACE (FR-81): a landing over the picture.
 *
 * On the routed face the home's own view replaces the derived home's body.
 * The Graview face's home is the picture itself — the city from altitude,
 * the kinds at ground level — and replacing it would take away the one
 * thing that face is for. So the home view stands OVER it, at the side
 * the companion does not take, whenever the scene is at its home: nothing
 * focused, nothing chosen. Going anywhere puts it away, and coming home
 * brings it back; it can be put away by hand. A record it lists is a pick
 * target, and pressing one goes to that record as the Find box does.
 *
 * An empty graph draws no landing: the city's own way in (its districts
 * and their beginnings) is what an empty installation needs, and blocks
 * about records that do not exist would be a panel of dashes.
 */
export function HomeLanding() {
  const { views, store, view, setView } = useGraview<AnySchema>();
  useGraph();
  const Home = views.homeView?.() as ViewComponent<AnySchema> | undefined;
  const atHome = view.focusId === null && (view.selection?.length ?? 0) === 0;
  const [away, setAway] = useState(false);
  // Leaving home forgets that it was put away: the next time home is reached, it is there.
  useEffect(() => {
    if (!atHome) setAway(false);
  }, [atHome]);
  const anything = (store.schema.kinds as readonly string[]).some((kind) => store.graph.nodesOfKind(kind as never).length > 0);
  if (!Home || !atHome || away || !anything) return null;
  const pick = (event: MouseEvent<HTMLElement>) => {
    const id = (event.target as HTMLElement | null)?.closest("[data-graview-pick]")?.getAttribute("data-graview-pick");
    if (!id || !store.graph.getNode(id)) return;
    event.preventDefault();
    setView((stop) => withSelection(withFocus(withOverview(stop, false), id), [id]));
  };
  return (
    <section
      aria-label="Home"
      data-testid="home-landing"
      onClick={pick}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: "min(440px, calc(100% - 24px))",
        maxHeight: "calc(100% - 24px)",
        overflow: "auto",
        boxSizing: "border-box",
        padding: "14px 16px 16px",
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float, var(--graview-panel))",
        boxShadow: "var(--graview-lift-high)",
        zIndex: layer("overview"),
      }}
    >
      <button
        type="button"
        data-testid="home-landing-away"
        onClick={() => setAway(true)}
        aria-label="Put the home away"
        style={{ float: "right", minHeight: 28, minWidth: 28, marginLeft: 8, border: "1px solid var(--graview-edge)", borderRadius: 999, background: "transparent", color: "var(--graview-ink-muted)", cursor: "pointer", font: "inherit" }}
      >
        ×
      </button>
      <Home cardinality="many" fidelity="full" mode="scene" selected={false} />
    </section>
  );
}
