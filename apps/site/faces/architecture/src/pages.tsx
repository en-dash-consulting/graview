import type { AnySchema, GraviewApp } from "@graview/core";
import {
  createPageRegistry,
  PageFind,
  PageMain,
  pageStyles,
  PageUndo,
  recordFacts,
  recordPath,
  Repairs,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import type { ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";

type S = AnySchema;
type Page = PageComponent<S>;

/** The preview's own page, where its scene lives: a record's "See it on the map" goes there. */
const PREVIEW = (import.meta as { env?: Record<string, string | undefined> }).env?.["GRAVIEW_PREVIEW"] ?? "http://localhost:4800";
export const SCENE = `${PREVIEW}/places/overview`;

interface Zone {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly summary?: string;
}

/** Every zone, its modules and its owners, read off the graph as this seat sees it. */
function zonesOf(context: PageContext<S>) {
  const graph = context.principal ? context.store.seenBy(context.principal).graph : context.store.graph;
  const edges = graph.allEdges();
  return (graph.nodesOfKind("zone" as never) as unknown as Zone[]).map((zone) => ({
    zone,
    modules: edges.filter((edge) => edge.kind === "inZone" && edge.to === zone.id).map((edge) => graph.getNode(edge.from)!),
    owners: edges.filter((edge) => edge.kind === "ownedBy" && edge.from === zone.id).map((edge) => graph.getNode(edge.to)!),
  }));
}

/** THE FRAME AROUND EVERY ROUTE: the app's name, the team's own words for where to go, and Find and Undo in its own row. */
function Shell({ context, children }: { context: PageContext<S>; children: ReactNode }) {
  useStoreTick(context.store);
  const problems = context.store.violations().length;
  const link = ({ isActive }: { isActive: boolean }) => ({ ...pageStyles.link, fontWeight: isActive ? 650 : 450 });
  return (
    <div style={{ minHeight: "100dvh", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <header data-testid="face-shell" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--graview-edge)" }}>
        <strong style={{ fontFamily: "var(--graview-font-display)" }}>{context.app?.name ?? "Architecture"}</strong>
        <nav aria-label="Where to go" style={{ display: "flex", gap: 14 }}>
          <NavLink to="/" end style={link}>Zones</NavLink>
          <NavLink to="/modules" style={link}>Modules</NavLink>
          <NavLink to="/owners" style={link}>Owners</NavLink>
          <NavLink to="/problems" style={link}>{problems > 0 ? `Problems (${problems})` : "Problems"}</NavLink>
        </nav>
        <span style={{ flex: 1 }} />
        <PageFind context={context} />
        <PageUndo context={context} />
      </header>
      {children}
    </div>
  );
}

/** THE HOME: every zone as a card, its modules counted and who owns it said. */
function Home({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  return (
    <PageMain context={context} data-testid="face-home">
      <h1 style={pageStyles.h1}>Zones</h1>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))" }}>
        {zonesOf(context).map(({ zone, modules, owners }) => (
          <li key={zone.id} data-zone={zone.id} style={{ ...pageStyles.rule, display: "grid", gap: 4 }}>
            <Link to={recordPath(context.store.schema, "zone", zone.id)} style={pageStyles.link}>
              <strong>{zone.name}</strong>
            </Link>
            <span style={pageStyles.quiet}>{modules.length === 1 ? "1 module" : `${modules.length} modules`} · {owners.length === 0 ? "no owner" : owners.map((owner) => String(owner["handle"])).join(", ")}</span>
          </li>
        ))}
      </ul>
    </PageMain>
  );
}

/** A ROUTE ABOUT NO ONE KIND: who owns what, by person. */
function Owners({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  const zones = zonesOf(context);
  const people = context.store.graph.nodesOfKind("person" as never) as unknown as { id: string; handle: string }[];
  return (
    <PageMain context={context} data-testid="face-owners">
      <h1 style={pageStyles.h1}>Owners</h1>
      <dl style={{ display: "grid", gap: 8 }}>
        {people.map((person) => (
          <div key={person.id}>
            <dt><strong>{person.handle}</strong></dt>
            <dd style={{ margin: 0 }}>{zones.filter(({ owners }) => owners.some((owner) => owner.id === person.id)).map(({ zone }) => zone.name).join(", ") || "Owns no zone"}</dd>
          </div>
        ))}
      </dl>
    </PageMain>
  );
}

/** A ZONE'S PAGE in the team's words: what it is for, its owners, its modules, and what the rules say is missing, with the repair. */
function ZonePage({ context }: { context: PageContext<S> }) {
  const { store, principal } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, principal ? { principal } : {});
  const found = zonesOf(context).find(({ zone }) => zone.id === id);
  if (!facts || !found) {
    return (
      <PageMain context={context}>
        <h1 style={pageStyles.h1}>No zone lives at this address.</h1>
      </PageMain>
    );
  }
  return (
    <PageMain context={context} data-testid="zone-page">
      <p style={pageStyles.eyebrow}>Zone</p>
      <h1 style={pageStyles.h1}>{found.zone.name}</h1>
      {found.zone.summary ? <p style={pageStyles.lede}>{found.zone.summary}</p> : null}
      <a href={spatialHref(id, context.sceneHref)} style={{ ...pageStyles.link, ...pageStyles.quiet }} data-testid="spatial-link">
        See it on the map ↗
      </a>
      {facts.violations.map((violation, index) => (
        <section key={index} style={{ ...pageStyles.rule, display: "grid", gap: 8 }} data-testid="zone-problem">
          <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
          <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
        </section>
      ))}
      <h2 style={pageStyles.h2}>Owned by</h2>
      <p>{found.owners.map((owner) => String(owner["handle"])).join(", ") || "No one yet."}</p>
      <h2 style={pageStyles.h2}>Modules</h2>
      <ul data-testid="zone-modules">
        {found.modules.map((module) => (
          <li key={module.id}>
            <Link to={recordPath(store.schema, "module", module.id)} style={pageStyles.link}>
              {String(module["path"])}
            </Link>
          </li>
        ))}
      </ul>
    </PageMain>
  );
}

/** Your pages over the derived ones: every other kind's list and record, the problems page and the forms are still Graview's. */
export function pages(app: GraviewApp<S>) {
  return createPageRegistry<S, Page>(app.schema)
    .surface("shell", Shell, { without: ["find", "undo"] })
    .surface("home", Home as Page)
    .register("zone", "record", ZonePage as Page)
    .route("/owners", Owners as Page);
}
