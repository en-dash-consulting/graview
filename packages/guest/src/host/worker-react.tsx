import type { ViewProblemSaid } from "./problems.js";
import type { AnySchema, KindOfSchema, PagesArrangement, Principal, SignIn, Store } from "@graview/core";
import { DefaultDrawnElsewhere, HomeFallsBack, isDefaultView, markAhead, markBleeds, markPreviews, markReplacesPage, PageOfItsOwn, useGoTo, useGraviewIfAny, useKeptDrawings, useHostAssets, useHostFiles, useHostReel, useHostViewerState, usePlayback, ViewContentHeight, type GoTo, type KeptDrawing, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { setViewPlace } from "@graview/react/drawing";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ContextType, type ReactNode } from "react";
import type { EmbedHost } from "./embeds.js";
import type { GuestPlace } from "../protocol.js";
import type { WorkerViewManifest } from "./manifest.js";
import type { GuestViewInput } from "./session.js";
import type { GuestBrand } from "./theme.js";
import { untilItArrives, viewPressing, workerChunk } from "./arrive.js";
import type { WorkerView, WorkerViewFailure, WorkerViewLimits } from "./view.js";
import { codeOf, type WorkerViewCode, type WorkerViewLoad } from "./code-of.js";

/** A worker view as an app registers it: its manifest, its code, and how far it may go. */
export interface WorkerViewDefinition {
  readonly manifest: WorkerViewManifest;
  /**
   * Its code: `{ source }`, a plain script against the `graview` global
   * (FR-96), or a whole worker script — or a function answering either,
   * asked only when the view is first drawn (Roadmap f-heavy-apps-fast):
   * the manifest is what registers it, as a place and in every menu, so a
   * host with many views fetches only the code of the ones a person opens.
   * Code that never arrives is refused `source` and the kind's face drawn.
   */
  readonly worker: WorkerViewCode | WorkerViewLoad;
  readonly limits?: WorkerViewLimits;
  /** Who made it, said under it ("Made by Claude for Nick"). */
  readonly author?: string;
  /**
   * Each drawing of it that is not going to be shown, and why, once (FR-102):
   * the reason and a sentence saying it. A page whose policy refuses its
   * worker hears `start`, the sentence naming the directive.
   */
  readonly onFailure?: (reason: WorkerViewFailure, detail?: string) => void;
  /**
   * Each thing it did that went nowhere, and why (FR-93): a link or
   * `graview.navigate` to no record and no place, naming the places there
   * are; a part that failed; what of it the host refused. Beside the
   * sentence, a code from `VIEW_PROBLEM_CODES` that stays when the words
   * change, and the part's name where a part failed (`mountWorkerView`).
   */
  readonly onProblem?: ViewProblemSaid;
  /** Where an image the app holds (`/graview/assets/<sha256>.<ext>`) is loaded from, so the view may draw it by that path (WorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** Where a record's file (`FileValue.href`) is fetched for the pictures the view is handed, so a host serving the app under a base answers `base + href` (WorkerViewOptions.file). The page's host's files say where by default (`HostFiles.src`). */
  readonly file?: (href: string) => string | undefined;
  /** The `https:` origins its images may come from by address (WorkerViewOptions.images): none by default. */
  readonly images?: { readonly origins: readonly string[] };
  /** The `https:` origins the faces its app lends it may come from by address (WorkerViewOptions.fonts): none by default, and none taken from `images`. */
  readonly fonts?: { readonly origins: readonly string[] };
  /** `false`: none of the view's own faces is drawn, each said as refused, while the faces the app lends still draw (WorkerViewOptions.ownFaces). `true` by default. */
  readonly ownFaces?: boolean;
  /** The providers it may play a video from (WorkerViewOptions.embeds): YouTube and Vimeo unsaid, none for `{ providers: [] }`. */
  readonly embeds?: EmbedHost;
  /** The `https:` origins its links may go to beyond what it was handed (WorkerViewOptions.links): none by default. */
  readonly links?: { readonly origins: readonly string[] };
  /**
   * A VIEW PROPOSED AND NOT KEPT (FR-187): drawn where it attaches under
   * one line, "Draft — <title> · not kept", as the seat's drawn panel is
   * marked on `/~draft`. It is registered under no name, so the place menu
   * offers no Hide or Delete for it and the host's tidying never touches
   * it; where it fails it says why in its place rather than standing the
   * kind's own face there; playback draws it as it is, never as a kept view
   * of the same name stood. Nothing of it is kept anywhere.
   */
  readonly draft?: boolean;
  /**
   * Proposed and not kept, and drawn as the page it would be, with no line
   * over it (a page's own view, as a host's `forked` says it): what it keeps
   * lasts this drawing, as a `draft`'s does, and nothing a host keeps is its
   * to read or write.
   */
  readonly keepsNothing?: boolean;
}

