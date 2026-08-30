import type { AnySchema, Store } from "@graview/core";
import { layout, type LayoutNode, type ViewState } from "@graview/layout";
import type { CSSProperties, ReactNode } from "react";
import { useGraview } from "./context.js";
import { useJackIn } from "./hooks.js";
import { ResolvedView } from "./scene.js";

export interface JackedInProps {
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Rendered in the header, next to the exit control. */
  readonly children?: ReactNode;
}

/**
 * One view, lifted out of the scene and laid out as a conventional page.
 *
 * The same component renders here as in the scene — only `mode` differs, and
 * fidelity is forced to `full` because a full page has room for everything.
 * A view that reads correctly here and wrongly in the scene has broken the
 * two-mode contract, and that is the one thing view authors must not do.
 */
export function JackedIn<S extends AnySchema>({ className, style, children }: JackedInProps) {
  const { store, view } = useGraview<S>();
  const { jackedIn, exit } = useJackIn();
  if (!jackedIn) return null;

  const node = findNode(store, view, jackedIn);
  if (!node) return null;

  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={`${node.kind} in full view`}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--graview-ground, #f6f4f0)",
        overflow: "auto",
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <button type="button" onClick={exit} autoFocus>
          Back to the scene
        </button>
        {children}
      </header>
      <main style={{ padding: 20 }}>
        <ResolvedView node={node} mode="fullscreen" selected={false} fidelity="full" />
      </main>
    </div>
  );
}

/**
 * The laid-out node for an id. Going through layout rather than the graph
 * means an aggregate can be jacked into as readily as a single node — a
 * "People" page is as legitimate a destination as one person.
 */
function findNode<S extends AnySchema>(
  store: Store<S>,
  view: ViewState,
  id: string,
): LayoutNode | null {
  const found = layout(store.graph, store.schema, view).nodes.find(
    (node) => node.id === id,
  );
  if (found) return found;

  // Jacking into something the current view does not place is legitimate —
  // a search result, a link from a diff — so synthesise a box for it.
  const node = store.graph.getNode(id);
  if (!node) return null;
  return {
    id: node.id,
    kind: node.kind,
    plane: 0,
    x: 0,
    y: 0,
    width: 960,
    height: 640,
    pinned: false,
  };
}
