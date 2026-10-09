import { pluralLabel, counted, isCurrent, labelOf, LOCAL_LAYERS, type AnyGraphNode, type AnySchema } from "@graview/core";
import { columnMoves, columnOf, statusColumns, type ColumnMove, type StatusColumn } from "@graview/core/describe";
import { useGraph, useGraview, ViewModeProvider, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel } from "../primitives/index.js";
import { ListedLink, SaidAround } from "../spec-views.js";
import { withMore } from "./more.js";

/**
 * THE STATUS BOARD (FR-97): a kind's records in columns by one choice field.
 *
 *   { name: "columns", title: "The board", bindings: { task: { column: "status" } } }
 *
 * The columns are the field's choices in their declared order (`statusColumns`,
 * in core, which `describePlace` reads too), with a last column for records
 * that have no value when the field may be left empty. Each record is drawn
 * by its own card — the kind's card spec, or the default card — and is a
 * link to itself, as a listed record is everywhere else.
 *
 * MOVING A CARD IS AN ACT, NOT A FEATURE OF THE LENS. The moves a seat is
 * offered are the acts the declaration already has that set the field —
 * a named step to its own column where its condition holds for the card,
 * otherwise an act told the value — which this seat's policy lets it run
 * (`columnMoves`, FR-108). A move runs that act as the seat, through the store: it
 * is in the log with its author, and one undo puts the card back. A seat
 * with no such act sees no control to move anything — not a disabled one.
 * Two ways to move, the same act: drag a card onto a column, or press its
 * "Move" button and choose a column, which is the way a keyboard, a screen
 * reader and a phone take.
 */
export interface ColumnsBindings {
  readonly [kind: string]: { readonly column: string };
}

export interface ColumnsOptions {
  readonly bindings: ColumnsBindings;
}

export interface ColumnsLens<S extends AnySchema> {
  readonly name: "columns";
  readonly requiredRoles: readonly string[];
  readonly bindings: ColumnsBindings;
  View(props: ViewProps<S>): ReactElement | null;
}

/** A node as the board reads it. */
type Card = AnyGraphNode & Readonly<Record<string, unknown>>;

/** One kind's board: its field, its columns, and its records in them. */
interface Board {
  readonly kind: string;
  readonly field: string;
  readonly columns: readonly { readonly column: StatusColumn; readonly cards: readonly Card[]; readonly count: number }[];
}

const BOARD_CSS = `
.graview-columns { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.graview-columns-column { flex: 1 1 13rem; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 10px; border: 1px solid var(--graview-edge); background: color-mix(in srgb, var(--graview-panel) 60%, transparent); }
.graview-columns-column[data-droppable="true"] { border-color: var(--graview-accent); }
.graview-columns-column[data-over="true"] { background: color-mix(in srgb, var(--graview-accent) 10%, transparent); }
.graview-columns-heading { margin: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 0.875rem; font-weight: 600; color: var(--graview-ink); }
.graview-columns-count { font-weight: 400; color: var(--graview-ink-muted); font-variant-numeric: tabular-nums; }
.graview-columns-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.graview-columns-empty { margin: 0; font-size: 0.8125rem; color: var(--graview-ink-muted); }
.graview-columns-card[draggable="true"] { cursor: grab; }
.graview-columns-move { position: relative; z-index: ${LOCAL_LAYERS.raised}; display: flex; justify-content: flex-end; margin-top: 4px; }
.graview-columns-move[data-open="true"] { z-index: ${LOCAL_LAYERS.over}; }
.graview-columns-move > button, .graview-columns-menu button, .graview-columns-said button { font: inherit; font-size: 0.8125rem; min-height: 28px; padding: 2px 10px; border-radius: 7px; border: 1px solid var(--graview-edge); background: var(--graview-panel); color: var(--graview-ink); cursor: pointer; }
.graview-columns-move > button:focus-visible, .graview-columns-menu button:focus-visible, .graview-columns-said button:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; }
.graview-columns-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: ${LOCAL_LAYERS.over}; display: flex; flex-direction: column; gap: 4px; padding: 6px; min-width: 10rem; border-radius: 9px; border: 1px solid var(--graview-edge); background: var(--graview-panel); box-shadow: 0 6px 18px rgb(0 0 0 / 0.18); }
.graview-columns-menu button { text-align: left; }
.graview-columns-said { margin: 0 0 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--graview-ink); }
.graview-columns-said[data-tone="refused"] { color: var(--graview-warn); }
`;