/** The brand with its logo's paths under `/graview/assets/` where the host serves them (Roadmap f-brand-marks-under-app-base); as it is with no `assetsAt`. */
function brandUnder(brand: GuestBrand | undefined, assetsAt: ((path: string) => string) | undefined): GuestBrand | undefined {
  const logo = brand?.logo;
  if (!assetsAt || !logo) return brand;
  const at = (mark: string) => (mark.startsWith("/graview/assets/") ? assetsAt(mark) : mark);
  return { ...brand, logo: typeof logo === "string" ? at(logo) : { ...logo, light: at(logo.light), ...(logo.dark ? { dark: at(logo.dark) } : {}) } };
}

const inputOf = (props: ViewProps<AnySchema>): GuestViewInput => ({
  ...(props.node ? { node: { id: props.node.id } } : {}),
  ...(props.nodes ? { nodes: props.nodes.map((node) => ({ id: node.id })) } : {}),
  ...(props.label !== undefined ? { label: props.label } : {}),
  fidelity: props.fidelity,
  cardinality: props.cardinality,
  mode: props.mode,
  selected: props.selected,
  ...(props.implicated ? { implicated: props.implicated } : {}),
  ...(props.flagged ? { flagged: props.flagged } : {}),
});

interface MountProps {
  readonly definition: WorkerViewDefinition;
  readonly store: Store<AnySchema>;
  readonly principal: Principal;
  readonly input?: () => GuestViewInput;
  /** Where the face sends the reader: a record, or a named place. */
  readonly goTo?: GoTo;
  /** The app's named places. */
  readonly places?: () => readonly GuestPlace[];
  /** The app's arrangement: what the declaration calls the Scene, for the vocabulary a link is judged by (FR-235). */
  readonly arrangement?: () => PagesArrangement | undefined;
  /** Changes when the app's scheme does: the view is pushed its look again. */
  readonly scheme?: string;
  /** The app's brand (FR-127): its name and logo, pushed again when it changes. */
  readonly brand?: GuestBrand | undefined;
  readonly onFailure: (reason: WorkerViewFailure, detail?: string) => void;
  /** The host draws nothing in a failed view's place: the component draws the kind's own face instead. */
  readonly drawsItsOwn?: boolean;
  /** Changes when what the view is drawn over does. */
  readonly tick?: unknown;
  /** Where it is drawn, when that is a page of its own to be gone back to: its drawing is kept as the page is left, and stands at once when it is returned to. */
  readonly keptAs?: string | undefined;
}

/** What a mounted view reads of the component it is drawn by: the one that drew it, then the one that took it back. */
interface Reads {
  input: MountProps["input"];
  goTo: MountProps["goTo"];
  places: MountProps["places"];
  arrangement: MountProps["arrangement"];
  onFailure: MountProps["onFailure"];
  brand: GuestBrand | undefined;
  reel: ReturnType<typeof useHostReel>;
  hostFiles: ReturnType<typeof useHostFiles>;
  hostAssets: ReturnType<typeof useHostAssets>;
  viewerState: ReturnType<typeof useHostViewerState>;
  told: ContextType<typeof ViewContentHeight>;
  signIn: SignIn | undefined;
}

/** A worker view off its page, kept to be gone back to (Graview HQ f-custom-pages-do-not-flash). */
interface KeptView extends KeptDrawing {
  readonly view: WorkerView;
  /** Puts what its place lends its revision on the element it is drawn in now. */
  readonly lend: (element: HTMLElement) => void;
  readonly box: { reads: { current: Reads }; away: boolean; gone: () => void };
}

