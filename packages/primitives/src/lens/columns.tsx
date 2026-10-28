import { pluralLabel, counted, isCurrent, labelOf, LOCAL_LAYERS, numberAsRead, SEARCH_UNASKED, sortForGrid, type AnyGraphNode, type AnySchema, type GridSort, type NodeOfSchema, type Principal } from "@graview/core";
import { columnChoices, columnMoves, columnOf, statusColumns, type ColumnMove, type StatusColumn } from "@graview/core/describe";
import { useGraph, useGraview, ViewModeProvider, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { holdBoard } from "../board-move-section.js";
import { ChooseSeveral, MoveTo, type MoveChoice } from "./move-to.js";
import { CHOOSING_CSS, useChoosing, type Choosing } from "../choosing.js";
import { prefetchSeveral, SeveralBarDoor } from "../several-door.js";
import { hueFor } from "../default-views.js";
import { Chip, NamedByItsLink, Panel } from "../primitives/index.js";
import { VISUALLY_HIDDEN } from "../primitives/measure.js";
import { ListedLink, SaidAround } from "../spec-views.js";
import { useArranging } from "./arranging.js";
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
 *
 * THREE WAYS TO MOVE, THE SAME ACT, AND NO BUTTON UNDER EVERY CARD (Roadmap
 * f-board-move-without-buttons): a Move… button under each card doubled
 * the board's height. A pointer or a finger drags a card onto a column; the
 * keyboard carries it — Space picks it up, the arrows carry it between and
 * along the columns, Space drops it and Escape puts it back, each step said
 * in a live region ("Public forms, picked up. Planned, 2 of 16.") — and the
 * card's own menu says "Move to ›" with every other column, the withheld
 * ones struck through with the reason. The card stays one stop for Tab, and
 * says how it moves. A board that wants the button back says `move: true`.
 *
 * WHAT IT SHOWS OF ITSELF (Roadmap f-lens-search-filter): `search` names the
 * fields its Find box looks in, and a board of more than `SEARCH_UNASKED`
 * cards shows the box unasked; `filters` stand as chips; `collapsed` columns
 * open shut, `hidden` ones are not drawn, and `cap` keeps each column to its
 * newest cards, with the way to the rest. Narrowed, a card moves as before.
 */
export interface ColumnsBindings {
  readonly [kind: string]: { readonly column: string };
}

export interface ColumnsOptions {
  readonly bindings: ColumnsBindings;
  /** The cards' order in each column: a field, or `{ by, direction }` (`label` is the name). As they were written, unsaid. */
  readonly sort?: GridSort;
  /** The fields its Find box looks in (`label` for the name). Given, the box stands however few cards there are. */
  readonly search?: readonly string[];
  /** What its line offers to filter by, its choice fields standing as chips. */
  readonly filters?: readonly string[];
  /** A Move button under each card. Off: a card moves by drag, by the keyboard and from its menu. */
  readonly move?: boolean;
  /** The columns, by value, that open shut: their heading and count, opened by a press. */
  readonly collapsed?: readonly string[];
  /** The newest cards each column keeps, with the way to the rest. */
  readonly cap?: number;
  /** The columns, by value, the board leaves off. A card can still be moved to one from its menu. */
  readonly hidden?: readonly string[];
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
  /** Each column's cards, how many it holds, and the records the kind's lifecycle keeps behind the horizon there (W-244). */
  readonly columns: readonly { readonly column: StatusColumn; readonly cards: readonly Card[]; readonly count: number; readonly past: readonly Card[] }[];
  /** Every column of the field, those left off included: where a card's menu may move it. */
  readonly all: readonly StatusColumn[];
  /** Each card's place in the graph's order: the higher, the newer. */
  readonly born: ReadonlyMap<string, number>;
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
.graview-columns-card[data-carried="true"] { outline: 2px solid var(--graview-accent); outline-offset: 2px; border-radius: 10px; opacity: 0.6; }
.graview-columns-slot { min-height: 2.25rem; display: flex; align-items: center; padding: 6px 10px; border-radius: 10px; border: 2px dashed var(--graview-accent); color: var(--graview-ink-muted); font-size: 0.8125rem; }
.graview-columns-toggle, .graview-columns-rest { font: inherit; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; text-align: left; }
.graview-columns-rest { justify-content: center; font-size: 0.8125rem; color: var(--graview-ink-muted); min-height: 28px; border-radius: 7px; border: 1px dashed var(--graview-edge); }
.graview-columns-toggle:focus-visible, .graview-columns-rest:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; }
.graview-columns-move { position: relative; z-index: ${LOCAL_LAYERS.raised}; display: flex; justify-content: flex-end; margin-top: 4px; }
.graview-columns-move[data-open="true"] { z-index: ${LOCAL_LAYERS.over}; }
.graview-columns-move > button, .graview-columns-menu button, .graview-columns-said button { font: inherit; font-size: 0.8125rem; min-height: 28px; padding: 2px 10px; border-radius: 7px; border: 1px solid var(--graview-edge); background: var(--graview-panel); color: var(--graview-ink); cursor: pointer; }
.graview-columns-move > button:focus-visible, .graview-columns-menu button:focus-visible, .graview-columns-said button:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; }
.graview-columns-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: ${LOCAL_LAYERS.over}; display: flex; flex-direction: column; gap: 4px; padding: 6px; min-width: 10rem; border-radius: 9px; border: 1px solid var(--graview-edge); background: var(--graview-panel); box-shadow: 0 6px 18px rgb(0 0 0 / 0.18); }
.graview-columns-menu button { text-align: left; }
.graview-columns-said { margin: 0 0 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--graview-ink); }
.graview-columns-said[data-tone="refused"] { color: var(--graview-warn); }
.graview-columns-card { position: relative; -webkit-touch-callout: none; }
.graview-columns-card .graview-choose-at { position: absolute; top: 6px; right: 6px; z-index: ${LOCAL_LAYERS.raised}; display: flex; }
[data-graview-choosable] { outline: none; }
@media (pointer: coarse) { [data-graview-choosable]:not([data-graview-choosing]) .graview-columns-card .graview-choose-at { display: none; } }
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
    const first = kinds[0];
    /*
     * IT ARRANGES ITS CARDS BEFORE IT DRAWS, as the board, the timeline, the
     * calendar and the coverage grid do. A shelter whose animals' stop is
     * "The floor" had no Filter on the scene at all (the eleventh walk): the
     * first bound kind's cards are filtered and sorted, the columns stay its
     * field's choices, and there is no grouping — the columns are the groups.
     */
    const subject = first === undefined ? [] : own.has(first) ? given.filter((node) => node.kind === first) : current(first);
    const { arranged, arrangement, bar } = useArranging<S>(props, {
      lensAllows: { group: false },
      subject: subject as unknown as readonly NodeOfSchema<S>[],
      ...(first === undefined ? {} : { kind: first }),
      // Find stands where the board names what it looks in, or once there are too many cards to look over.
      query: options.search !== undefined || subject.length > SEARCH_UNASKED,
      ...(options.search ? { search: options.search } : {}),
      ...(options.filters ? { filters: options.filters } : {}),
    });
    const kept = bar ? new Map(arranged.nodes.map((node, at) => [node.id, at])) : undefined;
    const keep = (kind: string, cards: readonly Card[]): readonly Card[] => {
      if (!kept || kind !== first) return cards;
      const still = cards.filter((card) => kept.has(card.id));
      return arrangement.sort === undefined ? still : [...still].sort((a, b) => kept.get(a.id)! - kept.get(b.id)!);
    };
    const boards: Board[] = kinds.map((kind) => {
      const field = options.bindings[kind]!.column;
      const columns = statusColumns(store.schema, kind, field);
      const read = (node: Card, key: string) => (key === "label" ? labelOf(store.schema.tryDefinition(node.kind), node) : node[key]);
      const drawn = keep(kind, sortForGrid(own.has(kind) ? given.filter((node) => node.kind === kind) : current(kind).slice(0, props.budget ?? Infinity), options.sort, read));
      // A count is how many this seat's board holds, not how many a thumbnail had room for.
      const every = current(kind);
      const all = own.has(kind) && !cut ? drawn : keep(kind, every);
      const hidden = new Set(options.hidden ?? []);
      /*
       * WHAT THE LIFECYCLE HIDES, SAID IN ITS COLUMN (W-244). A review
       * queue's "False trigger" column said "0 · Nothing here." over 2,500
       * detections retired by the kind's lifecycle, and a card moved there
       * left the board unsaid. Each column counts the records behind the
       * horizon in it — not on a picture with a budget, which has no
       * controls, nor while the line narrows what is drawn — and says "+N
       * past", as a district and a list do.
       */
      const definition = store.schema.tryDefinition(kind);
      const narrowing = Boolean(arrangement.query) || (arrangement.filter?.length ?? 0) > 0;
      const seen = new Set([...every, ...(own.has(kind) ? given.filter((node) => node.kind === kind) : [])].map((node) => node.id));
      const behind =
        definition?.lifecycle && props.budget === undefined && props.fidelity === "full" && !narrowing
          ? (store.graph.nodesOfKind(kind as never) as unknown as Card[]).filter((node) => !seen.has(node.id) && !isCurrent(definition, node as never))
          : [];
      return {
        kind,
        field,
        all: columns,
        born: new Map(every.map((node, at) => [node.id, at])),
        columns: columns
          .filter((column) => column.value === null || !hidden.has(column.value))
          .map((column) => ({
            column,
            cards: drawn.filter((node) => columnOf(node, field, columns) === column.value),
            count: all.filter((node) => columnOf(node, field, columns) === column.value).length,
            past: behind.filter((node) => columnOf(node, field, columns) === column.value),
          }))
          .filter((entry) => entry.column.value !== null || entry.count > 0 || entry.past.length > 0),
      };
    });
    const total = boards.reduce((sum, board) => sum + board.columns.reduce((n, entry) => n + entry.count, 0), 0);
    const title = props.label ?? "Board";

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
    const board = <ColumnsBoard boards={boards} title={title} options={options} />;
    const picture = bar ? (
      <div style={{ display: "grid", gap: 6 }}>
        {bar}
        {board}
      </div>
    ) : (
      board
    );
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

