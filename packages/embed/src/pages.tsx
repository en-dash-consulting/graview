import type { AnySchema, Brand, Person, Principal, Store } from "@graview/core";
import { createPartsWatch, ErrorReportContext, GraviewProvider, PartsWatchContext, type AwaySummary, type Scheme } from "@graview/react/provider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrawnSignal } from "./drawn.js";
import { draftWaits, fetchDraftHost, Settling, useDraft, type EmbedDraftView } from "./draft.js";
import type { EmbedWhere } from "./where.js";
import { createRoot, type Root } from "react-dom/client";
import { PagesContent } from "./pages-content.js";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives/pages";
import { createViews, type ReactViewRegistry } from "@graview/react/provider";

/** The pages alone draw from the first commit, so the framework's views are registered outright here. */
const pagesViews = <S extends AnySchema>(schema: S, specs: Parameters<typeof registerViewSpecs>[2]): ReactViewRegistry<S> =>
  registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, specs) as unknown as ReactViewRegistry<S>;
import { flushSync } from "react-dom";
import { createNoticeBoard, frameworkVoice, NoticeBoardContext, type Notice, type NoticeHandle } from "@graview/primitives/frame";
import { barLeaves, FaceBoundary, FrameBar, FrameFirstLook, FrameNotices, placeOfPath, providerProps, storeOf, titleBelow, useErrorReport, useFrame, useIntrinsicHeight, useReady, useSteering, useViews, type EmbedHostContext, type FrameOptions } from "./frame.js";
import { addressOf, pathWithin } from "@graview/core";
import { appKeyOf, BarFindContext, type BarFind } from "@graview/primitives/frame";

/**
 * THE PAGES AND NOTHING ELSE (FR-19). `@graview/embed/pages` mounts the
 * routed face alone: no scene, no Graview, no studio, no lenses it would
 * never draw. A chat's widget or a phone's page that only ever shows the
 * pages bundles this, and a size budget in CI holds it to that
 * (`scripts/lib/bundle-budget.mjs`).
 *
 * It takes what the whole embed takes except what only the scene has (a
 * face, a stop, the studio), and its handle is the same less the faces. Its
 * bar names no overview: there is no scene here to go to (FR-132). It takes `views`: the pages draw the same pictures
 * the scene would (FR-35).
 */
export interface PagesEmbedOptions<S extends AnySchema = AnySchema> extends FrameOptions<S> {
  /** The level the app bar says the app's name at (FR-131): `1` when the host's page is the app, `2` (the default) in an article, `false` when the host's own heading says it. */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /**
   * TOLD WHEN A PAGE HAS DRAWN AND SETTLED (FR-188), as the whole embed
   * tells it: once its parts, fonts, images, worker views and frame guests
   * are here and nothing has moved for a moment. The root wears
   * `data-graview-drawn` (the page's path) from then until the reader moves.
   */
  readonly onDrawn?: (place: EmbedWhere) => void;
  /**
   * A VIEW PROPOSED AND NOT KEPT (FR-187), as the whole embed draws one:
   * drawn where its manifest attaches, marked "Draft — <title> · Not kept",
   * kept nowhere. The worker's host is fetched before the pages draw, only
   * when a draft is handed; `handle.setDraftView` swaps it in place.
   */
  readonly draftView?: EmbedDraftView | null;
}

export interface PagesEmbedProps<S extends AnySchema = AnySchema> extends PagesEmbedOptions<S> {
  /** Called when a seat is taken in the person's menu; the host decides who sits. */
  readonly onSeat?: (principal: Principal) => void;
}

export function PagesEmbed<S extends AnySchema>(props: PagesEmbedProps<S>) {
  const [, ready] = useState(false);
  const arrived = useCallback(() => ready(true), []);
  const drew = useRef(false);
  // A draft is drawn with the app's own views from the first frame (FR-187); one handed later is drawn in once the worker's host is here.
  if (!drew.current && draftWaits(props.draftView)) return <Settling onReady={arrived} fetch={fetchDraftHost} />;
  drew.current = true;
  return <PagesDrawing<S> {...props} />;
}

