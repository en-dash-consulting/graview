import { describe, expect, it } from "vitest";
import { compileDocument, describeApp } from "../../src/check.js";
import { DocumentSpec, type GraviewDocument } from "../../src/document/index.js";
import { blockContextFor, compileBlocks, computedValues, resolveBlocks } from "../../src/blocks.js";
import { toDocument } from "../../src/document/index.js";
import { readableFields } from "../../src/words.js";
import {
  createSchema,
  defineNode,
  linkedReads,
  linkedRecordField,
  linkedRelationOf,
  parseLinkedTarget,
  readLinkedThrough,
  refusalOf,
  Store,
  z,
  type AnySchema,
  type GraviewApp,
  type LinkedRecord,
  type LinkedViewer,
} from "../../src/index.js";
import { linkedChange, linkedRecordsOver, recordLinkedChange } from "../../src/linked.js";
import { mutationToolSchema } from "../../src/json-schema.js";
import { shapesOfSchema } from "../../src/document/rules.js";

/**
 * FR-171, THE FULL RELATION. A RECORD LINKS A RECORD IN ANOTHER APP.
 *
 *   "forHouse": { "to": ["@nick/house/house"], "cardinality": "one" }
 *
 * Two compiled documents — a house app and a purchase-scenarios app that
 * links its houses — and an in-memory host over both (`linkedRecordsOver`)
 * that answers as the viewer: the owner opens the house app and is told
 * every field; a buyer opens it and is told every field but the owner's
 * notes; a guest may not open it, and is told nothing.
 */
const houses = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "House",
    roles: ["owner", "buyer"],
    policy: {
      grants: [{ roles: ["owner"], mutations: "*" }],
      sees: [
        { roles: ["owner"], kinds: ["house"] },
        { roles: ["buyer"], kinds: ["house"], hide: ["notes"] },
      ],
    },
    kinds: {
      house: {
        fields: {
          street: { type: "string", required: true },
          bedrooms: { type: "integer" },
          listPrice: { type: "number", format: "money" },
          notes: { type: "text" },
        },
        label: "{street}",
        describe: "{bedrooms} bedrooms",
      },
    },
    acts: { "add-house": { title: "Add a house", creates: "house" } },
  }) as unknown as GraviewDocument;

const scenarios = (edge: Record<string, unknown> = { to: ["@nick/house/house"], cardinality: "one", description: "the house this scenario buys" }): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Purchase scenarios",
    kinds: {
      scenario: {
        fields: { name: { type: "string", required: true }, budget: { type: "number", format: "money" } },
        edges: { forHouse: edge },
        computed: { price: "forHouse.listPrice", room: "budget - forHouse.listPrice" },
      },
    },
    acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
    rules: {
      "within-budget": { title: "Within budget", over: "scenario", when: "budget != null", require: "forHouse.listPrice <= budget", says: "{name} costs more than its budget" },
    },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-14" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

const errors = (doc: unknown) => compileDocument(doc).findings.filter((f) => f.severity === "error");

const OWNER: LinkedViewer = { kind: "human", id: "u:nick", roles: ["owner"] };
const BUYER: LinkedViewer = { kind: "human", id: "u:ana", roles: ["buyer"] };
const GUEST: LinkedViewer = { kind: "human", id: "u:guest", roles: ["guest"] };

/** The house app, held by the host, and the scenarios app that links it. */
function twoApps() {
  const houseApp = compiled(houses());
  const houseStore = new Store<AnySchema>({
    schema: houseApp.schema,
    mutations: houseApp.mutations ?? [],
    ...(houseApp.policy ? { policy: houseApp.policy } : {}),
    snapshot: {
      nodes: [
        { id: "h1", kind: "house", street: "12 Elm Street", bedrooms: 3, listPrice: 450_000, notes: "Seller will take 430" },
        { id: "h2", kind: "house", street: "4 Oak Lane", bedrooms: 2, listPrice: 320_000 },
      ],
      edges: [],
    } as never,
  });
  const scenarioApp = compiled(scenarios());
  const scenarioStore = new Store<AnySchema>({
    schema: scenarioApp.schema,
    mutations: scenarioApp.mutations ?? [],
    invariants: scenarioApp.invariants ?? [],
    snapshot: { nodes: [{ id: "s1", kind: "scenario", name: "Buy it outright", budget: 400_000 }], edges: [] } as never,
  });
  const host = linkedRecordsOver({
    "@nick/house": {
      store: houseStore,
      name: "House",
      opens: (viewer) => (viewer.roles ?? []).some((role) => role === "owner" || role === "buyer"),
      href: (ref) => `/apps/nick/house/house/${ref.id}`,
    },
  });
  return { houseApp, houseStore, scenarioApp, scenarioStore, host };
}

