import type { AnySchema, Brand, GraviewApp, Person, Place, Principal, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, withFocus, withOverview, type ViewState } from "@graview/layout";
import { PlacePicture } from "@graview/pages";
import { Companion, Inspector, OverviewButton, Places, ShowInstallation, VISUALLY_HIDDEN, descentTarget, useWidth } from "@graview/primitives";
import type { StudioOffered, StudioOnApply } from "@graview/studio";
import { ErrorReportContext, GraviewProvider, Scene, useNavigation, type ErrorReport, type Scheme, type ReactViewRegistry } from "@graview/react";
import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  FaceBoundary,
  PagesContent,
  providerProps,
  storeOf,
  Strip,
  useErrorReport,
  useFrame,
  useIntrinsicHeight,
  useReady,
  useViews,
  type EmbedFace,
  type EmbedHostContext,
  type FrameOptions,
} from "./frame.js";

/*
 * THE STUDIO, WHEN IT IS TURNED ON. Imported outright, it was about 104 kB
 * minified of every embed — `studio: false` included, which never draws
 * it. A product's bundler splits it off here, and a page fetches it only
 * when an embed offers the studio; until it arrives, the strip simply has
 * no studio on it yet.
 */
const StudioPlace = lazy(() => import("@graview/studio").then((studio) => ({ default: studio.StudioPlace })));

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

/** The scene and the Graview's height when the embed sizes itself to its content (`height: "auto"`). */
export const AUTO_SCENE_HEIGHT = 480;

export interface EmbedOptions<S extends AnySchema = AnySchema> extends FrameOptions<S> {
  /** Which face to open on. Omitted, the stop decides: altitude opens the Graview, anything else the scene. */
  readonly face?: EmbedFace;
  /** The scene's view state, as the fragment the app itself would put in its address bar. */
  readonly stop?: string;
  /**
   * THE WORKBENCH'S HEADING (FR-25): the level the embed's name is said at,
   * for a reader moving by headings — `1` when the host's page is the app,
   * `2` (the default) inside somebody else's article, `false` when the
   * host's own heading already names it. The pages face brings its own.
   */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /**
   * Below this width the scene and the Graview give way to the pages face,
   * and come back above it. A phone's chat is no place for a map. Off by default.
   */
  readonly pagesBelow?: number;
  /**
   * WHAT BECOMES OF THE STUDIO (FR-19). Offered by default, for the seat
   * that keeps the app, writing through a dev server's door or handing
   * over files. `false` leaves it off the strip: a hosted reader cannot
   * save a declaration, so is not offered one to change. `{ onApply }`
   * keeps it and hands the host what the checker passed, writing nothing
   * itself: the host makes it a proposal, a version, a review.
   */
  readonly studio?: false | EmbedStudio;
}

/** The studio an embed offers, for a host that keeps the declaration itself. */
export interface EmbedStudio {
  /**
   * Handed what the checker passed; the studio writes nothing itself. A
   * host that could not keep it returns, or resolves to, `{ ok: false,
   * findings }`, and the studio shows those and stays open (FR-60).
   */
  readonly onApply: StudioOnApply;
  /**
   * What the studio's picture is to the host's page (FR-58). Inside an
   * embed it is a labelled region by default, never a second `<main>`;
   * "main" is for a host whose page has none of its own and whose whole
   * body is the studio.
   */
  readonly landmark?: "main" | "region";
  /**
   * Who is offered it (FR-59). The host has already decided who may build,
   * so its word stands over the app's policy, which grants the app's people
   * and stays on the store for everything else: `true`, `false`, or a
   * function of the store and the seat. Omitted, the app's policy decides.
   */
  readonly offered?: StudioOffered;
}

