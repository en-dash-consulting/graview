import { createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A HOME VIEW CAN GO FULL-BLEED ON A DESK (Roadmap
 * f-home-view-full-bleed-on-desk). `bleed: true` takes the page's gutter
 * back on a phone and keeps the column on a desk; `bleed: "full"` spans the
 * page at every width. The check takes it on the home, on a view of one that
 * replaces its page and on one of many that replaces its list, and refuses
 * any other value with its finding code.
 */
const moment = defineNode("moment", { fields: z.object({ label: z.string() }), plural: "Moments" });
const store = () => new Store({ schema: createSchema([moment]), mutations: [] }) as unknown as Store<AnySchema>;
const home: WorkerViewManifest = { name: "home", attach: "home", cardinality: "many" };

describe("a view's bleed, as the check reads it", () => {
  it('passes "full" on the home, on a page a view of one replaces, and on a list a view of many replaces', () => {
    expect(checkManifest({ ...home, bleed: "full" }, store())).toEqual([]);
    expect(checkManifest({ name: "moment", attach: "moment", cardinality: "one", replaces: "page", bleed: "full" }, store())).toEqual([]);
    expect(checkManifest({ name: "moments", attach: "moment", cardinality: "many", replaces: "page", bleed: "full" }, store())).toEqual([]);
    expect(checkManifest({ ...home, bleed: true }, store())).toEqual([]);
  });

  it("refuses any other value, ending with its finding code (view-bleed)", () => {
    for (const bleed of ["wide", "desk", 1, null, {}]) {
      const said = checkManifest({ ...home, bleed } as never, store());
      expect(said, JSON.stringify(bleed)).toEqual([`The view's bleed is ${JSON.stringify(bleed)}: it is true (edge to edge on a phone, the column on a desk), "full" (the page's whole width at every width, a desk's included), or left out (view-bleed).`]);
    }
  });
});
