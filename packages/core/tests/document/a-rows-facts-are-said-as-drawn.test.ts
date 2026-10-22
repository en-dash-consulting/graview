import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace, type DescribedPart } from "../../src/describe.js";
import { blockContextFor, compileBlocks, resolveBlocks } from "../../src/blocks.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A ROW'S FACTS ARE SAID AS THEY ARE DRAWN (Roadmap f-auto-view-type-polish).
 *
 * Threat Watch's row says `{severity} · {status} · {type} · disclosed
 * {disclosed}`: one string, so "high" read like the date beside it. A
 * card's or a row's line of facts with a choice field named bare in it now
 * carries its runs — each choice as it reads, to be drawn as a chip, and
 * the rest as words — and describe_place says the line as it is drawn: a
 * chip a space from what is beside it, two runs of words a dot apart. A
 * grouped list's heading is said with how many its group holds, as the
 * face draws it beside the label.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/threat-watch.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/threat-watch.seed.json", import.meta.url), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-21" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const nx = store.graph.getNode("t-nx")!;

const resolved = (blocks: readonly unknown[], slot: "row" | "card" | "page") => resolveBlocks(compileBlocks(blocks), blockContextFor(store, null, nx, { slot }));

describe("a row's line of facts", () => {
  it("carries each choice as a chip, said as it reads, and the rest as words, in the order written", () => {
    const [line] = resolved([{ text: "{severity} · {status} · {type} · disclosed {disclosed}" }], "row");
    expect(line).toMatchObject({ t: "text", text: "high · contained · supply-chain · disclosed May 18, 2026" });
    expect(line?.t === "text" ? line.runs : undefined).toEqual([
      { text: "High", field: "severity" },
      { text: "Contained", field: "status" },
      { text: "Supply chain", field: "type" },
      { text: "disclosed May 18, 2026" },
    ]);
  });

  it("stays one line where no choice is named bare in it, and on a record's page", () => {
    const [words] = resolved([{ text: "disclosed {disclosed} · {name}" }], "row");
    expect(words?.t === "text" && words.runs).toBeFalsy();
    const [page] = resolved([{ text: "{severity} · {status}" }], "page");
    expect(page?.t === "text" && page.runs).toBeFalsy();
    // A choice inside other words is a word, not a chip.
    const [inside] = resolved([{ text: "{severity} risk · {status}" }], "row");
    expect(inside?.t === "text" ? inside.runs : undefined).toEqual([{ text: "high risk" }, { text: "Contained", field: "status" }]);
  });
});

describe("a grouped place, described", () => {
  const result = describePlace(store, owner, "by-type", { app, width: 1280, today: "2026-10-21" });
  if (!result.ok) throw new Error(result.error);
  const list = result.description.parts.find((part): part is Extract<DescribedPart, { t: "list" }> => part.t === "list")!;

  it("says each group's heading with how many it holds", () => {
    expect(list.groups.map((group) => [group.heading, group.count])).toEqual([
      ["Supply-chain compromises", 6],
      ["Self-spreading worms", 3],
      ["Ransomware", 2],
      ["Zero-days", 3],
    ]);
    expect(result.description.text).toContain("Supply-chain compromises (6):");
  });

  it("says a row's facts as the row draws them", () => {
    const row = list.groups[0]!.items.find((item) => item.id === "t-nx")!;
    expect(row.parts).toContainEqual({ t: "text", text: "High Contained Supply chain disclosed May 18, 2026" });
  });
});
