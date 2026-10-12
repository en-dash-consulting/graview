import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";

/**
 * A RENAMED RELATION KEEPS THE SIGHT THAT READS IT (the review before
 * 0.1.27). A sight `via` a relation names it, and `rename-relation` moved
 * every act, rule and view that named it but not the sight: Secret Santa's
 * "givenBy" renamed to "givesIn" left the participants' sight reaching a
 * relation nobody declares, and the document no longer compiled. Removing
 * the relation is refused while a sight reads it, as it is while a lens
 * draws by it: dropping the sight could show everybody what it kept to each
 * seat's own, and the policy is not an edit's to change.
 */
const santa = JSON.parse(readFileSync(new URL("./fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));

describe("a sight via a relation, as the relation is edited", () => {
  it("follows the relation's new name, and the document still compiles", () => {
    const edited = editDocument(santa, [{ op: "rename-relation", kind: "match", relation: "givenBy", to: "givesIn" }]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.document.policy?.sees?.find((sight) => sight.via)?.via).toBe("givesIn");
    expect(compileDocument(edited.document).ok).toBe(true);
  });

  it("keeps the relation from being removed while it reads it, and says why", () => {
    const edited = editDocument(santa, [{ op: "remove-relation", kind: "match", relation: "givenBy" }]);
    expect(edited.ok).toBe(false);
    if (!edited.ok) expect(edited.findings[0]?.message).toContain(`a sight shows what "givenBy" joins to each seat's own record`);
  });
});
