import { Store, type AnySchema, type Brand, type GraviewApp, type Person, type Place, type PresenceChannel, type Principal } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, withFocus, withOverview, type ViewState } from "@graview/layout";
import { PagesApp, PlacePicture, type PageComponent, type PageRegistry } from "@graview/pages";
import { Companion, Inspector, OverviewButton, Places, Profile, ShowInstallation, Standing, descentTarget, registerDefaultViews, themeCss, useWidth } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import {
  createViews,
  GraviewProvider,
  Scene,
  useGraview,
  useNavigation,
  type ReaderMemory,
  type Scheme,
  type ReactViewRegistry,
  useTheKeyboardLandsSomewhere,
} from "@graview/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { fontsLink } from "./fonts.js";

/**
 * A GRAVIEW IN SOMEBODY ELSE'S PAGE.
 *
 * The Shell assumes it owns the window: the viewport is its height, the
 * document is its theme, the address bar is its view state. An embed owns
 * one element. So the theme is scoped to that element, the panes size
 * against the picture's own box, the routed face runs on a memory router,
 * the store lives in memory and starts from the seed, and the view state is
 * a prop rather than a URL. Everything else — the scene, the rails, the
 * inspector, the pages — is the framework's own, unchanged.
 */
/**
 * The faces. `picture` is ONE NAMED LENS AND NOTHING ELSE — the place the
 * stop names (`#view=the-week`), drawn at full size over the kind's current
 * members, with no bar, no rail, no standing: a page that is about a lens
 * shows the lens, not an app with the lens somewhere inside it.
 */
export type EmbedFace = "scene" | "graview" | "pages" | "picture";

/**
 * WHAT A HOST SAYS ABOUT ITS FRAME (FR-13). A chat's widget is told its
 * theme by the chat, over `postMessage` (MCP Apps' `hostContext.theme`,
 * ChatGPT's `openai.theme`), not by a `data-theme` on a document it owns.
 * The embed takes the theme from here before it looks at the page.
 */
export interface EmbedHostContext {
  readonly theme?: Scheme;
}

/**
 * A STORE THAT LIVES SOMEWHERE ELSE: what `openRemote` from
 * `@graview/ship` returns, or any host's own with the same two parts. The
 * embed acts through its store and draws who is here from its channel.
 */
export interface EmbedRemote<S extends AnySchema = AnySchema> {
  readonly store: Store<S>;
  readonly presence?: PresenceChannel;
}

/** The scene and the Graview's height when the embed sizes itself to its content (`height: "auto"`). */
export const AUTO_SCENE_HEIGHT = 480;

