import { labelOf, type AnySchema, type Store } from "@graview/core";
import {
  aggregateId,
  layout,
  withFocus,
  type LayoutNode,
  type ViewState,
} from "@graview/layout";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useGraview } from "./context.js";
import { useJackIn } from "./hooks.js";
import { pickedFrom, usePickTargets } from "./picking.js";
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
 *
 * What it is NOT is a screenshot. It took three complaints in one sentence to
 * see that it had become one: not actually full screen, nothing on it
 * clickable, and no way onward from it. All three were the same mistake —
 * this surface rendered a view and left every affordance behind in the scene,
 * so lifting something out to look at it closely was the one place in the
 * product where looking closely cost you the ability to act.
 */
export function JackedIn<S extends AnySchema>({ className, style, children }: JackedInProps) {
  const { store, view, setView, selection, setSelection, setJackedIn, setMenuAt } =
    useGraview<S>();
  const { jackedIn, exit } = useJackIn();
  const body = useRef<HTMLDivElement | null>(null);
  usePickTargets(body);

  const node = jackedIn ? findNode(store, view, jackedIn) : null;
  /*
   * A PLACE or a RECORD, and they want opposite pages.
   *
   * A record is prose and fields: it wants a reading column, because a
   * two-line description set 1500 pixels wide is unreadable. A place is a
   * picture whose whole content is where things are — a formation, a week, a
   * coverage matrix — and capping that at 1120 pixels in the middle of a
   * 1560-pixel screen is how "full screen" ended up meaning a 477-pixel card
   * with dead ground on both sides. Same surface, one honest branch.
   */
  const place = node?.aggregate !== undefined;

  /*
   * Jacking into a RECORD selects it.
   *
   * Otherwise the page is read-only by accident: the actions are derived from
   * the selection, and lifting a view out of the scene without selecting it
   * left a full page with nothing you could do to it. Reading something
   * closely is when you are most likely to want to change it.
   *
   * A place is not selected, because a place is not a node — selecting
   * `aggregate:position` put an id no graph holds into the selection and the
   * actions strip answered, accurately and uselessly, that nothing can be
   * done with this mix of kinds. On a place the strip should be quiet until
   * you pick something ON it.
   */
  useEffect(() => {
    if (jackedIn && !place) setSelection([jackedIn]);
    else if (jackedIn && place) setSelection([]);
  }, [jackedIn, place, setSelection]);

  if (!jackedIn || !node) return null;

  const definition = store.schema.tryDefinition(node.kind);
  const name = node.aggregate
    ? node.aggregate.label
    : labelOf(definition, store.graph.getNode(node.id) as never);

  /** Go INTO something on the page, without leaving the page. */
  const travel = (id: string) => {
    if (id === node.id) return;
    // The view moves with you, so backing out lands beside what you were
    // reading rather than wherever you happened to jack in from.
    setView((current) => ({ ...withFocus(current, id), relation: null }));
    setJackedIn(id);
    setSelection([id]);
  };

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
        {/*
          * How to get further, said once, quietly.
          *
          * The gestures here are the scene's own — click to pick, double click
          * to go in — and a page that looks like a document rather than like a
          * scene gives no reason to try them. One line of chrome is cheaper
          * than a person concluding the page is a picture.
          */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: "var(--graview-ink-faint)",
            whiteSpace: "nowrap",
          }}
        >
          click to pick · double click to open
        </span>
      </header>

      {/*
        * A DOCUMENT: a centred column, capped, with room under it — or, for a
        * place, the whole page.
        *
        * A short record used to be pinned to the top-left of a full viewport
        * with eight hundred pixels of nothing below it, and full-bleed width
        * for two lines of text. Neither is a rendering that failed — both are
        * a rendering that was never given a page to sit on.
        *
        * The bottom padding is for the actions strip, which is fixed over
        * everything: without it the last line of a long record sits underneath
        * the controls that act on it.
        */}
      <main
        ref={body}
        style={{
          flex: "1 1 auto",
          width: "100%",
          /*
           * A record is a READING COLUMN, and 1120 pixels is not one: fields
           * and two lines of prose set that wide left the page looking like
           * content dumped in the corner of a void. Seven hundred and
           * eighty is a document's width. The offset from the header is
           * what makes the column read as a title page rather than as
           * something pinned to the chrome.
           */
          maxWidth: place ? "none" : 780,
          margin: "0 auto",
          padding: place ? "22px 26px 118px" : "min(11vh, 96px) 22px 128px",
          boxSizing: "border-box",
          // A place FILLS: the picture is the content, so it gets the height.
          ...(place ? { display: "flex", flexDirection: "column", minHeight: 0 } : {}),
        }}
        /*
         * The same gesture grammar as the scene, because it is the same
         * contract. A view marks its own targets; the surface routes them.
         * Anything else and the marks a view drew mean one thing in a card and
         * nothing at all on a page.
         */
        onClick={(event) => {
          const picked = pickedFrom(event.target);
          if (!picked) return;
          const additive = event.metaKey || event.shiftKey;
          setSelection((current) =>
            additive
              ? current.includes(picked)
                ? current.filter((other) => other !== picked)
                : [...current, picked]
              : [picked],
          );
        }}
        onDoubleClick={(event) => {
          const picked = pickedFrom(event.target);
          if (picked) travel(picked);
        }}
        onContextMenu={(event) => {
          const picked = pickedFrom(event.target);
          if (!picked) return;
          event.preventDefault();
          setSelection([picked]);
          setMenuAt({ x: event.clientX, y: event.clientY });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const picked = pickedFrom(event.target);
          if (!picked) return;
          event.preventDefault();
          // Enter selects; Enter again on something already selected alone
          // goes in. The same two-step the pointer has, for the keyboard.
          const already = selection.length === 1 && selection[0] === picked;
          if (already && !event.metaKey && !event.shiftKey) travel(picked);
          else setSelection([picked]);
        }}
      >
        <div style={place ? { flex: "1 1 auto", minHeight: 0, display: "flex" } : undefined}>
          <ResolvedView node={node} mode="fullscreen" selected={false} fidelity="full" />
        </div>
        {place ? <Neighbours node={node} onGo={travel} /> : null}
      </main>
    </div>
  );
}

