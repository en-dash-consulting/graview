import { evaluateExpr, ExprEvalError, parseExpr, parseTemplate, renderTemplate } from "@graview/core/document";
import { describe, expect, it } from "vitest";

/**
 * A NAME ON THE PROTOTYPE IS NO FIELD. The rule language reads a record's
 * own values; `constructor` read through `in` handed a template the
 * function `Object`, and the tokenizer took it for an operator. A view
 * spec is drawn from a stranger's words, so neither may reach past the
 * record.
 */
const kinds = new Map([["vendor", { fields: new Set(["name"]), edges: new Map<string, "one" | "many">() }]]);
const node = { id: "bloom", kind: "vendor", name: "Bloom" } as never;
const graph = { getNode: () => undefined, allNodes: () => [], allEdges: () => [], nodesOfKind: () => [], edgesOfKind: () => [], out: () => [], in: () => [], neighbors: () => [], has: () => false };

describe("a name on the prototype", () => {
  it("parses as a name, not as an operator", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) expect(parseExpr(name), name).toMatchObject({ t: "ident", name });
  });

  it("is no field of a record, and no binding", () => {
    for (const name of ["constructor", "toString", "valueOf", "__proto__"]) {
      expect(() => evaluateExpr(parseExpr(name), { graph, subject: node, kinds })).toThrow(ExprEvalError);
      expect(() => evaluateExpr(parseExpr(name), { graph, subject: null, kinds, bindings: { other: 1 } })).toThrow(ExprEvalError);
    }
  });

  it("draws as nothing in a template", () => {
    expect(renderTemplate(parseTemplate("{constructor}·{toString}·{name}"), { node, kinds })).toBe("—·—·Bloom");
  });
});
