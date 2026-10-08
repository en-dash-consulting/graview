import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineApp, defineNode, fragmentOf, isLongText, pageSections, readableFields } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A RECORD READS IN THE ORDER ITS KIND DECLARES (FR-148), AND KNOWS ITS
 * PROSE FROM ITS FACTS (FR-147).
 *
 * `readableFields` walked the record's own keys, so a record written in
 * one order and added to later read in the order of its writes. A
 * TypeScript declaration says the page's order with `display.page`, and
 * `graview check` names a field it does not have.
 */
const deliverable = defineNode("deliverable", {
  fields: z.object({
    due: z.string().optional(),
    name: z.string(),
    status: z.enum(["drafting", "sent"]),
    summary: z.string().optional(),
    subject: z.string().optional(),
    draft: z.string().max(20_000).optional(),
  }),
  display: { labels: { subject: "Subject line" } },
});
const written = { id: "email", kind: "deliverable", status: "drafting", summary: "The follow-up", due: "2026-10-28", draft: "Hi Todd,\n\nThank you.", subject: "What we agreed", name: "Email to Todd" };

describe("a record's facts", () => {
  it("read in declared order, whatever order the record was written in", () => {
    expect(readableFields(written, deliverable as never).map((field) => field.label)).toEqual(["Due", "Name", "Status", "Summary", "Subject line", "Draft"]);
  });

  it("keep a value's line breaks, and say which are prose", () => {
    const fields = readableFields(written, deliverable as never);
    expect(fields.find((field) => field.key === "draft")).toMatchObject({ value: "Hi Todd,\n\nThank you.", long: true });
    expect(fields.filter((field) => field.long).map((field) => field.key)).toEqual(["draft"]);
  });

  it("prose is a field declared to hold more than 500 characters, or a value with a line break or past 160 characters", () => {
    expect(isLongText(deliverable as never, "draft", "")).toBe(true);
    expect(isLongText(deliverable as never, "summary", "Short.")).toBe(false);
    expect(isLongText(deliverable as never, "summary", "One line\nand another")).toBe(true);
    expect(isLongText(deliverable as never, "summary", "x".repeat(161))).toBe(true);
    expect(isLongText(deliverable as never, "summary", "x".repeat(160))).toBe(false);
  });

  it("a hit in Find quotes prose as one line, its line breaks read as spaces", () => {
    const draft = "Hi Todd,\n\nThank you for two good days.\n\n1. Price the pilot by the acre.\n2. Start with three townships that share a drainage district.";
    const fragment = fragmentOf(draft, ["townships"]);
    expect(fragment).not.toMatch(/\n/);
    expect(fragment).toMatch(/three townships/);
    expect(fragmentOf("One\ntwo", ["two"])).toBe("One two");
  });

  it("follow display.page, and the checker names a field it does not declare", () => {
    const paged = defineNode("deliverable", { fields: deliverable.fields, display: { page: { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] } } });
    const sections = pageSections(paged as never, readableFields(written, paged as never));
    expect(sections.map((section) => [section.title ?? null, section.fields.map((field) => field.key)])).toEqual([
      [null, ["subject", "draft"]],
      ["Schedule", ["due"]],
      ["Details", ["name", "status", "summary"]],
    ]);
    const wrong = defineApp({ name: "Workshop", schema: createSchema([defineNode("deliverable", { fields: deliverable.fields, display: { page: { fields: ["body", "draft"], groups: [{ title: "Again", fields: ["draft"] }] } } })]) });
    const codes = checkApp(wrong).findings.map((finding) => finding.code);
    expect(codes).toContain("page-unknown-field");
    expect(codes).toContain("page-field-twice");
  });

  it("hold display.page to a document's limits, and read only a record's own fields", () => {
    const groups = Array.from({ length: 13 }, (_, index) => ({ title: `Group ${index}`, fields: ["due"] }));
    const tooMany = defineApp({ name: "Workshop", schema: createSchema([defineNode("deliverable", { fields: deliverable.fields, display: { page: { groups } } })]) });
    expect(checkApp(tooMany).findings.map((finding) => finding.code)).toContain("page-too-large");
    const longTitle = defineApp({ name: "Workshop", schema: createSchema([defineNode("deliverable", { fields: deliverable.fields, display: { page: { groups: [{ title: "x".repeat(61), fields: ["due"] }] } } })]) });
    expect(checkApp(longTitle).findings.map((finding) => finding.code)).toContain("page-too-large");
    const inherited = defineApp({ name: "Workshop", schema: createSchema([defineNode("deliverable", { fields: deliverable.fields, display: { page: { fields: ["constructor", "toString"] } } })]) });
    expect(checkApp(inherited).findings.map((finding) => finding.code)).toContain("page-unknown-field");
    const paged = defineNode("deliverable", { fields: deliverable.fields, display: { page: { fields: ["constructor", "name"] } } });
    expect(readableFields(written, paged as never).map((field) => field.key)).not.toContain("constructor");
  });
});
