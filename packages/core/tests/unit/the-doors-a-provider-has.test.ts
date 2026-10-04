import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type AnySchema, checkApp, createSchema, defineApp, defineNode, generateLlmsTxt, type GraviewApp } from "../../src/index.js";

/**
 * A PROVIDER CAN SAY HOW IT IS REACHED.
 *
 * `{ name, kind, description?, may? }` was enough for the checker to verify
 * an allowlist and nothing at all about the question every product with a
 * model meets on day one: how does a person's photograph get to it? The four
 * doors — a prompt to copy and an answer to paste, MCP, a key typed into the
 * browser, a process on this machine — are not one product's invention; they
 * are the four ways any browser app can reach a model. Undeclared, nothing
 * derived could offer the right one, ask the awkward question about a key,
 * or list the doors in the docs.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const schema = createSchema([zone]);
const app = (intelligence: Parameters<typeof defineApp>[0]["intelligence"]) =>
  defineApp({ name: "grounds", schema, intelligence });
const codes = <S extends AnySchema>(a: GraviewApp<S>) =>
  checkApp(a).findings.map((finding) => `${finding.severity}:${finding.code}`);

describe("the doors a provider declares", () => {
  it("passes when a local door names what serves it and a key says where it lives", () => {
    const said = codes(
      app([
        {
          name: "surveyor",
          kind: "llm",
          reach: ["paste", "mcp", "key", "local"],
          bridge: "/__graview/local",
          keyStorage: "in this browser only, never in the repository or the bundle",
        },
      ]),
    );
    expect(said.filter((code) => code.includes("intelligence"))).toEqual([]);
  });

  it("asks what serves a local door when nothing does", () => {
    expect(codes(app([{ name: "surveyor", kind: "llm", reach: ["local"] }]))).toContain(
      "warning:intelligence-local-without-bridge",
    );
  });

  it("asks where a key is kept, because a person handing one over is owed the sentence", () => {
    expect(codes(app([{ name: "surveyor", kind: "llm", reach: ["key"] }]))).toContain(
      "warning:intelligence-key-without-storage",
    );
  });

  it("says a graph provider has no door: it is the graph", () => {
    expect(codes(app([{ name: "starter", kind: "graph", reach: ["paste"] }]))).toContain(
      "warning:intelligence-reach-on-graph",
    );
  });

  it("refuses a door that is not one of the four", () => {
    expect(codes(app([{ name: "surveyor", kind: "llm", reach: ["carrier-pigeon" as never] }]))).toContain(
      "error:intelligence-reach-unknown",
    );
  });

  it("lists the doors in the generated docs", () => {
    const text = generateLlmsTxt(
      app([
        {
          name: "surveyor",
          kind: "llm",
          description: "Reads photographs of the ground.",
          reach: ["paste", "local"],
          bridge: "/__graview/local",
        },
      ]),
    );
    expect(text).toContain("## Intelligence");
    expect(text).toContain("Reached by: paste, local.");
    expect(text).toContain("/__graview/local");
  });
});
