import { labelOf, type AnySchema, type Store } from "@graview/core";
import { layout, type LayoutNode, type ViewState } from "@graview/layout";
import { useEffect, type CSSProperties, type ReactNode } from "react";
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
  const { store, view, setSelection } = useGraview<S>();
  const { jackedIn, exit } = useJackIn();

  /*
   * Jacking in SELECTS what you jacked into.
   *
   * Otherwise the page is read-only by accident: the actions are derived
   * from the selection, and lifting a view out of the scene without
   * selecting it left a full page with nothing you could do to it. Reading
   * something closely is when you are most likely to want to change it.
   */
  useEffect(() => {
    if (jackedIn) setSelection([jackedIn]);
  }, [jackedIn, setSelection]);

  if (!jackedIn) return null;

  const node = findNode(store, view, jackedIn);
  if (!node) return null;

  const definition = store.schema.tryDefinition(node.kind);
  const name = node.aggregate
    ? node.aggregate.label
    : labelOf(definition, store.graph.getNode(node.id) as never);

  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} in full view`}
      style={{
        position: "fixed",
        inset: 0,
        /*
         * Above the scene, which carries `z-index: 1` on its stage.
         *
         * A fixed element at `auto` loses to it, so jacking in rendered the
         * page UNDERNEATH the scene it was lifted out of — visible around the
         * edges, unreadable, and unclickable. It went unnoticed until a
         * second app made jack-in a primary control rather than a curiosity.
         */
        zIndex: 50,
        background: "var(--graview-ground)",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/*
        * A REAL header, not a button floating in an empty bar.
        *
        * It used to be one control and eleven hundred pixels of nothing, which
        * is a page that has not told you where you are — and "where you are"
        * is the only question a full page raises that the scene did not
        * already answer. The name and the kind belong here; everything below
        * is about the thing rather than about being here.
        */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 22px",
          height: 56,
          flex: "0 0 auto",
          position: "sticky",
          top: 0,
          zIndex: 1,
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
          backdropFilter: "blur(14px)",
        }}
      >
        <button type="button" onClick={exit} autoFocus style={{ flex: "0 0 auto" }}>
          ← Back
        </button>
        {/*
          * The KIND, not the name.
          *
          * The document below owns its own title, and chrome that repeats the
          * heading three inches above it reads as a mistake even when both are
          * correct — a browser does not print the h1 in the toolbar. What the
          * bar is for is what KIND of thing you are looking at, which the
          * document does not say and which is the orientation a full page
          * actually costs you.
          */}
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--graview-ink-faint)",
            whiteSpace: "nowrap",
          }}
        >
          {node.aggregate ? node.aggregate.label : node.kind}
        </span>
        {children}
      </header>

      {/*
        * A DOCUMENT: a centred column, capped, with room under it.
        *
        * A short record used to be pinned to the top-left of a full viewport
        * with eight hundred pixels of nothing below it, and full-bleed width
        * for two lines of text. Neither is a rendering that failed — both are
        * a rendering that was never given a page to sit on. The cap is
        * generous enough for a matrix and narrow enough that prose does not
        * run to 1500 pixels a line.
        *
        * The bottom padding is for the actions strip, which is fixed over
        * everything: without it the last line of a long record sits underneath
        * the controls that act on it.
        */}
      <main
        style={{
          flex: "1 1 auto",
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "34px 22px 128px",
          boxSizing: "border-box",
        }}
      >
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
