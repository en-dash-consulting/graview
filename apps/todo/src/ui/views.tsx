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
import { labelsThatFit, whatIsLeft } from "./what-is-left.js";

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
 * Reached by traveling to a list, or drawn beside a task as the list it is
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
          // Side by side where each list has room for its names; stacked where it would not (a phone), never three slivers of dates.
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 12rem), 1fr))`,
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
  /* The scheme changes the ink, and a canvas does not repaint itself when it does. */
  const [scheme, setScheme] = useState<string | undefined>(undefined);

  /** One point per day that has anything due, and how much is still open on it or after it. */
  const left = useMemo(() => whatIsLeft((nodes ?? []).map((node) => node as TaskNode)), [nodes]);
  const drawn = left.days.length >= 2 && left.peak > 0;

  useEffect(() => {
    const host = holder.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (rect) setBox({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    watch.observe(host);
    return () => watch.disconnect();
  }, [drawn]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const root = document.documentElement;
    const watch = new MutationObserver(() => setScheme(root.dataset["graviewScheme"]));
    watch.observe(root, { attributes: true, attributeFilter: ["data-graview-scheme"] });
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const canvas = surface.current;
    if (!canvas || !box || box.width <= 0 || !drawn) return;
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const ink = canvas.getContext("2d");
    // A browser that will not give a context is a browser that reads the
    // words and the list instead. Nothing here is the only way to the facts.
    if (!ink) return;
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    ink.clearRect(0, 0, box.width, box.height);

    const style = getComputedStyle(canvas);
    const token = (name: string, otherwise: string) => style.getPropertyValue(name).trim() || otherwise;
    const line = token("--graview-accent", "#555");
    const rule = token("--graview-edge", "#ddd");
    const muted = token("--graview-ink-muted", "#777");
    ink.font = `11px ${token("--graview-font-body", "system-ui, sans-serif")}`;
    ink.textBaseline = "middle";

    /*
     * THE SCALE IS TWO NUMBERS: none left, and the most there ever was.
     * The room on the left is as wide as the wider of them, and the room
     * on each side as wide as half a day's label, so the first and the
     * last day sit under their points without running off the canvas.
     */
    const scaleWidth = Math.max(ink.measureText(String(left.peak)).width, ink.measureText("0").width);
    const widths = left.days.map((point) => ink.measureText(point.said).width);
    const pad = {
      left: Math.max(scaleWidth + 10, widths[0]! / 2 + 2),
      right: Math.max(8, widths[widths.length - 1]! / 2 + 2),
      top: 8,
      bottom: 24,
    };
    const wide = box.width - pad.left - pad.right;
    const tall = box.height - pad.top - pad.bottom;
    if (wide <= 0 || tall <= 0) return;
    /*
     * A DAY STANDS WHERE IT FALLS, not at the next even step: four days
     * between 28 Aug and 1 Sep are four days wide, and a day after the
     * last due one is room the line needs for its last step down.
     */
    const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;
    const start = dayNumber(left.days[0]!.day);
    const span = Math.max(1, dayNumber(left.days[left.days.length - 1]!.day) - start);
    const xOfDay = (offset: number) => pad.left + (wide * offset) / span;
    const xOf = (index: number) => xOfDay(dayNumber(left.days[index]!.day) - start);
    const yOf = (count: number) => pad.top + tall - (tall * count) / left.peak;

    // The two rules the scale stands on, and their numbers.
    ink.strokeStyle = rule;
    ink.lineWidth = 1;
    ink.fillStyle = muted;
    ink.textAlign = "right";
    for (const count of [0, left.peak]) {
      const y = Math.round(yOf(count)) + 0.5;
      ink.beginPath();
      ink.moveTo(pad.left, y);
      ink.lineTo(pad.left + wide, y);
      ink.stroke();
      ink.fillText(String(count), pad.left - 6, y);
    }

    // The days, as many as fit, under the points they name.
    ink.textAlign = "center";
    const xs = left.days.map((_, index) => xOf(index));
    for (const index of labelsThatFit(xs, (at) => widths[at]!, 10)) {
      ink.fillText(left.days[index]!.said, xs[index]!, pad.top + tall + 14);
    }

    ink.strokeStyle = line;
    ink.lineWidth = 2;
    ink.lineJoin = "round";
    /*
     * THE COUNT MOVES IN STEPS. What is left holds through a due day and
     * falls the morning after it, so the line keeps its height to the day
     * and steps down at the day after — a slope between two due days
     * would say something was finished on a day nothing was due.
     */
    ink.beginPath();
    left.days.forEach((point, index) => {
      const x = xOf(index);
      if (index === 0) ink.moveTo(x, yOf(point.left));
      else ink.lineTo(x, yOf(point.left));
      const next = left.days[index + 1];
      if (next && next.left !== point.left) {
        const after = Math.min(xOf(index + 1), x + wide / span);
        ink.lineTo(after, yOf(point.left));
        ink.lineTo(after, yOf(next.left));
      }
    });
    ink.stroke();

    ink.fillStyle = line;
    for (const [index, point] of left.days.entries()) {
      ink.beginPath();
      ink.arc(xOf(index), yOf(point.left), 2.5, 0, Math.PI * 2);
      ink.fill();
    }
  }, [left, box, drawn, scheme]);

  const first = left.days[0];
  const last = left.days[left.days.length - 1];
  const undated = left.undated > 0 ? ` ${left.undated === 1 ? "One more has" : `${left.undated} more have`} no date.` : "";
  /*
   * WHAT THE PICTURE SAYS, IN WORDS — and in place of the line when a line
   * would say nothing: no day at all, one day, or every dated task done,
   * which drawn is a flat line along the bottom that reads as broken.
   */
  const sentence =
    !first || !last
      ? `Nothing has a date yet, so there is no line to draw.${undated}`
      : left.peak === 0
        ? `Everything with a date is done: ${left.done === 1 ? "one task" : `${left.done} tasks`}.${undated}`
        : left.days.length === 1
          ? `Only ${first.said} has anything due: ${first.left} still open.${undated}`
          : `Open tasks due on each day or later, from ${first.said} to ${last.said}: ${first.left} at first, ${last.left} on the last day.${undated}`;
  return (
    <div
      style={{
        display: "grid",
        /*
         * As tall as the room, up to a height a line of a dozen days reads
         * at: past it a step of one task is a cliff, which says more than
         * the count does. The rest of a tall box is left below it.
         */
        gridTemplateRows: drawn ? "auto minmax(140px, 320px)" : "auto",
        alignContent: "start",
        gap: 8,
        // The whole box the picture is given, so the line is as tall as the room for it.
        height: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        padding: 12,
      }}
    >
      <p data-testid="burndown-words" style={{ margin: 0, fontSize: 13, color: "var(--graview-ink-muted)" }}>
        {sentence}
      </p>
      {drawn ? (
        <div ref={holder} style={{ position: "relative", height: "100%", minWidth: 0 }}>
          <canvas
            ref={surface}
            data-testid="burndown-canvas"
            role="img"
            aria-label={sentence}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          />
        </div>
      ) : null}
      {/*
        * THE SAME FACTS IN THE DOCUMENT. A canvas says nothing to a screen
        * reader, to a search engine, or to a browser that could not start
        * it — and a routed page is exactly where all three turn up. The
        * axis says the days to the eye; this says every one of them to
        * everybody else, without crowding the picture.
        */}
      {left.days.length > 0 ? (
        <ol data-testid="burndown-days" style={HIDDEN}>
          {left.days.map((point) => (
            <li key={point.day}>
              {point.said}: {point.left} left
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** In the document for a reader, out of the way of the eye. */
const HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

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

