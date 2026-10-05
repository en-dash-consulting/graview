import type { AnySchema, KindOfSchema, Principal, Store } from "@graview/core";
import { useGoTo, useGraviewIfAny, type GoTo, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { GuestPlace } from "../protocol.js";
import type { WorkerViewManifest } from "./manifest.js";
import type { GuestViewInput } from "./session.js";
import type { WorkerView, WorkerViewFailure, WorkerViewLimits } from "./view.js";
import type { GuestWorkerSource } from "./worker-start.js";

/** A worker view as an app registers it: its manifest, its code, and how far it may go. */
export interface WorkerViewDefinition {
  readonly manifest: WorkerViewManifest;
  readonly worker: GuestWorkerSource;
  readonly limits?: WorkerViewLimits;
  /** Who made it, said under it ("Made by Claude for Nick"). */
  readonly author?: string;
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
  readonly onFailure: (reason: WorkerViewFailure, detail?: string) => void;
  /** Changes when what the view is drawn over does. */
  readonly tick?: unknown;
}

/** The region a worker view is drawn in, mounted when it is drawn; the host's half is fetched then. */
function WorkerViewMount({ definition, store, principal, input, goTo, places, scheme, onFailure, tick }: MountProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mounted = useRef<WorkerView | null>(null);
  const latest = useRef({ input, goTo, places, onFailure });
  latest.current = { input, goTo, places, onFailure };
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    let gone = false;
    void import("./worker.js").then(({ mountWorkerView }) => {
      if (gone) return;
      mounted.current = mountWorkerView(element, {
        manifest: definition.manifest,
        worker: definition.worker,
        store,
        principal,
        input: () => latest.current.input?.() ?? {},
        /* Links stay in the app (FR-93): a record or a place, on whichever face the view is drawn. */
        onNavigate: (to) => ("record" in to ? latest.current.goTo?.record(to.record) : latest.current.goTo?.place(to.place)),
        places: () => latest.current.places?.() ?? [],
        onFailure: (reason, detail) => latest.current.onFailure(reason, detail),
        ...(definition.limits ? { limits: definition.limits } : {}),
        ...(definition.author ? { author: definition.author } : {}),
      });
    });
    return () => {
      gone = true;
      mounted.current?.dispose();
      mounted.current = null;
    };
  }, [definition, store, principal]);
  useEffect(() => mounted.current?.update(), [scheme, tick]);
  return <div ref={holder} data-worker-view-place={definition.manifest.name} />;
}

/**
 * A WORKER VIEW AS A VIEW OF A KIND (FR-91): what `registerWorkerView`
 * registers. It is drawn where the kind's picture is, on both faces, with
 * the viewer's sight cut to its manifest; should it fail — a refused
 * worker, a manifest that names what the app does not declare, a view past
 * its limits — `fallback` is drawn in its place.
 */
export function workerView(definition: WorkerViewDefinition, options: { readonly fallback?: ViewComponent<AnySchema> } = {}): ViewComponent<AnySchema> {
  const Fallback = options.fallback;
  function WorkerViewOfKind(props: ViewProps<AnySchema>) {
    const graview = useGraviewIfAny<AnySchema>();
    const goTo = useGoTo();
    const [failed, setFailed] = useState<WorkerViewFailure | null>(null);
    const latest = useRef(props);
    latest.current = props;
    if (!graview) return null;
    if (failed) return Fallback ? <Fallback {...props} /> : <p data-worker-view-failed={failed}>{definition.manifest.title ?? definition.manifest.name} could not be shown.</p>;
    return (
      <WorkerViewMount
        definition={definition}
        store={graview.store}
        principal={graview.principal}
        input={() => inputOf(latest.current)}
        goTo={goTo}
        places={() => graview.views.places()}
        scheme={graview.scheme}
        tick={props}
        onFailure={(reason) => setFailed(reason)}
      />
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
 * is drawn if the view fails.
 */
export function registerWorkerView<S extends AnySchema>(views: ReactViewRegistry<S>, definition: WorkerViewDefinition): ReactViewRegistry<S> {
  const { manifest } = definition;
  if (manifest.attach === "home") throw new Error(`The worker view "${manifest.name}" is the home's body: draw it with workerHome, on the home.`);
  const cell = { cardinality: manifest.cardinality, fidelity: "full" } as const;
  const before = (views.lookup(manifest.attach, cell) ?? views.resolve(manifest.attach, cell)?.view) as ViewComponent<AnySchema> | undefined;
  views.register(manifest.attach as KindOfSchema<S>, cell, workerView(definition, before ? { fallback: before } : {}) as unknown as ViewComponent<S>, manifest.title ? { title: manifest.title } : undefined);
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
    if (failed) return Fallback ? <Fallback context={context} /> : <p data-worker-view-failed={failed}>{definition.manifest.title ?? definition.manifest.name} could not be shown.</p>;
    return (
      <WorkerViewMount
        definition={definition}
        store={context.store}
        principal={context.principal ?? graview?.principal ?? { kind: "human" }}
        goTo={goTo}
        {...(graview ? { places: () => graview.views.places(), scheme: graview.scheme } : {})}
        onFailure={(reason) => setFailed(reason)}
      />
    );
  }
  WorkerHome.displayName = `WorkerHome(${definition.manifest.name})`;
  return WorkerHome;
}
