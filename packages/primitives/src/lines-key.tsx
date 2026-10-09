import { layer, type AnySchema } from "@graview/core";
import { useGraph, useGraview } from "@graview/react/provider";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { KEY_PANE_WIDTH, RelationKey } from "./relation-key.js";

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
        aria-expanded={open}
        aria-controls={paneId}
        title="What the lines mean"
        onClick={() => setOpen((was) => !was)}
        style={{
          position: "absolute",
          top: 60,
          right: 14,
          zIndex: layer("overview"),
          height: 30,
          padding: "0 11px",
          borderRadius: 8,
          borderColor: "transparent",
          fontSize: "0.8125rem",
          color: open ? "var(--graview-accent)" : "var(--graview-ink-muted)",
          background: "var(--graview-float)",
          boxShadow: "var(--graview-lift-low)",
        }}
      >
        Key
      </button>
      {open ? (
        <div
          ref={pane}
          id={paneId}
          data-testid="lines-key-pane"
          data-graview-offstage=""
          style={{
            position: "absolute",
            top: 98,
            right: 14,
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
          <RelationKey<S> inside />
        </div>
      ) : null}
    </div>
  );
}
