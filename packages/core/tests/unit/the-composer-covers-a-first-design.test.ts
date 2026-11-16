import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { belongsTo, composeDesign, glanceFromDeclaration, homeFromDeclaration, rowFromDeclaration } from "../../src/compose.js";
import { describePlace } from "../../src/describe.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { designFindings } from "../../src/document/design-findings.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * THE COMPOSER COVERS WHAT A HOST'S FIRST DESIGN DOES (Roadmap
 * f-composer-covers-cloud-first-design). Graview Cloud tried its first
 * design on `homeFromDeclaration`, `rowFromDeclaration` and
 * `glanceFromDeclaration` and held it: on its supper template guests and
 * dishes got no row, a dish did not say whose it was, guests were in no
 * order, past times stayed on the home, a list ran on, and the headline
 * counted three kinds. Here, a supper of the same shape, invented: the
 * households that come, their guests (an RSVP), their dishes (a course)
 * and the schedule (dated), with the members a kind of their own.
 */
const supper = {
  format: "graview-document",
  formatVersion: 1,
  name: "Harvest supper",
  kinds: {
    household: { noun: "household", plural: "households", label: "{name}", fields: { name: { type: "string", required: true }, address: { type: "place" } } },
    guest: {
      noun: "guest",
      plural: "guests",
      fields: { name: { type: "string", required: true }, rsvp: { type: "enum", label: "RSVP", options: ["yes", "maybe", "invited", "no"] }, diet: { type: "string" } },
      edges: { household: { to: ["household"], cardinality: "one", inverse: "its guests" } },
    },
    dish: {
      noun: "dish",
      plural: "dishes",
      fields: { name: { type: "string", required: true }, course: { type: "enum", options: ["starter", "main", "side", "dessert"] }, notes: { type: "text" } },
      edges: { household: { to: ["household"], cardinality: "one", inverse: "its dishes" }, cooks: { to: ["guest"], cardinality: "many" } },
    },
    slot: { noun: "schedule item", plural: "schedule items", fields: { name: { type: "string", required: true }, at: { type: "datetime" }, notes: { type: "text" } }, edges: { hostedBy: { to: ["household"], cardinality: "one" } } },
    member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true }, email: { type: "email" } } },
  },
  acts: {
    "add-household": { title: "Add a household", creates: "household" },
    "add-guest": { title: "Add a guest", creates: "guest" },
    "add-dish": { title: "Add a dish", creates: "dish" },
    "add-slot": { title: "Add to the schedule", creates: "slot" },
  },
  rules: { "guest-has-household": { over: "guest", require: "present(household)", says: "Every guest comes with a household." } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
} as unknown as GraviewDocument;

const TODAY = "2026-11-11";
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const applied = (document: GraviewDocument, edits: readonly unknown[]) => {
  const out = editDocument(document, edits);
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.document;
};
const compiled = (document: GraviewDocument) => {
  const out = compileDocument(document, { today: () => TODAY });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.app as GraviewApp<AnySchema>;
};
const of = (edits: readonly unknown[], op: string, kind: string) => edits.find((edit) => (edit as { op: string }).op === op && (edit as { kind?: string }).kind === kind) as Record<string, unknown> | undefined;

type Item = { title: string; parts: { text: string }[] };
type Section = { items: Item[]; empty?: string };
/** The composed home as a seat is told it, each list under the title it stands beneath. */
function homeAs(document: GraviewDocument, nodes: readonly Record<string, unknown>[], edges: readonly Record<string, unknown>[] = [], principal: Principal = owner) {
  const app = compiled(applied(document, composeDesign(document).edits));
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: { nodes, edges } as never, today: () => TODAY } as never);
  const described = describePlace(store, principal, "home", { app: app as never, today: TODAY });
  if (!described.ok) throw new Error(described.error);
  const sections: Record<string, Section> = {};
  let heading = "";
  for (const part of described.description.parts as unknown as { t: string; text?: string; groups?: { items: Item[] }[]; empty?: string }[]) {
    if (part.t === "heading") heading = part.text!;
    if (part.t === "list") sections[heading] = { items: (part.groups ?? []).flatMap((group) => group.items), ...(part.empty ? { empty: part.empty } : {}) };
  }
  return { sections, text: described.description.text };
}

const riveras = { id: "h1", kind: "household", name: "The Riveras" };

