import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A DAY CHANGED APART MINTS NO ID FROM A FIELD A SIGHT KEEPS (Roadmap
 * f-field-sight). "Change just this one" and "Change from here" make a
 * record of their own from the series, and minted its id from the series'
 * label (`board-call-re-layoffs`) — so a role the title is kept from read it
 * in the id it is served, as no other act lets it. Now they mint as the
 * rest do: from the kind's name where some sight keeps the field the name
 * reads, from the name where none does.
 */
const meetings = (sight: Record<string, unknown>): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Meetings",
    kinds: {
      meeting: {
        label: "{title}",
        fields: { title: { type: "string" }, startsAt: { type: "datetime", required: true, repeats: true }, room: { type: "string" } },
      },
    },
    roles: ["staff", "public"],
    acts: { "add-meeting": { title: "Add a meeting", creates: "meeting" } },
    policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["staff"], kinds: ["meeting"] }, { roles: ["public"], kinds: ["meeting"], ...sight }] },
  }) as unknown as GraviewDocument;

const staff: Principal = { kind: "human", id: "person:s", roles: ["staff"] };
const pub: Principal = { kind: "human", id: "person:p", roles: ["public"] };

const open = (document: GraviewDocument) => {
  const compiled = compileDocument(document, { today: () => "2026-10-21" });
  if (!compiled.ok) throw new Error(`the meetings document does not compile: ${JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    // 2026-10-20 is a Tuesday: the call is every Tuesday at nine.
    snapshot: { nodes: [{ id: "meeting:weekly", kind: "meeting", title: "Board call re layoffs", startsAt: "2026-10-20T09:00", startsAtRepeat: { every: "week", on: ["tue"] } }], edges: [] } as never,
  });
};

const ACTS = [
  ["detach-meeting", { on: "2026-10-27", room: "B" }],
  ["split-meeting", { on: "2026-11-03", room: "C" }],
] as const;

const minted = (store: Store<AnySchema>) => (store.graph.nodesOfKind("meeting") as { id: string }[]).map((node) => node.id).filter((id) => id !== "meeting:weekly");

describe("a day changed apart mints no id from a field a sight keeps", () => {
  for (const [act, args] of ACTS) {
    for (const [said, sight] of [
      ["hide", { hide: ["title"] }],
      ["fields", { fields: ["startsAt", "room"] }],
    ] as const) {
      it(`${act} mints the new meeting's id from its kind, not its title, where a sight's ${said} keeps the title from a role`, () => {
        const store = open(meetings(sight));
        store.apply({ name: act, args: { id: "meeting:weekly", ...args } }, { author: staff });
        const ids = minted(store);
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatch(/^meeting:/);
        const view = store.seenBy(pub);
        const served = JSON.stringify([view.snapshot(), view.log.all()]).toLowerCase();
        for (const word of ["board", "layoffs"]) expect(served).not.toContain(word);
      });
    }

    it(`${act} still mints the new meeting's id from its title, which no sight keeps`, () => {
      const store = open(meetings({}));
      store.apply({ name: act, args: { id: "meeting:weekly", ...args } }, { author: staff });
      expect(minted(store)).toEqual(["meeting:board-call-re-layoffs"]);
    });
  }
});
