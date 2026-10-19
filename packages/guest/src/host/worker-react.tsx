import type { AnySchema, KindOfSchema, Principal, Store } from "@graview/core";
import { DefaultDrawnElsewhere, isDefaultView, markReplacesPage, useGoTo, useGraviewIfAny, useHostFiles, usePlayback, type GoTo, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useContext, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { GuestPlace } from "../protocol.js";
import type { WorkerViewManifest } from "./manifest.js";
import type { GuestViewInput } from "./session.js";
import type { GuestBrand } from "./theme.js";
import { untilItArrives, workerChunk } from "./arrive.js";
import type { WorkerView, WorkerViewCode, WorkerViewFailure, WorkerViewLimits } from "./view.js";

/** A worker view as an app registers it: its manifest, its code, and how far it may go. */
export interface WorkerViewDefinition {
  readonly manifest: WorkerViewManifest;
  /** Its code: `{ source }`, a plain script against the `graview` global (FR-96), or a whole worker script. */
  readonly worker: WorkerViewCode;
  readonly limits?: WorkerViewLimits;
  /** Who made it, said under it ("Made by Claude for Nick"). */
  readonly author?: string;
  /**
   * Each drawing of it that is not going to be shown, and why, once (FR-102):
   * the reason and a sentence saying it. A page whose policy refuses its
   * worker hears `start`, the sentence naming the directive.
   */
  readonly onFailure?: (reason: WorkerViewFailure, detail?: string) => void;
  /** Each thing it did that went nowhere, and why (FR-93): a link or `graview.navigate` to no record and no place, naming the places there are. */
  readonly onProblem?: (said: string) => void;
  /** Where an image the app holds (`/graview/assets/<sha256>.<ext>`) is loaded from, so the view may draw it by that path (WorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** Where a record's file (`FileValue.href`) is fetched for the pictures the view is handed, so a host serving the app under a base answers `base + href` (WorkerViewOptions.file). The page's host's files say where by default (`HostFiles.src`). */
  readonly file?: (href: string) => string | undefined;
  /** The `https:` origins its images may come from by address (WorkerViewOptions.images): none by default. */
  readonly images?: { readonly origins: readonly string[] };
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
  /** Changes when the app's scheme does: the view is pushed its look again. */
  readonly scheme?: string;
  /** The app's brand (FR-127): its name and logo, pushed again when it changes. */
  readonly brand?: GuestBrand | undefined;
  readonly onFailure: (reason: WorkerViewFailure, detail?: string) => void;
  /** The host draws nothing in a failed view's place: the component draws the kind's own face instead. */
  readonly drawsItsOwn?: boolean;
  /** Changes when what the view is drawn over does. */
  readonly tick?: unknown;
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
  const then = useMemo(() => (seq === undefined || !viewAt ? undefined : viewAt(definition.manifest.name, seq)), [viewAt, seq, definition]);
  return useMemo(() => (then === null ? null : then === undefined ? definition : { ...definition, worker: then as WorkerViewCode }), [then, definition]);
}

/** The region a worker view is drawn in, mounted when it is drawn; the host's half is fetched then. */
function WorkerViewMount({ definition, store, principal, input, goTo, places, scheme, brand, onFailure, drawsItsOwn, tick }: MountProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mounted = useRef<WorkerView | null>(null);
  const hostFiles = useHostFiles();
  const latest = useRef({ input, goTo, places, onFailure, brand, hostFiles });
  latest.current = { input, goTo, places, onFailure, brand, hostFiles };
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    /* Where a record's file is fetched: the definition's word, else where the page's host serves its files (0.1.36). */
    const file = definition.file ?? (latest.current.hostFiles?.src ? (href: string) => latest.current.hostFiles?.src?.(href) ?? href : undefined);
    const stop = untilItArrives(workerChunk, ({ mountWorkerView }) => {
      mounted.current = mountWorkerView(element, {
        manifest: definition.manifest,
        worker: definition.worker,
        store,
        principal,
        input: () => latest.current.input?.() ?? {},
        /* Links stay in the app (FR-93): a record, a place or a kind's list — narrowed and to a section — on whichever face the view is drawn. */
        goTo: () => latest.current.goTo,
        places: () => latest.current.places?.() ?? [],
        brand: () => latest.current.brand,
        onFailure: (reason, detail) => latest.current.onFailure(reason, detail),
        ...(drawsItsOwn ? { fallback: false as const } : {}),
        ...(definition.limits ? { limits: definition.limits } : {}),
        ...(definition.author ? { author: definition.author } : {}),
        ...(definition.onProblem ? { onProblem: definition.onProblem } : {}),
        ...(definition.asset ? { asset: definition.asset } : {}),
        ...(file ? { file } : {}),
        ...(definition.images ? { images: definition.images } : {}),
      });
    });
    return () => {
      stop();
      mounted.current?.dispose();
      mounted.current = null;
    };
  }, [definition, store, principal]);
  useEffect(() => mounted.current?.update(), [scheme, brand, tick]);
  return <div ref={holder} data-worker-view-place={definition.manifest.name} />;
}

