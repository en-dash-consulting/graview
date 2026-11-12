import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as entry from "@graview/core/compose";
import { compileDocument } from "../../src/check.js";
import { composeDesign, glanceFromDeclaration, homeFromDeclaration, rowFromDeclaration } from "../../src/compose.js";
import { describePlace } from "../../src/describe.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { designFindings } from "../../src/document/design-findings.js";
import { createSchema, defineApp, defineNode, sayIn, Store, z, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { declareInstallation } from "../../src/installation.js";

/**
 * COMPOSEDESIGN PROPOSES A HOME AND ROWS FOR A PLAIN DOCUMENT (Roadmap
 * f-compose-home-from-declaration). Graview Cloud composed a first home —
 * a count headline, a dated-first list per kind — and a row and a glance
 * for each kind itself, because `composeDesign` proposed only an accent
 * for a plain document: its critic fixes only what it warns about, and
 * plain kinds raise no warning. It now proposes them, only what is
 * missing, saying what the derived defaults say; and the words a host
 * composes with are on a public entry.
 */
const plain: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  kinds: {
    dish: { noun: "dish", plural: "dishes", fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["proposed", "confirmed"], default: "proposed" }, course: { type: "enum", options: ["main", "side", "dessert"] }, notes: { type: "text" } } },
    moment: { noun: "schedule item", plural: "schedule", fields: { name: { type: "string", required: true }, who: { type: "string" }, at: { type: "datetime" }, updatedAt: { type: "datetime" } } },
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
const compiled = (document: GraviewDocument) => {
  const out = compileDocument(document, { today: () => "2026-11-11" });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.app as GraviewApp<AnySchema>;
};
const of = (edits: readonly unknown[], op: string, kind: string) => edits.find((edit) => (edit as { op: string }).op === op && (edit as { kind?: string }).kind === kind) as Record<string, unknown> | undefined;

describe("composeDesign on a plain document with no home", () => {
  const { edits, said } = composeDesign(plain);
  const home = edits.find((edit) => edit.op === "set-home") as { blocks: Record<string, unknown>[] } | undefined;

  it("proposes a home of a count headline, said in English's plural where the declared one is not a count, and a list per kind, dated kinds first", () => {
    expect(home!.blocks[0]).toEqual({
      headline: "{count(all('moment')) | words | capital} {count(all('moment')) | plural: 'schedule item'}, {count(all('dish')) | words} {count(all('dish')) | plural: 'dish', 'dishes'} and {count(all('room')) | words} {count(all('room')) | plural: 'room', 'rooms'}.",
    });
    expect(home!.blocks.slice(1)).toEqual([
      { when: "count(all('moment')) > 0", show: [{ title: "Schedule" }, { list: "all('moment')", as: "row", sort: "at" }] },
      { when: "count(all('dish')) > 0", show: [{ title: "Dishes" }, { list: "all('dish')", as: "row" }] },
      { when: "count(all('room')) > 0", show: [{ title: "Rooms" }, { list: "all('room')", as: "row" }] },
    ]);
    expect(said).toContain("The app has no home of its own, so it opens on how many schedule, dishes and rooms it holds, then a list of its schedule, dishes and rooms, the schedule first, by date.");
  });

  it("as edits graview check takes, with nothing left for the critic to warn of", () => {
    const document = applied(plain, edits);
    const out = compileDocument(document);
    expect(out.ok).toBe(true);
    expect(out.ok ? out.findings.filter((finding) => finding.severity === "error") : []).toEqual([]);
    expect(designFindings(document).filter((finding) => finding.severity === "warning")).toEqual([]);
  });
});

