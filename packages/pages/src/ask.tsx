import { labelOf, layer, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { aggregateId, kindCardId } from "@graview/layout/view";
import { lazyModule, useGraviewIfAny } from "@graview/react/provider";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { askPlace } from "./ask-place.js";
import { useLocation, useNavigate } from "react-router-dom";
import { kindOfSlug, recordPath } from "./registry.js";
import type { PageContext } from "./pages.js";

/*
 * THE COMPANION, FETCHED WHEN "ASK" IS OPENED (FR-57). It is the scene's
 * own panel — the subject, its acts, the conversation, the models behind
 * it — and a page that is read and never asked does not carry it.
 */
type CompanionProps = { readonly framed?: boolean; readonly onPick?: (id: string) => void };
const Companion = lazyModule(retryingImport(() => import("./ask-companion.js"))).part(
  (companion, props: CompanionProps) => {
    const Panel = companion.Companion as ComponentType<CompanionProps>;
    return <Panel {...props} />;
  },
  { what: "The assistant" },
);

/**
 * THE ASSISTANT ON EVERY PAGE — the same panel, not a second one.
 *
 * The scene keeps the seat in a rail on the left: a subject, its acts, its
 * relations, the conversation. A routed face that grew its own chat box
 * would be two assistants with two habits over one graph, so this is the
 * companion, in a drawer beside the reading column (a sheet on a phone),
 * opened by one control in the shell.
 *
 * WHAT "THIS" MEANS HERE IS THE ROUTE. On a record it is that record; on a
 * kind's page, that kind; on a picture, the kind it is a picture of. The
 * provider's selection is set from the address, so the same question means
 * the same thing on both faces — and the companion's own subject rule (the
 * selection first) does the rest.
 */
export function PageAsk<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const here = useGraviewIfAny<S>();
  const button = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLDivElement | null>(null);
  useInsideItsEmbed(button, drawer, open, here !== undefined);
  if (!here) return null;
  return (
    <>
      <RouteSubject context={context} />
      <button
        ref={button}
        type="button"
        data-testid="page-ask"
        // At the foot: a notice placed there stands above it (FR-133).
        data-graview-foot=""
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title="Talk to the seat about this page"
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: layer("rail"),
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-float)",
          color: "var(--graview-ink)",
          font: "inherit",
          fontSize: "0.9375rem",
          boxShadow: "var(--graview-lift-low)",
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">◆</span>
        {open ? "Close" : "Ask"}
      </button>
      {open ? (
        <div
          ref={drawer}
          data-testid="page-ask-drawer"
          /*
           * The scene's companion positions itself inside the scene's box;
           * here that box is this drawer, pinned beside the reading column
           * on a desk and along the bottom on a phone.
           */
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            width: "min(320px, 100vw)",
            zIndex: layer("rail"),
            pointerEvents: "none",
          }}
        >
          <div style={{ position: "absolute", inset: "12px 12px 64px 12px", pointerEvents: "auto", display: "grid" }}>
            {/* A pick goes to the record's page: there is no scene here to move. */}
            <Suspense fallback={null}>
              <Companion
                framed
                onPick={(id) => {
                  const node = context.store.graph.getNode(id);
                  if (node) navigate(recordPath(context.store.schema, node.kind as string, id));
                }}
              />
            </Suspense>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * IN AN EMBED, THE ASK AND ITS DRAWER STAY IN THE EMBED'S BOX (see
 * `ask-place.ts`): placed from that box as it shows on the screen, again as
 * the host's page scrolls or the box changes size, and put away while too
 * little of it shows. A face that is the whole page keeps the window's foot.
 */
function useInsideItsEmbed(button: RefObject<HTMLButtonElement | null>, drawer: RefObject<HTMLDivElement | null>, open: boolean, drawn: boolean) {
  useLayoutEffect(() => {
    const ask = button.current;
    const box = ask?.parentElement?.closest<HTMLElement>("[data-embed-content]");
    if (!ask || !box) return;
    const place = () => {
      const size = ask.getBoundingClientRect();
      const at = askPlace(box.getBoundingClientRect(), { width: document.documentElement.clientWidth || innerWidth, height: innerHeight }, { width: size.width, height: size.height });
      const viewHeight = innerHeight;
      ask.style.left = `${at.button.left}px`;
      ask.style.bottom = `${at.button.bottom}px`;
      ask.style.visibility = at.shown ? "" : "hidden";
      /*
       * FIXED TO WHAT HOLDS IT, which is not always the window: a host that
       * animates its stage with a transform (graview.dev's hero) makes that
       * stage the box "fixed" is measured from, and the Ask stood on the
       * caption under it. Where it landed is read back and the difference
       * taken off.
       */
      const landed = ask.getBoundingClientRect();
      const dx = landed.left - at.button.left;
      const dy = landed.bottom - (viewHeight - at.button.bottom);
      if (landed.width > 0 && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        ask.style.left = `${Math.round(at.button.left - dx)}px`;
        ask.style.bottom = `${Math.round(at.button.bottom + dy)}px`;
      }
      const sheet = drawer.current;
      if (sheet) {
        sheet.style.left = `${at.drawer.left}px`;
        sheet.style.top = `${at.drawer.top}px`;
        sheet.style.bottom = "auto";
        sheet.style.height = `${at.drawer.height}px`;
        sheet.style.width = `${at.drawer.width}px`;
        sheet.style.visibility = at.shown ? "" : "hidden";
        const drawn = sheet.getBoundingClientRect();
        const sx = drawn.left - at.drawer.left;
        const sy = drawn.top - at.drawer.top;
        if (drawn.width > 0 && (Math.abs(sx) > 0.5 || Math.abs(sy) > 0.5)) {
          sheet.style.left = `${Math.round(at.drawer.left - sx)}px`;
          sheet.style.top = `${Math.round(at.drawer.top - sy)}px`;
        }
      }
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(box);
    return () => {
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [button, drawer, open, drawn]);
}

/** The page's own subject, put where every surface reads it: the selection. */
function RouteSubject<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const { store } = context;
  const here = useGraviewIfAny<S>();
  const { pathname } = useLocation();
  /*
   * HELD IN A REF, because the setter is not stable: it closes over the
   * current view, so a new one arrives on every render — and an effect
   * that depended on it set the selection, re-rendered the provider, got a
   * new setter and set the selection again, nine hundred times a second.
   * The address is the only thing that decides the subject.
   */
  const set = useRef(here?.setSelection);
  set.current = here?.setSelection;
  /*
   * THE ADDRESS, ONCE PER ADDRESS. `useParams()` hands back a fresh object
   * every render, so putting it in the dependencies made this run on every
   * render, set the selection, and render again — a loop that took the
   * whole page down with it the moment the drawer opened. The path is the
   * only thing that decides the subject, so the path is the dependency.
   */
  useEffect(() => {
    const setSelection = set.current;
    if (!setSelection) return;
    const [, slug, id] = pathname.split("/");
    const chosen = ((): readonly string[] => {
      if (slug === "places") {
        const place = context.views?.places().find((one) => one.as === decodeURIComponent(id ?? ""));
        return place ? [aggregateId(place.kind)] : [];
      }
      const kind = slug ? kindOfSlug(store.schema, slug) : undefined;
      if (kind && id) return [decodeURIComponent(id)];
      return kind ? [kindCardId(kind)] : [];
    })();
    setSelection((current) =>
      current.length === chosen.length && current.every((one, at) => one === chosen[at]) ? current : chosen,
    );
  }, [pathname]);
  void labelOf;
  return null;
}
