import type { AnySchema, Brand, GraviewApp, Person, Place, Principal, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, withFocus, withOverview, type ViewState } from "@graview/layout/view";
import { VISUALLY_HIDDEN, descentTarget, fetchFrameworkViews, frameworkViewDoors, useWidth } from "@graview/primitives/frame";
import type { StudioOffered, StudioOnApply, StudioPlace as StudioPlaceType } from "@graview/studio";
import { ErrorReportContext, GraviewProvider, useNavigation, type ErrorReport, type Scheme, type ReactViewRegistry } from "@graview/react/provider";
import { createElement, lazy, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  AUTO_SCENE_HEIGHT,
  FaceBoundary,
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
 * EACH FACE, FETCHED WHEN IT IS DRAWN (FR-57). Every face was imported
 * outright, so a page that drew the pages carried the scene, the companion
 * and the inspector, and one that drew the scene carried the routed face
 * and its router — Graview Cloud's hosted page loaded 1.1 MB before the app
 * drew. The frame, the strip and the provider are here; each face is a
 * chunk of its own, fetched as it is first drawn, and the frame stands
 * empty for that one request. The studio is the scene's, fetched only when
 * it is offered (`./scene-face.tsx`).
 */
type PagesContentProps = Parameters<typeof import("./pages-content.js").PagesContent<AnySchema>>[0];
type PictureFaceProps = Parameters<typeof import("./picture-face.js").PictureFace<AnySchema>>[0];
type SceneControlsProps = Parameters<typeof import("./scene-face.js").SceneControls>[0];

/**
 * A FACE BEHIND A DOOR: fetched the first time it is drawn, or before that
 * when a host asks (`preload`). Drawn once its module is here, it draws in
 * the same commit as the frame, with nothing suspended; drawn before, it
 * suspends until it arrives. Which of the two an instance is, it stays: a
 * component that changed from the lazy wrapper to the module's own would be
 * a different element, and the face would be drawn again from nothing.
 */
function door<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined;
  let fetching: Promise<void> | undefined;
  const fetch = (): Promise<void> =>
    (fetching ??= load().then((component) => {
      loaded = component;
    }));
  const Lazy = lazy(async () => {
    await fetch();
    return { default: loaded! };
  });
  function Face(props: P) {
    const [here] = useState(() => loaded);
    return here ? createElement(here, props) : createElement(Lazy as unknown as ComponentType<P>, props);
  }
  return { Face, fetch };
}

/* Each face draws the framework's own views, so it fetches them beside its own chunk (`frameworkViewDoors`). */
const withViews = <T,>(face: Promise<T>): Promise<T> => Promise.all([face, fetchFrameworkViews()]).then(([loaded]) => loaded);
const scene = door(() => withViews(import("./scene-face.js").then((face) => face.SceneFace as ComponentType<{ auto: boolean }>)));
const sceneControls = door(() => import("./scene-face.js").then((face) => face.SceneControls as ComponentType<SceneControlsProps>));
const pages = door(() => withViews(import("./pages-content.js").then((face) => face.PagesContent as ComponentType<PagesContentProps>)));
const picture = door(() => withViews(import("./picture-face.js").then((face) => face.PictureFace as ComponentType<PictureFaceProps>)));
const SceneFace = scene.Face;
const SceneControls = sceneControls.Face;
const PagesContent = pages.Face;
const PictureFace = picture.Face;

/**
 * FETCH A FACE BEFORE IT IS DRAWN (FR-57). A host that knows which face it
 * will open on — Graview Cloud's shell knows from the window's width before
 * it has fetched the document — starts the face's chunk now, beside its own
 * requests, rather than after `mount`; and an embed mounted once the face is
 * here draws it in the first commit. With no face named, every face.
 */
export function preload(...faces: readonly EmbedFace[]): Promise<void> {
  const asked = faces.length > 0 ? faces : (["scene", "pages", "picture"] as const);
  const doors = new Set<{ fetch(): Promise<void> }>(asked.flatMap((face): { fetch(): Promise<void> }[] => (face === "pages" ? [pages] : face === "picture" ? [picture] : [scene, sceneControls])));
  return Promise.all([...doors].map((one) => one.fetch())).then(() => undefined);
}

/**
 * Committed with the face, never before it: a lazy face suspends its whole
 * boundary, so this mounts in the same commit the face first draws in.
 */
function Drawn({ asked, shown, onDrawn }: { readonly asked: EmbedFace; readonly shown: EmbedFace; readonly onDrawn: (asked: EmbedFace, shown: EmbedFace) => void }) {
  useLayoutEffect(() => onDrawn(asked, shown), [asked, shown, onDrawn]);
  return null;
}

/** The face's place while its chunk is on its way: the box it will fill, the ground it will be drawn on. */
function Arriving({ auto, scene }: { readonly auto: boolean; readonly scene: boolean }) {
  return (
    <div
      data-embed-content=""
      aria-busy="true"
      style={{ flex: auto ? (scene ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "0 0 auto") : "1 1 auto", minHeight: 0, background: "var(--graview-ground)" }}
    />
  );
}

