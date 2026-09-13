import { humaniseField, labelOf, type Violation } from "@graview/core";
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
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import type { RotaSchema } from "../domain/schema.js";
import { today } from "./when.js";

type S = RotaSchema;
type Ctx = PageContext<S>;

/*
 * ROTA, THE PRODUCT.
 *
 * A roster is not a list — it is a grid of slots with people in them, read
 * across a room and argued over by a committee. So this face is not Things'
 * face with other words in it: the home is the week laid out day by day with
 * the gaps showing, a shift's record is about WHO HAS IT, and a volunteer's
 * is about what they have taken on against what they said they could manage.
 *
 * Nothing here reaches past the framework. The same `recordFacts` and
 * `kindFacts` the derived pages read, the same acts through `store.permits`,
 * the same refusals in the policy's own words — which is what makes the
 * viewer's seat legible: every act struck through, each saying who could.
 */

const CSS = `
.ro {
  --ro-paper: color-mix(in oklab, var(--graview-ground) 94%, var(--graview-accent) 6%);
  --ro-card: var(--graview-panel);
  --ro-line: var(--graview-edge);
  --ro-tint: color-mix(in oklab, var(--graview-panel) 86%, var(--graview-accent) 14%);
  min-height: 100%;
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  background: var(--ro-paper);
  color: var(--graview-ink);
  font-family: var(--graview-font-body, system-ui);
  font-size: 1rem;
  line-height: 1.5;
}
.ro a { color: inherit; text-decoration: none; }
.ro :focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; border-radius: 0.25rem; }

.ro-rail {
  position: sticky; top: 0; align-self: start; min-height: 100vh; min-width: 0;
  padding: 1.5rem 1.1rem; border-right: 1px solid var(--ro-line);
  display: grid; align-content: start; gap: 1.4rem;
  background: color-mix(in oklab, var(--ro-paper) 55%, var(--graview-panel) 45%);
}
.ro-mark { display: flex; align-items: center; gap: 0.5rem; min-width: 0; font-family: var(--graview-font-display); font-size: 1.3rem; font-weight: 600; letter-spacing: -0.01em; color: var(--graview-accent); }
.ro-nav { display: grid; gap: 0.1rem; min-width: 0; }
.ro-nav a { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; padding: 0.35rem 0.55rem; border-radius: 0.3rem; font-size: 0.9rem; color: var(--graview-ink-muted); }
.ro-nav a[aria-current="page"] { background: var(--ro-tint); color: var(--graview-ink); box-shadow: inset 0 0 0 1px var(--ro-line); }
.ro-nav a .n { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--graview-ink-muted); }

.ro-main { padding: 2rem 2.4rem 5rem; max-width: 72rem; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; }
.ro-eyebrow { font-size: 0.6875rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--graview-ink-muted); margin: 0 0 0.4rem; }
.ro-eyebrow a { display: inline-flex; align-items: center; min-height: 1.5rem; }
.ro-h1 { font-family: var(--graview-font-display); font-size: 2.4rem; line-height: 1.05; font-weight: 600; letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
.ro-h2 { font-family: var(--graview-font-display); font-size: 1.2rem; line-height: 1.2; font-weight: 600; margin: 0; }
.ro-lede { font-size: 1.05rem; color: var(--graview-ink-muted); max-width: 56ch; margin: 0.5rem 0 0; }
.ro-section { margin-top: 2rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.8rem; min-width: 0; }
.ro-section > header { display: flex; align-items: baseline; gap: 0.7rem; flex-wrap: wrap; min-width: 0; }

/* THE WEEK, as a wall chart: a column per day, a slot per shift. */
.ro-week { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: 0.6rem; min-width: 0; }
.ro-day { display: grid; align-content: start; gap: 0.4rem; min-width: 0; padding: 0.6rem; border-radius: 0.4rem; border: 1px solid var(--ro-line); background: color-mix(in oklab, var(--ro-card) 60%, transparent); }
.ro-day > h3 { margin: 0; font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graview-ink-muted); font-weight: 500; }
.ro-day.today > h3 { color: var(--graview-accent); }

.ro-slot { display: grid; gap: 0.15rem; min-width: 0; padding: 0.5rem 0.6rem; border-radius: 0.3rem; background: var(--ro-card); border: 1px solid var(--ro-line); border-left-width: 3px; border-left-color: var(--graview-accent); }
.ro-slot.bare { border-left-color: var(--graview-warn); background: var(--graview-panel-warning); }
.ro-slot .when { font-size: 0.75rem; color: var(--graview-ink-muted); font-variant-numeric: tabular-nums; }
.ro-slot .what { font-size: 0.9rem; overflow-wrap: anywhere; }
.ro-slot .who { font-size: 0.8rem; color: var(--graview-ink-muted); overflow-wrap: anywhere; }
.ro-slot.bare .who { color: var(--graview-warn); }

.ro-list { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; min-width: 0; }
.ro-list > li { min-width: 0; }
.ro-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.7rem; min-height: 2.5rem; min-width: 0; padding: 0.5rem 0.8rem; border-radius: 0.35rem; background: var(--ro-card); border: 1px solid var(--ro-line); }
.ro-row.bad { border-color: var(--graview-warn); }
.ro-row .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem; }
.ro-row .meta { margin-left: auto; display: flex; align-items: center; gap: 0.55rem; font-size: 0.8rem; color: var(--graview-ink-muted); font-variant-numeric: tabular-nums; white-space: nowrap; flex: 0 1 auto; min-width: 0; }

.ro-card { display: grid; gap: 0.6rem; padding: 1rem 1.1rem; border-radius: 0.4rem; background: var(--ro-card); border: 1px solid var(--ro-line); min-width: 0; }
.ro-card.bad { border-color: var(--graview-warn); background: var(--graview-panel-warning); }

.ro-chip { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 1.5rem; padding: 0.1rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; border: 1px solid var(--ro-line); color: var(--graview-ink-muted); }
.ro-chip.warn { border-color: var(--graview-warn); color: var(--graview-warn); }

.ro-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
.ro-controls label { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--graview-ink-muted); min-width: 0; }
.ro-controls select, .ro-controls input {
  min-height: 1.75rem; min-width: 0; max-width: 100%; padding: 0.2rem 0.45rem; border-radius: 0.25rem;
  font: inherit; font-size: 0.85rem; border: 1px solid var(--ro-line);
  background: var(--graview-panel); color: var(--graview-ink);
}
.ro-btn {
  min-height: 1.75rem; padding: 0.25rem 0.65rem; border-radius: 0.25rem; font: inherit; font-size: 0.8rem;
  border: 1px solid var(--ro-line); background: transparent; color: var(--graview-ink-muted); cursor: pointer;
}
.ro-btn:hover { color: var(--graview-ink); }
.ro-btn.on { border-color: var(--graview-accent); color: var(--graview-ink); background: var(--ro-tint); }
.ro-btn.act { border-color: var(--graview-accent); color: var(--graview-accent); }
.ro-card.bad .ro-btn.act { border-color: var(--graview-warn); color: var(--graview-ink); }
.ro-btn[disabled] { cursor: default; opacity: 0.5; }
.ro-plain { font: inherit; color: inherit; background: none; border: 0; padding: 0; min-width: 0; text-align: left; cursor: pointer; }
.ro-plain:hover { text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 0.2em; }

.ro-quiet { font-size: 0.85rem; color: var(--graview-ink-muted); }
.ro-warn { color: var(--graview-warn); }
.ro-empty { display: grid; gap: 0.45rem; justify-items: center; padding: 1.5rem; border-radius: 0.4rem; border: 1px dashed var(--ro-line); text-align: center; }
.ro-empty b { font-family: var(--graview-font-display); font-size: 1.05rem; font-weight: 600; }

.ro-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.8rem 1.3rem; margin: 0; }
.ro-facts > div { min-width: 0; }
.ro-facts dt { font-size: 0.6875rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graview-ink-muted); }
.ro-facts dd { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
.ro-facts .ro-btn { width: 100%; text-align: left; }

@media (max-width: 52rem) {
  .ro { grid-template-columns: minmax(0, 1fr); overflow-x: clip; }
  .ro-rail { position: static; min-height: 0; border-right: 0; border-bottom: 1px solid var(--ro-line); }
  .ro-nav { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; min-width: 0; }
  .ro-nav a .n { margin-left: 0.3rem; }
  .ro-main { padding: 1.3rem 1rem 4rem; }
  .ro-h1 { font-size: 1.8rem; }
}

@media (prefers-reduced-motion: no-preference) {
  .ro-row, .ro-card, .ro-btn, .ro-slot { transition: border-color 140ms ease, background 140ms ease, color 140ms ease; }
}
:root[data-graview-motion="reduce"] .ro-row,
:root[data-graview-motion="reduce"] .ro-card,
:root[data-graview-motion="reduce"] .ro-btn,
:root[data-graview-motion="reduce"] .ro-slot { transition: none; }
`;

