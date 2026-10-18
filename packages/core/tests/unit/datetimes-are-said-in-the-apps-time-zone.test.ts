import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp } from "../../src/cli/check.js";
import { compileDocument, describeApp } from "../../src/check.js";
import { diffDocuments, editDocument } from "../../src/document/index.js";
import { parseTemplate } from "../../src/document/template-parse.js";
import { renderTemplate } from "../../src/document/template.js";
import { createSchema, defineApp, defineNode, momentAsRead, sayIn, sayingIn, SCHEMES, Store, timeAsRead, timeZoneFor, timeZoneProblem } from "../../src/index.js";
import { digestWords } from "../../src/tidying.js";
import { readableFields, storedOfWall, wallOfStored, zoneSaid } from "../../src/words.js";

/**
 * DATETIMES ARE SAID IN THE APP'S TIME ZONE (Roadmap f-app-time-zone). A
 * bug report: `{at | time}` was refused, since describe had no formatter for
 * a time of day; an act given `2026-10-16T10:47:00-04:00` echoed "2:47 PM",
 * the server's UTC clock; and a view hard-coded America/New_York to say it
 * right. An app now declares its zone once (`brand.timeZone`), a person's
 * zone a host passes wins over it, and every surface that says a moment —
 * a template, a record's facts, an act's sentence, Activity, the date
 * editor — says it there.
 */
afterEach(() => sayIn({}));

const NY = "America/New_York";
const GIVEN = "2026-10-16T10:47:00-04:00";
const kinds = new Map([["visit", { fields: new Set(["at", "name"]), edges: new Map() }]]) as never;
const node = { id: "v1", kind: "visit", name: "Checkup", at: GIVEN } as never;

describe("describe's time and datetime formatters", () => {
  it("are formatters a template may name", () => {
    expect(() => parseTemplate("{at | time}")).not.toThrow();
    expect(() => parseTemplate("{at | datetime}")).not.toThrow();
  });

  it("say a moment given with an offset in the app's zone, not UTC", () => {
    const parts = parseTemplate("{name} at {at | time} · {at | datetime}");
    expect(renderTemplate(parts, { node, kinds, money: { timeZone: NY } })).toBe("Checkup at 10:47 AM · Oct 16, 2026, 10:47 AM EDT");
    expect(renderTemplate(parts, { node, kinds, money: { timeZone: "UTC" } })).toBe("Checkup at 2:47 PM · Oct 16, 2026, 2:47 PM UTC");
  });

  it("say the day of an instant as it is in the app's zone", () => {
    const late = { ...(node as object), at: "2026-10-16T22:00:00-04:00" } as never;
    expect(renderTemplate(parseTemplate("{at | date}"), { node: late, kinds, money: { timeZone: NY } })).toBe("Oct 16, 2026");
    expect(renderTemplate(parseTemplate("{at | date}"), { node: late, kinds, money: { timeZone: "Asia/Tokyo" } })).toBe("Oct 17, 2026");
  });

  it("say a wall time written without a zone as it was written, whatever the zone", () => {
    const wall = { ...(node as object), at: "2026-10-16T10:47" } as never;
    expect(renderTemplate(parseTemplate("{at | time}"), { node: wall, kinds, money: { timeZone: "Asia/Tokyo" } })).toBe("10:47 AM");
  });
});

describe("the page's zone", () => {
  it("is the app's when it declares one, and a person's a host passes wins over it", () => {
    sayIn({ appTimeZone: NY });
    expect(timeAsRead(GIVEN)).toBe("10:47 AM");
    expect(momentAsRead("2026-10-16T14:47:00Z")).toBe("Oct 16, 2026, 10:47 AM EDT");
    expect(timeZoneFor()).toBe(NY);
    sayIn({ appTimeZone: NY, readerTimeZone: "Europe/London" });
    expect(timeAsRead(GIVEN)).toBe("3:47 PM");
    expect(timeZoneFor()).toBe("Europe/London");
  });

  it("is the runtime's clock when nobody says, and a zone the runtime does not know is never thrown", () => {
    sayIn({ appTimeZone: "Mars/Olympus_Mons" });
    expect(timeZoneFor()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(() => timeAsRead(GIVEN)).not.toThrow();
  });

  it("is lent for a while by sayingIn, and given back after", () => {
    sayIn({ appTimeZone: "Asia/Tokyo" });
    expect(sayingIn({ appTimeZone: NY }, () => timeAsRead(GIVEN))).toBe("10:47 AM");
    expect(timeAsRead(GIVEN)).toBe("11:47 PM");
  });
});

describe("an act's sentence, a record's facts and Activity", () => {
  const visit = defineNode("visit", { fields: z.object({ name: z.string(), at: z.string().optional() }), plural: "Visits" });
  const schema = createSchema([visit]);

  it("an act's echo says the time in the app's zone", () => {
    const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "v1", kind: "visit", name: "Checkup" }] as never, edges: [] } });
    const intent = sayingIn({ appTimeZone: NY }, () => store.apply({ name: "edit-visit", args: { id: "v1", at: GIVEN } }).intent);
    expect(intent).toMatch(/^Changed the at of .+ to Oct 16, 2026, 10:47 AM EDT$/);
  });

  it("a record's facts say the time in the zone they are handed", () => {
    const facts = readableFields({ id: "v1", kind: "visit", name: "Checkup", at: GIVEN } as never, visit as never, { timeZone: "Asia/Tokyo" });
    expect(facts.find((fact) => fact.key === "at")?.value).toBe("Oct 16, 2026, 11:47 PM GMT+9");
  });

  it("Activity's digest says the day it fell on in the app's zone", () => {
    expect(sayingIn({ appTimeZone: NY }, () => digestWords({ things: 2, at: "2026-10-13T01:00:00.000Z" }, "2026-10-16"))).toBe("Tidied 2 things on Oct 12");
  });
});