export function createColumnsLens<S extends AnySchema>(options: ColumnsOptions): ColumnsLens<S> {
  function View(props: ViewProps<S>) {
    const { store } = useGraview<S>();
    useGraph<S>();
    const kinds = Object.keys(options.bindings).filter((kind) => store.schema.tryDefinition(kind) !== undefined);
    /*
     * EVERY KIND IT IS BOUND TO, as the calendar reads them: the group's
     * members, and the other bound kinds from the graph this seat sees.
     */
    const given = (props.nodes ?? []) as readonly Card[];
    const own = new Set(given.map((node) => String(node.kind)));
    const current = (kind: string) => (store.graph.nodesOfKind(kind as never) as unknown as Card[]).filter((node) => isCurrent(store.schema.tryDefinition(kind), node as never));
    const cut = props.total !== undefined && props.total > given.length;
    const boards: Board[] = kinds.map((kind) => {
      const field = options.bindings[kind]!.column;
      const columns = statusColumns(store.schema, kind, field);
      const drawn = own.has(kind) ? given.filter((node) => node.kind === kind) : current(kind).slice(0, props.budget ?? Infinity);
      // A count is how many this seat's board holds, not how many a thumbnail had room for.
      const all = own.has(kind) && !cut ? drawn : current(kind);
      return {
        kind,
        field,
        columns: columns
          .map((column) => ({
            column,
            cards: drawn.filter((node) => columnOf(node, field, columns) === column.value),
            count: all.filter((node) => columnOf(node, field, columns) === column.value).length,
          }))
          .filter((entry) => entry.column.value !== null || entry.count > 0),
      };
    });
    const total = boards.reduce((sum, board) => sum + board.columns.reduce((n, entry) => n + entry.count, 0), 0);
    const title = props.label ?? "Board";
    const first = kinds[0];

    if (props.fidelity === "glyph") return <Chip label={`${title} · ${total}`} hue={hueFor("columns")} />;
    if (props.fidelity === "summary") {
      return (
        <Panel title={title} meta={first ? counted(store.schema, first, total) : String(total)} tone="muted">
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }} data-testid="columns-summary">
            {boards.flatMap((board) => board.columns.map((entry) => `${entry.column.label} ${entry.count}`)).join(" · ")}
          </p>
        </Panel>
      );
    }
    const picture = <ColumnsBoard boards={boards} title={title} />;
    // On a page the page's own heading already says what it is; in the scene it is a card, as every lens is.
    return withMore(
      props,
      store.schema,
      props.mode === "fullscreen" ? (
        <div style={{ padding: "14px 16px" }}>{picture}</div>
      ) : (
        <Panel title={title} meta={first ? counted(store.schema, first, total) : undefined}>
          {picture}
        </Panel>
      ),
    );
  }
  return { name: "columns", requiredRoles: ["column"], bindings: options.bindings, View };
}

/** What the board last did, said where a person is looking — with the undo that takes it back. */
interface Said {
  readonly text: string;
  readonly tone: "moved" | "refused";
  readonly batch?: string;
  readonly id?: string;
}

