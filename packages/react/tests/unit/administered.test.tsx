// @vitest-environment jsdom
import { createSchema, declareInstallation, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW, withShown } from "@graview/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, useGraview } from "../../src/index.js";

/*
 * A module drawn only for those who administer it: the provider decides,
 * from the policy and the stop, which kinds a seat does not see — and the
 * scene, the shelf and the pages all read that one answer.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const installation = declareInstallation({ roles: ["coordinator", "gardener"], admin: "coordinator" });
const schema = createSchema([plot, ...installation.kinds] as never);
const policy = installation.withPolicy({ roles: ["gardener"], grants: [{ roles: ["gardener"], mutations: "*", kinds: ["plot"] }] });
const store = () =>
  new Store({ schema: schema as never, mutations: installation.mutations as never, modules: installation.modules, policy });
const june: Principal = { kind: "human", id: "june", roles: ["coordinator"] };
const ravi: Principal = { kind: "human", id: "ravi", roles: ["gardener"] };

function Probe() {
  const { hiddenKinds, administered } = useGraview();
  return <pre>{JSON.stringify({ hidden: [...hiddenKinds].sort(), administered })}</pre>;
}
const probe = (principal: Principal, shown?: readonly string[]) => {
  const html = renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={createViews(schema as never)}
      principal={principal}
      initialView={shown ? withShown(EMPTY_VIEW, shown[0]!, true) : EMPTY_VIEW}
    >
      <Probe />
    </GraviewProvider>,
  );
  return JSON.parse(html.replace(/^<pre>|<\/pre>$/g, "").replace(/&quot;/g, '"'));
};

describe("what a seat sees of an administered module", () => {
  it("keeps the installation's kinds from a seat that may not administer it, whatever the stop says", () => {
    expect(probe(ravi).hidden).toEqual(["invitation", "user"]);
    expect(probe(ravi, ["installation"]).hidden).toEqual(["invitation", "user"]);
    expect(probe(ravi).administered).toEqual([
      expect.objectContaining({ name: "installation", canShow: false, shown: false }),
    ]);
  });

  it("hides them from the seat that may administer until the stop shows them", () => {
    expect(probe(june).hidden).toEqual(["invitation", "user"]);
    expect(probe(june).administered[0]).toMatchObject({ canShow: true, shown: false });
    expect(probe(june, ["installation"]).hidden).toEqual([]);
    expect(probe(june, ["installation"]).administered[0]).toMatchObject({ canShow: true, shown: true });
  });
});
