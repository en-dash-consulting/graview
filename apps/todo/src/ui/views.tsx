import { createViews, useGraview, type ViewComponent, type ViewProps } from "@graview/react";
import {
  Chip,
  Connections,
  EditableTitle,
  Fields,
  Panel,
  Roster,
  createTimelineLens,
  hueFor,
  registerDefaultViews,
} from "@graview/primitives";
import { todoSchema, type TodoSchema } from "../domain/schema.js";

type S = TodoSchema;
type ListNode = { id: string; label: string; order: number };
type TaskNode = { id: string; label: string; done: boolean; due?: string };

/**
 * How little an app has to write.
 *
 * `registerDefaultViews` already renders every kind at all three fidelities
 * from the declarations alone — a task, a list, a rule and a reason all have a
 * card, a page and a chip before this file does anything. What follows is the
 * two places where the generic answer is genuinely worse than a specific one,
 * and nothing else.
 */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * The week, through the household example's calendar lens — unchanged.
 *
 * The lens knows nothing about tasks. It asks for a start, an end and a
 * column; this app answers with a due date, a due date plus an estimate, and
 * the weekday that date falls on. That is the whole integration, and it is the
 * framework's central claim shown in the smallest app rather than only in the
 * ones built to prove it.
 */
export const weekLens = createTimelineLens<S>({
  bindings: { task: { start: "plannedAt", end: "plannedUntil", column: "day" } },
  columns: DAYS.map((id) => ({ id, label: id.toUpperCase() })),
  extent: 1440,
  format: (at) => `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`,
});

