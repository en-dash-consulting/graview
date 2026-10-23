import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, servesReaders, Store, type Principal } from "../../src/index.js";

/**
 * A READER IS REFUSED UNTIL PUBLISHING IS LOADED (Roadmap
 * f-publishing-lifecycle). How a reader of an app that publishes is served
 * lives in `@graview/core/publishing`, so a live app's page carries none
 * of it. Until it is loaded, serving such a reader fails closed — refused,
 * never handed the head — while a live app, and a collaborator of one that
 * publishes, are served as ever. This file never loads it.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
  },
});
const editor: Principal = { kind: "human", id: "eve", roles: ["editor"] };
const reader: Principal = { kind: "human" };
const store = (mode: "live" | "on-publish") => {
  const made = new Store({ schema, mutations: [add], policy: { grants: [{ roles: ["editor"], mutations: "*" }] }, publishing: { mode, working: ["editor"] } });
  made.apply({ name: "add-note", args: { label: "Draft" } }, { author: editor });
  return made;
};

describe("before @graview/core/publishing is loaded", () => {
  it("refuses to serve a reader of an app that publishes, rather than hand it the head", () => {
    expect(servesReaders()).toBe(false);
    expect(() => store("on-publish").seenBy(reader)).toThrow(/Load @graview\/core\/publishing/);
  });

  it("serves a collaborator of it, and every seat of a live app, as ever", () => {
    expect(store("on-publish").seenBy(editor).graph.allNodes()).toHaveLength(1);
    expect(store("live").seenBy(reader).graph.allNodes()).toHaveLength(1);
  });
});