function ColumnsBoard({ boards, title }: { readonly boards: readonly Board[]; readonly title: string }) {
  const { store, principal } = useGraview<AnySchema>();
  const root = useRef<HTMLDivElement | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [dragging, setDragging] = useState<{ readonly id: string; readonly to: readonly string[] } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** The card whose Move button keeps the keyboard after it changes column, or the undo after a move. */
  const [focusing, setFocusing] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!focusing) return;
    const target = root.current?.querySelector<HTMLElement>(focusing);
    target?.focus();
    setFocusing(null);
  });

  const titleOf = (id: string) => {
    const node = store.graph.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind), node) : id;
  };
  const movesOf = (card: Card, board: Board): readonly ColumnMove[] =>
    columnMoves(store, principal, card, board.field, board.columns.map((entry) => entry.column));

  const move = (id: string, move: ColumnMove, label: string, from: "keyboard" | "drag") => {
    try {
      const result = store.apply(move.call, { author: principal });
      setSaid({ text: `Moved “${titleOf(id)}” to ${label}.`, tone: "moved", batch: result.batch, id });
      if (from === "keyboard") setFocusing(`[data-columns-move="${CSS_ESCAPE(id)}"] > button`);
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), tone: "refused" });
    }
  };
  const undo = () => {
    if (!said?.batch) return;
    try {
      store.undo(said.batch, { author: principal });
      setSaid({ text: `“${titleOf(said.id ?? "")}” is back where it was.`, tone: "moved" });
      if (said.id) setFocusing(`[data-columns-move="${CSS_ESCAPE(said.id)}"] > button`);
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), tone: "refused" });
    }
  };

  return (
    <div ref={root} data-testid="columns-lens">
      <style>{BOARD_CSS}</style>
      <p className="graview-columns-said" role="status" data-tone={said?.tone} data-testid="columns-said" style={said ? undefined : { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {said ? <span>{said.text}</span> : null}
        {said?.batch ? (
          <button type="button" data-testid="columns-undo" onClick={undo}>
            Undo
          </button>
        ) : null}
      </p>
      {boards.map((board) => (
        <section key={board.kind} data-columns-kind={board.kind} aria-label={`${pluralLabel(store.schema, board.kind)} by ${board.field}`}>
          <div className="graview-columns">
            {board.columns.map(({ column, cards, count }) => {
              const value = column.value ?? "";
              const droppable = dragging !== null && column.value !== null && dragging.to.includes(column.value);
              return (
                <section
                  key={value}
                  className="graview-columns-column"
                  data-graview-column={value}
                  data-droppable={droppable || undefined}
                  data-over={(droppable && over === value) || undefined}
                  // The lens first (FR-109): a phone's screen reader says a region by its name alone, and "Researching, 0" does not say which board — nor does the app's name, so an embed leaves this one as it is.
                  aria-label={`${title} · ${column.label}, ${count}`}
                  data-graview-named-by-lens=""
                  onDragOver={(event) => {
                    if (!droppable) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOver(value);
                  }}
                  onDragLeave={() => setOver((was) => (was === value ? null : was))}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData("text/graview-node");
                    const card = store.graph.getNode(id) as Card | undefined;
                    setOver(null);
                    setDragging(null);
                    if (!card || column.value === null) return;
                    const found = movesOf(card, board).find((one) => one.to === column.value);
                    if (!found) return;
                    event.preventDefault();
                    event.stopPropagation();
                    move(id, found, column.label, "drag");
                  }}
                >
                  <h3 className="graview-columns-heading">
                    <span>{column.label}</span>
                    <span className="graview-columns-count" data-testid="columns-count">
                      {count}
                    </span>
                  </h3>
                  {cards.length === 0 ? (
                    <p className="graview-columns-empty">Nothing here.</p>
                  ) : (
                    <ul className="graview-columns-cards">
                      {/* The column says the card's state; the card does not say it again (FR-117). */}
                      <SaidAround.Provider value={column.value === null ? null : { field: board.field, values: [column.value, column.label] }}>
                      {cards.map((card) => {
                        const moves = movesOf(card, board);
                        return (
                          <ColumnCard
                            key={card.id}
                            card={card}
                            moves={moves}
                            labelOf={(to) => board.columns.find((entry) => entry.column.value === to)?.column.label ?? to}
                            onMove={(found, label) => move(card.id, found, label, "keyboard")}
                            onDrag={(on) => setDragging(on ? { id: card.id, to: moves.map((one) => one.to) } : null)}
                          />
                        );
                      })}
                      </SaidAround.Provider>
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const CSS_ESCAPE = (id: string) => (typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(id) : id.replace(/["\\]/g, "\\$&"));

function ColumnCard({
  card,
  moves,
  labelOf: columnLabel,
  onMove,
  onDrag,
}: {
  readonly card: Card;
  readonly moves: readonly ColumnMove[];
  readonly labelOf: (to: string) => string;
  readonly onMove: (move: ColumnMove, label: string) => void;
  readonly onDrag: (on: boolean) => void;
}) {
  const { store, views } = useGraview<AnySchema>();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const label = labelOf(store.schema.tryDefinition(card.kind), card);
  const View = views.lookup(card.kind as never, { cardinality: "one", fidelity: "summary" }) as ViewComponent<AnySchema> | undefined;

  useLayoutEffect(() => {
    if (open) menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    }
  };

  return (
    <li
      className="graview-spec-item graview-columns-card"
      data-graview-listed={card.id}
      data-as="card"
      draggable={moves.length > 0 || undefined}
      onDragStart={(event) => {
        if (moves.length === 0) return;
        // A node, named in a type only the board and the calendar read: dropped anywhere else, it moves nothing.
        event.dataTransfer.setData("text/graview-node", card.id);
        event.dataTransfer.effectAllowed = "move";
        onDrag(true);
      }}
      onDragEnd={() => onDrag(false)}
    >
      {View ? (
        // A card on the board is a card as the scene draws it, on either face.
        <ViewModeProvider mode="scene">
          <View node={card as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
        </ViewModeProvider>
      ) : (
        <span className="graview-spec-item-name">{label}</span>
      )}
      <ListedLink node={card} label={label} />
      {moves.length > 0 ? (
        <div
          className="graview-columns-move"
          data-columns-move={card.id}
          data-open={open || undefined}
          // Leaving the control closes its list, as a menu does.
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <button
            ref={button}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Move “${label}” to another column`}
            data-testid="columns-move"
            onClick={() => setOpen((was) => !was)}
          >
            Move…
          </button>
          {open ? (
            <div
              ref={menu}
              role="menu"
              aria-label={`Move “${label}” to`}
              className="graview-columns-menu"
              onKeyDown={onMenuKey}
              // A press keeps the keyboard where it is, so a browser that does not focus what it presses does not close the list under it.
              onMouseDown={(event) => event.preventDefault()}
            >
              {moves.map((one) => (
                <button
                  key={one.to}
                  type="button"
                  role="menuitem"
                  data-columns-to={one.to}
                  title={one.title}
                  onClick={() => {
                    setOpen(false);
                    onMove(one, columnLabel(one.to));
                  }}
                >
                  {columnLabel(one.to)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

