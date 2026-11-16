import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp, type Policy } from "../../src/index.js";

/**
 * GRAVIEW CHECK KNOWS EVERY ACT THE STORE ANSWERS. The store gives every
 * kind acts of its own (an edit, a remove, an archive and its bringing back,
 * a merge, a leave-alone and its undoing), a kind with a date that repeats
 * three more, every relation a connect and a disconnect, and every store
 * keeps a link and types into a field. A grant may name any of them, and the
 * store honors it; the checker refused `leave-alone-<kind>` and
 * `allow-tidying-<kind>` as acts no mutation declares, because it listed the
 * derived acts by hand and the list fell behind. It reads the store's own
 * list now.
 */
const app = (): GraviewApp<AnySchema> => {
  const compiled = compileDocument(
    {
      format: "graview-document",
      formatVersion: 1,
      name: "Keys",
      roles: ["packer"],
      kinds: {
        box: { fields: { name: { type: "string", required: true } }, edges: { holds: { to: ["errand"] } } },
        errand: { fields: { name: { type: "string", required: true } } },
        meeting: { fields: { name: { type: "string", required: true }, startsAt: { type: "datetime", required: true, repeats: true } } },
      },
      acts: {
        "add-box": { title: "Add a box", creates: "box" },
        "add-errand": { title: "Add an errand", creates: "errand" },
        "add-meeting": { title: "Add a meeting", creates: "meeting" },
      },
    } as never,
    { today: () => "2026-11-16" },
  );
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

const granting = (base: GraviewApp<AnySchema>, mutations: readonly string[]): GraviewApp<AnySchema> => {
  const policy: Policy = { roles: ["packer"], grants: [{ roles: ["packer"], mutations: [...mutations] }] } as Policy;
  return { ...base, policy } as GraviewApp<AnySchema>;
};

const unknownGrants = (checked: ReturnType<typeof checkApp>) =>
  checked.findings.filter((finding) => finding.code === "grant-unknown-mutation").map((finding) => finding.message);

describe("graview check knows every act the store answers", () => {
  it("takes a grant naming every act the store registers for the app", () => {
    const base = app();
    const store = new Store<AnySchema>({ schema: base.schema, mutations: (base.mutations ?? []) as never });
    const names = store.allMutations().map((mutation) => mutation.name);
    // The store's own list has the acts the grant used to be refused for, and the rest.
    for (const name of ["leave-alone-box", "allow-tidying-box", "edit-box", "remove-box", "archive-box", "unarchive-box", "merge-box", "skip-meeting", "detach-meeting", "split-meeting", "connect-box-holds", "disconnect-box-holds"]) {
      expect(names).toContain(name);
    }
    expect(unknownGrants(checkApp(granting(base, names)))).toEqual([]);
  });

  it("takes a grant naming keeping a link and typing into a field, which every store answers", () => {
    expect(unknownGrants(checkApp(granting(app(), ["keep-link", "type-text"])))).toEqual([]);
  });

  it("still refuses a grant naming an act nobody answers", () => {
    expect(unknownGrants(checkApp(granting(app(), ["leave-alone-crate"])))).toEqual([`Grants "leave-alone-crate", which no mutation declares.`]);
  });
});

describe("a grant naming an act every store answers without a grant", () => {
  it("is told it gives nothing, rather than that no mutation declares it", () => {
    const checked = checkApp(granting(app(), ["vote-suggestion", "propose-changes", "publish"]));
    expect(unknownGrants(checked)).toEqual([]);
    expect(checked.findings.filter((finding) => finding.code === "grant-names-ungranted-act").map((finding) => finding.severity)).toEqual(["warning", "warning", "warning"]);
    expect(checked.findings.find((finding) => finding.message.startsWith(`Grants "publish"`))?.message).toMatch(/publishing\.publishers/);
  });
});
