import { labelOf, tellApart } from "@graview/core";
import {
  createPageRegistry,
  DerivedForm,
  ListPage,
  PageFind,
  PageMain,
  placePath,
  pluralSlug,
  rankedRepairs,
  recordFacts,
  recordPath,
  Repairs,
  SceneLink,
  StartFreshLink,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import type { Affordance, AffordanceSet } from "@graview/tools";
import { useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { DiscographySchema } from "../domain/schema.js";

type S = DiscographySchema;
type Ctx = PageContext<S>;
type Named = { id: string; kind: string; label: string } & Record<string, unknown>;

/*
 * LINER NOTES: Discography's own face. Paper, a serif for the names, the
 * releases in the order they came out, each with its tracklist. Every word
 * about what can be done still comes from the derivation.
 */
const CSS = `
.ln { --ln-paper: color-mix(in srgb, var(--graview-ground) 88%, #d9c9a3 12%); --ln-line: var(--graview-edge); min-height: 100vh; background: var(--ln-paper); color: var(--graview-ink); font-family: var(--graview-font-body, system-ui); font-size: 1rem; line-height: 1.55; }
.ln-top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--ln-line); }
.ln-mark { font-family: Georgia, "Times New Roman", serif; font-size: 1.375rem; font-weight: 600; color: inherit; text-decoration: none; min-height: 24px; display: inline-flex; align-items: center; }
.ln-nav { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; min-width: 0; }
.ln-nav a { color: var(--graview-ink-muted); text-decoration: none; min-height: 24px; display: inline-flex; align-items: center; gap: 0.35rem; }
.ln-nav a[aria-current="page"] { color: var(--graview-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
.ln-nav a.warn { color: var(--graview-warn); }
.ln-n { font-variant-numeric: tabular-nums; font-size: 0.8125rem; color: var(--graview-ink-muted); }
.ln-col { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.75rem; min-width: 0; }
.ln-h1 { font-family: Georgia, "Times New Roman", serif; font-size: 2rem; line-height: 1.15; margin: 0; overflow-wrap: anywhere; }
.ln-h2 { font-family: Georgia, "Times New Roman", serif; font-size: 1.25rem; margin: 0; overflow-wrap: anywhere; }
.ln-line { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 16px; padding: 5px 0; border-top: 1px solid var(--graview-edge); }
.ln-line > a { flex: 1 1 14rem; min-width: 0; font-weight: 600; color: inherit; text-decoration: none; min-height: 24px; overflow-wrap: anywhere; }
.ln-line > a:hover { text-decoration: underline; }
.ln-line > .ln-quiet { margin: 0; font-size: 0.875rem; }
.ln-eyebrow { margin: 0; font-size: 0.8125rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--graview-ink-muted); }
.ln-quiet { color: var(--graview-ink-muted); }
.ln-warn { color: var(--graview-warn); }
.ln-card { background: var(--graview-panel); border: 1px solid var(--ln-line); border-radius: 10px; padding: 1rem; display: grid; gap: 0.5rem; min-width: 0; }
.ln-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); gap: 1rem; }
.ln-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.15rem; }
.ln-list a, .ln-link { color: inherit; text-decoration-color: var(--ln-line); text-underline-offset: 3px; min-height: 24px; display: inline-flex; align-items: center; }
.ln-tracks { margin: 0; padding-left: 1.75rem; display: grid; gap: 0.1rem; }
.ln-tracks a { color: inherit; min-height: 24px; display: inline-flex; align-items: center; }
.ln-btn { font: inherit; font-size: 0.9375rem; min-height: 2rem; padding: 0.25rem 0.8rem; border-radius: 999px; border: 1px solid var(--graview-edge-bright); background: var(--graview-panel); color: var(--graview-ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.ln-btn[aria-expanded="true"] { border-color: var(--graview-accent); }
.ln-row { display: flex; flex-wrap: wrap; gap: 0.5rem; min-width: 0; }
.ln-facts { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 0.25rem 1rem; margin: 0; }
.ln-facts dt { color: var(--graview-ink-muted); }
.ln-facts dd { margin: 0; overflow-wrap: anywhere; }
`;

const plural = (store: Ctx["store"], kind: string) => store.schema.tryDefinition(kind as never)?.plural ?? `${kind}s`;
const named = (store: Ctx["store"], node: Named) => labelOf(store.schema.tryDefinition(node.kind as never), node);
const flaggedIn = (context: Ctx) => new Set(context.store.violations(context.invariantContext).flatMap((violation) => violation.nodeIds));

function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  const { store, brand } = context;
  useStoreTick(store);
  const here = useLocation().pathname;
  const problems = store.violations(context.invariantContext).length;
  const kept = store.kindsKeptFrom(context.principal);
  const kinds = (store.schema.kinds as readonly string[]).filter((kind) => !kept.has(kind));
  const link = (to: string, label: string, extra?: ReactNode, warn = false) => {
    const current = to === "/" ? here === "/" : here === to || here.startsWith(`${to}/`);
    return (
      <Link key={to} to={to} className={warn ? "warn" : undefined} {...(current ? { "aria-current": "page" as const } : {})}>
        {label}
        {extra}
      </Link>
    );
  };
  return (
    <div className="ln">
      <style>{CSS}</style>
      {/* Under the app bar the bar says the name, the sections, Find and the way to the scene: only the page. */}
      {context.barAbove ? null : (
      <header className="ln-top">
        <Link to="/" className="ln-mark">{brand?.name ?? "Discography"}</Link>
        <nav className="ln-nav" aria-label="Sections">
          {link("/", "Liner notes")}
          {kinds.map((kind) => link(`/${pluralSlug(store.schema, kind)}`, plural(store, kind), <span className="ln-n">{store.graph.nodesOfKind(kind as never).length}</span>))}
          {(context.views?.places() ?? []).map((place) => link(placePath(place.as), place.title))}
          {link("/problems", "Problems", <span className="ln-n">{problems}</span>, problems > 0)}
        </nav>
        <PageFind context={context} narrowsLists={false} />
        <a className="ln-link" href={context.sceneHref ?? "/"}>In the scene ↗</a>
        {context.remembers ? (
          <span className="ln-quiet" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <span data-testid="remembered">Remembered here.</span>
            <StartFreshLink />
          </span>
        ) : null}
      </header>
      )}
      {/* The one main (a section inside an embed); the pages under it are framed. */}
      <PageMain context={context} style={{ maxWidth: "none", padding: 0, display: "block" }}>
        {children}
      </PageMain>
    </div>
  );
}

function Home({ context }: { context: Ctx }) {
  const { store } = context;
  useStoreTick(store);
  const flagged = flaggedIn(context);
  const releases = (store.graph.nodesOfKind("album") as unknown as Named[]).slice().sort((a, b) => String(a["released"] ?? "9999").localeCompare(String(b["released"] ?? "9999")));
  const songs = store.graph.nodesOfKind("song").length;
  // The single and the album are both "Blue Hour": each card says which it is, heading and landmark alike.
  const apart = tellApart(releases, (kind) => store.schema.tryDefinition(kind as never));
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <p className="ln-eyebrow">Liner notes</p>
        <h1 className="ln-h1">{releases.length} releases, {songs} songs</h1>
        <p className="ln-quiet" style={{ margin: 0 }}>In the order they came out.</p>
      </header>
      {releases.length === 0 ? (
        <p>Nothing released yet. <Link className="ln-link" to={`/${pluralSlug(store.schema, "album")}`}>Add a release</Link></p>
      ) : (
        <div className="ln-grid">
          {releases.map((release) => {
            const tracks = (store.graph.out(release.id, "tracks") as unknown as Named[]).slice().sort((a, b) => Number(a["track"] ?? 99) - Number(b["track"] ?? 99));
            return (
              <section key={release.id} className="ln-card" aria-labelledby={`r-${release.id}`}>
                <h2 className="ln-h2" id={`r-${release.id}`}>
                  <Link className="ln-link" to={recordPath(store.schema, "album", release.id)}>
                    {flagged.has(release.id) ? <span className="ln-warn">⚠&nbsp;</span> : null}
                    {named(store, release)}
                    {apart.has(release.id) ? <span className="ln-quiet"> · {apart.get(release.id)}</span> : null}
                  </Link>
                </h2>
                <p className="ln-quiet" style={{ margin: 0 }}>
                  {String(release["type"])}
                  {release["released"] ? ` · ${String(release["released"])}` : ""}
                </p>
                <ol className="ln-tracks">
                  {tracks.map((song) => (
                    <li key={song.id} {...(typeof song["track"] === "number" ? { value: song["track"] as number } : {})}>
                      <Link to={recordPath(store.schema, "song", song.id)} className={flagged.has(song.id) ? "ln-warn" : undefined}>
                        {named(store, song)}
                        {flagged.has(song.id) ? " ⚠" : ""}
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </PageMain>
  );
}

function KindList({ context, kind }: { context: Ctx; kind: string }) {
  const { store } = context;
  /*
   * THE FRAMEWORK'S LIST, WITH WHAT A CATALOG IS SCANNED BY. 479 albums were
   * a bare column of names under an eyebrow, "479 of 479 shown." and a
   * second Find: nothing to scan by and no way through. The list opens newest
   * first with a year to jump to (`ListPage`), and each row says what a
   * person reads a catalog by — whose it is, the year, what it is.
   */
  const first = (id: string, edge: string, way: "out" | "in" = "out"): string | undefined => {
    const far = (way === "out" ? store.graph.out(id, edge) : store.graph.in(id, edge))[0] as unknown as Named | undefined;
    return far ? named(store, far) : undefined;
  };
  const facts = (node: Named, glance: string): string => {
    if (kind === "album") return [first(node.id, "released-by"), typeof node["released"] === "string" ? String(node["released"]).slice(0, 4) : undefined, node["type"] === "ep" ? "EP" : typeof node["type"] === "string" && node["type"] !== "album" ? String(node["type"]) : undefined].filter(Boolean).join(" · ");
    if (kind === "song") return [first(node.id, "by"), first(node.id, "tracks", "in"), glance].filter(Boolean).join(" · ");
    if (kind === "artist") {
      const releases = store.graph.in(node.id, "released-by").length;
      const songs = store.graph.in(node.id, "by").length;
      return [releases ? `${releases} release${releases === 1 ? "" : "s"}` : "", songs ? `${songs} song${songs === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
    }
    return glance;
  };
  return (
    <ListPage
      context={context}
      kind={kind}
      layout="lines"
      row={(node, row) => (
        <div className="ln-line">
          <Link to={row.href} className={row.flagged ? "ln-warn" : undefined}>
            {row.label}
            {row.flagged ? " ⚠" : ""}
          </Link>
          <span className="ln-quiet">{facts(node as unknown as Named, row.glance)}</span>
        </div>
      )}
    />
  );
}

function KindRecord({ context, kind }: { context: Ctx; kind: string }) {
  const { store, principal } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, { ...(principal ? { principal } : {}), ...(context.invariantContext ? { context: context.invariantContext } : {}) });
  if (!facts) {
    return (
      <PageMain context={context}>
        <h1 className="ln-h1">Nothing lives at this address.</h1>
        <p><Link className="ln-link" to={`/${pluralSlug(store.schema, kind)}`}>Back to {plural(store, kind).toLowerCase()}</Link></p>
      </PageMain>
    );
  }
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <p className="ln-eyebrow"><Link className="ln-link" to={`/${pluralSlug(store.schema, kind)}`}>{plural(store, kind)}</Link></p>
        <h1 className="ln-h1">{facts.label}</h1>
        <SceneLink context={context} stop={`#focus=${encodeURIComponent(id)}`} className="ln-link" data-testid="spatial-link" />
      </header>
      {facts.violations.map((violation, at) => (
        <section key={at} className="ln-card" data-testid="record-violations">
          <p className="ln-warn" style={{ margin: 0, fontWeight: 600 }}>{violation.message}</p>
          <Repairs<S> store={store} repairs={rankedRepairs(facts.actions, violation.repairs)} {...(principal ? { principal } : {})} />
        </section>
      ))}
      {facts.fields.length > 0 ? (
        <dl className="ln-facts">
          {facts.fields.map((field) => (
            <div key={field.key} style={{ display: "contents" }}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {facts.links.map((group) => (
        <section key={`${group.edgeKind}|${group.direction}`} style={{ display: "grid", gap: "0.35rem" }}>
          <h2 className="ln-h2">{(group.description ?? group.edgeKind).replace(/^./, (first) => first.toUpperCase())}</h2>
          <ul className="ln-list">
            {group.targets.map((target) => (
              <li key={target.id}><Link to={recordPath(store.schema, target.kind, target.id)}>{target.label}</Link></li>
            ))}
          </ul>
        </section>
      ))}
      <Acts title="What can be done" actions={facts.actions} context={context} />
    </PageMain>
  );
}

function Problems({ context }: { context: Ctx }) {
  const { store, principal } = context;
  useStoreTick(store);
  const violations = store.violations(context.invariantContext);
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <p className="ln-eyebrow">Problems</p>
        <h1 className="ln-h1">{violations.length === 0 ? "Everything holds" : `${violations.length} to put right`}</h1>
      </header>
      {violations.map((violation, at) => {
        const about = violation.subjectId ? store.graph.getNode(violation.subjectId) : undefined;
        return (
          <section key={at} className="ln-card">
            <p className="ln-warn" style={{ margin: 0, fontWeight: 600 }}>{violation.message}</p>
            {about ? <Link className="ln-link" to={recordPath(store.schema, about.kind, about.id)}>{named(store, about as unknown as Named)}</Link> : null}
            <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
          </section>
        );
      })}
    </PageMain>
  );
}

/** Every act the derivation offers, a form opening where it is; the withheld struck through with why. */
function Acts({ title, actions, context }: { title: string; actions: AffordanceSet; context: Ctx }) {
  const { store, principal } = context;
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  if (actions.affordances.length === 0 && actions.withheld.length === 0) return null;
  const done = (affordance: Affordance) => {
    setOpen(null);
    requestAnimationFrame(() => buttons.current.get(affordance.id)?.focus());
  };
  return (
    <section style={{ display: "grid", gap: "0.6rem" }} data-testid="record-actions">
      <h2 className="ln-h2">{title}</h2>
      <div className="ln-row">
        {actions.affordances.map((affordance) => (
          <button
            key={affordance.id}
            ref={(element) => {
              if (element) buttons.current.set(affordance.id, element);
            }}
            type="button"
            className="ln-btn"
            aria-expanded={affordance.open.length > 0 ? open === affordance.id : undefined}
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
      {actions.affordances.map((affordance) => {
        if (open !== affordance.id) return null;
        const mutation = store.allMutations().find((candidate) => candidate.name === affordance.mutation);
        return mutation ? (
          <div key={affordance.id} className="ln-card">
            <DerivedForm<S> store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} label={affordance.label} {...(principal ? { principal } : {})} onDone={() => done(affordance)} />
          </div>
        ) : null;
      })}
      {failed ? <p className="ln-warn">{failed}</p> : null}
      {actions.withheld.length > 0 ? (
        <ul className="ln-list">
          {actions.withheld.map((held) => (
            <li key={held.id} className="ln-quiet" data-testid="withheld"><s>{held.label}</s> — {held.refusal.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Every surface, in Discography's own words. */
export function linerNotes(schema: S) {
  let registry = createPageRegistry<S, PageComponent<S>>(schema)
    .surface("shell", Shell)
    .surface("home", Home)
    .surface("problems", Problems);
  for (const kind of schema.kinds) {
    const List = ({ context }: { context: Ctx }) => <KindList context={context} kind={kind} />;
    const Record = ({ context }: { context: Ctx }) => <KindRecord context={context} kind={kind} />;
    registry = registry.register(kind, "list", List).register(kind, "record", Record);
  }
  return registry;
}
