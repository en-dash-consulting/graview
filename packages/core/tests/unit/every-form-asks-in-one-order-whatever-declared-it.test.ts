import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { describeActForm } from "../../src/document/describe-forms.js";
import { askedFormFields, formFields, visitorForm } from "../../src/forms.js";
import { mutationToolSchema } from "../../src/json-schema.js";
import { askedArguments, askedFieldsOf, bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * EVERY FORM ASKS IN ONE ORDER, WHATEVER DECLARED IT (Roadmap
 * f-forms-same-order-everywhere). 0.1.48 made a document's creating act ask
 * the name first; "Change the threat" still asked in the kind's field order,
 * and an app written in TypeScript asked in its `z.object`'s key order — a
 * code app's "Add a threat" asked Aliases and CVSS before the name it must
 * be given.
 */
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const names = (fields: readonly { readonly name: string }[]) => fields.map((field) => field.name);

const threatDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    threat: {
      fields: {
        aliases: { type: "string" },
        cvss: { type: "number", min: 0, max: 10 },
        disclosed: { type: "date" },
        name: { type: "string", required: true },
        severity: { type: "enum", options: ["critical", "high", "low"], required: true },
        status: { type: "enum", options: ["open", "contained"], required: true, default: "open" },
      },
    },
  },
  acts: { "add-threat": { title: "Add a threat", creates: "threat" } },
};

describe("a record's derived edit", () => {
  const compiled = compileDocument(threatDocument);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [] });

  it("asks in the order the form that made the record asks: the name, what it cannot be without, then the rest", () => {
    const edit = store.mutation("edit-threat");
    expect(names(formFields(edit.input))).toEqual(["id", "name", "severity", "aliases", "cvss", "disclosed", "status"]);
    const add = app.mutations!.find((one) => one.name === "add-threat")!;
    expect(names(formFields(edit.input)).slice(1)).toEqual(names(formFields(add.input)));
  });

  it("describes its writes in that order too", () => {
    expect(store.mutation("edit-threat").writes).toEqual(["name", "severity", "aliases", "cvss", "disclosed", "status"]);
  });
});

describe("an app declared in TypeScript", () => {
  const threat = defineNode("threat", {
    // Declared as a stored document might sort them: the name it must be given among the rest.
    fields: z.object({
      aliases: z.string().optional(),
      cvss: z.number().min(0).max(10).optional(),
      name: z.string(),
      notes: z.string().optional(),
      severity: z.enum(["critical", "high", "low"]),
      status: z.enum(["open", "contained"]).default("open"),
    }),
    label: (node) => node.name,
    edges: { partOf: { to: ["family"], cardinality: "one" } },
  });
  const family = defineNode("family", { fields: z.object({ label: z.string() }) });
  const schema = createSchema([threat, family]);
  const { defineMutation } = bindSchema(schema);
  const addThreat = defineMutation("add-threat", {
    title: "Add a threat",
    creates: ["threat"],
    input: z.object({
      family: nodeRef(["family"]).optional(),
      aliases: z.string().optional(),
      cvss: z.number().optional(),
      name: z.string(),
      notes: z.string().optional(),
      severity: z.enum(["critical", "high", "low"]),
    }),
    apply(ctx, args) {
      const id = ctx.freshId(args.name, "threat");
      ctx.addNode({ id, kind: "threat", name: args.name, severity: args.severity, status: "open" } as never);
      if (args.family) ctx.addEdge({ kind: "partOf", from: id, to: args.family } as never);
    },
  });
  const app: GraviewApp<AnySchema> = {
    schema: schema as AnySchema,
    mutations: [addThreat] as never,
    roles: ["owner", "visitor"],
    policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["visitor"], mutations: ["add-threat"] }], sees: [{ roles: "*", kinds: ["threat", "family"] }] },
    forms: { report: { act: "add-threat", role: "visitor" } },
  } as never;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });

  it("asks a creating form for the name first, then what must be answered, then the rest, the record it links to keeping its place", () => {
    expect(names(askedFormFields(schema, addThreat as never))).toEqual(["family", "name", "severity", "aliases", "cvss", "notes"]);
  });

  it("reads the fields that name a record off its label, in the order the label says them", () => {
    const named = defineNode("threat", { fields: z.object({ cvss: z.number().optional(), aliases: z.string(), name: z.string() }), label: (node) => `${node.aliases} (${node.name})` });
    expect(askedFieldsOf(named as never)).toEqual(["aliases", "name", "cvss"]);
  });

  it("asks the rest in the order its page names them", () => {
    const paged = defineNode("threat", { fields: z.object({ aliases: z.string().optional(), notes: z.string().optional(), name: z.string() }), label: (node) => node.name, display: { page: { fields: ["notes"] } } });
    expect(askedFieldsOf(paged as never)).toEqual(["name", "notes", "aliases"]);
  });

  it("asks its derived edit in the same order as the form that makes one", () => {
    expect(names(formFields(store.mutation("edit-threat").input))).toEqual(["id", "name", "severity", "aliases", "cvss", "notes", "status"]);
  });

  it("asks a visitor's form, the form a seat is described and an agent's tool in that order", () => {
    expect(names(visitorForm(app, "report")!.fields)).toEqual(["family", "name", "severity", "aliases", "cvss", "notes"]);
    expect(names(describeActForm(store, owner, addThreat as never).fields)).toEqual(["family", "name", "severity", "aliases", "cvss", "notes"]);
    const tool = mutationToolSchema(addThreat as never, askedArguments(schema, addThreat as never));
    expect(Object.keys(tool.inputSchema["properties"] as object)).toEqual(["family", "name", "severity", "aliases", "cvss", "notes", "id"]);
    expect(tool.inputSchema["required"]).toEqual(["name", "severity"]);
  });

  it("leaves an act's own input as it was declared: only what asks reorders it", () => {
    expect(Object.keys((addThreat.input as unknown as { shape: object }).shape)).toEqual(["family", "aliases", "cvss", "name", "notes", "severity"]);
  });
});