describe("1. every named kind is given a row and a glance", () => {
  const { edits } = composeDesign(supper);

  it("guests and dishes too, which hold neither a date nor a status", () => {
    expect(of(edits, "set-glance", "guest")).toEqual({ op: "set-glance", kind: "guest", fields: ["rsvp", "diet"] });
    expect(of(edits, "set-glance", "dish")).toEqual({ op: "set-glance", kind: "dish", fields: ["course"] });
    expect(of(edits, "set-glance", "household")).toEqual({ op: "set-glance", kind: "household", fields: ["address"] });
    expect(of(edits, "set-view", "guest")).toEqual({ op: "set-view", kind: "guest", slot: "row", blocks: [{ title: "{name}" }, { when: "present(rsvp)", show: [{ text: "{rsvp}" }] }, { when: "present(household)", show: [{ text: "{household}" }] }] });
    expect(of(edits, "set-view", "household")).toEqual({ op: "set-view", kind: "household", slot: "row", blocks: [{ title: "{name}" }, { when: "present(address)", show: [{ text: "{address | glance}" }] }] });
  });

  it("each said in the kind's and its fields' words", () => {
    expect(rowFromDeclaration(supper, "dish")!.said).toBe("Each dish is listed by its name, then its course and the household it belongs to, so a list of them reads at a glance.");
    expect(glanceFromDeclaration(supper, "guest")!.said).toBe("A glance at a guest says its rsvp and diet.");
  });
});

describe("2. a row names the record it belongs to", () => {
  it("a dish's row says its course and its household", () => {
    const { sections } = homeAs(supper, [riveras, { id: "d1", kind: "dish", name: "Pumpkin pie", course: "dessert" }], [{ id: "e1", from: "d1", to: "h1", kind: "household" }]);
    expect(sections["Dishes"]!.items).toEqual([expect.objectContaining({ title: "Pumpkin pie", parts: [{ t: "text", text: "Dessert" }, { t: "text", text: "The Riveras" }] })]);
  });

  it("reads 'belongs to' as a to-one relation to another kind of the app, one a rule requires first, never a pairing of one to one", () => {
    expect(belongsTo(supper, "dish")).toEqual({ edge: "household", kind: "household" });
    expect(belongsTo(supper, "slot")).toEqual({ edge: "hostedBy", kind: "household" });
    expect(belongsTo(supper, "household")).toBeUndefined();
    const kinds = supper.kinds as Record<string, Record<string, unknown>>;
    // Two to-one relations: the one a rule requires is the one it belongs to, wherever it is declared.
    const required = {
      ...supper,
      kinds: { ...kinds, guest: { ...kinds["guest"], edges: { seatedAt: { to: ["household"], cardinality: "one" }, household: { to: ["household"], cardinality: "one" } } } },
    } as unknown as GraviewDocument;
    expect(belongsTo(required, "guest")).toEqual({ edge: "household", kind: "household" });
    // A guest and a household that each hold one of the other are a pair, not a group.
    const paired = { ...supper, kinds: { ...kinds, household: { ...kinds["household"], edges: { host: { to: ["guest"], cardinality: "one" } } } } } as unknown as GraviewDocument;
    expect(belongsTo(paired, "guest")).toBeUndefined();
    // Many, itself, another app's kind, or several kinds: none is one record it belongs to.
    const none = { ...supper, kinds: { ...kinds, dish: { ...kinds["dish"], edges: { cooks: { to: ["guest"], cardinality: "many" }, after: { to: ["dish"], cardinality: "one" }, farm: { to: ["@nick/farm/farm"], cardinality: "one" }, either: { to: ["guest", "household"], cardinality: "one" } } } } } as unknown as GraviewDocument;
    expect(belongsTo(none, "dish")).toBeUndefined();
  });
});

describe("3. an undated section is in its choice's order", () => {
  it("guests by their RSVP, as the choices are declared", () => {
    const home = homeFromDeclaration(supper)!.edit as unknown as { blocks: Record<string, unknown>[] };
    expect(home.blocks).toContainEqual({ when: "count(all('guest')) > 0", show: [{ title: "Guests" }, { list: "all('guest')", as: "row", sort: { by: "rsvp", direction: "choices" }, limit: 10 }] });
    const guests = [["g1", "no"], ["g2", "invited"], ["g3", "yes"], ["g4", "maybe"], ["g5", "yes"]].map(([id, rsvp]) => ({ id, kind: "guest", name: `Guest ${id}`, rsvp }));
    const { sections } = homeAs(supper, guests);
    expect(sections["Guests"]!.items.map((item) => item.parts[0]!.text)).toEqual(["Yes", "Yes", "Maybe", "Invited", "No"]);
  });
});

