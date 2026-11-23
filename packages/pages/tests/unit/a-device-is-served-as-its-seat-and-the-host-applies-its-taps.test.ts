// A host that serves seats loads the field-sight judge where its store is (graview-sight).
import "@graview/core/field-sight";
import { createSchema, defineApp, defineInvariant, defineMutation, defineNode, nodeRef, PUBLISH, Store, z, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { renderScreen, resolveTap } from "@graview/pages/device";
import { coach, MUTATIONS as ROSTER_MUTATIONS, parent, policy as rosterPolicy, schema as rosterSchema, world } from "../../../core/tests/support/hidden-phones.js";

/**
 * A DEVICE IS SERVED AS ITS SEAT, AND ITS HOST APPLIES WHAT IT TAPS (Roadmap
 * f-display-framework-follow-ups). A screen on a wall is paired at a seat —
 * often a reader, not the owner — so it is drawn what that seat is served:
 * in an app that publishes, the last publish. A tap is resolved to the act
 * it would apply, and nothing is applied: the host applies it under its own
 * seat and draws the next screen with a notice of how it went.
 */
const post = defineNode("post", { fields: z.object({ label: z.string(), read: z.boolean() }), plural: "Posts" });
const schema = createSchema([post]);
const write = defineMutation("write-post", {
  title: "Write a post",
  creates: ["post"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "post", label: args.label, read: false } as never);
  },
});
const retitle = defineMutation("retitle-post", {
  title: "Retitle it",
  subject: { kinds: ["post"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["post"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const markRead = defineMutation("mark-read", {
  title: "Mark it read",
  subject: { kinds: ["post"], arg: "id" },
  writes: ["read"],
  input: z.object({ id: nodeRef(["post"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { read: true });
  },
});
const mutations = [write, retitle, markRead];
const policy: Policy = {
  roles: ["editor", "reader"],
  grants: [
    { roles: ["editor"], mutations: "*" },
    { roles: ["reader"], mutations: ["mark-read"] },
  ],
  sees: [{ roles: "*", kinds: ["post"] }],
};
const app = defineApp({ name: "noticeboard", schema, mutations, policy, publishing: { mode: "on-publish", working: ["editor"] } });
const editor: Principal = { kind: "human", id: "eve", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "kitchen-screen", roles: ["reader"] };
const PW3 = { width: 758, height: 1024 } as const;

/** A post published as "Bins out on Tuesday", retitled since, and a second post still a draft. */
function noticeboard() {
  const store = new Store({ schema, mutations, policy, publishing: app.publishing! });
  store.apply({ name: "write-post", args: { label: "Bins out on Tuesday" } }, { author: editor });
  store.apply({ name: PUBLISH, args: {} }, { author: editor });
  const id = (store.graph.nodesOfKind("post") as readonly { id: string }[])[0]!.id;
  store.apply({ name: "retitle-post", args: { id, label: "Bins out on Wednesday" } }, { author: editor });
  store.apply({ name: "write-post", args: { label: "Party on Friday" } }, { author: editor });
  return { store, id };
}
const screen = (store: Store<never>, place: string, viewer: Principal, notice?: string) => renderScreen(store, app as never, place, { profile: "eink", viewport: PW3, viewer, ...(notice !== undefined ? { notice } : {}) });

describe("a screen paired at a reader's seat", () => {
  it("draws only what that seat is served: the last publish, not the collaborators' head", () => {
    const { store, id } = noticeboard();
    const list = screen(store as never, "/posts", reader);
    expect(list.found).toBe(true);
    expect(list.html).toContain("Bins out on Tuesday");
    expect(list.html).not.toContain("Bins out on Wednesday");
    expect(list.html).not.toContain("Party on Friday");
    const record = screen(store as never, `/posts/${encodeURIComponent(id)}`, reader);
    expect(record.title).toBe("Bins out on Tuesday — noticeboard");
    expect(record.html).not.toContain("Wednesday");
    // The editor's screen is the head.
    const editors = screen(store as never, "/posts", editor);
    expect(editors.html).toContain("Bins out on Wednesday");
    expect(editors.html).toContain("Party on Friday");
  });

  it("offers the reader only what its seat may do, and a draft it is not served opens nothing", () => {
    const { store, id } = noticeboard();
    const record = screen(store as never, `/posts/${encodeURIComponent(id)}`, reader);
    expect(record.taps.filter((tap) => "act" in tap.does).map((tap) => tap.does)).toEqual([{ act: "mark-read", args: { id } }]);
    const draft = (store.graph.nodesOfKind("post") as readonly { id: string }[]).find((one) => one.id !== id)!;
    const list = screen(store as never, "/posts", reader);
    expect(resolveTap(store, app, { label: "Party on Friday", does: { open: draft.id } }, { viewer: reader, renderId: list.renderId }).ok).toBe(false);
  });
  it("says no press in words worked out from a head the reader is not served", () => {
    // A rule whose repair quotes the post's title: on a reader's screen it quotes the published one.
    const unread = defineInvariant("a-post-is-read", {
      scope: { kind: "post" },
      evaluate: ({ subject }) => {
        const one = subject as unknown as { id: string; label: string; read: boolean };
        return one.read ? [] : [{ invariant: "a-post-is-read", label: "A post is read", message: `${one.label} is unread`, subjectId: one.id, nodeIds: [one.id], repairs: [{ mutation: "mark-read", args: { id: one.id }, label: `Read “${one.label}”` }] }];
      },
    });
    const store = new Store({ schema, mutations, invariants: [unread] as never, policy, publishing: app.publishing! });
    store.apply({ name: "write-post", args: { label: "Bins out on Tuesday" } }, { author: editor });
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    const id = (store.graph.nodesOfKind("post") as readonly { id: string }[])[0]!.id;
    store.apply({ name: "retitle-post", args: { id, label: "Bins out on Wednesday" } }, { author: editor });
    const withRule = defineApp({ name: "noticeboard", schema, mutations, invariants: [unread] as never, policy, publishing: app.publishing! });
    const drawn = renderScreen(store as never, withRule as never, `/posts/${encodeURIComponent(id)}`, { profile: "eink", viewport: PW3, viewer: reader });
    expect(drawn.html).not.toContain("Wednesday");
    expect(drawn.taps.map((tap) => tap.label).join(" ")).not.toContain("Wednesday");
  });
});

describe("a screen paired at a seat a sight keeps a field from", () => {
  const roster = defineApp({ name: "roster", schema: rosterSchema, mutations: ROSTER_MUTATIONS, policy: rosterPolicy });
  const drawn = (phone: string | undefined, viewer: Principal, at: string) => renderScreen(world(phone) as never, roster as never, at, { profile: "eink", viewport: PW3, viewer, today: "2026-11-23" });
  it("draws no phone number a parent may not see, on a record's screen or its kind's list, and the same screen with a value there as without one", () => {
    for (const at of ["/players/player%3Aann", "/players"]) {
      expect(drawn("555 0101", parent, at).html).not.toMatch(/0101|asthma/);
      expect(drawn("555 0101", parent, at).html).toBe(drawn(undefined, parent, at).html);
      expect(drawn("555 0101", parent, at).renderId).toBe(drawn(undefined, parent, at).renderId);
    }
    expect(drawn("555 0101", coach, "/players/player%3Aann").html).toContain("555 0101");
  });
});

describe("a tap resolved", () => {
  it("answers the act it would apply, with its arguments, and applies nothing", () => {
    const { store, id } = noticeboard();
    const drawn = screen(store as never, `/posts/${encodeURIComponent(id)}`, reader);
    const press = drawn.taps.find((tap) => "act" in tap.does)!;
    const ops = store.log.all().length;
    const outcome = resolveTap(store, app, press, { viewer: reader, renderId: drawn.renderId });
    expect(outcome).toEqual({ ok: true, does: "act", act: "mark-read", args: { id }, label: "Mark it read", said: "Mark it read: done.", place: `/posts/${encodeURIComponent(id)}`, page: 0 });
    expect(store.log.all().length).toBe(ops);
    expect((store.graph.getNode(id) as unknown as { read: boolean }).read).toBe(false);
    // The host applies it under its own seat; the next screen is drawn as that seat now stands.
    if (outcome.ok && outcome.does === "act") store.apply({ name: outcome.act, args: { ...outcome.args } }, { author: reader, via: "device", intent: outcome.label });
    expect((store.graph.getNode(id) as unknown as { read: boolean }).read).toBe(true);
  });

  it("answers a navigation as the place to draw next, never an act", () => {
    const { store } = noticeboard();
    const list = screen(store as never, "/posts", reader);
    const row = list.taps.find((tap) => "open" in tap.does)!;
    const outcome = resolveTap(store, app, row, { viewer: reader, renderId: list.renderId });
    expect(outcome.ok && outcome.does).toBe("open");
    expect("act" in outcome).toBe(false);
  });
});

describe("a notice on the screen", () => {
  it("draws the outcome of a tap on the screen, and moves no press from where the screen without it has it", () => {
    const { store, id } = noticeboard();
    const place = `/posts/${encodeURIComponent(id)}`;
    const plain = screen(store as never, place, reader);
    const noticed = screen(store as never, place, reader, "Marked read");
    expect(noticed.html).toContain("Marked read");
    expect(noticed.html).toMatch(/class="gv-at gv-notice"[^>]*role="status"/);
    expect(plain.html).not.toContain('class="gv-at gv-notice"');
    expect(noticed.taps).toEqual(plain.taps);
    // A refusal is said as it was given, escaped like every word on the screen.
    const refused = screen(store as never, place, reader, "“Mark it read” is no longer yours to do: <not now>");
    expect(refused.html).toContain("&lt;not now&gt;");
    expect(refused.html).not.toContain("<not now>");
  });

  it("is another picture, so a host can tell the two apart, but a tap on it resolves as on the screen without it", () => {
    const { store, id } = noticeboard();
    const place = `/posts/${encodeURIComponent(id)}`;
    const plain = screen(store as never, place, reader);
    const noticed = screen(store as never, place, reader, "Marked read");
    expect(noticed.renderId).not.toBe(plain.renderId);
    const press = noticed.taps.find((tap) => "act" in tap.does)!;
    expect(resolveTap(store, app, press, { viewer: reader, renderId: noticed.renderId })).toMatchObject({ ok: true, does: "act", act: "mark-read" });
  });

  it("says nothing when the notice is empty", () => {
    const { store } = noticeboard();
    expect(screen(store as never, "/posts", reader, "  ").html).not.toContain('class="gv-at gv-notice"');
  });
});
