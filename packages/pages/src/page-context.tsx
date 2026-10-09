import { sceneTitle, type AnySchema, type Brand, type Person, type Principal, type Store, type PresenceChannel, type SettingDeclaration } from "@graview/core";
import { useCallback, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { KeepLensHost, ReactViewRegistry } from "@graview/react/provider";


/**
 * The default pages: the product's own site, derived.
 *
 * Traditional on purpose — lists, records, links, forms, the paradigms
 * people already know — but in the POSTURE of a good web page rather than a
 * back office: every route opens with the thing itself, titled in the
 * brand's display face and summarized in the app's own declared words, and
 * the controls recede beneath the content. Nothing here is a template for
 * any one app. It is all read off the declaration, which is what lets one
 * component set read as a household's week, a bid document and a team
 * sheet — and every component is a default registration an app can replace
 * cell by cell, the same move as replacing a view.
 */

export interface PageContext<S extends AnySchema> {
  readonly store: Store<S>;
  readonly principal?: Principal;
  /**
   * The seats a person may sit in, by the names they are offered under — so
   * the history can name another seat's work by that name rather than by
   * the principal's id, where the app has no installation to look it up in.
   */
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  /** Who else the history may name: a host's directory, which offers nobody a seat (FR-13). */
  readonly people?: readonly Person[];
  readonly brand?: Brand;
  /** Where the spatial face lives, for the cross-links. Default "/". */
  readonly sceneHref?: string;
  readonly invariantContext?: Readonly<Record<string, unknown>>;
  /**
   * Whether this browser remembers the edits (a ship browser adapter behind
   * the store). When it does, the face says so and offers the way back to
   * the example — the `fresh=1` address `@graview/ship` reads.
   */
  readonly remembers?: boolean;
  /**
   * Whether the face is inside somebody else's page. A standalone face owns
   * its document and its pages are its <main>; embedded, the host owns the
   * landmarks and the face's pages are plain regions of it.
   */
  readonly embedded?: boolean;
  /**
   * Whether a shell of the app's own is already around these pages.
   *
   * A design's shell owns the document's landmark — `graview-pages` says so
   * in as many words — and the framework's own pages went on wrapping
   * themselves in `PageMain` underneath it, so every route the design left
   * derived had a main inside a main. Set by the router from the registry,
   * never by an app: it is the same question `embedded` asks (does somebody
   * above me own the landmark) with a different somebody.
   */
  readonly framed?: boolean;
  /**
   * WHETHER THE APP BAR IS ABOVE THE FACE (FR-131): the embed's, which says
   * the app's name, its places, Find, the standing and the person. The
   * derived shell then draws no header of its own — nothing on the bar is
   * said twice — and the face's Find box goes in the bar.
   */
  readonly barAbove?: boolean;
  /**
   * The level each page's own title is said at (FR-131): one below the
   * app's name on the bar — `2` when the bar's is the page's `h1`, the
   * default; deeper when the host says the app's name lower down; `1`
   * under a shell of the app's own that says no heading of its own.
   */
  readonly titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * THE WAY TO THE OVERVIEW FROM A PAGE (FR-132), when the scene is drawn by
   * whoever holds this face: handed a stop, it goes there. Without it a
   * face that owns its page links to `sceneHref`, and an embedded one that
   * draws no scene offers none.
   */
  readonly overview?: (stop: string) => void;
  /**
   * THE APP'S PICTURES. The view registry the scene draws from; given, every
   * registered place is a page on this face too — an index at `/places`,
   * each lens at `/places/<as>` — the home leads with them, each kind's page
   * lists its own, and the nav mirrors the scene's bar. Absent, the face is
   * the derived site it always was. A registry means a provider under the
   * routes (the same one the embed puts there), so a lens's hooks work with
   * no scene at all.
   */
  readonly views?: ReactViewRegistry<S>;
  /** The reader's own settings, for the provider under the pages when `views` is given. */
  readonly settings?: readonly SettingDeclaration[];
  /** Who else is here, for the same provider. */
  readonly presence?: PresenceChannel;
  /**
   * Where a lens the seat drew is kept (`onKeepLens`): handed the
   * check-clean `add-lens` edit, and `remove-lens` to take it back. A host
   * that writes the declaration answers `{ kept: true }`; otherwise the
   * lens is the reader's own.
   */
  readonly onKeepLens?: KeepLensHost;
}

/**
 * WHERE A THING STANDS IN THE SCENE (FR-132, FR-137): a link from a page to
 * the scene at a stop — a record in focus, a picture in place. Through the
 * embed's own way when the face is in one that draws the scene; to the
 * scene's address when the face owns its page; nowhere, and nothing drawn,
 * when there is no scene to go to.
 */
export function SceneLink<S extends AnySchema>({
  context,
  stop,
  title,
  style,
  className,
  children,
  ...rest
}: {
  readonly context: PageContext<S>;
  readonly stop: string;
  readonly title?: string;
  readonly style?: CSSProperties;
  /** A design's own class for the link. */
  readonly className?: string;
  readonly children?: ReactNode;
} & Record<`data-${string}`, string>) {
  const label = sceneTitle(context.views?.arrangement?.());
  const words = children ?? `In ${label === "Scene" ? "the scene" : label.replace(/^The /, "the ")} ↗`;
  if (context.overview) {
    const go = context.overview;
    return (
      <a
        href={stop}
        {...rest}
        {...(title ? { title } : {})}
        style={style}
        {...(className ? { className } : {})}
        onClick={(event) => {
          event.preventDefault();
          go(stop);
        }}
      >
        {words}
      </a>
    );
  }
  if (context.embedded) return null;
  return (
    <a href={`${context.sceneHref ?? "/"}${stop}`} {...rest} {...(title ? { title } : {})} style={style} {...(className ? { className } : {})}>
      {words}
    </a>
  );
}

/** The way back to the example, for a face whose browser remembers. */
export function StartFreshLink() {
  return (
    <a
      href="#fresh"
      data-testid="start-fresh"
      title="Forget every edit made in this browser and return to the example"
      onClick={(event) => {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("fresh", "1");
        window.location.assign(url.toString());
      }}
      /*
       * A TARGET, not just a phrase. Inline text at 12.5px is a 15-pixel
       * target — under the 24 WCAG 2.2 asks for, and the only control on the
       * routed face that was: it sits in the footer of every page of every
       * app, so every page of the pages face had exactly one control too
       * small to hit.
       */
      style={{
        color: "inherit",
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
      }}
    >
      Start fresh
    </a>
  );
}

/** Re-render on every applied diff — the page face is as live as the scene. */
export function useStoreTick<S extends AnySchema>(store: Store<S>): number {
  // The version bumps INSIDE the subscription, so the snapshot is stable
  // between diffs — a snapshot that changed on every read would re-render
  // for ever.
  const version = useRef(0);
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(() => {
        version.current += 1;
        listener();
      }),
    [store],
  );
  return useSyncExternalStore(subscribe, () => version.current, () => 0);
}
