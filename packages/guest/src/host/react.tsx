import type { AnySchema } from "@graview/core";
import { useGoTo, useGraview, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useEffect, useRef } from "react";
import { mountGuestView, type GuestFrame } from "./frame.js";
import type { GuestLimits, GuestReads, GuestViewInput } from "./session.js";
import type { KitLinks } from "./kit.js";
import type { GuestWorkerSource } from "./worker.js";

export interface GuestViewOptions {
  /** Where the guest's code is served, for a guest in a frame. */
  readonly url?: string;
  /**
   * The guest's code, for a guest in a worker (FR-68): a `blob:` URL or the
   * script's text. Drawn from the component kit in the host's own page; the
   * worker's half of the host is fetched only when a worker view is drawn.
   */
  readonly worker?: GuestWorkerSource;
  /** The view's name: what the rail says an act came through. */
  readonly name: string;
  /**
   * What it is called (FR-87): the frame's accessible name, and — handed to
   * `register(kind, cell, view, { title })` as well — the place it is on both
   * faces. The view's name by default.
   */
  readonly title?: string;
  /**
   * The other kinds and the edges a frame guest is shown, beyond what it is
   * drawn over (FR-85), as the viewer sees them. A guest drawn as the home
   * (`views.home(guestView(…))`) is drawn over nothing, and sees what it reads.
   */
  readonly reads?: GuestReads;
  /** Where the frame first stands before the guest asks for a height. 160px by default. */
  readonly height?: number;
  readonly limits?: GuestLimits;
  /** Where a worker guest's links may go (`mountGuestWorker`'s `links`). Any `https:` address by default. */
  readonly links?: KitLinks;
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

/**
 * A VIEW SOMEBODY ELSE WROTE, registered like any other:
 *
 *   views.register("recipe", { fidelity: "full", cardinality: "one" },
 *     guestView({ url: "https://recipes.example/card.html", name: "recipe-card" }));
 *
 * It draws an iframe sandboxed to scripts alone — or, given `worker`
 * rather than `url`, a classic worker drawing the component kit — pushes
 * the view's props as the seat at the keyboard sees them, applies what the
 * guest asks for as that seat, and goes to a record or a place where the
 * face goes (`useGoTo`): its page on the routed face, chosen in the scene.
 */
export function guestView(options: GuestViewOptions): ViewComponent<AnySchema> {
  if ((options.url === undefined) === (options.worker === undefined)) throw new Error(`guestView "${options.name}" takes a url or a worker, one of the two`);
  function GuestView(props: ViewProps<AnySchema>) {
    const { store, principal, setSelection, views } = useGraview<AnySchema>();
    const goTo = useGoTo();
    const going = useRef(goTo);
    going.current = goTo;
    const holder = useRef<HTMLDivElement>(null);
    const frame = useRef<Pick<GuestFrame, "update" | "dispose"> | null>(null);
    const latest = useRef(props);
    latest.current = props;
    useEffect(() => {
      const element = holder.current;
      if (!element) return;
      const worker = options.worker;
      if (worker) {
        let gone = false;
        let drawn: { update(): void; dispose(): void } | undefined;
        void import("./worker.js").then(({ mountGuestWorker }) => {
          if (gone) return;
          drawn = mountGuestWorker(element, {
            worker,
            view: options.name,
            store,
            principal,
            input: () => inputOf(latest.current),
            onNavigate: (id) => setSelection([id]),
            ...(options.limits ? { limits: options.limits } : {}),
            ...(options.links ? { links: options.links } : {}),
          });
          frame.current = drawn;
        });
        return () => {
          gone = true;
          drawn?.dispose();
          frame.current = null;
        };
      }
      const mounted = mountGuestView(element, {
        url: options.url!,
        view: options.name,
        ...(options.title ? { title: options.title } : {}),
        store,
        principal,
        input: () => inputOf(latest.current),
        ...(options.reads ? { reads: options.reads } : {}),
        places: () => views.places(),
        onNavigate: (id) => going.current.record(id),
        onNavigatePlace: (as) => going.current.place(as),
        ...(options.limits ? { limits: options.limits } : {}),
      });
      mounted.iframe.style.height = `${options.height ?? 160}px`;
      frame.current = mounted;
      return () => {
        mounted.dispose();
        frame.current = null;
      };
    }, [store, principal, setSelection, views]);
    useEffect(() => frame.current?.update(), [props]);
    return <div ref={holder} data-guest={options.name} />;
  }
  GuestView.displayName = `GuestView(${options.name})`;
  return GuestView;
}