export interface EmbedProps<S extends AnySchema = AnySchema> extends EmbedOptions<S> {
  /** Called when the strip's switcher is pressed; the host decides the face. */
  readonly onFace?: (face: EmbedFace) => void;
  /** Called when a seat on the strip is pressed; the host decides who sits. */
  readonly onSeat?: (principal: Principal) => void;
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

export function Embed<S extends AnySchema>(props: EmbedProps<S>) {
  const { app, face = faceOf(props.stop), stop, toggle = true, standing = "Everything is in order", principal, heading = 2 } = props;
  const { rootRef, scope, css, scheme, store, presence, brand, auto, height } = useFrame(props);
  const views = useViews<S>(props) as never;
  const kinds = app.schema.kinds as readonly string[];
  // The first view only: after it, where the reader goes is theirs.
  const initialView = useMemo(() => viewFor(face, stop, kinds, (views as ReactViewRegistry<S>).places()), []);
  /*
   * NARROW, THE PAGES (FR-13). Below `pagesBelow` the scene and the Graview
   * give way to the routed face, and come back when there is room: the
   * face the host asked for is kept, only what is drawn changes.
   */
  const width = useWidth(rootRef);
  const narrow = props.pagesBelow !== undefined && width !== null && width < props.pagesBelow && (face === "scene" || face === "graview");
  const shown: EmbedFace = narrow ? "pages" : face;
  useIntrinsicHeight(rootRef, shown, props.onIntrinsicHeight);
  const report = useErrorReport(props.onError, shown);
  useReady(props.onReady, shown);

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
      aria-label={props.label ?? app.name}
      data-graview-embed={shown}
      data-graview-scheme={scheme}
      {...(narrow ? { "data-graview-embed-narrow": "" } : {})}
      style={{ position: "relative", height, minHeight: auto ? 0 : 320, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--graview-radius, 12px)" }}
    >
      <style>{css}</style>
      {/*
        * THE WORKBENCH SAYS ITS NAME IN A HEADING (FR-25). A screen reader
        * moving by headings found nothing in the scene; the pages face has
        * its own, so it is not said twice there.
        */}
      {heading !== false && shown !== "pages" ? <HeadingAt level={heading}>{props.label ?? app.name}</HeadingAt> : null}
      <ErrorReportContext.Provider value={report}>
      <FaceBoundary module="@graview/react" report={report} content>
      <GraviewProvider store={store} views={views} initialView={initialView} scheme={scheme} {...providerProps(props, presence, brand)}>
        <Faces face={shown} stop={stop} kinds={kinds} places={(views as ReactViewRegistry<S>).places()} />
        {toggle && shown !== "picture" ? (
          <FaceBoundary module="@graview/embed" report={report}>
            <EmbedStrip app={app} studio={props.studio} face={shown} narrow={narrow} onFace={props.onFace} standing={standing} seats={props.seats} principal={principal} onSeat={props.onSeat} report={report} />
          </FaceBoundary>
        ) : null}
        <FaceBoundary key={shown} module={shown === "pages" || shown === "picture" ? "@graview/pages" : "@graview/react"} report={report} content>
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
          <PagesContent<S> store={store} views={views as ReactViewRegistry<S>} presence={presence} auto={auto} brand={brand} props={props} />
        ) : (
          <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
            <Scene renderer="dom" />
            <OverviewButton />
            {/* One panel on the frame — the acts, the relations, the seat, the key. */}
            <Companion<S> />
            <Inspector placement="menu" />
          </div>
        )}
        </FaceBoundary>
      </GraviewProvider>
      </FaceBoundary>
      </ErrorReportContext.Provider>
    </section>
  );
}

/** A heading at a level the host chose, heard and not seen. */
function HeadingAt({ level, children }: { readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly children: ReactNode }) {
  const Tag = `h${level}` as const;
  return <Tag style={{ ...VISUALLY_HIDDEN, margin: 0 }}>{children}</Tag>;
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

/** The strip, with the scene's faces and its own controls. */
function EmbedStrip({
  app,
  studio,
  face,
  narrow = false,
  onFace,
  standing,
  seats,
  principal,
  onSeat,
  report,
}: {
  /** The declaration this embed is running, for the way into the studio. */
  app: GraviewApp<AnySchema>;
  /** Where the studio's own boundary reports. */
  report: ErrorReport;
  studio?: EmbedOptions["studio"] | undefined;
  face: EmbedFace;
  /** Narrower than `pagesBelow`: the pages are the only face there is room for, so there is nothing to switch. */
  narrow?: boolean;
  onFace?: ((face: EmbedFace) => void) | undefined;
  standing: string;
  seats?: EmbedOptions["seats"] | undefined;
  principal?: Principal | undefined;
  onSeat?: ((principal: Principal) => void) | undefined;
}) {
  // Two faces, not three: altitude is the scene's own control, on the
  // picture, and a third pill for it here said the same thing twice.
  const faces: readonly { id: EmbedFace; label: string; title: string; pressed: boolean }[] = narrow
    ? []
    : [
        { id: "scene", label: "Scene", title: "The picture — rise and descend on it", pressed: face !== "pages" },
        { id: "pages", label: "Pages", title: "The same app as ordinary pages", pressed: face === "pages" },
      ];
  return (
    <Strip
      standing={standing}
      seats={seats}
      principal={principal}
      onSeat={onSeat}
      faces={faces.map((candidate) => (
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
      scene={
        face === "pages"
          ? undefined
          : (compact) => (
              <>
                {/* The named pictures over the graph — a lens is somewhere to go, by name. */}
                <Places compact={compact} />
                <ShowInstallation />
                {/* And the app's own declaration, for the seat that keeps it — inside
                    the embed's box, because a studio that escaped onto somebody
                    else's page would be the rudest thing this package could do. */}
                {studio !== false ? (
                  <FaceBoundary module="@graview/studio" report={report}>
                    <Suspense fallback={null}>
                      <StudioPlace app={app} within="box" {...(studio ? { onApply: studio.onApply, ...(studio.landmark ? { landmark: studio.landmark } : {}), ...(studio.offered !== undefined ? { offered: studio.offered } : {}) } : {})} />
                    </Suspense>
                  </FaceBoundary>
                ) : null}
              </>
            )
      }
    />
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
