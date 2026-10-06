import { createViews, useGraview, type ViewComponent, type ViewProps } from "@graview/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chip,
  Connections,
  EditableTitle,
  Fields,
  Panel,
  Roster,
  hueFor,
  registerDeclaredLenses,
  registerDefaultViews,
} from "@graview/primitives";
import { todoApp } from "../domain/app.js";
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
  const node = props.node as ListNode | undefined;
  if (!node) return null;
  const tasks = store.graph.out(node.id, "holds") as TaskNode[];
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
        <span style={{ fontSize: "0.78125rem", color: "var(--graview-ink-faint)" }}>
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
          const tasks = store.graph.out(list.id, "holds") as TaskNode[];
          const open = tasks.filter((task) => !task.done);
          const done = tasks.length - open.length;
          return (
            <section key={list.id} style={{ display: "grid", gap: 8, minWidth: 0 }}>
              {/*
                * A DIV, not a `<header>`. It is a control — clicking it
                * selects the list — and a landmark may not be one: the
                * framework stamps `role="button"` on a pick target, ARIA
                * forbids that role on a sectioning header, and axe reported
                * three of them on this app's first screen. A heading that
                * you press is a button that contains a heading.
                */}
              <div
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
                <strong style={{ fontSize: "0.84375rem", fontWeight: 580 }}>{list.label}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.6875rem",
                    color: "var(--graview-ink-faint)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {open.length === 0 ? "clear" : `${open.length} left`}
                </span>
              </div>

              {tasks.length === 0 ? (
                <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
                  Nothing on this one yet.
                </span>
              ) : null}

              {/* One track no wider than the column: a row's unbroken label would otherwise set the column's floor, and three columns at a phone's width overlapped. */}
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 5 }}>
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
                        fontSize: "0.78125rem",
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
                            fontSize: "0.6875rem",
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
                <span style={{ fontSize: "0.6875rem", color: "var(--graview-ink-faint)" }}>
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
 * WHAT IS LEFT, DRAWN — the one picture here that is not boxes.
 *
 * The week and the month lay tasks out; this one plots them. How much is
 * still to do, day by day, from the first thing due to the last: a shape
 * you read at a glance and cannot get from a list, and a shape made of
 * strokes rather than of elements. It exists as much to keep the routed
 * face honest as to answer the question — a page is allowed whatever the
 * picture needs, HTML and canvas both, and a claim with nothing standing on
 * it rots.
 *
 * The canvas is sized from the box it is given rather than from a constant,
 * because the same picture has to work in a card, on a page, and on a
 * phone; and it is drawn at the device's own pixel ratio, because a line
 * drawn at CSS resolution on a retina screen is the one thing that makes a
 * canvas look cheap beside the DOM around it.
 */
