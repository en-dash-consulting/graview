// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Begin, registerDefaultViews } from "../../src/index.js";

/**
 * "Test drives — waiting for Shoppers and Showrooms and Cars", said beside
 * four showrooms and 340 cars: the way in named everything an act needs,
 * not what is still missing (the seventh walk).
 */
const showroom = defineNode("showroom", { fields: z.object({ label: z.string() }), plural: "Showrooms" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const drive = defineNode("drive", { fields: z.object({ label: z.string() }), plural: "Test drives" });
const schema = createSchema([showroom, shopper, drive]);
const { defineMutation } = bindSchema(schema);
const open = defineMutation("open", { title: "Open a showroom", creates: ["showroom"], input: z.object({ label: z.string() }), apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "showroom"), kind: "showroom", label: args.label }) });
const signUp = defineMutation("sign-up", { title: "Sign up", creates: ["shopper"], input: z.object({ label: z.string() }), apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "shopper"), kind: "shopper", label: args.label }) });
const book = defineMutation("book", {
  title: "Book a test drive",
  creates: ["drive"],
  input: z.object({ label: z.string(), showroomId: nodeRef(["showroom"]), shopperId: nodeRef(["shopper"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "drive"), kind: "drive", label: args.label }),
});

describe("the way in, part of the way through", () => {
  it("says a kind waits for what is still missing, not for what is already there", async () => {
    const store = new Store({ schema, mutations: [open, signUp, book], snapshot: { nodes: [{ id: "showroom:quay", kind: "showroom", label: "The Quay" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}><Begin /></GraviewProvider>));
    const row = host.querySelector('[data-begin-kind="drive"]')!;
    expect(row.textContent).toContain("Waiting for Shoppers.");
    expect(row.textContent).not.toContain("Showrooms");
    await act(async () => root.unmount());
    host.remove();
  });
});