export interface EmbedOptions<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The graph to open with. Nothing means the empty city. */
  readonly seed?: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  /** Which face to show. */
  /** Which face to open on. Omitted, the stop decides: altitude opens the Graview, anything else the scene. */
  readonly face?: EmbedFace;
  /** The scene's view state, as the fragment the app itself would put in its address bar. */
  readonly stop?: string;
  /** For the pages face: the path to open, within the app's own routes. */
  readonly path?: string;
  readonly principal?: Principal;
  /**
   * WHO ELSE IS HERE, if the host wants that: an embed broadcasts nothing
   * and draws nobody unless it is handed a channel — a page that puts a
   * graph on it is not thereby a page that tells its readers about each
   * other.
   */
  readonly presence?: PresenceChannel;
  /**
   * The seats a reader may take, when the page wants the policy to be felt
   * rather than read: each is a name and a principal, shown on the strip and
   * pressed while it is at the keyboard. The strip, the pages and the acts
   * all narrow to the seat, so what a gardener may not do is struck through
   * the moment a gardener sits down.
   */
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  /**
   * WHO THE APP MAY NAME, apart from the seats (FR-13). A hosted app knows
   * its members and the agents that act in it; listing them as seats
   * offered every reader the chance to sit as each of them. A directory
   * names authors in the rail, the pages and presence, and offers no seat.
   * `setPeople` changes it after mount, for an agent who first acts later.
   */
  readonly people?: readonly Person[];
  /** "auto" follows the host: the host context's theme, else the page's `data-theme` stamp, else the system's preference, as each changes. */
  readonly scheme?: Scheme | "auto";
  /** What the host says about its frame: a chat widget's theme. `setHostContext` follows it as it changes. */
  readonly hostContext?: EmbedHostContext;
  /** Defaults to the app's own brand. */
  readonly brand?: Brand;
  /** A store to share; otherwise one is made from the app and the seed. */
  readonly store?: Store<S>;
  /**
   * A store that lives on a server (`await openRemote(...)`): its store is
   * the embed's store, and its presence the embed's channel unless
   * `presence` names another. The host opened it and closes it.
   */
  readonly remote?: EmbedRemote<S>;
  /**
   * WHERE THE READER'S OWN CHOICES ARE KEPT: text size, motion, what they
   * share, this tab's session. The page's storage by default, and nothing
   * is lost but the remembering where a sandboxed frame refuses it; a host
   * that keeps them itself passes any `getItem`/`setItem` object.
   */
  readonly memory?: ReaderMemory;
  /** How long somebody a presence channel told of stands without a fresh word. Default `REMOTE_PRESENCE_TTL_MS`. */
  readonly presenceTtlMs?: number;
  /** Views beyond the derived defaults. */
  /*
   * The app's OWN registry, in the app's own schema.
   *
   * This was typed as `ReturnType<typeof registerDefaultViews>`, which erases
   * to `AnySchema` — so a project passing the `views()` it wrote for its own
   * declaration, which is the only thing this option is for, was a type
   * error with eleven lines of variance in it.
   */
  readonly views?: (schema: S) => ReactViewRegistry<S>;
  /** The pages face's own pages, over the derived defaults. */
  readonly pages?: PageRegistry<S, PageComponent<S>>;
  /** The face switcher and Standing, above the picture. Default on. */
  readonly toggle?: boolean;
  /** Fetch the brand's fonts. Default on; off when the host already has them. */
  readonly fonts?: boolean;
  /**
   * The embed's height; the element's own by default. `"auto"` sizes it to
   * its content: the pages face grows with its page, and the scene and the
   * Graview take `AUTO_SCENE_HEIGHT`. A frame that is sized from its content
   * (a chat's widget) wants `"auto"` and `onIntrinsicHeight`.
   */
  readonly height?: number | string;
  /**
   * THE HEIGHT THE EMBED ASKS FOR, as it changes (FR-13): the strip and the
   * whole page under it on the pages face, the strip and the picture's box
   * on the others. A widget forwards it to its host (MCP Apps'
   * `ui/notifications/size-changed`, ChatGPT's `notifyIntrinsicHeight`).
   */
  readonly onIntrinsicHeight?: (height: number) => void;
  /**
   * Below this width the scene and the Graview give way to the pages face,
   * and come back above it. A phone's chat is no place for a map. Off by default.
   */
  readonly pagesBelow?: number;
  /** What Standing says when nothing is wrong. */
  readonly standing?: string;
  /**
   * What this embed is called, for assistive technology. Several Graviews
   * on one page each carry the same landmarks — the relation key, the
   * inspector, the pages' navigation — and a landmark has to be unique by
   * role and name; every landmark inside is named after the embed.
   */
  readonly label?: string;
}

export interface EmbedProps<S extends AnySchema = AnySchema> extends EmbedOptions<S> {
  /** Called when the strip's switcher is pressed; the host decides the face. */
  readonly onFace?: (face: EmbedFace) => void;
  /** Called when a seat on the strip is pressed; the host decides who sits. */
  readonly onSeat?: (principal: Principal) => void;
}

let sequence = 0;

