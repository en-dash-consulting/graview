import { afterEach, describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { accentProblem, momentAtAGlance, sayIn, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { readableFields } from "../../src/words.js";

/**
 * A BARE APP LOOKS DESIGNED BY DEFAULT (Roadmap f-better-bare-app-defaults).
 * From Graview Cloud, building Thanksgiving from a chat: a schedule item's
 * row read "At: Nov 26, 2026, 9:30 AM EST" until a row of its own said
 * `{at|time}`; the masthead said the app's description under a headline
 * that already said it; and pumpkin #b4532a was refused as an accent for
 * sharing the warning's hue. The defaults now read as a design would.
 */
afterEach(() => sayIn({}));

/** The clock this test runs on: in Node, nobody's. */
const HERE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const AT = "2026-11-26T14:30:00Z";

const thanksgiving: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  description: "Who brings what, and when we eat.",
  kinds: {
    moment: { noun: "schedule item", plural: "schedule", fields: { name: { type: "string", required: true }, who: { type: "string" }, at: { type: "datetime", required: true } } },
  },
  acts: { "add-moment": { title: "Add to the schedule", creates: "moment" } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
} as GraviewDocument;

const compiled = (document: GraviewDocument) => {
  const out = compileDocument(document, { today: () => "2026-11-11" });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.app as GraviewApp<AnySchema>;
};

describe("a derived row whose kind's date is a datetime", () => {
  const app = compiled(thanksgiving);
  const definition = app.schema.tryDefinition("moment");
  const node = { id: "m1", kind: "moment", name: "Dinner", who: "Diana", at: AT };
  const NY = "America/New_York";
  const glance = (one: Record<string, unknown> = node) => readableFields(one, definition, { limit: 3, said: ["Dinner"], glance: true });

  it("leads with the time as people say it, with no field label", () => {
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    expect(glance()[0]!.key).toBe("at");
    expect(glance()[0]!.alone).toBe(momentAtAGlance(AT));
    expect(glance()[0]!.alone).toBe("Nov 26, 2026, 9:30 AM");
  });

  it("names the zone only when the reader is not in the app's zone", () => {
    // A reader on the app's clock, by its own name or another zone's that keeps the same time.
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    expect(glance()[0]!.alone).toBe("Nov 26, 2026, 9:30 AM");
    sayIn({ appTimeZone: "America/Detroit", readerTimeZone: NY });
    expect(glance()[0]!.alone).toBe("Nov 26, 2026, 9:30 AM");
    // A reader elsewhere is said the instant on the app's clock, with the zone that clock is.
    sayIn({ appTimeZone: "Asia/Tokyo" });
    expect(glance()[0]!.alone).toBe("Nov 26, 2026, 11:30 PM GMT+9");
  });

  it("names the zone where there is no reader's clock to judge by — a server, a static page, a model", () => {
    // These tests run in Node, with no page: the runtime's clock is nobody's.
    sayIn({ appTimeZone: HERE });
    expect(glance()[0]!.alone).toMatch(/[AP]M \S+$/);
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    expect(readableFields(node, definition, { glance: true, noReader: true })[0]!.alone).toBe("Nov 26, 2026, 9:30 AM EST");
  });

  it("names the zone at the hour a clock says twice, when summer time ends", () => {
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    expect(glance({ ...node, at: "2026-11-01T05:30:00Z" })[0]!.alone).toBe("Nov 1, 2026, 1:30 AM EDT");
    expect(glance({ ...node, at: "2026-11-01T06:30:00Z" })[0]!.alone).toBe("Nov 1, 2026, 1:30 AM EST");
    expect(glance({ ...node, at: "2026-11-01T08:30:00Z" })[0]!.alone).toBe("Nov 1, 2026, 3:30 AM");
  });

  it("keeps the zone on the record's page, where the facts are read whole", () => {
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    expect(readableFields(node, definition).find((field) => field.key === "at")!.value).toBe("Nov 26, 2026, 9:30 AM EST");
  });

  it("leads with the kind's date as composeDesign picks it: a day as well as a moment, its when role first, never a bookkeeping one", () => {
    sayIn({ appTimeZone: NY, readerTimeZone: NY });
    const kinds = (fields: Record<string, unknown>, fieldRoles?: Record<string, string>) =>
      compiled({ ...thanksgiving, kinds: { task: { fields: { name: { type: "string", required: true }, ...fields }, ...(fieldRoles ? { fieldRoles } : {}) } }, acts: { "add-task": { title: "Add a task", creates: "task" } } } as unknown as GraviewDocument).schema.tryDefinition("task");
    const keys = (definition: ReturnType<typeof kinds>, one: Record<string, unknown>) => readableFields({ id: "t", kind: "task", name: "Book van", ...one }, definition, { limit: 3, said: ["Book van"], glance: true }).map((field) => field.key);
    const bookkeeping = kinds({ status: { type: "enum", options: ["open", "done"] }, priority: { type: "enum", options: ["low", "high"] }, due: { type: "date" }, updatedAt: { type: "datetime" } });
    expect(keys(bookkeeping, { status: "open", priority: "high", due: "2026-11-20", updatedAt: "2026-11-10T08:00:00Z" })).toEqual(["due", "status", "priority"]);
    const dayFirst = kinds({ due: { type: "date" }, remindAt: { type: "datetime" } });
    expect(keys(dayFirst, { due: "2026-11-20", remindAt: "2026-11-19T08:00:00Z" })).toEqual(["due", "remindAt"]);
    // A date a person sets is the kind's date, whatever it is called: only what a store writes as it keeps a record is bookkeeping.
    const serviced = kinds({ lastService: { type: "date" }, createdAt: { type: "datetime" } });
    expect(keys(serviced, { lastService: "2026-10-01", createdAt: "2026-11-10T08:00:00Z" })[0]).toBe("lastService");
    for (const name of ["lastVisit", "lastDay", "seen", "archivedOn"]) expect(keys(kinds({ [name]: { type: "date" } }), { [name]: "2026-10-01" })).toEqual([name]);
    for (const name of ["createdAt", "updatedOn", "modified", "lastModified"]) expect(keys(kinds({ [name]: { type: "date" }, due: { type: "date" } }), { [name]: "2026-10-01", due: "2026-12-01" })[0]).toBe("due");
    const roled = kinds({ due: { type: "date" }, remindAt: { type: "datetime" } }, { when: "remindAt" });
    expect(keys(roled, { due: "2026-11-20", remindAt: "2026-11-19T08:00:00Z" })).toEqual(["remindAt", "due"]);
  });
});

describe("the masthead says the app's description once", () => {
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  const home = (document: GraviewDocument) => {
    const app = compiled(document);
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: { nodes: [{ id: "m1", kind: "moment", name: "Dinner", at: AT }], edges: [] } as never });
    const described = describePlace(store, owner, "home", { app: app as never });
    if (!described.ok) throw new Error(described.error);
    return described.description;
  };

  it("under a home whose headline says something else", () => {
    const said = home({ ...thanksgiving, views: { home: [{ headline: "Thursday at Diana's" }, { list: "all('moment')", as: "row" }] } } as GraviewDocument);
    expect(said.masthead?.subtitle).toBe("Who brings what, and when we eat.");
  });

  it("and not again where the home's own headline or line already says it", () => {
    const headed = home({ ...thanksgiving, views: { home: [{ headline: "Who brings what, and when we eat." }, { list: "all('moment')", as: "row" }] } } as GraviewDocument);
    expect(headed.masthead?.subtitle).toBeUndefined();
    const lined = home({ ...thanksgiving, views: { home: [{ headline: "Thursday" }, { text: "who brings what and when we eat" }] } } as GraviewDocument);
    expect(lined.masthead?.subtitle).toBeUndefined();
  });

  it("and still says it where the home's words that say it stand inside a `when`, which may not hold for the seat", () => {
    const hidden = home({ ...thanksgiving, views: { home: [{ headline: "Thursday" }, { when: "count(all('moment')) > 5", show: [{ title: "Who brings what, and when we eat" }] }] } } as GraviewDocument);
    expect(hidden.masthead?.subtitle).toBe("Who brings what, and when we eat.");
    expect(hidden.text).toContain("Who brings what, and when we eat.");
  });

  it("but only for the whole description, on its words' bounds: a sentence that shares some of them is not it", () => {
    const near = home({ ...thanksgiving, views: { home: [{ headline: "Who brings what, and when we eaten" }, { text: "Who brings what" }] } } as GraviewDocument);
    expect(near.masthead?.subtitle).toBe("Who brings what, and when we eat.");
  });
});

describe("an accent near the warning hue", () => {
  it("is taken when its contrast holds: pumpkin compiles with nothing said about its colors", () => {
    expect(accentProblem("#b4532a")).toBeNull();
    const taken = editDocument(thanksgiving, [{ op: "set-brand", accent: "#b4532a" }]);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const out = compileDocument(taken.document);
    expect(out.ok).toBe(true);
    expect(out.findings.filter((finding) => finding.path.startsWith("brand"))).toEqual([]);
    expect((out.ok ? out.app.brand : undefined)?.schemes?.light.accent).toBe("rgba(180, 83, 42, 1)");
  });

  it("is still refused for its contrast, with a shade that would pass", () => {
    expect(accentProblem("#ff9a5c")?.sentence).toMatch(/is \d\.\d:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
  });
});