/* ------------------------------------------------------------ the shell */

function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  const { store, brand } = context;
  useStoreTick(store);
  const logo = useMarkup(brand?.logo);
  const here = useLocation().pathname;
  const problems = store.violations(context.invariantContext).length;
  // Derived and narrowed by the seat: a viewer sees the roster, and the
  // people and invitations belong to whoever keeps the installation.
  const kept = store.kindsKeptFrom(context.principal);
  const kinds = (store.schema.kinds as readonly string[]).filter((kind) => !kept.has(kind));

  return (
    <div className="ro">
      <style>{CSS}</style>
      <aside className="ro-rail">
        <Link to="/" className="ro-mark" aria-label={`${brand?.name ?? "Rota"} — the week`}>
          <span aria-hidden="true" dangerouslySetInnerHTML={logo} />
          {brand?.name ?? "Rota"}
        </Link>
        <nav className="ro-nav" aria-label="Kinds">
          <Rail to="/" here={here} label="The week" />
          {kinds.map((kind) => (
            <Rail
              key={kind}
              to={`/${slugOf(store, kind)}`}
              here={here}
              label={plural(store, kind)}
              /* A kind's own drawing beside its name — the same one the
                 scene stands on its block, from the same declaration. */
              figure={<KindFigure kind={kind} schema={store.schema} {...(brand ? { brand } : {})} size={15} />}
              count={store.graph.nodesOfKind(kind as never).length}
            />
          ))}
          <Rail to="/problems" here={here} label="Problems" count={problems} />
        </nav>
        <div
          className="ro-quiet"
          style={{ display: "grid", gap: "0.45rem", justifyItems: "start", paddingTop: "0.9rem", borderTop: "1px solid var(--ro-line)" }}
        >
          <a href={context.sceneHref ?? "/"} className="ro-btn">
            See it in the scene ↗
          </a>
          {/* A browser that keeps your edits owes you the way back to the
              example, on every face a design replaces. */}
          {context.remembers ? (
            <>
              <span data-testid="remembered">Remembered in this browser.</span>
              <StartFreshLink />
            </>
          ) : null}
        </div>
      </aside>
      <main className="ro-main">{children}</main>
    </div>
  );
}

