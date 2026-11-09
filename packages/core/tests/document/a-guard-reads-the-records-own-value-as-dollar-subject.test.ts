import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { evaluateExpr, parseExpr } from "../../src/document/expr/index.js";
import { nameMeansBothFindings } from "../../src/document/guard-names.js";
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
        status: { type: "enum", options: ["todo", "in-review", "done"], optionLabels: { "in-review": "In review" } },
        price: { type: "number", format: "money" },
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
    snapshot: { nodes: [{ id: "card-a", kind: "card", name: "First", color: "red", size: 2, status: "in-review", price: 1200 }], edges: [] } as never,
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

  it("a refusal says $subject.<field> as it says the bare field: a choice by its label, money as money", () => {
    const said = refusal({ allowedWhen: "$subject.status != 'in-review'", refusal: "{name} is already {$subject.status}" }, {});
    expect(said).toBe(refusal({ allowedWhen: "$subject.status != 'in-review'", refusal: "{name} is already {status}" }, {}));
    expect(said).toMatch(/^First is already in review$/i);
    expect(refusal({ allowedWhen: "false", refusal: "{$subject.price}" }, {})).toBe(refusal({ allowedWhen: "false", refusal: "{price}" }, {}));
    expect(refusal({ allowedWhen: "false", refusal: "{$subject.price}" }, {})).toMatch(/1,200/);
  });

  it("and $arg.<name> as its argument is declared", () => {
    const offer = { args: { offer: { type: "number", format: "money" } }, allowedWhen: "false" };
    expect(refusal({ ...offer, refusal: "not at {$arg.offer}" }, { offer: 1234.5 })).toBe(refusal({ ...offer, refusal: "not at {$arg.offer | money}" }, { offer: 1234.5 }));
    expect(refusal({ ...offer, refusal: "not at {$arg.offer}" }, { offer: 1234.5 })).not.toBe("not at 1234.5");
  });
});

describe("a set clears a field only where it says null", () => {
  it("a literal null clears an optional field", () => {
    const store = storeOf(compiled(cards({ sets: { color: null } })));
    store.apply({ name: "recolor", args: { id: "card-a" } });
    expect(Object.hasOwn(store.graph.getNode("card-a") as object, "color")).toBe(false);
  });

  it("a value worked out to nothing is not a clearing, and is refused as before", () => {
    for (const expr of ["$arg.shade", "first(all('card') where name == 'nobody').name"]) {
      const store = storeOf(compiled(cards({ args: { shade: { type: "string" } }, effects: [{ set: { color: { expr } } }] })));
      expect(() => store.apply({ name: "recolor", args: { id: "card-a" } })).toThrow(/does not match what card declares/);
      expect((store.graph.getNode("card-a") as Record<string, unknown>)["color"]).toBe("red");
    }
  });
});

describe("a computed value an act's condition reads", () => {
  it("is handed none of the call's arguments: $arg in it is nothing", () => {
    const doc = cards({ allowedWhen: "handed == null" }) as unknown as { kinds: { card: Record<string, unknown> } };
    doc.kinds.card["computed"] = { handed: "$arg.color" };
    const store = storeOf(compiled(doc));
    store.apply({ name: "recolor", args: { id: "card-a", color: "blue" } });
    expect((store.graph.getNode("card-a") as Record<string, unknown>)["color"]).toBe("blue");
  });
});

describe("inside where, every and some", () => {
  const a = { id: "a", kind: "card", name: "A", color: "x" };
  const b = { id: "b", kind: "card", name: "B", color: "x" };
  const c = { id: "c", kind: "card", name: "C", color: "y" };
  const all = [a, b, c];
  const graph = { getNode: (id: string) => all.find((n) => n.id === id), has: () => true, nodesOfKind: (kind: string) => all.filter((n) => n.kind === kind), out: () => [], in: () => [] };
  const kinds = new Map([["card", { fields: new Set(["name", "color", "size"]), edges: new Map() }]]);
  const judge = (source: string, bindings: Record<string, string> = {}) => evaluateExpr(parseExpr(source), { graph: graph as never, subject: c as never, kinds: kinds as never, bindings, args: bindings });

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

  it("warns of $arg.<name> the act does not take, in its condition and in a value it works out", () => {
    const found = compileDocument(cards({ allowedWhen: "$arg.shade != ''", sets: { name: { expr: "$arg.title" } } }), { today: () => "2026-11-09" }).findings.filter((f) => f.code === "act-arg-unknown");
    expect(found.map((f) => [f.severity, f.path])).toEqual([
      ["warning", "acts.recolor.allowedWhen"],
      ["warning", "acts.recolor.sets.name"],
    ]);
    expect(found[0]!.message).toMatch(/shade/);
  });

  it("warns of $arg in a workflow step's values and a view's conditions, where no act is run", () => {
    const doc = cards({}) as unknown as Record<string, unknown>;
    doc["workflows"] = { weekly: { steps: [{ generate: "card", from: [{ kind: "card", dates: "due" }], window: "next week", set: { name: { expr: "$arg.name" }, color: { expr: "color" } } }] } };
    doc["views"] = { home: [{ when: "$arg.color == 'red'", show: [{ text: "red" }] }, { group: [{ when: "true", show: [{ when: "$arg.size > 1", show: [{ text: "big" }] }] }] }] };
    const found = nameMeansBothFindings(doc as never, { mutations: [] }).filter((f) => f.code === "arg-outside-act");
    expect(found.map((f) => f.path)).toEqual(["workflows.weekly.steps.0.set.name", "views.home.0.when", "views.home.1.group.0.show.0.when"]);
  });

  it("warns of $arg where no act is run: a label, a computed value, a rule", () => {
    const doc = cards({}) as unknown as { kinds: { card: Record<string, unknown> }; rules?: unknown };
    doc.kinds.card["describe"] = "{$arg.color}";
    doc.kinds.card["computed"] = { shade: "$arg.color" };
    doc.rules = { named: { over: "card", require: "$arg.name != ''", says: "{name} needs a name" } };
    const found = compileDocument(doc, { today: () => "2026-11-09" }).findings.filter((f) => f.code === "arg-outside-act");
    expect(found.map((f) => f.path)).toEqual(["kinds.card.describe", "kinds.card.computed.shade", "rules.named.require"]);
  });

  it("is answered by either spelling, and says nothing of a field the act takes no argument for", () => {
    expect(warned(cards({ allowedWhen: "$subject.color != $arg.color", refusal: "{name} is {$subject.color}" }))).toEqual([]);
    expect(warned(cards({ allowedWhen: "name != ''", refusal: "{name} stays" }))).toEqual([]);
  });
});
