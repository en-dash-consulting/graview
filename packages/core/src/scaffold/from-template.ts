import type { GraviewTemplate } from "../document/graview-template.js";
import { type Ids, escapeString, slugify } from "./names.js";

/*
 * A PROJECT FROM A TEMPLATE (FR-08): the same checkout `graview create`
 * always writes, with the declaration KEPT AS THE DOCUMENT.
 *
 * `src/domain/app.json` is the template's document, and `src/domain/app.ts`
 * compiles it with `compileDocument` when the domain loads. The other choice
 * — writing TypeScript from the document — would need a generator for every
 * construct the document has (expression rules, effects, guards, refusal
 * sentences, view specs) and would then be a second declaration that could
 * drift from the first. Kept as the document, the project IS the template's
 * app: `graview describe` says the same of both by construction, the studio
 * and `editDocument` change it as data, and a template shared back out is the
 * file as it stands. The UI, the tests, the CI and the scripts are the ones
 * every project gets; the template itself sits at the root as
 * `template.json`, for `graview apply --template` to set a store up from.
 */

/** The kind a project's UI leads with, and the act its seat is gated on: the first kind something creates. */
export function templateKind(template: GraviewTemplate): { readonly kind: string; readonly plural: string; readonly gate: string } {
  const document = template.document as { kinds?: Record<string, { plural?: string }>; acts?: Record<string, { creates?: string }> };
  const kinds = Object.keys(document.kinds ?? {});
  const acts = Object.entries(document.acts ?? {});
  const creating = kinds.map((kind) => [kind, acts.find(([, act]) => act.creates === kind)?.[0]] as const).find(([, act]) => act !== undefined);
  const kind = creating?.[0] ?? kinds[0] ?? "item";
  const plural = slugify(document.kinds?.[kind]?.plural ?? `${kind}s`) || `${kind}s`;
  return { kind, plural, gate: creating?.[1] ?? acts[0]?.[0] ?? `add-${kind}` };
}

export function documentJson(template: GraviewTemplate): string {
  return `${JSON.stringify(template.document, null, 2)}\n`;
}

export function templateJson(template: GraviewTemplate): string {
  return `${JSON.stringify(template, null, 2)}\n`;
}

export function documentAppTs(ids: Ids): string {
  return `import { Store, type AnySchema, type GraviewApp, type StoreOptions } from "@graview/core";
import { compileDocument, sayFindings } from "@graview/core/document";
import document from "./app.json" with { type: "json" };

/**
 * THE DECLARATION IS A DOCUMENT: app.json, compiled when this module loads.
 * It runs no code of its own, so it is the same app here, in a host that
 * accepts documents from strangers, and in the template it came from.
 * \`graview check\` and \`graview describe\` read it through this module or
 * straight from the file; edit it, or open it in the studio, and the
 * compiler says what is wrong with the JSON path to fix it at.
 */
const compiled = compileDocument(document);
if (!compiled.ok) {
  throw new Error(\`src/domain/app.json does not compile:\\n\${sayFindings(compiled.findings)}\`);
}

export const ${ids.appVar}: GraviewApp = compiled.app;

export type ${ids.StoreType} = Store<AnySchema>;

export function createStore(options: Partial<StoreOptions<AnySchema>> = {}): ${ids.StoreType} {
  return new Store<AnySchema>({
    schema: ${ids.appVar}.schema,
    mutations: ${ids.appVar}.mutations ?? [],
    invariants: ${ids.appVar}.invariants ?? [],
    ...(${ids.appVar}.policy ? { policy: ${ids.appVar}.policy } : {}),
    ...options,
  });
}

export default ${ids.appVar};
`;
}

export function documentSchemaTs(ids: Ids): string {
  return `import { ${ids.appVar} } from "./app.js";

/** The schema the document compiles to, under the name the UI imports it by. */
export const ${ids.schemaVar} = ${ids.appVar}.schema;
export type ${ids.SchemaType} = typeof ${ids.schemaVar};
`;
}

export function documentBrandTs(ids: Ids): string {
  return `import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";
import { ${ids.appVar} } from "./app.js";

/**
 * The document's brand when it declares one (\`brand.accent\` in app.json);
 * otherwise both schemes derived from one accent, measured against AA.
 */
function brandOf(): Brand {
  if (${ids.appVar}.brand) return ${ids.appVar}.brand;
  const derived = brandFromAccent({ accent: "${ids.accent}", base: { dark: DARK, light: LIGHT } });
  if (!derived.ok) throw new Error(\`${escapeString(ids.name)} cannot be derived from ${ids.accent}: \${derived.why}\`);
  return { name: ${ids.appVar}.name, schemes: derived.schemes };
}

export const ${ids.brandVar}: Brand = brandOf();
`;
}

export function documentTest(ids: Ids): string {
  return `import { checkApp, type Principal } from "@graview/core";
import { instantiateTemplate } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import template from "../template.json" with { type: "json" };
import document from "../src/domain/app.json" with { type: "json" };
import { ${ids.appVar}, createStore } from "../src/domain/app.js";

/**
 * The domain tier has no DOM in it, so these run headless. The declaration
 * is the template's document until you change it; the setup test holds the
 * template's own acts to the document as it stands.
 */

describe("the declaration", () => {
  it("passes its own check", () => {
    const result = checkApp(${ids.appVar});
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("compiles from the document it keeps", () => {
    expect(${ids.appVar}.name).toBe(document.name);
  });
});

describe("the template's setup", () => {
  const setUp = () => {
    const made = instantiateTemplate({ ...template, document });
    if (!made.ok) throw new Error(made.findings.map((f) => \`\${f.path}: \${f.message}\`).join("\\n"));
    return made;
  };

  it("runs as one batch, and one undo takes it back", () => {
    const store = createStore();
    const author: Principal = { kind: "system", id: "template:${escapeString(ids.packageName)}" };
    const calls = setUp().setup;
    if (calls.length === 0) return;
    for (const call of calls) {
      store.apply({ name: call.name, args: call.args }, { author, batch: "setup", intent: call.intent });
    }
    expect(new Set(store.log.all().map((op) => op.batch))).toEqual(new Set(["setup"]));
    store.undo("setup", { author });
    expect(store.graph.allNodes()).toEqual([]);
  });
});
`;
}

export function documentReadmeLayout(ids: Ids, run: string): string {
  return `src/domain/      the declaration — no React in here; this is what graview check reads
  app.json       the declaration document: kinds, acts, rules, policy, brand, views
  app.ts         compiles app.json with compileDocument; createStore
  schema.ts      the compiled schema, under the name the UI imports
  brand.ts       the document's brand, or one derived from an accent
src/ui/
  views.tsx      registerDefaultViews, then your own where the generic one is wrong
  app.tsx        the provider, the Shell primitive, and a seat — under sixty lines
  pages.tsx      the ${ids.kind}'s page on the routed face, in your words, over the derived ones
src/main.tsx     the theme, the store that remembers, the two faces
template.json    the template this project was made from: \`${run} apply-template\` sets a store up from it
tests/           the declaration checks clean, and the template's setup runs as one undoable batch`;
}
