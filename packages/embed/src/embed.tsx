import { addressOf, OVERVIEW_PATH, retryingImport, pagesTitle, pathWithin, sceneTitle, type AnySchema, type Brand, type GraviewApp, type Person, type Place, type Principal, type Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, toUrl, withFocus, withOverview, type ViewState } from "@graview/layout/view";
import { BarFindContext, barPlaceAt, barPlaces, descentTarget, fetchFrameworkViews, frameworkViewDoors, useWidth, type BarFind } from "@graview/primitives/frame";
import type { StudioOffered, StudioOnApply, StudioPlace as StudioPlaceType } from "@graview/studio";
import type { CompanionMode } from "@graview/primitives";
import { createNoticeBoard, type Notice, type NoticeHandle } from "@graview/primitives/frame";
import { ErrorReportContext, GraviewProvider, lazyModule, openingView, useNavigation, type ErrorReport, type Scheme, type ReactViewRegistry } from "@graview/react/provider";
import { AddressBar, atTheBareHome, faceAtAddress, stopAtAddress } from "./address.js";
import { createContext, createElement, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { EmbedWhere } from "./where.js";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  AUTO_SCENE_HEIGHT,
  FaceBoundary,
  FrameBar,
  FrameNotices,
  providerProps,
  storeOf,
  useErrorReport,
  useFrame,
  useIntrinsicHeight,
  useReady,
  titleBelow,
  useSteering,
  useViews,
  type EmbedFace,
  type EmbedHostContext,
  type EmbedRemote,
  type FrameOptions,
} from "./frame.js";

/*
 * EACH FACE, FETCHED WHEN IT IS DRAWN (FR-57). Every face was imported
 * outright, so a page that drew the pages carried the scene, the companion
 * and the inspector, and one that drew the scene carried the routed face
 * and its router — Graview Cloud's hosted page loaded 1.1 MB before the app
 * drew. The frame, the bar and the provider are here; each face is a
 * chunk of its own, fetched as it is first drawn, and the frame stands
 * empty for that one request. The studio is the scene's, fetched only when
 * it is offered (`./scene-face.tsx`).
 */
type PagesContentProps = Parameters<typeof import("./pages-content.js").PagesContent<AnySchema>>[0];
type PictureFaceProps = Parameters<typeof import("./picture-face.js").PictureFace<AnySchema>>[0];
type SceneFaceProps = Parameters<typeof import("./scene-face.js").SceneFace<AnySchema>>[0];

/**
 * A FACE BEHIND A DOOR: fetched the first time it is drawn, or before that
 * when a host asks (`preload`). Drawn once its module is here, it draws in
 * the same commit as the frame, with nothing suspended; drawn before, it
 * suspends until it arrives. Which of the two an instance is, it stays: a
 * component that changed from the lazy wrapper to the module's own would be
 * a different element, and the face would be drawn again from nothing.
 *
 * One that does not arrive — the network away as it was first drawn — says
 * so in its place with "Try again", and is asked for again when the browser
 * is back online, when it is drawn again or the button is pressed; it never
 * throws into the embed (FR-139, `lazyModule`).
 */
function door<P extends object>(load: () => Promise<ComponentType<P>>, options: { readonly what?: string; readonly quiet?: boolean } = {}) {
  const face = lazyModule(load);
  const Face = face.part((Drawn, props: P) => createElement(Drawn, props), options);
  return { Face, fetch: (): Promise<void> => face.load().then(() => undefined) };
}

/* Each face draws the framework's own views, so it fetches them beside its own chunk (`frameworkViewDoors`). */
const withViews = <T,>(face: Promise<T>): Promise<T> => Promise.all([face, fetchFrameworkViews()]).then(([loaded]) => loaded);
/* Each chunk asked for again with a URL of its own after it failed (`retryingImport`). */
const sceneChunk = retryingImport(() => import("./scene-face.js"));
const pagesChunk = retryingImport(() => import("./pages-content.js"));
const pictureChunk = retryingImport(() => import("./picture-face.js"));
const scene = door(() => withViews(sceneChunk().then((face) => face.SceneFace as ComponentType<SceneFaceProps>)), { what: "This view" });
// In the person's menu, which says once, at its top, what did not arrive.
const sceneKeeping = door(() => sceneChunk().then((face) => face.SceneKeeping as ComponentType<object>), { quiet: true });
const pages = door(() => withViews(pagesChunk().then((face) => face.PagesContent as ComponentType<PagesContentProps>)), { what: "This page" });
const picture = door(() => withViews(pictureChunk().then((face) => face.PictureFace as ComponentType<PictureFaceProps>)), { what: "This picture" });
const SceneFace = scene.Face;
const SceneKeeping = sceneKeeping.Face;
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
  const doors = new Set<{ fetch(): Promise<void> }>(asked.flatMap((face): { fetch(): Promise<void> }[] => (face === "pages" ? [pages] : face === "picture" ? [picture] : [scene, sceneKeeping])));
  // Resolved when they are here or did not arrive: a face that did not is asked for again as it is drawn (FR-139).
  return Promise.all([...doors].map((one) => one.fetch())).then(
    () => undefined,
    () => undefined,
  );
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
 * when an embed offers the studio; until it arrives, the person's menu
 * simply has no studio in it yet. A host that hands it in (`studio.place`,
 * FR-63) has it drawn in the frame's own render.
 */