/** A task: the one card where "done" has to be visible without reading. */
function TaskView({ node, fidelity, selected, mode, flagged }: ViewProps<S, "task">) {
  if (!node) return null;
  const broken = flagged?.includes(node.id) ?? false;
  const done = node.done;

  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${done ? "✓ " : ""}${node.label}`}
        hue={hueFor("task")}
        selected={selected}
        title={done ? "Done" : node.due ? `Due ${node.due}` : "No date"}
      />
    );
  }

  return (
    <Panel
      title={
        fidelity === "full" ? (
          <EditableTitle<S> nodeId={node.id}>{node.label}</EditableTitle>
        ) : (
          node.label
        )
      }
      // A bare date in the corner is a mystery number. Say what it is.
      meta={done ? "done" : node.due ? `due ${node.due}` : undefined}
      selected={selected}
      tone={broken ? "warning" : done ? "muted" : "default"}
      variant={mode === "fullscreen" ? "page" : "card"}
      // The strike-through is the whole visual language of a todo list, and it
      // has to survive at every fidelity or a finished task reads as an open
      // one from across the room.
      style={done ? { textDecoration: "line-through", opacity: 0.72 } : undefined}
      fit
    >
      {fidelity === "full" ? (
        <Fields<S> id={node.id} shown={[node.label, node.due]} />
      ) : null}
      {fidelity === "full" ? (
        <Connections id={node.id} empty="Nothing waits on this, and it waits for nothing." />
      ) : null}
    </Panel>
  );
}

/**
 * One list, on its own.
 *
 * Reached by travelling to a list, or drawn beside a task as the list it is
 * on. The generic card would show its fields — and a list's only field besides
 * its name is an ordering key, which the declaration hides, so the generic
 * answer is an empty box with a title. What a list IS, from outside, is how
 * much is left on it.
 */
const OneListView = ((props: ViewProps<S>) => {
  const { store } = useGraview<S>();
  const node = props.node as unknown as ListNode | undefined;
  if (!node) return null;
  const tasks = store.graph.out(node.id, "holds") as unknown as TaskNode[];
  const open = tasks.filter((task) => !task.done);

  if (props.fidelity === "glyph") {
    return (
      <Chip
        label={`${node.label} · ${open.length}`}
        hue={hueFor("list")}
        selected={props.selected}
      />
    );
  }
  return (
    <Panel
      title={
        props.fidelity === "full" ? (
          <EditableTitle<S> nodeId={node.id}>{node.label}</EditableTitle>
        ) : (
          node.label
        )
      }
      meta={open.length === 0 ? "clear" : `${open.length} left`}
      selected={props.selected}
      variant={props.mode === "fullscreen" ? "page" : "card"}
      fit
    >
      {open.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--graview-ink-faint)" }}>
          Nothing left on this one.
        </span>
      ) : (
        <Roster
          pick
          max={props.fidelity === "full" ? 12 : 5}
          items={open.map((task) => ({ id: task.id, label: task.label, hue: hueFor("task") }))}
        />
      )}
    </Panel>
  );
}) as ViewComponent<S>;

/**
 * The lists, side by side, each with what is left on it.
 *
 * The home screen of every todo app ever made, and the shape is not an
 * accident: the question is "what should I do next", and the answer is
 * comparative — you look across the columns rather than down one.
 *
 * Everything here is a `data-graview-pick` target, which is the whole
 * contract: one click selects a task in place and offers its verbs, a double
 * click opens it, and neither needed a handler written here.
 */
const ListsView = ((props: ViewProps<S>) => {
  const { store } = useGraview<S>();
  const lists = [...((props.nodes ?? []) as unknown as ListNode[])].sort(
    (a, b) => a.order - b.order,
  );
  const lit = new Set(props.implicated ?? []);
  const broken = new Set(props.flagged ?? []);

  return (
    <Panel
      title={props.label ?? "Lists"}
      meta={`${lists.length} lists`}
      selected={props.selected}
      variant={props.mode === "fullscreen" ? "page" : "card"}
      // Hugging its content: three short columns in a panel that fills the
      // whole focus band leaves four hundred pixels of nothing under them.
      fit
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, lists.length)}, minmax(0, 1fr))`,
          gap: 18,
          alignItems: "start",
          minHeight: 0,
        }}
      >
        {lists.map((list) => {
          const tasks = store.graph.out(list.id, "holds") as unknown as TaskNode[];
          const open = tasks.filter((task) => !task.done);
          const done = tasks.length - open.length;
          return (
            <section key={list.id} style={{ display: "grid", gap: 8, minWidth: 0 }}>
              <header
                data-graview-pick={list.id}
                /*
                 * The tasks under it said what a selection lit; the list's own
                 * header only painted it — so twelve of this view's fifteen
                 * marks made a claim the tree could be asked about and three
                 * did not. Within one picture it is all of them or none.
                 */
                data-graview-emphasis={
                  lit.size === 0 ? "plain" : lit.has(list.id) ? "lit" : "dimmed"
                }
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  paddingBottom: 6,
                  borderBottom: "1px solid var(--graview-edge)",
                  cursor: "pointer",
                }}
              >
                <strong style={{ fontSize: 13.5, fontWeight: 580 }}>{list.label}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: "var(--graview-ink-faint)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {open.length === 0 ? "clear" : `${open.length} left`}
                </span>
              </header>

              {tasks.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--graview-ink-faint)" }}>
                  Nothing on this one yet.
                </span>
              ) : null}

              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 5 }}>
                {[...open, ...tasks.filter((task) => task.done)].map((task) => (
                  <li key={task.id}>
                    <div
                      data-graview-pick={task.id}
                      data-graview-emphasis={
                        lit.size === 0 ? "plain" : lit.has(task.id) ? "lit" : "dimmed"
                      }
                      title={task.due ? `Due ${task.due}` : "No date"}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        padding: "5px 9px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12.5,
                        border: `1px solid ${
                          broken.has(task.id) ? "var(--graview-warn)" : "var(--graview-edge)"
                        }`,
                        background: "var(--graview-panel-muted)",
                        opacity: task.done ? 0.5 : lit.size > 0 && !lit.has(task.id) ? 0.55 : 1,
                      }}
                    >
                      {/* The box is the visual language of the thing. It is
                          not a control: clicking anywhere on the row selects
                          the task, and finishing it is a named mutation in
                          the strip like every other change. */}
                      <span
                        aria-hidden="true"
                        style={{
                          width: 12,
                          height: 12,
                          flex: "0 0 auto",
                          borderRadius: 3,
                          border: `1.5px solid ${
                            task.done ? "var(--graview-accent)" : "var(--graview-edge-bright)"
                          }`,
                          background: task.done ? "var(--graview-accent)" : "transparent",
                          transform: "translateY(1px)",
                        }}
                      />
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textDecoration: task.done ? "line-through" : undefined,
                        }}
                      >
                        {task.label}
                      </span>
                      {task.due && !task.done ? (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            whiteSpace: "nowrap",
                            color: broken.has(task.id)
                              ? "var(--graview-warn)"
                              : "var(--graview-ink-faint)",
                          }}
                        >
                          {task.due.slice(5)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {done > 0 ? (
                <span style={{ fontSize: 11, color: "var(--graview-ink-faint)" }}>
                  {done} done
                </span>
              ) : null}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}) as ViewComponent<S>;

/**
 * The week, from the lens, with a name a person would use.
 *
 * "Tasks" is the schema's plural machinery showing through; the thing on
 * screen is the week ahead.
 */
const WeekView = ((props: ViewProps<S>) => (
  <weekLens.View {...props} label="The week ahead" />
)) as ViewComponent<S>;

export function todoViews() {
  const registry = registerDefaultViews(todoSchema, createViews(todoSchema));
  return registry
    .register("task", { cardinality: "one", fidelity: "full" }, TaskView)
    .register("task", { cardinality: "one", fidelity: "summary" }, TaskView)
    .register("task", { cardinality: "one", fidelity: "glyph" }, TaskView)
    .register("list", { cardinality: "one", fidelity: "full" }, OneListView)
    .register("list", { cardinality: "one", fidelity: "summary" }, OneListView)
    .register("list", { cardinality: "one", fidelity: "glyph" }, OneListView)
    .register("list", { cardinality: "many", fidelity: "full" }, ListsView)
    .register("list", { cardinality: "many", fidelity: "summary" }, ListsView)
    // The week, for a group of tasks. The lens supplies the picture.
    .register("task", { cardinality: "many", fidelity: "full" }, WeekView)
    .register("task", { cardinality: "many", fidelity: "summary" }, WeekView);
}

