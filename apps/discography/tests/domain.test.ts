import { checkApp } from "@graview/core/check";
import { kindCardId } from "@graview/layout";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { discographyApp, createStore } from "../src/domain/app.js";

const label = { kind: "human" as const, id: "user-lena", roles: ["label"] };

describe("the declaration", () => {
  it("passes its own check", () => {
    const result = checkApp(discographyApp);
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("offers an empty district its own beginnings, through creates", () => {
    const store = createStore();
    const { affordances } = deriveAffordances(store, [kindCardId("song")], { kindSelection: ["song"], principal: label });
    expect(affordances.map((a) => a.mutation)).toContain("add-song");
  });
});

import seed from "../src/data/seed.json";

describe("the rules, on Tech N9ne's real catalog", () => {
  const seeded = () => createStore({ snapshot: seed as never });

  it("hold over the whole discography, from MusicBrainz", () => {
    expect(seeded().violations()).toEqual([]);
  });

  it("fire when a mistake is made, and are resolved by a repair they name", () => {
    const store = seeded();
    // Tech N9ne featured on his own song.
    store.apply({ name: "feature", args: { songId: "song:caribou-lou", artistId: "artist:tech-n9ne" } }, { author: label });
    const feature = store.violations().find((v) => v.invariant === "features-somebody-else")!;
    expect(feature.message).toContain("Caribou Lou");
    store.apply({ name: feature.repairs[0]!.mutation, args: { ...feature.repairs[0]!.args } }, { author: label });
    // Two of Everready's songs given one number.
    store.apply({ name: "edit-song", args: { id: "song:riot-maker", track: 1 } }, { author: label });
    const clash = store.violations().find((v) => v.invariant === "tracks-in-order")!;
    expect(clash.message).toContain("Everready");
    const renumber = clash.repairs.find((repair) => repair.args?.["id"] === "song:riot-maker")!;
    store.apply({ name: renumber.mutation, args: { ...renumber.args, track: 2 } }, { author: label });
    expect(store.violations()).toEqual([]);
  });
});