const StudioPlace = lazyModule(retryingImport(() => import("@graview/studio"))).part(
  (studio, props: Parameters<typeof StudioPlaceType>[0]) => <studio.StudioPlace {...props} />,
  // Quiet: the person's menu it sits in says once, at its top, what did not arrive (FR-139).
  { quiet: true },
);

/**
 * A GRAVIEW IN SOMEBODY ELSE'S PAGE.
 *
 * The Shell assumes it owns the window: the viewport is its height, the
 * document is its theme, the address bar is its view state. An embed owns
 * one element. So the theme is scoped to that element, the panes size
 * against the picture's own box, the routed face runs on a memory router,
 * the store lives in memory and starts from the seed, and the view state is
 * a prop rather than a URL — unless the host's page IS the app and it hands
 * over the address bar (`routing: "address"`, FR-106). Everything else — the scene, the rails, the
 * inspector, the pages — is the framework's own, unchanged.
 */

export { AUTO_SCENE_HEIGHT };

export interface EmbedOptions<S extends AnySchema = AnySchema> extends FrameOptions<S> {
  /**
   * Which face to open on. Omitted, the stop decides: at altitude the
   * Graview, anything else the scene — the app's overview, one of its
   * places (FR-132).
   */
  readonly face?: EmbedFace;
  /** The scene's view state, as the fragment the app itself would put in its address bar. */
  readonly stop?: string;
  /**
   * THE APP'S NAME AS A HEADING (FR-25, FR-131): the level the app bar says
   * the name at, for a reader moving by headings — `1` when the host's page
   * is the app, `2` (the default) inside somebody else's article, `false`
   * when the host's own heading already names it. Each page's own title is
   * said under it, at the level below the app's.
   */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /**
   * Below this width the scene and the Graview give way to the routed face,
   * and come back above it — unless the reader asks for the overview on the
   * bar, which is then drawn whatever the width. Off by default.
   */
  readonly pagesBelow?: number;
  /**
   * WHAT BECOMES OF THE STUDIO (FR-19). Offered by default, in the
   * person's menu for the seat that keeps the app, writing through a dev
   * server's door or handing over files. `false` leaves it out: a hosted reader cannot
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
  /**
   * HOW THE SEAT'S RAIL STARTS (FR-78): `"open"` (the default), `"collapsed"`
   * to a slim tab at the picture's edge, or `"hidden"`. The reader can put
   * it away and open it again; what they chose is remembered for the app
   * (in `memory`, or the page's storage) over this start — except
   * `"hidden"`, which is the host's to say.
   */
  readonly companion?: CompanionMode;
  /**
   * WHERE TO OPEN, AS `handle.where()` SAID IT (FR-116): the face, the page
   * on Pages and the scene's stop, over `face`, `path` and `stop`, settled
   * in this app — what it no longer has falls back to its nearest parent. A
   * host that must remount on a new declaration hands the old place back here.
   */
  readonly at?: EmbedWhere;
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
   * embed it is a labeled region by default, never a second `<main>`;
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
  /** Called when the bar's switch moves between the scene and the pages (FR-137); the host decides the face. */
  readonly onFace?: (face: EmbedFace) => void;
  /** Told, once, the face the embed opened on when the host named none (FR-136): the home's, or the scene. */
  readonly onOpening?: (face: EmbedFace) => void;
  /** Called when a seat is taken in the person's menu; the host decides who sits. */
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
function viewFor(face: EmbedFace, stop: string | undefined, kinds: readonly string[], places: readonly Place[], opening?: ViewState): ViewState {
  // No stop: where the declaration says the app opens (FR-80), else nowhere in particular.
  const parsed = stop ? fromUrl(stop) : (opening ?? EMPTY_VIEW);
  const named = parsed.within?.["view"];
  const place = named !== undefined && !parsed.focusId ? places.find((candidate) => candidate.as === named) : undefined;
  const asked = place ? { ...parsed, focusId: aggregateId(place.kind) } : parsed;
  if (face === "graview") return withOverview(asked, true);
  if (asked.overview) return withFocus(withOverview(asked, false), descentTarget(asked, kinds));
  return asked;
}

/** The face a stop implies: a stop at altitude opens the Graview, anything else the scene (FR-132). */
export function faceOf(stop: string | undefined): EmbedFace {
  return stop && fromUrl(stop).overview ? "graview" : "scene";
}

/**
 * WHETHER AN APP OPENS ON ITS HOME (FR-136): it has a home view — the
 * declaration's home blocks, or a worker view attached to "home" — and its
 * declaration names no other first place (`pages.first`).
 */
export function opensOnTheHome(app: Pick<GraviewApp<AnySchema>, "pages">, views: { homeView?(): unknown }): boolean {
  if (views.homeView?.() === undefined) return false;
  const first = app.pages?.first?.trim();
  return first === undefined || first === "" || first === "/" || first.toLowerCase() === "home";
}

export function Embed<S extends AnySchema>(props: EmbedProps<S>) {
  const [, ready] = useState(false);
  const arrived = useCallback(() => ready(true), []);
  // A place handed back is settled before the embed draws: until the rules for it are here, nothing stands in the element.
  return props.at && !settling ? <Settling onReady={arrived} /> : <Drawing<S> {...props} />;
}

function Drawing<S extends AnySchema>(props: EmbedProps<S>) {
  const { app, stop, bar = true, standing = "Everything is in order", principal, heading = 2 } = props;
  const { rootRef, scope, css, scheme, store, presence, brand, auto, height } = useFrame(props);
  const views = useViews<S>(props, frameworkViewDoors) as never;
  /*
   * THE FACE IT OPENS ON (FR-136). When the host names none: the home, when
   * the app has a home view and the declaration names no other first place
   * — the front page a chat wrote is the page the app opens on, on a desk
   * as on a phone — else the scene, as before. A host that names a face, a
   * stop or a place handed back is drawn what it asked for; under address
   * routing, what the address names — and the bare address, naming no face,
   * is the home's when there is a home view, whatever face the host names:
   * the host is told the pages (`onFace`), as if the reader had pressed it.
   */
  const based = props.basePath === undefined ? {} : { basePath: props.basePath };
  // The app's own address for a path within it, under address routing.
  const addressAt = (path: string) => addressOf(path, based);
  const routed = { ...(props.routing ? { routing: props.routing } : {}), ...based };
  const [opened] = useState<EmbedFace>(() => {
    const given = props.at?.face;
    if (given) return given;
    const decided = stop === undefined && opensOnTheHome(app, views as ReactViewRegistry<S>) ? "pages" : faceOf(stop);
    const face = faceAtAddress({ ...routed, face: decided });
    if (props.face === undefined) props.onOpening?.(face);
    return face;
  });
  const [homeFirst, setHomeFirst] = useState(() => props.face !== undefined && props.face !== "pages" && !props.at && stop === undefined && atTheBareHome(routed) && opensOnTheHome(app, views as ReactViewRegistry<S>));
  const toldHome = useRef(props.onFace);
  toldHome.current = props.onFace;
  useLayoutEffect(() => {
    if (!homeFirst) return;
    toldHome.current?.("pages");
    setHomeFirst(false);
  }, [homeFirst]);
  const face = homeFirst ? "pages" : (props.face ?? opened);
  const kinds = app.schema.kinds as readonly string[];
  const address = props.routing === "address";
  const at = useMemo(() => (props.at ? settling!.settleAt(props as never, store.seenBy(principal ?? { kind: "human" }) as never, (views as ReactViewRegistry<S>).places()) : undefined), []);
  // The first view only: after it, where the reader goes is theirs. Under address routing, a stop in the fragment is where it starts.
  const initialView = useMemo(() => viewFor(face, at?.stop ?? (address ? stopAtAddress(props.basePath) : undefined) ?? stop, kinds, (views as ReactViewRegistry<S>).places(), openingView(views as ReactViewRegistry<S>, app.schema)), []);
  /*
   * THE PAGE ON THE ROUTED FACE, KEPT (FR-116): where it is, or last was,
   * so the overview and back is the same page, and `where()` can say it.
   * Under memory routing the routed face opens on it; under address routing
   * the address is where it is. The overview's own address is never a
   * page of the routed face: it is the scene (FR-132).
   */
  const pagesAt = useRef<{ path: string; asked: string | undefined }>(undefined as never);
  const pageOf = (path: string | undefined): string => (path === undefined || isOverview(path) ? "/" : path);
  pagesAt.current ??= { path: pageOf(at?.path ?? (address ? (face === "pages" ? (pathWithin(window.location.pathname, props.basePath) ?? "/") + window.location.search : "/") : props.path)), asked: props.path };
  if (props.path !== pagesAt.current.asked) pagesAt.current = { path: pageOf(props.path), asked: props.path };
  const told = useRef(props.onNavigate);
  told.current = props.onNavigate;
  const onNavigate = useCallback((path: string, how: Parameters<NonNullable<EmbedProps["onNavigate"]>>[1]) => {
    pagesAt.current.path = path;
    told.current?.(path, how);
  }, []);
  // Where the routed face is, said by its router as it moves, for the bar's tabs (FR-131).
  const { at: pageAt, setAt: setPageAt, steering, steer } = useSteering(pagesAt.current.path);
  const whereabouts = useContext(Whereabouts);
  if (whereabouts) whereabouts.pages = () => pagesAt.current.path;
  const toggled = useRef<((face: EmbedFace, path?: string, stop?: string) => void) | undefined>(undefined);
  /*
   * NARROW, THE PAGES (FR-13). Below `pagesBelow` the scene and the Graview
   * give way to the routed face, and come back when there is room: the
   * face the host asked for is kept, only what is drawn changes — until the
   * reader asks for the overview themselves, which is then drawn whatever
   * the width (FR-132).
   */
  const width = useWidth(rootRef);
  const [overviewAsked, setOverviewAsked] = useState(false);
  const narrow = props.pagesBelow !== undefined && width !== null && width < props.pagesBelow && (face === "scene" || face === "graview") && !overviewAsked;
  const shown: EmbedFace = narrow ? "pages" : face;
  // Whether the scene drawn is one the reader asked for where the pages stand in for it.
  const standsAside = useRef(false);
  standsAside.current = overviewAsked && props.pagesBelow !== undefined && width !== null && width < props.pagesBelow && (face === "scene" || face === "graview");
  if (whereabouts) whereabouts.shown = shown;
  // The scene's face the reader was last on, to go back to from a page: the Graview at altitude, or the scene.
  const sceneFace = useRef<EmbedFace>(face === "graview" ? "graview" : "scene");
  if (shown === "scene" || shown === "graview") sceneFace.current = shown;
  /*
   * THE OVERVIEW'S ADDRESS IS ITS PLACE'S (FR-132). Under address routing
   * the scene is at `<base>/places/overview`, its stop in the fragment; a
   * link to a stop at the bare base — every link written before the scene
   * was a place — opens it, and the address is tidied to the place's.
   */
  useState(() => {
    if (!address || typeof window === "undefined" || shown === "pages" || shown === "picture") return;
    const { pathname, search, hash } = window.location;
    if (pathWithin(pathname, props.basePath) !== "/") return;
    window.history.replaceState(window.history.state, "", `${addressAt(OVERVIEW_PATH)}${search}${hash}`);
  });
  useIntrinsicHeight(rootRef, shown, props.onIntrinsicHeight);
  const report = useErrorReport(props.onError, shown);
  const ready = useReady(props.onReady, shown);
  const drawnTold = useRef(props.onDrawn);
  drawnTold.current = props.onDrawn;
  const drawn = useCallback((asked: EmbedFace, drew: EmbedFace) => {
    ready(drew);
    drawnTold.current?.(asked);
  }, [ready]);
  const [barFind, setBarFind] = useState<BarFind | null>(null);
  const places = (views as ReactViewRegistry<S>).places();

  /*
   * MOVING BETWEEN THE OVERVIEW AND A PAGE (FR-132): one press on a tab.
   * Under address routing the address goes first, as a step Back undoes;
   * under memory routing the host is told the face, and — as for any page —
   * the path, the overview's being `/places/overview`.
   */
  const latest = useRef({ shown, onFace: props.onFace });
  latest.current = { shown, onFace: props.onFace };
  const toFace = useCallback((next: EmbedFace, path?: string, stop?: string) => {
    if (address) {
      toggled.current?.(next, path, stop);
      return;
    }
    latest.current.onFace?.(next);
    told.current?.(next === "pages" ? (path ?? pagesAt.current.path) : OVERVIEW_PATH, "push");
  }, [address]);
  /*
   * The stop a page's way to the scene names ("In the scene ↗") is
   * landed on once: it is let go when the reader leaves the scene and when
   * the host sets a stop of its own, so it never holds the scene after.
   */
  const [overviewStop, setOverviewStop] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (shown === "pages") setOverviewStop(undefined);
  }, [shown]);
  const hostStop = useRef(stop);
  useEffect(() => {
    if (hostStop.current === stop) return;
    hostStop.current = stop;
    setOverviewStop(undefined);
  }, [stop]);
  const toOverview = useCallback((stop?: string) => {
    if (latest.current.shown !== "pages") return;
    setOverviewAsked(true);
    setOverviewStop(stop);
    if (face === "scene" || face === "graview") {
      // Narrow, the scene was standing aside for the pages: the reader asked for it.
      if (address) window.history.pushState(null, "", `${addressAt(OVERVIEW_PATH)}${stop ?? ""}`);
      else told.current?.(OVERVIEW_PATH, "push");
      return;
    }
    toFace(sceneFace.current, undefined, stop);
  }, [address, face, props.basePath, toFace]);
  const toPage = useCallback((path: string) => {
    if (latest.current.shown === "pages") {
      // The face may still be arriving: the path waits for it (FR-140).
      if (!steering.go.current) pagesAt.current.path = path;
      steer(path);
      return;
    }
    pagesAt.current.path = path;
    setPageAt(path);
    if (standsAside.current) {
      // Narrow, the pages stand in for the host's face again: the scene was the reader's ask, and the host's face is kept for when there is room.
      setOverviewAsked(false);
      if (address) window.history.pushState(null, "", addressAt(path));
      else told.current?.(path, "push");
      return;
    }
    toFace("pages", path);
  }, [steering, steer, setPageAt, toFace, address, props.basePath]);
  const barPlacesHere = barPlaces({ store: store as never, principal, views: views as never });
  const arrangement = (views as ReactViewRegistry<S>).arrangement?.();
  const onPages = shown === "pages";
  const hrefOf = address ? addressAt : undefined;

  /*
   * THE EMBED IS ITSELF A LANDMARK.
   *
   * `label` named every landmark INSIDE ("Chapter 13 · Places") and left the
   * root a plain div — so on somebody else's page the bar, the seats and
   * the picture sat outside any landmark at all (axe `region`), and a reader
   * moving by landmark could not reach the app, let alone tell two of them
   * apart at the top. A named region is what the label was for.
   *
   * Without a label it takes the app's own name, and two unlabeled embeds
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
      <ErrorReportContext.Provider value={report}>
      <FrameNotices rootRef={rootRef} board={props.notices} />
      <FaceBoundary module="@graview/react" report={report} content>
      <GraviewProvider store={store} views={views} initialView={initialView} scheme={scheme} {...providerProps(props, presence, brand)} {...(props.onSeat ? { onSeat: props.onSeat } : {})}>
        <Faces face={shown} stop={overviewStop ?? stop} kinds={kinds} places={places} />
        {whereabouts ? <Watch into={whereabouts} /> : null}
        {/* THE ADDRESS BAR, when the host's page is the app (FR-106): the face follows it, and the scene, drawn, keeps its stop in the fragment. */}
        {address ? <AddressBar pagesWere={at?.path} basePath={props.basePath} shown={shown} onFace={props.onFace} toggle={toggled} kinds={kinds} places={places} /> : null}
        {/*
          * THE ONE APP BAR (FR-131): the app's name, said once as the
          * heading — the workbench says its name to a reader moving by
          * headings (FR-25) — the switch between the scene and the pages
          * (FR-137), the place you are on (FR-138), Find, the standing and
          * the person. Not on a picture alone.
          */}
        {bar && shown !== "picture" ? (
          <FaceBoundary module="@graview/embed" report={report}>
            <FrameBar
              name={brand?.name ?? app.name}
              heading={heading}
              faces={{
                scene: { label: sceneTitle(arrangement), current: !onPages, go: () => toOverview() },
                // The pages, back at the page the reader was on.
                pages: { label: pagesTitle(arrangement), current: onPages, go: () => toPage(pagesAt.current.path) },
              }}
              places={barPlacesHere}
              current={onPages ? barPlaceAt(barPlacesHere, pageAt) : null}
              home={{ ...(hrefOf ? { href: hrefOf("/") } : {}), go: () => toPage("/"), current: onPages && pageAt.split("?")[0] === "/" }}
              reach={{ ...(hrefOf ? { href: hrefOf } : {}), go: (place) => toPage(place.path) }}
              standing={standing}
              hostActions={props.hostActions}
              keeping={onPages ? undefined : <Keeping app={app} studio={props.studio} report={report} />}
              onFind={setBarFind}
              switch={props.switch}
            />
          </FaceBoundary>
        ) : null}
        <BarFindContext.Provider value={barFind}>
        <FaceBoundary key={shown} module={shown === "pages" || shown === "picture" ? "@graview/pages" : "@graview/react"} report={report} content>
          <Suspense fallback={<Arriving auto={auto} scene={shown !== "pages" && shown !== "picture"} />}>
            {shown === "picture" ? (
              <PictureFace scope={scope} store={store as never} views={views as never} as={(stop ? fromUrl(stop).within?.["view"] : undefined) ?? ""} />
            ) : shown === "pages" ? (
              <PagesContent
                store={store as never}
                views={views as never}
                presence={presence}
                auto={auto}
                brand={brand}
                steering={steering}
                overview={toOverview}
                scope={scope}
                titleLevel={titleBelow(heading)}
                props={{ ...props, onNavigate, ...(address ? {} : { path: pagesAt.current.path }) } as never}
              />
            ) : (
              <SceneFace address={address} auto={auto} rememberAs={app.name} scheme={scheme} scope={scope} {...(props.companion ? { companion: props.companion } : {})} />
            )}
            <Drawn asked={face} shown={shown} onDrawn={drawn} />
          </Suspense>
        </FaceBoundary>
        </BarFindContext.Provider>
      </GraviewProvider>
      </FaceBoundary>
      </ErrorReportContext.Provider>
    </section>
  );
}

