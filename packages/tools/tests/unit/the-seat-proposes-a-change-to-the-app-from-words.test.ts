import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { composeReshape, traitsOf } from "@graview/core/compose";
import { editDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import type { Answer, Decide } from "../../src/fast.js";
import { llmResponder, mayChangeDeclaration, type HostTurn } from "../../src/index.js";
import { PROPOSE_CHANGE, proposeReshape, readReshape, reshapeCard, reshapeQuestions } from "../../src/reshape.js";

/**
 * ASK AI IN AN APP PROPOSES A CHANGE TO THE APP ITSELF (Roadmap
 * f-seat-reshape). "We also need who's driving" used to have no path inside
 * the app: the seat's tools read, and the menu's suggestions cover records.
 * Now the words go to the host's `decide` as the starter's questions — a
 * Noul per trait the app lacks, a Noul per part it has — code reads the
 * answers with thresholds and says the card (added, kept, dropped,
 * breaking), and on Accept the host composes every edit from that reading
 * (`composeReshape`, `@graview/core/compose`): the composer never rides on
 * a page. The model here is a stub that reads "who" as people who own
 * things and nothing else, as the starter's tests stub Jev, so every claim
 * is about the questions, the reading, the card, the composing and the seat
 * — not a model's taste.
 */
const CATALOG = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/cloud-catalog.json", import.meta.url), "utf8")) as { id: string; document: GraviewDocument }[];
const template = (id: string): GraviewDocument => CATALOG.find((one) => one.id === id)!.document;
const SAID = "we also need who's driving";

/** A stub System One: people who own things are needed, and nothing else is needed or dropped. */
const whoIsDriving: Decide = async (_state, questions) => {
  const answers: Record<string, Answer> = {};
  for (const key of Object.keys(questions)) answers[key] = { type: "noul", noul: key === "need:owners" ? 0.92 : 0.08 };
  return { answers, usage: { inputTokens: 12, outputTokens: 3 } };
};
/** A stub that finds nothing in the words. */
const nothing: Decide = async (_state, questions) => ({ answers: Object.fromEntries(Object.keys(questions).map((key) => [key, { type: "noul", noul: 0.05 } as Answer])), usage: { inputTokens: 0, outputTokens: 0 } });

/** Errors and warnings alike: a change the seat proposes compiles with neither. */
const problems = (document: GraviewDocument) =>
  compileDocument(document)
    .findings.filter((finding) => finding.severity === "error" || finding.severity === "warning")
    .map((finding) => `${finding.severity} ${finding.code} ${finding.path}: ${finding.message}`);

describe("the questions", () => {
  it("ask whether what they said needs each trait the app lacks, and whether they asked to drop each kind and each trait it has", () => {
    const shortlist = template("vendor-shortlist");
    const { state, questions } = reshapeQuestions(SAID, shortlist);
    expect(state["said"]).toBe(SAID);
    expect(state["app"]).toMatchObject({ name: shortlist.name, keeps: ["categories", "vendors"] });
    expect((state["app"] as { lacks: string[] }).lacks).toContain("people who own things");
    expect(questions["need:owners"]).toMatchObject({ type: "noul" });
    // What it has is not asked for again: a status that moves is the shortlist's own.
    expect(questions["need:status"]).toBeUndefined();
    expect(questions["drop:trait:status"]).toMatchObject({ type: "noul" });
    expect(questions["drop:kind:category"]).toMatchObject({ type: "noul" });
    expect(questions["drop:kind:vendor"]).toMatchObject({ type: "noul" });
    expect(questions["need:owners"]!.instructions).toContain("people who own things");
  });

  it("are read with thresholds, every raw answer kept, and a key no question asks is refused", () => {
    const reading = readReshape({ "need:owners": { type: "noul", noul: 0.92 }, "need:budget": { type: "noul", noul: 0.4 }, "drop:kind:category": { type: "noul", noul: 0.75 }, "drop:trait:status": { type: "noul", noul: 0.2 } });
    expect(reading.add).toEqual(["owners"]);
    expect(reading.drop).toEqual(["category"]);
    expect(reading.needs).toEqual({ owners: 0.92, budget: 0.4 });
    expect(reading.drops).toEqual({ "kind:category": 0.75, "trait:status": 0.2 });
    // A host that keeps the answers reads them again under other thresholds without asking the model again.
    expect(readReshape({ "need:budget": { type: "noul", noul: 0.4 } }, { add: 0.3 }).add).toEqual(["budget"]);
    expect(() => readReshape({ "fit:bug-bash": { type: "noul", noul: 1 } })).toThrow(/does not know the question "fit:bug-bash"/);
    expect(() => readReshape({})).toThrow(/no answers/);
  });
});

describe("on the vendor shortlist, 'we also need who's driving'", () => {
  it("gives a card adding people who own things — a person kind and an owner link among what it brings — keeping the categories and vendors, dropping and breaking nothing", async () => {
    const shortlist = template("vendor-shortlist");
    const turn = await proposeReshape({ said: SAID, document: shortlist, decide: whoIsDriving });
    expect(turn.reading.add).toEqual(["owners"]);
    expect(turn.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    const proposal = turn.proposal!;
    expect(proposal).not.toBeNull();
    expect(proposal.add).toEqual(["owners"]);
    expect(proposal.drop).toEqual([]);
    expect(proposal.card.adds.map((chip) => chip.words)).toEqual(["people who own things"]);
    expect(proposal.card.adds[0]!.brings).toContain("a person kind");
    expect(proposal.card.adds[0]!.brings).toContain("an owner link");
    expect(proposal.card.keeps.map((chip) => chip.words)).toEqual(["categories", "vendors"]);
    expect(proposal.card.drops).toEqual([]);
    expect(proposal.card.breaking).toEqual([]);
    expect(proposal.card.said).toBe("This adds people who own things and keeps categories and vendors.");
  });

  it("is composed by the host from the reading as one change: a person kind and an owner link, applied to the document in one call, compiling with no warning", async () => {
    const shortlist = template("vendor-shortlist");
    const { proposal } = await proposeReshape({ said: SAID, document: shortlist, decide: whoIsDriving });
    const composed = composeReshape({ document: shortlist, add: proposal!.add, drop: proposal!.drop });
    expect(composed.edits.map((edit) => edit.op)).toEqual(expect.arrayContaining(["add-kind", "add-relation"]));
    expect(composed.edits.find((edit) => edit.op === "add-kind")).toMatchObject({ kind: "person" });
    expect(composed.breaking).toEqual([]);
    expect(composed.notDone).toEqual([]);
    const applied = editDocument(shortlist, composed.edits);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.document).toEqual(composed.document);
    expect(problems(applied.document)).toEqual([]);
    expect(traitsOf(applied.document).map((trait) => trait.trait)).toContain("owners");
    expect(applied.document.kinds["vendor"]!.edges?.["owner"]).toMatchObject({ to: ["person"] });
    // And the base is untouched: the host applies the change, and takes it back, as one.
    expect(shortlist.kinds["person"]).toBeUndefined();
  });

  it("on the trip planner, composes a link to the travelers it has rather than a second people kind", async () => {
    const trip = template("trip-planner");
    const { proposal } = await proposeReshape({ said: SAID, document: trip, decide: whoIsDriving });
    expect(proposal!.card.keeps.map((chip) => chip.name)).toContain("traveller");
    const composed = composeReshape({ document: trip, add: proposal!.add, drop: proposal!.drop });
    expect(composed.edits.some((edit) => edit.op === "add-kind")).toBe(false);
    const link = composed.edits.find((edit) => edit.op === "add-relation") as { to: string[] } | undefined;
    expect(link?.to).toEqual(["traveller"]);
    const applied = editDocument(trip, composed.edits);
    expect(applied.ok && problems(applied.document)).toEqual([]);
  });

  it("is no proposal at all when the reading adds and drops nothing", async () => {
    const turn = await proposeReshape({ said: "we need to pay the florist", document: template("vendor-shortlist"), decide: nothing });
    expect(turn.proposal).toBeNull();
    expect(turn.reading).toMatchObject({ add: [], drop: [] });
  });
});

describe("a chip toggled says the card again", () => {
  it("drops a kind with what that loses said, which the host composes as its remove edits, and puts it back when toggled again", () => {
    const shortlist = template("vendor-shortlist");
    const dropped = reshapeCard({ said: "drop the categories", document: shortlist, add: [], drop: ["category"] });
    expect(dropped.card.drops.map((chip) => chip.name)).toEqual(["category"]);
    expect(dropped.card.keeps.map((chip) => chip.name)).toEqual(["vendor"]);
    expect(dropped.card.breaking).toEqual(["All categories records go, with their links."]);
    const composed = composeReshape({ document: shortlist, add: dropped.add, drop: dropped.drop });
    expect(composed.edits.map((edit) => edit.op)).toContain("remove-kind");
    expect(composed.breaking).toEqual(["All categories records go, with their links."]);
    const applied = editDocument(shortlist, composed.edits);
    expect(applied.ok && problems(applied.document)).toEqual([]);
    const back = reshapeCard({ said: "drop the categories", document: shortlist, add: [], drop: [] });
    expect(back.add).toEqual([]);
    expect(back.drop).toEqual([]);
    expect(back.card.said).toBe("Nothing in Vendor shortlist changes for that.");
  });

  it("says when the app already has what was asked for, and asks nothing of the host for it", () => {
    const chores = template("household-chores");
    const made = reshapeCard({ said: SAID, document: chores, add: ["owners"], drop: [] });
    expect(made.card.adds).toEqual([]);
    expect(made.add).toEqual([]);
    expect(made.card.said).toContain("already has people who own things");
    expect(composeReshape({ document: chores, add: made.add, drop: made.drop }).edits).toEqual([]);
  });

  it("says what a dropped trait's carriers lose", () => {
    const chores = template("household-chores");
    const made = reshapeCard({ said: "nobody owns chores", document: chores, add: [], drop: ["owners"] });
    expect(made.card.drops.map((chip) => chip.name)).toEqual(["owners"]);
    expect(made.card.breaking[0]).toMatch(/^What carries people who own things goes: .*with its values and links\.$/);
  });
});

describe("the seat", () => {
  const compiled = compileDocument(template("vendor-shortlist"));
  if (!compiled.ok) throw new Error("the vendor shortlist compiles");
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [], edges: [] } });
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  const viewer: Principal = { kind: "human", id: "u:viewer", roles: ["viewer"] };

  it("may change the declaration as an owner or an editor, never as a viewer", () => {
    expect(mayChangeDeclaration(store(), owner)).toBe(true);
    expect(mayChangeDeclaration(store(), { kind: "human", id: "u:editor", roles: ["editor"] })).toBe(true);
    expect(mayChangeDeclaration(store(), viewer)).toBe(false);
    expect(mayChangeDeclaration(store(), undefined)).toBe(false);
  });

  it("lists propose_change on a host's turn only when handed a reshape context, and a viewer is handed none", async () => {
    const listed: string[][] = [];
    const turn = async (handed: HostTurn) => {
      listed.push(handed.tools.map((tool) => tool.name));
      return JSON.stringify({ say: "Nothing to change.", proposals: [] });
    };
    const respond = llmResponder({ turn });
    await respond(store(), SAID, { principal: viewer });
    await respond(store(), SAID, { principal: owner, reshape: { document: template("vendor-shortlist"), decide: whoIsDriving } });
    expect(listed[0]).not.toContain(PROPOSE_CHANGE);
    expect(listed[1]).toContain(PROPOSE_CHANGE);
    expect(listed[1]).toContain("search_graph");
  });

  it("hands the card the turn proposed to the reply, with the model told the card and never an edit", async () => {
    let told: unknown;
    const turn = async (handed: HostTurn) => {
      expect(handed.system).toContain(PROPOSE_CHANGE);
      told = await handed.call(PROPOSE_CHANGE, { said: SAID });
      return JSON.stringify({ say: "Here is what that changes.", proposals: [] });
    };
    const reply = await llmResponder({ turn })(store(), SAID, { principal: owner, reshape: { document: () => template("vendor-shortlist"), decide: whoIsDriving } });
    expect(told).toMatchObject({ card: { adds: [{ name: "owners" }] } });
    expect(told).not.toHaveProperty("edits");
    expect(reply.say).toBe("Here is what that changes.");
    expect(reply.reshape?.card.adds.map((chip) => chip.words)).toEqual(["people who own things"]);
    expect(reply.reshape?.add).toEqual(["owners"]);
    expect(reply.proposals).toEqual([]);
    expect(reply.unsure).toBeUndefined();
  });

  it("tells the model when the words asked for no change to the app, or the app is code, and the reply carries no card", async () => {
    const told: unknown[] = [];
    const turn = async (handed: HostTurn) => {
      told.push(await handed.call(PROPOSE_CHANGE, { said: "pay the florist" }));
      return JSON.stringify({ say: "That is a record, not the app.", proposals: [] });
    };
    const reply = await llmResponder({ turn })(store(), "pay the florist", { principal: owner, reshape: { document: template("vendor-shortlist"), decide: nothing } });
    expect(told[0]).toMatchObject({ nothing: expect.stringContaining("No change to the app itself") });
    expect(reply.reshape).toBeUndefined();
    await llmResponder({ turn })(store(), "pay the florist", { principal: owner, reshape: { document: undefined, decide: whoIsDriving } });
    expect(told[1]).toMatchObject({ nothing: expect.stringContaining("declaration is code") });
  });
});