describe("a row and a glance for each kind that has none", () => {
  const { edits } = composeDesign(plain);

  it("lead with the kind's date — never a bookkeeping one — and its status, named first in a row, each only where a record holds it", () => {
    expect(of(edits, "set-glance", "moment")).toEqual({ op: "set-glance", kind: "moment", fields: ["at", "who"] });
    expect(of(edits, "set-glance", "dish")).toEqual({ op: "set-glance", kind: "dish", fields: ["status", "course"] });
    expect(of(edits, "set-view", "moment")).toEqual({ op: "set-view", kind: "moment", slot: "row", blocks: [{ title: "{name}" }, { when: "present(at)", show: [{ text: "{at | glance}" }] }] });
    expect(of(edits, "set-view", "dish")).toEqual({ op: "set-view", kind: "dish", slot: "row", blocks: [{ title: "{name}" }, { when: "present(status)", show: [{ text: "{status}" }] }] });
  });

  it("and leave a kind with neither a date nor a status to the derived row and glance", () => {
    expect(of(edits, "set-glance", "room")).toBeUndefined();
    expect(of(edits, "set-view", "room")).toBeUndefined();
  });

  it("each say what they are in the kind's and its fields' words", () => {
    expect(rowFromDeclaration(plain, "moment")!.said).toBe("Each schedule item is listed by its name, then its at, so a list of them reads at a glance.");
    expect(glanceFromDeclaration(plain, "dish")!.said).toBe("A glance at a dish says its status and course.");
  });

  it("finds a status by its role or its choices, not its name alone", () => {
    const named = { ...plain, kinds: { job: { fields: { name: { type: "string", required: true }, statusNote: { type: "enum", options: ["a", "b"] }, step: { type: "enum", options: ["queued", "running", "shipped"] } } } } } as unknown as GraviewDocument;
    expect(glanceFromDeclaration(named, "job")!.edit).toEqual({ op: "set-glance", kind: "job", fields: ["step", "statusNote"] });
    const roled = { ...plain, kinds: { job: { fieldRoles: { status: "lane" }, fields: { name: { type: "string", required: true }, lane: { type: "enum", options: ["left", "right"] } } } } } as unknown as GraviewDocument;
    expect(glanceFromDeclaration(roled, "job")!.edit).toEqual({ op: "set-glance", kind: "job", fields: ["lane"] });
  });
});

describe("a composed row says the moment exactly as the derived glance does", () => {
  const document = applied(plain, composeDesign(plain).edits);
  const app = compiled(document);
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  const rowOf = (node: Record<string, unknown>) => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: { nodes: [node], edges: [] } as never });
    const described = describePlace(store, owner, "home", { app: app as never });
    if (!described.ok) throw new Error(described.error);
    const list = described.description.parts.find((part) => part.t === "list") as unknown as { groups: { items: { title: string; parts: { text: string }[] }[] }[] };
    return list.groups[0]!.items[0]!;
  };

  it("names the zone where nobody's clock says it, and says nothing for a record with no date or a value that is not one", () => {
    sayIn({ appTimeZone: "Asia/Tokyo" });
    try {
      expect(rowOf({ id: "m1", kind: "moment", name: "Dinner", at: "2026-11-26T14:30:00Z" })).toEqual({ id: "m1", kind: "moment", title: "Dinner", parts: [{ t: "text", text: "Nov 26, 2026, 11:30 PM GMT+9" }] });
      expect(rowOf({ id: "m2", kind: "moment", name: "Toast" }).parts).toEqual([]);
    } finally {
      sayIn({});
    }
  });

  it("says a date that repeats by its rule and its next day, as the derived glance does", () => {
    const chores = { ...plain, kinds: { chore: { noun: "chore", plural: "chores", fields: { name: { type: "string", required: true }, due: { type: "date", repeats: true } } } }, acts: { "add-chore": { title: "Add a chore", creates: "chore" } } } as unknown as GraviewDocument;
    const app = compiled(applied(chores, composeDesign(chores).edits));
    const node = { id: "c1", kind: "chore", name: "Bins", due: "2026-11-10", dueRepeat: { every: "week", on: ["tue"] } };
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: { nodes: [node], edges: [] } as never, today: () => "2026-11-11" } as never);
    const described = describePlace(store, owner, "home", { app: app as never, today: "2026-11-11" });
    if (!described.ok) throw new Error(described.error);
    const list = described.description.parts.find((part) => part.t === "list") as unknown as { groups: { items: { parts: { text: string }[] }[] }[] };
    expect(list.groups[0]!.items[0]!.parts.map((part) => part.text)).toEqual(["Every Tuesday, next Nov 17"]);
  });
});

