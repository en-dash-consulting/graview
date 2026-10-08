import type { AnySchema, Store } from "@graview/core";
import { PlacePicture } from "@graview/pages";
import type { ReactViewRegistry } from "@graview/react/provider";
import { viewsCss } from "@graview/primitives/pages";
import { useMemo } from "react";

/**
 * ONE NAMED LENS AND NOTHING ELSE, fetched when it is drawn (FR-57). The
 * lens fills the frame: a one-row grid stretches it to the height it was
 * given, and it scrolls inside itself past that.
 */
export function PictureFace<S extends AnySchema>({ store, views, as, scope }: { readonly store: Store<S>; readonly views: ReactViewRegistry<S>; readonly as: string; readonly scope: string }) {
  // The views' own sheet, drawn with the picture (FR-131).
  const css = useMemo(() => viewsCss({ scope: `.${scope}` }), [scope]);
  return (
    <div
      data-testid="embed-picture"
      data-embed-content=""
      // A region that may scroll has to be reachable by keyboard, and a
      // reachable region has to say what it is: the picture's own name.
      tabIndex={0}
      aria-label={views.places().find((place) => place.as === as)?.title ?? "The picture"}
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr)",
        overflow: "auto",
        background: "var(--graview-ground)",
        color: "var(--graview-ink)",
        fontFamily: "var(--graview-font-body, system-ui)",
      }}
    >
      <style>{css}</style>
      <PlacePicture<S> store={store} views={views} as={as} />
    </div>
  );
}
