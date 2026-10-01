import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkApp, labelOf, isCurrent, nounOf } from "@graview/core";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { createStore, gauntletApp } from "../src/domain/app.js";
import { gauntletSchema } from "../src/domain/schema.js";
import { SEATS } from "../src/ui/seats.js";
import seed from "../src/data/seed.json";

/*
 * THE EXAMPLE STAYS AWKWARD.
 *
 * Each test below is one shape a walk found by accident, named for the
 * shape, asserting the declaration or its seed still has it. An edit that
 * tames the data — shortens the titles, renames the second Wei Zhang,
 * grants the volunteer everything — fails here by the shape's name rather
 * than passing every harness for the wrong reason.
 */

type Rec = { id: string; kind: string } & Record<string, unknown>;
const nodes = seed.nodes as unknown as Rec[];
const edges = seed.edges as { kind: string; from: string; to: string }[];
const nameOf = (node: Rec) => labelOf(gauntletSchema.tryDefinition(node.kind), node);
const ofKind = (kind: string) => nodes.filter((node) => node.kind === kind);
const definition = (kind: string) => gauntletSchema.definition(kind as never);

describe("the declaration", () => {
  it("passes graview check", () => {
    const result = checkApp(gauntletApp);
    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("is seeded by a generator that writes exactly the committed seed", () => {
    const script = fileURLToPath(new URL("../scripts/generate-seed.mjs", import.meta.url));
    expect(() => execFileSync("node", [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });
});

describe("the awkward shapes", () => {
  it("names outside ASCII, and in scripts with no Latin form", () => {
    const names = nodes.map(nameOf);
    expect(names).toContain("Zoë Lamarré");
    // Accented Latin, and Cyrillic, Han, Arabic, Greek, Japanese kana.
    expect(names.some((name) => /\p{Script=Cyrillic}/u.test(name))).toBe(true);
    expect(names.some((name) => /\p{Script=Han}/u.test(name))).toBe(true);
    expect(names.some((name) => /\p{Script=Arabic}/u.test(name))).toBe(true);
    expect(names.some((name) => /\p{Script=Greek}/u.test(name))).toBe(true);
    expect(names.some((name) => /\p{Script=Katakana}/u.test(name))).toBe(true);
    expect(names.filter((name) => /[^\x00-\x7f]/.test(name)).length).toBeGreaterThan(200);
  });

  it("long names of 60 to 120 characters that share a long beginning", () => {
    const long = ofKind("talk").map(nameOf).filter((name) => name.length >= 60 && name.length <= 120);
    expect(long.length).toBeGreaterThan(1000);
    const beginnings = new Map<string, Set<string>>();
    for (const name of long) beginnings.set(name.slice(0, 40), (beginnings.get(name.slice(0, 40)) ?? new Set()).add(name));
    // Many different titles that read the same for their first forty characters.
    expect(Math.max(...[...beginnings.values()].map((set) => set.size))).toBeGreaterThan(10);
    // And people and rooms with names past sixty characters, too.
    expect(ofKind("speaker").map(nameOf).filter((name) => name.length > 60).length).toBeGreaterThanOrEqual(2);
    expect(ofKind("room").map(nameOf).some((name) => name.length > 60)).toBe(true);
  });

  it("long names that share a beginning in a district of their own", () => {
    const sessions = ofKind("session").map(nameOf);
    expect(sessions.every((name) => name.length > 60)).toBe(true);
    expect(sessions.filter((name) => name.startsWith("2024 · Day 2 · Morning · Track")).length).toBe(4);
  });

  it("case variants: one name differing only in case", () => {
    const topics = ofKind("topic").map(nameOf);
    expect(topics).toContain("Machine learning");
    expect(topics).toContain("Machine Learning");
    const talks = new Set(ofKind("talk").map(nameOf));
    expect(["Lightning Talks", "Lightning talks", "LIGHTNING TALKS"].every((title) => talks.has(title))).toBe(true);
  });

  it("one name the beginning of another", () => {
    expect(ofKind("topic").map(nameOf)).toEqual(expect.arrayContaining(["WebAssembly", "WebAssembly Components", "Rust", "Rust in the Kernel"]));
    expect(ofKind("room").map(nameOf)).toEqual(expect.arrayContaining(["Aula", "Aula Magna", "Hall 1", "Hall 10"]));
    expect(ofKind("speaker").map(nameOf)).toEqual(expect.arrayContaining(["Ann Lee", "Ann Leeson"]));
  });

  it("two records of one kind and one name", () => {
    expect(ofKind("speaker").filter((node) => nameOf(node) === "Wei Zhang")).toHaveLength(3);
    expect(ofKind("talk").filter((node) => nameOf(node) === "Opening Remarks")).toHaveLength(10);
    expect(ofKind("staff").filter((node) => nameOf(node) === "Sam Taylor")).toHaveLength(2);
  });

  it("two names that fold to one id", () => {
    const garcias = ofKind("speaker").filter((node) => ["María García", "Maria Garcia"].includes(nameOf(node)));
    expect(garcias.map((node) => node.id).sort()).toEqual(["speaker:maria-garcia", "speaker:maria-garcia-2"]);
  });

  it("a kind with no label field, named from fields of its own", () => {
    for (const kind of ["speaker", "room", "talk", "staff"]) {
      expect(Object.keys(definition(kind).fields.shape)).not.toContain("label");
    }
    // A speaker's name is two fields joined: the heading restates both.
    const zoe = ofKind("speaker").find((node) => node["given"] === "Zoë")!;
    expect(nameOf(zoe)).toBe(`${String(zoe["given"])} ${String(zoe["family"])}`);
  });

  it("a kind whose id is a mass noun", () => {
    expect(nounOf(definition("staff"), "staff")).toBe("staff member");
    expect(definition("staff").plural).toBe("Staff");
  });

  it("one edge name declared on two kinds", () => {
    const declaring = (edge: string) => gauntletSchema.kinds.filter((kind) => edge in definition(kind).edges);
    expect(declaring("held-in")).toEqual(["session", "workshop"]);
    expect(declaring("about")).toEqual(["talk", "workshop"]);
    // And the seed uses both ends of each.
    for (const edge of ["held-in", "about"]) {
      const from = new Set(edges.filter((one) => one.kind === edge).map((one) => one.from.split(":")[0]));
      expect(from.size).toBe(2);
    }
  });

  it("two relations between one pair", () => {
    const presented = new Set(edges.filter((edge) => edge.kind === "presented-by").map((edge) => `${edge.from}|${edge.to}`));
    const twice = edges.filter((edge) => edge.kind === "proposed-by" && presented.has(`${edge.from}|${edge.to}`));
    expect(twice.length).toBeGreaterThan(2000);
  });

  it("a cardinality-one relation, read from its declaring end", () => {
    expect(definition("talk").edges["proposed-by"]?.cardinality).toBe("one");
    expect(definition("talk").edges["in-session"]?.cardinality).toBe("one");
    expect(definition("session").edges["chaired-by"]?.cardinality).toBe("one");
    // Every talk has its one proposer.
    const proposed = new Set(edges.filter((edge) => edge.kind === "proposed-by").map((edge) => edge.from));
    expect(ofKind("talk").every((talk) => proposed.has(talk.id))).toBe(true);
  });

  it("a lifecycle with retired members", () => {
    const talk = definition("talk");
    const retired = ofKind("talk").filter((node) => !isCurrent(talk, node));
    expect(new Set(retired.map((node) => node["status"]))).toEqual(new Set(["rejected", "withdrawn"]));
    expect(retired.length).toBeGreaterThan(400);
    expect(ofKind("workshop").some((node) => !isCurrent(definition("workshop"), node))).toBe(true);
  });

  it("a policy that refuses one seat more than three acts on one record", () => {
    const store = createStore({ snapshot: seed as never });
    const volunteer = SEATS.find((seat) => seat.principal.roles.includes("volunteer" as never))!.principal;
    const talk = ofKind("talk").find((node) => node["status"] === "submitted")!;
    const { affordances, withheld } = deriveAffordances(store, [talk.id], { principal: volunteer });
    expect(affordances.filter((one) => !one.mutation.startsWith("edit-"))).toEqual([]);
    expect(withheld.length).toBeGreaterThan(3);
  });

  it("two humans and an agent, whose ids are not their names", () => {
    const humans = SEATS.filter((seat) => seat.principal.kind === "human" && seat.principal.roles.length > 0);
    const agents = SEATS.filter((seat) => seat.principal.kind === "agent");
    expect(humans.length).toBeGreaterThanOrEqual(2);
    expect(agents.length).toBeGreaterThanOrEqual(1);
    for (const seat of SEATS) {
      expect(seat.label.toLowerCase()).not.toContain(seat.principal.id.toLowerCase());
      // And no seat's id is a node, so nothing resolves it to a name but the seat.
      expect(nodes.some((node) => node.id === seat.principal.id)).toBe(false);
    }
  });

  it("a calendar bound to two kinds, both in one week", () => {
    const calendar = gauntletApp.lenses?.find((lens) => lens.name === "calendar");
    expect(Object.keys(calendar?.bindings ?? {}).sort()).toEqual(["talk", "workshop"]);
    const week = (node: Rec) => String(node["startsAt"] ?? "").slice(0, 10) >= "2026-09-27" && String(node["startsAt"] ?? "").slice(0, 10) <= "2026-09-30";
    expect(ofKind("talk").filter(week).length).toBeGreaterThan(100);
    expect(ofKind("workshop").filter(week).length).toBeGreaterThan(5);
  });

  it("real size", () => {
    expect(nodes.length).toBeGreaterThan(3500);
    expect(edges.length).toBeGreaterThan(10000);
    expect(ofKind("talk").length).toBeGreaterThan(2000);
    expect(ofKind("speaker").length).toBeGreaterThan(1000);
  });

  it("rules that are broken in the seed, on purpose", () => {
    const violations = createStore({ snapshot: seed as never }).violations();
    expect(violations.map((one) => one.invariant).sort()).toEqual([
      "a-slot-is-in-a-session",
      "a-slot-is-in-a-session",
      "a-workshop-fits-its-room",
    ]);
  });
});
