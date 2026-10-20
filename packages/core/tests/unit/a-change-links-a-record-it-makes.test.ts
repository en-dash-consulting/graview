import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { weekendDocument } from "../../../../scripts/fixtures/weekend-app.js";
import { made, PermissionDeniedError, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A CHANGE LINKS A RECORD IT MAKES (FR-193). Three photographs dropped on
 * Saturday are three moments made and each linked to Saturday — six calls,
 * one change, one undo. The link's call cannot know the moment's id, which
 * is minted as the moment is made, so it names it: `{ $made: n }`, the
 * first record call `n` of the same change made. The store reads it as that
 * id when it comes to the call, judges the call then, and a call that names
 * a later call, or one that made nothing, refuses the whole change.
 */
const compiled = compileDocument(weekendDocument);
if (!compiled.ok) throw new Error("the weekend compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const nana = { kind: "human" as const, id: "person:nana", roles: ["family"] };
const theo = { kind: "human" as const, id: "person:theo", roles: ["friend"] };
const photo = (name: string) => ({ href: `/graview/files/${name}`, name, type: "image/jpeg", bytes: 1_000 });
const store = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    policy: app.policy!,
    snapshot: { nodes: [{ id: "day:saturday", kind: "day", name: "Saturday" }], edges: [] } as never,
  });
const moments = (s: Store<AnySchema>) => (s.graph.nodesOfKind("moment" as never) as readonly { id: string }[]).map((node) => node.id);
const onSaturday = (s: Store<AnySchema>) => s.graph.allEdges().filter((edge) => edge.kind === "takenOn" && edge.to === "day:saturday").map((edge) => edge.from);

describe("a change that makes records and links them", () => {
  it("makes each moment and links it to the day by naming it, as one change that one undo takes back", () => {
    const s = store();
    const names = ["harbor.jpg", "pier.jpg", "gulls.jpg"];
    const calls = names.flatMap((name, at) => [
      { name: "add-moment", args: { photo: photo(name) } },
      { name: "connect-moment-taken-on", args: { id: made(at * 2), to: "day:saturday" } },
    ]);
    const result = s.applyAll(calls, { author: nana });
    expect(moments(s)).toHaveLength(3);
    expect(onSaturday(s).sort()).toEqual(moments(s).sort());
    expect(new Set(result.ops.map((op) => op.batch)).size).toBe(1);
    /* The log keeps the id it was read as, never the reference. */
    expect(result.ops.filter((op) => op.mutation?.name === "connect-moment-taken-on").map((op) => op.mutation!.args["id"])).toEqual(moments(s));
    s.undo(result.batch, { author: nana });
    expect(moments(s)).toEqual([]);
    expect(onSaturday(s)).toEqual([]);
  });

  it("refuses the whole change, keeping none of it, where a call names a call after it or one that made nothing", () => {
    const s = store();
    expect(() => s.applyAll([{ name: "connect-moment-taken-on", args: { id: made(1), to: "day:saturday" } }, { name: "add-moment", args: { photo: photo("a.jpg") } }], { author: nana })).toThrow(/no call before it made that record/);
    expect(() => s.applyAll([{ name: "add-moment", args: { photo: photo("a.jpg") } }, { name: "connect-moment-taken-on", args: { id: made(0), to: "day:saturday" } }, { name: "connect-moment-taken-on", args: { id: made(1), to: "day:saturday" } }], { author: nana })).toThrow(/no call before it made that record/);
    expect(moments(s)).toEqual([]);
    expect(s.log.length).toBe(0);
  });

  it("judges a call that names a record when it comes to it, as whoever is acting", () => {
    const s = store();
    expect(() => s.applyAll([{ name: "add-moment", args: { photo: photo("a.jpg") } }, { name: "connect-moment-taken-on", args: { id: made(0), to: "day:saturday" } }], { author: theo })).toThrow(PermissionDeniedError);
    expect(moments(s)).toEqual([]);
  });
});