function PagesDrawing<S extends AnySchema>(props: PagesEmbedProps<S>) {
  const { app, bar = true, standing = "Everything is in order" } = props;
  const { rootRef, scope, css, scheme, store, presence, brand, auto, height } = useFrame(props);
  // The registry the whole embed would draw from: the pages' cards, rows and record pages (FR-35), and a draft over them.
  const draft = useDraft(props.draftView);
  const views = useViews<S>(props, pagesViews, draft.over);
  useIntrinsicHeight(rootRef, "pages", props.onIntrinsicHeight);
  const report = useErrorReport(props.onError, "pages");
  const ready = useReady(props.onReady, "pages");
  useEffect(() => ready("pages"), [ready]);
  const address = props.routing === "address";
  const base = props.basePath === undefined ? {} : { basePath: props.basePath };
  // Where the routed face is, said by its router, for the bar's tabs; and the bar's presses, taken by it (FR-131).
  const { at, steering, steer } = useSteering(address && typeof window !== "undefined" ? `${pathWithin(window.location.pathname, props.basePath) ?? "/"}${window.location.search}` : (props.path ?? "/"));
  // Said on the root once the page has drawn and settled, and off in the commit that moves or swaps the draft (FR-188).
  // The parts each page waits for until they have drawn, not only until their modules arrived.
  const [parts] = useState(createPartsWatch);
  useDrawnSignal(rootRef, `${at} ${draft.n}`, { face: "pages", path: at, stop: "#" }, props.onDrawn, parts);
  const [barFind, setBarFind] = useState<BarFind | null>(null);
  // The board the app speaks on, the host's or the frame's own: the one drawn is the one the face says things on.
  const [ownBoard] = useState(createNoticeBoard);
  const notices = props.notices ?? ownBoard;
  // What the pages say on it is the framework's, which a host's Report this may answer (FR-237).
  const voice = useMemo(() => frameworkVoice(notices), [notices]);
  return (
    <section
      ref={rootRef}
      className={scope}
      aria-label={props.label ?? app.name}
      data-graview-embed="pages"
      data-graview-scheme={scheme}
      // Its own stacking context: every layer inside it (the scene's corner control, a panel) is ordered inside it, never over the host's page.
      style={{ position: "relative", isolation: "isolate", height, minHeight: auto ? 0 : 320, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--graview-radius, 12px)" }}
    >
      <style>{css}</style>
      <ErrorReportContext.Provider value={report}>
        <FrameNotices rootRef={rootRef} board={notices} onReport={props.onReport} where={() => placeOfPath(at)} />
        <FrameFirstLook rootRef={rootRef} firstLook={props.firstLook} app={appKeyOf(brand ?? { name: app.name }, app.schema)} />
        <FaceBoundary module="@graview/react" report={report} content>
          <PartsWatchContext.Provider value={parts}>
          <GraviewProvider store={store} views={views} scheme={scheme} {...providerProps(props, presence, brand)} {...(props.onSeat ? { onSeat: props.onSeat } : {})}>
            {bar ? (
              <FaceBoundary module="@graview/embed" report={report}>
                <FrameBar
                  name={brand?.name ?? app.name}
                  heading={props.heading ?? 2}
                  named={barLeaves(bar).name !== false}
                  at={at}
                  without={props.pages?.without()}
                  home={{ ...(props.hrefOf?.("/") !== undefined ? { href: props.hrefOf("/") } : address ? { href: addressOf("/", base) } : {}), go: () => steer("/"), current: at.split("?")[0] === "/" }}
                  reach={{ ...(props.hrefOf ? { href: props.hrefOf } : address ? { href: (path: string) => addressOf(path, base) } : {}), go: (place) => steer(place.path) }}
                  standing={standing}
                  hostActions={props.hostActions}
                  barActions={props.barActions}
                  onFind={setBarFind}
                />
              </FaceBoundary>
            ) : null}
            <BarFindContext.Provider value={barFind}>
              <NoticeBoardContext.Provider value={voice}>
              <FaceBoundary module="@graview/pages" report={report} content>
                <PagesContent<S> store={store} views={views} presence={presence} auto={auto} brand={brand} steering={steering} scope={scope} titleLevel={titleBelow(props.heading ?? 2)} props={props} />
              </FaceBoundary>
              </NoticeBoardContext.Provider>
            </BarFindContext.Provider>
          </GraviewProvider>
          </PartsWatchContext.Provider>
        </FaceBoundary>
      </ErrorReportContext.Provider>
    </section>
  );
}

export interface PagesEmbedHandle {
  setScheme(scheme: Scheme): void;
  /** Sends the pages to a path within the app's own routes (FR-106), for a host that keeps its own history. */
  setPath(path: string): void;
  /** Put another principal at the keyboard; the store and its history stay. */
  setSeat(principal: Principal): void;
  /** Offer other seats, or none: a seat switcher is drawn only for two or more. */
  setSeats(seats: PagesEmbedOptions["seats"]): void;
  /** Name other people: an agent who first acts after the page opened is named from the next render. */
  setPeople(people: readonly Person[]): void;
  /** What the host now says about its frame: the chat's theme changed, say. */
  setHostContext(context: EmbedHostContext): void;
  /** Re-dress the embed: another brand, or the same brand with a different kit. */
  setBrand(brand: Brand | undefined): void;
  /** What the app's own actor did while the reader was away, now (FR-212): the tray says it from the next render; `undefined` says nothing again. */
  setWhileAway(away: AwaySummary | undefined): void;
  /** What the embed is called (FR-128): its accessible name, and the name each landmark inside is said after. */
  setLabel(label: string): void;
  /** The host's own actions in the profile menu (FR-72), now. */
  setHostActions(actions: PagesEmbedOptions["hostActions"]): void;
  /** The host's buttons on the bar (FR-227), now; `undefined` takes them off. */
  setBarActions(actions: PagesEmbedOptions["barActions"]): void;
  /** Another view proposed and not kept, or none (FR-187), swapped in place: `data-graview-drawn` comes off and returns once it has drawn. */
  setDraftView(draft: EmbedDraftView | null): void;
  /** Says something in the app's own notices (FR-75): a toast, or a banner that stays until it is cleared. */
  notify(notice: Notice): NoticeHandle;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

/**
 * Mounts the pages of an app into an element and hands back the controls.
 * The first render is synchronous, so what comes back is already on the page.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: PagesEmbedOptions<S>): PagesEmbedHandle {
  const store = options.store ?? options.remote?.store ?? storeOf(options.app, options.seed);
  const board = options.notices ?? createNoticeBoard();
  let set: {
    scheme(scheme: Scheme): void;
    seat(principal: Principal): void;
    seats(seats: PagesEmbedOptions["seats"]): void;
    people(people: readonly Person[]): void;
    hostContext(context: EmbedHostContext): void;
    brand(brand: Brand | undefined): void;
    whileAway(away: AwaySummary | undefined): void;
    path(path: string): void;
    label(label: string): void;
    hostActions(actions: PagesEmbedOptions["hostActions"]): void;
    barActions(actions: PagesEmbedOptions["barActions"]): void;
    draft(draft: EmbedDraftView | null): void;
  } | null = null;
  function Host() {
    const [scheme, setScheme] = useState<Scheme | "auto">(options.scheme ?? "auto");
    const [path, setPath] = useState<string | undefined>(options.path);
    const [principal, setSeat] = useState<Principal | undefined>(options.principal);
    const [seats, setSeats] = useState<PagesEmbedOptions["seats"]>(options.seats);
    const [people, setPeople] = useState<readonly Person[] | undefined>(options.people);
    const [hostContext, setHostContext] = useState<EmbedHostContext | undefined>(options.hostContext);
    const [brand, setBrand] = useState<Brand | undefined>(options.brand);
    const [whileAway, setWhileAway] = useState<AwaySummary | undefined>(options.whileAway);
    const [label, setLabel] = useState<string | undefined>(options.label);
    const [hostActions, setHostActions] = useState<PagesEmbedOptions["hostActions"]>(options.hostActions);
    const [barActions, setBarActions] = useState<PagesEmbedOptions["barActions"]>(options.barActions);
    const [draft, setDraft] = useState<EmbedDraftView | null | undefined>(options.draftView);
    set = { path: setPath, scheme: setScheme, seat: setSeat, seats: setSeats, people: setPeople, hostContext: setHostContext, brand: setBrand, whileAway: setWhileAway, label: setLabel, hostActions: setHostActions, barActions: setBarActions, draft: setDraft };
    return (
      <PagesEmbed<S>
        {...options}
        store={store as never}
        notices={board}
        {...(principal ? { principal } : {})}
        {...(seats ? { seats } : {})}
        {...(people ? { people } : {})}
        {...(hostContext ? { hostContext } : {})}
        {...(brand ? { brand } : {})}
        {...(path !== undefined ? { path } : {})}
        whileAway={whileAway}
        label={label}
        hostActions={hostActions}
        barActions={barActions}
        draftView={draft}
        scheme={scheme}
        onSeat={setSeat}
      />
    );
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setScheme: (scheme) => flushSync(() => set?.scheme(scheme)),
    setPath: (path) => flushSync(() => set?.path(path)),
    setSeat: (principal) => flushSync(() => set?.seat(principal)),
    setSeats: (seats) => flushSync(() => set?.seats(seats)),
    setPeople: (people) => flushSync(() => set?.people(people)),
    setHostContext: (context) => flushSync(() => set?.hostContext(context)),
    setBrand: (brand) => flushSync(() => set?.brand(brand)),
    setWhileAway: (away) => flushSync(() => set?.whileAway(away)),
    setLabel: (label) => flushSync(() => set?.label(label)),
    setHostActions: (actions) => flushSync(() => set?.hostActions(actions)),
    setBarActions: (actions) => flushSync(() => set?.barActions(actions)),
    setDraftView: (draft) => flushSync(() => set?.draft(draft)),
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

export { hostScheme } from "./frame.js";
export { DRAWN_ATTRIBUTE } from "./drawn.js";
export type { EmbedDraftView } from "./draft.js";
export type { EmbedWhere } from "./where.js";
export type { EmbedBar, EmbedError, EmbedErrorWhere, EmbedHostContext, EmbedReady, EmbedRemote } from "./frame.js";
export type { HostAction } from "@graview/primitives/frame";
export { createNoticeBoard } from "@graview/primitives/frame";
export type { Notice, NoticeAction, NoticeBoard, NoticeHandle, NoticeReport, NoticeTone } from "@graview/primitives/frame";
