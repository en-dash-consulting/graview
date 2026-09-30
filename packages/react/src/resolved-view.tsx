import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import { aggregateId, isAggregateId, kindCardId, kindOfCard, withFocus } from "@graview/layout";
import { PLANE_STYLES } from "@graview/render";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFlagged, useImplicated, useNavigation } from "./hooks.js";
import { useFound, useGraph, useGraview, ViewModeProvider, type ViewMode } from "./context.js";
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
 * THE DISTRICTS THE ROW COULD NOT HOLD, NAMED — BEHIND ONE PRESS.
 *
 * A district is read rather than glanced at, so the row never squeezes a
 * name below a word: past what it can hold at a legible width it keeps the
 * ones that fit and hands the rest to this. Not a district — it has no
 * members, no figure and no count of its own — a card that says how many
 * are missing and takes you to any of them.
 *
 * It used to list every name inside its own box, which is a district
 * card's height: room for the count and nothing else, the names scrolled
 * away under a fade, and "+6" over one clipped word read as a broken
 * placeholder rather than the only way to five districts. So the card IS
 * the control now — "+6 more" is a button — and pressing it opens a panel
 * above the row that names every district with what it holds, each name
 * a press to that district. The district you are already in, which lands
 * here when the row has room for nothing else, is marked as here rather
 * than offered as somewhere to go.
 */