/** The scenarios store, reading far records as one viewer, every answer it needs already in. */
async function readingAs(viewer: LinkedViewer) {
  const apps = twoApps();
  const reads = linkedReads(apps.host, viewer);
  readLinkedThrough(apps.scenarioStore.graph, reads.read);
  apps.scenarioStore.apply({ name: "edit-scenario", args: { id: "s1", forHouse: "house:h1" } });
  await reads.ask({ address: "@nick/house", kind: "house", id: "h1" });
  return { ...apps, reads };
}

describe("a relation may go to a kind in another app", () => {
  it("is named @<app address>/<kind> in a document, and reads as that app's address and kind", () => {
    expect(parseLinkedTarget("@nick/house/house")).toEqual({ address: "@nick/house", kind: "house" });
    expect(parseLinkedTarget("@app_kf5eydr9z58jzf/house")).toEqual({ address: "app_kf5eydr9z58jzf", kind: "house" });
    expect(parseLinkedTarget("@https://graview.cloud/a/house/open-house")).toEqual({ address: "https://graview.cloud/a/house", kind: "open-house" });
    for (const target of ["house", "@nick/house/House", "@/house", "@nick", "@javascript:alert(1)/x"]) expect(parseLinkedTarget(target), target).toBeUndefined();
    expect(DocumentSpec.safeParse(scenarios()).success).toBe(true);
    expect(errors(scenarios())).toEqual([]);
  });

  it("is kept on the record that links, as the far kind and its id, and set by the record's own edit", () => {
    const { scenarioApp, scenarioStore, houseStore } = twoApps();
    const definition = scenarioApp.schema.tryDefinition("scenario")!;
    expect(Object.keys(definition.edges ?? {})).not.toContain("forHouse");
    expect(linkedRelationOf((definition.fields.shape as Record<string, unknown>)["forHouse"])).toMatchObject({ address: "@nick/house", kinds: ["house"], cardinality: "one" });
    const houseLog = houseStore.log.length;
    const done = scenarioStore.apply({ name: "edit-scenario", args: { id: "s1", forHouse: "house:h1" } });
    expect(scenarioStore.graph.getNode("s1")).toMatchObject({ forHouse: "house:h1" });
    for (const forHouse of ["h1", "flat:h1", "house:", "javascript:alert(1)"]) {
      expect(refusalOf((() => { try { scenarioStore.apply({ name: "edit-scenario", args: { id: "s1", forHouse } }); } catch (error) { return error; } })())).toMatchObject({ reason: "invalid" });
    }
    scenarioStore.undo(done.batch!);
    expect(scenarioStore.graph.getNode("s1")?.["forHouse"]).toBeUndefined();
    // The far document is untouched: linking is the reading app's change alone.
    expect(houseStore.log.length).toBe(houseLog);
  });

  it("is judged by the checker, which says in a sentence what a relation to another app cannot be", () => {
    const said = (edge: Record<string, unknown>) => errors(scenarios(edge)).map((f) => `${f.code}: ${f.message}`);
    expect(said({ to: ["@nick/house/house", "scenario"] })).toEqual([expect.stringMatching(/^linked-mixed: scenario's forHouse goes to "scenario" here and to another app beside it/)]);
    expect(said({ to: ["@nick/house/house", "@ana/flat/flat"] })).toEqual([expect.stringMatching(/^linked-apps: scenario's forHouse goes to kinds in 2 apps \(@nick\/house, @ana\/flat\)/)]);
    expect(said({ to: ["@nick/house/house"], inverse: "scenarios" })).toEqual([expect.stringMatching(/^linked-inverse: .*whose declaration this one does not change/)]);
    const connecting = { ...scenarios(), acts: { "pick-house": { on: "scenario", connects: "forHouse" } } };
    expect(errors(connecting).map((f) => f.code)).toEqual(["act-linked"]);
    const walking = { ...scenarios(), rules: { walked: { over: "scenario", require: "count(out('forHouse')) > 0" } } };
    expect(errors(walking).map((f) => `${f.code}: ${f.message}`)).toEqual([expect.stringMatching(/^rule-linked: "forHouse" links a record in another app, which out\(\) and in\(\) cannot walk/)]);
  });

  it("is declared in TypeScript as a field the link is kept in, and read like the document's", () => {
    const scenario = defineNode("scenario", { fields: z.object({ name: z.string(), forHouse: linkedRecordField("@nick/house/house").optional() }) });
    const schema = createSchema([scenario]);
    expect(shapesOfSchema(schema).get("scenario")?.linked?.get("forHouse")).toMatchObject({ address: "@nick/house", kinds: ["house"], cardinality: "one" });
    expect(() => linkedRecordField("house")).toThrow(/a target is "@", the app's address/);
    expect(linkedRecordField("@nick/house/house").safeParse("house:h1").success).toBe(true);
    expect(linkedRecordField("@nick/house/house").safeParse("flat:h1").success).toBe(false);
  });
});

describe("a linked record on the faces", () => {
  it("is read by a record's facts as the far records it links, left out of a glance, and drawn by a card's field block", () => {
    const { scenarioApp } = twoApps();
    const definition = scenarioApp.schema.tryDefinition("scenario");
    const node = { id: "s1", kind: "scenario", name: "Buy it outright", forHouse: "house:h1" };
    const ref = { address: "@nick/house", kind: "house", id: "h1" };
    expect(readableFields(node, definition).find((f) => f.key === "forHouse")).toMatchObject({ linked: { relation: { address: "@nick/house" }, refs: [ref] }, value: "linked record" });
    expect(readableFields(node, definition, { glance: true }).map((f) => f.key)).toEqual(["name"]);
    const store = new Store<AnySchema>({ schema: scenarioApp.schema, snapshot: { nodes: [node], edges: [] } as never });
    const [, field] = resolveBlocks(compileBlocks([{ title: "{name}" }, { field: "forHouse" }]), blockContextFor(store, null, node));
    expect(field).toMatchObject({ t: "field", field: "forHouse", linked: { refs: [ref] } });
    expect(JSON.stringify(field)).not.toContain("house:h1");
    const viewing = { ...scenarios(), views: { scenario: { card: [{ title: "{name}" }, { field: "forHouse" }] } } };
    expect(errors(viewing)).toEqual([]);
  });

  it("is written back from TypeScript as the document's relation", () => {
    const scenario = defineNode("scenario", { fields: z.object({ name: z.string(), forHouse: linkedRecordField("@nick/house/house").optional() }) });
    const written = toDocument({ name: "Purchase scenarios", schema: createSchema([scenario]) } as never);
    expect(written.document?.kinds["scenario"]?.edges?.["forHouse"]).toEqual({ to: ["@nick/house/house"], cardinality: "one" });
    expect(written.document?.kinds["scenario"]?.fields).not.toHaveProperty("forHouse");
    expect(errors(written.document)).toEqual([]);
  });
});

describe("the host reads the far side as the viewer", () => {
  it("resolves a record with its card, its describe line and only the fields the viewer may see", async () => {
    const { host } = twoApps();
    const ref = { address: "@nick/house", kind: "house", id: "h1" };
    const owner = (await host.resolve(ref, OWNER)) as LinkedRecord;
    expect(owner).toMatchObject({ label: "12 Elm Street", describe: "3 bedrooms", href: "/apps/nick/house/house/h1", app: "House" });
    expect(owner.fields).toMatchObject({ listPrice: 450_000, notes: "Seller will take 430" });
    expect(owner.card?.map((line) => line.text)).toContain("450,000");
    const buyer = (await host.resolve(ref, BUYER)) as LinkedRecord;
    expect(buyer.fields["listPrice"]).toBe(450_000);
    expect(buyer.fields).not.toHaveProperty("notes");
    expect(JSON.stringify(buyer)).not.toContain("Seller will take");
    expect(await host.resolve(ref, GUEST)).toEqual({ denied: true });
    expect(await host.resolve({ ...ref, id: "nope" }, OWNER)).toBeNull();
    expect(await host.resolve({ ...ref, address: "@ana/flat" }, OWNER)).toBeNull();
  });

  it("lists and searches the records a link may pick, as the viewer, and refuses a viewer who may not open the app", async () => {
    const { host } = twoApps();
    const search = { address: "@nick/house", kinds: ["house"], query: "", limit: 10 };
    expect(((await host.find(search, OWNER)) as LinkedRecord[]).map((one) => one.label)).toEqual(["12 Elm Street", "4 Oak Lane"]);
    expect(((await host.find({ ...search, query: "oak" }, BUYER)) as LinkedRecord[]).map((one) => one.label)).toEqual(["4 Oak Lane"]);
    expect(await host.find(search, GUEST)).toEqual({ denied: true });
  });

  it("is asked once per record and viewer, and an expression reads it unread until the answer is in", async () => {
    const { host } = twoApps();
    let asked = 0;
    const counting = { ...host, resolve: (ref: Parameters<typeof host.resolve>[0], viewer: LinkedViewer) => (asked++, host.resolve(ref, viewer)) };
    const told: string[] = [];
    const reads = linkedReads(counting, OWNER, (ref) => told.push(ref.id));
    const ref = { address: "@nick/house", kind: "house", id: "h1" };
    expect(reads.read(ref)).toEqual({ unread: true });
    expect(reads.read(ref)).toEqual({ unread: true });
    await reads.ask(ref);
    expect(reads.read(ref)).toMatchObject({ record: { label: "12 Elm Street" } });
    expect(asked).toBe(1);
    expect(told).toEqual(["h1"]);
  });
});

describe("an expression walks the link, as the viewer", () => {
  it("works out a computed field through it — the far value for a viewer who may open it", async () => {
    const { scenarioApp, scenarioStore } = await readingAs(OWNER);
    const worked = computedValues(scenarioApp.schema, scenarioStore.graph as never, scenarioStore.graph.getNode("s1") as never);
    expect(worked.values).toMatchObject({ price: 450_000, room: -50_000 });
  });

  it("says, never throws, a link the viewer may not open or that is not read", async () => {
    const { scenarioApp, scenarioStore } = await readingAs(GUEST);
    const denied = computedValues(scenarioApp.schema, scenarioStore.graph as never, scenarioStore.graph.getNode("s1") as never);
    expect(denied.values).not.toHaveProperty("price");
    expect(denied.refused["price"]).toBe("the linked record in @nick/house is not one this viewer may open");
    // Before any answer is in — or with no host at all — it is said as not read.
    readLinkedThrough(scenarioStore.graph, undefined);
    expect(computedValues(scenarioApp.schema, scenarioStore.graph as never, scenarioStore.graph.getNode("s1") as never).refused["price"]).toBe("the linked record in @nick/house has not been read");
  });

  it("judges a rule through it: broken for the owner, and for a viewer who may not open it not judged, saying why", async () => {
    const owner = await readingAs(OWNER);
    expect(owner.scenarioStore.violations().filter((v) => v.invariant === "within-budget")).toEqual([expect.objectContaining({ message: "Buy it outright costs more than its budget" })]);
    const guest = await readingAs(GUEST);
    const judged = guest.scenarioStore.violations().filter((v) => v.invariant === "within-budget");
    expect(judged).toEqual([expect.objectContaining({ status: "could-not-judge", message: expect.stringContaining("the linked record in @nick/house is not one this viewer may open") })]);
    // A reader handed in the store's context is the one it is judged with.
    expect(guest.scenarioStore.violations({ linked: owner.reads.read }).filter((v) => v.invariant === "within-budget")[0]).toMatchObject({ message: "Buy it outright costs more than its budget" });
  });
});

describe("a far value's change is kept in the reading app's history", () => {
  it("as an op the reading store keeps, authored by the far app, naming what changed and none of its value", async () => {
    const { houseStore, scenarioStore, host } = await readingAs(OWNER);
    const ref = { address: "@nick/house", kind: "house", id: "h1" };
    const before = (await host.resolve(ref, OWNER)) as LinkedRecord;
    houseStore.applyPrimitives([{ op: "patch-node", id: "h1", before: { listPrice: 450_000 }, after: { listPrice: 430_000 } }]);
    const after = (await host.resolve(ref, OWNER)) as LinkedRecord;
    expect(linkedChange(before, after)).toEqual(["listPrice"]);
    const ops = recordLinkedChange(scenarioStore, { ref, fields: linkedChange(before, after), app: "House" });
    expect(ops).toHaveLength(1);
    const [op] = ops;
    expect(op).toMatchObject({ author: { kind: "system", id: "app:@nick/house", name: "House" }, via: "app:@nick/house", reads: ["s1"], writes: [], primitives: [], intent: "Buy it outright: the linked record changed in House — list price" });
    expect(JSON.stringify(op)).not.toMatch(/430|450/);
    expect(scenarioStore.log.all().at(-1)).toBe(op);
    // A far record no record links, or nothing changed, keeps nothing.
    expect(recordLinkedChange(scenarioStore, { ref: { ...ref, id: "h2" }, fields: ["listPrice"] })).toEqual([]);
    expect(recordLinkedChange(scenarioStore, { ref, fields: [] })).toEqual([]);
  });
});

describe("the agent's surface names the relation and how to link one", () => {
  it("in describe_app's words: where it goes, that it is read as the viewer, and the act that links one", () => {
    const { scenarioApp } = twoApps();
    const said = describeApp(scenarioApp);
    expect(said).toContain("## Linked from other apps");
    expect(said).toContain('forHouse → one house in the app @nick/house (another app, read as the viewer; link one by setting forHouse to "house:<id>" with edit-scenario');
  });

  it("in the derived edit's tool schema: a record of that app, as kind:id", () => {
    const { scenarioStore } = twoApps();
    const edit = scenarioStore.mutation("edit-scenario");
    const schema = mutationToolSchema(edit).inputSchema as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties["forHouse"]).toMatchObject({ "x-graview-linked": { address: "@nick/house", kinds: ["house"], cardinality: "one" } });
    expect(String(schema.properties["forHouse"]?.["description"])).toMatch(/a house in the app @nick\/house, as "house:<id>"/);
  });
});
