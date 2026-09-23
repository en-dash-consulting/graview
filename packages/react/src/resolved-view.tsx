import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import { aggregateId, isAggregateId, kindCardId, kindOfCard, withFocus } from "@graview/layout";
import { PLANE_STYLES } from "@graview/render";
import { memo, type ReactNode } from "react";
import { useFlagged, useImplicated, useNavigation } from "./hooks.js";
import { useGraph, useGraview, ViewModeProvider, type ViewMode } from "./context.js";
import { ViewBoundary } from "./view-boundary.js";
import type { ViewComponent, ViewProps } from "./view-registry.js";
import type { SceneNode } from "./scene-root.js";

export interface ResolvedViewProps {
  readonly node: SceneNode;
  readonly mode: ViewMode;
  readonly selected: boolean;
  /** Overrides the fidelity the plane would ask for. Jack-in uses this. */
  readonly fidelity?: Fidelity;
}

/**
 * THE DISTRICTS THE ROW COULD NOT HOLD, NAMED.
 *
 * A district is read rather than glanced at, so the row never squeezes a name
 * below a word: past what it can hold at a legible width it keeps the ones
 * that fit and hands the rest to this. Not a district — it has no members, no
 * figure and no count — a card that says what is missing and takes you there.
 *
 * Every name is a pick target, which is the same gesture the row offers: a
 * press goes to that district. No new vocabulary, and nothing behind a
 * control somebody has to discover.
 */
