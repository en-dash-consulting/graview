import { readFileSync } from "node:fs";
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { EMAIL_DRAFT, nick, rae, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { runWorkerViewHeadless, type HeadlessResult } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * THE VIEWS GUIDE SAYS WHAT A VIEW IS HANDED (FR-151). It said each of
 * `props.nodes` had `fields`; a record's fields are on the record itself
 * (`node.draft`, `node.status`), and Graview Cloud's chat wrote a view to
 * the guide that drew nothing. The skill's worked example of a view of one
 * record is run here, headless, over Cloud's workshop in miniature, so the
 * guide cannot drift from what the host hands a view again.
 */
const skill = new URL("../../../skills/skills/graview-worker-view/", import.meta.url);
const guide = readFileSync(new URL("SKILL.md", skill), "utf8");
const example = readFileSync(new URL("examples/a-record.js", skill), "utf8");
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
/** The manifest the example opens with, read from its own comment. */
const manifest = Function(`return (${/manifest: (\{[\s\S]*?\n\/\/ \})/.exec(example)![1]!.replace(/^\/\/ ?/gm, "")});`)() as WorkerViewManifest;
const run = nodeIsolate();
const text = (result: HeadlessResult) => {
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result.description.text;
};

describe("the guide's worked example of a view of one record", () => {
  it("opens with a manifest of one record", () => {
    expect(manifest).toEqual({ name: "deliverable", attach: "deliverable", cardinality: "one", acts: ["set-draft"] });
  });

  it("draws its record's own fields, read off the record: the subject, the status, and every paragraph of the draft", async () => {
    const drawn = text(await runWorkerViewHeadless({ manifest, source: example, store: store(), principal: nick, run, input: { node: { id: "deliverable:email" } } }));
    expect(drawn).toContain("Email to Todd");
    expect(drawn).toContain("drafting");
    for (const paragraph of EMAIL_DRAFT.split("\n\n")) expect(drawn).toContain(paragraph.split("\n")[0]!.slice(0, 40));
    expect(drawn).toContain("Edit draft");
  });

  it("offers no edit to a seat that may not change the draft", async () => {
    const drawn = text(await runWorkerViewHeadless({ manifest, source: example, store: store(), principal: rae, run, input: { node: { id: "deliverable:email" } } }));
    expect(drawn).toContain("Email to Todd");
    expect(drawn).not.toContain("Edit draft");
  });
});

describe("the guide", () => {
  it("says a record's fields are on the record, and a view of one reads `props.node`", () => {
    expect(guide).not.toMatch(/`label` and fields\)|\bnode\.fields\b|\(id, kind, label, fields\)/);
    expect(guide).toMatch(/props\.node\.draft|node\.draft/);
    expect(guide).toContain("examples/a-record.js");
  });
  it("says how a field is filled from the record, and no longer says not to prefill", () => {
    expect(guide).toContain('data-prefill="draft"');
    expect(guide).not.toContain("Do not prefill");
  });
  it("says a view of one sits above the record's own fields unless it replaces the page", () => {
    expect(guide).toContain('replaces: "page"');
  });
});
