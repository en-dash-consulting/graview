import { labelOf, type AnySchema } from "@graview/core";
import { aggregateId, kindCardId } from "@graview/layout";
import { Companion } from "@graview/primitives";
import { useGraviewIfAny } from "@graview/react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { kindOfSlug, recordPath } from "./registry.js";
import type { PageContext } from "./pages.js";

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
  if (!here) return null;
  return (
    <>
      <RouteSubject context={context} />
      <button
        type="button"
        data-testid="page-ask"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title="Talk to the seat about this page"
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 30,
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
            zIndex: 29,
            pointerEvents: "none",
          }}
        >
          <div style={{ position: "absolute", inset: "12px 12px 64px 12px", pointerEvents: "auto", display: "grid" }}>
            {/* A pick goes to the record's page: there is no scene here to move. */}
            <Companion<S>
              framed
              onPick={(id) => {
                const node = context.store.graph.getNode(id);
                if (node) navigate(recordPath(context.store.schema, node.kind as string, id));
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
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
