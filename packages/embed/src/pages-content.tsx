import type { AnySchema, Brand, PresenceChannel, Store } from "@graview/core";
import { basePathOf } from "@graview/core";
import { PagesApp, type PagesSteering } from "@graview/pages";
import type { ReactViewRegistry } from "@graview/react/provider";
import { viewsCss } from "@graview/primitives/pages";
import { useMemo } from "react";
import type { FrameOptions } from "./frame.js";

/**
 * The routed face in the frame. The page scrolls inside the embed's box,
 * unless the embed is sized from its content: then the page is as tall as
 * it is, and the height the host is told is the whole of it.
 */
export function PagesContent<S extends AnySchema>({
  store,
  auto,
  brand,
  views,
  presence,
  steering,
  overview,
  scope,
  titleLevel = 2,
  props,
}: {
  readonly store: Store<S>;
  /** The registry the scene draws from, so the pages draw the same pictures (FR-35). */
  readonly views: ReactViewRegistry<S>;
  readonly presence: PresenceChannel | undefined;
  readonly auto: boolean;
  readonly brand: Brand | undefined;
  /** The bar above: where the face is, said as it moves, and the bar's presses taken (FR-131). */
  readonly steering?: PagesSteering | undefined;
  /** The way to the overview from a page, when the embed draws the scene (FR-132). */
  readonly overview?: ((stop: string) => void) | undefined;
  /** The embed's scope, for the views' own sheet (FR-131). */
  readonly scope: string;
  /** The level a page's own title is said at: one below the app's name on the bar (FR-131). */
  readonly titleLevel?: 2 | 3 | 4 | 5 | 6;
  readonly props: FrameOptions<S>;
}) {
  const css = useMemo(() => viewsCss({ scope: `.${scope}` }), [scope]);
  return (
    <div data-embed-content="" style={auto ? { flex: "0 0 auto", background: "var(--graview-ground)" } : { flex: "1 1 auto", minHeight: 0, overflow: "auto", background: "var(--graview-ground)" }}>
      <style>{css}</style>
      <div data-embed-measure="" style={{ display: "flow-root" }}>
        <PagesApp<S>
          /*
           * THE SAME PICTURES ON THE ROUTED FACE (FR-35): the registry the
           * scene draws from, so a view registered here is the gallery's
           * card, the list's row and the record's page too.
           */
          context={{
            store,
            embedded: true,
            /* The bar above says the app, its places, Find and the standing: the face does not say them again (FR-131). */
            ...(props.bar !== false ? { barAbove: true } : {}),
            ...(overview ? { overview } : {}),
            titleLevel,
            views,
            settings: props.app.settings ?? [],
            ...(presence ? { presence } : {}),
            ...(brand ? { brand } : {}),
            ...(props.principal ? { principal: props.principal } : {}),
            ...(props.seats ? { seats: props.seats } : {}),
            ...(props.people ? { people: props.people } : {}),
          }}
          {...(props.pages ? { registry: props.pages } : {})}
          {...(steering ? { steering } : {})}
          /*
           * WHO OWNS THE ADDRESS (FR-106): somebody else's page keeps the face
           * in memory; a host whose page is the app hands it the address bar,
           * and the face is mounted at its base path.
           */
          {...(props.routing === "address"
            ? basePathOf(props.basePath) === "" ? {} : { basename: basePathOf(props.basePath) }
            : { initialPath: props.path ?? "/" })}
          {...(props.path !== undefined ? { path: props.path } : {})}
          {...(props.onNavigate ? { onNavigate: props.onNavigate } : {})}
        />
      </div>
    </div>
  );
}
