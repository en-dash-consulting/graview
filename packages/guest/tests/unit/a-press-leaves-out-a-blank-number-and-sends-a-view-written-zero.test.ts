import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from "../../../../scripts/fixtures/placement-app.js";
import { judgePress } from "../../src/host/press.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { argumentsRefused, createGuestHost } from "../../src/host/session.js";
import type { PressedField } from "../../src/host/writes.js";

/**
 * A PRESS LEAVES OUT A BLANK NUMBER, AND SENDS A VIEW-WRITTEN ZERO (Roadmap
 * f-views-work-end-to-end). Seen in Staffing Placement: a fieldset bound to
 * a placement, `data-act="set-economics"` and four `type=number` fields the
 * host filled from the record. Emptying the fixed fee sent `fixedFee: ""`,
 * the act's own schema refused it, and the press said nothing. A field the
 * act cannot take blank is left out — the record's value stays — and a
 * view's `value="0"` is a default that carries nothing the view read, so it
 * goes. Words the view wrote are still refused where sight is not total.
 */
const store = () => new Store({ schema: placementApp.schema, mutations: placementApp.mutations ?? [], policy: placementApp.policy!, snapshot: structuredClone(placementSeed) as never }) as unknown as Store<AnySchema>;
const manifest = ECONOMICS_MANIFEST as unknown as WorkerViewManifest;
const shown = new Set(["placement:rhea", "placement:omar"]);
const press = (fields: PressedField[]) => judgePress(store(), manifest, shown, { as: "set-economics", record: "placement:omar", fields });
const filled = (name: string, value: string) => ({ record: "placement:omar", field: name, value });

describe("a press with a number field in it", () => {
  it("leaves out a number field the person emptied after the host filled it, and keeps the rest", () => {
    const judged = press([
      { name: "fixedFee", value: "", typed: true, empty: false, from: filled("fixedFee", "4000") },
      { name: "rate", value: 85, typed: true, empty: false, from: filled("rate", "80") },
    ]);
    expect(judged).toEqual({ ok: true, name: "set-economics", args: { id: "placement:omar", rate: 85 } });
  });

  it("leaves out a number field the person typed something into that is no number (the browser says it as empty)", () => {
    expect(press([{ name: "hours", value: "", typed: true, empty: false }])).toEqual({ ok: true, name: "set-economics", args: { id: "placement:omar" } });
  });

  it("sends a 0 the view wrote into a number field, as a default that says nothing it read", () => {
    expect(press([{ name: "margin", value: 0, typed: false, empty: false }])).toEqual({ ok: true, name: "set-economics", args: { id: "placement:omar", margin: 0 } });
  });

  it("sends a number the view wrote that is what the record holds there now, for an act that writes it back", () => {
    expect(press([{ name: "fixedFee", value: 4000, typed: false, empty: false }])).toEqual({ ok: true, name: "set-economics", args: { id: "placement:omar", fixedFee: 4000 } });
  });

  it("still refuses a number the view wrote that is neither, where some members may not see some records", () => {
    expect(press([{ name: "fixedFee", value: 18500, typed: false, empty: false }])).toMatchObject({ ok: false, reason: "untyped" });
  });
});

describe("an act whose own schema refuses what a press sent", () => {
  it("is said in words, naming the argument and what it expects, never “The act could not be applied.”", () => {
    const at = store();
    const sent: unknown[] = [];
    const host = createGuestHost({ store: at, principal: kit, view: "economics", nonce: "n", send: (message) => sent.push(message), props: () => ({}) as never });
    const outcome = host.pressed({ ok: true, name: "set-economics", args: { id: "placement:omar", fixedFee: "" } });
    expect(outcome).toEqual({ ok: false, reason: "failed", message: "Not applied: “fixedFee” expects a number." });
    host.dispose();
  });

  it("says each of several, at most four", () => {
    expect(argumentsRefused({ issues: [{ path: ["rate"], message: "Invalid input: expected number, received string" }, { path: ["hours"], message: "Too small: expected number to be >=0" }] })).toBe("Not applied: “rate” expects a number; “hours”: too small: expected number to be >=0.");
  });
});
