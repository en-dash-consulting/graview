import type { AnySchema, Principal } from "@graview/core";
import {
  createPageRegistry,
  DerivedForm,
  kindFacts,
  recordFacts,
  recordPath,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import type { AffordanceSet } from "@graview/tools";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { SeedbedSchema } from "../domain/schema.js";
import { GardenMapPicture, initials, readGarden, Sprout, type Garden, type GardenPlot } from "./garden-map.js";

type S = SeedbedSchema;
type Ctx = PageContext<S>;

/*
 * SEEDBED, THE PRODUCT.
 *
 * Chapter nine showed the derived pages with one page replaced. This is the
 * other end of the same registry: every surface and every page is the
 * garden's own — an almanac, not an admin panel. Nothing here reaches past
 * the framework: the store, the graph, the rules, the acts and their
 * permissions are the same ones the derived pages read. What changed is
 * only what a reader sees, which is the point of a registry.
 */

const HUE = { gardener: 28, plot: 42, planting: 122, rule: 210 } as const;

const CSS = `
.sb { --sb-paper: color-mix(in oklab, var(--graview-ground) 90%, hsl(42 60% 55%) 10%);
      --sb-card: color-mix(in oklab, var(--graview-panel) 94%, hsl(42 60% 55%) 6%);
      --sb-line: color-mix(in oklab, var(--graview-edge) 70%, hsl(42 40% 50%) 30%);
      --sb-soil: hsl(${HUE.plot} 38% 30%);
      --sb-leaf: hsl(${HUE.planting} 45% 40%);
      --sb-clay: hsl(${HUE.gardener} 55% 45%);
      --sb-sky: hsl(${HUE.rule} 45% 48%);
      min-height: 100%; display: grid; grid-template-columns: 236px minmax(0, 1fr);
      background: var(--sb-paper); color: var(--graview-ink);
      font-family: var(--graview-font-body, system-ui); font-size: 0.96875rem; line-height: 1.55; }
.sb a { color: inherit; text-decoration: none; }
.sb-rail { position: sticky; top: 0; align-self: start; height: 100%; min-height: 100vh; padding: 26px 22px;
      border-right: 1px solid var(--sb-line); display: grid; align-content: start; gap: 26px;
      background: color-mix(in oklab, var(--sb-paper) 70%, var(--graview-panel) 30%); }
.sb-mark { display: flex; align-items: center; gap: 9px; font-family: var(--graview-font-display); font-size: 1.3125rem; font-weight: 600; letter-spacing: -0.01em; color: var(--sb-leaf); }
.sb-nav { display: grid; gap: 2px; }
.sb-nav a { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; font-size: 0.90625rem; color: var(--graview-ink-muted); min-height: 32px; }
.sb-nav a[aria-current="page"] { background: var(--sb-card); color: var(--graview-ink); box-shadow: inset 0 0 0 1px var(--sb-line); }
.sb-nav a .n { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--graview-ink-faint); }
.sb-nav a .dot { width: 8px; height: 8px; border-radius: 999px; }
.sb-rail .sb-standing { font-size: 0.8125rem; line-height: 1.5; color: var(--graview-ink-muted); padding-top: 18px; border-top: 1px solid var(--sb-line); }
.sb-rail .sb-standing b { display: block; color: var(--graview-ink); font-weight: 600; }
.sb-rail .sb-standing.bad b { color: var(--graview-warn); }
.sb-main { padding: 38px 48px 80px; max-width: 1040px; min-width: 0; }
.sb-eyebrow { font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graview-ink-muted); margin: 0 0 8px; }
.sb-h1 { font-family: var(--graview-font-display); font-size: 2.5rem; line-height: 1.08; font-weight: 600; letter-spacing: -0.015em; margin: 0; text-wrap: balance; }
.sb-h2 { font-family: var(--graview-font-display); font-size: 1.375rem; line-height: 1.2; font-weight: 600; margin: 0; }
.sb-lede { font-size: 1.09375rem; line-height: 1.55; color: var(--graview-ink-muted); max-width: 58ch; margin: 12px 0 0; }
.sb-section { margin-top: 40px; display: grid; gap: 16px; }
.sb-section > header { display: flex; align-items: baseline; gap: 14px; }
.sb-section > header .more { margin-left: auto; font-size: 0.8125rem; color: var(--graview-ink-muted); display: inline-flex; align-items: center; min-height: 24px; }
.sb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.sb-card { display: grid; gap: 10px; padding: 16px 18px; border-radius: 12px; background: var(--sb-card); border: 1px solid var(--sb-line); box-shadow: var(--graview-lift-low); min-width: 0; }
.sb-card.bad { border-color: var(--graview-warn); }
.sb-card h3 { font-family: var(--graview-font-display); font-size: 1.1875rem; font-weight: 600; margin: 0; }
.sb-card .meta { font-size: 0.8125rem; color: var(--graview-ink-muted); }
.sb-beds { display: flex; gap: 5px; }
.sb-bed { width: 22px; height: 26px; border-radius: 4px; background: var(--sb-soil); display: grid; place-items: end center; color: hsl(${HUE.planting} 55% 62%); padding-bottom: 3px; box-sizing: border-box; }
.sb-bed.empty { background: color-mix(in oklab, var(--sb-soil) 40%, transparent); border: 1px dashed color-mix(in oklab, var(--sb-soil) 60%, transparent); }
.sb-avatar { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: white; background: var(--sb-clay); flex: none; }
.sb-avatar.none { background: transparent; border: 1.5px dashed var(--graview-warn); color: var(--graview-warn); }
.sb-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--sb-line); min-width: 0; }
.sb-row:first-of-type { border-top: none; }
.sb-row .grow { flex: 1 1 auto; min-width: 0; }
/* A name that is a link is a target, and a target is at least a fingertip: "Beans" alone is twenty-two pixels wide. */
.sb-row a.grow, a.grow { display: inline-flex; align-items: center; min-height: 24px; min-width: 24px; }
.sb-row .k { font-size: 0.8125rem; color: var(--graview-ink-muted); }
.sb-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 0.78125rem; border: 1px solid var(--sb-line); background: var(--sb-card); white-space: nowrap; min-height: 24px; }
.sb-pill.warn { border-color: var(--graview-warn); color: var(--graview-warn); }
.sb-pill.leaf { color: var(--sb-leaf); }
.sb-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.sb-act { font: inherit; font-size: 0.875rem; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--sb-leaf); background: transparent; color: var(--sb-leaf); cursor: pointer; min-height: 36px; }
.sb-act[aria-expanded="true"], .sb-act:hover { background: var(--sb-leaf); color: white; }
.sb-act:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; }
.sb-withheld { font-size: 0.8125rem; color: var(--graview-ink-faint); }
.sb-withheld s { color: var(--graview-ink-muted); }
.sb-form { padding: 18px 20px; border-radius: 12px; background: var(--sb-card); border: 1px solid var(--sb-line); display: grid; gap: 12px; }
.sb-trouble { display: grid; gap: 10px; padding: 16px 18px; border-radius: 12px; border: 1px solid var(--graview-warn); background: color-mix(in oklab, var(--sb-card) 88%, var(--graview-warn) 12%); }
.sb-trouble p { margin: 0; font-weight: 550; color: var(--graview-warn); }
.sb-scene { font-size: 0.8125rem; color: var(--graview-ink-muted); display: inline-flex; align-items: center; min-height: 24px; }
.sb-table { width: 100%; border-collapse: collapse; font-size: 0.90625rem; }
.sb-table th { text-align: left; font-size: 0.6875rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graview-ink-faint); font-weight: 500; padding: 0 12px 8px 0; }
.sb-table td { padding: 10px 12px 10px 0; border-top: 1px solid var(--sb-line); vertical-align: top; }
.sb-table td:first-child { font-family: var(--graview-font-display); font-weight: 600; font-size: 1rem; }
.sb-tag { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--graview-ink-faint); }
@media (max-width: 760px) {
  .sb { grid-template-columns: minmax(0, 1fr); }
  .sb-rail { position: static; min-height: 0; border-right: none; border-bottom: 1px solid var(--sb-line); padding: 18px 20px; gap: 14px; }
  .sb-nav { display: flex; flex-wrap: wrap; gap: 4px; }
  .sb-nav a .n { margin-left: 4px; }
  .sb-rail .sb-standing { display: none; }
  .sb-main { padding: 26px 20px 60px; }
  .sb-h1 { font-size: 1.875rem; }
}
@media (prefers-reduced-motion: reduce) { .sb * { transition: none !important; } }
`;

const KINDS = [
  { kind: "plot", slug: "plots", label: "Plots", hue: HUE.plot },
  { kind: "gardener", slug: "gardeners", label: "Gardeners", hue: HUE.gardener },
  { kind: "planting", slug: "plantings", label: "Plantings", hue: HUE.planting },
  { kind: "rule", slug: "rules", label: "Agreements", hue: HUE.rule },
] as const;

function useGarden(context: Ctx): { garden: Garden; problems: number } {
  const { store, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  return { garden: readGarden(store, violations), problems: violations.length };
}

/* ------------------------------------------------------------ the shell */

function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  const { store, sceneHref = "/" } = context;
  const { garden, problems } = useGarden(context);
  const location = useLocation();
  const counts: Record<string, number> = {
    plot: garden.plots.length,
    gardener: garden.gardeners.length,
    planting: garden.growing.length,
    rule: garden.rules.length,
  };
  const here = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  void store;
  return (
    <div className="sb" data-testid="seedbed-design">
      <style>{CSS}</style>
      <aside className="sb-rail">
        <Link to="/" className="sb-mark" data-testid="masthead">
          <Sprout size={20} /> Seedbed
        </Link>
        <nav className="sb-nav" aria-label="The garden">
          <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>
            The garden
          </Link>
          {KINDS.map((entry) => (
            <Link key={entry.kind} to={`/${entry.slug}`} aria-current={here(`/${entry.slug}`) ? "page" : undefined}>
              <span className="dot" style={{ background: `hsl(${entry.hue} 50% 50%)` }} aria-hidden="true" />
              {entry.label}
              <span className="n">{counts[entry.kind]}</span>
            </Link>
          ))}
          <Link to="/problems" aria-current={here("/problems") ? "page" : undefined}>
            <span className="dot" style={{ background: problems > 0 ? "var(--graview-warn)" : "var(--sb-leaf)" }} aria-hidden="true" />
            What needs doing
            <span className="n">{problems}</span>
          </Link>
        </nav>
        <p className={`sb-standing${problems > 0 ? " bad" : ""}`} data-testid="standing-card">
          <b>{problems === 0 ? "The garden keeps its agreements." : `${problems} ${problems === 1 ? "agreement is" : "agreements are"} not kept.`}</b>
          {garden.growing.length} growing, {garden.past.length} past, {garden.gardeners.length} {garden.gardeners.length === 1 ? "gardener" : "gardeners"}.
          <br />
          <a href={sceneHref} className="sb-scene" title="The same garden, as a scene">
            Open the scene ↗
          </a>
        </p>
      </aside>
      {/* One main per document: inside somebody else's page this is a section. */}
      {/*
        * THE LANDMARK, ONCE. Standalone the design owns the document's main;
        * embedded, the host owns that and the EMBED has already made a
        * region carrying the name the page gave it ("Chapter 13"). Naming
        * this one as well put two regions called "The garden" on any page
        * holding two embeds of the same design — the landmark said twice,
        * which axe reports as `landmark-unique`.
        */}
      {context.embedded ? <section className="sb-main">{children}</section> : <main className="sb-main">{children}</main>}
    </div>
  );
}

/* ---------------------------------------------------------- the acts */

/**
 * THE ACTS THE DERIVATION OFFERS — never a scan of the mutations by name.
 *
 * This took `names={["tend"]}` and asked `store.permits` for years: the
 * permission question, not the askability one. So a plot with no gardener
 * anywhere offered "Name a caretaker" over an empty picker, a gardener's
 * own page offered "Name a caretaker" beside each untended plot — the
 * near end's words on the far end's page, W-040's defect in the worked
 * example the skill points readers at — and a plot already hers was
 * offered to her again. `recordFacts(...).actions` and
 * `kindFacts(...).actions` are the same `AffordanceSet` the scene's strip
 * reads: what can act, each with its arguments decided and its questions
 * left; what is withheld, with the policy's own sentence. `only` narrows
 * a section to the acts it is about, from that list.
 */
function Acts({ context, actions, only }: { context: Ctx; actions: AffordanceSet; only?: readonly string[] }) {
  const { store } = context;
  const [open, setOpen] = useState<string | null>(null);
  /*
   * THE KEYBOARD COMES BACK TO THE ACT. The form is mounted in place when
   * its button is pressed and unmounted when it is done — and a removed
   * element takes focus to <body> with it, so an act taken from the
   * keyboard ended at the top of the document. The button that opened it
   * is where the keyboard was, and where it belongs after.
   */
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const box = useRef<HTMLDivElement | null>(null);
  const comeBack = useRef<{ id: string; heading: HTMLElement | null } | null>(null);
  const done = (id: string) => {
    // The act may not be offered once it has acted; the heading its section
    // stood under is then the honest home, found now while the box is here.
    const heading = box.current?.parentElement?.closest("section, main, article")?.querySelector<HTMLElement>("h1, h2, h3") ?? null;
    comeBack.current = { id, heading };
    setOpen(null);
  };
  // After the commit: the acts re-render with the graph, so the button is
  // found by the act's id once the page has settled, not before.
  useEffect(() => {
    if (comeBack.current === null) return;
    const { id, heading } = comeBack.current;
    comeBack.current = null;
    const button = buttons.current.get(id) ?? buttons.current.values().next().value;
    if (button) {
      button.focus();
      return;
    }
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  });
  const offered = actions.affordances.filter((a) => !only || only.includes(a.mutation));
  const withheld = actions.withheld.filter((w) => !only || only.includes(w.mutation));
  if (offered.length === 0 && withheld.length === 0) return null;
  const opened = offered.find((a) => a.id === open);
  const mutation = opened ? store.allMutations().find((m) => m.name === opened.mutation) : undefined;
  return (
    <div ref={box} style={{ display: "grid", gap: 12 }} data-testid="record-actions">
      <div className="sb-acts">
        {offered.map((a) => (
          <button
            key={a.id}
            ref={(el) => {
              if (el) buttons.current.set(a.id, el);
              else buttons.current.delete(a.id);
            }}
            type="button"
            className="sb-act"
            aria-expanded={open === a.id}
            onClick={() => setOpen(open === a.id ? null : a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {withheld.length > 0 ? (
        <p className="sb-withheld" data-testid="withheld">
          {withheld.map((w) => (
            <span key={w.id}>
              <s>{w.label}</s> — {w.refusal.message}{" "}
            </span>
          ))}
        </p>
      ) : null}
      {opened && mutation ? (
        <div className="sb-form">
          <span className="sb-tag">{opened.label}</span>
          {mutation.description ? <p style={{ margin: 0, color: "var(--graview-ink-muted)", fontSize: "0.875rem" }}>{mutation.description}</p> : null}
          <DerivedForm<S> store={store} mutation={mutation} prefilled={opened.args} {...(context.principal ? { principal: context.principal as Principal } : {})} open={opened.open} label={opened.label} onDone={() => done(opened.id)} />
        </div>
      ) : null}
    </div>
  );
}

/** What can BEGIN these kinds, as the seat at the keyboard — the list page's question. */
function beginsOf(context: Ctx, kinds: readonly string[]): AffordanceSet {
  const { store, principal } = context;
  const sets = kinds.map((kind) => kindFacts(store, kind, principal ? { principal: principal as Principal } : {}).actions);
  return {
    affordances: sets.flatMap((set) => set.affordances),
    withheld: sets.flatMap((set) => set.withheld),
    observations: sets.flatMap((set) => set.observations),
    ms: sets.reduce((total, set) => total + set.ms, 0),
  };
}

/** The derivation's answer for a record, as the seat at the keyboard. */
function factsOf(context: Ctx, id: string) {
  const { store, principal, invariantContext } = context;
  return recordFacts(store, id, { ...(principal ? { principal: principal as Principal } : {}), ...(invariantContext ? { context: invariantContext } : {}) });
}

/* ---------------------------------------------------------- the home */

function Beds({ plot, size = 22 }: { plot: GardenPlot; size?: number }) {
  return (
    <div className="sb-beds" aria-label={`${plot.beds} beds, ${plot.growing.length} sown`}>
      {Array.from({ length: plot.beds }, (_, bed) => {
        const sown = plot.growing[bed];
        return (
          <span key={bed} className={`sb-bed${sown ? "" : " empty"}`} style={{ width: size, height: size + 4 }} title={sown ? `${sown.label}, sown ${sown.sown}` : "an empty bed"}>
            {sown ? <Sprout size={size - 6} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function PlotCard({ plot, schema }: { plot: GardenPlot; schema: AnySchema }) {
  const untended = plot.caretaker === null;
  return (
    <Link to={recordPath(schema, "plot", plot.id)} className={`sb-card${untended ? " bad" : ""}`} data-testid={`plot-card-${plot.id}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3>{plot.label}</h3>
        <span className={`sb-avatar${untended ? " none" : ""}`} style={{ marginLeft: "auto", width: 28, height: 28, fontSize: "0.625rem" }} title={plot.caretaker?.label ?? "nobody looks after it"}>
          {plot.caretaker ? initials(plot.caretaker.label) : "?"}
        </span>
      </div>
      <Beds plot={plot} />
      <span className="meta">
        {plot.growing.length > 0 ? plot.growing.map((p) => p.label).join(", ") : "nothing sown"}
        {plot.past.length > 0 ? ` · ${plot.past.length} past` : ""}
        {untended ? " · nobody tends it" : ` · ${plot.caretaker!.label}`}
      </span>
    </Link>
  );
}

function Home({ context }: { context: Ctx }) {
  const { store } = context;
  const { garden, problems } = useGarden(context);
  const untended = garden.plots.filter((plot) => plot.caretaker === null);
  return (
    <div data-testid="seedbed-home">
      <header>
        <p className="sb-eyebrow">The garden, this season</p>
        <h1 className="sb-h1">{problems === 0 ? "Every plot has someone." : `${untended.length === 1 ? "One plot waits" : `${untended.length} plots wait`} for a caretaker.`}</h1>
        <p className="sb-lede">
          {garden.plots.length} {garden.plots.length === 1 ? "plot" : "plots"}, {garden.growing.length} {garden.growing.length === 1 ? "thing" : "things"} in the ground
          {garden.past.length > 0 ? `, ${garden.past.length} already harvested` : ""}, and {garden.gardeners.length} {garden.gardeners.length === 1 ? "pair" : "pairs"} of hands.
          {garden.rules.length > 0 ? ` The garden holds itself to ${garden.rules.length === 1 ? "one agreement" : `${garden.rules.length} agreements`}.` : ""}
        </p>
      </header>

      <section className="sb-section" aria-labelledby="sb-map-h">
        <header>
          <h2 className="sb-h2" id="sb-map-h">The plots, where they lie</h2>
          <Link to="/plots" className="more">All plots →</Link>
        </header>
        <GardenMapPicture
          garden={garden}
          aspect={2.6}
          plot={(plot, drawn) => (
            <Link to={recordPath(store.schema, "plot", plot.id)} style={{ display: "contents" }} aria-label={`${plot.label}, ${plot.caretaker ? `looked after by ${plot.caretaker.label}` : "nobody looks after it"}`}>
              {drawn}
            </Link>
          )}
        />
      </section>

      <section className="sb-section" aria-labelledby="sb-hands-h">
        <header>
          <h2 className="sb-h2" id="sb-hands-h">Whose hands</h2>
          <Link to="/gardeners" className="more">All gardeners →</Link>
        </header>
        <div className="sb-grid">
          {garden.gardeners.map((gardener) => (
            <Link key={gardener.id} to={recordPath(store.schema, "gardener", gardener.id)} className="sb-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="sb-avatar">{initials(gardener.label)}</span>
                <h3>{gardener.label}</h3>
              </div>
              <span className="meta">{gardener.plots.length > 0 ? `looks after ${gardener.plots.map((p) => p.label).join(" and ")}` : "looks after nothing yet"}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sb-section" aria-labelledby="sb-ground-h">
        <header>
          <h2 className="sb-h2" id="sb-ground-h">In the ground</h2>
          <Link to="/plantings" className="more">All plantings →</Link>
        </header>
        {garden.growing.length === 0 ? (
          <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>Nothing is growing yet.</p>
        ) : (
          <div>
            {garden.growing.map((planting) => (
              <div className="sb-row" key={planting.id}>
                <span style={{ color: "var(--sb-leaf)" }}><Sprout size={18} /></span>
                <Link to={recordPath(store.schema, "planting", planting.id)} className="grow" style={{ fontWeight: 600 }}>{planting.label}</Link>
                <span className="k">sown {planting.sown}</span>
                {planting.plot ? <Link to={recordPath(store.schema, "plot", planting.plot.id)} className="sb-pill">{planting.plot.label}</Link> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sb-section" aria-labelledby="sb-agree-h">
        <header>
          <h2 className="sb-h2" id="sb-agree-h">Agreements</h2>
          <Link to="/rules" className="more">All agreements →</Link>
        </header>
        {garden.rules.length === 0 ? (
          <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>The garden has not agreed to anything yet.</p>
        ) : (
          <div>
            {garden.rules.map((rule) => (
              <div className="sb-row" key={rule.id}>
                <Link to={recordPath(store.schema, "rule", rule.id)} className="grow" style={{ fontWeight: 600 }}>{rule.label}</Link>
                <span className={`sb-pill${rule.broken.length > 0 ? " warn" : " leaf"}`}>{rule.broken.length > 0 ? `${rule.broken.length} not kept` : "kept"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sb-section" aria-labelledby="sb-do-h">
        <header>
          <h2 className="sb-h2" id="sb-do-h">Do something</h2>
        </header>
        <Acts context={context} actions={beginsOf(context, ["plot", "gardener", "planting", "rule"])} />
      </section>
    </div>
  );
}

/* ---------------------------------------------------------- the lists */

function Plots({ context }: { context: Ctx }) {
  const { store } = context;
  const { garden } = useGarden(context);
  return (
    <div data-testid="seedbed-plots">
      <header>
        <p className="sb-eyebrow">Plots</p>
        <h1 className="sb-h1">Every patch of ground.</h1>
        <p className="sb-lede">{garden.plots.length} plots. A plot is beds, a caretaker, and whatever is sown in it this season.</p>
      </header>
      <section className="sb-section">
        <div className="sb-grid">
          {garden.plots.map((plot) => (
            <PlotCard key={plot.id} plot={plot} schema={store.schema} />
          ))}
        </div>
        <Acts context={context} actions={beginsOf(context, ["plot"])} />
      </section>
    </div>
  );
}

function Gardeners({ context }: { context: Ctx }) {
  const { store } = context;
  const { garden } = useGarden(context);
  return (
    <div data-testid="seedbed-gardeners">
      <header>
        <p className="sb-eyebrow">Gardeners</p>
        <h1 className="sb-h1">Soil under their nails.</h1>
        <p className="sb-lede">{garden.gardeners.length} gardeners, and what each of them looks after.</p>
      </header>
      <section className="sb-section">
        <div>
          {garden.gardeners.map((gardener) => (
            <div className="sb-row" key={gardener.id}>
              <span className="sb-avatar">{initials(gardener.label)}</span>
              <Link to={recordPath(store.schema, "gardener", gardener.id)} className="grow" style={{ fontWeight: 600, fontSize: "1.0625rem" }}>{gardener.label}</Link>
              {gardener.plots.length === 0 ? <span className="k">looks after nothing yet</span> : gardener.plots.map((plot) => (
                <Link key={plot.id} to={recordPath(store.schema, "plot", plot.id)} className="sb-pill">{plot.label}</Link>
              ))}
            </div>
          ))}
        </div>
        <Acts context={context} actions={beginsOf(context, ["gardener"])} />
      </section>
    </div>
  );
}

function Plantings({ context }: { context: Ctx }) {
  const { store } = context;
  const { garden } = useGarden(context);
  const rows = [...garden.growing, ...garden.past.map((p) => ({ ...p, plot: (store.graph.out(p.id, "grows-in")[0] as { id: string; label: string } | undefined) ?? null }))];
  return (
    <div data-testid="seedbed-plantings">
      <header>
        <p className="sb-eyebrow">Plantings</p>
        <h1 className="sb-h1">From sowing to harvest.</h1>
        <p className="sb-lede">{garden.growing.length} in the ground, {garden.past.length} behind the horizon. A harvested planting leaves the counts and never the record.</p>
      </header>
      <section className="sb-section">
        <table className="sb-table">
          <thead>
            <tr><th>Planting</th><th>Sown</th><th>Where</th><th>Standing</th></tr>
          </thead>
          <tbody>
            {rows.map((planting) => (
              <tr key={planting.id}>
                <td><Link to={recordPath(store.schema, "planting", planting.id)}>{planting.label}</Link></td>
                <td>{planting.sown}</td>
                <td>{planting.plot ? <Link to={recordPath(store.schema, "plot", planting.plot.id)} className="sb-pill">{planting.plot.label}</Link> : "—"}</td>
                <td><span className={`sb-pill${planting.status === "growing" ? " leaf" : ""}`}>{planting.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Acts context={context} actions={beginsOf(context, ["planting"])} />
      </section>
    </div>
  );
}

function Rules({ context }: { context: Ctx }) {
  const { store } = context;
  const { garden } = useGarden(context);
  return (
    <div data-testid="seedbed-rules">
      <header>
        <p className="sb-eyebrow">Agreements</p>
        <h1 className="sb-h1">What the garden holds itself to.</h1>
        <p className="sb-lede">An agreement is a thing on the map, adopted once, and judged every time the garden changes.</p>
      </header>
      <section className="sb-section">
        <div>
          {garden.rules.map((rule) => (
            <div className="sb-row" key={rule.id}>
              <Link to={recordPath(store.schema, "rule", rule.id)} className="grow" style={{ fontWeight: 600, fontSize: "1.0625rem" }}>{rule.label}</Link>
              <span className={`sb-pill${rule.broken.length > 0 ? " warn" : " leaf"}`}>{rule.broken.length > 0 ? `${rule.broken.length} not kept` : "kept"}</span>
            </div>
          ))}
        </div>
        <Acts context={context} actions={beginsOf(context, ["rule"])} />
      </section>
    </div>
  );
}

/* --------------------------------------------------------- the records */

function useRecord(context: Ctx): { id: string; garden: Garden } {
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const { garden } = useGarden(context);
  return { id, garden };
}

function Missing({ what }: { what: string }) {
  return <h1 className="sb-h1">No such {what}.</h1>;
}

function PlotRecord({ context }: { context: Ctx }) {
  const { store } = context;
  const { id, garden } = useRecord(context);
  const plot = garden.plots.find((p) => p.id === id);
  const facts = factsOf(context, id);
  if (!plot || !facts) return <Missing what="plot" />;
  const untended = plot.caretaker === null;
  return (
    <div data-testid="plot-page">
      <header>
        <p className="sb-eyebrow">A plot</p>
        <h1 className="sb-h1">{plot.label}</h1>
        <p className="sb-lede">
          {plot.beds} {plot.beds === 1 ? "bed" : "beds"}, {plot.caretaker ? `looked after by ${plot.caretaker.label}` : "and nobody looks after it yet"}.
          {plot.growing.length > 0 ? ` Growing now: ${plot.growing.map((p) => p.label).join(", ")}.` : " Nothing is growing."}
        </p>
        <p style={{ margin: "10px 0 0" }}>
          <a href={spatialHref(id)} className="sb-scene" data-testid="spatial-link">See it in the scene ↗</a>
        </p>
      </header>
      {untended ? (
        <section className="sb-section" data-testid="record-violations">
          <div className="sb-trouble">
            {plot.trouble.map((line, index) => <p key={index}>{line}</p>)}
            <Acts context={context} actions={facts.actions} only={["tend"]} />
          </div>
        </section>
      ) : null}
      <section className="sb-section" aria-label="The beds">
        <header><h2 className="sb-h2">The beds</h2></header>
        <Beds plot={plot} size={44} />
        <div>
          {plot.growing.map((planting) => (
            <div className="sb-row" key={planting.id}>
              <span style={{ color: "var(--sb-leaf)" }}><Sprout size={18} /></span>
              <Link to={recordPath(store.schema, "planting", planting.id)} className="grow" style={{ fontWeight: 600 }}>{planting.label}</Link>
              <span className="k">sown {planting.sown}</span>
            </div>
          ))}
          {plot.past.map((planting) => (
            <div className="sb-row" key={planting.id} style={{ opacity: 0.7 }}>
              <span style={{ color: "var(--graview-ink-faint)" }}><Sprout size={18} /></span>
              <Link to={recordPath(store.schema, "planting", planting.id)} className="grow">{planting.label}</Link>
              <span className="k">{planting.status}, sown {planting.sown}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="sb-section" aria-label="Whose hands">
        <header><h2 className="sb-h2">Whose hands</h2></header>
        <div className="sb-row">
          <span className={`sb-avatar${untended ? " none" : ""}`}>{plot.caretaker ? initials(plot.caretaker.label) : "?"}</span>
          {plot.caretaker ? (
            <Link to={recordPath(store.schema, "gardener", plot.caretaker.id)} className="grow" style={{ fontWeight: 600 }}>{plot.caretaker.label}</Link>
          ) : (
            <span className="grow" style={{ color: "var(--graview-warn)" }}>Nobody, yet.</span>
          )}
        </div>
        {!untended ? <Acts context={context} actions={facts.actions} only={["tend"]} /> : null}
      </section>
      <section className="sb-section" aria-label="Sow something">
        <header><h2 className="sb-h2">Sow something here</h2></header>
        <Acts context={context} actions={facts.actions} only={["sow"]} />
      </section>
    </div>
  );
}

function GardenerRecord({ context }: { context: Ctx }) {
  const { store } = context;
  const { id, garden } = useRecord(context);
  const gardener = garden.gardeners.find((g) => g.id === id);
  const facts = factsOf(context, id);
  if (!gardener || !facts) return <Missing what="gardener" />;
  const plots = garden.plots.filter((plot) => plot.caretaker?.id === id);
  return (
    <div data-testid="gardener-page">
      <header style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <span className="sb-avatar" style={{ width: 64, height: 64, fontSize: "1.25rem" }}>{initials(gardener.label)}</span>
        <div>
          <p className="sb-eyebrow">A gardener</p>
          <h1 className="sb-h1">{gardener.label}</h1>
          <p className="sb-lede" style={{ marginTop: 6 }}>{plots.length > 0 ? `Looks after ${plots.map((p) => p.label).join(" and ")}.` : "Looks after nothing yet."}</p>
        </div>
      </header>
      <section className="sb-section" aria-label="Their plots">
        <header><h2 className="sb-h2">Their plots</h2></header>
        {plots.length > 0 ? (
          <div className="sb-grid">{plots.map((plot) => <PlotCard key={plot.id} plot={plot} schema={store.schema} />)}</div>
        ) : (
          <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>No plot names {gardener.label} as its caretaker. The untended plots below could.</p>
        )}
        {garden.plots.filter((plot) => plot.caretaker === null).length > 0 ? (
          <div>
            {garden.plots.filter((plot) => plot.caretaker === null).map((plot) => (
              <div className="sb-row" key={plot.id}>
                <Link to={recordPath(store.schema, "plot", plot.id)} className="grow" style={{ fontWeight: 600 }}>{plot.label}</Link>
                <span className="k" style={{ color: "var(--graview-warn)" }}>nobody tends it</span>
              </div>
            ))}
          </div>
        ) : null}
        {/* From HER end: the act reads "Take on a plot", and asks which — the derivation decides whether there is one to take. */}
        <Acts context={context} actions={facts.actions} only={["tend"]} />
      </section>
    </div>
  );
}

function PlantingRecord({ context }: { context: Ctx }) {
  const { store } = context;
  const { id, garden } = useRecord(context);
  const planting = [...garden.growing, ...garden.past].find((p) => p.id === id);
  const facts = factsOf(context, id);
  if (!planting || !facts) return <Missing what="planting" />;
  const plot = (store.graph.out(id, "grows-in")[0] as { id: string; label: string } | undefined) ?? null;
  return (
    <div data-testid="planting-page">
      <header>
        <p className="sb-eyebrow">A planting · {planting.status}</p>
        <h1 className="sb-h1">{planting.label}</h1>
        <p className="sb-lede">Sown {planting.sown}{plot ? `, in ${plot.label}` : ""}. {planting.status === "growing" ? "Still in the ground." : `Behind the horizon: ${planting.status}.`}</p>
      </header>
      {plot ? (
        <section className="sb-section" aria-label="Where">
          <header><h2 className="sb-h2">Where</h2></header>
          <div className="sb-grid">{garden.plots.filter((p) => p.id === plot.id).map((p) => <PlotCard key={p.id} plot={p} schema={store.schema} />)}</div>
        </section>
      ) : null}
      {planting.status === "growing" ? (
        <section className="sb-section" aria-label="Harvest">
          <header><h2 className="sb-h2">When it is ready</h2></header>
          <Acts context={context} actions={facts.actions} only={["harvest"]} />
        </section>
      ) : null}
    </div>
  );
}

function RuleRecord({ context }: { context: Ctx }) {
  const { store, invariantContext } = context;
  const { id, garden } = useRecord(context);
  const rule = garden.rules.find((r) => r.id === id);
  if (!rule) return <Missing what="agreement" />;
  const violations = store.violations(invariantContext).filter((v) => v.subjectId === id);
  return (
    <div data-testid="rule-page">
      <header>
        <p className="sb-eyebrow">An agreement · {violations.length === 0 ? "kept" : "not kept"}</p>
        <h1 className="sb-h1">{rule.label}</h1>
        <p className="sb-lede">{violations.length === 0 ? "Every plot keeps it." : `${violations.length} ${violations.length === 1 ? "plot does" : "plots do"} not keep it, and each says what would.`}</p>
      </header>
      {violations.length > 0 ? (
        <section className="sb-section" data-testid="record-violations">
          {violations.map((violation, index) => (
            <div className="sb-trouble" key={index}>
              <p>{violation.message}</p>
              <div className="sb-acts">
                {violation.repairs.map((repair, at) => (
                  <button key={at} type="button" className="sb-act" onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}>
                    {repair.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- what needs doing */

function Problems({ context }: { context: Ctx }) {
  const { store, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  return (
    <div data-testid="seedbed-problems">
      <header>
        <p className="sb-eyebrow">What needs doing</p>
        <h1 className="sb-h1">{violations.length === 0 ? "Nothing. The garden keeps its agreements." : `${violations.length} ${violations.length === 1 ? "thing" : "things"}, each with a way to put it right.`}</h1>
      </header>
      <section className="sb-section">
        {violations.map((violation, index) => (
          <div className="sb-trouble" key={index}>
            <p>{violation.message}</p>
            <div className="sb-acts">
              {violation.repairs.map((repair, at) => (
                <button key={at} type="button" className="sb-act" onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}>
                  {repair.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/** The garden's own design: every surface and every page replaced, over the same store. */
export function seedbedDesign(schema: AnySchema) {
  const page = (component: (props: { context: Ctx }) => ReactNode) => component as PageComponent<S>;
  return createPageRegistry<S, PageComponent<S>>(schema as never)
    .surface("shell", Shell as PageComponent<S>)
    .surface("home", page(Home))
    .surface("problems", page(Problems))
    .register("plot", "list", page(Plots))
    .register("plot", "record", page(PlotRecord))
    .register("gardener", "list", page(Gardeners))
    .register("gardener", "record", page(GardenerRecord))
    .register("planting", "list", page(Plantings))
    .register("planting", "record", page(PlantingRecord))
    .register("rule", "list", page(Rules))
    .register("rule", "record", page(RuleRecord));
}
