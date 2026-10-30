import { layer, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraph, useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { KEY_PANE_WIDTH, RelationKey } from "./relation-key.js";
// The Key is drawn with the scene, whose face has fetched `@graview/react` already.
import { ribbonWidth } from "@graview/react";

/* What the map's marks mean, fetched when the Key is first opened over the map (`map-key.tsx`). */
const MapKey = lazyModule(retryingImport(() => import("./map-key.js"))).part((key) => <key.MapKey />, { quiet: true });

/**
 * THE KEY TO THE LINES, BESIDE UP.
 *
 * "What the lines mean" lived at the foot of the seat's rail, a fold of the
 * panel about the selected thing. It is about the picture, so it is the
 * picture's furniture now, under the altitude control: one quiet "Key"
 * that opens the legend — each relation's stroke, its words, and a press
 * that shows what it joins. Escape, or a press elsewhere, puts it away.
 */
export function LinesKey<S extends AnySchema>() {
  const { store } = useGraview<S>();
  const { view } = useNavigation();
  const nodes = useGraph<S>();
  const any = useMemo(() => store.graph.allEdges().length > 0, [store, nodes]);
  const [open, setOpen] = useState(false);
  const paneId = useId();
  const button = useRef<HTMLButtonElement | null>(null);
  const pane = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const at = event.target as Node | null;
      if (at && (pane.current?.contains(at) || button.current?.contains(at))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);
  /*
   * ON A PHONE, IN UP'S ROW. Under Up, the Key stood over the right edge of
   * a district gone into (Nick, on a phone: "Up" and "Key" overlapping the
   * card). Where the scene is narrow they share one row of their own above
   * the card — the Key to Up's left, by Up's measured width — and the
   * card takes the width below (`scene-options.ts`). From altitude it stays
   * under Up, in the corner the city keeps clear.
   */
  const [upRoom, setUpRoom] = useState<number | null>(null);
  useEffect(() => {
    const up = button.current?.parentElement?.parentElement?.querySelector<HTMLElement>('[data-testid="overview"]');
    if (!up || typeof ResizeObserver === "undefined") return;
    const read = () => setUpRoom(Math.ceil(up.getBoundingClientRect().width));
    read();
    const watch = new ResizeObserver(read);
    watch.observe(up);
    return () => watch.disconnect();
  }, [any]);
  if (!any) return null;
  return (
    <div
      style={{ display: "contents" }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        // The key's Escape is the key's: the scene's back-out does not hear it too.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus({ preventScroll: true });
      }}
    >
      <button
        ref={button}
        type="button"
        data-testid="lines-key"
        className="graview-lines-key"
        // On the ground, a phone's Key stands in Up's row; from altitude, under it, in the corner the city keeps clear.
        data-graview-up-row={view.overview ? undefined : ""}
        aria-expanded={open}
        aria-controls={paneId}
        title="What the lines mean"
        onClick={() => setOpen((was) => !was)}
        style={{
          position: "absolute",
          top: 60,
          right: "calc(14px + var(--graview-dock, 0px))",
          zIndex: layer("overview"),
          height: 30,
          padding: "0 11px",
          borderRadius: 8,
          borderColor: "transparent",
          fontSize: "0.8125rem",
          color: open ? "var(--graview-accent)" : "var(--graview-ink-muted)",
          background: "var(--graview-float)",
          boxShadow: "var(--graview-lift-low)",
          ...(upRoom !== null ? { ["--graview-up-room" as string]: `${upRoom}px` } : {}),
        }}
      >
        Key
      </button>
      {open ? (
        <div
          ref={pane}
          id={paneId}
          data-testid="lines-key-pane"
          className="graview-lines-key-pane"
          data-graview-up-row={view.overview ? undefined : ""}
          data-graview-offstage=""
          style={{
            position: "absolute",
            top: 98,
            right: "calc(14px + var(--graview-dock, 0px))",
            zIndex: layer("rail"),
            width: KEY_PANE_WIDTH,
            maxHeight: "calc(100cqh - 120px)",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "8px 8px",
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {view.overview ? <MapKey /> : null}
          <RelationKey<S> inside widthOf={ribbonWidth} />
        </div>
      ) : null}
    </div>
  );
}

