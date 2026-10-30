import { memoryViews, withMemoryRevisions, type AnySchema, type KeptViews } from "@graview/core";
import type { ReactViewRegistry } from "@graview/react";
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
 * home's body: /pages/places/at-a-glance, and the Scene's places.
 */

const SOURCE = `// Things at a glance: what is due this week, what is still open, and the lists.
graview.style(\`
  .tg-home { display: grid; gap: 20px; }
  .tg-week { display: grid; gap: 8px; }
  .tg-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
  .tg-day { border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); padding: 8px; background: var(--graview-panel); min-height: 64px; }
  .tg-day h3 { margin: 0 0 4px; font-size: 0.8125rem; color: var(--graview-ink-muted); }
  .tg-day ul { margin: 0; padding-left: 16px; font-size: 0.875rem; }
  .tg-open ul { margin: 0; padding-left: 18px; }
  .tg-lists ul { margin: 0; padding-left: 18px; }
  .tg-count { color: var(--graview-ink-muted); }
\`);
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (date) => date.toISOString().slice(0, 10);
graview.onProps((props) => {
  const tasks = props.nodes.filter((node) => node.kind === "task");
  const lists = props.nodes.filter((node) => node.kind === "list");
  const start = new Date();
  const days = Array.from({ length: 7 }, (_, at) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + at);
    return { key: iso(date), name: at === 0 ? "Today" : DAY[date.getDay()], tasks: tasks.filter((task) => task.due === iso(date) && !task.done) };
  });
  const open = tasks.filter((task) => !task.done);
  graview.render(graview.html\`<div class="tg-home">
    <section class="tg-week" aria-labelledby="tg-week-h"><h2 id="tg-week-h">This week</h2>
      <div class="tg-days">\${days.map((day) => graview.html\`<div class="tg-day" data-key="\${day.key}"><h3>\${day.name}</h3><ul>\${day.tasks.map((task) => graview.html\`<li data-key="\${task.id}"><a data-record="\${task.id}">\${task.label}</a></li>\`)}</ul></div>\`)}</div>
    </section>
    <section class="tg-open" aria-labelledby="tg-open-h"><h2 id="tg-open-h">Still open</h2>
      <ul>\${open.map((task) => graview.html\`<li data-key="\${task.id}"><a data-record="\${task.id}">\${task.label}</a></li>\`)}</ul>
    </section>
    <section class="tg-lists" aria-labelledby="tg-lists-h"><h2 id="tg-lists-h">Lists</h2>
      <ul>\${lists.map((list) => graview.html\`<li data-key="\${list.id}"><a data-record="\${list.id}">\${list.label}</a></li>\`)}</ul>
    </section>
  </div>\`);
});
`;

/** The view, as the dev page registers it. */
export const AT_A_GLANCE: WorkerViewDefinition = {
  manifest: { name: "at-a-glance", title: "At a glance", attach: "task", cardinality: "many", reads: { kinds: ["list"] } },
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
