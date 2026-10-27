import { createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { blocksOf, type LinkBlock } from "../../src/tidy/blocking.js";
import type { JudgeContext } from "../../src/tidy/judges.js";

/*
 * A LINK IS OFFERED ON EVIDENCE, NOT ONE COMMON WORD (FR-224, Roadmap
 * f-tidying-link-evidence-not-one-word). A link was put forward because one
 * four-letter word of the far record's name turned up in the near record's
 * text — `its text says “just”`, `“blueprint”` — and a model then judged
 * the pair at 0.55 to 0.76, filling the tray with links nobody would make,
 * each one paid for. A word of a far record's name counts only when it is
 * telling: not a stop word or a common one, and held by few of the kind's
 * names; a far record named in three or more words is never put forward on
 * one word alone — two of its telling words, its whole name or one of its
 * key values; and a goal named "Why am I doing this, and for whom?" beside
 * a note that says "You can just do things." is no candidate at all.
 */
const goal = defineNode("goal", { fields: z.object({ label: z.string(), code: z.string().optional() }) });
const note = defineNode("note", { fields: z.object({ label: z.string(), text: z.string().optional() }), edges: { about: { to: ["goal"] } } });
const schema = createSchema([goal, note]);
const NOW = "2026-10-27T09:00:00.000Z";

type Record = { readonly id: string; readonly kind: string } & { readonly [field: string]: unknown };

/** The links the actor would ask a model about, for each note, over these records. */
async function offered(nodes: readonly Record[]): Promise<{ readonly note: string; readonly to: string; readonly evidence: string }[]> {
  const store = new Store<AnySchema>({ schema: schema as unknown as AnySchema, now: () => NOW, snapshot: { nodes, edges: [] } as never });
  const context: JudgeContext = { store, now: new Date(NOW).getTime(), touched: new Map(), quietFor: 0, olderThanDays: 30 };
  const blocks = await blocksOf(context, { families: new Set(["links", "missing-links"]) });
  return blocks.records.flatMap((record) => record.links.flatMap((link: LinkBlock) => link.targets.map((target) => ({ note: record.node.id, to: target.node.id, evidence: target.evidence }))));
}

const goals = (...labels: string[]): Record[] => labels.map((label, at) => ({ id: `goal:${at + 1}`, kind: "goal", label }));
const noteSaying = (text: string, label = "A note"): Record => ({ id: "note:1", kind: "note", label, text });

describe("what the app's own actor puts forward as a link", () => {
  it("is nothing for a goal named in a sentence and a note that shares a common word with it", async () => {
    expect(await offered([...goals("Why am I doing this, and for whom?"), noteSaying("You can just do things.")])).toEqual([]);
  });

  it("is nothing on one common word of a far name of three or more words", async () => {
    expect(await offered([...goals("Just ship it, today"), noteSaying("You can just do things.")])).toEqual([]);
    expect(await offered([...goals("The blueprint for next year"), noteSaying("Found the blueprint in the attic.")])).toEqual([]);
  });

  it("is the far record whose telling word the note says, when its name is short", async () => {
    expect(await offered([...goals("Harbor Catering"), noteSaying("Call harbor about the menu")])).toEqual([{ note: "note:1", to: "goal:1", evidence: "its text says “harbor”" }]);
  });

  it("is the far record two of whose telling words the note says, when its name is long", async () => {
    expect(await offered([...goals("Acme Harbor Catering Ltd"), noteSaying("Harbor catering is booked for the offsite")])).toEqual([{ note: "note:1", to: "goal:1", evidence: "its text says “harbor” and “catering”" }]);
    expect(await offered([...goals("Acme Harbor Catering Ltd"), noteSaying("The harbor is cold in March")])).toEqual([]);
  });

  it("is the far record whose whole name the note says, however common its words", async () => {
    expect(await offered([...goals("Why am I doing this, and for whom?"), noteSaying("Reread “Why am I doing this, and for whom?” before planning.")])).toEqual([
      { note: "note:1", to: "goal:1", evidence: "its text says “Why am I doing this, and for whom?”" },
    ]);
  });

  it("is the far record whose key value the note says", async () => {
    const coded = goals("Just ship it, today").map((one) => ({ ...one, code: "GL-7731" }));
    expect(await offered([...coded, noteSaying("See GL-7731 before Friday")])).toEqual([{ note: "note:1", to: "goal:1", evidence: "its text says “gl 7731”" }]);
  });

  it("counts no word that most of the kind's names hold", async () => {
    expect(await offered([...goals("Weekly review", "Weekly budget", "Weekly standup", "Weekly plan", "Weekly reading"), noteSaying("Move the weekly to Tuesday")])).toEqual([]);
    expect(await offered([...goals("Weekly review", "Weekly budget", "Weekly standup", "Weekly plan", "Weekly reading"), noteSaying("Move the standup to Tuesday")])).toEqual([
      { note: "note:1", to: "goal:3", evidence: "its text says “standup”" },
    ]);
  });
});