/**
 * A WORKER VIEW AS A VIEW OF A KIND (FR-91): what `registerWorkerView`
 * registers. It is drawn where the kind's picture is, on both faces, with
 * the viewer's sight cut to its manifest; should it fail — a refused
 * worker, a manifest that names what the app does not declare, a view past
 * its limits — `fallback` is drawn in its place.
 */
export function workerView(definition: WorkerViewDefinition, options: { readonly fallback?: ViewComponent<AnySchema>; readonly beside?: ViewComponent<AnySchema> } = {}): ViewComponent<AnySchema> {
  const Fallback = options.fallback;
  /* A view that replaces the record's page took the page's facts with it: where it fails, the record's own face is all that is left to say them. */
  const replaces = definition.manifest.replaces === "page";
  function WorkerViewOfKind(props: ViewProps<AnySchema>) {
    const graview = useGraviewIfAny<AnySchema>();
    const goTo = useGoTo();
    const elsewhere = useContext(DefaultDrawnElsewhere);
    const [failed, setFailed] = useState<WorkerViewFailure | null>(null);
    const latest = useRef(props);
    latest.current = props;
    const then = useDefinitionThen(definition);
    if (!graview) return null;
    /* Not made yet at the moment drawn: the kind's own face, as where it fails. */
    if (then === null) return Fallback && !(elsewhere && isDefaultView(Fallback) && !replaces) ? <Fallback {...props} /> : null;
    /* Past its limits, the kind's own face — what the registry drew there before — in its place (FR-94); nothing, where the surface is that face already. */
    if (failed && Fallback) return elsewhere && isDefaultView(Fallback) && !replaces ? null : <Fallback {...props} />;
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
        scheme={graview.scheme}
        brand={graview.brand}
        tick={props}
        drawsItsOwn={Fallback !== undefined}
        onFailure={(reason, detail) => {
          setFailed(reason);
          definition.onFailure?.(reason, detail);
        }}
      />
    );
    if (!Beside) return mount;
    return (
      <div data-worker-view-beside={definition.manifest.name} style={{ display: "grid", gap: 12, minWidth: 0 }}>
        {mount}
        <Beside {...props} />
      </div>
    );
  }
  WorkerViewOfKind.displayName = `WorkerView(${definition.manifest.name})`;
  return WorkerViewOfKind;
}

/**
 * REGISTER A WORKER VIEW FOR THE KIND ITS MANIFEST ATTACHES TO (FR-91): in
 * the cell its cardinality says, at full fidelity, and — given a title — as
 * a named place, on the Graview face and the pages face alike. Whatever the
 * registry drew there before (the framework's own face of the kind) is what
 * is drawn if the view fails — and, for a view of one record, what is drawn
 * under it (FR-149): the record's own fields, editable, unless the manifest
 * says `replaces: "page"`.
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
    const declared = views.homeView?.() as ViewComponent<AnySchema> | undefined;
    views.home(workerView(definition, declared ? { fallback: declared } : {}) as unknown as ViewComponent<S>);
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
  const view = workerView(definition, { ...(before ? { fallback: before } : {}), ...(one && manifest.replaces !== "page" && before ? { beside: before } : {}) });
  views.register(manifest.attach as KindOfSchema<S>, cell, (one && manifest.replaces === "page" ? markReplacesPage(view) : view) as unknown as ViewComponent<S>, manifest.title ? { title: manifest.title, name: manifest.name, lens: "view", ...(manifest.reads?.kinds?.length ? { reads: manifest.reads.kinds } : {}) } : undefined);
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
    if ((failed || then === null) && Fallback) return <Fallback context={context} />;
    if (then === null) return null;
    return (
      <WorkerViewMount
        definition={then}
        store={context.store}
        principal={context.principal ?? graview?.principal ?? { kind: "human" }}
        goTo={goTo}
        {...(graview ? { places: () => graview.views.places(), scheme: graview.scheme, brand: graview.brand } : {})}
        drawsItsOwn={Fallback !== undefined}
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