describe("4. a dated section says what is next", () => {
  const slots = [
    { id: "s1", kind: "slot", name: "Setup", at: "2026-11-10T15:00:00Z" },
    { id: "s2", kind: "slot", name: "Dinner", at: "2026-11-26T22:00:00Z" },
    { id: "s3", kind: "slot", name: "Toast" },
    { id: "s4", kind: "slot", name: "Drinks", at: "2026-11-26T20:00:00Z" },
  ];

  it("keeps records not before today, undated ones too, soonest first", () => {
    const home = homeFromDeclaration(supper)!.edit as unknown as { blocks: Record<string, unknown>[] };
    expect(home.blocks).toContainEqual({ when: "count(all('slot')) > 0", show: [{ title: "Schedule items" }, { list: "all('slot') where not (at < today())", as: "row", sort: "at", limit: 5, empty: "No schedule items ahead." }] });
    const { sections } = homeAs(supper, slots);
    expect(sections["Schedule items"]!.items.map((item) => item.title)).toEqual(["Drinks", "Dinner", "Toast"]);
  });

  it("and says so when nothing is ahead", () => {
    const { sections } = homeAs(supper, [slots[0]!]);
    expect(sections["Schedule items"]).toEqual({ items: [], empty: "No schedule items ahead." });
  });
});

describe("5. a section holds five dated records or ten others", () => {
  it("five schedule items and ten guests", () => {
    const many = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, kind: "slot", name: `Item ${i}`, at: `2026-11-${String(20 + i).padStart(2, "0")}T12:00:00Z` })),
      ...Array.from({ length: 14 }, (_, i) => ({ id: `g${i}`, kind: "guest", name: `Guest ${i}`, rsvp: "yes" })),
    ];
    const { sections } = homeAs(supper, many);
    expect(sections["Schedule items"]!.items).toHaveLength(5);
    expect(sections["Guests"]!.items).toHaveLength(10);
  });
});

