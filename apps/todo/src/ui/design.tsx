import { humaniseField, labelOf, type Principal, type Violation } from "@graview/core";
import { KindFigure, useMarkup } from "@graview/primitives";
import {
  createPageRegistry,
  DerivedForm,
  kindFacts,
  rankedRepairs,
  recordFacts,
  recordPath,
  spatialHref,
  StartFreshLink,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import { editableFields, type Affordance, type AffordanceSet, type EditableField } from "@graview/tools";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { TodoSchema } from "../domain/schema.js";
import { today } from "./when.js";

type S = TodoSchema;
type Ctx = PageContext<S>;

/*
 * THINGS, THE PRODUCT.
 *
 * The routed face comes for free from the declaration, and free is where a
 * demo usually stops: this repository had one polished face (the seedbed's
 * almanac) and the app people open first ran on the derived pages, which
 * look exactly like what they are — a competent admin panel over somebody
 * else's data.
 *
 * This is the other end of the registry. Every surface is replaced — the
 * shell, the home, the problems, every list and every record — and NOTHING
 * here reaches past the framework: the same `recordFacts` and `kindFacts`
 * the derived pages read, the same acts through `store.permits`, the same
 * refusals in the policy's own words, the same op log behind every change.
 * What differs is only what a reader sees, which is the entire claim a view
 * registry makes.
 *
 * Every size is in `rem`, so the reader's own text size carries here as it
 * does everywhere else; every control clears 24px; every colour is mixed
 * from the brand's own tokens, so the palette is the one `graview check`
 * already measured rather than a second one invented here.
 */

/*
 * A FULL FINGERTIP on every engine. A bare <select> is drawn by the
 * platform, and WebKit's menulist ignores a min-height and lands at 21px
 * on a phone; drawn the way the framework draws its own selects, it is
 * the same control the rest of the face has.
 */
const filterSelect: React.CSSProperties = {
  font: "inherit",
  minHeight: 24,
  boxSizing: "border-box",
  padding: "3px 24px 3px 8px",
  borderRadius: 8,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  appearance: "none",
};

const CSS = `
.th {
  --th-paper: color-mix(in oklab, var(--graview-ground) 92%, var(--graview-accent) 8%);
  --th-card: var(--graview-panel);
  --th-line: var(--graview-edge);
  --th-tint: color-mix(in oklab, var(--graview-panel) 88%, var(--graview-accent) 12%);
  min-height: 100%;
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  background: var(--th-paper);
  color: var(--graview-ink);
  font-family: var(--graview-font-body, system-ui);
  font-size: 1rem;
  line-height: 1.55;
}
.th a { color: inherit; text-decoration: none; }
.th :focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; border-radius: 0.35rem; }

.th-rail {
  position: sticky; top: 0; align-self: start; min-height: 100vh; min-width: 0;
  padding: 1.6rem 1.25rem; border-right: 1px solid var(--th-line);
  display: grid; align-content: start; gap: 1.5rem;
  background: color-mix(in oklab, var(--th-paper) 60%, var(--graview-panel) 40%);
}
.th-mark { display: flex; align-items: center; gap: 0.55rem; min-width: 0; overflow-wrap: anywhere; font-family: var(--graview-font-display); font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; color: var(--graview-accent); }
.th-nav { display: grid; gap: 0.125rem; min-width: 0; }
.th-nav a { display: flex; align-items: center; gap: 0.6rem; min-height: 2rem; padding: 0.4rem 0.6rem; border-radius: 0.5rem; font-size: 0.9rem; color: var(--graview-ink-muted); }
.th-nav a[aria-current="page"] { background: var(--th-tint); color: var(--graview-ink); box-shadow: inset 0 0 0 1px var(--th-line); }
/* MUTED, NOT FAINT. The faint token is for decoration at size; on a 12px
   count it measures 4.46:1 against the light ground, which is under AA and
   exactly the sort of thing nobody sees by eye. */
.th-nav a .n { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--graview-ink-muted); }
.th-nav a.warn .n { color: var(--graview-warn); }

.th-main { padding: 2.2rem 2.6rem 5rem; max-width: 68rem; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; }
.th-eyebrow { font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graview-ink-muted); margin: 0 0 0.5rem; }
/* An eyebrow that is a LINK is a control, and a control is at least 24px
   tall however small its words are — WCAG 2.5.8, and the one audit-ui
   counts on every screen. */
.th-eyebrow a { display: inline-flex; align-items: center; min-height: 1.5rem; }
.th-h1 { font-family: var(--graview-font-display); font-size: 2.2rem; line-height: 1.1; font-weight: 600; letter-spacing: -0.015em; margin: 0; text-wrap: balance; }
.th-h2 { font-family: var(--graview-font-display); font-size: 1.25rem; line-height: 1.25; font-weight: 600; margin: 0; }
.th-lede { font-size: 1.05rem; line-height: 1.55; color: var(--graview-ink-muted); max-width: 58ch; margin: 0.6rem 0 0; }
/*
 * A COLUMN THAT MAY NOT BE WIDER THAN ITS COLUMN.
 *
 * A grid or flex item's automatic minimum size is its CONTENT's, so one
 * un-wrappable row — a task's name, a warning chip and a date — pushed its
 * list, its section and the whole main column to 500px inside a 320px
 * phone. At the reader's own 200% text size that is every row. minmax(0,
 * 1fr) and min-width: 0 say what is actually true: the column is the
 * column, and what does not fit ellipsises or wraps.
 */
.th-section { margin-top: 2.2rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.9rem; min-width: 0; }
.th-section > header { display: flex; align-items: baseline; gap: 0.8rem; flex-wrap: wrap; min-width: 0; }
.th-list > li, .th-row, .th-card, .th-facts > div { min-width: 0; }

.th-list { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.th-row {
  display: flex; align-items: center; gap: 0.5rem 0.75rem; min-height: 2.75rem;
  padding: 0.55rem 0.9rem; border-radius: 0.7rem;
  background: var(--th-card); border: 1px solid var(--th-line);
  /* Where there is no room beside the name, the date goes UNDERNEATH it —
     the same answer the bar and the strip give, and the only honest one at
     the reader's own 200% text size. */
  flex-wrap: wrap;
}
.th-row.bad { border-color: var(--graview-warn); }
.th-row .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.98rem; }
.th-row.done .name { text-decoration: line-through; color: var(--graview-ink-muted); }
.th-row .meta { margin-left: auto; display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; color: var(--graview-ink-faint); font-variant-numeric: tabular-nums; flex: 0 1 auto; min-width: 0; white-space: nowrap; }
.th-row .meta .late { color: var(--graview-warn); }

.th-tick {
  flex: 0 0 auto; width: 1.5rem; height: 1.5rem; min-height: 1.5rem; border-radius: 999px;
  border: 1.5px solid var(--th-line); background: transparent; color: var(--graview-accent);
  display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; cursor: pointer;
}
.th-tick[aria-pressed="true"] { background: var(--graview-accent); border-color: var(--graview-accent); color: var(--graview-ground); }
.th-tick[disabled] { cursor: default; opacity: 0.45; }

.th-card { display: grid; gap: 0.7rem; padding: 1.1rem 1.25rem; border-radius: 0.85rem; background: var(--th-card); border: 1px solid var(--th-line); min-width: 0; }
.th-card.bad { border-color: var(--graview-warn); background: var(--graview-panel-warning); }
.th-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.85rem; }

.th-chip { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 1.5rem; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; border: 1px solid var(--th-line); color: var(--graview-ink-muted); }
.th-chip.warn { border-color: var(--graview-warn); color: var(--graview-warn); }

.th-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.th-controls label { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--graview-ink-muted); }
.th-controls select, .th-controls input {
  min-height: 1.75rem; padding: 0.2rem 0.5rem; border-radius: 0.45rem; font: inherit; font-size: 0.85rem;
  border: 1px solid var(--th-line); background: var(--graview-panel); color: var(--graview-ink);
  /* A text field's default size is twenty characters, which at 200% text is
     wider than a phone. It takes the room it is given instead. */
  min-width: 0; max-width: 100%;
}
.th-controls label { min-width: 0; }
.th-btn {
  min-height: 1.75rem; padding: 0.25rem 0.7rem; border-radius: 999px; font: inherit; font-size: 0.8rem;
  border: 1px solid var(--th-line); background: transparent; color: var(--graview-ink-muted); cursor: pointer;
}
.th-btn:hover { color: var(--graview-ink); }
/* PRESSED IS THE BORDER AND THE GROUND, not the ink. Accent text on the
   accent-tinted panel measures 4.02:1 in the dark scheme — a state that
   announces itself by failing contrast is announcing it to nobody. */
.th-btn.on { border-color: var(--graview-accent); color: var(--graview-ink); background: var(--th-tint); }
.th-btn.act { border-color: var(--graview-accent); color: var(--graview-accent); }
/* A REPAIR BELONGS TO THE PROBLEM IT REPAIRS. On the warning ground the
   accent measures 4.47:1 — under AA — and reading as the app's own colour
   rather than as this card's was wrong anyway. */
.th-card.bad .th-btn.act { border-color: var(--graview-warn); color: var(--graview-ink); }
.th-btn[disabled] { cursor: default; opacity: 0.5; }

.th-quiet { font-size: 0.85rem; color: var(--graview-ink-muted); }
/* A control that wears whatever it is inside — a heading stays a heading
   and is still the thing you press to change the name. */
.th-plain { font: inherit; color: inherit; background: none; border: 0; padding: 0; text-align: left; cursor: pointer; min-width: 0; }
.th-plain:hover { text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 0.2em; }
.th-warn { color: var(--graview-warn); }
.th-empty { display: grid; gap: 0.5rem; padding: 1.6rem; border-radius: 0.85rem; border: 1px dashed var(--th-line); text-align: center; }
.th-empty b { font-family: var(--graview-font-display); font-size: 1.05rem; font-weight: 600; }

.th-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.9rem 1.4rem; margin: 0; }
/* Muted rather than faint, for the same reason the rail's counts are: an
   11px label on the paper ground measures 4.09:1 with the faint token, and
   a field's own name is not decoration. */
.th-facts dt { font-size: 0.6875rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graview-ink-muted); }
.th-facts dd { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
.th-facts .th-btn { width: 100%; text-align: left; }

@media (max-width: 52rem) {
  .th { grid-template-columns: minmax(0, 1fr); }
  .th-rail { position: static; min-height: 0; border-right: 0; border-bottom: 1px solid var(--th-line); }
  /* A row that SCROLLS rather than one that widens the document: at the
     reader's own 200% text size the five links come to 700px, and a grid
     item's min-width is auto, so without this the page scrolled sideways —
     which is the exact thing WCAG 1.4.10 is about. */
  .th-nav { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; min-width: 0; }
  /*
   * AND THE PAGE ITSELF DOES NOT SCROLL SIDEWAYS.
   *
   * The nav clips its own row — width 310, scroll width 1394 — and the
   * document still reported a scroll width of 548, because a scroll
   * container's overflow still counts towards the root's. Clipping the
   * layout that owns both columns says what is actually true: the rail
   * scrolls inside itself and the main column wraps, so there is nothing
   * off the side of this page to reach.
   */
  .th { overflow-x: clip; }
  .th-nav a .n { margin-left: 0.35rem; }
  .th-main { padding: 1.4rem 1.1rem 4rem; }
  .th-h1 { font-size: 1.7rem; }
}

/* A move that is not wanted simply happens. */
@media (prefers-reduced-motion: no-preference) {
  .th-row, .th-card, .th-btn { transition: border-color 140ms ease, background 140ms ease, color 140ms ease; }
}
:root[data-graview-motion="reduce"] .th-row,
:root[data-graview-motion="reduce"] .th-card,
:root[data-graview-motion="reduce"] .th-btn { transition: none; }
`;

/* ------------------------------------------------------------ the shell */

function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  const { store, brand } = context;
  useStoreTick(store);
  const logo = useMarkup(brand?.logo);
  const here = useLocation().pathname;
  const problems = store.violations(context.invariantContext).length;
  const open = (store.graph.nodesOfKind("task" as never) as unknown as { done: boolean }[]).filter(
    (task) => !task.done,
  ).length;
  /*
   * THE RAIL IS DERIVED, and narrowed by the seat.
   *
   * A hand-written list of links is a second declaration that goes stale
   * the day somebody adds a kind — and, worse, it cannot narrow: the people
   * and the invitations belong to the seat that keeps the installation and
   * to nobody else, and a rail that named them anyway would offer a member
   * a door to a room that is not there.
   */
  const kept = store.kindsKeptFrom(context.principal);
  const kinds = (store.schema.kinds as readonly string[]).filter((kind) => !kept.has(kind));

  return (
    <div className="th">
      <style>{CSS}</style>
      <aside className="th-rail">
        <Link to="/" className="th-mark" aria-label={`${brand?.name ?? "Things"} — home`}>
          <span aria-hidden="true" dangerouslySetInnerHTML={logo} />
          {brand?.name ?? "Things"}
        </Link>
        <nav className="th-nav" aria-label="Kinds">
          <Rail to="/" here={here} label="Today" />
          {kinds.map((kind) => (
            <Rail
              key={kind}
              to={`/${pluralSlugOf(store, kind)}`}
              here={here}
              label={plural(store, kind)}
              /* A kind's own drawing beside its name — the same one the
                 scene stands on its block, from the same declaration. */
              figure={<KindFigure kind={kind} schema={store.schema} {...(brand ? { brand } : {})} size={15} />}
              // Open tasks rather than all of them: a to-do list counting
              // what is finished is counting the wrong thing.
              count={kind === "task" ? open : store.graph.nodesOfKind(kind as never).length}
            />
          ))}
          <Rail to="/problems" here={here} label="Problems" count={problems} warn={problems > 0} />
        </nav>
        <div
          className="th-quiet"
          style={{ display: "grid", gap: "0.5rem", justifyItems: "start", paddingTop: "1rem", borderTop: "1px solid var(--th-line)" }}
        >
          {/* Two faces, one declaration — and the way across, from either. */}
          <a href={context.sceneHref ?? "/"} className="th-btn">
            See it in the scene ↗
          </a>
          {/*
            * AND THE WAY OUT OF A REMEMBERED STORE.
            *
            * A browser that keeps your edits has to offer the way back to
            * the example, on every face — a design that replaces the shell
            * takes that obligation with it, and this one had quietly
            * dropped it. `pnpm remember` is what noticed.
            */}
          {context.remembers ? (
            <>
              <span data-testid="remembered">Remembered in this browser.</span>
              <StartFreshLink />
            </>
          ) : null}
        </div>
      </aside>
      <main className="th-main">{children}</main>
    </div>
  );
}