function Rail({
  to,
  here,
  label,
  figure,
  count,
}: {
  to: string;
  here: string;
  label: string;
  /** The kind's own drawing, where it declares one. */
  figure?: ReactNode;
  count?: number;
}) {
  const current = to === "/" ? here === "/" : here === to || here.startsWith(`${to}/`);
  return (
    <Link to={to} {...(current ? { "aria-current": "page" as const } : {})}>
      {figure}
      {label}
      {count === undefined ? null : <span className="n">{count}</span>}
    </Link>
  );
}

/* ------------------------------------------------- the week, as a wall chart */

/**
 * THE HOME IS THE WEEK, because that is what a rota on a wall is.
 *
 * A day per column, a slot per shift, and a gap that shows as a gap. The
 * derived home lists every kind with a count, which is a truthful answer to
 * a question nobody asks a roster.
 */
function Home({ context }: { context: Ctx }) {
  const { store } = context;
  useStoreTick(store);
  const now = (context.invariantContext?.["today"] as string | undefined) ?? today();
  const shifts = store.graph.nodesOfKind("shift" as never) as unknown as ShiftNode[];
  const week = daysFrom(startOfWeek(now), 7);
  const here = shifts.filter((shift) => week.includes(shift.on));
  const bare = here.filter((shift) => store.graph.out(shift.id, "covered-by").length === 0);

  return (
    <>
      <header>
        <p className="ro-eyebrow">{longDay(week[0]!)} – {longDay(week[6]!)}</p>
        <h1 className="ro-h1">
          {here.length === 0
            ? "Nothing on this week."
            : bare.length === 0
              ? "Every shift is covered."
              : `${bare.length} shift${bare.length === 1 ? "" : "s"} still ${bare.length === 1 ? "needs" : "need"} somebody.`}
        </h1>
        <p className="ro-lede">
          {here.length} shift{here.length === 1 ? "" : "s"} this week, across{" "}
          {new Set(here.map((shift) => shift.place)).size} places.
        </p>
      </header>

      <section className="ro-section">
        {/*
          * A DAY COLUMN'S NAME IS A HEADING, and a heading has to come after
          * the one above it: the chart went straight from the h1 to seven
          * h3s, which axe reports as `heading-order` and a screen reader
          * reads as a level that came from nowhere.
          */}
        <header>
          <h2 className="ro-h2">This week</h2>
          <span className="ro-quiet">{here.length}</span>
        </header>
        <div className="ro-week" data-testid="week">
          {week.map((day) => {
            const on = here
              .filter((shift) => shift.on === day)
              .sort((a, b) => a.from - b.from);
            return (
              <div key={day} className={`ro-day${day === now ? " today" : ""}`} data-rota-day={day}>
                <h3>{longDay(day)}{day === now ? " · today" : ""}</h3>
                {on.length === 0 ? (
                  <span className="ro-quiet">—</span>
                ) : (
                  on.map((shift) => <Slot key={shift.id} shift={shift} context={context} />)
                )}
              </div>
            );
          })}
        </div>
      </section>

      {bare.length > 0 ? (
        <section className="ro-section">
          <header>
            <h2 className="ro-h2">Still to fill</h2>
            <span className="ro-quiet">{bare.length}</span>
          </header>
          <p className="ro-lede" style={{ marginTop: 0 }}>
            <Link className="ro-btn act" to="/problems">
              Find somebody for them →
            </Link>
          </p>
        </section>
      ) : null}
    </>
  );
}