/**
 * A SCRIPT VIEW AS IT STOOD AT THE MOMENT DRAWN (Roadmap f-playback): the
 * code the host hands for this view at that seq (`history.viewAt`) — or
 * `null` when the view did not exist then — and the definition itself at
 * now, or where the host does not say. The log holds no view's code; the
 * host does.
 */
function useDefinitionThen(definition: WorkerViewDefinition): WorkerViewDefinition | null {
  const playback = usePlayback();
  const seq = playback?.past?.seq;
  const viewAt = playback?.host?.viewAt;
  // A draft is the code proposed, at any moment: a kept view of its name is not what it draws.
  const then = useMemo(() => (seq === undefined || !viewAt || definition.draft || definition.keepsNothing ? undefined : viewAt(definition.manifest.name, seq)), [viewAt, seq, definition]);
  return useMemo(() => (then === null ? null : then === undefined ? definition : { ...definition, worker: then as WorkerViewCode }), [then, definition]);
}

/*
 * A REVISION KEPT, DRAWN IN THIS PAGE (Roadmap f-make-this-section-better):
 * the code a view is drawn from once "Make this better" kept a revision of
 * it — per definition, so a host that hands the view again (its own copy
 * of the kept code) is drawn from what it handed.
 */
const DRAWN_INSTEAD = new WeakMap<WorkerViewDefinition, string>();
const drawnInsteadHeard = new Set<() => void>();
const hearDrawnInstead = (listener: () => void) => {
  drawnInsteadHeard.add(listener);
  return () => void drawnInsteadHeard.delete(listener);
};
function drawInstead(definition: WorkerViewDefinition, source: string | undefined): void {
  if (source === undefined) DRAWN_INSTEAD.delete(definition);
  else DRAWN_INSTEAD.set(definition, source);
  for (const listener of [...drawnInsteadHeard]) listener();
}

