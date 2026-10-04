import type { AnySchema, Brand, PresenceChannel, Store } from "@graview/core";
import { PagesApp } from "@graview/pages";
import type { ReactViewRegistry } from "@graview/react/provider";
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
  props,
}: {
  readonly store: Store<S>;
  /** The registry the scene draws from, so the pages draw the same pictures (FR-35). */
  readonly views: ReactViewRegistry<S>;
  readonly presence: PresenceChannel | undefined;
  readonly auto: boolean;
  readonly brand: Brand | undefined;
  readonly props: FrameOptions<S>;
}) {
  return (
    <div data-embed-content="" style={auto ? { flex: "0 0 auto", background: "var(--graview-ground)" } : { flex: "1 1 auto", minHeight: 0, overflow: "auto", background: "var(--graview-ground)" }}>
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
            views,
            settings: props.app.settings ?? [],
            ...(presence ? { presence } : {}),
            ...(brand ? { brand } : {}),
            ...(props.principal ? { principal: props.principal } : {}),
            ...(props.seats ? { seats: props.seats } : {}),
            ...(props.people ? { people: props.people } : {}),
          }}
          {...(props.pages ? { registry: props.pages } : {})}
          initialPath={props.path ?? "/"}
        />
      </div>
    </div>
  );
}