describe("the date editor", () => {
  it("reads and keeps an instant on the app's clock", () => {
    sayIn({ appTimeZone: NY });
    expect(wallOfStored("2026-10-16T14:47:00Z")).toEqual({ day: "2026-10-16", minutes: 10 * 60 + 47 });
    expect(storedOfWall({ day: "2026-10-16", minutes: 10 * 60 + 47 }, { time: true, instant: true })).toBe("2026-10-16T14:47:00Z");
    expect(zoneSaid("en-US", new Date("2026-10-16T14:47:00Z"))).toEqual({ zone: NY, short: "EDT" });
    sayIn({ appTimeZone: "Asia/Tokyo" });
    expect(wallOfStored("2026-10-16T14:47:00Z")).toEqual({ day: "2026-10-16", minutes: 23 * 60 + 47 });
    expect(storedOfWall({ day: "2026-10-17", minutes: 9 * 60 }, { time: true, instant: true })).toBe("2026-10-17T00:00:00Z");
  });
});

describe("declared once and checked", () => {
  const thing = defineNode("thing", { fields: z.object({ name: z.string() }) });
  const app = defineApp({ name: "Things", schema: createSchema([thing]) });

  it("a TypeScript app's brand.timeZone is checked: an unknown zone is refused by name", () => {
    expect(timeZoneProblem(NY)).toBeUndefined();
    expect(timeZoneProblem("Mars/Olympus_Mons")).toMatch(/"Mars\/Olympus_Mons" is not a time zone/);
    expect(timeZoneProblem("+05:00")).toBeDefined();
    const bad = checkApp(defineApp({ ...app, brand: { name: "Things", schemes: SCHEMES, timeZone: "Mars/Olympus_Mons" } })).findings.filter((f) => f.code === "brand-time-zone");
    expect(bad.map((f) => [f.where, f.severity])).toEqual([["brand.timeZone", "error"]]);
    expect(bad[0]!.message).toContain('"Mars/Olympus_Mons"');
    expect(checkApp(defineApp({ ...app, brand: { name: "Things", schemes: SCHEMES, timeZone: NY } })).findings.filter((f) => f.code === "brand-time-zone")).toEqual([]);
  });

  it("describeApp says the zone its times are said in", () => {
    expect(describeApp(defineApp({ ...app, brand: { name: "Things", schemes: SCHEMES, timeZone: NY } }))).toContain("Times are said in America/New_York");
  });

  const lifelogics = JSON.parse(readFileSync(new URL("../document/fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));

  it("a document's brand.timeZone compiles, reaches its templates, and an unknown one is refused by name", () => {
    const good = compileDocument({ ...structuredClone(lifelogics), brand: { timeZone: NY } });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.app.brand?.timeZone).toBe(NY);
    const bad = compileDocument({ ...structuredClone(lifelogics), brand: { timeZone: "Mars/Olympus_Mons" } });
    expect(bad.findings.filter((f) => f.severity === "error" && f.path === "brand.timeZone").map((f) => f.message)).toEqual([expect.stringContaining('"Mars/Olympus_Mons" is not a time zone')]);
  });

  it("set-brand sets the zone, says so, refuses an unknown one, and a diff says it in words", () => {
    const zoned = editDocument(structuredClone(lifelogics), [{ op: "set-brand", timeZone: NY }]);
    if (!zoned.ok) throw new Error(JSON.stringify(zoned.findings));
    expect(zoned.document.brand?.timeZone).toBe(NY);
    expect(zoned.said).toEqual(["Times are said in America/New_York."]);
    expect(diffDocuments(lifelogics, zoned.document).sentences).toEqual(["Times are said in America/New_York."]);
    const refused = editDocument(structuredClone(lifelogics), [{ op: "set-brand", timeZone: "Mars/Olympus_Mons" }]);
    expect(refused.ok).toBe(false);
    const cleared = editDocument(zoned.document, [{ op: "set-brand", timeZone: null }]);
    if (!cleared.ok) throw new Error(JSON.stringify(cleared.findings));
    expect(cleared.said).toEqual(["Times are said on each reader's own clock."]);
  });
});
