// @vitest-environment jsdom
import { createSchema, declareInstallation, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW, withShown } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildReach, ReachView, registerDefaultViews, Shell, ShowInstallation } from "../../src/index.js";

const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const installation = declareInstallation({ roles: ["coordinator", "gardener"], admin: "coordinator" });
const schema = createSchema([plot, ...installation.kinds] as never);
const policy = installation.withPolicy({
  roles: ["gardener"],
  grants: [{ roles: ["gardener"], mutations: ["tend"], kinds: ["plot"] }],
});
const tend = { name: "tend", title: "Name a caretaker", subject: { kinds: ["plot"] } };
const store = () =>
  new Store({ schema: schema as never, mutations: installation.mutations as never, modules: installation.modules, policy });
const june: Principal = { kind: "human", id: "june", roles: ["coordinator"] };
const ravi: Principal = { kind: "human", id: "ravi", roles: ["gardener"] };

const render = (principal: Principal, shown = false, node: React.ReactNode = <ShowInstallation />) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema as never, createViews(schema as never))}
      principal={principal}
      initialView={shown ? withShown(EMPTY_VIEW, "installation", true) : EMPTY_VIEW}
    >
      {node}
    </GraviewProvider>,
  );

describe("the way into the installation", () => {
  it("is offered to the seat that keeps it and to nobody else", () => {
    expect(render(ravi)).toBe("");
    const html = render(june);
    expect(html).toContain('data-testid="show-installation"');
    expect(html).toContain("Show the installation");
    expect(html).toContain('aria-pressed="false"');
  });

  it("reads pressed while the stop shows it, and offers to hide it", () => {
    const html = render(june, true);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Hide the installation");
  });

  it("sits in the shell's bar", () => {
    const html = render(june, false, <Shell<typeof schema> scheme="light" onScheme={() => {}} />);
    expect(html).toContain('data-testid="show-installation"');
  });
});

describe("what each role reaches", () => {
  it("is read through the policy: a plain yes, a self-only yes, and a no", () => {
    const reach = buildReach(
      policy,
      [tend, { name: "edit-user", title: "Change the person", subject: { kinds: ["user"] } }, ...installation.mutations.map((m) => ({ name: m.name, title: m.title ?? m.name, ...(m.subject ? { subject: m.subject } : {}) }))] as never,
      ["coordinator", "gardener"],
    );
    const may = (role: string, act: string) => reach.cells.find((c) => c.role === role && c.act === act)!.may;
    expect(may("gardener", "tend")).toBe("yes");
    expect(may("gardener", "invite")).toBe("no");
    expect(may("gardener", "edit-user")).toBe("self");
    expect(may("coordinator", "invite")).toBe("yes");
    expect(may("coordinator", "tend")).toBe("no");
  });

  it("draws the grid with the marks in the DOM, from the store's own policy", () => {
    const html = render(june, false, <ReachView fidelity="full" cardinality="many" mode="scene" selected={false} label="Who may do what" />);
    expect(html).toContain('data-testid="reach-lens"');
    expect(html).toContain('data-graview-reach="yes"');
    expect(html).toContain('data-graview-reach="no"');
    expect(html).toContain("Who may do what");
  });
});
