# Your architecture, with a face of its own

This recipe is one prompt, the app it makes, and the face a team gives that app next. The zones the modules group into, what each module imports, who owns each zone, and the modules no zone holds yet, with a product face of its own over the running preview.

```sh
Read https://graview.dev/start.md, then turn this repo's architecture into a Graview app.
```

Paste it into Claude Code, Codex or Cursor at the root of your repository. [start.md](https://graview.dev/start.md) is the page the agent reads.

## The app, running

This is the declaration below, compiled in your browser by the same compiler `graview check` uses, over the seed below. Press a district; open the problems; take a repair.

*The app the architecture prompt made, live: a live demo, on the HTML page.*

## What the agent declared

**Larkspur architecture**: Larkspur's architecture: the zones its modules group into, what each module imports from the others, who owns each zone, and the modules no zone holds yet. 3 kinds, 9 acts and 2 rules, each rule with the act that repairs it.

| Kind | Fields | Relations | Records in the seed |
| --- | --- | --- | --- |
| `zone` | `name`, `summary` | `ownedBy` to `person` | 7 |
| `module` | `path`, `packageName`, `area` | `inZone` to `zone`; `importsFrom` to `module` | 16 |
| `person` | `handle` | none | 7 |

### The rules

- **Every module is in a zone.** Over each module: requires `exists(out('inZone'))`. Repaired by “Put it in a zone” (`put-in-zone`).
- **Every zone has an owner.** Over each zone: requires `exists(out('ownedBy'))`. Repaired by “Give it an owner” (`give-zone-owner`).

## What graview check says

Run on every push, against the committed file:

```sh
npx graview check --document app.json
✓ the document compiles and checks clean
```

## A face of its own

An app worth keeping wants a look and feel of its own before it wants a server. This one keeps the store where `graview preview` runs it, and draws Graview's routed face over it with a shell, a home, a route and a record page in the team's own words: a change made on either page is the other's at once. If it mounts the scene too, give the embed `bar: { faces: false, name: false }` so the face's own shell is the one bar.

```sh
# the store and its own page, on 4800
npx graview preview app.json --seed seed.json --port 4800
# the face, over it, on 5173
cd face && npm install && npm run dev
```

CI runs these files as they are: `pnpm verify face-recipe` installs them over the built packages, starts the preview and the face’s own dev server, and checks that they typecheck, that the preview refuses the face’s page without the proxy and answers it through it, that the face draws its own shell, home and zone page, and that a change on either side reaches the other live.

### `face/package.json`

What it installs: the framework's packages, React and the router, and Vite. No framework source: a product installs the packages.

```json
{
  "name": "larkspur-architecture-face",
  "private": true,
  "type": "module",
  "scripts": {
    "store": "graview preview ../app.json --seed ../seed.json --port 4800",
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@graview/core": "^0.1.41",
    "@graview/pages": "^0.1.41",
    "@graview/primitives": "^0.1.41",
    "@graview/react": "^0.1.41",
    "@graview/ship": "^0.1.41",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.1.1"
  },
  "devDependencies": {
    "graview": "^0.1.41",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "^5.7.2",
    "vite": "^5.4.11"
  }
}
```

### `face/vite.config.ts`

The dev server, and its proxy: every `/graview` request, the socket too, goes to the preview, with the preview's own Origin, so its same-app doors answer a page they would refuse from another port.

```typescript
import { defineConfig } from "vite";

/*
 * THE STORE IS THE PREVIEW'S; THE PAGE IS YOURS.
 *
 * `graview preview ../app.json --seed ../seed.json --port 4800` serves the
 * store at /graview/ beside its own page. This dev server serves your face,
 * and hands every /graview/ request — the socket too — to the preview.
 *
 * The preview answers only its own page: a request whose Origin is another
 * site is refused, so a page on another port cannot sit in its seat. Here
 * the page is yours on purpose, so the proxy says the request comes from
 * the preview's own origin, on the HTTP calls and on the socket's upgrade.
 */
const PREVIEW = process.env["GRAVIEW_PREVIEW"] ?? "http://localhost:4800";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Where the preview's own page is, for a record's link into its scene.
  define: { "import.meta.env.GRAVIEW_PREVIEW": JSON.stringify(PREVIEW) },
  // main.tsx awaits the store at the top level.
  build: { target: "es2022" },
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
  server: {
    port: Number(process.env["PORT"] ?? 5173),
    strictPort: true,
    proxy: {
      "/graview": {
        target: PREVIEW,
        ws: true,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (request) => request.setHeader("origin", PREVIEW));
          proxy.on("proxyReqWs", (request) => request.setHeader("origin", PREVIEW));
        },
      },
    },
  },
});
```

### `face/index.html`

The page.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Larkspur architecture</title>
    <style>html, body { margin: 0; } body { background: var(--graview-ground, Canvas); }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `face/src/main.tsx`

The app and the seat from the preview's `/graview/document`, the store over `openRemote`, live; `themeCss` adopted by hand; the pictures from `registerDeclaredLenses(registerViewSpecs(registerDefaultViews(…)))`; and `PagesApp` with the face's own registry.

```typescript
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { appFromOrCompile, sayFindings } from "@graview/core/compiled";
import { PagesApp } from "@graview/pages";
import { createViews } from "@graview/react";
import { registerDeclaredLenses, registerDefaultViews, registerViewSpecs, themeCss } from "@graview/primitives";
import { openRemote } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { pages, SCENE } from "./pages.js";

/*
 * A PRODUCT FACE OVER A RUNNING PREVIEW'S STORE.
 *
 * The preview holds the store and the declaration; this page is the face.
 * It asks the preview (through the dev server's proxy, vite.config.ts) for
 * the app and the seat it sits in, opens the store over the wire, live, and
 * draws Graview's routed face with its own shell, home, routes and record
 * pages. A change made here is the preview's, and its own page sees it.
 */
const root = document.getElementById("root");
if (!root) throw new Error("no #root");

const handed = (await (await fetch("/graview/document")).json()) as { readonly document: unknown; readonly compiled?: unknown; readonly principal: Principal; readonly state?: unknown };
const compiled = await appFromOrCompile(handed);
if (!compiled.ok) throw new Error(sayFindings(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

const remote = await openRemote({ app, url: window.location.origin, principal: handed.principal, live: true, subprotocol: true, pollMs: 1200, ...(handed.state ? { state: handed.state as never, openTimeoutMs: 0 } : {}) });

/*
 * THE LOOK, ADOPTED BY HAND. The embed would put the theme on its own
 * element; a face of its own puts it on the document, from the app's brand,
 * and switching scheme is one replaceSync.
 */
const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];
const scheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
sheet.replaceSync(themeCss(scheme, app.brand));
document.documentElement.dataset["graviewScheme"] = scheme;
document.title = app.name;

/*
 * THE PICTURES: every kind at every fidelity from the declaration, the
 * record pages it declares as blocks, and its titled lenses as places.
 */
const views = registerDeclaredLenses(registerViewSpecs(registerDefaultViews(app.schema, createViews(app.schema)), app.schema, app.viewSpecs), app);

createRoot(root).render(
  <PagesApp
    context={{
      store: remote.store,
      principal: handed.principal,
      ...(app.brand ? { brand: app.brand } : {}),
      // A record's "See it on the map" opens the preview's own scene, focused on it.
      sceneHref: SCENE,
      views,
      settings: app.settings ?? [],
      app,
    }}
    registry={pages(app)}
  />,
);
// What a harness waits on, rather than a timer and a hope.
Object.assign(window, { __graview: { store: remote.store, principal: handed.principal }, __faceReady: true });
```

### `face/src/pages.tsx`

The face's own shell (with Find and Undo in its own row), home, a route about no one kind, and a zone's record page whose map link is `spatialHref(id, sceneHref)` into the preview's own scene. Every other page is still derived.

```typescript
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
```

### `face/tsconfig.json`

Strict, for the bundler.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

## How it was made

Claude Code wrote the declaration and the seed from Larkspur's package.json files and CODEOWNERS, the way the prompt asks, and then the face under face/ by hand from the framework's own pieces, over graview preview of those two files. Nothing here was run from the prompt alone.

CI does not run an agent. On every push it checks the committed declaration with `graview check --document`, loads the seed into a store, and opens this page in a browser to see the app mount. To run the prompt again yourself:

```sh
node scripts/fixtures/recipes/larkspur.mjs larkspur
cd larkspur && git init -q && git add -A && git commit -qm larkspur
# then paste the prompt into your agent
```

The files: [`app.json`](https://graview.dev/recipes/architecture/app.json) and [`seed.json`](https://graview.dev/recipes/architecture/seed.json) (30 records and 46 relations).

## The declaration, in full

```json
{
  "format": "graview-document",
  "formatVersion": 1,
  "name": "Larkspur architecture",
  "description": "Larkspur's architecture: the zones its modules group into, what each module imports from the others, who owns each zone, and the modules no zone holds yet.",
  "roles": [
    "engineer"
  ],
  "policy": {
    "grants": [
      {
        "roles": [
          "engineer"
        ],
        "mutations": "*"
      }
    ]
  },
  "kinds": {
    "zone": {
      "noun": "zone",
      "plural": "zones",
      "label": "{name}",
      "description": "A part of the codebase that changes together: the modules one team reviews as one.",
      "fields": {
        "name": {
          "type": "string",
          "required": true,
          "description": "What the team calls it."
        },
        "summary": {
          "type": "string",
          "description": "What it is for, in a line."
        }
      },
      "edges": {
        "ownedBy": {
          "to": [
            "person"
          ],
          "cardinality": "many",
          "description": "who reviews its modules",
          "inverse": "the zones they own"
        }
      }
    },
    "module": {
      "noun": "module",
      "plural": "modules",
      "label": "{path}",
      "description": "A workspace directory with its own package.json, under services/, packages/ or tools/.",
      "fields": {
        "path": {
          "type": "string",
          "required": true,
          "description": "The directory, from the repository root."
        },
        "packageName": {
          "type": "string",
          "label": "Package",
          "description": "The name in its package.json."
        },
        "area": {
          "type": "enum",
          "options": [
            "service",
            "package",
            "tool"
          ],
          "required": true,
          "description": "Which workspace folder it sits in."
        }
      },
      "edges": {
        "inZone": {
          "to": [
            "zone"
          ],
          "cardinality": "one",
          "description": "the zone it belongs to",
          "inverse": "its modules"
        },
        "importsFrom": {
          "to": [
            "module"
          ],
          "cardinality": "many",
          "description": "the modules its package.json depends on",
          "inverse": "the modules that import it"
        }
      },
      "glance": [
        "area",
        "packageName"
      ]
    },
    "person": {
      "noun": "person",
      "plural": "people",
      "label": "{handle}",
      "description": "Someone .github/CODEOWNERS names.",
      "fields": {
        "handle": {
          "type": "string",
          "required": true,
          "description": "Their handle in CODEOWNERS."
        }
      }
    }
  },
  "acts": {
    "add-zone": {
      "creates": "zone",
      "title": "Add a zone",
      "description": "Record a part of the codebase that changes together."
    },
    "add-module": {
      "creates": "module",
      "title": "Add a module",
      "description": "Record a workspace directory with its own package.json."
    },
    "add-person": {
      "creates": "person",
      "title": "Add a person",
      "description": "Record someone CODEOWNERS names."
    },
    "give-zone-owner": {
      "on": "zone",
      "connects": "ownedBy",
      "title": "Give the zone an owner",
      "description": "Say who reviews this zone's modules.",
      "fromTheOtherEnd": "Give them a zone"
    },
    "take-zone-owner": {
      "on": "zone",
      "severs": "ownedBy",
      "title": "Take an owner off the zone",
      "description": "Say this person no longer reviews this zone.",
      "fromTheOtherEnd": "Take a zone off them"
    },
    "put-in-zone": {
      "on": "module",
      "connects": "inZone",
      "title": "Put it in a zone",
      "description": "Say which zone this module belongs to.",
      "fromTheOtherEnd": "Put a module in this zone"
    },
    "take-out-of-zone": {
      "on": "module",
      "severs": "inZone",
      "title": "Take it out of its zone",
      "description": "Say this module no longer belongs to that zone.",
      "fromTheOtherEnd": "Take a module out of this zone"
    },
    "import-from": {
      "on": "module",
      "connects": "importsFrom",
      "title": "Say what it imports",
      "description": "Name a module its package.json depends on.",
      "fromTheOtherEnd": "Say a module imports this one"
    },
    "stop-importing": {
      "on": "module",
      "severs": "importsFrom",
      "title": "Say it no longer imports one",
      "description": "Take a module off what it depends on.",
      "fromTheOtherEnd": "Say a module no longer imports this one"
    }
  },
  "rules": {
    "module-in-zone": {
      "title": "Every module is in a zone",
      "over": "module",
      "require": "exists(out('inZone'))",
      "says": "{path} is in no zone",
      "repairs": [
        {
          "act": "put-in-zone",
          "label": "Put it in a zone"
        }
      ]
    },
    "zone-has-owner": {
      "title": "Every zone has an owner",
      "over": "zone",
      "require": "exists(out('ownedBy'))",
      "says": "No one owns {name}",
      "repairs": [
        {
          "act": "give-zone-owner",
          "label": "Give it an owner"
        }
      ]
    }
  }
}
```

---

A Graview recipe: The zones the modules group into, what each module imports, who owns each zone, and the modules no zone holds yet, with a product face of its own over the running preview.

The page: https://graview.dev/docs/recipes/architecture.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
