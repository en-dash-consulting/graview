import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal, type SignIn } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, NotifyButton, registerDefaultViews } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * A VISITOR IS SHOWN THE WAY IN, NOT STRUCK ACTS (FR-183). On the scene's
 * Inspector a signed-out reader standing on an era was told "Nothing you
 * may do with an era — 3 actions withheld" over three dead buttons. With
 * the host's `signIn` on the provider, the pane says that one line, and a
 * "Notify me" press is not drawn for somebody nobody can tell.
 */
const era = defineNode("era", { fields: z.object({ label: z.string() }), plural: "Eras", label: (node) => node.label });
const schema = createSchema([era]);
const { defineMutation } = bindSchema(schema);
const act = (name: string) =>
  defineMutation(name, {
    title: `Do ${name}`,
    subject: { kinds: ["era"], arg: "id" },
    writes: ["label"],
    input: z.object({ id: nodeRef(["era"]) }),
    apply: (ctx, args) => ctx.patchNode(args.id, { label: name }),
  });
const acts = ["date", "rename"].map(act);
const store = new Store({
  schema,
  mutations: acts as never,
  invariants: [],
  policy: { grants: [{ roles: ["editor"], mutations: "*" }] } as never,
  snapshot: { nodes: [{ id: "jurassic", kind: "era", label: "Jurassic" }] as never, edges: [] },
});
const visitor: Principal = { kind: "human", id: "anonymous" };
const signIn: SignIn = { label: "Sign in to make changes", run: () => {} };

const drawn = (also: { signIn?: SignIn }) =>
  renderToStaticMarkup(
    <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} initialSelection={["jurassic"]} principal={visitor} {...also}>
      <Inspector />
      <NotifyButton choices={[{ on: "changed", record: "jurassic" }]} />
    </GraviewProvider>,
  );

describe("the Inspector for a visitor", () => {
  it("says the host's way in, and nothing struck or withheld, where the host offers one", () => {
    const html = drawn({ signIn });
    expect(html).toContain('data-testid="sign-in"');
    expect(html).toContain("Sign in to make changes");
    expect(html).not.toContain("<s>");
    expect(html).not.toContain('data-testid="no-affordances"');
    expect(html).not.toContain('data-testid="notify-me"');
  });

  it("strikes each act with the reason, and offers Notify me, where the host said nothing", () => {
    const html = drawn({});
    expect(html).not.toContain('data-testid="sign-in"');
    expect(html).toContain("<s>");
    expect(html).toContain('data-testid="notify-me"');
  });
});
