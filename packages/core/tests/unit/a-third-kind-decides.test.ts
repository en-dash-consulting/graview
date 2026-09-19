import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  defineNode,
  describeApp,
  generateLlmsTxt,
  nodeRef,
  providerCan,
  undecidableArguments,
} from "../../src/index.js";

/**
 * A DECISION PROVIDER IS A THIRD KIND.
 *
 * `kind` was "graph" | "llm" | "external", and a model that answers typed
 * questions — a Choice over named options, a Score over an ordered rubric,
 * a truth — is none of them: it writes no prose and cannot propose an
 * arbitrary call, so a chat seat must not offer it and a field that wants
 * filling should. The declaration says so, the checker refuses one given
 * acts it could not possibly call, and describe reads it out.
 */
const zone = defineNode("zone", {
  fields: z.object({
    label: z.string(),
    surface: z.enum(["turf", "bed", "hard"]).optional(),
    exposure: z.enum(["sun", "shade"]).optional(),
  }),
  plural: "Zones",
});
const schema = createSchema([zone]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: () => {},
});
const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed", "hard"]) }),
  apply: () => {},
});
const note = defineMutation("note", {
  title: "Leave a note",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), text: z.string(), urgent: z.boolean().optional() }),
  apply: () => {},
});

const app = (intelligence: Parameters<typeof defineApp>[0]["intelligence"]) =>
  defineApp({ name: "grounds", schema, mutations: [stakeOut, setSurface, note], intelligence });
const codes = (a: Parameters<typeof checkApp>[0]) =>
  checkApp(a).findings.map((finding) => `${finding.severity}:${finding.code}`);

describe("what a decision provider can and cannot fill", () => {
  it("can fill choices, node references, truths and bounded numbers", () => {
    expect(undecidableArguments(setSurface)).toEqual([]);
  });

  it("cannot fill prose, and says which argument wants it", () => {
    expect(undecidableArguments(stakeOut)).toEqual([{ name: "label", control: "text" }]);
    expect(undecidableArguments(note)).toEqual([{ name: "text", control: "text" }]);
  });

  it("knows which kinds talk and which decide", () => {
    expect(providerCan({ name: "jev", kind: "decision" }, "prose")).toBe(false);
    expect(providerCan({ name: "jev", kind: "decision" }, "decide")).toBe(true);
    expect(providerCan({ name: "model", kind: "llm" }, "prose")).toBe(true);
    expect(providerCan({ name: "starter", kind: "graph" }, "prose")).toBe(false);
    expect(providerCan({ name: "starter", kind: "graph" }, "propose")).toBe(true);
  });
});

describe("the checker and a decision provider", () => {
  it("passes one whose every act is decidable", () => {
    const said = codes(
      app([{ name: "jev", kind: "decision", reach: ["key"], keyStorage: "in the environment", may: ["set-surface"] }]),
    );
    expect(said.filter((code) => code.includes("intelligence"))).toEqual([]);
  });

  it("refuses one given an act it could not possibly call", () => {
    const findings = checkApp(app([{ name: "jev", kind: "decision", may: ["set-surface", "stake-out"] }])).findings;
    const refused = findings.find((finding) => finding.code === "intelligence-decision-cannot-call");
    expect(refused?.severity).toBe("error");
    expect(refused?.message).toContain("stake-out");
    expect(refused?.message).toContain("label");
  });

  it("holds an unbounded decision provider to every act, since absent may means all", () => {
    expect(codes(app([{ name: "jev", kind: "decision" }]))).toContain("error:intelligence-decision-cannot-call");
  });

  it("says a prose door is no door for a provider that has no prose", () => {
    expect(codes(app([{ name: "jev", kind: "decision", reach: ["paste"], may: ["set-surface"] }]))).toContain(
      "warning:intelligence-decision-prose-door",
    );
  });
});

describe("reading a decision provider out", () => {
  it("describe says it decides rather than talks", () => {
    const said = describeApp(app([{ name: "jev", kind: "decision", reach: ["key"], keyStorage: "env", may: ["set-surface"] }]));
    expect(said).toContain("jev (decision)");
    expect(said).toContain("never prose");
  });

  it("describe reads the ladder out: which rungs the app declares and what each can do", () => {
    const said = describeApp(
      app([
        { name: "starter", kind: "graph", may: ["set-surface"] },
        { name: "jev", kind: "decision", may: ["set-surface"] },
        { name: "model", kind: "llm", may: ["set-surface"] },
      ]),
    );
    expect(said).toContain("## The ladder");
    expect(said).toContain("graph only (declared) — decides");
    expect(said).toContain("jev (decision) — decides — answers a typed question with a confidence. Cannot talk or propose: on this rung the graph answers that instead.");
    expect(said).toContain("model (llm) — talks");
    expect(describeApp(app([]))).toContain("graph only (always there, undeclared)");
  });

  it("the docs say so too", () => {
    const said = generateLlmsTxt(app([{ name: "jev", kind: "decision", may: ["set-surface"] }]));
    expect(said).toContain("### jev (decision)");
    expect(said).toContain("typed questions");
  });
});