/** Whether a path on the routed face is the overview's own (FR-132). */
const isOverview = (path: string): boolean => path.split(/[?#]/)[0] === OVERVIEW_PATH;

/** What `mount` reads `where()` from: the scene's view, the page on the routed face, and the face drawn. */
interface Whereabouts {
  view?: ViewState;
  pages?: () => string;
  shown?: EmbedFace;
}
const Whereabouts = createContext<Whereabouts | null>(null);

/** Keeps the scene's view where `where()` can read it. */
function Watch({ into }: { readonly into: Whereabouts }) {
  into.view = useNavigation().view;
  return null;
}

/*
 * SETTLING A PLACE IN A NEW APP, fetched when one is handed over (FR-116):
 * a declaration changes rarely, and a page that never swaps one never loads
 * the rules for what falls back to what.
 */
let settling: typeof import("./where.js") | undefined;
const whereChunk = retryingImport(() => import("./where.js"));
/* Asked for again when the browser is back online, or every ten seconds, until it arrives (FR-139). */
const fetchSettling = (): Promise<void> =>
  whereChunk().then(
    (module) => void (settling = module),
    () => new Promise<void>((resolve) => {
      const again = () => {
        window.removeEventListener("online", again);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(again, 10_000);
      window.addEventListener("online", again);
    }).then(fetchSettling),
  );

/** Stands in for the embed while the rules for a handed-back place arrive, then draws it. */
function Settling({ onReady }: { readonly onReady: () => void }) {
  useLayoutEffect(() => void fetchSettling().then(onReady), [onReady]);
  return null;
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

/**
 * THE WAYS INTO THE APP, in the person's menu on the overview, for the seat
 * that keeps it: the installation's own districts, and the app's own
 * declaration — inside the embed's box, because a studio that escaped onto
 * somebody else's page would be the rudest thing this package could do.
 */
function Keeping({ app, studio, report }: { readonly app: GraviewApp<AnySchema>; readonly studio: EmbedOptions["studio"] | undefined; readonly report: ErrorReport }) {
  return (
    <>
      <Suspense fallback={null}>
        <SceneKeeping />
      </Suspense>
      {studio !== false ? (
        <FaceBoundary module="@graview/studio" report={report}>
          <StudioOnTheBar app={app} studio={studio} />
        </FaceBoundary>
      ) : null}
    </>
  );
}

/**
 * The studio's place in the person's menu: the one the host handed in, drawn
 * at once (FR-63), or the embed's own, fetched when it is first drawn.
 */
function StudioOnTheBar({ app, studio }: { readonly app: GraviewApp<AnySchema>; readonly studio: EmbedStudio | undefined }) {
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
  /**
   * WHERE THE READER IS (FR-116): the face, the path of the place they are
   * on — the overview's (`/places/overview`) on the scene (FR-132) — and the
   * scene's stop, for a host that must remount to hand back as
   * `mount(…, { at })`.
   */
  where(): EmbedWhere;
  /**
   * A NEW DECLARATION UNDER THE READER (FR-116): the app and its store — or a
   * remote, whose presence comes with it — swapped in place. The face, the
   * page on Pages and the scene's stop are kept; what the app no longer has
   * falls back to its nearest parent. The seat, the seats, the people, the
   * scheme, the brand asked for and the notices stay; what is drawn is drawn
   * again, so an open menu, a scroll and a half-typed field do not.
   *
   * THE NEW APP'S NAME (FR-128): a `label` that was the app's own name
   * follows the app, so a renamed app says its new name — the embed's
   * accessible name, its heading, each landmark inside — without a reload;
   * a label the host chose stays. `{ label }` says which.
   */
  setApp(app: GraviewApp<AnySchema>, store: Store<AnySchema> | EmbedRemote<AnySchema>, options?: { readonly label?: string }): void;
  /** What the embed is called (FR-128): its accessible name, its heading, and the name each landmark inside is said after. */
  setLabel(label: string): void;
  /** The host's own actions in the profile menu (FR-72), now. */
  setHostActions(actions: EmbedOptions["hostActions"]): void;
  setFace(face: EmbedFace): void;
  setStop(stop: string): void;
  /**
   * Goes to a path within the app's own routes (FR-106): a host that keeps
   * its own history hands back the path its Back arrived at. The overview's
   * path (`/places/overview`) is the scene (FR-132); any other is a page.
   */
  setPath(path: string): void;
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
  /**
   * SAYS SOMETHING IN THE APP'S OWN NOTICES (FR-75): a toast that goes by
   * itself, or a banner that stays until it is cleared, in the framework's
   * floating panel over the face, on the ladder's top rung, and aloud. The
   * handle it returns changes it in place or clears it.
   */
  notify(notice: Notice): NoticeHandle;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

interface Setters {
  app(swap: Swap): void;
  face(face: EmbedFace): void;
  stop(stop: string): void;
  path(path: string): void;
  scheme(scheme: Scheme): void;
  seat(principal: Principal): void;
  seats(seats: EmbedOptions["seats"]): void;
  people(people: readonly Person[]): void;
  hostContext(context: EmbedHostContext): void;
  brand(brand: Brand | undefined): void;
  label(label: string | undefined): void;
  hostActions(actions: EmbedOptions["hostActions"]): void;
}

/** A new declaration and where the reader was, for the next drawing of the embed. */
interface Swap {
  readonly app: GraviewApp<AnySchema>;
  readonly remote: EmbedRemote<AnySchema>;
  readonly at: EmbedWhere;
  readonly n: number;
}

/** The options with a new declaration in them: where the reader was stands for the path and the stop the host first gave. */
function swapped<S extends AnySchema>({ path: _path, stop: _stop, ...options }: EmbedOptions<S>, swap: Swap): EmbedOptions<S> {
  return { ...options, app: swap.app as never, at: swap.at, ...(swap.remote.presence ? { presence: swap.remote.presence } : {}) };
}

/**
 * Mounts an app into an element and hands back the controls. The first
 * render is synchronous, so what comes back is already on the page.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: EmbedOptions<S>): EmbedHandle {
  let store: Store<AnySchema> = (options.store ?? options.remote?.store ?? storeOf(options.app, options.seed)) as never;
  const board = options.notices ?? createNoticeBoard();
  let setters: Setters | null = null;
  const here: Whereabouts = {};
  let swaps = 0;
  // What the embed is called, and the app it was called after (FR-128).
  let label = options.label;
  let named: GraviewApp<AnySchema> = options.app as never;
  // A new declaration on its way (FR-116): `drawn()` waits for it.
  let swapping: Promise<void> = Promise.resolve();
  // Which face is asked for, which is drawn, and who is waiting for the one asked for.
  // Under address routing, the face the address names (FR-106). A host that names
  // none is told the face the app opens on as it first draws (FR-136).
  const namedFace = options.at?.face ?? options.face;
  const opening: EmbedFace | undefined = namedFace === undefined ? undefined : faceAtAddress({ ...options, face: namedFace });
  let asked: EmbedFace = opening ?? faceOf(options.stop);
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
    const [face, setFace] = useState<EmbedFace | undefined>(opening);
    const [stop, setStop] = useState<string | undefined>(options.stop);
    const [path, setPath] = useState<string | undefined>(options.path);
    const [scheme, setScheme] = useState<Scheme | "auto">(options.scheme ?? "auto");
    const [principal, setSeat] = useState<Principal | undefined>(options.principal);
    const [seats, setSeats] = useState<EmbedOptions["seats"]>(options.seats);
    const [people, setPeople] = useState<readonly Person[] | undefined>(options.people);
    const [hostContext, setHostContext] = useState<EmbedHostContext | undefined>(options.hostContext);
    const [brand, setBrand] = useState<Brand | undefined>(options.brand);
    const [called, setCalled] = useState<string | undefined>(options.label);
    const [hostActions, setHostActions] = useState<EmbedOptions["hostActions"]>(options.hostActions);
    const [swap, setSwap] = useState<Swap | undefined>(undefined);
    setters = {
      app: (next) => {
        setSwap(next);
        setPath(undefined);
        setStop(undefined);
      },
      face: setFace, stop: setStop, path: setPath, scheme: setScheme, seat: setSeat, seats: setSeats, people: setPeople, hostContext: setHostContext, brand: setBrand, label: setCalled, hostActions: setHostActions };
    return (
      <Whereabouts.Provider value={here}>
      <Embed<S>
        key={swap?.n ?? 0}
        {...(swap ? swapped(options, swap) : options)}
        store={store as never}
        notices={board}
        {...(face !== undefined ? { face } : {})}
        onOpening={(opened) => {
          asked = opened;
        }}
        {...(stop !== undefined ? { stop } : {})}
        {...(path !== undefined ? { path } : {})}
        {...(principal ? { principal } : {})}
        {...(seats ? { seats } : {})}
        {...(people ? { people } : {})}
        {...(hostContext ? { hostContext } : {})}
        {...(brand ? { brand } : {})}
        label={called}
        hostActions={hostActions}
        scheme={scheme}
        onFace={(next) => {
          asked = next;
          setFace(next);
        }}
        onSeat={setSeat}
        onDrawn={onDrawn}
      />
      </Whereabouts.Provider>
    );
  }
  const where = (): EmbedWhere => {
    const focus = here.view?.focusId;
    const kind = focus ? store.graph.getNode(focus)?.kind : undefined;
    // On the scene the place is the overview, and its stop rides on it (FR-132).
    const onScene = (here.shown ?? asked) === "scene" || (here.shown ?? asked) === "graview";
    return { face: asked, path: onScene ? OVERVIEW_PATH : (here.pages?.() ?? options.path ?? "/"), stop: here.view ? toUrl(here.view) : (options.stop ?? "#"), ...(kind ? { kind } : {}) };
  };
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    get store() {
      return store;
    },
    where,
    setApp: (app, given, asked) => {
      const remote: EmbedRemote<AnySchema> = "graph" in given ? { store: given } : given;
      // The app on the page stays drawn until the rules for settling the place in the new one are here.
      const swap = () => {
        const at = where();
        store = remote.store;
        // A label that was the app's own name is the new app's (FR-128); one the host chose stays, unless it says another.
        label = asked?.label ?? (label === named.name ? app.name : label);
        named = app;
        flushSync(() => {
          setters?.label(label);
          setters?.app({ app, remote, at, n: ++swaps });
        });
      };
      if (settling) swap();
      else swapping = swapping.then(fetchSettling).then(swap);
    },
    setFace: (face) => {
      asked = face;
      flushSync(() => setters?.face(face));
    },
    setStop: (stop) => flushSync(() => setters?.stop(stop)),
    setPath: (path) =>
      flushSync(() => {
        // The overview's path is the scene; any other path is a page (FR-132).
        if (isOverview(path)) {
          if (asked === "pages" || asked === "picture") {
            asked = "scene";
            setters?.face("scene");
          }
          return;
        }
        setters?.path(path);
        if (asked !== "pages") {
          asked = "pages";
          setters?.face("pages");
        }
      }),
    setScheme: (scheme) => flushSync(() => setters?.scheme(scheme)),
    setSeat: (principal) => flushSync(() => setters?.seat(principal)),
    setSeats: (seats) => flushSync(() => setters?.seats(seats)),
    setPeople: (people) => flushSync(() => setters?.people(people)),
    setHostContext: (context) => flushSync(() => setters?.hostContext(context)),
    setBrand: (brand) => flushSync(() => setters?.brand(brand)),
    setLabel: (given) => {
      label = given;
      flushSync(() => setters?.label(given));
    },
    setHostActions: (actions) => flushSync(() => setters?.hostActions(actions)),
    /* Drawn is the face asked for — below `pagesBelow`, drawn as the pages that stand in for it. */
    drawn: () => swapping.then(() => (drawnFace === asked ? undefined : new Promise<void>((resolve) => waiting.push(resolve)))),
    notify: (notice) => {
      let said: NoticeHandle | undefined;
      flushSync(() => {
        said = board.notify(notice);
      });
      return said!;
    },
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
