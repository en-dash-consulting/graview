/**
 * A new project, as a list of files.
 *
 * This module writes nothing. It takes a name and a first kind and returns
 * every file a product on Graview starts with — the declaration split into
 * domain and UI, the shell, the tests, the CI — so that the CLI can put them
 * on disk, a test can assert on them without a filesystem, and a host that
 * provisions apps from a declaration can call the same thing in-process.
 *
 * The shape here IS the shape the `graview-new-app` skill describes. When one
 * changes, the other has to, and `scripts/smoke-create.mjs` is what notices:
 * it scaffolds a project from the packed tarballs, installs it the way a
 * stranger would, and runs the project's own `verify`.
 */
import { withArticle } from "../schema/define-node.js";
import { slugify, titleCase, camel, pascal, validateScaffoldOptions } from "./names.js";
import {
  SURVEY_SAYS,
  AUDIT_SAYS,
  A11Y_SAYS,
  harness,
  workspaceRoot,
  tsconfigBase,
  rootVitest,
  packageJson,
  tsconfig,
  tsconfigBuild,
  viteConfig,
  gitignore,
  readme,
  ciYml,
} from "./project.js";
import { agentsMd, claudeMd } from "./agents.js";
import { schemaTs, mutationsTs, invariantsTs, brandTs, appTs, domainTest } from "./domain.js";
import { indexHtml, embedHtml, embedTsx, viewsTsx, uiAppTsx, pagesTsx, mainTsx } from "./ui.js";
import { documentAppTs, documentBrandTs, documentJson, documentSchemaTs, documentTest, templateJson, templateKind } from "./from-template.js";
import type { GraviewTemplate } from "../document/graview-template.js";

export { pascal, slugify, titleCase, validateScaffoldOptions } from "./names.js";
export { GRAVIEW_PACKAGES, LINKED_PACKAGES } from "./project.js";

export interface ScaffoldOptions {
  /** The product's name, as a person would say it: "Field Notes". */
  readonly name: string;
  /** The first node kind, as a slug: "note". Defaults to "item". */
  readonly kind?: string;
  /** The kind's plural, for districts and routes. Defaults to `${kind}s`. */
  readonly plural?: string;
  /** The npm package name. Defaults to the name, slugged. */
  readonly packageName?: string;
  /**
   * The version range every `@graview/*` dependency takes. A published
   * project wants the version of the packages that scaffolded it.
   */
  readonly range?: string;
  /**
   * A path to the framework repository, relative to the new project, for a
   * project that consumes the framework by path rather than from a registry
   * (`link:` dependencies, aliases into its sources, the dev server allowed
   * to read it). This is how the first-party products are wired.
   */
  readonly link?: string;
  /**
   * In link mode: the framework's repository as "owner/name", so the
   * project's CI can check it out as a sibling and build it before verify.
   * Without it the workflow says what to fill in.
   */
  readonly frameworkRepo?: string;
  /** Which package manager the project's scripts and CI assume. */
  readonly packageManager?: "pnpm" | "npm";
  /** The dev server's port. */
  readonly port?: number;
  /** The brand accent, as a hex color. */
  readonly accent?: string;
  /**
   * THE LAYOUT EVERY REAL PRODUCT ENDS UP WITH: a workspace root with the
   * app under `app/`.
   *
   * A single standalone package is what this wrote, and no first-party
   * product is one — because a real product accretes sibling things:
   * `scripts/` for the harnesses, `docs/`, a PRD, a second surface. The
   * harnesses are the tell. The framework documents `survey`, `audit-ui`,
   * `a11y`, `shrunk` and `seat` as the things a serious product should
   * steal, and then scaffolded a layout with nowhere to put them, so two
   * products independently hand-wrote a workspace root around the scaffold.
   * Two is a gap rather than a taste.
   */
  readonly workspace?: boolean;
  /**
   * A template made anywhere — Graview Cloud's shape (FR-08). The project
   * keeps its document as the declaration (`src/domain/app.json`, compiled
   * when the domain loads) and the template beside it as `template.json`,
   * for `graview apply --template` to set a store up from. Read it with
   * `readGraviewTemplate` first; this trusts what it is handed.
   */
  readonly template?: GraviewTemplate;
}

