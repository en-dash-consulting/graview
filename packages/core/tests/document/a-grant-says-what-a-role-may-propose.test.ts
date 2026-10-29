import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, readDocument } from "../../src/document/index.js";

/**
 * A GRANT SAYS WHAT A ROLE MAY PROPOSE (Roadmap f-proposals-for-review): in
 * the declaration, `propose` beside `mutations` names the acts a role may
 * ask for and may not run — a grant that only proposes says `mutations: []`
 * — read by the checker as it reads the acts a grant runs, said in words,
 * and added and removed by the named edits like any key of a grant.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const proposing = { ...vendors, policy: { grants: [...vendors.policy!.grants, { roles: ["viewer"], mutations: [], propose: ["book", "set-quote"] }] } };

describe("a grant's propose", () => {
  it("compiles into the app's policy as it is said", () => {
    const compiled = compileDocument(proposing);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(compiled.app.policy?.grants.at(-1)).toEqual({ roles: ["viewer"], mutations: [], propose: ["book", "set-quote"] });
  });

  it("is refused where it names an act the document does not have", () => {
    const compiled = compileDocument({ ...vendors, policy: { grants: [{ roles: ["viewer"], mutations: [], propose: ["bok"] }] } });
    expect(compiled.ok).toBe(false);
    expect(compiled.findings.find((finding) => finding.code === "grant-act")).toMatchObject({ path: "policy.grants.0.propose" });
  });

  it("is refused on a grant that names no act to run and none to propose", () => {
    expect(compileDocument({ ...vendors, policy: { grants: [{ roles: ["viewer"], mutations: [] }] } }).ok).toBe(false);
  });

  it("is added by add-grant, which says it, and removed by remove-grant naming it", () => {
    const added = editDocument(vendors, [{ op: "add-grant", roles: ["viewer"], mutations: [], propose: ["book"] }]);
    if (!added.ok) throw new Error(JSON.stringify(added.findings));
    expect(added.said.join(" ")).toMatch(/A viewer may propose "Book" for review\./);
    const refused = editDocument(vendors, [{ op: "add-grant", roles: ["viewer"], mutations: [], propose: ["bok"] }]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.findings[0]).toMatchObject({ code: "grant-act" });
    const removed = editDocument(added.document, [{ op: "remove-grant", roles: ["viewer"], mutations: [], propose: ["book"] }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    expect(removed.document.policy?.grants).toHaveLength(1);
  });
});
