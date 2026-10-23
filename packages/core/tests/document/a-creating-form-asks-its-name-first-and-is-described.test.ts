import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { formFields, visitorForm } from "../../src/forms.js";
import { humanizeField, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A FORM THAT MAKES A RECORD ASKS FOR ITS NAME FIRST, AND AN AGENT CAN READ IT.
 *
 * Threat Watch's "Add a threat" asked Affected versions, Aliases, Concern,
 * Cvss, Disclosed… — the fields as a stored document had sorted them — with
 * the name it must be given buried, and `cvss` said "Cvss". And the agent
 * that declared it could not see the form at all: describe_place said
 * nothing of what a place's forms ask.
 */
const threatWatch = (page?: object) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  roles: ["owner", "reader", "visitor"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["visitor"], mutations: ["report-threat"] }], sees: [{ roles: ["owner", "reader"], kinds: ["threat"] }] },
  kinds: {
    threat: {
      fields: {
        affectedVersions: { type: "string" },
        aliases: { type: "string" },
        concern: { type: "text" },
        cvss: { type: "number", min: 0, max: 10 },
        disclosed: { type: "date" },
        name: { type: "string", required: true },
        severity: { type: "enum", options: ["critical", "high", "low"], required: true },
        status: { type: "enum", options: ["open", "contained"], required: true, default: "open" },
      },
      ...(page ? { page } : {}),
    },
  },
  acts: {
    "add-threat": { title: "Add a threat", creates: "threat" },
    "report-threat": { title: "Report a threat", creates: "threat" },
  },
  forms: { report: { act: "report-threat", title: "Report a threat", intro: "Tell us what you saw." } },
});

const compiled = (page?: object) => {
  const result = compileDocument(threatWatch(page));
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
};
const asked = (app: GraviewApp<AnySchema>, act = "add-threat") => formFields(app.mutations!.find((one) => one.name === act)!.input).map((field) => field.name);
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

describe("a form that makes a record", () => {
  it("asks first for the name, then what must be answered, then the rest as the kind declares them", () => {
    expect(asked(compiled())).toEqual(["name", "severity", "affectedVersions", "aliases", "concern", "cvss", "disclosed", "status"]);
  });

  it("asks the rest in the order the kind's page names them, where set-page-fields has said one", () => {
    expect(asked(compiled({ fields: ["status", "disclosed"], groups: [{ title: "Scoring", fields: ["cvss"] }] }))).toEqual(["name", "severity", "status", "disclosed", "cvss", "affectedVersions", "aliases", "concern"]);
  });

  it("asks first for the fields the kind's label is said from", () => {
    const document = threatWatch();
    (document.kinds.threat as Record<string, unknown>)["label"] = "{aliases} ({name})";
    const result = compileDocument(document);
    if (!result.ok) throw new Error("did not compile");
    expect(asked(result.app as GraviewApp<AnySchema>).slice(0, 3)).toEqual(["aliases", "name", "severity"]);
  });

  it("asks a visitor's form in the same order", () => {
    const app = compiled();
    expect(visitorForm(app, "report")!.fields.map((field) => field.name).slice(0, 2)).toEqual(["name", "severity"]);
  });
});

describe("a key with no label of its own", () => {
  it("says an abbreviation spoken as letters in capitals", () => {
    expect(["cvss", "sourceUrl", "ids", "ioc", "apiKey", "rsvp"].map(humanizeField)).toEqual(["CVSS", "Source URL", "IDs", "IOC", "API key", "RSVP"]);
  });

  it("leaves every other word as a word: no guess from its length or its vowels", () => {
    expect(["hrs", "pts", "drName", "status", "idea", "identity", "urgent", "said"].map(humanizeField)).toEqual(["Hrs", "Pts", "Dr name", "Status", "Idea", "Identity", "Urgent", "Said"]);
  });
});

describe("describe_place says the forms a place offers", () => {
  const app = compiled();
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy! });

  it("says each creating act's fields on its kind's list, in order, with labels, what must be answered, what each takes and its choices", () => {
    const said = describePlace(store, owner, "threats", { app });
    if (!said.ok) throw new Error(said.error);
    const form = said.description.forms?.find((one) => one.act === "add-threat");
    expect(form?.title).toBe("Add a threat");
    expect(form?.fields.slice(0, 2)).toEqual([
      { name: "name", label: "Name", required: true, input: "text" },
      { name: "severity", label: "Severity", required: true, input: "choice", choices: ["Critical", "High", "Low"] },
    ]);
    expect(form?.fields.find((field) => field.name === "cvss")).toEqual({ name: "cvss", label: "CVSS", required: false, input: "number", min: 0, max: 10 });
    expect(form?.fields.find((field) => field.name === "concern")?.input).toBe("long text");
    expect(said.description.text).toContain('Form "Add a threat" (act add-threat), button "Add a threat":');
    expect(said.description.text).toContain("- Name * (name) — text");
    expect(said.description.text).toContain("- Severity * (severity) — choice: Critical, High, Low");
  });

  it("offers a seat no form it may not run", () => {
    const reader: Principal = { kind: "human", id: "u:reader", roles: ["reader"] };
    const said = describePlace(store, reader, "threats", { app });
    if (!said.ok) throw new Error(said.error);
    expect(said.description.forms).toBeUndefined();
  });

  it("says what a visitor's form asks, at its own address", () => {
    const said = describePlace(store, owner, "forms/report", { app });
    if (!said.ok) throw new Error(said.error);
    expect(said.description.drawnBy).toBe("form");
    expect(said.description.place.address).toBe("/forms/report");
    expect(said.description.forms?.[0]).toMatchObject({ act: "report-threat", visitor: "report", submit: "Report a threat" });
    expect(said.description.forms?.[0]?.fields[0]).toEqual({ name: "name", label: "Name", required: true, input: "text" });
    expect(said.description.text).toContain("Tell us what you saw.");
  });

  it("names the visitor forms among the places when a place is not found", () => {
    const said = describePlace(store, owner, "nowhere", { app });
    expect(said.ok ? [] : said.places).toContain("forms/report");
  });
});
