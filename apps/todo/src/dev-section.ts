import { memoryViews, withMemoryRevisions, type AnySchema, type KeptViews, type ViewForkKept } from "@graview/core";
import { createViews, layerViews, type ReactViewRegistry } from "@graview/react";
import { useEffect, useMemo, useState } from "react";
import { todoSchema } from "./domain/schema.js";
import { registerWorkerView, type WorkerViewDefinition } from "@graview/guest/host/views";

/*
 * MAKE THIS SECTION BETTER, IN DEVELOPMENT (Roadmap
 * f-make-this-section-better): on `pnpm dev` — never a build, never a
 * driven browser — Things gains one worker view of its own, "At a glance",
 * a place over its tasks with three named sections: This week, Still open
 * and Lists. Right-click inside one: the menu is named for it and offers
 * "Make this better" — Just do it, Describe changes…, Highlight area… —
 * through the model the dev server lends (`ANTHROPIC_API_KEY`, or xAI's,
 * with Jev beside it). The host's views are kept in memory
 * (`withMemoryRevisions(memoryViews())`): a revision kept is drawn until the
 * page reloads, and the card says so; one Undo puts the view back.
 *
 * Things' own home is its design's, so the view is a place rather than the
 * home's body: /places/at-a-glance, and its view on the Map.
 */

const SOURCE = `// Things at a glance: what is due this week, what is still open, and the lists.
graview.style(\`
  .tg { display: grid; gap: 28px; font-family: var(--graview-font-body); color: var(--graview-ink); }
  .tg h2 { margin: 0 0 10px; font-family: var(--graview-font-display); font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.005em; display: flex; align-items: baseline; gap: 8px; }
  .tg h2 .tg-n { font-family: var(--graview-font-body); font-size: 0.8125rem; font-weight: 500; color: var(--graview-ink-muted); }
  .tg-sum { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .tg-stat { border: 1px solid var(--graview-edge); border-radius: 999px; padding: 3px 11px; font-size: 0.8125rem; color: var(--graview-ink-muted); background: var(--graview-panel); }
  .tg-stat b { color: var(--graview-ink); font-weight: 600; }
  .tg-stat[data-tone="late"] b { color: var(--graview-warn, #b45309); }
  .tg-none { margin: 0; padding: 12px 14px; border: 1px dashed var(--graview-edge); border-radius: var(--graview-radius); color: var(--graview-ink-muted); font-size: 0.875rem; }
  .tg-days { display: grid; gap: 14px; }
  .tg-day h3 { margin: 0 0 6px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--graview-ink-muted); }
  .tg-rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); overflow: hidden; }
  .tg-task { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 14px; min-height: 44px; box-sizing: border-box; }
  .tg-task + .tg-task { border-top: 1px solid var(--graview-edge); }
  .tg-task:hover { background: color-mix(in srgb, var(--graview-accent) 6%, transparent); }
  .tg-tick { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--graview-ink-muted); box-sizing: border-box; }
  .tg-task[data-done="yes"] .tg-tick { border-color: var(--graview-accent); background: var(--graview-accent); }
  .tg-main { display: grid; gap: 1px; min-width: 0; }
  .tg-name { color: var(--graview-ink); text-decoration: none; font-size: 0.9375rem; overflow-wrap: anywhere; }
  .tg-task[data-done="yes"] .tg-name { color: var(--graview-ink-muted); text-decoration: line-through; }
  .tg-list-of { font-size: 0.75rem; color: var(--graview-ink-muted); }
  .tg-due { font-size: 0.8125rem; color: var(--graview-ink-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tg-due[data-tone="late"] { color: var(--graview-warn, #b45309); font-weight: 500; }
  .tg-lists { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .tg-list { border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); padding: 12px 14px; display: grid; gap: 8px; }
  .tg-list:hover { border-color: color-mix(in srgb, var(--graview-accent) 45%, var(--graview-edge)); }
  .tg-list a { color: var(--graview-ink); text-decoration: none; font-weight: 600; }
  .tg-list-n { font-size: 0.8125rem; color: var(--graview-ink-muted); }
  .tg-bar { height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--graview-ink-muted) 18%, transparent); overflow: hidden; }
  .tg-bar span { display: block; height: 100%; background: var(--graview-accent); border-radius: 2px; }
  @media (max-width: 480px) { .tg-task { padding: 10px 12px; gap: 10px; } }
\`);
const DAY_MS = 86400000;
const dayOf = (iso) => Date.parse(iso + "T00:00:00Z");
const between = (from, to) => Math.round((dayOf(to) - dayOf(from)) / DAY_MS);
graview.onProps((props) => {
  const today = graview.today || props.today;
  const short = new Intl.DateTimeFormat(props.locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(props.locale, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const tasks = props.nodes.filter((node) => node.kind === "task");
  const lists = props.nodes.filter((node) => node.kind === "list").sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const holds = (props.edges || []).filter((edge) => edge.kind === "holds");
  const listOf = new Map(holds.map((edge) => [edge.to, lists.find((list) => list.id === edge.from)]));
  const away = (task) => (task.due && today ? between(today, task.due) : undefined);
  const dueSaid = (task) => {
    const days = away(task);
    if (days === undefined) return { said: "No date", tone: "" };
    if (days < 0) return { said: "Overdue · " + short.format(dayOf(task.due)), tone: "late" };
    if (days === 0) return { said: "Today", tone: "" };
    if (days === 1) return { said: "Tomorrow", tone: "" };
    return { said: short.format(dayOf(task.due)), tone: "" };
  };
  const row = (task, showDue) => {
    const due = dueSaid(task);
    const list = listOf.get(task.id);
    return graview.html\`<li class="tg-task" data-key="\${task.id}" data-record="\${task.id}" data-done="\${task.done ? "yes" : "no"}">
      <span class="tg-tick" aria-hidden="true"></span>
      <span class="tg-main"><a class="tg-name" data-record="\${task.id}">\${task.label}</a><span class="tg-list-of">\${task.done ? "Done" : ""}\${task.done && list ? " · " : ""}\${list ? list.label : task.done ? "" : "On no list"}</span></span>
      \${showDue ? graview.html\`<span class="tg-due" data-tone="\${due.tone}">\${due.said}</span>\` : ""}
    </li>\`;
  };
  // The week: only the days that have something due, from today.
  const week = [];
  for (let at = 0; at < 7 && today; at += 1) {
    const due = tasks.filter((task) => away(task) === at);
    if (due.length === 0) continue;
    const iso = new Date(dayOf(today) + at * DAY_MS).toISOString().slice(0, 10);
    week.push({ key: iso, name: at === 0 ? "Today" : at === 1 ? "Tomorrow" : weekday.format(dayOf(iso)), tasks: due });
  }
  // Still open: what is overdue first, oldest first; then what is dated, soonest first; then what has no date.
  const open = tasks.filter((task) => !task.done).sort((a, b) => {
    const x = away(a), y = away(b);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return x - y;
  });
  const late = open.filter((task) => (away(task) ?? 0) < 0).length;
  const dueThisWeek = week.reduce((sum, day) => sum + day.tasks.filter((task) => !task.done).length, 0);
  graview.render(graview.html\`<div class="tg">
    <p class="tg-sum">
      <span class="tg-stat"><b>\${open.length}</b> open</span>
      <span class="tg-stat" data-tone="\${late > 0 ? "late" : ""}"><b>\${late}</b> overdue</span>
      <span class="tg-stat"><b>\${dueThisWeek}</b> due this week</span>
    </p>
    <section aria-labelledby="tg-week-h"><h2 id="tg-week-h">This week</h2>
      \${week.length === 0
        ? graview.html\`<p class="tg-none">Nothing due this week.</p>\`
        : graview.html\`<div class="tg-days">\${week.map((day) => graview.html\`<div class="tg-day" data-key="\${day.key}"><h3>\${day.name}</h3><ul class="tg-rows">\${day.tasks.map((task) => row(task, false))}</ul></div>\`)}</div>\`}
    </section>
    <section aria-labelledby="tg-open-h"><h2 id="tg-open-h">Still open <span class="tg-n">\${open.length}</span></h2>
      \${open.length === 0 ? graview.html\`<p class="tg-none">Everything is done.</p>\` : graview.html\`<ul class="tg-rows">\${open.map((task) => row(task, true))}</ul>\`}
    </section>
    <section aria-labelledby="tg-lists-h"><h2 id="tg-lists-h">Lists</h2>
      <ul class="tg-lists">\${lists.map((list) => {
        const held = holds.filter((edge) => edge.from === list.id).map((edge) => tasks.find((task) => task.id === edge.to)).filter(Boolean);
        const left = held.filter((task) => !task.done).length;
        const share = held.length === 0 ? 0 : Math.round(((held.length - left) / held.length) * 100);
        return graview.html\`<li class="tg-list" data-key="\${list.id}" data-record="\${list.id}">
          <a data-record="\${list.id}">\${list.label}</a>
          <span class="tg-list-n">\${held.length === 0 ? "Empty" : left === 0 ? "All done" : left + " open of " + held.length}</span>
          <span class="tg-bar" aria-hidden="true"><span style="width: \${share}%"></span></span>
        </li>\`;
      })}</ul>
    </section>
  </div>\`);
});
`;