function ColumnsBoard({ boards, title, options }: { readonly boards: readonly Board[]; readonly title: string; readonly options: ColumnsOptions }) {
  const { store, principal } = useGraview<AnySchema>();
  const root = useRef<HTMLDivElement | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [dragging, setDragging] = useState<{ readonly id: string; readonly to: readonly string[] } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** The card the keyboard carries, and where to: a column and a place in it. */
  const [carry, setCarry] = useState<Carry | null>(null);
  /** What the board says as the keyboard carries a card, in its live region. */
  const [announced, announce] = useState("");
  /** The columns opened past their cap, and the ones shut (`collapsed`, then as pressed). */
  const [uncapped, setUncapped] = useState<ReadonlySet<string>>(() => new Set());
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set(options.collapsed ?? []));
  /** The columns whose records behind the horizon were asked for, by kind and value: drawn in them once "+N past" is pressed. */
  const [pastShown, setPastShown] = useState<ReadonlySet<string>>(() => new Set());
  /** The card whose Move button keeps the keyboard after it changes column, or the undo after a move. */
  const [focusing, setFocusing] = useState<string | null>(null);
  const how = useId();

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
  /*
   * SEVERAL CARDS AT ONCE (`choosing.ts`): a box at each card's corner,
   * Shift for a range in the board's reading order, Cmd/Ctrl-A for every
   * card, Escape to put them down, a long press on a phone — and the bar
   * moves or acts on them all as one change, with one undo.
   */
  const order = useMemo(() => boards.flatMap((board) => board.columns.flatMap((entry) => entry.cards.map((card) => card.id))), [boards]);
  const choosing = useChoosing(order);
  const choosable = useMemo(
    () =>
      store.permittedMutations(principal).some((mutation) => {
        const kinds = mutation.subject?.kinds as readonly string[] | "*" | undefined;
        return kinds !== undefined && (kinds === "*" || boards.some((board) => (kinds as readonly string[]).includes(board.kind)));
      }),
    [store, principal, boards],
  );
  const acted = (still: readonly string[]) => {
    choosing.choose(still);
    requestAnimationFrame(() => {
      const first = still[0] === undefined ? null : root.current?.querySelector<HTMLElement>(`[data-graview-choose-box="${CSS_ESCAPE(still[0])}"]`);
      (first ?? root.current)?.focus({ preventScroll: true });
    });
  };
  const movesOf = (card: Card, board: Board): readonly ColumnMove[] => columnMoves(store, principal, card, board.field, board.columns.map((entry) => entry.column));
  /** Where the keyboard goes back to on a card: its Move button where it has one, else the card itself. */
  const stopOf = (id: string) => (options.move ? `[data-columns-move="${CSS_ESCAPE(id)}"] > button` : `[data-graview-listed="${CSS_ESCAPE(id)}"] .graview-spec-item-link`);

  const move = (id: string, move: ColumnMove, label: string, from: "keyboard" | "drag" | "carry" | "menu") => {
    try {
      const result = store.apply(move.call, { author: principal });
      setSaid({ text: `Moved “${titleOf(id)}” to ${label}.`, tone: "moved", batch: result.batch, id });
      if (from === "keyboard") setFocusing(stopOf(id));
      if (from === "carry") setFocusing(`[data-graview-listed="${CSS_ESCAPE(id)}"] .graview-spec-item-link`);
      // From the menu, once it has closed and given the keyboard back to where the card was.
      if (from === "menu") settleOn(() => root.current?.querySelector<HTMLElement>(`[data-graview-listed="${CSS_ESCAPE(id)}"] .graview-spec-item-link`) ?? null);
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), tone: "refused" });
    }
  };
  const undo = () => {
    if (!said?.batch) return;
    try {
      store.undo(said.batch, { author: principal });
      setSaid({ text: `“${titleOf(said.id ?? "")}” is back where it was.`, tone: "moved" });
      if (said.id) setFocusing(stopOf(said.id));
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), tone: "refused" });
    }
  };

  /*
   * THE BOARD, AS A CARD'S MENU ASKS IT: every other column of the field —
   * the ones left off too — each the move this seat may make, or why not.
   */
  const latest = useRef({ move, boards, choosing, choosable });
  latest.current = { move, boards, choosing, choosable };
  useEffect(() => {
    const kinds = [...new Set(boards.map((board) => board.kind))];
    const held = kinds.map((kind) =>
      holdBoard({
        store,
        kind,
        root: () => root.current,
        section: (id: string, seat: Principal) => {
          const board = latest.current.boards.find((one) => one.kind === kind);
          const card = store.graph.getNode(id) as Card | undefined;
          if (!board || !card) return null;
          const choices = columnChoices(store, seat, card, board.field, board.all).map(
            (choice): MoveChoice => ({
              to: choice.to,
              label: choice.label,
              ...(choice.why !== undefined ? { why: choice.why } : {}),
              ...(choice.move ? { run: () => latest.current.move(id, choice.move!, choice.label, "menu") } : {}),
            }),
          );
          /*
           * CHOOSING SEVERAL BEGINS HERE ON A PHONE (FR-189), where a resting
           * finger opens this menu rather than choosing the card, and the
           * boxes stand only once something is chosen.
           */
          const { choosing: chooser, choosable: may } = latest.current;
          const choose = may && chooser.chosen.length === 0 && typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? () => chooser.toggle(id) : undefined;
          if (choices.length === 0 && !choose) return null;
          return {
            id: "move-to",
            at: "start",
            render: (close) => (
              <>
                {choices.length > 0 ? <MoveTo choices={choices} close={close} /> : null}
                {choose ? <ChooseSeveral choose={choose} close={close} /> : null}
              </>
            ),
          };
        },
      }),
    );
    return () => held.forEach((release) => release());
  }, [store, boards]);

  /*
   * CARRIED BY THE KEYBOARD. Space on a card picks it up; Left and Right
   * carry it to the next column it may go to, Up and Down along the column;
   * Space (or Enter) drops it — the act — and Escape puts it back. Each step
   * is said: the card picked up, the column and the place in it.
   */
  const columnWords = (board: Board, value: string | null) => board.all.find((column) => column.value === value)?.label ?? board.columns.find((entry) => entry.column.value === value)?.column.label ?? String(value);
  const othersIn = (board: Board, value: string | null, id: string) => board.columns.find((entry) => entry.column.value === value)?.cards.filter((card) => card.id !== id) ?? [];
  const placeWords = (board: Board, value: string | null, at: number, id: string) => {
    const of = othersIn(board, value, id).length + 1;
    return `${columnWords(board, value)}, ${Math.min(at, of - 1) + 1} of ${of}.`;
  };
  const carryKey = (event: KeyboardEvent<HTMLLIElement>, card: Card, board: Board, moves: readonly ColumnMove[]) => {
    const label = titleOf(card.id);
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (carry?.id !== card.id) {
      // Picked up from the card itself — its link, its one stop — never from a box or a button on it.
      if (event.key !== " " || moves.length === 0 || !(event.target instanceof HTMLElement) || !event.target.classList.contains("graview-spec-item-link")) return;
      handled();
      const from = columnOf(card, board.field, board.all);
      const at = Math.max(0, board.columns.find((entry) => entry.column.value === from)?.cards.findIndex((one) => one.id === card.id) ?? 0);
      setCarry({ id: card.id, from, to: from, at });
      announce(`${label}, picked up. ${placeWords(board, from, at, card.id)} Arrow keys move it, Space drops it, Escape puts it back.`);
      return;
    }
    const reach = board.columns.map((entry) => entry.column.value).filter((value) => value === carry.from || moves.some((one) => one.to === value));
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      handled();
      const next = reach[reach.indexOf(carry.to) + (event.key === "ArrowLeft" ? -1 : 1)];
      if (next === undefined) return announce(`No column further ${event.key === "ArrowLeft" ? "left" : "right"} takes ${label}. ${placeWords(board, carry.to, carry.at, card.id)}`);
      const at = Math.min(carry.at, othersIn(board, next, card.id).length);
      setCarry({ ...carry, to: next, at });
      return announce(placeWords(board, next, at, card.id));
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      handled();
      const at = Math.max(0, Math.min(othersIn(board, carry.to, card.id).length, carry.at + (event.key === "ArrowUp" ? -1 : 1)));
      setCarry({ ...carry, at });
      return announce(placeWords(board, carry.to, at, card.id));
    }
    if (event.key === " " || event.key === "Enter") {
      handled();
      setCarry(null);
      const found = carry.to === carry.from ? undefined : moves.find((one) => one.to === carry.to);
      if (!found) return announce(`${label}, dropped back in ${columnWords(board, carry.from)}.`);
      announce(`${label}, dropped in ${columnWords(board, carry.to)}.`);
      return move(card.id, found, columnWords(board, carry.to), "carry");
    }
    if (event.key === "Escape") {
      handled();
      setCarry(null);
      return announce(`${label}, put back in ${columnWords(board, carry.from)}.`);
    }
  };
  const putBack = (id: string) => {
    if (carry?.id !== id) return;
    const board = boards.find((one) => one.kind === store.graph.getNode(id)?.kind);
    setCarry(null);
    if (board) announce(`${titleOf(id)}, put back in ${columnWords(board, carry.from)}.`);
  };

  return (
    <div
      data-testid="columns-lens"
      {...(choosable ? { ...choosing.listProps, tabIndex: -1, role: "group", "aria-label": choosing.chosen.length > 0 ? `${title}, ${choosing.chosen.length} chosen` : title, "data-graview-choosable": "" } : {})}
      ref={(element: HTMLDivElement | null) => {
        root.current = element;
        choosing.list.current = element;
      }}
    >
      <style>{BOARD_CSS}</style>
      {choosable ? <style>{CHOOSING_CSS}</style> : null}
      <p className="graview-columns-said" role="status" data-tone={said?.tone} data-testid="columns-said" style={said ? undefined : { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {said ? <span>{said.text}</span> : null}
        {said?.batch ? (
          <button type="button" data-testid="columns-undo" onClick={undo}>
            Undo
          </button>
        ) : null}
      </p>
      {/* What the keyboard's carrying says, step by step: heard, never seen. */}
      <p aria-live="assertive" data-testid="columns-announce" style={VISUALLY_HIDDEN}>
        {announced}
      </p>
      <span id={how} hidden>
        Space picks it up; the arrow keys carry it between and along the columns; Space drops it and Escape puts it back. Its menu moves it too.
      </span>
      {boards.map((board) => (
        <section key={board.kind} data-columns-kind={board.kind} data-columns-field={board.field} aria-label={`${pluralLabel(store.schema, board.kind)} by ${board.field}`}>
          <div className="graview-columns">
            {board.columns.map(({ column, cards: current, count: currentCount, past }) => {
              const value = column.value ?? "";
              const pastKey = `${board.kind}\u0000${value}`;
              const withPast = past.length > 0 && pastShown.has(pastKey);
              const cards = withPast ? [...current, ...past] : current;
              const count = withPast ? currentCount + past.length : currentCount;
              const pastUnsaid = past.length > 0 && !withPast ? past.length : 0;
              const droppable = (dragging !== null && column.value !== null && dragging.to.includes(column.value)) || (carry !== null && carry.to !== carry.from && carry.to === column.value && board.columns.some((entry) => entry.cards.some((card) => card.id === carry.id)));
              const collapsible = column.value !== null && (options.collapsed ?? []).includes(column.value);
              const closed = collapsible && shut.has(value);
              // Kept to its newest, where the board says how many and the column has not been opened past it.
              const capped = options.cap !== undefined && !uncapped.has(value) && cards.length > options.cap;
              const newest = capped ? new Set([...cards].sort((a, b) => (board.born.get(b.id) ?? 0) - (board.born.get(a.id) ?? 0)).slice(0, options.cap).map((card) => card.id)) : null;
              const shown = newest ? cards.filter((card) => newest.has(card.id) || card.id === carry?.id) : cards;
              const carriedHere = carry !== null && carry.to === column.value && carry.to !== carry.from && board.columns.some((entry) => entry.cards.some((card) => card.id === carry.id));
              const heading = (
                <>
                  <span>{column.label}</span>
                  <span className="graview-columns-count" data-testid="columns-count">
                    {count}
                  </span>
                </>
              );
              return (
                <section
                  key={value}
                  className="graview-columns-column"
                  data-graview-column={value}
                  // What the context menu reads under the cursor (`data-column`, as a worker view marks one): "Add a task in Doing", "Show only Doing".
                  {...(column.value !== null ? { "data-column": `${board.field}:${column.value}`, "data-column-kind": board.kind, "data-column-label": column.label } : {})}
                  data-droppable={droppable || undefined}
                  data-over={(droppable && (over === value || carriedHere)) || undefined}
                  // The lens first (FR-109): a phone's screen reader says a region by its name alone, and "Researching, 0" does not say which board — nor does the app's name, so an embed leaves this one as it is.
                  aria-label={`${title} · ${column.label}, ${count}${pastUnsaid > 0 ? `, ${numberAsRead(pastUnsaid)} past` : ""}`}
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
                    {collapsible ? (
                      <button type="button" className="graview-columns-toggle" aria-expanded={!closed} data-testid="columns-toggle" onClick={() => setShut((was) => (was.has(value) ? new Set([...was].filter((one) => one !== value)) : new Set([...was, value])))}>
                        {heading}
                      </button>
                    ) : (
                      heading
                    )}
                  </h3>
                  {closed ? null : shown.length === 0 && !carriedHere ? (
                    pastUnsaid > 0 ? null : <p className="graview-columns-empty">Nothing here.</p>
                  ) : (
                    <ul className="graview-columns-cards">
                      {/* The column says the card's state; the card does not say it again (FR-117). */}
                      <SaidAround.Provider value={column.value === null ? null : { field: board.field, values: [column.value, column.label] }}>
                        {(() => {
                          const drawn = shown.map((card) => {
                            const moves = movesOf(card, board);
                            return (
                              <ColumnCard
                                key={card.id}
                                card={card}
                                moves={moves}
                                button={options.move === true}
                                carried={carry?.id === card.id}
                                {...(moves.length > 0 ? { describedBy: how } : {})}
                                {...(choosable ? { choosing } : {})}
                                labelOf={(to) => columnWords(board, to)}
                                onMove={(found, label) => move(card.id, found, label, "keyboard")}
                                onDrag={(on) => setDragging(on ? { id: card.id, to: moves.map((one) => one.to) } : null)}
                                onCarryKey={(event) => carryKey(event, card, board, moves)}
                                onLeave={() => putBack(card.id)}
                              />
                            );
                          });
                          if (!carriedHere) return drawn;
                          // Where the carried card would land, held open in the column it is carried to.
                          const slot = (
                            <li key="graview-carried-slot" className="graview-columns-slot" data-testid="columns-slot" aria-hidden="true">
                              {titleOf(carry.id)}
                            </li>
                          );
                          return [...drawn.slice(0, carry.at), slot, ...drawn.slice(carry.at)];
                        })()}
                      </SaidAround.Provider>
                    </ul>
                  )}
                  {!closed && pastUnsaid > 0 ? (
                    <button
                      type="button"
                      className="graview-columns-rest"
                      data-testid="columns-past"
                      title={`${numberAsRead(pastUnsaid)} more behind the horizon — press to show them here`}
                      onClick={() => setPastShown((was) => new Set([...was, pastKey]))}
                    >
                      +{numberAsRead(pastUnsaid)} past
                    </button>
                  ) : null}
                  {!closed && capped ? (
                    <button type="button" className="graview-columns-rest" data-testid="columns-rest" onClick={() => setUncapped((was) => new Set([...was, value]))}>
                      Show {cards.length - shown.length} more
                    </button>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      ))}
      {choosable ? (
        <SeveralBarDoor
          store={store}
          chosen={choosing.chosen}
          principal={principal}
          anchor={() => root.current?.closest<HTMLElement>('[data-testid="kind-stop"], [data-embed-content]') ?? null}
          of={order.length}
          onChooseAll={() => choosing.choose(order)}
          onClear={choosing.clear}
          onActed={acted}
        />
      ) : null}
    </div>
  );
}

/** A card the keyboard carries: where it came from, the column it is carried to, and its place there. */
interface Carry {
  readonly id: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly at: number;
}

const CSS_ESCAPE = (id: string) => (typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(id) : id.replace(/["\\]/g, "\\$&"));

/** Puts the keyboard on what `find` finds once the frames after a menu closes have settled, unless something else took it. */
function settleOn(find: () => HTMLElement | null) {
  let frames = 0;
  const land = () => {
    const target = find();
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (target && active !== target && (active === null || active === document.body || active.closest("[data-graview-menu-home], [data-graview-page-title], h1, main") !== null || !active.isConnected)) target.focus({ preventScroll: true });
    if (++frames < 6) requestAnimationFrame(land);
  };
  requestAnimationFrame(land);
}

function ColumnCard({
  card,
  moves,
  button: withButton,
  carried,
  describedBy,
  labelOf: columnLabel,
  onMove,
  onDrag,
  onCarryKey,
  onLeave,
  choosing,
}: {
  readonly choosing?: Choosing;
  readonly card: Card;
  readonly moves: readonly ColumnMove[];
  /** Whether a Move button stands under it (`options.move`). */
  readonly button: boolean;
  readonly carried: boolean;
  /** The words that say how it moves, for the card's one stop. */
  readonly describedBy?: string;
  readonly labelOf: (to: string) => string;
  readonly onMove: (move: ColumnMove, label: string) => void;
  readonly onDrag: (on: boolean) => void;
  readonly onCarryKey: (event: KeyboardEvent<HTMLLIElement>) => void;
  readonly onLeave: () => void;
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
      data-carried={carried || undefined}
      /*
       * A FINGER RESTING ON A CARD OPENS ITS MENU (FR-189): Move to ›, its
       * acts, Open — on a phone the only way to move one card, since the
       * board has no Move button. Only while several are being chosen is a
       * card a row the long press and a tap choose; its menu begins that.
       */
      {...(choosing && choosing.chosen.length > 0 ? { "data-graview-choose": card.id } : {})}
      draggable={moves.length > 0 || undefined}
      onKeyDown={onCarryKey}
      // A press of Space a button would take as a click is the carrying's, not the button's.
      onKeyUp={(event) => {
        if (event.key === " " && event.target instanceof HTMLElement && event.target.classList.contains("graview-spec-item-link")) event.preventDefault();
      }}
      onBlur={(event) => {
        if (carried && !event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
      }}
      onDragStart={(event) => {
        if (moves.length === 0) return;
        // A node, named in a type only the board and the calendar read: dropped anywhere else, it moves nothing.
        event.dataTransfer.setData("text/graview-node", card.id);
        event.dataTransfer.effectAllowed = "move";
        onDrag(true);
      }}
      onDragEnd={() => onDrag(false)}
    >
      {/* The link first, and the card's own title not said again (`NamedByItsLink`): a reader hears the name once, then the rest. */}
      <ListedLink node={card} label={label} {...(describedBy ? { describedBy } : {})} />
      {View ? (
        // A card on the board is a card as the scene draws it, on either face.
        <ViewModeProvider mode="scene">
          <NamedByItsLink.Provider value={label}>
            <View node={card as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
          </NamedByItsLink.Provider>
        </ViewModeProvider>
      ) : (
        <span className="graview-spec-item-name" aria-hidden="true">
          {label}
        </span>
      )}
      {choosing ? (
        <span className="graview-choose-at">
          <input {...choosing.boxProps(card.id, label)} onPointerEnter={prefetchSeveral} onFocus={prefetchSeveral} />
        </span>
      ) : null}
      {withButton && moves.length > 0 ? (
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
