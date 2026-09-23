import { type Ids, escapeHtml, escapeString, escapeTemplate } from "./names.js";

/*
 * THE FACES A NEW PROJECT HAS: the page, the embed, the scene, the pages
 * face and the entry that opens the store and mounts it.
 */

export function indexHtml(ids: Ids): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ids.name)}</title>
<style>
  /* The theme is injected by src/main.tsx from the declared brand; this is
     only the pre-paint ground so the page never flashes white. */
  html, body { margin: 0; background: #0b0d0b; color: #eaf0ea; }
</style>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
`;
}

/**
 * SOMEBODY ELSE'S PAGE. The last rung of the `graview-pages` skill, shipped
 * as a page rather than as a paragraph — so a project has a place to put an
 * embed, and so the project's own `pnpm typecheck` covers the embed surface.
 * Delete both files if the app is never going anywhere but its own address.
 */
export function embedHtml(ids: Ids): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ids.name)}, on somebody else's page</title>
<style>
  /* THE HOST PAGE'S OWN LOOK. Nothing here is ${escapeHtml(ids.name)}'s, and
     nothing ${escapeHtml(ids.name)} draws may reach out and change it: the
     embed themes itself inside its own element. */
  body {
    margin: 0 auto;
    max-width: 44rem;
    padding: 3rem 1.25rem 6rem;
    background: #fbfaf7;
    color: #1c1b19;
    font: 17px/1.7 Georgia, "Times New Roman", serif;
  }
  h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 1.2rem; }
  p { margin: 0 0 1.2rem; }
  .figure { margin: 1.5rem 0 2rem; height: 520px; }
</style>

<!-- The HOST page's own landmark. The embed brings a named region of its
     own and deliberately no <main>: the page it lands on owns that, and two
     mains is one landmark said twice. -->
<main>
  <h1>An ordinary page</h1>
  <p>
    Written in its own typeface, on its own paper. The picture below is
    ${escapeHtml(ids.name)}, mounted into one element of it.
  </p>
  <div class="figure" id="here"></div>
  <p>
    And the page carries on afterwards, untouched.
  </p>
</main>

<script type="module" src="/src/embed.tsx"></script>
`;
}

export function embedTsx(ids: Ids): string {
  return `import { mount } from "@graview/embed";
import { ${ids.appVar}, createStore } from "./domain/app.js";
import { views } from "./ui/views.js";

/**
 * ${escapeTemplate(ids.name).toUpperCase()} ON SOMEBODY ELSE'S PAGE.
 *
 * The embed brings its own strip, its own theme scoped to the element it is
 * given, and this app's named places — no Shell, nothing on the host page
 * touched. Pass \`seats\` once a policy exists and the reader can sit in each
 * one: the strip, the pages and the acts all narrow together.
 */
const store = createStore();

mount(document.getElementById("here")!, {
  app: ${ids.appVar},
  store,
  // The app's own registry, in the app's own schema — no casts.
  views,
  scheme: "auto",
  stop: "#overview=1",
  label: "${escapeString(ids.name)}",
});
`;
}

/* ------------------------------------------------------------------- ui */

export function viewsTsx(ids: Ids): string {
  return `import { createViews } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { ${ids.schemaVar} } from "../domain/schema.js";

/**
 * Nothing custom yet, on purpose. \`registerDefaultViews\` renders every kind
 * at every fidelity from the declaration alone. Write a view for a kind when
 * the generic one is genuinely wrong, not on principle — see the framework's
 * \`apps/todo/src/ui/views.tsx\` for one that earns its place. Give a group
 * view a title and it is a PLACE, listed by name in the bar:
 *
 *   .register("${ids.kind}", { cardinality: "many", fidelity: "full" }, lens.View, { title: "…" })
 */
export function views() {
  return registerDefaultViews(${ids.schemaVar}, createViews(${ids.schemaVar}));
}
`;
}

