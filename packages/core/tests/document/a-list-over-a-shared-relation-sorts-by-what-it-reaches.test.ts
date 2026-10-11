import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";

/**
 * A LIST OVER A RELATION SEVERAL KINDS DECLARE SORTS BY A CHOICE FIELD OF
 * THE KINDS IT REACHES. n-dx declares `under` on six kinds — a task under a
 * change, a zone under a zone — and a change's page lists `in('under')` by
 * status in its declared order. The checker held that sort to every kind
 * that declares `under`, so a zone, which has no status and is never under a
 * change, refused it. A walk is judged by the kinds it reaches from the
 * list's own kind: those whose relation leads to it.
 */
const STATUS = { type: "enum", options: ["pending", "in_progress", "completed"] } as const;
const document = (list: Record<string, unknown>, onKind = "change") => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Work",
  kinds: {
    change: {
      fields: { title: { type: "string", required: true }, status: STATUS },
      edges: { under: { to: ["change"], cardinality: "one", description: "what this sits inside", inverse: "the changes inside it" } },
    },
    task: {
      fields: { title: { type: "string", required: true }, status: STATUS },
      edges: { under: { to: ["change", "task"], cardinality: "one", description: "what this sits inside", inverse: "the tasks inside it" } },
    },
    zone: {
      fields: { name: { type: "string", required: true } },
      edges: { under: { to: ["zone"], cardinality: "one", description: "what this sits inside", inverse: "the zones inside it" } },
    },
  },
  views: { [onKind]: { page: [{ headline: onKind === "zone" ? "{name}" : "{title}" }, { list: "in('under')", as: "row", ...list }] } },
});
const errors = (doc: unknown) => compileDocument(doc).findings.filter((f) => f.severity === "error").map((f) => `${f.code}: ${f.message}`);

describe("a list over a relation several kinds declare", () => {
  it("sorts by a choice field in its declared order when every kind the walk reaches has it", () => {
    expect(errors(document({ sort: { by: "status", direction: "choices" } }))).toEqual([]);
    expect(errors(document({ group: "status" }))).toEqual([]);
  });

  it("is still refused a choice field one of the kinds it reaches lacks", () => {
    const said = errors(document({ sort: { by: "name", direction: "choices" } }));
    expect(said).toEqual(['list-sort: "name" is not a choice field of change and task, so it has no declared order']);
  });

  it("reaches only the kinds whose relation leads to where it starts: under a zone, zones", () => {
    expect(errors(document({ sort: { by: "status", direction: "choices" } }, "zone"))).toEqual(['list-sort: "status" is not a choice field of zone, so it has no declared order']);
    expect(errors(document({ sort: "name" }, "zone"))).toEqual([]);
  });

  it("walks from a set as from a record: in(S, 'under') reaches what leads to S's kinds", () => {
    const home = { ...document({}), views: { home: [{ list: "in(all('zone'), 'under')", as: "row", sort: { by: "name" } }] } };
    expect(errors(home)).toEqual([]);
  });
});
