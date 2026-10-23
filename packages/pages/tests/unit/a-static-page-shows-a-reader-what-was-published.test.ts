import { bindSchema, createSchema, defineApp, defineNode, PUBLISH, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderPlace } from "../../src/static.js";

/**
 * A STATIC PAGE SHOWS A READER WHAT WAS PUBLISHED (Roadmap
 * f-publishing-lifecycle). It is drawn from the viewer's seat view, so in
 * an app that publishes a visitor's page holds the last publish and a
 * collaborator's the head.
 */
const post = defineNode("post", { fields: z.object({ label: z.string() }), plural: "Posts" });
const schema = createSchema([post]);
const { defineMutation } = bindSchema(schema);
const write = defineMutation("write-post", {
  title: "Write a post",
  creates: ["post"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "post", label: args.label } as never);
  },
});
const app = defineApp({ name: "blog", schema, mutations: [write], policy: { roles: ["editor"], grants: [{ roles: ["editor"], mutations: "*" }] }, publishing: { mode: "on-publish", working: ["editor"] } });
const editor: Principal = { kind: "human", id: "eve", roles: ["editor"] };
const visitor: Principal = { kind: "human" };

describe("a static page of an app that publishes", () => {
  it("prints a visitor the last publish, and a collaborator the head", () => {
    const store = new Store({ schema, mutations: [write], policy: app.policy!, publishing: app.publishing! });
    store.apply({ name: "write-post", args: { label: "Out in the world" } }, { author: editor });
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    store.apply({ name: "write-post", args: { label: "Still a draft" } }, { author: editor });
    const page = (viewer: Principal) => renderPlace(store, app, "/posts", { viewer, today: "2026-10-23" }).html;
    expect(page(visitor)).toContain("Out in the world");
    expect(page(visitor)).not.toContain("Still a draft");
    expect(page(editor)).toContain("Still a draft");
  });
});
