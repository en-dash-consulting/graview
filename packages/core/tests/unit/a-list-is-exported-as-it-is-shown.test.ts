import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { compileDocument } from "../../src/check.js";
import { arrangeable, listGroup } from "../../src/arrange.js";
import { shownList } from "../../src/shown.js";
import { CSV_BOM, csvCell, csvFileName, csvSafe, listCsv, listCsvRows, toCsv } from "../../src/csv.js";
import { parseCsv } from "../../src/import/index.js";
import { createSchema, defineNode, Graph, Store, z, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import type { GraviewDocument } from "../../src/document/index.js";

/**
 * A LIST IS EXPORTED AS IT IS SHOWN (Roadmap f-view-export-csv). "If I'm
 * viewing a list of questions, grouped by or whatever, I might want to
 * export that list as a CSV." The rows are the records the place shows, in
 * its order, with its filter, words and groups (`shownList`, which the
 * list page draws from too); a "Group" column comes first when it is
 * grouped, then the name, then the fields its page reads, each said as the
 * page says it. The writer is the mirror of the import's `parseCsv`, and a
 * cell a spreadsheet would run as a formula is written as text. Never more
 * than the seat sees: a field its sight keeps is no column.
 */
const desk: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Help desk",
  brand: { currency: "USD", locale: "en-US" },
  kinds: {
    person: { noun: "person", plural: "people", people: true, fields: { name: { type: "string", required: true } } },
    question: {
      noun: "question",
      plural: "questions",
      label: "{title}",
      fields: {
        title: { type: "string", required: true },
        status: { type: "enum", options: ["new", "answered", "done"], required: true },
        asked: { type: "date" },
        bounty: { type: "number", format: "money" },
        secret: { type: "string" },
      },
      computed: { worth: { expr: "either(bounty, 0) * 2", label: "Worth" } },
    },
  },
  acts: { "add-question": { title: "Ask a question", creates: "question" } },
  roles: ["agent", "visitor"],
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["agent"], kinds: ["question", "person"] },
      { roles: ["visitor"], kinds: ["question"], hide: ["secret", "bounty"] },
      { roles: ["visitor"], kinds: ["person"] },
    ],
  },
  pages: { lists: { question: { group: { by: "status", order: ["answered", "new"], closed: ["done"] } } } },
} as unknown as GraviewDocument;

const agent: Principal = { kind: "human", id: "person:ada", roles: ["agent"] };
const visitor: Principal = { kind: "human", id: "person:vic", roles: ["visitor"] };

function opened(): { app: GraviewApp<AnySchema>; store: Store<AnySchema> } {
  const compiled = compileDocument(desk);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "q:wifi", kind: "question", title: "Why is the wifi slow?", status: "new", asked: "2026-10-02", bounty: 1250, secret: "router 0451" },
        { id: "q:door", kind: "question", title: "=HYPERLINK(\"http://x\")", status: "answered", asked: "2026-10-01" },
        { id: "q:cafe", kind: "question", title: "Where is the café, \"downstairs\"?", status: "new", bounty: 5 },
        { id: "q:old", kind: "question", title: "Old one", status: "done" },
      ] as never,
      edges: [],
    },
  });
  return { app, store };
}

/** The list as the page shows it: grouped by status as the declaration groups it, the closed group shut. */
function shownAs(store: Store<AnySchema>, app: GraviewApp<AnySchema>, opened: ReadonlySet<string> = new Set()) {
  const declaredGroup = listGroup(app.pages?.lists?.["question"]?.group);
  return shownList({
    schema: store.schema,
    graph: store.graph,
    kind: "question",
    nodes: store.graph.nodesOfKind("question" as never) as never,
    arrangement: { sort: { by: "label", direction: "asc" }, group: { by: "status" } },
    offers: arrangeable(store.schema, "question"),
    declaredGroup,
    opened,
  });
}

const groupsOf = (shown: ReturnType<typeof shownAs>) => shown.groups.filter((group) => !group.shut).map((group) => ({ label: group.label, nodes: group.nodes }));

