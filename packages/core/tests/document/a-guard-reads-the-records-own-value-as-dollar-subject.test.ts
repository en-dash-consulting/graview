import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { evaluateExpr, parseExpr } from "../../src/document/expr/index.js";
import { ActRefusal, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * WHICH VALUE A NAME IS, IN AN ACT'S CONDITION AND REFUSAL (Roadmap
 * f-guard-reads-record-not-argument). The scope rules:
 *
 * - `$subject.<field>` is the record's own field;
 * - `$arg.<name>` is the call's argument by that name, or nothing;
 * - a bare name is a member's field inside `where`, `every` and the rest
 *   read per member; else the call's argument by that name, where it gave
 *   one; else the record's field.
 *
 * graview check warns where a bare name is both a field of the kind and an
 * argument of the act, and either spelling answers it.
 */
const cards = (act: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Cards",
  description: "Cards on a board.",
  kinds: {
    card: {
      noun: "card",
      plural: "cards",
      label: "{name}",
      description: "One card.",
      fields: {
        name: { type: "string", required: true },
        color: { type: "string" },
        size: { type: "integer" },
      },
    },
  },
  acts: { recolor: { title: "Recolor", on: "card", writes: ["color", "size"], ...act } },
});

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-11-09" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    snapshot: { nodes: [{ id: "card-a", kind: "card", name: "First", color: "red", size: 2 }], edges: [] } as never,
  });
/** Whether the act runs on card-a with these arguments. */
const runs = (act: Record<string, unknown>, args: Record<string, unknown>): boolean => {
  const store = storeOf(compiled(cards(act)));
  try {
    store.apply({ name: "recolor", args: { id: "card-a", ...args } });
    return true;
  } catch (e) {
    if (e instanceof ActRefusal) return false;
    throw e;
  }
};
const refusal = (act: Record<string, unknown>, args: Record<string, unknown>): string => {
  const store = storeOf(compiled(cards(act)));
  try {
    store.apply({ name: "recolor", args: { id: "card-a", ...args } });
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected a refusal");
};

describe("in an act's condition, which value a name is", () => {
  it("$subject.<field> is the record's own field, even where the call gives an argument by that name", () => {
    expect(runs({ allowedWhen: "$subject.color == 'red'" }, { color: "blue" })).toBe(true);
    expect(runs({ allowedWhen: "$subject.color == 'blue'" }, { color: "blue" })).toBe(false);
  });

  it("$arg.<name> is the call's argument by that name, or nothing where it gave none", () => {
    expect(runs({ allowedWhen: "$arg.color == 'blue'" }, { color: "blue" })).toBe(true);
    expect(runs({ allowedWhen: "$arg.color == 'red'" }, { color: "blue" })).toBe(false);
    expect(runs({ allowedWhen: "$arg.color == null" }, { size: 3 })).toBe(true);
  });

  it("a bare name is the call's argument by that name where it gave one, else the record's field", () => {
    expect(runs({ allowedWhen: "color == 'blue'" }, { color: "blue" })).toBe(true);
    expect(runs({ allowedWhen: "color == 'red'" }, { size: 3 })).toBe(true);
  });

  it("a refusal says either the same way", () => {
    expect(refusal({ allowedWhen: "false", refusal: "{name} is {$subject.color}, not {$arg.color}" }, { color: "blue" })).toBe("First is red, not blue");
  });
});

describe("inside where, every and some", () => {
  const a = { id: "a", kind: "card", name: "A", color: "x" };
  const b = { id: "b", kind: "card", name: "B", color: "x" };
  const c = { id: "c", kind: "card", name: "C", color: "y" };
  const all = [a, b, c];
  const graph = { getNode: (id: string) => all.find((n) => n.id === id), has: () => true, nodesOfKind: (kind: string) => all.filter((n) => n.kind === kind), out: () => [], in: () => [] };
  const kinds = new Map([["card", { fields: new Set(["name", "color", "size"]), edges: new Map() }]]);
  const judge = (source: string, bindings: Record<string, string> = {}) => evaluateExpr(parseExpr(source), { graph: graph as never, subject: c as never, kinds: kinds as never, bindings });

  it("$subject is the outer record", () => {
    expect(judge("count(all('card') where color == $subject.color)")).toBe(1);
  });

  it("a member's own field is read ahead of an argument by the same name", () => {
    expect(judge("count(all('card') where color == 'x')", { color: "y" })).toBe(2);
    expect(judge("some(all('card'), color == 'y')", { color: "x" })).toBe(true);
  });

  it("a name that is no field of the member is still the argument", () => {
    expect(judge("count(all('card') where color == shade)", { shade: "x" })).toBe(2);
    expect(judge("count(all('card') where color == $arg.shade)", { shade: "y" })).toBe(1);
  });
});

describe("the spelling", () => {
  it("follows a renamed field in $subject.<field>, and a renamed argument in $arg.<name>", () => {
    const renamed = editDocument(cards({ allowedWhen: "$subject.color != $arg.color", refusal: "{name} is {$subject.color}" }) as never, [{ op: "rename-field", kind: "card", field: "color", to: "hue" }]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const act = (renamed.document.acts as Record<string, { allowedWhen: string; refusal: string }>)["recolor"]!;
    expect(act.allowedWhen).toBe("$subject.hue != $arg.hue");
    expect(act.refusal).toBe("{name} is {$subject.hue}");
  });

  it("is refused for any other $ name, and after a dot", () => {
    expect(() => parseExpr("$record.color == null")).toThrow(/\$subject/);
    expect(() => parseExpr("color.$subject")).toThrow(/field name after/);
  });
});

describe("graview check and a name that means both", () => {
  const warned = (doc: unknown) => compileDocument(doc, { today: () => "2026-11-09" }).findings.filter((f) => f.code === "act-name-means-both");

  it("warns of a condition's bare name that is a field and an argument, naming the act and the field", () => {
    const found = warned(cards({ allowedWhen: "color != 'red' and size > 0" }));
    expect(found.map((f) => [f.severity, f.path])).toEqual([
      ["warning", "acts.recolor.allowedWhen"],
      ["warning", "acts.recolor.allowedWhen"],
    ]);
    expect(found[0]!.message).toMatch(/"recolor"/);
    expect(found[0]!.message).toMatch(/color/);
    expect(found[0]!.fix).toMatch(/\$subject\.color/);
    expect(found[0]!.fix).toMatch(/\$arg\.color/);
    expect(found[1]!.message).toMatch(/size/);
  });

  it("warns of a refusal's bare name the same way", () => {
    expect(warned(cards({ allowedWhen: "$subject.size > 0", refusal: "{name} is {color}" })).map((f) => f.path)).toEqual(["acts.recolor.refusal"]);
  });

  it("is answered by either spelling, and says nothing of a field the act takes no argument for", () => {
    expect(warned(cards({ allowedWhen: "$subject.color != $arg.color", refusal: "{name} is {$subject.color}" }))).toEqual([]);
    expect(warned(cards({ allowedWhen: "name != ''", refusal: "{name} stays" }))).toEqual([]);
  });
});
