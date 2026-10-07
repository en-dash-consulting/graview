import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { appFrom, serializeCompiled } from "../../src/document/index.js";
import { appFromOrCompile } from "../../src/compiled.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * FR-123. A COMPILED APP HANDED WRONG IS COMPILED INSTEAD, NEVER RUN OR THROWN.
 *
 * The page trusts a compiled app as the host's own data, but the host's
 * cache is not always the host's document: a compiled app kept from an
 * earlier version of the document, or one cut short or mangled on its way,
 * is what `appFromOrCompile`'s fallback is for. A torn one must be refused
 * as `compiled-shape` — so the page compiles the document — rather than
 * throwing out of `appFrom` and taking the page down; and one compiled from
 * another document than the one handed beside it must not be built, or the
 * page runs yesterday's acts against today's server.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(vendors);
if (!compiled.ok) throw new Error("the vendors fixture compiles");
const wire = JSON.parse(JSON.stringify(serializeCompiled(compiled))) as Record<string, unknown> & { acts: Record<string, unknown>; rules: Record<string, unknown>; document: { kinds: Record<string, unknown> } };
const each = (record: Record<string, unknown>, value: unknown) => Object.fromEntries(Object.keys(record).map((name) => [name, value]));

const torn: Record<string, unknown> = {
  "an act's plan that is null": { ...wire, acts: each(wire.acts, null) },
  "a rule's plan that is null": { ...wire, rules: each(wire.rules, null) },
  "relations that are not pairs": { ...wire, edges: [1, 2] },
  "kinds with no fields": { ...wire, document: { ...wire.document, kinds: each(wire.document.kinds, {}) } },
  "an act's arguments that are not a list": { ...wire, acts: Object.fromEntries(Object.entries(wire.acts).map(([name, act]) => [name, { ...(act as object), args: 7 }])) },
};

describe("a compiled app handed wrong", () => {
  for (const [what, payload] of Object.entries(torn)) {
    it(`is refused as compiled-shape, not thrown, when it has ${what}`, async () => {
      const refused = appFrom(payload);
      expect(refused.ok).toBe(false);
      expect(refused.findings.map((f) => f.code)).toEqual(["compiled-shape"]);
      const page = await appFromOrCompile({ compiled: payload, document: vendors });
      expect(page.ok).toBe(true);
    });
  }

  it("is compiled instead when it was compiled from another document than the one handed beside it", async () => {
    const newer = structuredClone(vendors);
    const act = Object.keys(newer.acts)[0]!;
    newer.acts[act].title = "Said by the newer document";
    const page = await appFromOrCompile({ compiled: wire, document: newer });
    if (!page.ok) throw new Error("the newer document compiles");
    expect(page.app.mutations!.find((m) => m.name === act)!.title).toBe("Said by the newer document");
    expect(page.document.acts![act]!.title).toBe("Said by the newer document");
  });

  it("is built, not compiled, when its document is the one handed — as an object or as the JSON a host serves", async () => {
    for (const document of [vendors, JSON.stringify(vendors), JSON.parse(JSON.stringify(wire.document))]) {
      const page = await appFromOrCompile({ compiled: wire, document });
      if (!page.ok) throw new Error("the vendors compiled app builds");
      // Built from the compiled app, it carries the server's findings — the checker's among them.
      expect(page.findings).toEqual(compiled.findings);
    }
  });

  it("pollutes nothing when its names are an object's own: __proto__, constructor", () => {
    const hostile = JSON.parse(
      JSON.stringify(wire).replace(/"vendor"/g, '"__proto__"'),
    ) as unknown;
    try {
      const built = appFrom(hostile);
      if (built.ok) {
        const app = built.app as GraviewApp<AnySchema>;
        const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [] });
        for (const m of app.mutations ?? []) {
          try {
            store.apply({ name: m.name, args: { __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } } as never }, { author: { kind: "human", id: "x", roles: ["owner"] } });
          } catch {
            // Refused or not, it must not reach Object.prototype.
          }
        }
      }
    } catch {
      // Refusing by throwing is another finding; here only pollution is judged.
    }
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});