function BurndownView({ nodes }: ViewProps<S, "task">) {
  const surface = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = holder.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (rect) setBox({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    watch.observe(host);
    return () => watch.disconnect();
  }, []);

  /** One point per day that has anything due, and how much is still open on it. */
  const trail = useMemo(() => {
    const dated = (nodes ?? [])
      .map((node) => node as TaskNode)
      .filter((task) => task.due !== undefined)
      .sort((a, b) => String(a.due).localeCompare(String(b.due)));
    const days = [...new Set(dated.map((task) => String(task.due)))];
    return days.map((day) => ({
      day,
      left: dated.filter((task) => !task.done && String(task.due) >= day).length,
    }));
  }, [nodes]);

  useEffect(() => {
    const canvas = surface.current;
    if (!canvas || !box || box.width <= 0) return;
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const ink = canvas.getContext("2d");
    // A browser that will not give a context is a browser that reads the
    // list below instead. Nothing here is the only way to the facts.
    if (!ink) return;
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    ink.clearRect(0, 0, box.width, box.height);
    if (trail.length < 2) return;

    const pad = { left: 28, right: 12, top: 12, bottom: 22 };
    const wide = box.width - pad.left - pad.right;
    const tall = box.height - pad.top - pad.bottom;
    const peak = Math.max(1, ...trail.map((point) => point.left));
    const style = getComputedStyle(canvas);
    const line = style.getPropertyValue("--graview-accent").trim() || "#555";
    const faint = style.getPropertyValue("--graview-edge").trim() || "#ddd";
    const at = (index: number, left: number) => ({
      x: pad.left + (wide * index) / (trail.length - 1),
      y: pad.top + tall - (tall * left) / peak,
    });

    ink.strokeStyle = faint;
    ink.lineWidth = 1;
    for (let step = 0; step <= 2; step += 1) {
      const y = pad.top + (tall * step) / 2;
      ink.beginPath();
      ink.moveTo(pad.left, y);
      ink.lineTo(pad.left + wide, y);
      ink.stroke();
    }

    ink.strokeStyle = line;
    ink.lineWidth = 2;
    ink.lineJoin = "round";
    ink.beginPath();
    trail.forEach((point, index) => {
      const spot = at(index, point.left);
      if (index === 0) ink.moveTo(spot.x, spot.y);
      else ink.lineTo(spot.x, spot.y);
    });
    ink.stroke();

    ink.fillStyle = line;
    for (const [index, point] of trail.entries()) {
      const spot = at(index, point.left);
      ink.beginPath();
      ink.arc(spot.x, spot.y, 2.5, 0, Math.PI * 2);
      ink.fill();
    }
  }, [trail, box]);

  const peak = Math.max(0, ...trail.map((point) => point.left));
  return (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", gap: 8, minWidth: 0, padding: 12 }}>
      <div ref={holder} style={{ position: "relative", minHeight: 140, minWidth: 0 }}>
        <canvas
          ref={surface}
          data-testid="burndown-canvas"
          role="img"
          aria-label={
            trail.length < 2
              ? "Nothing with a date yet."
              : `What is left, from ${trail[0]!.day} to ${trail[trail.length - 1]!.day}: ${peak} at the most.`
          }
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        />
      </div>
      {/*
        * THE SAME FACTS IN THE DOCUMENT. A canvas says nothing to a screen
        * reader, to a search engine, or to a browser that could not start
        * it — and a routed page is exactly where all three turn up.
        */}
      <ol data-testid="burndown-days" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12.5, color: "var(--graview-ink-muted)" }}>
        {trail.map((point) => (
          <li key={point.day}>
            {point.day}: {point.left} left
          </li>
        ))}
      </ol>
    </div>
  );
}

export function todoViews() {
  const registry = registerDefaultViews(todoSchema, createViews(todoSchema));
  const own = registry
    .register("task", { cardinality: "one", fidelity: "full" }, TaskView)
    .register("task", { cardinality: "one", fidelity: "summary" }, TaskView)
    .register("task", { cardinality: "one", fidelity: "glyph" }, TaskView)
    .register("list", { cardinality: "one", fidelity: "full" }, OneListView)
    .register("list", { cardinality: "one", fidelity: "summary" }, OneListView)
    .register("list", { cardinality: "one", fidelity: "glyph" }, OneListView)
    // Titled, so "The lists" is a place on the bar like the week and the
    // month — three pictures, one switcher, and it is the framework's.
    .register("list", { cardinality: "many", fidelity: "full" }, ListsView, { title: "The lists" })
    .register("list", { cardinality: "many", fidelity: "summary" }, ListsView, { title: "The lists" })
    /*
     * And a third that is DRAWN rather than laid out: see `BurndownView`.
     * A place like any other — the bar lists it, the routed face gives it a
     * page — which is the whole claim, that a page carries what the picture
     * needs and not only what the DOM can express.
     */
    .register("task", { cardinality: "many", fidelity: "full" }, BurndownView, { title: "What is left" })
    .register("task", { cardinality: "many", fidelity: "summary" }, BurndownView, { title: "What is left" });
  /*
   * THE WEEK, THE MONTH AND WHO MAY DO WHAT are not registered here: the
   * declaration names them (`lenses` in domain/app.ts) and the framework
   * draws each as a place. Laid over last, so the week — declared last —
   * is what the tasks' district draws when an address names no picture.
   */
  return registerDeclaredLenses(own, todoApp);
}

