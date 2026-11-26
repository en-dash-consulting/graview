import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type InvariantDefinition } from "@graview/core";
import { describeApp, compileDocument } from "@graview/core/check";
import { canonicalize, toDocument } from "@graview/core/document";
import { unfoldedApp } from "@graview/core/rooms";
import { todoApp } from "@graview/todo";
import { describe, expect, it } from "vitest";

/**
 * FR-01. toDocument gives a document-made app back as its own document, so
 * the round trip is exact; a TypeScript app is written as far as it is data,
 * and every surface that is code is named rather than guessed.
 */
const root = resolve(import.meta.dirname, "..");
const vendors = JSON.parse(readFileSync(resolve(root, "packages/core/tests/document/fixtures/vendors.gdd.json"), "utf8"));

describe("a declaration as a document", () => {
  it("round-trips a document-made app to an app whose graview describe is identical", () => {
    const first = compileDocument(vendors);
    if (!first.ok) throw new Error("vendors did not compile");
    const written = toDocument(first.app);
    expect(written.findings).toEqual([]);
    expect(canonicalize(written.document)).toEqual(canonicalize(first.document));
    const again = compileDocument(written.document);
    if (!again.ok) throw new Error("the written document did not compile");
    expect(describeApp(again.app)).toBe(describeApp(first.app));
  });

  it("writes the todo example as far as it is data, and names each surface it cannot express", () => {
    const { document, findings } = toDocument(todoApp);
    // Every kind and field the example declares is in the document.
    // As its author declared it: its rooms' message kind and acts are the framework's, folded in again as it compiles (Graview HQ feature:f-chat-rooms).
    const declared = unfoldedApp(todoApp);
    for (const kind of declared.schema.kinds as readonly string[]) expect(Object.keys(document.kinds)).toContain(kind);
    // Every act written as a body, and every rule judged in code, is named — none is dropped in silence.
    const named = new Set(findings.map((finding) => finding.path));
    for (const act of declared.mutations ?? []) if (!(act as { derived?: unknown }).derived) expect(named, act.name).toContain(`acts.${act.name}`);
    for (const rule of (todoApp.invariants ?? []) as readonly InvariantDefinition[]) if (!rule.judgment) expect(named, rule.name).toContain(`rules.${rule.name}`);
    // And what it could say compiles: the kinds, the relations, the policy.
    const compiled = compileDocument(document);
    expect(compiled.ok, JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error"))).toBe(true);
  });
});