/** One shift in its day's column, saying who has it — or that nobody does. */
function Slot({ shift, context }: { shift: ShiftNode; context: Ctx }) {
  const { store } = context;
  const who = store.graph.out(shift.id, "covered-by") as unknown as { id: string; label?: string }[];
  return (
    <Link
      className={`ro-slot${who.length === 0 ? " bare" : ""}`}
      data-testid={`slot-${shift.id}`}
      to={recordPath(store.schema, "shift", shift.id)}
    >
      <span className="when">
        {clock(shift.from)}–{clock(shift.until)} · {shift.place}
      </span>
      <span className="what">{shift.label}</span>
      <span className="who">{who.length === 0 ? "Nobody yet" : who.map((one) => one.label ?? one.id).join(", ")}</span>
    </Link>
  );
}

/* ------------------------------------------------------------- the lists */

function KindList({ context, kind }: { context: Ctx; kind: string }) {
  const { store, principal } = context;
  useStoreTick(store);
  const [params, setParams] = useSearchParams();
  const flagged = flaggedIds(store.violations(context.invariantContext));
  const facts = useMemo(
    () =>
      kindFacts(store, kind, {
        ...(principal ? { principal } : {}),
        ...(context.invariantContext ? { context: context.invariantContext } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, kind, principal, context.invariantContext, store.log.all().length],
  );

  const group = params.get("group") ?? (kind === "shift" ? "place" : "none");
  const sort = params.get("sort") ?? (kind === "shift" ? "when" : "name");
  const query = params.get("q") ?? "";
  const show = params.get("show") ?? "all";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: false });
  };

  const named = (node: { id: string }) => labelOf(store.schema.tryDefinition(kind), node as never);
  const all = store.graph.nodesOfKind(kind as never) as unknown as AnyNode[];
  const matching = all
    .filter((node) =>
      show === "bare" && kind === "shift" ? store.graph.out(node.id, "covered-by").length === 0 : true,
    )
    .filter((node) => query === "" || named(node).toLowerCase().includes(query.toLowerCase()));
  const sorted = [...matching].sort((a, b) =>
    sort === "when" && kind === "shift"
      ? `${(a as ShiftNode).on}${String((a as ShiftNode).from).padStart(4, "0")}`.localeCompare(
          `${(b as ShiftNode).on}${String((b as ShiftNode).from).padStart(4, "0")}`,
        )
      : named(a).localeCompare(named(b)),
  );
  const groups = groupBy(sorted, group, kind);

  return (
    <>
      <header>
        <p className="ro-eyebrow">{plural(store, kind)}</p>
        <h1 className="ro-h1">{plural(store, kind)}</h1>
        <p className="ro-lede">
          {matching.length} of {all.length} shown.
        </p>
      </header>

      <div className="ro-section">
        <div className="ro-controls" data-testid="list-controls">
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
          {kind === "shift" ? (
            <>
              <label>
                Show
                <select data-testid="list-show" value={show} onChange={(event) => set("show", event.target.value)}>
                  <option value="all">Everything</option>
                  <option value="bare">Only the gaps</option>
                </select>
              </label>
              <label>
                Group
                <select data-testid="list-group" value={group} onChange={(event) => set("group", event.target.value)}>
                  <option value="place">By place</option>
                  <option value="day">By day</option>
                  <option value="none">Not at all</option>
                </select>
              </label>
              <label>
                Sort
                <select data-testid="list-sort" value={sort} onChange={(event) => set("sort", event.target.value)}>
                  <option value="when">By when</option>
                  <option value="name">By name</option>
                </select>
              </label>
            </>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <Empty
            said={query === "" ? `No ${plural(store, kind).toLowerCase()} yet.` : `Nothing here is called “${query}”.`}
            next={
              query === "" ? null : (
                <button type="button" className="ro-btn" onClick={() => set("q", "")}>
                  Clear the search
                </button>
              )
            }
          />
        ) : (
          groups.map(({ title, members }) => (
            <section key={title} className="ro-section" style={{ marginTop: 0 }}>
              {groups.length > 1 ? (
                <header>
                  <h2 className="ro-h2">{title}</h2>
                  <span className="ro-quiet">{members.length}</span>
                </header>
              ) : null}
              <ul className="ro-list" data-testid="records">
                {members.map((node) => (
                  <li key={node.id}>
                    <Link
                      className={`ro-row${flagged.has(node.id) ? " bad" : ""}`}
                      to={recordPath(store.schema, kind, node.id)}
                    >
                      <span className="name">{named(node)}</span>
                      <span className="meta">{said(store, kind, node)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <Acts title={`Add ${article(kind)}`} actions={facts.actions} context={context} openFirst />
    </>
  );
}

/** What a row says about itself past its name — a fact about the kind. */
function said(store: Ctx["store"], kind: string, node: AnyNode): string {
  if (kind === "shift") {
    const shift = node as ShiftNode;
    const who = store.graph.out(shift.id, "covered-by") as unknown as { label?: string }[];
    return `${shift.on} · ${who.length === 0 ? "nobody yet" : who.map((one) => one.label ?? "?").join(", ")}`;
  }
  if (kind === "volunteer") {
    const person = node as VolunteerNode;
    return `${store.graph.in(person.id, "covered-by").length} of ${person.limit}`;
  }
  return "";
}

/* ------------------------------------------------------------ the record */

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
        <h1 className="ro-h1">Nothing lives at this address.</h1>
        <p className="ro-lede">
          It may have been dropped. <Link to={`/${slugOf(store, kind)}`}>Back to the list.</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <header>
        <p className="ro-eyebrow">
          <Link to={`/${slugOf(store, kind)}`}>
            <KindFigure kind={kind} schema={store.schema} {...(brand ? { brand } : {})} size={14} />
            {plural(store, kind)}
          </Link>
        </p>
        <h1 className="ro-h1">
          <InPlace context={context} nodeId={id} field="label" value={facts.label} plain />
        </h1>
        <p className="ro-lede">
          <a className="ro-btn" data-testid="spatial-link" href={spatialHref(id)}>
            See it in the scene ↗
          </a>
        </p>
      </header>

      {facts.violations.length > 0 ? (
        <section className="ro-section" data-testid="record-violations">
          {facts.violations.map((violation, at) => (
            <div key={at} className="ro-card bad">
              <strong className="ro-warn">{violation.message}</strong>
              <Repairs context={context} repairs={rankedRepairs(facts.actions, violation.repairs)} />
            </div>
          ))}
        </section>
      ) : null}

      <section className="ro-section" data-testid="record-fields">
        <header>
          <h2 className="ro-h2">The facts</h2>
          <span className="ro-quiet">Change one where you can.</span>
        </header>
        <dl className="ro-facts">
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
        <section key={`${group.edgeKind}:${group.direction}`} className="ro-section">
          <header>
            <h2 className="ro-h2">{capitalise(group.description ?? humaniseField(group.edgeKind))}</h2>
          </header>
          <ul className="ro-list">
            {group.targets.map((target) => (
              <li key={target.id}>
                <Link className="ro-row" to={recordPath(store.schema, target.kind, target.id)}>
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

/* ---------------------------------------------------------- the problems */

function Problems({ context }: { context: Ctx }) {
  const { store } = context;
  useStoreTick(store);
  const violations = store.violations(context.invariantContext);
  return (
    <>
      <header>
        <p className="ro-eyebrow">{violations.length === 0 ? "The standing" : `${violations.length} open`}</p>
        <h1 className="ro-h1">{violations.length === 0 ? "The roster holds." : "What needs sorting"}</h1>
        <p className="ro-lede">
          {violations.length === 0
            ? "Every shift is covered and nobody is over what they said they could do."
            : "Each rule says what it found, and names what would put it right."}
        </p>
      </header>
      {violations.length === 0 ? (
        <Empty said="Nothing to do here." next={<Link className="ro-btn" to="/">Back to the week</Link>} />
      ) : (
        <div className="ro-section">
          {violations.map((violation, at) => (
            <div key={at} className="ro-card bad" data-testid="problem">
              <strong className="ro-warn">{violation.message}</strong>
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
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
      {nodes.map((node) => (
        <Link key={node.id} className="ro-chip" to={recordPath(store.schema, node.kind as string, node.id)}>
          {labelOf(store.schema.tryDefinition(node.kind), node as never)}
        </Link>
      ))}
    </p>
  );
}

/* -------------------------------------------------------------- the parts */

interface AnyNode {
  readonly id: string;
  readonly kind: string;
  readonly label?: string;
}
interface ShiftNode extends AnyNode {
  readonly on: string;
  readonly from: number;
  readonly until: number;
  readonly place: string;
}
interface VolunteerNode extends AnyNode {
  readonly limit: number;
}

function Empty({ said: text, next }: { said: string; next: ReactNode }) {
  return (
    <div className="ro-empty" data-testid="empty">
      <b>{text}</b>
      {next}
    </div>
  );
}

/** One field, changed where it is shown, through the act the framework found. */
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
  if (!editable) return <span className="ro-quiet">{value || "—"}</span>;
  const call = (next: unknown) => ({
    name: editable.mutation,
    args: {
      [subjectArgOf(store, editable.mutation)]: nodeId,
      ...(editable.takesValue ? { [field]: next } : {}),
    },
  });
  const verdict = store.permits(call(value), principal);
  if (!verdict.ok) {
    // A viewer sees the value and the reason, not a control that refuses.
    return (
      <span className="ro-quiet" title={verdict.refusal.message}>
        {value || "—"}
      </span>
    );
  }
  if (!editing) {
    return (
      <button
        type="button"
        className={plain ? "ro-plain" : "ro-btn"}
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
      style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}
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
        <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={humaniseField(field)}>
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
      <button type="submit" className="ro-btn act">
        Save
      </button>
      <button type="button" className="ro-btn" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {failed ? <span className="ro-warn ro-quiet">{failed}</span> : null}
    </form>
  );
}

function Acts({
  title,
  actions,
  context,
  openFirst = false,
}: {
  title: string;
  actions: AffordanceSet;
  context: Ctx;
  readonly openFirst?: boolean;
}) {
  const { store, principal } = context;
  const [open, setOpen] = useState<string | null>(
    openFirst ? (actions.affordances.find((one) => one.open.length > 0)?.id ?? null) : null,
  );
  const [failed, setFailed] = useState<string | null>(null);
  if (actions.affordances.length === 0 && actions.withheld.length === 0) return null;
  return (
    <section className="ro-section" data-testid="record-actions">
      <header>
        <h2 className="ro-h2">{title}</h2>
      </header>
      {actions.affordances.length > 0 ? (
        <div className="ro-controls">
          {actions.affordances.map((affordance) => (
            <button
              key={affordance.id}
              type="button"
              className={`ro-btn${open === affordance.id ? " on" : ""}`}
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
                  store.apply({ name: affordance.mutation, args: affordance.args }, principal ? { author: principal } : {});
                } catch (error) {
                  setFailed(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              {affordance.open.length > 0 ? `${affordance.label} …` : affordance.label}
            </button>
          ))}
        </div>
      ) : null}
      {actions.affordances.map((affordance) =>
        open === affordance.id ? (
          <Ask key={affordance.id} affordance={affordance} context={context} onDone={() => setOpen(null)} />
        ) : null,
      )}
      {failed ? <p className="ro-warn ro-quiet">{failed}</p> : null}
      {/*
        * WITHHELD, NOT HIDDEN — and in the viewer's seat this is the whole
        * page. Every act struck through, each carrying the sentence that
        * says who could take it instead, which is the difference between a
        * policy you can read and one you have to be told about.
        */}
      {actions.withheld.length > 0 ? (
        <ul className="ro-list" style={{ gap: "0.2rem" }}>
          {actions.withheld.map((held) => (
            <li
              key={held.id}
              className="ro-quiet"
              data-testid="withheld"
              data-withheld={held.refusal.wouldNeed.join(",") || "nobody"}
            >
              <s>{held.label}</s> — {held.refusal.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Ask({ affordance, context, onDone }: { affordance: Affordance; context: Ctx; onDone: () => void }) {
  const { store, principal } = context;
  const mutation = store.allMutations().find((candidate) => candidate.name === affordance.mutation);
  if (!mutation) return null;
  return (
    <div className="ro-card">
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

function Repairs({
  context,
  repairs,
}: {
  context: Ctx;
  repairs: readonly { mutation: string; args?: Record<string, unknown>; missing?: readonly string[]; label: string }[];
}) {
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
    <div style={{ display: "grid", gap: "0.45rem" }} data-testid="repairs">
      <div className="ro-controls">
        {repairs.map((repair, at) => {
          const asks = (repair.missing ?? []).length > 0;
          const verdict = store.permits({ name: repair.mutation, args: { ...repair.args } }, principal);
          if (!verdict.ok) {
            return (
              <span key={at} className="ro-quiet" data-testid="withheld">
                <s>{repair.label}</s> — {verdict.refusal.message}
              </span>
            );
          }
          return (
            <button
              key={at}
              type="button"
              className={`ro-btn act${open === at ? " on" : ""}`}
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
        <div className="ro-card">
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
      {failed ? <p className="ro-warn ro-quiet">{failed}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- helpers */

const flaggedIds = (violations: readonly Violation[]): ReadonlySet<string> =>
  new Set(violations.flatMap((violation) => violation.nodeIds));

const plural = (store: Ctx["store"], kind: string): string =>
  store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;
const slugOf = (store: Ctx["store"], kind: string): string =>
  plural(store, kind).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const article = (kind: string): string => (/^[aeiou]/i.test(kind) ? `an ${kind}` : `a ${kind}`);
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function subjectArgOf(store: Ctx["store"], mutation: string): string {
  return store.allMutations().find((candidate) => candidate.name === mutation)?.subject?.arg ?? "id";
}

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/* Dates on strings in UTC, for the same reason the calendar lens does it. */
const DAY = 86_400_000;
const utc = (day: string) =>
  Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const iso = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
const addDays = (day: string, count: number) => iso(utc(day) + count * DAY);
const daysFrom = (from: string, count: number) => Array.from({ length: count }, (_, at) => addDays(from, at));
const startOfWeek = (day: string) => addDays(day, -((new Date(utc(day)).getUTCDay() + 6) % 7));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDay = (day: string) =>
  `${WEEKDAYS[new Date(utc(day)).getUTCDay()]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

/** The groups a list is shown in, derived rather than written per kind. */
function groupBy(
  nodes: readonly AnyNode[],
  group: string,
  kind: string,
): readonly { title: string; members: readonly AnyNode[] }[] {
  if (group === "none" || kind !== "shift") return [{ title: "All", members: nodes }];
  const by = new Map<string, AnyNode[]>();
  for (const node of nodes) {
    const shift = node as ShiftNode;
    const at = group === "day" ? longDay(shift.on) : shift.place;
    by.set(at, [...(by.get(at) ?? []), node]);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([title, members]) => ({ title, members }));
}

/* ------------------------------------------------------------ the design */

export function rotaDesign(schema: S) {
  const page = (component: (props: { context: Ctx }) => ReactNode) => component as unknown as PageComponent<S>;
  const forKind = (kind: string, which: "list" | "record") =>
    page(({ context }: { context: Ctx }) =>
      which === "list" ? <KindList context={context} kind={kind} /> : <KindRecord context={context} kind={kind} />,
    );
  let registry = createPageRegistry<S, PageComponent<S>>(schema as never)
    .surface("shell", Shell as unknown as PageComponent<S>)
    .surface("home", page(Home))
    .surface("problems", page(Problems));
  for (const kind of ["shift", "volunteer", "rule"] as const) {
    registry = registry.register(kind, "list", forKind(kind, "list")).register(kind, "record", forKind(kind, "record"));
  }
  return registry;
}
