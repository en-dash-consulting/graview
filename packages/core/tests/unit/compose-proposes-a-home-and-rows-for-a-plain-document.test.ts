import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import * as compose from "../../src/compose.js";
import { composeDesign, glanceFromDeclaration, homeFromDeclaration, rowFromDeclaration } from "../../src/compose.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { designFindings } from "../../src/document/design-findings.js";

/**
 * COMPOSEDESIGN PROPOSES A HOME AND ROWS FOR A PLAIN DOCUMENT (Roadmap
 * f-compose-home-from-declaration). Graview Cloud composed a first home —
 * a count headline, a dated-first list per kind — and a row and a glance
 * for each kind itself, because `composeDesign` proposed only an accent
 * for a plain document: its critic fixes only what it warns about, and
 * plain kinds raise no warning. It now proposes them, and only what is
 * missing; and the words a host composes with are on a public entry.
 */
const plain: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  kinds: {
    dish: { noun: "dish", plural: "dishes", fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["proposed", "confirmed"], default: "proposed" }, course: { type: "enum", options: ["main", "side", "dessert"] }, notes: { type: "text" } } },
    moment: { noun: "schedule item", plural: "schedule", fields: { name: { type: "string", required: true }, who: { type: "string" }, at: { type: "datetime", required: true } } },
    room: { noun: "room", plural: "rooms", fields: { name: { type: "string", required: true }, seats: { type: "integer" } } },
  },
  acts: { "add-dish": { title: "Add a dish", creates: "dish" }, "add-moment": { title: "Add to the schedule", creates: "moment" }, "add-room": { title: "Add a room", creates: "room" } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
} as GraviewDocument;

const applied = (document: GraviewDocument, edits: readonly unknown[]) => {
  const out = editDocument(document, edits);
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.document;
};

describe("composeDesign on a plain document with no home", () => {
  const { edits, said } = composeDesign(plain);
  const home = edits.find((edit) => edit.op === "set-home") as { blocks: Record<string, unknown>[] } | undefined;

  it("proposes a home of a count headline and a list per kind, dated kinds first", () => {
    expect(home).toBeDefined();
    expect(home!.blocks[0]).toEqual({
      headline: "{count(all('moment')) | words | capital} {count(all('moment')) | plural: 'schedule item', 'schedule'}, {count(all('dish')) | words} {count(all('dish')) | plural: 'dish', 'dishes'} and {count(all('room')) | words} {count(all('room')) | plural: 'room', 'rooms'}.",
    });
    const lists = home!.blocks.filter((block) => "list" in block);
    expect(lists).toEqual([
      { list: "all('moment')", as: "row", sort: "at" },
      { list: "all('dish')", as: "row" },
      { list: "all('room')", as: "row" },
    ]);
    expect(home!.blocks.filter((block) => "title" in block).map((block) => block["title"])).toEqual(["Schedule", "Dishes", "Rooms"]);
    expect(said.some((line) => line.startsWith("The app has no home of its own"))).toBe(true);
  });

  it("as edits graview check takes, with nothing left for the critic to warn of", () => {
    const document = applied(plain, edits);
    const compiled = compileDocument(document);
    expect(compiled.ok).toBe(true);
    expect(compiled.ok ? compiled.findings.filter((finding) => finding.severity === "error") : []).toEqual([]);
    expect(designFindings(document).filter((finding) => finding.severity === "warning")).toEqual([]);
  });
});

describe("a row and a glance for each kind that has none", () => {
  const { edits } = composeDesign(plain);
  const of = (op: string, kind: string) => edits.find((edit) => edit.op === op && (edit as { kind?: string }).kind === kind) as Record<string, unknown> | undefined;

  it("lead with the kind's date and its status", () => {
    expect(of("set-glance", "moment")).toEqual({ op: "set-glance", kind: "moment", fields: ["at", "who"] });
    expect(of("set-glance", "dish")).toEqual({ op: "set-glance", kind: "dish", fields: ["status", "course"] });
    expect(of("set-view", "moment")).toEqual({ op: "set-view", kind: "moment", slot: "row", blocks: [{ text: "{at | date}, {at | time}" }, { title: "{name}" }] });
    expect(of("set-view", "dish")).toEqual({ op: "set-view", kind: "dish", slot: "row", blocks: [{ title: "{name}" }, { text: "{status}" }] });
  });

  it("and leave a kind with neither a date nor a status to the derived row and glance", () => {
    expect(of("set-glance", "room")).toBeUndefined();
    expect(of("set-view", "room")).toBeUndefined();
  });

  it("each say what they are, as the starter would", () => {
    expect(rowFromDeclaration(plain, "moment")!.said).toBe("A row of schedule leads with its day and time, then its name, so a list of them reads at a glance.");
    expect(glanceFromDeclaration(plain, "dish")!.said).toBe("A glance at one of the dishes says status, course, its status first.");
  });
});

describe("a document that already has a home, rows or glances", () => {
  const designed = {
    ...plain,
    kinds: { ...plain.kinds, dish: { ...plain.kinds["dish"]!, glance: ["course"] } },
    views: { home: [{ headline: "Thursday at Diana's" }, { list: "all('dish')", as: "row" }], moment: { row: [{ headline: "{at | time} · {name}" }] } },
  } as GraviewDocument;
  const { edits } = composeDesign(designed);

  it("keeps them: only what is missing is proposed", () => {
    expect(homeFromDeclaration(designed)).toBeUndefined();
    expect(rowFromDeclaration(designed, "moment")).toBeUndefined();
    expect(glanceFromDeclaration(designed, "dish")).toBeUndefined();
    expect(edits.some((edit) => edit.op === "set-home")).toBe(false);
    expect(edits.some((edit) => edit.op === "set-view" && (edit as { kind?: string }).kind === "moment")).toBe(false);
    expect(edits.some((edit) => edit.op === "set-glance" && (edit as { kind?: string }).kind === "dish")).toBe(false);
    // What is still missing is still proposed.
    expect(edits).toContainEqual({ op: "set-glance", kind: "moment", fields: ["at", "who"] });
    expect(edits.some((edit) => edit.op === "set-view" && (edit as { kind?: string }).kind === "dish")).toBe(true);
  });
});

describe("the words a host composes with", () => {
  it("are on a public entry, @graview/core/compose, and in the surface the entries hold", () => {
    const exported = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).exports as Record<string, unknown>;
    expect(Object.keys(exported)).toContain("./compose");
    expect(typeof compose.nounWords).toBe("function");
    expect(typeof compose.pluralWords).toBe("function");
    expect(compose.nounWords(plain.kinds, "moment")).toBe("schedule item");
    expect(compose.pluralWords(plain.kinds, "moment")).toBe("schedule");
    // The fingerprint a host reads: docs/stability.md names them with the entry, and the entry test lists every name the entry exports.
    const stability = readFileSync(new URL("../../../../docs/stability.md", import.meta.url), "utf8");
    expect(stability).toMatch(/`@graview\/core\/compose`[^\n]*`nounWords\(kinds, kind\)`[^\n]*`pluralWords\(kinds, kind\)`/);
    const entries = readFileSync(new URL("./the-main-entry-carries-only-what-a-page-draws-with.test.ts", import.meta.url), "utf8");
    expect(entries).toMatch(/"@graview\/core\/compose": \{ from: compose, names: \[[^\]]*"nounWords"[^\]]*"pluralWords"/);
  });
});