describe("6. the headline counts up to five kinds, most-linked first, within 300 characters", () => {
  const headlineOf = (document: GraviewDocument) => ((homeFromDeclaration(document)!.edit as unknown as { blocks: { headline?: string }[] }).blocks[0]!.headline ?? "");
  const countedIn = (headline: string) => [...headline.matchAll(/count\(all\('([a-z-]+)'\)\)/g)].map((match) => match[1]!).filter((kind, at, all) => all.indexOf(kind) === at);

  it("households first, the kind most linked to, and never the members", () => {
    const headline = headlineOf(supper);
    expect(countedIn(headline)).toEqual(["household", "guest", "dish", "slot"]);
    expect(headline.length).toBeLessThanOrEqual(300);
    const { text } = homeAs(supper, [riveras, { id: "g1", kind: "guest", name: "Ana", rsvp: "yes" }, { id: "g2", kind: "guest", name: "Ben", rsvp: "no" }, { id: "d1", kind: "dish", name: "Pie" }]);
    expect(text).toMatch(/^# One household, two guests, one dish and zero schedule items\.$/m);
  });

  it("five at most, in fewer words where five would run past 300 characters", () => {
    const kinds: Record<string, unknown> = {};
    for (const name of ["apple", "bean", "corn", "date", "elder", "fig", "grape"]) kinds[name] = { fields: { name: { type: "string", required: true } }, ...(name === "grape" ? { edges: { on: { to: ["apple", "bean", "corn", "date", "elder", "fig"], cardinality: "many" } } } : {}) };
    const orchard = { ...supper, name: "Orchard", kinds, acts: {}, rules: {} } as unknown as GraviewDocument;
    const headline = headlineOf(orchard);
    expect(countedIn(headline)).toHaveLength(5);
    expect(countedIn(headline)[0]).toBe("grape");
    expect(headline.length).toBeLessThanOrEqual(300);
  });

  it("and still counts only what every seat sees", () => {
    const seen = { ...supper, policy: { ...(supper.policy as object), sees: [{ roles: "*", kinds: ["household", "guest", "slot"] }, { roles: ["owner"], kinds: ["dish", "member"] }] } } as unknown as GraviewDocument;
    expect(countedIn(headlineOf(seen))).toEqual(["household", "guest", "slot"]);
  });
});

describe("7. composeDesign leaves the people kind to the framework", () => {
  it("proposes no row, glance or home list for the members", () => {
    const { edits } = composeDesign(supper);
    expect(edits.filter((edit) => (edit as { kind?: string }).kind === "member")).toEqual([]);
    expect(JSON.stringify(edits.find((edit) => edit.op === "set-home"))).not.toContain("'member'");
  });

  it("nor a job, nor the critic's glance for the kind most things point at, when that is the members", () => {
    const team = {
      format: "graview-document",
      formatVersion: 1,
      name: "Team",
      kinds: {
        member: { people: true, fields: { name: { type: "string", required: true }, bio: { type: "text" }, status: { type: "enum", options: ["pending", "active", "done"] }, dueAt: { type: "date" } } },
        task: { fields: { name: { type: "string", required: true } }, edges: { assignee: { to: ["member"], cardinality: "one" }, reviewer: { to: ["member"], cardinality: "one" } } },
        note: { fields: { name: { type: "string", required: true } }, edges: { author: { to: ["member"], cardinality: "one" } } },
      },
      acts: { "finish-member": { title: "Finish", on: "member", sets: { status: "done" } }, "add-task": { title: "Add a task", creates: "task" } },
      roles: ["owner"],
      policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
    } as unknown as GraviewDocument;
    const { edits } = composeDesign(team);
    expect(edits.filter((edit) => (edit as { kind?: string }).kind === "member" || JSON.stringify(edit).includes("'member'"))).toEqual([]);
    // Assigned to a member is not belonging to one.
    expect(belongsTo(team, "task")).toBeUndefined();
    const document = applied(team, edits);
    expect(designFindings(document).filter((finding) => finding.severity === "warning")).toEqual([]);
  });
});

describe("a relation named with a hyphen, and a rule that forbids one", () => {
  const kinds = supper.kinds as Record<string, Record<string, unknown>>;

  it("is reached quoted, so the row still names whose it is", () => {
    const hyphened = { ...supper, kinds: { ...kinds, dish: { ...kinds["dish"], edges: { "made-by": { to: ["household"], cardinality: "one" } } } } } as unknown as GraviewDocument;
    expect(of(rowFromDeclaration(hyphened, "dish") ? [rowFromDeclaration(hyphened, "dish")!.edit] : [], "set-view", "dish")!["blocks"]).toContainEqual({ when: "present(out('made-by'))", show: [{ text: "{out('made-by')}" }] });
    const { sections } = homeAs(hyphened, [riveras, { id: "d1", kind: "dish", name: "Pie", course: "dessert" }], [{ id: "e1", from: "d1", to: "h1", kind: "made-by" }]);
    expect(sections["Dishes"]!.items[0]!.parts.map((part) => part.text)).toEqual(["Dessert", "The Riveras"]);
  });

  it("is not taken for one that requires it", () => {
    const forbids = (require: string) =>
      ({ ...supper, kinds: { ...kinds, guest: { ...kinds["guest"], edges: { seatedAt: { to: ["household"], cardinality: "one" }, household: { to: ["household"], cardinality: "one" } } } }, rules: { r: { over: "guest", require } } }) as unknown as GraviewDocument;
    expect(belongsTo(forbids("not present(household)"), "guest")).toEqual({ edge: "seatedAt", kind: "household" });
    expect(belongsTo(forbids("count(out('household')) == 0"), "guest")).toEqual({ edge: "seatedAt", kind: "household" });
    expect(belongsTo(forbids("count(out('household')) > 0"), "guest")).toEqual({ edge: "household", kind: "household" });
  });
});

describe("the composed supper", () => {
  it("compiles, with nothing for the critic to warn of", () => {
    const document = applied(supper, composeDesign(supper).edits);
    const out = compileDocument(document);
    expect(out.ok ? out.findings.filter((finding) => finding.severity === "error") : out.findings).toEqual([]);
    expect(designFindings(document).filter((finding) => finding.severity === "warning")).toEqual([]);
  });
});