export function uiAppTsx(ids: Ids): string {
  return `import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, useGraph, useGraview, type Scheme } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import { templateIntelligence, type ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import { ${ids.appVar}, createStore, type ${ids.StoreType} } from "../domain/app.js";
import { ${ids.brandVar} } from "../domain/brand.js";
import type { ${ids.SchemaType} } from "../domain/schema.js";
import { views } from "./views.js";

type S = ${ids.SchemaType};

/**
 * The app opens from ALTITUDE: every kind a district, each saying how many
 * it holds — or "none yet", which is an invitation rather than a void.
 */
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, overview: true };

export interface ${ids.AppComponent}Props {
  readonly store?: ${ids.StoreType};
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  /** Whether the store behind this app is remembered in the browser (see main.tsx). */
  readonly remembers?: boolean;
}

/**
 * The whole application. \`Shell\` is the command bar, the scene, the
 * inspector and the rail, derived; what ${escapeTemplate(ids.name)} adds is a
 * sentence for when nothing is wrong and a seat for an agent. If this file
 * grows, ask whether the declaration should have grown instead.
 */
export function ${ids.AppComponent}({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
}: ${ids.AppComponent}Props) {
  const created = useMemo(() => store ?? createStore(), [store]);
  const registry = useMemo(() => views(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={registry}
      initialView={initialView}
      scheme={scheme}
      brand={${ids.brandVar}}
      settings={${ids.appVar}.settings ?? []}
    >
      <Shell<S>
        standing="Everything is in order"
        /*
         * THE APP'S OWN DECLARATION, one press away and in place. The
         * kinds, fields, edges, acts and rules of \`src/domain\` are a graph
         * here: change one with the ordinary acts, watch the checker judge
         * it, and apply to get the files to write back. Offered to the seat
         * that administers where there is one, and to whoever is here where
         * there is not — which is this project, today.
         */
        studio={<StudioPlace app={${ids.appVar}} />}
        seat={(onCall) => <Starter onCall={onCall} />}
        remembers={remembers}
        syncUrl={syncUrl}
        scheme={scheme}
        onScheme={(next) => {
          setScheme(next);
          onSchemeChange?.(next);
        }}
      />
    </GraviewProvider>
  );
}

/**
 * The seat at zero. An empty graph plus a seat that proposes starter data is
 * the "describe your domain, get a working app" moment. Every proposal is an
 * ordinary mutation through the derived tool surface — logged, attributed to
 * the seat, reviewable, undoable.
 */
function Starter({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const nodes = useGraph();
  const empty = nodes.length === 0;
  return (
    <AgentSeat<S>
      who="starter"
      testId="agent-starter"
      count={empty ? 1 : 0}
      gate="add-${ids.kind}"
      label={() => "Add some starter data"}
      busyLabel="Adding…"
      idle="There is something here already"
      onCall={onCall}
      run={async (agent) => {
        const starter = templateIntelligence<S>();
        for (const proposal of await starter.propose(store)) {
          await agent.run(proposal.mutation, { ...proposal.args });
        }
      }}
    />
  );
}
`;
}