/** The region a worker view is drawn in, mounted when it is drawn; the host's half is fetched then. */
function WorkerViewMount({ definition: given, store, principal, input, goTo, places, arrangement, scheme, brand, onFailure, drawsItsOwn, tick, keptAs }: MountProps) {
  /* A revision kept in this page is drawn in the view's own place, from its code. */
  const instead = useSyncExternalStore(hearDrawnInstead, () => DRAWN_INSTEAD.get(given), () => undefined);
  const definition = useMemo<WorkerViewDefinition>(() => (instead === undefined ? given : { ...given, worker: { source: instead } }), [given, instead]);
  const holder = useRef<HTMLDivElement>(null);
  const mounted = useRef<WorkerView | null>(null);
  const hostFiles = useHostFiles();
  /* Where the app's own images are served (Roadmap f-brand-marks-under-app-base): the definition's word, else the page's host's. */
  const hostAssets = useHostAssets();
  const viewerState = useHostViewerState();
  /* The app's own video (HQ f-view-names-app-video): its facts pushed in the theme, played where the view places data-app="reel". */
  const reel = useHostReel();
  /* Where the face that holds the view to a box hears how tall it drew (the Scene's preview): the host measures, the view never says. */
  const told = useContext(ViewContentHeight);
  // The logo a view is handed is fetched from the page's origin: a path under /graview/assets/ is fetched where the host serves it.
  const served = useMemo(() => brandUnder(brand, hostAssets), [brand, hostAssets]);
  /* The host's way in for a visitor (FR-183): drawn in the view's place where everything it reads is kept from the seat. */
  const signIn = useGraviewIfAny<AnySchema>()?.signIn;
  const latest = useRef<Reads>({ input, goTo, places, arrangement, onFailure, brand: served, reel, hostFiles, hostAssets, viewerState, told, signIn });
  latest.current = { input, goTo, places, arrangement, onFailure, brand: served, reel, hostFiles, hostAssets, viewerState, told, signIn };
  /*
   * THE PAGE IS LEFT, AND GONE BACK TO (Graview HQ
   * f-custom-pages-do-not-flash). The view is put by as it stands when the
   * page goes, and taken back, as the page comes, before it is painted: no
   * worker to start and no host to ask, so nothing stands empty. Only a page
   * of its own is (`keptAs`), never a draft, and only for exactly this view,
   * this store, this seat and where its viewer's values are kept; anything
   * else that changes disposes of it, as ever.
   */
  const keeping = useKeptDrawings();
  const held = useRef<KeptView | undefined>(undefined);
  const now = useRef<{ readonly keep: typeof keeping; readonly as: string; readonly of: readonly unknown[] }>(undefined);
  now.current = { keep: keptAs !== undefined && !definition.draft && !definition.keepsNothing ? keeping : null, as: keptAs ?? "", of: [given, instead, store, principal, viewerState] };
  const putBack = useRef<(() => void) | undefined>(undefined);
  /* Mounted by the effect below, and put by since (a page hidden while a part of it is fetched): drawn anew where it was let go of meanwhile. */
  const stood = useRef(false);
  const [anew, setAnew] = useState(0);
  useLayoutEffect(() => {
    const element = holder.current;
    const { keep, as, of } = now.current!;
    const back = held.current ? undefined : keep?.take<KeptView>(as, of);
    if (element && back) {
      back.box.reads = latest;
      back.box.away = false;
      const refocus = back.view.wake(element);
      if (refocus) {
        held.current = back;
        mounted.current = back.view;
        putBack.current = refocus;
        back.lend(element);
      } else back.dispose();
    }
    if (stood.current && !held.current) setAnew((was) => was + 1);
    return () => {
      const one = held.current;
      const { keep, as } = now.current!;
      if (!one || !keep) return;
      one.box.gone = () => keep.forget(one);
      if (!one.view.rest(() => one.box.gone())) return;
      one.box.away = true;
      held.current = undefined;
      mounted.current = null;
      if (element) setViewPlace(element, null);
      keep.keep(as, one);
    };
  }, []);
  /* After the page it is on has put the keyboard on its heading. */
  useEffect(() => {
    putBack.current?.();
    putBack.current = undefined;
  });
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const dispose = () => {
      setViewPlace(element, null);
      held.current?.dispose();
      held.current = undefined;
      mounted.current = null;
      stood.current = false;
    };
    /* Taken back as the page came. */
    if (held.current) {
      stood.current = true;
      return dispose;
    }
    const { of } = now.current!;
    const box: KeptView["box"] = { reads: latest, away: false, gone: () => undefined };
    /* Where a record's file is fetched: the definition's word, else where the page's host serves its files (0.1.36). */
    const file = definition.file ?? (latest.current.hostFiles?.src ? (href: string) => box.reads.current.hostFiles?.src?.(href) ?? href : undefined);
    /* Code fetched when drawn: asked now, beside the worker's host, not after it (the host judges what arrives, and says so where it does not). */
    if (typeof definition.worker === "function") void codeOf(definition.worker).catch(() => undefined);
    type Chunk = Awaited<ReturnType<typeof workerChunk>>;
    const optionsFor = (worker: WorkerViewDefinition["worker"]): Parameters<Chunk["mountWorkerView"]>[1] => ({
        manifest: definition.manifest,
        worker,
        store,
        principal,
        input: () => box.reads.current.input?.() ?? {},
        /* Links stay in the app (FR-93): a record, a place or a kind's list — narrowed and to a section — on whichever face the view is drawn. */
        goTo: () => box.reads.current.goTo,
        places: () => box.reads.current.places?.() ?? [],
        arrangement: () => box.reads.current.arrangement?.(),
        brand: () => box.reads.current.brand,
        reel: () => box.reads.current.reel,
        /* Off its page, a view that fails is let go, and judged afresh where its page is gone back to. */
        onFailure: (reason, detail) => (box.away ? box.gone() : box.reads.current.onFailure(reason, detail)),
        ...(drawsItsOwn ? { fallback: false as const } : {}),
        ...(definition.limits ? { limits: definition.limits } : {}),
        ...(definition.author ? { author: definition.author } : {}),
        ...(definition.onProblem ? { onProblem: definition.onProblem } : {}),
        ...(definition.asset ? { asset: definition.asset } : latest.current.hostAssets ? { asset: (path: string) => box.reads.current.hostAssets?.(path) ?? path } : {}),
        ...(file ? { file } : {}),
        ...(definition.images ? { images: definition.images } : {}),
        ...(definition.fonts ? { fonts: definition.fonts } : {}),
        ...(definition.ownFaces === false ? { ownFaces: false } : {}),
        ...(definition.links ? { links: definition.links } : {}),
        ...(definition.embeds ? { embeds: definition.embeds } : {}),
        /* What a file dropped on what the view drew is stored through (FR-193): the page's host's files, as they are now. */
        files: () => box.reads.current.hostFiles,
        /* What it keeps for its viewer (`graview.mine`). A draft, proposed and not kept, keeps nothing of anybody's. */
        ...(definition.draft || definition.keepsNothing ? { draft: true } : { viewerState: () => box.reads.current.viewerState }),
        onContentHeight: (height) => box.reads.current.told?.(height),
        signIn: () => box.reads.current.signIn,
      });
    const stop = untilItArrives(workerChunk, (module) => {
      const view = module.mountWorkerView(element, optionsFor(definition.worker));
      /* What was read for this seat is forgotten with its drawings. */
      const state = latest.current.viewerState;
      if (state) keeping?.onClear(state, () => module.forgetRead(state));
      mounted.current = view;
      stood.current = true;
      /* What the view's place lends its revision (Roadmap f-make-this-section-better), made with the worker's host. */
      const lend = (onto: HTMLElement) => setViewPlace(onto, module.viewPlaceHandle({ element: onto, definition, mounted: () => view, optionsFor, draw: (source) => drawInstead(given, source), mount: module.mountWorkerView, pressing: viewPressing }));
      held.current = { of, view, lend, box, dispose: () => view.dispose() };
      lend(element);
    });
    return () => {
      stop();
      dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, store, principal, anew]);
  /* The reel by what it says, so a host that hands a new object each render with the same facts pushes nothing. */
  const reelSaid = reel ? JSON.stringify(reel) : "";
  useEffect(() => mounted.current?.update(), [scheme, served, reelSaid, tick]);
  /* Never wider than what holds it (Roadmap f-view-place-min-width): a grid item at its content's min-content width took a phone's page past its edge. */
  const place = <div ref={holder} data-worker-view-place={definition.manifest.name} style={{ minWidth: 0 }} />;
  if (!definition.draft) return place;
  const title = definition.manifest.title ?? definition.manifest.name;
  /* A view proposed and not kept says so, as the seat's drawn panel does on `/~draft` (FR-187). */
  return (
    <div role="group" aria-label={`Draft: ${title}`} data-graview-draft-view={definition.manifest.name} style={{ display: "grid", gap: 8, alignContent: "start", minWidth: 0 }}>
      <p data-testid="draft-view-line" style={DRAFT_LINE}>
        <span>
          Draft — <span style={{ color: "var(--graview-ink)", fontWeight: 600 }}>{title}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>Not kept</span>
      </p>
      {place}
    </div>
  );
}