export function BeyondCard({ kinds }: { kinds: readonly string[] }) {
  const { store } = useGraview();
  const { view, go } = useNavigation();
  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;
  return (
    <div
      className="graview-beyond"
      data-graview-beyond={kinds.length}
    >
      <span className="graview-beyond-count">+{kinds.length}</span>
      <ul className="graview-beyond-list">
        {kinds.map((kind) => (
          <li key={kind}>
            <button
              type="button"
              data-graview-pick={kindCardId(kind)}
              title={`Go to ${plural(kind)}`}
              onClick={(event) => {
                event.stopPropagation();
                go(withFocus(view, aggregateId(kind)));
              }}
            >
              {plural(kind)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Picks the view for a cell of the matrix — cardinality by whether this is an
 * aggregate, fidelity by plane depth — and renders it.
 *
 * A kind with no registered view falls back to the primitive the app
 * supplied, which is why a new node kind renders sensibly before anyone
 * writes a view for it.
 */
/**
 * WHETHER TWO FRAMES ASK FOR THE SAME PICTURE.
 *
 * Every field of the node except where it is. A pan moves the whole world by
 * one offset and changes nothing else, so this is false exactly when the
 * view has something new to draw — which is what lets `SettledView` sit out
 * a drag.
 */
function samePicture(before: SceneNode, after: SceneNode): boolean {
  if (before === after) return true;
  const keys = Object.keys(before);
  if (keys.length !== Object.keys(after).length) return false;
  return keys.every(
    (key) =>
      key === "x" ||
      key === "y" ||
      Object.is((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]),
  );
}

/**
 * THE PICTURE DOES NOT REDRAW ITSELF BECAUSE THE WORLD MOVED.
 *
 * `panLayout` hands every node a new object per frame — it has moved, after
 * all — and React took that at face value and re-rendered every lens in the
 * scene on every pointer move of a drag. A profile of one drag across rota's
 * city put a fifth of the main thread inside the calendar, the coverage
 * matrix and the timeline redrawing themselves, none of which had anything
 * new to say: a lens is drawn in its host's own coordinates and does not
 * know where the host is.
 *
 * So a view redraws when its picture changes, not when its position does.
 */
export const SettledView = memo(ResolvedView, (before, after) =>
  before.mode === after.mode &&
  before.selected === after.selected &&
  before.fidelity === after.fidelity &&
  samePicture(before.node, after.node),
) as typeof ResolvedView;

export function ResolvedView<S extends AnySchema>({
  node,
  mode,
  selected,
  fidelity,
}: ResolvedViewProps) {
  const { store, views, view } = useGraview<S>();
  /* The graph's own version: a view redraws when the graph it is drawing changes. */
  const graph = useGraph<S>();
  const implicated = useImplicated();
  const flagged = useFlagged();
  const cardinality =
    node.aggregate || isAggregateId(node.id) || kindOfCard(node.id) !== null ? "many" : "one";
  const cell = {
    cardinality,
    fidelity: fidelity ?? PLANE_STYLES[clampPlane(node.plane)].fidelity,
  } as const;

  /*
   * WHICH PICTURE, when a group has more than one.
   *
   * The week and the month are two questions about the same pile of tasks,
   * and the stop says which one is being asked — `in.view=the-month`. A
   * node that is not the group the address names keeps its own view, so a
   * calendar chosen over the tasks does not try to draw a list.
   *
   * THE GROUP THE ADDRESS NAMES IS THE ONE IT FOCUSES, and that had to be
   * said rather than assumed. The slug was handed to every group in the
   * scene, so pressing "Who may do what" and then looking at something else
   * left `in.view=who-may-do-what` in the stop, where the PEOPLE district —
   * which is not what you are looking at — drew the policy lens instead of
   * itself: no name, no count, no figure, no way in, just the words "Who may
   * do what · 3 roles" floating where a district used to be. The same thing
   * turned the Shifts card into "The week · 10".
   *
   * A place is a picture OF a group. A district card is the group's own
   * mark in the city, and it stays that whatever picture the address names.
   */
  const asked = cardinality === "many" && node.id === view.focusId ? view.within?.["view"] : undefined;
  const registration = views.resolve(node.kind, cell, asked);
  const Component = registration?.view as ViewComponent<S> | undefined;
  // Whether this kind has a picture of its own to travel into.
  const own = views.resolve(node.kind, { cardinality: "many", fidelity: "full" })?.view as
    | (ViewComponent<S> & { generic?: boolean })
    | undefined;
  const hasOwnView = own !== undefined && own.generic !== true;

  const props: ViewProps<S> = {
    ...(node.aggregate
      ? {
          nodes: node.aggregate.memberIds
            .map((id) => store.graph.getNode(id))
            .filter((n): n is NodeOfSchema<S> => n !== undefined),
          // A titled registration names the picture; the plural is the fallback.
          label: registration?.title ?? node.aggregate.label,
        }
      : { node: store.graph.getNode(node.id) as never }),
    fidelity: cell.fidelity,
    cardinality: cell.cardinality,
    mode,
    selected,
    implicated,
    flagged,
    ...(node.raised ? { raised: true } : {}),
    ...(node.focused ? { focused: true } : {}),
    ...(node.opened ? { opened: true } : {}),
    ...(node.plot ? { plot: node.plot } : {}),
    ...(node.aggregate?.retired ? { retired: node.aggregate.retired } : {}),
    ...(node.rank ? { rank: node.rank } : {}),
    ...(node.nestedUnder ? { nestedUnder: node.nestedUnder } : {}),
    ...(hasOwnView ? { hasOwnView: true } : {}),
  };

  if (!Component) return <MissingView node={node} props={props} />;
  /*
   * DRAWN AGAIN ONLY WHEN WHAT IT DRAWS CHANGED.
   *
   * A host re-renders on every frame of a flight, a pan and a zoom — the
   * box it is given is changing, which is the point — and the view inside
   * it was re-rendered with it, sixty times a second, for a picture that
   * had not changed at all. On a heavy lens (a matrix with rotated heads,
   * a calendar of a hundred moments) that is the whole frame budget, and
   * it is what made choosing a picture feel slow.
   *
   * What it draws is the node or the members, the cell, and the handful of
   * flags a view reads; the SIZE is not a prop, it is the box around it.
   * A view that watches the store or the selection through a hook still
   * re-renders on its own, because context reaches past a bailout.
   */
  const signature = [
    node.id,
    registration?.title ?? "",
    cell.fidelity,
    cell.cardinality,
    mode,
    selected,
    node.raised ?? false,
    node.focused ?? false,
    node.opened ?? false,
    node.rank ?? "",
    node.nestedUnder ?? "",
    node.plot ? `${node.plot.col},${node.plot.row},${node.plot.side}` : "",
    node.aggregate?.memberIds.join(",") ?? "",
    node.aggregate?.retired ?? "",
    (implicated ?? []).join(","),
    (flagged ?? []).join(","),
    hasOwnView,
  ].join("|");
  /*
   * The boundary is keyed by what it is drawing, so changing the picture or
   * the node gives the view a fresh start rather than leaving a panel that
   * once threw stuck saying so forever.
   */
  return (
    <ViewModeProvider mode={mode}>
      <ViewBoundary
        key={`${node.id}|${registration?.title ?? ""}`}
        kind={props.label ?? node.kind}
        {...(registration?.title ? { view: registration.title } : {})}
      >
        {/* The graph goes in by identity, not by a string: a label edited in
            place changes no id and no count, and a picture that missed it
            would be the one thing a graph view must never be — out of date. */}
        <Drawn signature={signature} graph={graph} draw={() => <Component {...props} />} />
      </ViewBoundary>
    </ViewModeProvider>
  );
}

/**
 * One view, redrawn when its signature changes and not otherwise. The
 * element is built inside a memo, so a parent re-render with the same
 * signature hands React the same element and it skips the subtree.
 */
export const Drawn = memo(
  function Drawn({ draw }: { readonly signature: string; readonly graph: unknown; readonly draw: () => ReactNode }) {
    return <>{draw()}</>;
  },
  (was, now) => was.signature === now.signature && was.graph === now.graph,
);

function clampPlane(plane: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, Math.round(plane))) as 0 | 1 | 2;
}

/**
 * What a kind with no view looks like. Deliberately readable rather than
 * apologetic: an undecorated node is a legitimate state during development,
 * and it should still say what it is.
 */
function MissingView<S extends AnySchema>({
  node,
  props,
}: {
  node: SceneNode;
  props: ViewProps<S>;
}) {
  return (
    <div style={{ padding: 8, font: "13px/1.4 system-ui", overflow: "hidden" }}>
      <strong>{props.label ?? node.kind}</strong>
      {props.nodes ? <div>{props.nodes.length} items</div> : <div>{node.id}</div>}
    </div>
  );
}