export function pagesTsx(ids: Ids): string {
  return `import { Begin } from "@graview/primitives";
import {
  createPageRegistry,
  DefaultHomePage,
  DerivedForm,
  PageMain,
  pageStyles,
  recordFacts,
  Repairs,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import { useParams } from "react-router-dom";
import { ${ids.schemaVar}, type ${ids.SchemaType} } from "../domain/schema.js";

type S = ${ids.SchemaType};

/**
 * THE OTHER FACE, IN YOUR OWN WORDS. /pages is an ordinary routed web
 * application derived from the declaration: a list and a record per kind,
 * forms from the mutations, a problems page from the rules. Every one of
 * those can be replaced per kind — or per surface: shell, home, problems —
 * with a page you write. This is the ${ids.spoken}'s record page; delete it
 * and the derived page takes over again. Everything it shows still comes
 * from the same derivations (\`recordFacts\`, \`DerivedForm\`), so a page
 * you write cannot drift from what the graph says.
 */
function ${ids.KindPascal}Page({ context }: { context: PageContext<S> }) {
  const { store, principal, invariantContext } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const node = store.graph.getNode(id) as { label: string; status: "open" | "closed" } | undefined;
  if (!facts || !node) {
    return (
      <PageMain context={context}>
        <h1 style={pageStyles.h1}>Nothing lives at this address.</h1>
      </PageMain>
    );
  }
  /*
   * THE TIES, AS THE DECLARATION READS THEM.
   *
   * \`facts.links\` is every edge on this record, both directions, each
   * carrying the caption the declaration gives THAT end. Asking the graph
   * for one edge by name here instead — \`out(id, "depends-on")\` — is a
   * page that stops telling the truth the day the schema grows a second
   * edge, which is the first thing every project does.
   */
  const ties = facts.links;
  /*
   * THE ACTS AS THE DERIVATION OFFERS THEM, not as the declaration lists
   * them. Reaching for a mutation by name gets an act that is always there;
   * an affordance is an act that can actually be taken RIGHT NOW, and it
   * carries its candidates — everything not already tied, and never this
   * record itself. With one ${ids.spoken} in the graph there is nothing to
   * point at, so there is no form, rather than a heading over a picker with
   * one wrong answer in it.
   */
  const connecting = facts.actions.affordances.filter((affordance) => affordance.ties === true);

  return (
    <PageMain context={context} data-testid="${ids.kind}-page">
      <header style={{ display: "grid", gap: 10 }}>
        <p style={pageStyles.eyebrow}>${ids.ASpoken} in ${escapeTemplate(ids.name)}</p>
        <h1 style={pageStyles.h1}>{node.label}</h1>
        <p style={pageStyles.lede}>
          {node.status === "closed" ? "Closed." : "Still open."}{" "}
          {ties.length === 0 ? "Connected to nothing yet." : null}
        </p>
        <a href={spatialHref(id)} style={{ ...pageStyles.link, ...pageStyles.quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
      </header>
      {facts.violations.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 10 }} data-testid="record-violations">
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
              {/*
                * A repair that needs nothing is one press; one that still has
                * an argument to choose is an ask. \`Repairs\` is the same
                * component the derived problems page uses, so a page you
                * write cannot get this wrong on its own.
                */}
              <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
            </div>
          ))}
        </section>
      ) : null}
      {ties.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-ties">
          {ties.map((group) => (
            <div key={\`\${group.edgeKind}|\${group.direction}\`} style={{ display: "grid", gap: 6 }}>
              {/* The edge's own words for THIS end — its description read
                  from the end that declared it, its inverse read from the
                  other. */}
              <h2 style={pageStyles.h2}>
                {(group.description ?? group.edgeKind).replace(/^./, (first) => first.toUpperCase())}
              </h2>
              <p style={{ margin: 0 }}>{group.targets.map((target) => target.label).join(", ")}</p>
            </div>
          ))}
        </section>
      ) : null}
      {/*
        * WITHHELD, NOT HIDDEN. The affordances above are what this seat may
        * do; an act the policy refuses is in withheld, carrying the policy's
        * own sentence. Dropping it teaches a person the software is broken —
        * they watched a colleague do this yesterday and now the control is
        * gone — so it is drawn struck through with the reason beside it, the
        * way the derived pages and the scene's strip both draw it.
        */}
      {facts.actions.withheld.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 8 }} data-testid="record-withheld">
          {facts.actions.withheld.map((withheld) => (
            <p key={withheld.id} style={{ margin: 0, ...pageStyles.quiet }}>
              <s>{withheld.label}</s> — {withheld.refusal.message}
            </p>
          ))}
        </section>
      ) : null}
      {connecting.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-actions">
          {connecting.map((affordance) => {
            const act = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
            return act ? (
              <div key={affordance.id} style={{ display: "grid", gap: 10 }}>
                {/* The act's own title, and the arguments the derivation
                    already settled — never a subject name written out here. */}
                <h2 style={pageStyles.h2}>{affordance.label}</h2>
                <DerivedForm<S> store={store} mutation={act} prefilled={affordance.args} open={affordance.open} {...(principal ? { principal } : {})} />
              </div>
            ) : null;
          })}
        </section>
      ) : null}
    </PageMain>
  );
}

/**
 * THE WAY IN, on the home page, until there is a way past it.
 *
 * Every product ships empty once and it is the state its author never sees —
 * your own graph has had data in it since the first afternoon. \`Begin\` is
 * derived: it reads the chain your declaration already states (which acts
 * \`create\` which kinds, and what those acts must be handed first), offers
 * the ones that can run now, and says what everything else is waiting for.
 * It stands down on its own once every kind has something in it, which is
 * why the derived home is what it hands back to.
 */
function Home({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  return (
    <PageMain context={context} data-testid="home">
      {/* The routed face has no provider around it, so the store is handed over. */}
      <Begin
        store={context.store}
        {...(context.principal ? { principal: context.principal } : {})}
        whenFull={<DefaultHomePage context={context} />}
      />
    </PageMain>
  );
}

/** Your pages: every derived page, with the ${ids.spoken}'s record in your own words. */
export function pages() {
  return createPageRegistry<S, PageComponent<S>>(${ids.schemaVar})
    .register("${ids.kind}", "record", ${ids.KindPascal}Page as PageComponent<S>)
    .surface("home", Home as PageComponent<S>);
}
`;
}

export function mainTsx(ids: Ids): string {
  return `import { PagesApp } from "@graview/pages";
import { themeCss, type Scheme } from "@graview/primitives";
import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { ${ids.appVar} } from "./domain/app.js";
import { ${ids.brandVar} } from "./domain/brand.js";
import { ${ids.AppComponent} } from "./ui/app.js";
import { pages } from "./ui/pages.js";

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];

const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const asked = new URLSearchParams(window.location.search).get("theme");
  if (asked === "light" || asked === "dark") return asked;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme, ${ids.brandVar}));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * THE APP REMEMBERS. Persistence is the op log; \`openStore\` is the lifecycle
 * every deployment repeats. Here it is the browser adapter, so an edit
 * survives a reload, attributed and undoable. \`?fresh=1\` returns to empty;
 * a driven browser starts fresh unless it asks to remember (\`?remember=1\`),
 * so a harness specifies the app rather than its own residue.
 */
const opened = await openStore({
  app: ${ids.appVar},
  adapter: createBrowserAdapter(),
  fresh: browserStartsFresh(),
});
forgetFreshParam();

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{ store: opened.store, brand: ${ids.brandVar}, sceneHref: "/", remembers: true }}
      // Your own pages over the derived ones: see ui/pages.tsx.
      registry={pages()}
    />,
  );
} else {
  createRoot(root).render(
    <${ids.AppComponent} store={opened.store} remembers syncUrl initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__graviewReady"] = { scheme };
`;
}
