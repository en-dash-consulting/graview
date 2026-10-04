// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument, type GraviewDocument } from "@graview/core/document";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * FR-59: A HOST THAT KEEPS THE DECLARATION SAYS WHO IS OFFERED THE STUDIO.
 *
 * `maySeeTheStudio` judges by the app's own policy, which grants the app's
 * people, not its builders: on the vendors app only an owner or a planner
 * may do everything, so an editor Graview Cloud had already let onto its
 * builder was shown no studio — and Cloud's way round it was a store with
 * the policy taken off. `studio: { onApply, offered: true }` is the host's
 * word, and the app's policy stays on the store.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;
const compiled = compileDocument(vendors, { skipFrameworkCheck: true });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

/** Somebody the host lets build, whom no grant of the app's gives every act. */
const EDITOR: Principal = { kind: "human", id: "editor", roles: ["viewer"] };
const OWNER: Principal = { kind: "human", id: "owner", roles: ["owner"] };

const handles: EmbedHandle[] = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await act(async () => handle.unmount());
  document.body.innerHTML = "";
});

async function builder(principal: Principal, studio: EmbedOptions["studio"]) {
  const element = document.createElement("div");
  document.body.append(element);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(element, { app, principal, studio, stop: "#overview=1&in.studio=open", face: "graview", fonts: false } as EmbedOptions<AnySchema>);
  });
  handles.push(handle);
  // The studio's chunk arrives; give it the time a drawn studio takes.
  for (let tries = 0; tries < 40 && !element.querySelector('[data-testid="studio"]'); tries += 1) {
    await act(async () => new Promise((wait) => setTimeout(wait, 40)));
  }
  return { element, handle };
}

describe("who the embed offers the studio to", () => {
  it("an editor no grant gives every act sees the studio when the host offers it, with the app's policy left on the store", async () => {
    const { element, handle } = await builder(EDITOR, { onApply: () => {}, offered: true });
    expect(handle.store.policy, "the app's own policy is still on the store").toBeDefined();
    expect(handle.store.policy?.grants.some((grant) => grant.mutations === "*")).toBe(true);
    expect(element.querySelector('[data-testid="studio"]')).not.toBeNull();
  });

  it("without the host's word, the app's policy decides, as before: the editor is offered nothing", async () => {
    const { element } = await builder(EDITOR, { onApply: () => {} });
    expect(element.querySelector('[data-testid="studio-place"]')).toBeNull();
    expect(element.querySelector('[data-testid="studio"]')).toBeNull();
  });

  it("and a host may take it from somebody the policy would offer it to", async () => {
    const offered = await builder(OWNER, { onApply: () => {} });
    expect(offered.element.querySelector('[data-testid="studio"]')).not.toBeNull();
    const withheld = await builder(OWNER, { onApply: () => {}, offered: false });
    expect(withheld.element.querySelector('[data-testid="studio-place"]')).toBeNull();
  });

  it("or decide it with a predicate of its own, handed the store and the seat", async () => {
    const asked: string[] = [];
    const { element } = await builder(EDITOR, {
      onApply: () => {},
      offered: (store, principal) => {
        asked.push(`${principal?.id}:${store.policy ? "policy" : "none"}`);
        return principal?.id === "editor";
      },
    });
    expect(asked).toContain("editor:policy");
    expect(element.querySelector('[data-testid="studio"]')).not.toBeNull();
  });
});