describe("the composed home keeps to what each seat sees", () => {
  const office = {
    ...plain,
    name: "Office",
    kinds: {
      review: { noun: "salary review", plural: "salary reviews", fields: { name: { type: "string", required: true }, at: { type: "datetime" } } },
      task: { noun: "task", plural: "tasks", fields: { name: { type: "string", required: true }, due: { type: "date" } } },
    },
    acts: { "add-task": { title: "Add a task", creates: "task" }, "add-review": { title: "Add a review", creates: "review" } },
    roles: ["owner", "staff"],
    policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["staff"], mutations: ["add-task"] }], sees: [{ roles: ["owner"], kinds: ["review", "task"] }, { roles: ["staff"], kinds: ["task"] }] },
  } as unknown as GraviewDocument;

  it("counts in its headline only kinds every role sees, and stands each list only where its seat has some to see", () => {
    const home = homeFromDeclaration(office)!.edit as unknown as { blocks: Record<string, unknown>[] };
    expect(home.blocks[0]).toEqual({ headline: "{count(all('task')) | words | capital} {count(all('task')) | plural: 'task', 'tasks'}." });
    const app = compiled(applied(office, [home]));
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: { nodes: [{ id: "r1", kind: "review", name: "Ann" }, { id: "t1", kind: "task", name: "File it" }], edges: [] } as never });
    const staff = describePlace(store, { kind: "human", id: "u:s", roles: ["staff"] }, "home", { app: app as never });
    if (!staff.ok) throw new Error(staff.error);
    expect(staff.description.text).not.toMatch(/salary|review/i);
    expect(staff.description.text).toMatch(/One task\./);
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
    expect(of(edits, "set-view", "moment")).toBeUndefined();
    expect(of(edits, "set-glance", "dish")).toBeUndefined();
    expect(edits).toContainEqual({ op: "set-glance", kind: "moment", fields: ["at", "who"] });
    expect(of(edits, "set-view", "dish")).toBeDefined();
  });
});

describe("a TypeScript app", () => {
  it("is proposed nothing for the installation's own kinds", () => {
    const installation = declareInstallation({ roles: ["owner"], admin: "owner" });
    const chore = defineNode("chore", { fields: z.object({ name: z.string(), due: z.string().datetime().optional(), status: z.enum(["todo", "done"]) }), label: (node: { name: string }) => node.name } as never);
    const app = defineApp({ name: "Chores", schema: createSchema([chore, ...installation.kinds] as never), mutations: [], modules: installation.modules } as never);
    const kinds = composeDesign(app as never).edits.map((edit) => (edit as { kind?: string }).kind).filter(Boolean);
    expect(kinds).toContain("chore");
    expect(kinds.filter((kind) => kind === "user" || kind === "invitation")).toEqual([]);
  });
});

describe("the words a host composes with", () => {
  it("are on the public entry @graview/core/compose, which the package exports", () => {
    const exported = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).exports as Record<string, { default?: string }>;
    expect(exported["./compose"]?.default).toBe("./dist/compose.js");
    expect(typeof entry.nounWords).toBe("function");
    expect(typeof entry.pluralWords).toBe("function");
    expect(entry.nounWords(plain.kinds, "moment")).toBe("schedule item");
    expect(entry.pluralWords(plain.kinds, "moment")).toBe("schedule");
    // What a host holds the entry to: docs/stability.md names them with it.
    const stability = readFileSync(new URL("../../../../docs/stability.md", import.meta.url), "utf8");
    expect(stability).toMatch(/`@graview\/core\/compose`[^\n]*`nounWords\(kinds, kind\)`[^\n]*`pluralWords\(kinds, kind\)`/);
  });
});
