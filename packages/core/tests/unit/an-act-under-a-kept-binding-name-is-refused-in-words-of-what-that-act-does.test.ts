import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { BIND_OWN_RECORD, BIND_PERSON, createSchema, defineApp, defineNode, REBIND_PERSON, z } from "../../src/index.js";

/**
 * AN ACT UNDER A NAME THE FRAMEWORK KEEPS FOR BINDING IS REFUSED IN WORDS
 * OF WHAT THAT ACT DOES. Every kept name said "the host's binding of an
 * account to the person entered for it", `rebind-person` included, which
 * moves a person bound to the wrong record. The checker, a compile and an
 * edit each say what the kept act does.
 */
const said: Record<string, RegExp> = {
  [BIND_PERSON]: /binding of an account to the person entered for it/,
  [REBIND_PERSON]: /moving of a person bound to the wrong record to the right one/,
  [BIND_OWN_RECORD]: /merging of a member's own record into the person entered for them/,
};

const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const schema = createSchema([participant]);
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Binding",
  kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } },
};

describe("an act under a kept binding name is refused in words of what that act does", () => {
  for (const [act, words] of Object.entries(said)) {
    it(`says what "${act}" does, in graview check, a compile and an edit`, () => {
      const checked = checkApp(defineApp({ name: "binding", schema, mutations: [{ name: act, title: "Mine", input: z.object({}), apply: () => undefined }] as never }) as never).findings.find((one) => one.code === "binding-act-taken");
      expect(checked?.message).toMatch(words);
      const compiled = compileDocument({ ...doc, acts: { [act]: { title: "Mine", on: "member", effects: [{ set: { name: "x" } }] } } } as never).findings.find((one) => one.code === "binding-act-taken");
      expect(compiled?.message).toMatch(words);
      const edited = editDocument(doc as never, [{ op: "add-act", act, title: "Mine", on: "member", effects: [{ set: { name: "x" } }] }] as never);
      expect(edited.ok).toBe(false);
      expect(JSON.stringify(edited.ok ? [] : edited.findings)).toMatch(words);
      for (const other of Object.values(said)) if (other !== words) expect(`${checked?.message} ${compiled?.message} ${JSON.stringify(edited.ok ? [] : edited.findings)}`).not.toMatch(other);
    });
  }
});