/**
 * What this place touches, and the way there.
 *
 * A record lifted out of the scene already answers this — every view renders
 * its connections at full fidelity — but a PLACE had no answer at all: the
 * formation was a picture of eleven positions with no indication that skills,
 * sessions or fixtures existed, let alone that they were one edge away. Which
 * made the full page the one screen in a graph product where the graph was
 * invisible.
 *
 * Derived from the edges themselves, so a new relation appears here the day
 * it is declared and nobody writes a link.
 */
function Neighbours<S extends AnySchema>({
  node,
  onGo,
}: {
  readonly node: LayoutNode;
  onGo(id: string): void;
}) {
  const { store, views } = useGraview<S>();
  const members = new Set(node.aggregate?.memberIds ?? []);
  if (members.size === 0) return null;

  const own = new Set(
    [...members].flatMap((id) => {
      const member = store.graph.getNode(id);
      return member ? [member.kind] : [];
    }),
  );

  // Kind → how many of its nodes an edge reaches from in here.
  const reach = new Map<string, Set<string>>();
  for (const edge of store.graph.allEdges()) {
    const otherId = members.has(edge.from) ? edge.to : members.has(edge.to) ? edge.from : null;
    if (otherId === null || members.has(otherId)) continue;
    const other = store.graph.getNode(otherId);
    if (!other || own.has(other.kind)) continue;
    reach.set(other.kind, (reach.get(other.kind) ?? new Set()).add(otherId));
  }
  if (reach.size === 0) return null;

  const plural = (kind: string) => store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

  /*
   * The place a kind LIVES IN, which is not always the kind on its own.
   *
   * Skills and drills are one picture — a coverage matrix reading one against
   * the other — so sending someone to `aggregate:skill` handed the matrix
   * half its data and drew a column of rows with nothing to check them
   * against. Kinds drawn by the SAME view at the same cell are one place, and
   * the registry already knows which those are; a generic view is excluded,
   * since every kind shares that one and it would make the whole schema a
   * single destination.
   */
  const cell = { cardinality: "many", fidelity: "full" } as const;
  const placeOf = (kind: string): string => {
    const mine = views.resolve(kind, cell)?.view;
    if (!mine || (mine as { generic?: boolean }).generic) return aggregateId(kind);
    const together = views
      .all()
      .filter(
        (registration) =>
          registration.cardinality === cell.cardinality &&
          registration.fidelity === cell.fidelity &&
          registration.view === mine,
      )
      .map((registration) => registration.kind);
    return aggregateId(...new Set(together));
  };

  return (
    <nav
      aria-label="What this touches"
      data-testid="neighbours"
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 18,
        paddingTop: 14,
        borderTop: "1px solid var(--graview-edge)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--graview-ink-faint)",
          marginRight: 2,
        }}
      >
        What this touches
      </span>
      {[...reach.entries()]
        .sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1))
        .map(([kind, ids]) => (
          <button
            key={kind}
            type="button"
            data-graview-neighbour={kind}
            title={`Open ${plural(kind)} — ${ids.size} of them are one edge from here`}
            // A place is reached by its aggregate id, which is how the scene
            // reaches one too. Same address, so the URL and the back button
            // keep working from in here.
            onClick={() => onGo(placeOf(kind))}
            style={{ padding: "3px 11px", fontSize: 12.5, borderRadius: 999 }}
          >
            {plural(kind)}
            <span style={{ color: "var(--graview-ink-faint)" }}> {ids.size}</span>
          </button>
        ))}
    </nav>
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
