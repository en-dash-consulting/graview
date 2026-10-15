import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PagesApp } from "../../src/index.js";

/**
 * THE REVIEW: a document whose blocks lay out the way a local review app's
 * did when eight things about them were found (`blocks-layout.gdd.json`) —
 * nested headlines, row groups of text and of columns, a list drawn as rows
 * of a kind with no row of its own, badges on a card and a page, a rule
 * with its own sentence, a large figure, and a place that is only read.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "blocks-layout.gdd.json"), "utf8")), { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error(`the review did not compile: ${JSON.stringify(compiled.findings)}`);
export const review = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(resolve(fixtures, "blocks-layout.seed.json"), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

/** The review on the routed face at `path`, drawn into the document; `done` takes it away. */
export async function rendered(path: string): Promise<{ host: HTMLElement; done: () => Promise<void> }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: review.schema, mutations: review.mutations ?? [], policy: review.policy!, invariants: review.invariants ?? [], snapshot: seed });
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(review), principal: owner, ...(review.brand ? { brand: review.brand } : {}) }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  return {
    host,
    done: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