/** The view, as the dev page registers it. */
export const AT_A_GLANCE: WorkerViewDefinition = {
  manifest: { name: "at-a-glance", title: "At a glance", attach: "task", cardinality: "many", reads: { kinds: ["list"], edges: ["holds"] } },
  worker: { source: SOURCE },
};

/** Things' views with "At a glance" among them. */
export function withAtAGlance<S extends AnySchema>(views: ReactViewRegistry<S>): ReactViewRegistry<S> {
  return registerWorkerView(views, AT_A_GLANCE);
}

/** The dev page's views host: revisions kept in memory, for whoever sits down (every seat may change views here). */
export function devKeptViews(): KeptViews {
  return withMemoryRevisions(memoryViews({ may: { views: true, lenses: false } }));
}

/*
 * MAKE ANY PAGE BETTER, IN DEVELOPMENT (Roadmap f-make-any-page-better): a
 * built-in page made its own view is kept with the dev page's views
 * (`KeptViews.fork`), and the one shown as a draft beside them; each is
 * registered over Things' views as the page it was made of, until the page
 * reloads.
 */
/* A draft is drawn as the page's view would be: the card that asked for it says it is a draft. */
export function useForked<S extends AnySchema>(views: ReactViewRegistry<S>, keeper: KeptViews): ReactViewRegistry<S> {
  const [forks, setForks] = useState<readonly ViewForkKept[]>(() => keeper.forked?.() ?? []);
  useEffect(() => {
    const heard = () => setForks(keeper.forked?.() ?? []);
    heard();
    return keeper.onChange?.(heard);
  }, [keeper]);
  return useMemo(() => {
    if (forks.length === 0) return views;
    let over = layerViews(createViews(todoSchema as never) as unknown as ReactViewRegistry<S>, views);
    for (const fork of forks) over = registerWorkerView(over, { manifest: fork.manifest as never, worker: { source: fork.source } });
    return over;
  }, [views, forks]);
}