function Rail({
  to,
  here,
  label,
  figure,
  count,
  warn,
}: {
  to: string;
  here: string;
  label: string;
  /** The kind's own drawing, where it declares one. */
  figure?: ReactNode;
  count?: number;
  warn?: boolean;
}) {
  const current = to === "/" ? here === "/" : here === to || here.startsWith(`${to}/`);
  return (
    <Link to={to} className={warn ? "warn" : undefined} {...(current ? { "aria-current": "page" as const } : {})}>
      {figure}
      {label}
      {count === undefined ? null : <span className="n">{count}</span>}
    </Link>
  );
}

/* ------------------------------------------------------------- the home */

/**
 * TODAY, which is the question a to-do list is actually asked.
 *
 * Not a directory of kinds: what is late, what is due today, and what is
 * next. The derived home lists every kind with a count, which is a truthful
 * answer to a question nobody has.
 */
function Home({ context }: { context: Ctx }) {
  const { store } = context;
  useStoreTick(store);
  const now = (context.invariantContext?.["today"] as string | undefined) ?? today();
  const tasks = store.graph.nodesOfKind("task" as never) as unknown as TaskNode[];
  const open = tasks.filter((task) => !task.done);
  const late = open.filter((task) => task.due !== undefined && task.due < now);
  const due = open.filter((task) => task.due === now);
  const next = open
    .filter((task) => task.due !== undefined && task.due > now)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))
    .slice(0, 6);
  const flagged = flaggedIds(store.violations(context.invariantContext));

  return (
    <>
      <header>
        <p className="th-eyebrow">{longDate(now)}</p>
        <h1 className="th-h1">
          {open.length === 0
            ? "Nothing left to do."
            : late.length > 0
              ? `${late.length} thing${late.length === 1 ? "" : "s"} ${late.length === 1 ? "is" : "are"} late.`
              : due.length > 0
                ? `${due.length} thing${due.length === 1 ? "" : "s"} for today.`
                : "Nothing is due today."}
        </h1>
        <p className="th-lede">
          {open.length} open across {store.graph.nodesOfKind("list" as never).length} lists.
        </p>
      </header>

      {late.length > 0 ? (
        <Section title="Late" count={late.length}>
          <Rows tasks={late} context={context} flagged={flagged} now={now} />
        </Section>
      ) : null}
      <Section title="Today" count={due.length}>
        {due.length > 0 ? (
          <Rows tasks={due} context={context} flagged={flagged} now={now} />
        ) : (
          <Empty
            said="Nothing is on for today."
            next={<Link className="th-btn" to="/tasks">Look at everything</Link>}
          />
        )}
      </Section>
      {next.length > 0 ? (
        <Section title="Coming up" count={next.length}>
          <Rows tasks={next} context={context} flagged={flagged} now={now} />
        </Section>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------- the lists */

/**
 * EVERY LIST PAGE IS THE SAME PAGE, because every kind is a list of things
 * with a name. What differs is which columns mean something, and that is a
 * fact about the kind rather than a page somebody has to write.
 *
 * Grouping, sorting and the filter live in the URL, so a list you arranged
 * is a link you can send and a place Back returns to — the same contract
 * the scene's stops have kept since it existed.
 */
function KindList({ context, kind }: { context: Ctx; kind: string }) {
  const { store, principal } = context;
  useStoreTick(store);
  const [params, setParams] = useSearchParams();
  const now = (context.invariantContext?.["today"] as string | undefined) ?? today();
  const flagged = flaggedIds(store.violations(context.invariantContext));
  const facts = useMemo(
    () => kindFacts(store, kind, { ...(principal ? { principal } : {}), ...(context.invariantContext ? { context: context.invariantContext } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, kind, principal, context.invariantContext, store.log.all().length],
  );

  const group = params.get("group") ?? (kind === "task" ? "list" : "none");
  const sort = params.get("sort") ?? "name";
  const query = params.get("q") ?? "";
  const show = params.get("show") ?? (kind === "task" ? "open" : "all");
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: false });
  };

  const all = store.graph.nodesOfKind(kind as never) as unknown as NamedNode[];
  const named = (node: NamedNode) => labelOf(store.schema.tryDefinition(kind), node as never);
  const matching = all
    .filter((node) => (show === "open" ? (node as TaskNode).done !== true : true))
    .filter((node) => query === "" || named(node).toLowerCase().includes(query.toLowerCase()));
  const sorted = [...matching].sort((a, b) =>
    sort === "due"
      ? ((a as TaskNode).due ?? "9999").localeCompare((b as TaskNode).due ?? "9999")
      : named(a).localeCompare(named(b)),
  );
  const groups = groupBy(sorted, group, store, kind);

  return (
    <>
      <header>
        <p className="th-eyebrow">{plural(store, kind)}</p>
        <h1 className="th-h1">{plural(store, kind)}</h1>
        <p className="th-lede">
          {matching.length} of {all.length} shown.
        </p>
      </header>

      <div className="th-section">
        <div className="th-controls" data-testid="list-controls">
          <label>
            Find
            <input
              type="search"
              data-testid="list-filter"
              value={query}
              placeholder={`Search ${plural(store, kind).toLowerCase()}`}
              onChange={(event) => set("q", event.target.value)}
            />
          </label>
          {kind === "task" ? (
            <>
              <label>
                Show
                <select data-testid="list-show" style={filterSelect} value={show} onChange={(event) => set("show", event.target.value)}>
                  <option value="open">Open</option>
                  <option value="all">Everything</option>
                </select>
              </label>
              <label>
                Group
                <select data-testid="list-group" style={filterSelect} value={group} onChange={(event) => set("group", event.target.value)}>
                  <option value="list">By list</option>
                  <option value="due">By date</option>
                  <option value="none">Not at all</option>
                </select>
              </label>
              <label>
                Sort
                <select data-testid="list-sort" style={filterSelect} value={sort} onChange={(event) => set("sort", event.target.value)}>
                  <option value="name">By name</option>
                  <option value="due">By date</option>
                </select>
              </label>
            </>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <Empty
            said={
              query === ""
                ? `No ${plural(store, kind).toLowerCase()} yet.`
                : `Nothing here is called “${query}”.`
            }
            next={
              query === "" ? null : (
                <button type="button" className="th-btn" onClick={() => set("q", "")}>
                  Clear the search
                </button>
              )
            }
          />
        ) : (
          groups.map(({ title, members }) => (
            <section key={title} className="th-section" style={{ marginTop: 0 }}>
              {groups.length > 1 ? (
                <header>
                  <h2 className="th-h2">{title}</h2>
                  <span className="th-quiet">{members.length}</span>
                </header>
              ) : null}
              {kind === "task" ? (
                <Rows tasks={members as TaskNode[]} context={context} flagged={flagged} now={now} />
              ) : (
                <ul className="th-list" data-testid="records">
                  {members.map((node) => (
                    <li key={node.id}>
                      <Link className="th-row" to={recordPath(store.schema, kind, node.id)}>
                        <span className="name">{named(node)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>

      <Acts title={`Add ${article(kind)}`} actions={facts.actions} context={context} openFirst />
    </>
  );
}

/* ---------------------------------------------------------- the record */

function KindRecord({ context, kind }: { context: Ctx; kind: string }) {
  const { store, principal, brand } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  if (!facts) {
    return (
      <>
        <h1 className="th-h1">Nothing lives at this address.</h1>
        <p className="th-lede">
          It may have been dropped. <Link to={`/${pluralSlugOf(store, kind)}`}>Back to the list.</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <header>
        <p className="th-eyebrow">
          <Link to={`/${pluralSlugOf(store, kind)}`}>
            <KindFigure kind={kind} schema={store.schema} {...(brand ? { brand } : {})} size={14} />
            {plural(store, kind)}
          </Link>
        </p>
        {/*
          * THE HEADING IS THE NAME, so the heading is where the name is
          * changed. `readableFields` leaves the label out of the facts
          * because it is already the heading — which meant the one field
          * everybody wants to fix was the one field this face could not
          * edit.
          */}
        <h1 className="th-h1">
          <InPlace context={context} nodeId={id} field="label" value={facts.label} plain />
        </h1>
        <p className="th-lede">
          <a className="th-btn" data-testid="spatial-link" href={spatialHref(id)}>
            See it in the scene ↗
          </a>
        </p>
      </header>

      {facts.violations.length > 0 ? (
        <section className="th-section" data-testid="record-violations">
          {facts.violations.map((violation, at) => (
            <div key={at} className="th-card bad">
              <strong className="th-warn">{violation.message}</strong>
              <Repairs
                context={context}
                repairs={rankedRepairs(facts.actions, violation.repairs)}
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="th-section" data-testid="record-fields">
        <header>
          <h2 className="th-h2">The facts</h2>
          <span className="th-quiet">Change one where you can.</span>
        </header>
        <dl className="th-facts">
          {facts.fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                <InPlace context={context} nodeId={id} field={field.key} value={field.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {facts.links.map((group) => (
        <section key={`${group.edgeKind}:${group.direction}`} className="th-section">
          <header>
            <h2 className="th-h2">{capitalise(group.description ?? humaniseField(group.edgeKind))}</h2>
          </header>
          <ul className="th-list">
            {group.targets.map((target) => (
              <li key={target.id}>
                <Link className="th-row" to={recordPath(store.schema, target.kind, target.id)}>
                  <span className="name">{target.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Acts title="What can be done" actions={facts.actions} context={context} />
    </>
  );
}

/* --------------------------------------------------------- the problems */

/**
 * THE INBOX. Each broken rule in its own words, the thing it is about as a
 * link, and the repair the rule itself named — one press where the rule
 * needs nothing more, a form where it does.
 */
function Problems({ context }: { context: Ctx }) {
  const { store } = context;
  useStoreTick(store);
  const violations = store.violations(context.invariantContext);
  return (
    <>
      <header>
        <p className="th-eyebrow">{violations.length === 0 ? "The standing" : `${violations.length} open`}</p>
        <h1 className="th-h1">{violations.length === 0 ? "Everything holds." : "What is out of order"}</h1>
        <p className="th-lede">
          {violations.length === 0
            ? "Every rule this list holds itself to is satisfied by what is on it."
            : "Each rule says what it found, and names what would put it right."}
        </p>
      </header>
      {violations.length === 0 ? (
        <Empty said="Nothing to do here." next={<Link className="th-btn" to="/">Back to today</Link>} />
      ) : (
        <div className="th-section">
          {violations.map((violation, at) => (
            <div key={at} className="th-card bad" data-testid="problem">
              <strong className="th-warn">{violation.message}</strong>
              <About context={context} violation={violation} />
              <Repairs context={context} repairs={violation.repairs} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function About({ context, violation }: { context: Ctx; violation: Violation }) {
  const { store } = context;
  const nodes = violation.nodeIds
    .map((id) => store.graph.getNode(id))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  if (nodes.length === 0) return null;
  return (
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
      {/* EVERY node it implicates, not the first: a rule about five late
          tasks that linked one of them was answering a different question. */}
      {nodes.map((node) => (
        <Link
          key={node.id}
          className="th-chip"
          to={recordPath(store.schema, node.kind as string, node.id)}
        >
          {labelOf(store.schema.tryDefinition(node.kind), node as never)}
        </Link>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------- the parts */

interface NamedNode {
  readonly id: string;
  readonly kind: string;
  readonly label?: string;
}
interface TaskNode extends NamedNode {
  readonly done: boolean;
  readonly due?: string;
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="th-section">
      <header>
        <h2 className="th-h2">{title}</h2>
        <span className="th-quiet">{count}</span>
      </header>
      {children}
    </section>
  );
}

function Empty({ said, next }: { said: string; next: ReactNode }) {
  return (
    <div className="th-empty" data-testid="empty">
      <b>{said}</b>
      {next}
    </div>
  );
}

/**
 * A ROW OF TASKS, with the one act a to-do list is for on the left.
 *
 * The tick is `finish` or `reopen` — whichever the derivation offers for
 * this task and this seat — so a seat that may not is shown a control that
 * says so rather than one that refuses on press.
 */
function Rows({
  tasks,
  context,
  flagged,
  now,
}: {
  tasks: readonly TaskNode[];
  context: Ctx;
  flagged: ReadonlySet<string>;
  now: string;
}) {
  const { store } = context;
  return (
    <ul className="th-list" data-testid="records">
      {tasks.map((task) => {
        const late = !task.done && task.due !== undefined && task.due < now;
        return (
          <li key={task.id}>
            <div className={`th-row${task.done ? " done" : ""}${flagged.has(task.id) ? " bad" : ""}`}>
              <Tick context={context} task={task} />
              <Link className="name" to={recordPath(store.schema, "task", task.id)}>
                {task.label ?? task.id}
              </Link>
              <span className="meta">
                {flagged.has(task.id) ? <span className="th-chip warn">⚠</span> : null}
                {task.due ? <span className={late ? "late" : undefined}>{shortDate(task.due)}</span> : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Tick({ context, task }: { context: Ctx; task: TaskNode }) {
  const { store, principal } = context;
  const [failed, setFailed] = useState<string | null>(null);
  const want = task.done ? "reopen" : "finish";
  const call = { name: want, args: { taskId: task.id } };
  const verdict = store.permits(call, principal);
  return (
    <button
      type="button"
      className="th-tick"
      data-testid={`tick-${task.id}`}
      aria-pressed={task.done}
      disabled={!verdict.ok}
      aria-label={
        verdict.ok
          ? `${task.done ? "Put back" : "Finish"} ${task.label ?? task.id}`
          : verdict.refusal.message
      }
      title={verdict.ok ? undefined : verdict.refusal.message}
      onClick={() => {
        try {
          store.apply(call, principal ? { author: principal } : {});
          setFailed(null);
        } catch (error) {
          // A refusal is a result, said where the press happened.
          setFailed(error instanceof Error ? error.message : String(error));
        }
      }}
    >
      {failed ? "!" : task.done ? "✓" : ""}
    </button>
  );
}

/**
 * ONE FIELD, CHANGED WHERE IT IS SHOWN.
 *
 * Through the mutation the framework found — `editableFields` reads the
 * declaration — so the change is in the op log with an author, judged by
 * the invariants and undoable. A field nothing writes says so rather than
 * sitting there not responding, which is indistinguishable from broken.
 */
function InPlace({
  context,
  nodeId,
  field,
  value,
  plain = false,
}: {
  context: Ctx;
  nodeId: string;
  field: string;
  value: string;
  /** In a heading, the control wears the heading rather than a pill. */
  readonly plain?: boolean;
}) {
  const { store, principal } = context;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [failed, setFailed] = useState<string | null>(null);
  const editable: EditableField | undefined = useMemo(
    () => editableFields(store, nodeId).find((candidate) => candidate.field === field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, nodeId, field, store.log.all().length],
  );
  if (!editable) return <span className="th-quiet">{value || "—"}</span>;
  const call = (next: unknown) => ({
    name: editable.mutation,
    args: { [subjectArgOf(store, editable.mutation)]: nodeId, ...(editable.takesValue ? { [field]: next } : {}) },
  });
  const verdict = store.permits(call(value), principal);
  if (!verdict.ok) {
    return (
      <span className="th-quiet" title={verdict.refusal.message}>
        {value || "—"}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={plain ? "th-plain" : "th-btn"}
        data-graview-editable={editable.mutation}
        title={`${editable.title} — an act, so it is in the history and can be taken back`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || "—"}
      </button>
    );
  }
  const shape = editable.shape;
  return (
    <form
      data-testid={`edit-${field}`}
      style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          store.apply(call(shape.type === "number" ? Number(draft) : draft), principal ? { author: principal } : {});
          setEditing(false);
          setFailed(null);
        } catch (error) {
          setFailed(error instanceof Error ? error.message : String(error));
        }
      }}
    >
      {shape.type === "choice" ? (
        <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={field}>
          {shape.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          type={shape.type === "date" ? "date" : shape.type === "number" ? "number" : "text"}
          value={draft}
          aria-label={humaniseField(field)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
        />
      )}
      <button type="submit" className="th-btn act">
        Save
      </button>
      <button type="button" className="th-btn" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {/* Live: the store's own validation, said at the press rather than
          swallowed. */}
      {failed ? <span className="th-warn th-quiet">{failed}</span> : null}
    </form>
  );
}

/**
 * THE ACTS, inline. A press that needs nothing runs; a press that still
 * wants an answer opens the derived form beneath it, with everything the
 * derivation already settled filled in.
 */
function Acts({
  title,
  actions,
  context,
  openFirst = false,
}: {
  title: string;
  actions: AffordanceSet;
  context: Ctx;
  /**
   * Whether the first act's form is already open.
   *
   * A LIST PAGE IS FOR ADDING TO THE LIST. Making somebody press a button
   * to reveal the one form the page exists for is a click charged for
   * nothing — on a record, where there are eight acts and no obvious first
   * one, the opposite is true.
   */
  readonly openFirst?: boolean;
}) {
  const { store, principal } = context;
  const [open, setOpen] = useState<string | null>(
    openFirst ? (actions.affordances.find((one) => one.open.length > 0)?.id ?? null) : null,
  );
  const [failed, setFailed] = useState<string | null>(null);
  if (actions.affordances.length === 0 && actions.withheld.length === 0) return null;
  return (
    <section className="th-section" data-testid="record-actions">
      <header>
        <h2 className="th-h2">{title}</h2>
      </header>
      <div className="th-controls">
        {actions.affordances.map((affordance) => (
          <button
            key={affordance.id}
            type="button"
            className={`th-btn${open === affordance.id ? " on" : ""}`}
            data-affordance={affordance.id}
            data-rank={affordance.rank}
            aria-expanded={open === affordance.id}
            onClick={() => {
              setFailed(null);
              if (affordance.open.length > 0) {
                setOpen(open === affordance.id ? null : affordance.id);
                return;
              }
              try {
                store.apply(
                  { name: affordance.mutation, args: affordance.args },
                  principal ? { author: principal } : {},
                );
              } catch (error) {
                setFailed(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            {affordance.open.length > 0 ? `${affordance.label} …` : affordance.label}
          </button>
        ))}
      </div>
      {actions.affordances.map((affordance) =>
        open === affordance.id ? <Ask key={affordance.id} affordance={affordance} context={context} onDone={() => setOpen(null)} /> : null,
      )}
      {failed ? <p className="th-warn th-quiet">{failed}</p> : null}
      {actions.withheld.length > 0 ? (
        <ul className="th-list" style={{ gap: "0.2rem" }}>
          {actions.withheld.map((held) => (
            <li key={held.id} className="th-quiet" data-testid="withheld" data-withheld={held.refusal.wouldNeed.join(",") || "nobody"}>
              <s>{held.label}</s> — {held.refusal.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Ask({
  affordance,
  context,
  onDone,
}: {
  affordance: Affordance;
  context: Ctx;
  onDone: () => void;
}) {
  const { store, principal } = context;
  const mutation = store.allMutations().find((candidate) => candidate.name === affordance.mutation);
  if (!mutation) return null;
  return (
    <div className="th-card">
      <DerivedForm<S>
        store={store}
        mutation={mutation as never}
        prefilled={affordance.args}
        open={affordance.open}
        {...(principal ? { principal } : {})}
        onDone={onDone}
      />
    </div>
  );
}

function Repairs({ context, repairs }: { context: Ctx; repairs: readonly { mutation: string; args?: Record<string, unknown>; missing?: readonly string[]; label: string }[] }) {
  const { store, principal } = context;
  const [open, setOpen] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (repairs.length === 0) return null;
  const opened = open === null ? null : repairs[open];
  const asking =
    opened && (opened.missing ?? []).length > 0
      ? store.allMutations().find((candidate) => candidate.name === opened.mutation)
      : undefined;
  return (
    <div style={{ display: "grid", gap: "0.5rem" }} data-testid="repairs">
      <div className="th-controls">
        {repairs.map((repair, at) => {
          const asks = (repair.missing ?? []).length > 0;
          const verdict = store.permits({ name: repair.mutation, args: { ...repair.args } }, principal);
          if (!verdict.ok) {
            return (
              <span key={at} className="th-quiet" data-testid="withheld">
                <s>{repair.label}</s> — {verdict.refusal.message}
              </span>
            );
          }
          return (
            <button
              key={at}
              type="button"
              className={`th-btn act${open === at ? " on" : ""}`}
              data-graview-repair={repair.mutation}
              data-graview-asks={asks || undefined}
              aria-expanded={asks ? open === at : undefined}
              onClick={() => {
                setFailed(null);
                if (asks) {
                  setOpen(open === at ? null : at);
                  return;
                }
                setOpen(null);
                try {
                  store.apply({ name: repair.mutation, args: { ...repair.args } }, principal ? { author: principal } : {});
                } catch (error) {
                  setFailed(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              {asks ? `${repair.label} …` : repair.label}
            </button>
          );
        })}
      </div>
      {asking && opened ? (
        <div className="th-card">
          <DerivedForm<S>
            store={store}
            mutation={asking as never}
            prefilled={opened.args ?? {}}
            open={(opened.missing ?? []).map((name) => ({ name }))}
            {...(principal ? { principal } : {})}
            onDone={() => setOpen(null)}
          />
        </div>
      ) : null}
      {failed ? <p className="th-warn th-quiet">{failed}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- helpers */

const flaggedIds = (violations: readonly Violation[]): ReadonlySet<string> =>
  new Set(violations.flatMap((violation) => violation.nodeIds));

const plural = (store: Ctx["store"], kind: string): string =>
  store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

const pluralSlugOf = (store: Ctx["store"], kind: string): string =>
  plural(store, kind).toLowerCase().replace(/[^a-z0-9]+/g, "-");

const article = (kind: string): string => (/^[aeiou]/i.test(kind) ? `an ${kind}` : `a ${kind}`);

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function subjectArgOf(store: Ctx["store"], mutation: string): string {
  return store.allMutations().find((candidate) => candidate.name === mutation)?.subject?.arg ?? "id";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (day: string): string => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const longDate = (day: string): string =>
  `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

/** The groups a list is shown in, derived rather than written per kind. */
function groupBy(
  nodes: readonly NamedNode[],
  group: string,
  store: Ctx["store"],
  kind: string,
): readonly { title: string; members: readonly NamedNode[] }[] {
  if (group === "none" || kind !== "task") return [{ title: plural(store, kind), members: nodes }];
  if (group === "due") {
    const by = new Map<string, NamedNode[]>();
    for (const node of nodes) {
      const due = (node as TaskNode).due;
      const at = due ? longDate(due) : "No date";
      by.set(at, [...(by.get(at) ?? []), node]);
    }
    return [...by.entries()].sort(([a], [b]) => (a === "No date" ? 1 : b === "No date" ? -1 : a.localeCompare(b))).map(([title, members]) => ({ title, members }));
  }
  const lists = store.graph.nodesOfKind("list" as never) as unknown as NamedNode[];
  const held = new Map<string, NamedNode[]>();
  for (const list of lists) {
    const on = store.graph.out(list.id, "holds").map((task) => task.id);
    held.set(
      labelOf(store.schema.tryDefinition("list"), list as never),
      nodes.filter((node) => on.includes(node.id)),
    );
  }
  const placed = new Set([...held.values()].flat().map((node) => node.id));
  const loose = nodes.filter((node) => !placed.has(node.id));
  return [
    ...[...held.entries()].filter(([, members]) => members.length > 0).map(([title, members]) => ({ title, members })),
    ...(loose.length > 0 ? [{ title: "On no list", members: loose }] : []),
  ];
}

/* ------------------------------------------------------------ the design */

/**
 * Every surface replaced, over the same derivations.
 *
 * Not-found is the one route no design can register, because there is no
 * kind to register it on — the framework's own renders inside this shell,
 * which is what `framed` is for.
 */
export function thingsDesign(schema: S) {
  const page = (component: (props: { context: Ctx }) => ReactNode) => component as unknown as PageComponent<S>;
  const forKind = (kind: string, which: "list" | "record") =>
    page(({ context }: { context: Ctx }) =>
      which === "list" ? <KindList context={context} kind={kind} /> : <KindRecord context={context} kind={kind} />,
    );
  let registry = createPageRegistry<S, PageComponent<S>>(schema as never)
    .surface("shell", Shell as unknown as PageComponent<S>)
    .surface("home", page(Home))
    .surface("problems", page(Problems));
  for (const kind of ["task", "list", "rule", "reason"] as const) {
    registry = registry
      .register(kind, "list", forKind(kind, "list"))
      .register(kind, "record", forKind(kind, "record"));
  }
  return registry;
}

export type { Principal };