/** The one line over a draft, as the seat's drawn panel wears it: a hairline under it, nothing more. */
const DRAFT_LINE = { margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 8px", fontSize: "0.875rem", color: "var(--graview-ink-muted)", borderBottom: "1px solid var(--graview-edge)", paddingBottom: 8 } as const;

/**
 * WHAT IS DRAWN IN A VIEW'S STEAD, MARKED SO (Roadmap
 * f-fallback-lens-loses-gutter): what a view asked for — `bleed` — is the
 * view's alone, and the face that takes the gutter back for it passes by a
 * slot that holds this instead. No box of its own: it lays out as it would.
 * Where the view failed, it also names the view and the reason (Roadmap
 * r-visitor-sees-lens-not-view), so a visitor drawn the kind's own face where
 * its owner was drawn the view says why to whoever looks
 * (`data-worker-view-failed`: "source" for code that did not arrive).
 */
function Instead({ view: View, props, fellBack }: { readonly view: ViewComponent<AnySchema>; readonly props: ViewProps<AnySchema>; readonly fellBack?: { readonly name: string; readonly reason: WorkerViewFailure } }) {
  return (
    <div data-worker-view-fallback="" {...(fellBack ? { "data-worker-view-fell-back": fellBack.name, "data-worker-view-failed": fellBack.reason } : {})} style={{ display: "contents" }}>
      <View {...props} />
    </div>
  );
}

/** The same mark where nothing is drawn in a view's stead: a home with no page of its own to fall back on, in a past before the view existed. */
const NOTHING_INSTEAD = <div data-worker-view-fallback="" style={{ display: "contents" }} />;

/** The same mark around the home's own page, where the home's view fell back. */
function FellBack({ name, reason, children }: { readonly name: string; readonly reason: WorkerViewFailure; readonly children: ReactNode }) {
  return (
    <div data-worker-view-fell-back={name} data-worker-view-failed={reason} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/**
 * A WORKER VIEW AS A VIEW OF A KIND (FR-91): what `registerWorkerView`
 * registers. It is drawn where the kind's picture is, on both faces, with
 * the viewer's sight cut to its manifest; should it fail — a refused
 * worker, a manifest that names what the app does not declare, a view past
 * its limits — `fallback` is drawn in its place.
 */
export function workerView(definition: WorkerViewDefinition, options: { readonly fallback?: ViewComponent<AnySchema>; readonly beside?: ViewComponent<AnySchema>; readonly home?: boolean } = {}): ViewComponent<AnySchema> {
  const Fallback = options.fallback;
  /* A view that replaces the record's page took the page's facts with it: where it fails, the record's own face is all that is left to say them. */
  const replaces = definition.manifest.replaces === "page";
  function WorkerViewOfKind(props: ViewProps<AnySchema>) {
    const graview = useGraviewIfAny<AnySchema>();
    const goTo = useGoTo();
    const elsewhere = useContext(DefaultDrawnElsewhere);
    /* The page it is drawn as, where the face says it is one: kept to be gone back to. */
    const page = useContext(PageOfItsOwn);
    /* The home's view with no home of the app's to stand in for it: the face that draws the home draws its built-in one instead, where it offers to (Roadmap f-view-budget-fair-to-visitors). */
    const homeFallsBack = useContext(HomeFallsBack);
    const fallsBack = options.home && !Fallback ? homeFallsBack : null;
    const [failed, setFailed] = useState<WorkerViewFailure | null>(null);
    const latest = useRef(props);
    latest.current = props;
    const then = useDefinitionThen(definition);
    if (!graview) return null;
    /* Not made yet at the moment drawn: the kind's own face, as where it fails. */
    if (then === null) return Fallback && !(elsewhere && isDefaultView(Fallback) && !replaces) ? <Instead view={Fallback} props={props} /> : NOTHING_INSTEAD;
    /* Past its limits, the kind's own face — what the registry drew there before — in its place (FR-94), saying which view fell back and why; nothing, where the surface is that face already. */
    if (failed && Fallback) return elsewhere && isDefaultView(Fallback) && !replaces ? NOTHING_INSTEAD : <Instead view={Fallback} props={props} fellBack={{ name: definition.manifest.name, reason: failed }} />;
    if (failed && fallsBack) return NOTHING_INSTEAD;
    /*
     * BESIDE THE RECORD'S OWN FIELDS (FR-149): what was drawn for the record
     * before, under the view — its fields, editable where an act writes
     * them. Not where the surface is that record already (the pages face's
     * record page draws its facts and acts itself).
     */
    const Beside = options.beside && !(elsewhere && isDefaultView(options.beside)) ? options.beside : undefined;
    const mount = (
      <WorkerViewMount
        definition={then}
        store={graview.store}
        principal={graview.principal}
        input={() => inputOf(latest.current)}
        goTo={goTo}
        places={() => graview.views.places()}
        arrangement={() => graview.views.arrangement?.()}
        scheme={graview.scheme}
        brand={graview.brand}
        tick={props}
        keptAs={page !== null && props.mode === "fullscreen" && props.fidelity === "full" ? `${page} ${definition.manifest.name} ${props.node?.id ?? ""}` : undefined}
        drawsItsOwn={Fallback !== undefined || fallsBack !== null}
        onFailure={(reason, detail) => {
          setFailed(reason);
          fallsBack?.(definition.manifest.name, reason);
          definition.onFailure?.(reason, detail);
        }}
      />
    );
    if (!Beside) return mount;
    return (
      <div data-worker-view-beside={definition.manifest.name} style={{ display: "grid", gap: 12, minWidth: 0 }}>
        {mount}
        {/* The view bleeds; what is under it is the record's, and the page's face gives it the column back (`BLEED_FULL_CSS`). */}
        {definition.manifest.bleed === "full" ? (
          <div data-worker-view-beside-under="" style={{ minWidth: 0 }}>
            <Beside {...props} />
          </div>
        ) : (
          <Beside {...props} />
        )}
      </div>
    );
  }
  WorkerViewOfKind.displayName = `WorkerView(${definition.manifest.name})`;
  /* Fetched ahead of its page by a face that knows a person is on their way; a draft is drawn where it is proposed. */
  if (!definition.draft && !definition.keepsNothing) markAhead(WorkerViewOfKind, (asked) =>
    void workerChunk().then(
      (module) => {
        const state = asked.viewerState as ReturnType<typeof useHostViewerState>;
        if (asked.intent && state) asked.kept?.onClear(state, () => module.forgetRead(state));
        module.viewAhead(definition, asked as never);
      },
      () => undefined,
    ));
  return WorkerViewOfKind;
}

/**
 * REGISTER A WORKER VIEW FOR THE KIND ITS MANIFEST ATTACHES TO (FR-91): in
 * the cell its cardinality says, at full fidelity, and — given a title — as
 * a named place, on the Graview face and the pages face alike. Whatever the
 * registry drew there before (the framework's own face of the kind) is what
 * is drawn if the view fails — and, for a view of one record, what is drawn
 * under it (FR-149): the record's own fields, editable, unless the manifest
 * says `replaces: "page"`. A view of many that says so is the kind's list
 * page, in place of the list (FR-203).
 */
export function registerWorkerView<S extends AnySchema>(views: ReactViewRegistry<S>, definition: WorkerViewDefinition): ReactViewRegistry<S> {
  const { manifest } = definition;
  if (manifest.attach === "home") {
    /*
     * THE HOME'S OWN VIEW (FR-81): the routed home's body, full width under
     * the bar on a desk as on a phone — the page the app opens on (FR-136) —
     * in place of the home the app declared, which is drawn if the view fails.
     */
    if (!views.home) throw new Error(`The worker view "${manifest.name}" is the home's body: draw it with workerHome, on the home.`);
    /*
     * A draft that fails says why in its place (FR-187): the app's own home standing there would picture the proposal as fine.
     * What fails over is the app's own home, the last one no host's view gave (FR-202), never another view a host may have deleted.
     * An app that declares no home falls back to its built-in one, where the face that draws the home offers it (`HomeFallsBack`): never a list of every record.
     */
    const given = views.homes?.();
    const declared = definition.draft ? undefined : ((given ? given.filter((one) => one.name === undefined).at(-1)?.view : views.homeView?.()) as ViewComponent<AnySchema> | undefined);
    const home = workerView(definition, declared ? { fallback: declared } : { home: !definition.draft });
    // Edge to edge on a phone, where its manifest says so: the pages face takes the gutter back for it.
    // By its name, so the host's tidying keeps it undrawn once deleted, whatever registered after it (FR-202); a draft has none.
    views.home((manifest.bleed === true || manifest.bleed === "full" ? markBleeds(home, manifest.bleed) : home) as unknown as ViewComponent<S>, definition.draft ? undefined : { name: manifest.name });
    return views;
  }
  const cell = { cardinality: manifest.cardinality, fidelity: "full" } as const;
  const before = (views.lookup(manifest.attach, cell) ?? views.resolve(manifest.attach, cell)?.view) as ViewComponent<AnySchema> | undefined;
  /*
   * A VIEW OF ONE RECORD SITS ABOVE THE RECORD'S OWN FIELDS (FR-149), which
   * stay editable, unless its manifest says it replaces the page: then it is
   * drawn alone, on the scene and as the whole of the record's page.
   */
  const one = manifest.cardinality === "one";
  /* A draft (FR-187): no fallback, so a failure is said in its place, and no name, so nothing tidies it and the place menu offers it nothing to keep. */
  const draft = definition.draft === true;
  const view = workerView(definition, { ...(before && !draft ? { fallback: before } : {}), ...(one && manifest.replaces !== "page" && before ? { beside: before } : {}) });
  /* A view of many that replaces the page is the kind's list page (FR-203): drawn under its heading, in place of the list. */
  if (manifest.replaces === "page") markReplacesPage(view);
  /*
   * THE KIND'S PAGE SLOT, UNDER IT (Roadmap feature:page-slot-blocks-…): a
   * view beside what was drawn before draws that under it — the kind's page
   * blocks, where it has them — so what those blocks say is said by this
   * view too, and the record page does not say it again among the facts.
   */
  const says = (before as { says?: unknown } | undefined)?.says;
  if (one && manifest.replaces !== "page" && typeof says === "function") (view as { says?: unknown }).says = says;
  if (manifest.bleed === true || manifest.bleed === "full") markBleeds(view, manifest.bleed);
  /*
   * A VIEW'S PLACE FLOWS WITH THE PAGE (Roadmap f-view-places-flow), as a
   * place drawn from blocks does: it is drawn in the page's column as long
   * as it is, never a frame most of the window tall that scrolls inside
   * itself under the page's own scroll — on a phone, a box that traps the
   * thumb. The frame stays for the lenses that need one: a board, a calendar
   * — and for a view whose manifest says `flows: false`, a fixed canvas.
   */
  (view as { flows?: boolean }).flows = manifest.flows !== false;
  /* A view that draws its own heading (Roadmap f-place-header-repeats-view-title): its place says the title to a screen reader only. */
  if (manifest.heading === "own") (view as { ownHeading?: boolean }).ownHeading = true;
  /*
   * ON THE SCENE, A PREVIEW (Roadmap f-view-content-height,
   * f-scene-record-view-card): a view is as tall as it draws, so the Scene
   * draws it as a card held to its box — at most its measured content
   * height, at most `scene.maxHeight` — faded where there is more, with Open
   * to its place, or, for a view of one record, to the record's page.
   */
  markPreviews(view, manifest.scene?.maxHeight !== undefined ? { maxHeight: manifest.scene.maxHeight } : {});
  // An untitled view is registered by its name too, so the host's tidying keeps it undrawn once deleted (FR-202).
  views.register(
    manifest.attach as KindOfSchema<S>,
    cell,
    view as unknown as ViewComponent<S>,
    manifest.title ? { title: manifest.title, ...(draft ? {} : { name: manifest.name }), lens: "view", ...(manifest.reads?.kinds?.length ? { reads: manifest.reads.kinds } : {}), ...(manifest.acts?.length ? { acts: manifest.acts.map((one) => (typeof one === "string" ? one : one.act)) } : {}) } : draft ? undefined : { name: manifest.name },
  );
  return views;
}

/** What a home is handed on a face: the store, and who is looking. */
export interface WorkerHomeContext {
  readonly store: Store<AnySchema>;
  readonly principal?: Principal;
}

/**
 * A WORKER VIEW AS THE HOME'S BODY (FR-91): a component for the routed
 * face's `home` surface (`pages.surface("home", workerHome(definition))`).
 * Its manifest attaches to `"home"` and reads what it shows. Should it
 * fail, `fallback` — the app's own home — is drawn in its place.
 */
export function workerHome(definition: WorkerViewDefinition, options: { readonly fallback?: ComponentType<{ readonly context: never }> } = {}): ComponentType<{ readonly context: WorkerHomeContext }> {
  const Fallback = options.fallback as ComponentType<{ readonly context: WorkerHomeContext }> | undefined;
  function WorkerHome({ context }: { readonly context: WorkerHomeContext }) {
    const graview = useGraviewIfAny<AnySchema>();
    const goTo = useGoTo();
    const [failed, setFailed] = useState<WorkerViewFailure | null>(null);
    const then = useDefinitionThen(definition);
    if (failed && Fallback)
      return (
        <FellBack name={definition.manifest.name} reason={failed}>
          <Fallback context={context} />
        </FellBack>
      );
    if (then === null && Fallback) return <Fallback context={context} />;
    if (then === null) return null;
    return (
      <WorkerViewMount
        definition={then}
        store={context.store}
        principal={context.principal ?? graview?.principal ?? { kind: "human" }}
        goTo={goTo}
        {...(graview ? { places: () => graview.views.places(), arrangement: () => graview.views.arrangement?.(), scheme: graview.scheme, brand: graview.brand } : {})}
        drawsItsOwn={Fallback !== undefined}
        keptAs={`home ${definition.manifest.name}`}
        onFailure={(reason, detail) => {
          setFailed(reason);
          definition.onFailure?.(reason, detail);
        }}
      />
    );
  }
  WorkerHome.displayName = `WorkerHome(${definition.manifest.name})`;
  return WorkerHome;
}