/*
 * THE STUDIO, WHEN IT IS TURNED ON. Imported outright, it was about 104 kB
 * minified of every embed — `studio: false` included, which never draws
 * it. A product's bundler splits it off here, and a page fetches it only
 * when an embed offers the studio; until it arrives, the strip simply has
 * no studio on it yet. A host that hands it in (`studio.place`, FR-63) has
 * it drawn on the strip in the frame's own render.
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

export { AUTO_SCENE_HEIGHT };

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
  /**
   * TOLD WHEN A FACE IS ON THE PAGE (FR-57). Each face is fetched as it is
   * first drawn, so the frame stands before the face does; this is called
   * with the face asked for once it has drawn (below `pagesBelow`, drawn
   * as the pages that stand in for it), each time the face changes.
   */
  readonly onDrawn?: (face: EmbedFace) => void;
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
  /**
   * THE STUDIO, HANDED IN (FR-63): `StudioPlace` from `@graview/studio`,
   * imported by the host outright. The embed imports the studio when it is
   * turned on, so a page that never turns it on never fetches it — and a
   * page whose whole point is the studio paid a round trip for its chunk
   * before anything drew. Handed in, the studio is in the host's own bundle,
   * no `@graview/studio` module is left in a lazy chunk, and the studio
   * draws in the same render as the embed. A flag could not do this: what
   * a bundler splits is decided by what the code imports, not by a value.
   */
  readonly place?: typeof StudioPlaceType;
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
  const views = useViews<S>(props, frameworkViewDoors) as never;
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
  const ready = useReady(props.onReady, shown);
  const told = useRef(props.onDrawn);
  told.current = props.onDrawn;
  const drawn = useCallback((asked: EmbedFace, drew: EmbedFace) => {
    ready(drew);
    told.current?.(asked);
  }, [ready]);

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
            <EmbedStrip app={app} studio={props.studio} face={shown} narrow={narrow} onFace={props.onFace} standing={standing} seats={props.seats} principal={principal} onSeat={props.onSeat} hostActions={props.hostActions} report={report} />
          </FaceBoundary>
        ) : null}
        <FaceBoundary key={shown} module={shown === "pages" || shown === "picture" ? "@graview/pages" : "@graview/react"} report={report} content>
          <Suspense fallback={<Arriving auto={auto} scene={shown !== "pages" && shown !== "picture"} />}>
            {shown === "picture" ? (
              <PictureFace store={store as never} views={views as never} as={(stop ? fromUrl(stop).within?.["view"] : undefined) ?? ""} />
            ) : shown === "pages" ? (
              <PagesContent store={store as never} views={views as never} presence={presence} auto={auto} brand={brand} props={props as never} />
            ) : (
              <SceneFace auto={auto} />
            )}
            <Drawn asked={face} shown={shown} onDrawn={drawn} />
          </Suspense>
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
  hostActions,
  report,
}: {
  /** The host's own actions, for the profile menu (FR-72). */
  hostActions?: EmbedOptions["hostActions"] | undefined;
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
      hostActions={hostActions}
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
                <Suspense fallback={null}>
                  <SceneControls compact={compact} />
                </Suspense>
                {/* And the app's own declaration, for the seat that keeps it — inside
                    the embed's box, because a studio that escaped onto somebody
                    else's page would be the rudest thing this package could do. */}
                {studio !== false ? (
                  <FaceBoundary module="@graview/studio" report={report}>
                    <StudioOnTheStrip app={app} studio={studio} />
                  </FaceBoundary>
                ) : null}
              </>
            )
      }
    />
  );
}

/**
 * The studio's place on the strip: the one the host handed in, drawn at
 * once (FR-63), or the embed's own, fetched when it is first drawn.
 */
function StudioOnTheStrip({ app, studio }: { readonly app: GraviewApp<AnySchema>; readonly studio: EmbedStudio | undefined }) {
  const props = {
    app,
    within: "box" as const,
    ...(studio ? { onApply: studio.onApply } : {}),
    ...(studio?.landmark ? { landmark: studio.landmark } : {}),
    ...(studio?.offered !== undefined ? { offered: studio.offered } : {}),
  };
  const Handed = studio?.place;
  if (Handed) return <Handed {...props} />;
  return (
    <Suspense fallback={null}>
      <StudioPlace {...props} />
    </Suspense>
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
  /**
   * Resolves once the face now asked for is drawn (FR-57). The frame is on
   * the page when `mount` returns; each face is fetched as it is first
   * drawn, so a host or a test that needs the face itself waits for this —
   * after `mount`, and after `setFace`.
   */
  drawn(): Promise<void>;
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
  // Which face is asked for, which is drawn, and who is waiting for the one asked for.
  let asked: EmbedFace = options.face ?? faceOf(options.stop);
  let drawnFace: EmbedFace | null = null;
  let waiting: (() => void)[] = [];
  const onDrawn = (face: EmbedFace) => {
    drawnFace = face;
    options.onDrawn?.(face);
    if (face !== asked) return;
    const done = waiting;
    waiting = [];
    for (const resolve of done) resolve();
  };
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
        onFace={(next) => {
          asked = next;
          setFace(next);
        }}
        onSeat={setSeat}
        onDrawn={onDrawn}
      />
    );
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setFace: (face) => {
      asked = face;
      flushSync(() => setters?.face(face));
    },
    setStop: (stop) => flushSync(() => setters?.stop(stop)),
    setScheme: (scheme) => flushSync(() => setters?.scheme(scheme)),
    setSeat: (principal) => flushSync(() => setters?.seat(principal)),
    setSeats: (seats) => flushSync(() => setters?.seats(seats)),
    setPeople: (people) => flushSync(() => setters?.people(people)),
    setHostContext: (context) => flushSync(() => setters?.hostContext(context)),
    setBrand: (brand) => flushSync(() => setters?.brand(brand)),
    /* Drawn is the face asked for — below `pagesBelow`, drawn as the pages that stand in for it. */
    drawn: () => (drawnFace === asked ? Promise.resolve() : new Promise<void>((resolve) => waiting.push(resolve))),
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
