import type { ViewProblemSaid } from "./problems.js";
import type { AnySchema } from "@graview/core";
import { PageOfItsOwn, useGoTo, useGraview, useHostAssets, useHostFiles, useHostReel, useKeptDrawings, type KeptDrawing, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { frameChunk, untilItArrives, workerChunk } from "./arrive.js";
import type { GuestFrame } from "./frame.js";
import type { GuestLimits, GuestReads, GuestViewInput } from "./session.js";
import type { KitLinks } from "./kit.js";
import type { GuestPictures } from "./pictures.js";
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
  /** The pictures on the records a frame guest is handed, as `data:` images the host made (FR-175, `MountGuestViewOptions.pictures`). */
  readonly pictures?: GuestPictures;
  /** Where a record's file is fetched for those pictures, under the app's base (`MountGuestViewOptions.file`). The page's host's files say where by default (`HostFiles.src`). */
  readonly file?: (href: string) => string | undefined;
  /** Where a file the app holds is read from for the faces its brand lends its views, handed to a frame guest as `data:` fonts (`MountGuestViewOptions.asset`). Where the page's host serves the app's images by default (`HostAssets`). */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a face lent to a frame guest may be read from by address (`MountGuestViewOptions.fonts`). None by default. */
  readonly fonts?: { readonly origins: readonly string[] };
  /**
   * Whether a frame guest drawn as a page of its own is kept as its page is
   * left, to stand at once when it is gone back to (Graview HQ
   * f-custom-pages-do-not-flash): its document runs on out of sight, for five
   * minutes at most, so a guest that plays sound or works on a clock goes on
   * doing it. Where the browser can move a frame without loading it again
   * (`Element.moveBefore`); elsewhere it is drawn anew. `false` by default.
   */
  readonly keeps?: boolean;
  /** Where the frame first stands before the guest asks for a height. 160px by default. */
  readonly height?: number;
  /**
   * Each height a frame guest is given, once the frame has taken it
   * (Roadmap f-guest-growth-guard): what a host that sizes what holds the
   * view reads. Not told a height the growth guard held.
   */
  readonly onSize?: (height: number) => void;
  /**
   * What the host could not do for a frame guest, in a sentence: a face it
   * did not lend, and the guest's height held because it grew only with its
   * own frame. Said in the console as well, whether or not this is given.
   * Beside the sentence, what it is: a code from `VIEW_PROBLEM_CODES` that
   * stays when the words change.
   */
  readonly onProblem?: ViewProblemSaid;
  readonly limits?: GuestLimits;
  /** Where a worker guest's links may go (`mountGuestWorker`'s `links`). Any `https:` address by default. */
  readonly links?: KitLinks;
  /**
   * Whether its place flows with the page (Graview HQ
   * f-frame-view-autosize-short-on-desk): a guest is as tall as it asks to
   * be, so its place draws it in the page's column as long as it is, as a
   * worker view's does. `false` keeps the place's frame, most of the window
   * tall and scrolling inside itself, for a fixed canvas. `true` by default.
   */
  readonly flows?: boolean;
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

/** A frame off its page, kept to be gone back to (Graview HQ f-custom-pages-do-not-flash). */
interface KeptFrame extends KeptDrawing {
  readonly frame: GuestFrame;
  readonly box: { latest: { current: ViewProps<AnySchema> }; going: { current: ReturnType<typeof useGoTo> }; branded: { current: ReturnType<typeof useGraview<AnySchema>>["brand"] }; reeled: { current: ReturnType<typeof useHostReel> }; gone: () => void };
}

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
    const { store, principal, setSelection, views, brand } = useGraview<AnySchema>();
    const filesNow = useHostFiles();
    const hostFiles = useRef(filesNow);
    hostFiles.current = filesNow;
    const assetsNow = useHostAssets();
    const hostAssets = useRef(assetsNow);
    hostAssets.current = assetsNow;
    const branded = useRef(brand);
    branded.current = brand;
    /* The app's own video (HQ f-reel-mount-tests-and-frames): a frame is handed its facts, never its address. */
    const reelNow = useHostReel();
    const reeled = useRef(reelNow);
    reeled.current = reelNow;
    /* The seat's choice moves as a page arrives: read when asked, never a reason to draw the guest anew. */
    const choose = useRef(setSelection);
    choose.current = setSelection;
    const goTo = useGoTo();
    const going = useRef(goTo);
    going.current = goTo;
    const holder = useRef<HTMLDivElement>(null);
    const frame = useRef<Pick<GuestFrame, "update" | "dispose"> | null>(null);
    const latest = useRef(props);
    latest.current = props;
    /* A page left and gone back to stands as it did, where the host said it may (`keeps`) and the browser can move a frame without loading it again: kept as a worker view is (worker-react.tsx). */
    const keeping = useKeptDrawings();
    const page = useContext(PageOfItsOwn);
    const held = useRef<KeptFrame | undefined>(undefined);
    const now = useRef<{ readonly keep: typeof keeping; readonly as: string; readonly of: readonly unknown[] }>(undefined);
    now.current = { keep: options.keeps && options.url && page !== null && props.mode === "fullscreen" && props.fidelity === "full" ? keeping : null, as: `${page} frame ${options.name} ${props.node?.id ?? ""}`, of: [options, store, principal, views] };
    const stood = useRef(false);
    const [anew, setAnew] = useState(0);
    useLayoutEffect(() => {
      const element = holder.current;
      const { keep, as, of } = now.current!;
      const back = held.current ? undefined : keep?.take<KeptFrame>(as, of);
      if (element && back) {
        Object.assign(back.box, { latest, going, branded, reeled });
        if (back.frame.wake(element)) {
          held.current = back;
          frame.current = back.frame;
        } else back.dispose();
      }
      if (stood.current && !held.current) setAnew((was) => was + 1);
      return () => {
        const one = held.current;
        const { keep, as } = now.current!;
        if (!one || !keep) return;
        one.box.gone = () => keep.forget(one);
        if (!one.frame.rest(() => one.box.gone())) return;
        held.current = undefined;
        frame.current = null;
        keep.keep(as, one);
      };
    }, []);
    useEffect(() => {
      const element = holder.current;
      if (!element) return;
      const dispose = () => {
        held.current?.dispose();
        held.current = undefined;
        frame.current = null;
        stood.current = false;
      };
      /* Taken back as the page came. */
      if (held.current) {
        stood.current = true;
        return dispose;
      }
      const worker = options.worker;
      if (worker) {
        let drawn: { update(): void; dispose(): void } | undefined;
        const stop = untilItArrives(workerChunk, ({ mountGuestWorker }) => {
          drawn = mountGuestWorker(element, {
            worker,
            view: options.name,
            store,
            principal,
            input: () => inputOf(latest.current),
            onNavigate: (id) => choose.current([id]),
            ...(options.limits ? { limits: options.limits } : {}),
            ...(options.links ? { links: options.links } : {}),
          });
          frame.current = drawn;
        });
        return () => {
          stop();
          drawn?.dispose();
          frame.current = null;
        };
      }
      /*
       * The frame's host is fetched as the view is first drawn (FR-179); the
       * holder keeps the frame's first height meanwhile, so nothing moves
       * when it arrives.
       */
      const { of } = now.current!;
      const box: KeptFrame["box"] = { latest, going, branded, reeled, gone: () => undefined };
      element.style.minHeight = `${options.height ?? 160}px`;
      /* Where a record's file is fetched: the view's word, else where the page's host serves its files (0.1.36). */
      const file = options.file ?? (hostFiles.current?.src ? (href: string) => hostFiles.current?.src?.(href) ?? href : undefined);
      let mounted: GuestFrame | undefined;
      const stop = untilItArrives(frameChunk, ({ mountGuestView }) => {
        element.style.minHeight = "";
        mounted = mountGuestView(element, {
          url: options.url!,
          view: options.name,
          ...(options.title ? { title: options.title } : {}),
          store,
          principal,
          input: () => inputOf(box.latest.current),
          ...(options.reads ? { reads: options.reads } : {}),
          ...(options.pictures ? { pictures: options.pictures } : {}),
          ...(file ? { file } : {}),
          /* The faces the app lends its views, read where the app's own files are served: the view's word, else the page's host's (Roadmap f-faces-lent-to-frames). */
          ...(options.asset ? { asset: options.asset } : hostAssets.current ? { asset: (path: string) => hostAssets.current?.(path) ?? path } : {}),
          ...(options.fonts ? { fonts: options.fonts } : {}),
          onProblem: (said, problem) => {
            console.warn(`${options.name}: ${said}`);
            options.onProblem?.(said, problem);
          },
          /* The frame takes each height, and the host is told it. */
          ...(options.onSize
            ? {
                onSize: (height: number) => {
                  if (mounted) mounted.iframe.style.height = `${height}px`;
                  options.onSize?.(height);
                },
              }
            : {}),
          places: () => views.places(),
          brand: () => box.branded.current,
          reel: () => box.reeled.current,
          /* A record, a place or a kind's list — narrowed and to a section — where the face goes; what goes nowhere is said in the console and to `onProblem`, as `link-goes-nowhere`. */
          goTo: () => box.going.current,
          ...(options.limits ? { limits: options.limits } : {}),
        });
        mounted.iframe.style.height = `${options.height ?? 160}px`;
        const drawn = mounted;
        held.current = { of, frame: drawn, box, dispose: () => drawn.dispose() };
        frame.current = drawn;
        stood.current = true;
      });
      return () => {
        stop();
        dispose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, principal, views, anew]);
    /* The reel by what it says, so a host that hands a new object each render with the same facts pushes nothing more. */
    const reelSaid = reelNow ? JSON.stringify(reelNow) : "";
    useEffect(() => frame.current?.update(), [props, brand, reelSaid]);
    // A frame's holder is busy until the frame's host has drawn the frame in it, and the frame is until the guest has drawn (FR-188).
    return <div ref={holder} data-guest={options.name} aria-busy={options.url ? true : undefined} />;
  }
  GuestView.displayName = `GuestView(${options.name})`;
  /*
   * ITS PLACE FLOWS WITH THE PAGE (Graview HQ f-frame-view-autosize-short-on-desk).
   * The frame takes the height its guest asks for; held in the place's frame
   * (most of the window tall, at most 760px) a guest taller than that was cut
   * at the frame's foot on a desk and scrolled inside it, though it had asked
   * for all of its height and been given it.
   */
  (GuestView as { flows?: boolean }).flows = options.flows !== false;
  return GuestView;
}