describe("the CSV writer", () => {
  it("quotes a cell holding a comma, a quote, a CR or an LF, doubling the quotes inside, and ends each row with CRLF after a byte-order mark", () => {
    expect(toCsv([["a", "b,c", 'say "hi"', "two\nlines", "cr\rhere"]])).toBe(`${CSV_BOM}a,"b,c","say ""hi""","two\nlines","cr\rhere"\r\n`);
    expect(toCsv([["x"], ["y"]], { bom: false })).toBe("x\r\ny\r\n");
  });

  it("writes a cell a spreadsheet would run as a formula as text: =, +, -, @, a tab or a CR first gets an apostrophe", () => {
    for (const cell of ["=1+1", "+1", "-1", "@SUM(A1)", "\tlead", "\rlead"]) expect(csvSafe(cell)).toBe(`'${cell}`);
    expect(csvSafe("plain = text")).toBe("plain = text");
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it("is read back by parseCsv as the rows it was given, the guarded cells with their apostrophe", () => {
    const rows = [["Group", "Name", "Notes"], ["New", "Café, \"downstairs\"", "first\r\nsecond"], ["", "Ünïcødé", ""], ["Done", "=2+2", "-3"]];
    const back = parseCsv(toCsv(rows), { delimiter: "," });
    expect(back).toEqual(rows.map((row) => row.map(csvSafe)));
  });

  it("names the file for the place and the day, with what a file system refuses replaced", () => {
    expect(csvFileName("Questions", "2026-10-23T10:00:00Z")).toBe("Questions — 2026-10-23.csv");
    expect(csvFileName('Who: "us" / them?', "2026-10-23")).toBe("Who- -us- - them- — 2026-10-23.csv");
    expect(csvFileName("Tasks", new Date(2026, 0, 5))).toBe("Tasks — 2026-01-05.csv");
  });
});

describe("a list exported as it is shown", () => {
  it("takes the order and the groups the page draws: the declared order of groups, the closed group shut and left out", () => {
    const { app, store } = opened();
    const shown = shownAs(store, app);
    expect(shown.groups.map((group) => [group.value, group.shut])).toEqual([["answered", false], ["new", false], ["done", true]]);
    expect(shown.nodes.map((node) => node.id)).toEqual(["q:door", "q:cafe", "q:wifi"]);
    // Opened, the closed group is shown, and written.
    expect(shownAs(store, app, new Set(["done"])).nodes.map((node) => node.id)).toEqual(["q:door", "q:cafe", "q:wifi", "q:old"]);
  });

  it("writes a Group column first, then the name, then each field the page reads, said as the page says it — computed ones too", () => {
    const { app, store } = opened();
    const shown = shownAs(store.seenBy(agent), app);
    const rows = listCsvRows({ schema: store.schema, graph: store.seenBy(agent).graph, kind: "question", groups: groupsOf(shown), grouped: shown.grouped, locale: "en-US", timeZone: "UTC" });
    expect(rows[0]).toEqual(["Group", "Name", "Status", "Asked", "Bounty", "Secret", "Worth"]);
    expect(rows.slice(1).map((row) => row.slice(0, 2))).toEqual([
      ["answered", '=HYPERLINK("http://x")'],
      ["new", "Where is the café, \"downstairs\"?"],
      ["new", "Why is the wifi slow?"],
    ]);
    const wifi = rows.find((row) => row[1] === "Why is the wifi slow?")!;
    expect(wifi).toEqual(["new", "Why is the wifi slow?", "New", "Oct 2, 2026", "$1,250", "router 0451", "2500"]);
    // The formula is written as text in the file.
    expect(listCsv({ schema: store.schema, graph: store.graph, kind: "question", groups: groupsOf(shown), grouped: true })).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("never writes a field the kind's display.hide keeps off its page", () => {
    const step = defineNode("step", { fields: z.object({ label: z.string(), order: z.number(), note: z.string().optional() }), display: { hide: ["order"] } });
    const schema = createSchema([step]);
    const graph = Graph.from(schema, { nodes: [{ id: "s1", kind: "step", label: "Pack", order: 7, note: "boxes" }], edges: [] } as never);
    const rows = listCsvRows({ schema, graph: graph as never, kind: "step", groups: [{ nodes: graph.nodesOfKind("step") }], grouped: false });
    expect(rows).toEqual([["Name", "Note"], ["Pack", "boxes"]]);
  });

  it("writes no Group column when the list is not grouped, and the rows in the list's own order", () => {
    const { store } = opened();
    const shown = shownList({ schema: store.schema, graph: store.graph, kind: "question", nodes: store.graph.nodesOfKind("question" as never) as never, arrangement: { sort: { by: "asked", direction: "desc" }, filter: [{ key: "status", value: "new" }] }, offers: arrangeable(store.schema, "question") });
    const rows = listCsvRows({ schema: store.schema, graph: store.graph, kind: "question", groups: [{ nodes: shown.nodes }], grouped: shown.grouped });
    expect(rows[0]![0]).toBe("Name");
    expect(rows.slice(1).map((row) => row[0])).toEqual(["Why is the wifi slow?", "Where is the café, \"downstairs\"?"]);
  });

  it("never writes what the seat's sight keeps: a field hidden from a visitor is no column, and its value is in no cell", () => {
    const { app, store } = opened();
    const seen = store.seenBy(visitor);
    const shown = shownAs(seen, app);
    const rows = listCsvRows({ schema: seen.schema, graph: seen.graph, kind: "question", groups: groupsOf(shown), grouped: shown.grouped });
    expect(rows[0]).not.toContain("Secret");
    expect(rows[0]).not.toContain("Bounty");
    const text = toCsv(rows);
    expect(text).not.toMatch(/0451|1,250|1250/);
    // A computed field is worked out over what the visitor is served: no bounty, so no worth of it.
    expect(text).not.toContain("2500");
  });
});