export function BeyondCard({ kinds }: { kinds: readonly string[] }) {
  const { store } = useGraview();
  const { view, go } = useNavigation();
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  /*
   * THE PANEL LEAVES THE PLANE. Drawn inside the card it sat on plane two,
   * and the focused card on plane zero painted over it — a menu nobody
   * could press. It is portalled onto the scene's ground, above every
   * plane, and placed by the card's own screen rectangle at the moment it
   * opens; a press anywhere else closes it before the scene can move.
   */
  const [anchor, setAnchor] = useState<{ into: HTMLElement; left: number; bottom: number } | null>(null);
  const place = () => {
    const box = card.current;
    const into = box?.closest<HTMLElement>(".graview-ground");
    if (!box || !into) return null;
    const mine = box.getBoundingClientRect();
    const ground = into.getBoundingClientRect();
    return { into, left: mine.left - ground.left, bottom: ground.bottom - mine.top + 6 };
  };
  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;
  const count = (kind: string) => store.graph.allNodes().filter((node) => node.kind === kind).length;
  const here = (kind: string) => !view.overview && view.focusId === aggregateId(kind);
  /* Escape, or a press anywhere else, closes it; the button keeps focus. */
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".graview-beyond-list, .graview-beyond")) return;
      setOpen(false);
      setAnchor(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        card.current?.querySelector<HTMLButtonElement>(".graview-beyond-more")?.focus();
      }
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const going = kinds.filter((kind) => !here(kind));
  return (
    <div
      ref={card}
      className="graview-beyond"
      data-graview-beyond={kinds.length}
      data-graview-beyond-open={open ? "" : undefined}
    >
      <button
        type="button"
        className="graview-beyond-more"
        data-testid="beyond-more"
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${going.length} more district${going.length === 1 ? "" : "s"} — press to see them`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const next = !open;
          setAnchor(next ? place() : null);
          setOpen(next);
        }}
      >
        <span className="graview-beyond-count">+{going.length}</span>
        <span className="graview-beyond-word">more</span>
        <span className="graview-beyond-chevron" aria-hidden="true">{open ? "▾" : "▴"}</span>
      </button>
      {open && anchor ? createPortal(
        <ul
          className="graview-beyond-list"
          role="menu"
          aria-label="The other districts"
          data-testid="beyond-list"
          data-graview-overlay=""
          style={{ left: anchor.left, bottom: anchor.bottom }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {kinds.map((kind) => (
            <li key={kind} role="none">
              <button
                type="button"
                role="menuitem"
                data-graview-pick={kindCardId(kind)}
                aria-current={here(kind) ? "location" : undefined}
                title={here(kind) ? `${plural(kind)} — where you are` : `Go to ${plural(kind)}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (!here(kind)) go(withFocus(view, aggregateId(kind)));
                }}
              >
                <span className="graview-beyond-name">{plural(kind)}</span>
                <span className="graview-beyond-tally">{here(kind) ? "here" : count(kind)}</span>
              </button>
            </li>
          ))}
        </ul>,
        anchor.into,
      ) : open ? (
        <ul className="graview-beyond-list" role="menu" aria-label="The other districts" data-testid="beyond-list">
          {kinds.map((kind) => (
            <li key={kind} role="none">
              <button type="button" role="menuitem" data-graview-pick={kindCardId(kind)} onClick={() => { setOpen(false); if (!here(kind)) go(withFocus(view, aggregateId(kind))); }}>
                {plural(kind)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
      sameValue((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]),
  );
}

/**
 * The same value, by what it holds. A pan reuses a node's nested objects;
 * a re-layout — a district moved by hand — builds them again with the same
 * contents, and comparing those by identity redrew every lens in the city on
 * every pointer move of the drag.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const proto = Object.getPrototypeOf(a);
  // Only plain data: anything with a class of its own is compared by identity.
  if (proto !== Object.prototype && proto !== Array.prototype) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
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

/**
 * Picks the view for a cell of the matrix — cardinality by whether this is an
 * aggregate, fidelity by plane depth — and renders it.
 *
 * A kind with no registered view falls back to the primitive the app
 * supplied, which is why a new node kind renders sensibly before anyone
 * writes a view for it.
 */
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

  /*
   * A group's members, looked up once per graph rather than once per frame:
   * a kind's card holds every song, and a tween re-renders it sixty times a
   * second with the same list.
   */
  const memberIds = node.aggregate?.memberIds;
  const members = useMemo(
    () => (memberIds ?? []).map((id) => store.graph.getNode(id)).filter((n): n is NodeOfSchema<S> => n !== undefined),
    [memberIds, store, graph],
  );
  const props: ViewProps<S> = {
    ...(node.aggregate
      ? {
          nodes: members,
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
    ...(node.openedRows !== undefined ? { openedRows: node.openedRows } : {}),
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
    node.openedRows ?? "",
    node.rank ?? "",
    node.nestedUnder ?? "",
    node.plot ? `${node.plot.col},${node.plot.row},${node.plot.side}` : "",
    node.aggregate ? idsKey(node.aggregate.memberIds) : "",
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

/**
 * A RELATION THE BAND COULD NOT HOLD, drawn as what it is (docs/scale.md):
 * a group in the graph's own words with a true count and the first names
 * in it — the most relevant — or the "+N more" door to the kind's picture.
 * Not the kind's own lens squeezed into a card: a coverage matrix at 180
 * pixels says nothing and costs thousands of elements. Opened by the host's
 * own press (a double-click, or Enter), like every card.
 */
export const BandCard = memo(function BandCard({ node }: { readonly node: SceneNode }) {
  const { store } = useGraview();
  const found = useFound();
  const aggregate = node.aggregate!;
  const opens = aggregate.opens!;
  const count = aggregate.memberIds.length;
  const plural = (store.schema.tryDefinition(aggregate.kind)?.plural ?? `${aggregate.kind}s`).toLowerCase();
  const counted = `${count} ${count === 1 ? aggregate.kind.replace(/-/g, " ") : plural}`;
  const names = aggregate.memberIds.slice(0, 3).map((id) => {
    const member = store.graph.getNode(id);
    const definition = member ? store.schema.tryDefinition(member.kind) : undefined;
    return member ? (definition?.label ? definition.label(member as never) : String((member as { label?: unknown }).label ?? id)) : id;
  });
  const hits = found ? aggregate.memberIds.filter(new Set(found.matched).has, new Set(found.matched)).length : 0;
  const door = opens.in === "picture";
  /*
   * TWO LINES, read at a glance: what the group is and which way it opens,
   * then how many and the first of them. A card stacked four lines deep
   * was cut to its name in a band row, and the count — the one thing a
   * group says that a member cannot — was the line that went.
   */
  return (
    <div
      className="graview-band-group"
      data-graview-band={opens.in}
      data-graview-band-count={count}
      data-graview-emphasis={found ? (hits > 0 ? "lit" : "dimmed") : undefined}
      title={door ? `${aggregate.label} — press twice to see them all, arranged` : `${aggregate.label}: ${counted} — press twice to open`}
    >
      <span className="graview-band-group-head">
        <span className="graview-band-group-name">{aggregate.label}</span>
        <span className="graview-band-group-open" aria-hidden="true">
          {door ? "↗" : "▾"}
        </span>
      </span>
      <span className="graview-band-group-names">
        {door ? null : (
          <span className="graview-band-group-count">
            {counted}
            {hits > 0 ? ` · ${hits} match` : ""}
            {" · "}
          </span>
        )}
        {names.join(" · ")}
        {count > names.length ? " …" : ""}
      </span>
    </div>
  );
});

/*
 * A group's members as a short key: their count and a hash of their ids.
 * The signature joined them, and a band group or a district holds hundreds,
 * so every host rebuilt a string of thousands of characters every frame of
 * a transition to learn that nothing had changed (docs/scale.md).
 */
const keys = new WeakMap<readonly string[], string>();
function idsKey(ids: readonly string[]): string {
  // The same array from frame to frame of a tween: hashed once.
  const known = keys.get(ids);
  if (known !== undefined) return known;
  let hash = 0x811c9dc5;
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
    hash = Math.imul(hash ^ 0x2c, 0x01000193);
  }
  const key = `${ids.length}:${(hash >>> 0).toString(36)}`;
  keys.set(ids, key);
  return key;
}
