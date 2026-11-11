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

/** The clock this test runs on, and a zone whose clock is surely another one at the instant below. */
const HERE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const AT = "2026-11-26T14:30:00Z";
const wall = (zone: string) => new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(Date.parse(AT));
const ELSEWHERE = ["Asia/Tokyo", "America/Los_Angeles", "Europe/London"].find((zone) => wall(zone) !== wall(HERE))!;

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

  it("leads with the time as people say it, with no field label", () => {
    sayIn({ appTimeZone: HERE });
    const glance = readableFields(node, definition, { limit: 3, said: ["Dinner"], glance: true });
    expect(glance[0]!.key).toBe("at");
    expect(glance[0]!.alone).toBe(momentAtAGlance(AT));
    expect(glance[0]!.alone).not.toMatch(/^At\b|:\s/);
    expect(glance[0]!.alone).toMatch(/^Nov 26, 2026, \d{1,2}:30 [AP]M$/);
  });

  it("names the zone only when the reader is not in the app's zone", () => {
    sayIn({ appTimeZone: HERE });
    expect(readableFields(node, definition, { glance: true })[0]!.alone).not.toMatch(/[AP]M \S+$/);
    sayIn({ appTimeZone: ELSEWHERE });
    expect(readableFields(node, definition, { glance: true })[0]!.alone).toMatch(/[AP]M \S+$/);
    // A person's zone a host passes is the reader's own clock: said there, it is not named.
    sayIn({ appTimeZone: ELSEWHERE, readerTimeZone: HERE });
    expect(readableFields(node, definition, { glance: true })[0]!.alone).not.toMatch(/[AP]M \S+$/);
  });

  it("keeps the zone on the record's page, where the facts are read whole", () => {
    sayIn({ appTimeZone: HERE });
    expect(readableFields(node, definition).find((field) => field.key === "at")!.value).toMatch(/[AP]M \S+$/);
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
