import { Store, type AnySchema, type Brand, type GraviewApp, type Principal } from "@graview/core";
import { EMPTY_VIEW, fromUrl, withFocus, withOverview, type ViewState } from "@graview/layout";
import { PagesApp, type PageComponent, type PageRegistry } from "@graview/pages";
import {
  descentTarget,
  Inspector,
  OverviewButton,
  QuickRelations,
  registerDefaultViews,
  RelationKey,
  Standing,
  themeCss,
} from "@graview/primitives";
import { createViews, GraviewProvider, Scene, useGraview, useNavigation, type Scheme, type ViewComponent } from "@graview/react";
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
export type EmbedFace = "scene" | "graview" | "pages";

export interface EmbedOptions<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The graph to open with. Nothing means the empty city. */
  readonly seed?: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  /** Which face to show. */
  readonly face?: EmbedFace;
  /** The scene's view state, as the fragment the app itself would put in its address bar. */
  readonly stop?: string;
  /** For the pages face: the path to open, within the app's own routes. */
  readonly path?: string;
  readonly principal?: Principal;
  readonly scheme?: Scheme;
  /** Defaults to the app's own brand. */
  readonly brand?: Brand;
  /** A store to share; otherwise one is made from the app and the seed. */
  readonly store?: Store<S>;
  /** Views beyond the derived defaults. */
  readonly views?: (schema: S) => ReturnType<typeof registerDefaultViews>;
  /** The pages face's own pages, over the derived defaults. */
  readonly pages?: PageRegistry<S, PageComponent<S>>;
  /** The face switcher and Standing, above the picture. Default on. */
  readonly toggle?: boolean;
  /** Fetch the brand's fonts. Default on; off when the host already has them. */
  readonly fonts?: boolean;
  /** The embed's height; the element's own by default. */
  readonly height?: number | string;
  /** What Standing says when nothing is wrong. */
  readonly standing?: string;
}

export interface EmbedProps<S extends AnySchema = AnySchema> extends EmbedOptions<S> {
  /** Called when the strip's switcher is pressed; the host decides the face. */
  readonly onFace?: (face: EmbedFace) => void;
}

let sequence = 0;

/** A store from a declaration and a seed: the app's own policy, in memory. */
function storeOf<S extends AnySchema>(app: GraviewApp<S>, seed: EmbedOptions<S>["seed"], principal: Principal | undefined): Store<S> {
  return new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(seed ? { snapshot: seed as never } : {}),
    ...(app.policy ? { policy: app.policy } : {}),
    ...(principal ? { principal } : {}),
  } as never);
}

/** The scene's view for a face and a stop. */
function viewFor(face: EmbedFace, stop: string | undefined, kinds: readonly string[]): ViewState {
  const asked = stop ? fromUrl(stop) : EMPTY_VIEW;
  if (face === "graview") return withOverview(asked, true);
  if (asked.overview) return withFocus(withOverview(asked, false), descentTarget(asked, kinds));
  return asked;
}

export function Embed<S extends AnySchema>(props: EmbedProps<S>) {
  const {
    app,
    seed,
    face = "scene",
    stop,
    path = "/",
    principal,
    scheme = "light",
    brand = app.brand,
    toggle = true,
    fonts = true,
    height = "100%",
    standing = "Everything is in order",
    pages,
  } = props;
  const scope = useMemo(() => `graview-embed-${++sequence}`, []);
  const store = useMemo(() => props.store ?? storeOf(app, seed, principal), [props.store, app, seed, principal]);
  const views = useMemo(
    () => (props.views ? props.views(app.schema) : registerDefaultViews(app.schema, createViews(app.schema))) as never,
    [props.views, app.schema],
  );
  const kinds = app.schema.kinds as readonly string[];
  const initialView = useMemo(() => viewFor(face, stop, kinds), []); // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <div
      className={scope}
      data-graview-embed={face}
      style={{ position: "relative", height, minHeight: 320, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--graview-radius, 12px)" }}
    >
      <style>{css}</style>
      <GraviewProvider
        store={store}
        views={views}
        initialView={initialView}
        scheme={scheme}
        {...(brand ? { brand } : {})}
        {...(principal ? { principal } : {})}
      >
        <Faces face={face} stop={stop} kinds={kinds} />
        {toggle ? <Strip face={face} onFace={props.onFace} standing={standing} /> : null}
        {face === "pages" ? (
          <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
            <PagesApp<S>
              context={{ store, ...(brand ? { brand } : {}), ...(principal ? { principal } : {}) }}
              {...(pages ? { registry: pages } : {})}
              initialPath={path}
            />
          </div>
        ) : (
          <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, containerType: "size" }}>
            <Scene renderer="dom" />
            <RelationKey<S> />
            <QuickRelations<S> />
            <OverviewButton />
            <Inspector />
          </div>
        )}
      </GraviewProvider>
    </div>
  );
}

