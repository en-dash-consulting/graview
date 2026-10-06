import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSchema,
  declareInstallation,
  defineApp,
  defineNode,
  resolveModules,
  type AnySchema,
  type GraviewApp,
} from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A MODULE YOU CAN NEVER TURN OFF SHOULD NOT BE WARNED ABOUT.
 *
 * `module-edge-leak` asks a good question — this line dangles wherever that
 * module is off — and for an app whose domain refers to people there is only
 * one answer, given in prose: the module is never off. People are not a
 * bolt-on for a grounds app; an installation without people is a household
 * of one, which is a graph with no user NODES rather than a disabled module.
 *
 * With no way to say that, the options were to drop the module — drawing the
 * installation for everybody and losing the thing the module is for — or to
 * carry one permanent warning per edge and hope nobody stops reading them. A
 * warning that can only ever be acknowledged is one people learn to scroll
 * past, and that costs the checker its authority on the warnings that matter.
 */
const zoneWith = (installation: ReturnType<typeof declareInstallation>) => {
  const zone = defineNode("zone", {
    fields: z.object({ label: z.string() }),
    plural: "Zones",
    edges: {
      "kept-by": { to: ["user"], description: "who looks after it", inverse: "the ground they keep" },
    },
  });
  return defineApp({
    name: "grounds",
    schema: createSchema([zone, ...installation.kinds]),
    modules: installation.modules,
  });
};

const codes = <S extends AnySchema>(app: GraviewApp<S>) =>
  checkApp(app).findings.map((finding) => `${finding.severity}:${finding.code}`);

describe("an edge into a module", () => {
  it("is still warned about when the module can be turned off", () => {
    const optional = declareInstallation({ roles: ["keeper"], admin: "keeper" });
    expect(codes(zoneWith(optional))).toContain("warning:module-edge-leak");
  });

  it("is not warned about when the module declares itself required", () => {
    const always = declareInstallation({ roles: ["keeper"], admin: "keeper", required: true });
    expect(codes(zoneWith(always))).not.toContain("warning:module-edge-leak");
  });
});

describe("a required module at runtime", () => {
  const modules = {
    installation: { kinds: ["user", "invitation"], required: true },
    vehicles: { kinds: ["vehicle"] },
  };

  it("is on even when the enabled set leaves it out", () => {
    const projection = resolveModules(modules, ["vehicles"]);
    expect([...projection.enabled].sort()).toEqual(["installation", "vehicles"]);
    expect([...projection.disabledKinds]).toEqual([]);
  });

  it("does not keep anything else on", () => {
    const projection = resolveModules(modules, []);
    expect([...projection.enabled]).toEqual(["installation"]);
    expect([...projection.disabledKinds]).toEqual(["vehicle"]);
  });
});