/** A store from a declaration and a seed: the app's own policy, in memory. */
function storeOf<S extends AnySchema>(app: GraviewApp<S>, seed: EmbedOptions<S>["seed"]): Store<S> {
  return new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(seed ? { snapshot: seed as never } : {}),
    ...(app.policy ? { policy: app.policy } : {}),
    ...(app.intelligence ? { intelligence: app.intelligence } : {}),
  } as never);
}

/**
 * The scene's view for a face and a stop.
 *
 * A STOP THAT NAMES A PLACE GOES THERE HERE TOO. `#view=the-season` is the
 * link a page can write — `placeHref` spells it — and the scene's URL sync
 * has resolved it to the group the place is a picture of since it existed.
 * The embed read its `stop` through `fromUrl` alone, so a host page saying
 * `data-stop="#view=the-season"` landed at the default view with the
 * season's pill unpressed: the pasted-link problem, one level up again.
 */
function viewFor(face: EmbedFace, stop: string | undefined, kinds: readonly string[], places: readonly Place[]): ViewState {
  const parsed = stop ? fromUrl(stop) : EMPTY_VIEW;
  const named = parsed.within?.["view"];
  const place = named !== undefined && !parsed.focusId ? places.find((candidate) => candidate.as === named) : undefined;
  const asked = place ? { ...parsed, focusId: aggregateId(place.kind) } : parsed;
  if (face === "graview") return withOverview(asked, true);
  if (asked.overview) return withFocus(withOverview(asked, false), descentTarget(asked, kinds));
  return asked;
}

/** The face a stop implies: a stop at altitude opens the Graview. */
export function faceOf(stop: string | undefined): EmbedFace {
  return stop && fromUrl(stop).overview ? "graview" : "scene";
}

/** The host page's scheme: an explicit `data-theme`, else the system's preference. */
export function hostScheme(): Scheme {
  if (typeof document === "undefined") return "light";
  const stamped = document.documentElement.dataset["theme"];
  if (stamped === "dark" || stamped === "light") return stamped;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * THE HOST PAGE'S SCHEME, AS IT CHANGES. Read once, an embed kept the
 * scheme the page had when it mounted: a host that stamps `data-theme` when
 * its own toggle is pressed (or a widget's glue, when the chat says the
 * theme changed) left the embed in the other one.
 */
function useHostScheme(follow: boolean): Scheme {
  const [scheme, setScheme] = useState<Scheme>(() => hostScheme());
  useEffect(() => {
    if (!follow || typeof document === "undefined") return;
    const read = () => setScheme(hostScheme());
    read();
    const stamped = new MutationObserver(read);
    stamped.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    media?.addEventListener?.("change", read);
    return () => {
      stamped.disconnect();
      media?.removeEventListener?.("change", read);
    };
  }, [follow]);
  return scheme;
}

/** Element heights, read the one way a ResizeObserver also reads them. */
const heightOf = (element: Element | null | undefined): number => (element ? element.getBoundingClientRect().height : 0);

/**
 * THE HEIGHT THE EMBED ASKS FOR, told as it changes (FR-13). A chat's
 * widget frame is sized from its content, and an embed that filled
 * whatever box it was given had no height of its own to say: the frame
 * stayed at its first guess. The pages face asks for the strip and the
 * whole page; the other faces for the strip and the picture's box.
 */
function useIntrinsicHeight(rootRef: { readonly current: HTMLElement | null }, face: EmbedFace, onHeight: ((height: number) => void) | undefined): void {
  const told = useRef(onHeight);
  told.current = onHeight;
  const wanted = onHeight !== undefined;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !wanted) return;
    const parts = () => {
      const children = [...root.children];
      const strip = children.find((child) => child.hasAttribute("data-embed-strip"));
      const content = children.find((child) => child.hasAttribute("data-embed-content"));
      const measure = content?.querySelector("[data-embed-measure]") ?? null;
      return { strip, content, measure };
    };
    let last = -1;
    const report = () => {
      const { strip, content, measure } = parts();
      const height = Math.ceil(heightOf(strip) + (measure ? heightOf(measure) : heightOf(content)));
      if (height === last) return;
      last = height;
      told.current?.(height);
    };
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    const watch = () => {
      observer.disconnect();
      const { strip, content, measure } = parts();
      for (const element of [root, strip, content, measure]) if (element) observer.observe(element);
    };
    watch();
    // The strip comes and goes with the face's own children; a page that
    // routes changes size inside the measured box, which the observer sees.
    const swapped = new MutationObserver(() => {
      watch();
      report();
    });
    swapped.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      swapped.disconnect();
    };
  }, [rootRef, face, wanted]);
}

