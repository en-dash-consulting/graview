import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import type { ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";

/**
 * The board lens: things arranged where the DOMAIN says they go.
 *
 * The third picture, and the first one whose geometry the framework does not
 * own. A timeline places by time; a matrix places by two sets; a board places
 * by coordinates the app declares on its own nodes — a formation on a pitch,
 * desks in an office, a stage plot, seats at a table, bays in a warehouse.
 *
 * That distinction matters more than it looks. Everywhere else, layout is a
 * pure function of (focus, relation, graph) and the framework decides where
 * things sit. Here the arrangement is DATA: a left back is at the left back's
 * place because the position node says so, and moving it is an ordinary
 * mutation rather than a change to the layout engine.
 *
 * A slot with nothing in it is the point. On a pitch it is the hole in the
 * team; on a seating plan it is the empty chair. That reads instantly in an
 * arrangement and not at all in a list.
 */

export const BOARD_REQUIRED_ROLES = ["slots", "x", "y", "fill"] as const;

export interface BoardOptions {
  /** Kind whose nodes are the slots. */
  readonly slots: string;
  /** Fields on a slot holding its place, each 0..1 across the board. */
  readonly x: string;
  readonly y: string;
  /** Edge kind from a slot to whatever occupies it. */
  readonly fill: string;
  /** Field holding a short code for the slot, e.g. "LB". */
  readonly slotCode?: string;
  /** Bands drawn behind the slots, in the same 0..1 space. */
  readonly zones?: readonly { readonly label: string; readonly from: number; readonly to: number }[];
  /** Width divided by height. A pitch is taller than it is wide, seen this way. */
  readonly aspect?: number;
  /** What an empty slot is called, in the app's words. */
  readonly emptyLabel?: string;
}

export interface BoardSlot {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly occupantId: string | null;
  readonly occupantLabel: string | null;
}

export interface BoardState {
  readonly slots: readonly BoardSlot[];
  /** Slots with nothing in them. The reason the lens exists. */
  readonly empty: readonly string[];
  /** Candidates not placed in any slot — the bench. */
  readonly spare: readonly { readonly id: string; readonly label: string }[];
}

export class BoardBindingError extends Error {
  constructor(message: string, readonly hint: string) {
    super(`${message}\n  ${hint}`);
    this.name = "BoardBindingError";
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Reads the arrangement out of the graph. Pure and exported, so a test can
 * assert on the holes rather than on the drawing of them.
 */
export function buildBoard<S extends AnySchema>(
  nodes: readonly NodeOfSchema<S>[],
  edges: readonly { kind: string; from: string; to: string }[],
  options: BoardOptions,
  schema?: S,
): BoardState {
  const record = (node: NodeOfSchema<S>) => node as unknown as Record<string, unknown>;
  const name = (node: NodeOfSchema<S>) =>
    schema
      ? labelOf(schema.tryDefinition(node.kind), node as never)
      : String(record(node)["label"] ?? node.id);

  const slotNodes = nodes.filter((node) => node.kind === options.slots);
  if (slotNodes.length === 0) {
    throw new BoardBindingError(
      `Nothing to arrange: no "${options.slots}" nodes.`,
      `Check the lens bindings: { slots: "<kind>", x: "<field>", y: "<field>", fill: "<edge kind>" }`,
    );
  }

  const filling = edges.filter((edge) => edge.kind === options.fill);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const slots = slotNodes
    .map((node): BoardSlot => {
      const fields = record(node);
      const edge = filling.find((candidate) => candidate.from === node.id);
      const occupant = edge ? byId.get(edge.to) : undefined;
      return {
        id: node.id,
        code: String(fields[options.slotCode ?? ""] ?? "").trim() || name(node),
        label: name(node),
        x: clamp01(Number(fields[options.x] ?? 0.5)),
        y: clamp01(Number(fields[options.y] ?? 0.5)),
        occupantId: occupant?.id ?? null,
        occupantLabel: occupant ? name(occupant) : null,
      };
    })
    // Top to bottom, then left to right: a stable reading order for the
    // accessibility tree, which otherwise gets whatever order the graph
    // happened to be in.
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const placed = new Set(slots.map((slot) => slot.occupantId).filter(Boolean) as string[]);
  const occupantKinds = new Set(
    slots
      .map((slot) => (slot.occupantId ? byId.get(slot.occupantId)?.kind : undefined))
      .filter((kind): kind is string => kind !== undefined),
  );
  const spare = nodes
    .filter((node) => occupantKinds.has(node.kind) && !placed.has(node.id))
    .map((node) => ({ id: node.id, label: name(node) }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  return {
    slots,
    empty: slots.filter((slot) => slot.occupantId === null).map((slot) => slot.id),
    spare,
  };
}

export interface BoardViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly options: BoardOptions;
  readonly schema?: S;
}

export function BoardView<S extends AnySchema>({
  nodes,
  label,
  fidelity,
  options,
  schema,
  implicated = [],
  flagged = [],
}: BoardViewProps<S>) {
  const { store } = useGraview<AnySchema>();
  /*
   * The whole graph, not the aggregate's members.
   *
   * A board's occupants are a DIFFERENT kind from its slots, and an aggregate
   * of positions does not contain the players in them — so reading occupants
   * out of `props.nodes` made every slot report itself empty. The coverage
   * matrix gets away with `props.nodes` because both its kinds are in the
   * aggregate; a board never can. The aggregate still decides what is
   * focused; it just does not decide what can be looked up.
   */
  const board = buildBoard<S>(
    store.graph.allNodes() as never,
    store.graph.allEdges(),
    options,
    schema,
  );
  void nodes;
  const lit = new Set(implicated);
  const broken = new Set(flagged);

  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${label ?? "Board"} · ${board.slots.length - board.empty.length}/${board.slots.length}`}
        hue={hueFor("board")}
      />
    );
  }

  if (fidelity === "summary") {
    const holes = board.slots.filter((slot) => board.empty.includes(slot.id));
    return (
      <Panel
        title={label ?? "Board"}
        meta={`${board.slots.length - board.empty.length}/${board.slots.length}`}
        tone={holes.length > 0 ? "warning" : "muted"}
        fit
      >
        {/* No shrunken pitch: a board at a third of its size is a smudge.
            The names of the holes are what someone glancing wants. */}
        {holes.length > 0 ? (
          <Roster
            pick
            max={5}
            items={holes.map((slot) => ({ id: slot.id, label: slot.code }))}
          />
        ) : (
          <span style={{ fontSize: 12, color: "var(--graview-ink-faint)" }}>Every slot filled.</span>
        )}
      </Panel>
    );
  }

  const aspect = options.aspect ?? 0.68;

  return (
    <Panel
      title={label ?? "Board"}
      meta={board.empty.length === 0 ? "complete" : `${board.empty.length} unfilled`}
    >
      {/* Centred: the focus band is as wide as the widest view an app has,
          and an arrangement hugging the left edge of it reads as unfinished
          rather than as a board with a bench beside it. */}
      {/*
        * An arrangement SCALES to the box it is given.
        *
        * A fixed pitch is the one thing a board must not have: on a short
        * screen it ran past its band and the defence disappeared, which for
        * a view whose entire content is "where things are" is the worst
        * possible failure. Height drives it and the aspect ratio follows, so
        * the formation stays a formation at any size.
        */}
      <div
        style={{
          display: "flex",
          gap: 28,
          alignItems: "stretch",
          justifyContent: "center",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <div
          data-graview-primitive="board"
          style={{
            position: "relative",
            height: "100%",
            aspectRatio: `${aspect}`,
            maxWidth: "100%",
            flex: "0 1 auto",
            // Its own border counts INSIDE the hundred percent. Without this
            // the pitch is two pixels taller than the box it was told to
            // fill, which is enough to put a scroll region on a board that
            // fits — visible as a sliver of the bench cut off at the bottom.
            boxSizing: "border-box",
            borderRadius: 12,
            border: "1px solid var(--graview-edge)",
            // A ground of its own, so the arrangement reads as a place rather
            // than as dots floating on the panel.
            background:
              "linear-gradient(var(--graview-panel-muted), var(--graview-panel-muted)), var(--graview-panel)",
            overflow: "hidden",
          }}
        >
          {(options.zones ?? []).map((zone) => (
            <div
              key={zone.label}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${zone.from * 100}%`,
                height: `${(zone.to - zone.from) * 100}%`,
                borderBottom: "1px dashed var(--graview-edge)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 7,
                  top: 5,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--graview-ink-faint)",
                }}
              >
                {zone.label}
              </span>
            </div>
          ))}

          {board.slots.map((slot) => {
            const hole = slot.occupantId === null;
            const dim =
              lit.size > 0 && !lit.has(slot.id) && !(slot.occupantId && lit.has(slot.occupantId));
            const bad = broken.has(slot.id) || (slot.occupantId ? broken.has(slot.occupantId) : false);
            return (
              <div
                key={slot.id}
                data-graview-pick={slot.occupantId ?? slot.id}
                data-graview-slot={slot.id}
                /*
                 * Emphasis in the DOM as well as in the paint. A claim about
                 * a picture that exists only as a colour cannot be checked by
                 * anything — not a test, not a person reading the tree.
                 */
                data-graview-emphasis={lit.size === 0 ? "plain" : dim ? "dimmed" : "lit"}
                title={
                  hole
                    ? `${slot.label} — nobody in it`
                    : `${slot.occupantLabel} at ${slot.label}`
                }
                style={{
                  position: "absolute",
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  display: "grid",
                  justifyItems: "center",
                  gap: 3,
                  opacity: dim ? 0.5 : 1,
                  transition: "opacity 160ms ease",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 10.5,
                    letterSpacing: "0.02em",
                    // An empty slot is drawn as an OUTLINE, not as a filled
                    // shape with no name: the hole should look like a hole.
                    border: hole
                      ? "1.5px dashed var(--graview-warn)"
                      : `1px solid ${bad ? "var(--graview-warn)" : "var(--graview-edge-bright)"}`,
                    background: hole
                      ? "transparent"
                      : bad
                        ? "var(--graview-panel-warning)"
                        : "var(--graview-panel)",
                    color: hole || bad ? "var(--graview-warn)" : "var(--graview-ink)",
                    boxShadow: hole ? undefined : "var(--graview-lift-low)",
                  }}
                >
                  {slot.code}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    whiteSpace: "nowrap",
                    color: hole ? "var(--graview-warn)" : "var(--graview-ink-muted)",
                  }}
                >
                  {slot.occupantLabel ?? (options.emptyLabel ?? "empty")}
                </span>
              </div>
            );
          })}
        </div>

        {board.spare.length > 0 ? (
          <div style={{ display: "grid", gap: 6, alignContent: "start", minWidth: 0 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--graview-ink-faint)",
              }}
            >
              Not in
            </span>
            <Roster pick max={10} items={board.spare} />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export interface BoardLens<S extends AnySchema> {
  readonly name: "board";
  readonly requiredRoles: readonly string[];
  readonly options: BoardOptions;
  View(props: ViewProps<S>): ReactElement | null;
  build(
    nodes: readonly NodeOfSchema<S>[],
    edges: readonly { kind: string; from: string; to: string }[],
    schema?: S,
  ): BoardState;
}

export function createBoardLens<S extends AnySchema>(options: BoardOptions): BoardLens<S> {
  return {
    name: "board",
    requiredRoles: [...BOARD_REQUIRED_ROLES],
    options,
    View(props) {
      return <BoardView<S> {...props} options={options} />;
    },
    build(nodes, edges, schema) {
      return buildBoard<S>(nodes, edges, options, schema);
    },
  };
}
