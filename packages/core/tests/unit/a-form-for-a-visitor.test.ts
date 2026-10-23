import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { compileDocument } from "../../src/check.js";
import { toDocument, type GraviewDocument } from "../../src/document/index.js";
import { formReceived, formVisitor, visitorForm } from "../../src/forms.js";
import { nameOfAuthor, refusalOf, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { answerSeenBy } from "../../src/seat.js";

/**
 * A FORM FOR A VISITOR (Roadmap f-public-forms): an RSVP or a sign-up link
 * for people who never join the workspace, whose answers land as records.
 * The declaration says the form (`forms.rsvp`: the act, its fields, what
 * the visitor is told after); the policy says what the visitor's role may
 * do and see, as it says it for anybody; the host mints one visitor per
 * submission (`form:<token>`), which the log names for the form and never
 * by its token; and the visitor's seat is served nothing of the app — not
 * the records already there, not the one they made through a picker or a
 * refusal — while the answer lands on the whole store.
 */
const RSVP = JSON.parse(readFileSync(new URL("../document/fixtures/rsvp.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const copy = (): GraviewDocument & Record<string, unknown> => structuredClone(RSVP) as never;

function compiled(document: unknown = RSVP): GraviewApp<AnySchema> {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(result.findings.map((f) => `${f.code} ${f.path}: ${f.message}`).join("\n"));
  return result.app as GraviewApp<AnySchema>;
}
const findings = (document: unknown) => {
  const result = compileDocument(document);
  return result.findings.filter((f) => f.code.startsWith("check:form-")).map((f) => ({ severity: f.severity, code: f.code.slice("check:".length), path: f.path, message: f.message }));
};

const HOST: Principal = { kind: "human", id: "hana", name: "Hana", roles: ["host"] };

function party() {
  const app = compiled();
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy } as never) as Store<AnySchema>;
  store.apply({ name: "add-table", args: { name: "Rose" } }, { author: HOST });
  store.apply({ name: "add-guest", args: { name: "Grace Hopper", coming: "yes", email: "grace@example.com" } }, { author: HOST });
  return { app, store };
}

describe("a form for a visitor, declared", () => {
  it("is read from a document's forms and given back by toDocument", () => {
    const app = compiled();
    expect(app.forms?.rsvp).toEqual(RSVP.forms!.rsvp);
    expect(toDocument(app).document.forms).toEqual(RSVP.forms);
  });

  it("resolves to its act, the fields it names in order, and the words around them", () => {
    const form = visitorForm(compiled(), "rsvp")!;
    expect(form.act.name).toBe("add-guest");
    expect(form.fields.map((field) => field.name)).toEqual(["name", "email", "coming", "note"]);
    expect({ title: form.title, intro: form.intro, submit: form.submit, role: form.role }).toEqual({ title: "RSVP", intro: RSVP.forms!.rsvp!.intro, submit: "Answer the invitation", role: "visitor" });
    expect(formReceived(form)).toEqual({ said: "Received — thank you.", next: "Thank you — the hosts will write to you a week before." });
    expect(visitorForm(compiled(), "nowhere")).toBeUndefined();
  });

  it("asks, unsaid, every argument a visitor could answer and leaves out a picker over records they are not served", () => {
    const document = copy();
    document.acts!["seat-guest"] = { title: "Seat yourself", description: "Answer and pick a table.", creates: "guest", effects: [{ connect: "table", from: "$new", to: "$table" }], args: { table: { type: "string" } } } as never;
    delete (document.forms!.rsvp as { fields?: unknown }).fields;
    // In the order a form that makes a guest asks: the name, what must be answered, then the rest.
    expect(visitorForm(compiled(document), "rsvp")!.fields.map((field) => field.name)).toEqual(["name", "coming", "email", "note"]);
  });

  it("is refused by the document's shape when it says a key a form does not have", () => {
    const document = copy();
    (document.forms!.rsvp as Record<string, unknown>)["redirect"] = "https://example.com";
    expect(compileDocument(document).ok).toBe(false);
  });
});

describe("the visitor a host mints for one submission", () => {
  it("holds the form's role and nothing else, under the host's id, named for the form", () => {
    expect(formVisitor(compiled(), "rsvp", "form:tok-1")).toEqual({ kind: "visitor", id: "form:tok-1", name: "a visitor via the RSVP form", roles: ["visitor"] });
    expect(() => formVisitor(compiled(), "nowhere", "form:x")).toThrow(/no form called "nowhere": the forms are rsvp/);
  });

  it("runs the form's act, and the record lands on the whole store, its author the visitor", () => {
    const { app, store } = party();
    const visitor = formVisitor(app, "rsvp", "form:tok-1");
    store.apply({ name: "add-guest", args: { name: "Ada Lovelace", coming: "maybe", note: "Bringing a cake." } }, { author: visitor });
    const ada = store.snapshot().nodes.find((node) => node.name === "Ada Lovelace");
    expect(ada).toMatchObject({ kind: "guest", coming: "maybe", note: "Bringing a cake." });
    const op = store.log.all().at(-1)!;
    expect(op.author).toMatchObject({ id: "form:tok-1", roles: ["visitor"] });
    // Activity says the form, never the token.
    expect(nameOfAuthor(op.author, { graph: store.graph as never, schema: store.schema })).toBe("a visitor via the RSVP form");
    expect(nameOfAuthor({ kind: "human", id: "form:tok-2" }, { graph: store.graph as never, schema: store.schema })).toBe("a visitor via a form");
  });

  it("may run nothing else: another act is refused, naming who could", () => {
    const { app, store } = party();
    const visitor = formVisitor(app, "rsvp", "form:tok-1");
    expect(() => store.apply({ name: "add-table", args: { name: "Lily" } }, { author: visitor })).toThrow(/a host can/);
  });
});

describe("a visitor's seat exposes no record of the app", () => {
  it("is served nothing before it answers or after — not the guests already there, not the tables, not its own answer", () => {
    const { app, store } = party();
    const visitor = formVisitor(app, "rsvp", "form:tok-1");
    expect(store.seenBy(visitor).snapshot().nodes).toEqual([]);
    const answer = store.apply({ name: "add-guest", args: { name: "Ada Lovelace", coming: "yes" } }, { author: visitor });
    expect(store.seenBy(visitor).snapshot()).toEqual({ nodes: [], edges: [] });
    // What the act answers the seat names nothing but what it sent.
    expect(JSON.stringify(answerSeenBy(store, visitor, answer))).not.toMatch(/Grace|Rose|grace@example/);
    // The seat's log is the log with every record withheld: nothing of Grace or the table in it.
    expect(JSON.stringify(store.seenBy(visitor).log.all())).not.toMatch(/Grace|Rose|grace@example/);
  });

  it("is told the same whether a record it might name is there or not: an id it guesses is missing", () => {
    const { app, store } = party();
    const visitor = formVisitor(app, "rsvp", "form:tok-1");
    const table = store.snapshot().nodes.find((node) => node.kind === "table")!.id;
    const refused = (id: string) => {
      try {
        store.apply({ name: "edit-guest", args: { id, name: "x" } }, { author: visitor });
        return null;
      } catch (error) {
        return refusalOf(error);
      }
    };
    expect(refused(table)).toEqual(refused("table:nowhere"));
  });
});

describe("graview check holds a form to what a visitor can do", () => {
  it("finds nothing to say of the RSVP", () => {
    expect(findings(RSVP)).toEqual([]);
  });

  it("says an act the visitor's role is not granted: the form would refuse every answer", () => {
    const document = copy();
    document.policy!.grants = document.policy!.grants.filter((grant) => grant.roles === "*" || !grant.roles.includes("visitor"));
    expect(findings(document)).toEqual([expect.objectContaining({ severity: "error", code: "form-act-not-granted", path: "forms.rsvp.act" })]);
  });

  it("says a policy that serves the visitor every record, or no policy at all", () => {
    const sightless = copy();
    delete sightless.policy!.sees;
    expect(findings(sightless)).toEqual([expect.objectContaining({ severity: "error", code: "form-without-sight", path: "forms.rsvp" })]);
    const open = copy();
    delete open.policy;
    expect(findings(open)).toEqual([expect.objectContaining({ code: "form-without-sight", message: expect.stringContaining("no policy") })]);
  });

  it("says an act it does not have, and one that acts on a record a visitor would have to pick", () => {
    const unknown = copy();
    unknown.forms!.rsvp!.act = "add-guests";
    expect(findings(unknown)[0]).toEqual(expect.objectContaining({ code: "form-unknown-act", path: "forms.rsvp.act" }));
    const onARecord = copy();
    onARecord.forms!.rsvp!.act = "edit-guest";
    expect(findings(onARecord)[0]).toEqual(expect.objectContaining({ code: "form-act-on-a-record" }));
  });

  it("says a field the act does not take, and a required one the form leaves out", () => {
    const document = copy();
    document.forms!.rsvp!.fields = ["name", "phone"];
    expect(findings(document).map((f) => f.code)).toEqual(["form-field-unknown", "form-omits-required"]);
    expect(findings(document)[1]!.message).toContain(`needs "coming"`);
  });

  it("says a required picker over records the visitor is not served: nobody could fill it", () => {
    const document = copy();
    document.acts!["add-guest"] = { ...document.acts!["add-guest"]!, effects: [{ connect: "table", from: "$new", to: "$table" }] } as never;
    document.forms!.rsvp!.fields = ["name", "coming", "table"];
    expect(findings(document)).toEqual([expect.objectContaining({ severity: "error", code: "form-field-unfillable", message: expect.stringContaining("it picks from tables, which a visitor is not served") })]);
  });

  it("warns where a sight serves the visitor a kind — to everybody, or by name where no picker asks for it", () => {
    const everybody = copy();
    everybody.policy!.sees = [...everybody.policy!.sees!, { roles: "*", kinds: ["table"] }];
    expect(findings(everybody)).toEqual([expect.objectContaining({ severity: "warning", code: "form-visitor-sees", message: expect.stringContaining("every one of the tables, because a sight shows them to everybody") })]);
    const named = copy();
    named.policy!.sees = [...named.policy!.sees!, { roles: ["visitor"], kinds: ["guest"] }];
    expect(findings(named)).toEqual([expect.objectContaining({ code: "form-visitor-sees", message: expect.stringContaining(`names the "visitor" role`) })]);
  });

  it("warns where the visitor's role may run more than its forms' acts", () => {
    const document = copy();
    document.policy!.grants = [...document.policy!.grants, { roles: ["visitor"], mutations: ["add-table"] }];
    expect(findings(document)).toEqual([expect.objectContaining({ severity: "warning", code: "form-visitor-may-more", path: "policy.grants", message: expect.stringContaining(`"add-table"`) })]);
  });

  it("judges a form's own role where it names one", () => {
    const document = copy();
    document.forms!.rsvp!.role = "respondent";
    expect(findings(document)).toEqual([expect.objectContaining({ code: "form-act-not-granted", message: expect.stringContaining(`the role "respondent"`) })]);
  });
});