export function Embed<S extends AnySchema>(props: EmbedProps<S>) {
  const {
    app,
    seed,
    face = faceOf(props.stop),
    stop,
    path = "/",
    principal,
    scheme: askedScheme = "auto",
    brand = app.brand,
    toggle = true,
    fonts = true,
    height = "100%",
    standing = "Everything is in order",
    pages,
    label,
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(rootRef);
  const scope = useMemo(() => `graview-embed-${++sequence}`, []);
  /*
   * ONE STORE ACROSS THE SEATS. Who is at the keyboard is the provider's
   * business, not the store's: with the principal in these dependencies a
   * seat change made a fresh store from the seed, and a React host that sat
   * somebody else down lost every edit and the history with them.
   */
  const store = useMemo(() => props.store ?? props.remote?.store ?? storeOf(app, seed), [props.store, props.remote, app, seed]);
  const presence = props.presence ?? props.remote?.presence;
  const views = useMemo(
    () => (props.views ? props.views(app.schema) : registerDefaultViews(app.schema, createViews(app.schema))) as never,
    [props.views, app.schema],
  );
  const kinds = app.schema.kinds as readonly string[];
  // The first view only: after it, where the reader goes is theirs.
  const initialView = useMemo(() => viewFor(face, stop, kinds, (views as ReactViewRegistry<S>).places()), []);
  const told = props.hostContext?.theme;
  const followed = useHostScheme(askedScheme === "auto" && told === undefined);
  const scheme: Scheme = askedScheme === "auto" ? (told ?? followed) : askedScheme;
  /*
   * NARROW, THE PAGES (FR-13). Below `pagesBelow` the scene and the Graview
   * give way to the routed face, and come back when there is room: the
   * face the host asked for is kept, only what is drawn changes.
   */
  const width = useWidth(rootRef);
  const narrow = props.pagesBelow !== undefined && width !== null && width < props.pagesBelow && (face === "scene" || face === "graview");
  const shown: EmbedFace = narrow ? "pages" : face;
  const auto = height === "auto";
  useIntrinsicHeight(rootRef, shown, props.onIntrinsicHeight);
  const css = useMemo(() => themeCss(scheme, brand, { scope: `.${scope}` }), [scheme, brand, scope]);

  // The brand's fonts, fetched once per family set, without the host's help.
  useEffect(() => {
    if (!fonts || typeof document === "undefined") return;
    const href = fontsLink(brand);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [brand, fonts]);

  // Landmarks inside, named after the embed — kept so through re-renders.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !label) return;
    const name = (el: Element) => {
      const own = el.getAttribute("aria-label") ?? "";
      if (own.startsWith(`${label} · `)) return;
      // Named the same thing: "The pipeline · The pipeline" is one name said
      // twice, not a place inside a place. A region of that name IS the
      // embed's region, so it stops being a second landmark (two regions of
      // one name is axe's `landmark-unique`) and stays a named group.
      if (own === label) {
        if (el.getAttribute("role") === "region") el.setAttribute("role", "group");
        return;
      }
      el.setAttribute("aria-label", own ? `${label} · ${own}` : label);
    };
    // The root is the embed's own region and already wears the label; the
    // sweep names what is INSIDE it.
    const sweep = () => root.querySelectorAll("aside, nav, main, header, footer, [role=region], [role=complementary], [role=navigation]").forEach(name);
    sweep();
    const observer = new MutationObserver(sweep);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
    return () => observer.disconnect();
  }, [label]);

  /*
   * THE EMBED IS ITSELF A LANDMARK.
   *
   * `label` named every landmark INSIDE ("Chapter 13 · Places") and left the
   * root a plain div — so on somebody else's page the strip, the seats and
   * the picture sat outside any landmark at all (axe `region`), and a reader
   * moving by landmark could not reach the app, let alone tell two of them
   * apart at the top. A named region is what the label was for.
   *
   * Without a label it takes the app's own name, and two unlabelled embeds
   * of one app are then two regions with one name — which is the ambiguity
   * the docs warn about, said out loud by `landmark-unique` instead of
   * silently.
   */
  return (
    <section
      ref={rootRef}
      className={scope}
      aria-label={label ?? app.name}
      data-graview-embed={shown}
      data-graview-scheme={scheme}
      {...(narrow ? { "data-graview-embed-narrow": "" } : {})}
      style={{ position: "relative", height, minHeight: auto ? 0 : 320, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--graview-radius, 12px)" }}
    >
      <style>{css}</style>
      <GraviewProvider
        store={store}
        views={views}
        initialView={initialView}
        scheme={scheme}
        {...(brand ? { brand } : {})}
        {...(principal ? { principal } : {})}
        /* The seats, so every surface under the provider names a seat as it was offered (W-114). */
        {...(props.seats ? { seats: props.seats } : {})}
        {...(presence ? { presence } : {})}
        {...(props.people ? { people: props.people } : {})}
        {...(props.memory ? { memory: props.memory } : {})}
        {...(props.presenceTtlMs !== undefined ? { presenceTtlMs: props.presenceTtlMs } : {})}
        /* The reader's own text size and motion, on somebody else's page
           too: the answer lives on the browser, not on the installation. */
        settings={app.settings ?? []}
      >
        <Faces face={shown} stop={stop} kinds={kinds} places={(views as ReactViewRegistry<S>).places()} />
        {toggle && shown !== "picture" ? <Strip app={app as unknown as GraviewApp<AnySchema>} face={shown} narrow={narrow} onFace={props.onFace} standing={standing} seats={props.seats} principal={principal} onSeat={props.onSeat} /> : null}
        {shown === "picture" ? (
          /*
           * The lens fills the frame: a one-row grid stretches it to the
           * height it was given, and it scrolls inside itself past that.
           */
          <div
            data-testid="embed-picture"
            data-embed-content=""
            // A region that may scroll has to be reachable by keyboard, and a
            // reachable region has to say what it is: the picture's own name.
            tabIndex={0}
            aria-label={
              (views as ReactViewRegistry<S>).places().find((place) => place.as === (stop ? fromUrl(stop).within?.["view"] : undefined))?.title ?? "The picture"
            }
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
            <PlacePicture<S> store={store} views={views as ReactViewRegistry<S>} as={(stop ? fromUrl(stop).within?.["view"] : undefined) ?? ""} />
          </div>
        ) : shown === "pages" ? (
          /*
           * The page scrolls inside the embed's box, unless the embed is
           * sized from its content: then the page is as tall as it is, and
           * the height the host is told is the whole of it.
           */
          <div data-embed-content="" style={auto ? { flex: "0 0 auto", background: "var(--graview-ground)" } : { flex: "1 1 auto", minHeight: 0, overflow: "auto", background: "var(--graview-ground)" }}>
            <div data-embed-measure="" style={{ display: "flow-root" }}>
              <PagesApp<S>
                context={{
                  store,
                  embedded: true,
                  ...(brand ? { brand } : {}),
                  ...(principal ? { principal } : {}),
                  ...(props.seats ? { seats: props.seats } : {}),
                  ...(props.people ? { people: props.people } : {}),
                }}
                {...(pages ? { registry: pages } : {})}
                initialPath={path}
              />
            </div>
          </div>
        ) : (
          <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
            <Scene renderer="dom" />
            <OverviewButton />
            {/* One panel on the frame — the acts, the relations, the seat, the key. */}
            <Companion<S> />
            <Inspector placement="menu" />
          </div>
        )}
      </GraviewProvider>
    </section>
  );
}

/** Keeps the scene's view in step with the face and stop props. */
function Faces({ face, stop, kinds, places }: { face: EmbedFace; stop: string | undefined; kinds: readonly string[]; places: readonly Place[] }) {
  const { view, go } = useNavigation();
  const last = useRef({ face, stop });
  // A layout effect, so a face set through the handle is on the page when
  // the handle's call returns rather than one tick later.
  useLayoutEffect(() => {
    const stopChanged = last.current.stop !== stop;
    const faceChanged = last.current.face !== face;
    const wasPages = last.current.face === "pages";
    last.current = { face, stop };
    if (!stopChanged && !faceChanged) return;
    // The pages face has no view, and a picture is its stop; a stop set
    // while there lands when the scene comes back. Otherwise a face change
    // keeps where you were and only rises or descends.
    if (face === "pages" || face === "picture") return;
    const next =
      (stopChanged || wasPages) && stop !== undefined
        ? viewFor(face, stop, kinds, places)
        : face === "graview"
          ? withOverview(view, true)
          : view.overview
            ? withFocus(withOverview(view, false), descentTarget(view, kinds))
            : view;
    go(next);
  }, [face, stop, kinds, view, go]);
  return null;
}

function Strip({
  app,
  face,
  narrow = false,
  onFace,
  standing,
  seats,
  principal,
  onSeat,
}: {
  /** The declaration this embed is running, for the way into the studio. */
  app: GraviewApp<AnySchema>;
  face: EmbedFace;
  /** Narrower than `pagesBelow`: the pages are the only face there is room for, so there is nothing to switch. */
  narrow?: boolean;
  onFace?: ((face: EmbedFace) => void) | undefined;
  standing: string;
  seats?: EmbedOptions["seats"] | undefined;
  principal?: Principal | undefined;
  onSeat?: ((principal: Principal) => void) | undefined;
}) {
  const { brand } = useGraview();
  const sameSeat = (a: Principal | undefined, b: Principal) => a !== undefined && a.id === b.id && a.kind === b.kind;
  /*
   * COMPACT BELOW A PHONE'S WIDTH: the places and the seats as one select
   * each rather than a pill per name. At 360px the pills wrapped to five
   * rows and the strip was taller than the picture under it.
   */
  const strip = useRef<HTMLDivElement>(null);
  const width = useWidth(strip);
  const compact = width !== null && width < 560;
  // Two faces, not three: altitude is the scene's own control, on the
  // picture, and a third pill for it here said the same thing twice.
  const faces: readonly { id: EmbedFace; label: string; title: string; pressed: boolean }[] = [
    { id: "scene", label: "Scene", title: "The picture — rise and descend on it", pressed: face !== "pages" },
    { id: "pages", label: "Pages", title: "The same app as ordinary pages", pressed: face === "pages" },
  ];
  return (
    <div
      ref={strip}
      role="group"
      aria-label="Face"
      data-testid="embed-faces"
      data-embed-strip={compact ? "compact" : "full"}
      style={{
        display: "flex",
        alignItems: "center",
        // Wraps rather than clips: at a phone's width Standing takes the
        // next line instead of losing its last word.
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 12px",
        flex: "0 0 auto",
        borderBottom: "1px solid var(--graview-edge)",
        background: "var(--graview-bar)",
        fontSize: "0.875rem",
      }}
    >
      <span style={{ fontFamily: "var(--graview-font-display)", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.75rem", marginRight: 6 }}>
        {brand?.name ?? "Graview"}
      </span>
      {(narrow ? [] : faces).map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          aria-pressed={candidate.pressed}
          data-testid={`embed-face-${candidate.id}`}
          title={candidate.title}
          onClick={() => onFace?.(candidate.id)}
          style={{
            padding: "3px 11px",
            borderRadius: 999,
            fontSize: "0.875rem",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: candidate.pressed ? "var(--graview-accent)" : "var(--graview-edge)",
            color: candidate.pressed ? "var(--graview-accent)" : "var(--graview-ink-muted)",
            background: candidate.pressed ? "var(--graview-panel)" : "transparent",
          }}
        >
          {candidate.label}
        </button>
      ))}
      {/* The named pictures over the graph — a lens is somewhere to go, by name. */}
      {face !== "pages" ? <Places compact={compact} /> : null}
      {face !== "pages" ? <ShowInstallation /> : null}
      {/* And the app's own declaration, for the seat that keeps it — inside
          the embed's box, because a studio that escaped onto somebody
          else's page would be the rudest thing this package could do. */}
      {face !== "pages" ? <StudioPlace app={app} within="box" /> : null}
      {/* Who is at the keyboard, and the reader's own settings. The seats
          keep their own control beside it, because the HOST owns which one
          is taken here — the pane says who that turned out to be. */}
      <Profile />
      {seats && seats.length > 1 && compact ? (
        <select
          aria-label="Seat"
          data-testid="embed-seats"
          value={seats.find((seat) => sameSeat(principal, seat.principal))?.principal.id ?? ""}
          onChange={(event) => {
            const seat = seats.find((candidate) => candidate.principal.id === event.target.value);
            if (seat) onSeat?.(seat.principal);
          }}
          style={{
            minHeight: 24,
            maxWidth: "46%",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: "0.875rem",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "var(--graview-accent)",
            color: "var(--graview-accent)",
            background: "var(--graview-panel)",
          }}
        >
          {seats.map((seat) => (
            <option key={seat.principal.id} value={seat.principal.id}>
              As {seat.label}
            </option>
          ))}
        </select>
      ) : seats && seats.length > 1 ? (
        <div role="group" aria-label="Seat" data-testid="embed-seats" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
          <span style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>As</span>
          {seats.map((seat) => {
            const pressed = sameSeat(principal, seat.principal);
            return (
              <button
                key={seat.principal.id}
                type="button"
                aria-pressed={pressed}
                data-testid={`embed-seat-${seat.principal.id}`}
                title={`Sit down as ${seat.label}: the strip, the pages and the acts narrow to what this seat may do`}
                onClick={() => onSeat?.(seat.principal)}
                style={{
                  padding: "3px 11px",
                  borderRadius: 999,
                  fontSize: "0.875rem",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: pressed ? "var(--graview-accent)" : "var(--graview-edge)",
                  color: pressed ? "var(--graview-accent)" : "var(--graview-ink-muted)",
                  background: pressed ? "var(--graview-panel)" : "transparent",
                }}
              >
                {seat.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div style={{ marginLeft: "auto", minWidth: 0 }}>
        <Standing clean={standing} />
      </div>
    </div>
  );
}

export interface EmbedHandle {
  setFace(face: EmbedFace): void;
  setStop(stop: string): void;
  setScheme(scheme: Scheme): void;
  /** Put another principal at the keyboard; the store and its history stay. */
  setSeat(principal: Principal): void;
  /** Offer other seats, or none: a seat switcher is drawn only for two or more. */
  setSeats(seats: EmbedOptions["seats"]): void;
  /** Name other people: an agent who first acts after the page opened is named from the next render. */
  setPeople(people: readonly Person[]): void;
  /** What the host now says about its frame: the chat's theme changed, say. */
  setHostContext(context: EmbedHostContext): void;
  /** Re-dress the embed: another brand, or the same brand with a different kit. */
  setBrand(brand: Brand | undefined): void;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

interface Setters {
  face(face: EmbedFace): void;
  stop(stop: string): void;
  scheme(scheme: Scheme): void;
  seat(principal: Principal): void;
  seats(seats: EmbedOptions["seats"]): void;
  people(people: readonly Person[]): void;
  hostContext(context: EmbedHostContext): void;
  brand(brand: Brand | undefined): void;
}

/**
 * Mounts an app into an element and hands back the controls. The first
 * render is synchronous, so what comes back is already on the page.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: EmbedOptions<S>): EmbedHandle {
  const store = options.store ?? options.remote?.store ?? storeOf(options.app, options.seed);
  let setters: Setters | null = null;
  function Host() {
    const [face, setFace] = useState<EmbedFace>(options.face ?? faceOf(options.stop));
    const [stop, setStop] = useState<string | undefined>(options.stop);
    const [scheme, setScheme] = useState<Scheme | "auto">(options.scheme ?? "auto");
    const [principal, setSeat] = useState<Principal | undefined>(options.principal);
    const [seats, setSeats] = useState<EmbedOptions["seats"]>(options.seats);
    const [people, setPeople] = useState<readonly Person[] | undefined>(options.people);
    const [hostContext, setHostContext] = useState<EmbedHostContext | undefined>(options.hostContext);
    const [brand, setBrand] = useState<Brand | undefined>(options.brand);
    setters = { face: setFace, stop: setStop, scheme: setScheme, seat: setSeat, seats: setSeats, people: setPeople, hostContext: setHostContext, brand: setBrand };
    return (
      <Embed<S>
        {...options}
        store={store as never}
        face={face}
        {...(stop !== undefined ? { stop } : {})}
        {...(principal ? { principal } : {})}
        {...(seats ? { seats } : {})}
        {...(people ? { people } : {})}
        {...(hostContext ? { hostContext } : {})}
        {...(brand ? { brand } : {})}
        scheme={scheme}
        onFace={setFace}
        onSeat={setSeat}
      />
    );
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setFace: (face) => flushSync(() => setters?.face(face)),
    setStop: (stop) => flushSync(() => setters?.stop(stop)),
    setScheme: (scheme) => flushSync(() => setters?.scheme(scheme)),
    setSeat: (principal) => flushSync(() => setters?.seat(principal)),
    setSeats: (seats) => flushSync(() => setters?.seats(seats)),
    setPeople: (people) => flushSync(() => setters?.people(people)),
    setHostContext: (context) => flushSync(() => setters?.hostContext(context)),
    setBrand: (brand) => flushSync(() => setters?.brand(brand)),
    unmount: () => root.unmount(),
  };
}


/**
 * Mount each element as the reader comes near it.
 *
 * Twelve applications at once is a lot to ask of a first paint; each mounts
 * when the reader is a screen away, and stays. A sweep on scroll rather than
 * an IntersectionObserver: a fast scroll can jump an element through the
 * observer's margin between two of its checks, and a picture that stayed
 * "loading…" because the reader scrolled quickly is worse than a sweep that
 * costs one rectangle per element per frame.
 */
export function mountWhenNear(
  elements: Iterable<HTMLElement>,
  mountOne: (element: HTMLElement) => void,
  options: { readonly near?: number } = {},
): () => void {
  const near = options.near ?? 900;
  const waiting = new Set(elements);
  let pending = false;
  const sweep = () => {
    pending = false;
    for (const element of waiting) {
      const rect = element.getBoundingClientRect();
      // Near below, on screen, or already scrolled past: all of these are
      // places a reader can be looking at next.
      if (rect.top < innerHeight + near && rect.bottom > -near) {
        waiting.delete(element);
        mountOne(element);
      }
    }
  };
  const later = () => {
    if (pending || waiting.size === 0) return;
    pending = true;
    requestAnimationFrame(sweep);
  };
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", later, { passive: true });
  sweep();
  return () => {
    removeEventListener("scroll", later);
    removeEventListener("resize", later);
  };
}