/** Keeps the scene's view in step with the face and stop props. */
function Faces({ face, stop, kinds }: { face: EmbedFace; stop: string | undefined; kinds: readonly string[] }) {
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
    // The pages face has no view; a stop set while there lands when the
    // scene comes back. Otherwise a face change keeps where you were and
    // only rises or descends.
    if (face === "pages") return;
    const next =
      (stopChanged || wasPages) && stop !== undefined
        ? viewFor(face, stop, kinds)
        : face === "graview"
          ? withOverview(view, true)
          : view.overview
            ? withFocus(withOverview(view, false), descentTarget(view, kinds))
            : view;
    go(next);
  }, [face, stop, kinds, view, go]);
  return null;
}

function Strip({ face, onFace, standing }: { face: EmbedFace; onFace?: ((face: EmbedFace) => void) | undefined; standing: string }) {
  const { brand } = useGraview();
  const faces: readonly { id: EmbedFace; label: string; title: string }[] = [
    { id: "scene", label: "Scene", title: "The picture, from the ground" },
    { id: "graview", label: "Graview", title: "The whole domain, from altitude" },
    { id: "pages", label: "Pages", title: "The same app as ordinary pages" },
  ];
  return (
    <div
      role="group"
      aria-label="Face"
      data-testid="embed-faces"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        flex: "0 0 auto",
        borderBottom: "1px solid var(--graview-edge)",
        background: "var(--graview-bar)",
        fontSize: 12.5,
      }}
    >
      <span style={{ fontFamily: "var(--graview-font-display)", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 11, marginRight: 6 }}>
        {brand?.name ?? "Graview"}
      </span>
      {faces.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          aria-pressed={face === candidate.id}
          data-testid={`embed-face-${candidate.id}`}
          title={candidate.title}
          onClick={() => onFace?.(candidate.id)}
          style={{
            padding: "3px 11px",
            borderRadius: 999,
            fontSize: 12.5,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: face === candidate.id ? "var(--graview-accent)" : "var(--graview-edge)",
            color: face === candidate.id ? "var(--graview-accent)" : "var(--graview-ink-muted)",
            background: face === candidate.id ? "var(--graview-panel)" : "transparent",
          }}
        >
          {candidate.label}
        </button>
      ))}
      <div style={{ marginLeft: "auto" }}>
        <Standing clean={standing} />
      </div>
    </div>
  );
}

export interface EmbedHandle {
  setFace(face: EmbedFace): void;
  setStop(stop: string): void;
  setScheme(scheme: Scheme): void;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

/**
 * Mounts an app into an element and hands back the controls. The first
 * render is synchronous, so what comes back is already on the page.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: EmbedOptions<S>): EmbedHandle {
  const store = options.store ?? storeOf(options.app, options.seed, options.principal);
  let setters: { face: (f: EmbedFace) => void; stop: (s: string) => void; scheme: (s: Scheme) => void } | null = null;
  function Host() {
    const [face, setFace] = useState<EmbedFace>(options.face ?? "scene");
    const [stop, setStop] = useState<string | undefined>(options.stop);
    const [scheme, setScheme] = useState<Scheme>(options.scheme ?? "light");
    setters = { face: setFace, stop: setStop, scheme: setScheme };
    return <Embed<S> {...options} store={store as never} face={face} {...(stop !== undefined ? { stop } : {})} scheme={scheme} onFace={setFace} />;
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setFace: (face) => flushSync(() => setters?.face(face)),
    setStop: (stop) => flushSync(() => setters?.stop(stop)),
    setScheme: (scheme) => flushSync(() => setters?.scheme(scheme)),
    unmount: () => root.unmount(),
  };
}