export interface ScaffoldFile {
  readonly path: string;
  readonly contents: string;
}

export interface Scaffold {
  readonly files: readonly ScaffoldFile[];
  readonly name: string;
  readonly packageName: string;
  readonly kind: string;
  readonly plural: string;
  readonly packageManager: "pnpm" | "npm";
  readonly port: number;
  readonly linked: boolean;
}



export function scaffoldProject(given: ScaffoldOptions): Scaffold {
  /*
   * FROM A TEMPLATE, the kind the UI leads with is the template's first kind
   * that something creates, and its seat is gated on that act — unless the
   * caller named a kind of the document's itself.
   */
  const led = given.template ? templateKind(given.template) : undefined;
  const options: ScaffoldOptions = led
    ? { ...given, kind: given.kind ?? led.kind, plural: given.plural ?? (given.kind === undefined ? led.plural : `${given.kind}s`) }
    : given;
  const problems = validateScaffoldOptions(options);
  if (problems.length > 0) throw new Error(problems.join("\n"));

  const name = options.name.trim();
  const kind = options.kind ?? "item";
  const plural = options.plural ?? `${kind}s`;
  const template = options.template;
  const packageName = options.packageName ?? slugify(name);
  const packageManager = options.packageManager ?? "pnpm";
  const port = options.port ?? 5170;
  const range = options.range ?? "*";
  const workspace = options.workspace === true;
  const rootLink = options.link?.replace(/\/+$/, "");
  /*
   * Every path the APP writes is one directory deeper in a workspace, so
   * the link it consumes the framework by is one `../` longer. The root's
   * own files use the link as given.
   */
  const link = rootLink === undefined ? undefined : workspace ? `../${rootLink}` : rootLink;
  // A worked green that clears the checker's contrast pairs in both schemes.
  const accent = options.accent ?? "#2e7d32";

  // "work-order" is an identifier; a button says "work order".
  const spoken = kind.replace(/-/g, " ");
  const spokenPlural = plural.replace(/-/g, " ");
  /*
   * "Add a item" is what a template writes when the article is a literal.
   * The kind is the author's word and half of them begin with a vowel, so
   * every generated sentence takes its article from `withArticle` — the same
   * one the checker and the strip use, so the project a stranger reads and
   * the framework talking about it cannot disagree.
   */
  const aSpoken = withArticle(kind);
  const ASpoken = aSpoken.charAt(0).toUpperCase() + aSpoken.slice(1);
  const ids = {
    name,
    kind,
    plural,
    spoken,
    spokenPlural,
    aSpoken,
    ASpoken,
    Kind: titleCase(kind),
    Plural: titleCase(plural),
    kindVar: camel(kind),
    KindPascal: pascal(kind),
    appVar: `${camel(slugify(name))}App`,
    brandVar: `${camel(slugify(name))}Brand`,
    schemaVar: `${camel(slugify(name))}Schema`,
    SchemaType: `${pascal(slugify(name))}Schema`,
    StoreType: `${pascal(slugify(name))}Store`,
    AppComponent: `${pascal(slugify(name))}App`,
    accent,
    port,
    link,
    frameworkRepo: options.frameworkRepo,
    range,
    packageManager,
    packageName,
    gate: led && given.kind === undefined ? led.gate : `add-${kind}`,
    fromTemplate: template !== undefined,
  };

  /*
   * THE DECLARATION: TypeScript written for one kind, or — from a template —
   * the template's document kept as the document (see ./from-template.ts).
   */
  const domain: ScaffoldFile[] = template
    ? [
        { path: "src/domain/app.json", contents: documentJson(template) },
        { path: "src/domain/app.ts", contents: documentAppTs(ids) },
        { path: "src/domain/schema.ts", contents: documentSchemaTs(ids) },
        { path: "src/domain/brand.ts", contents: documentBrandTs(ids) },
      ]
    : [
        { path: "src/domain/schema.ts", contents: schemaTs(ids) },
        { path: "src/domain/mutations.ts", contents: mutationsTs(ids) },
        { path: "src/domain/invariants.ts", contents: invariantsTs(ids) },
        { path: "src/domain/brand.ts", contents: brandTs(ids) },
        { path: "src/domain/app.ts", contents: appTs(ids) },
      ];

  const files: ScaffoldFile[] = [
    { path: "package.json", contents: packageJson(ids, workspace) },
    { path: "tsconfig.json", contents: tsconfig(workspace) },
    { path: "tsconfig.build.json", contents: tsconfigBuild() },
    { path: "vite.config.ts", contents: viteConfig(ids) },
    { path: "index.html", contents: indexHtml(ids) },
    { path: "embed.html", contents: embedHtml(ids) },
    { path: ".gitignore", contents: gitignore() },
    { path: "README.md", contents: readme(ids, workspace) },
    { path: "AGENTS.md", contents: agentsMd(ids, workspace) },
    { path: "CLAUDE.md", contents: claudeMd() },
    ...domain,
    { path: "src/ui/views.tsx", contents: viewsTsx(ids) },
    { path: "src/ui/app.tsx", contents: uiAppTsx(ids) },
    { path: "src/ui/pages.tsx", contents: pagesTsx(ids) },
    { path: "src/main.tsx", contents: mainTsx(ids) },
    { path: "src/embed.tsx", contents: embedTsx(ids) },
    { path: "tests/domain.test.ts", contents: template ? documentTest(ids) : domainTest(ids) },
    { path: ".github/workflows/ci.yml", contents: ciYml(ids) },
    ...(template ? [{ path: "template.json", contents: templateJson(template) }] : []),
  ];

  if (!workspace) {
    return { files, name, packageName, kind, plural, packageManager, port, linked: link !== undefined };
  }

  /*
   * THE WORKSPACE: the app under `app/`, and a root that has somewhere to
   * put the things a product accretes. The harnesses are the point — they
   * want to live at a root and drive the app — so they are written as stubs
   * that say what they would measure rather than as a `scripts/` directory
   * somebody has to invent.
   */
  /*
   * What belongs to the PRODUCT rather than to the app package stays at the
   * root: the README a person reads first, the notes an agent reads first
   * (AGENTS.md, and the CLAUDE.md that imports it), the CI that verifies the whole
   * workspace, and the one .gitignore.
   */
  const atRoot = new Set(["README.md", "AGENTS.md", "CLAUDE.md", ".gitignore", ".github/workflows/ci.yml"]);
  const rooted: ScaffoldFile[] = files.map((file) =>
    atRoot.has(file.path) ? file : { ...file, path: `app/${file.path}` },
  );
  return {
    files: [
      { path: "package.json", contents: workspaceRoot(ids, rootLink) },
      ...(packageManager === "pnpm"
        ? [{ path: "pnpm-workspace.yaml", contents: "packages:\n  - app\n" }]
        : []),
      { path: "tsconfig.base.json", contents: tsconfigBase() },
      { path: "vitest.config.ts", contents: rootVitest() },
      { path: "scripts/survey.mjs", contents: harness("survey", SURVEY_SAYS, ids) },
      { path: "scripts/audit-ui.mjs", contents: harness("audit-ui", AUDIT_SAYS, ids) },
      { path: "scripts/a11y.mjs", contents: harness("a11y", A11Y_SAYS, ids) },
      ...rooted,
    ],
    name,
    packageName,
    kind,
    plural,
    packageManager,
    port,
    linked: link !== undefined,
  };
}
