import { offeredPlaces, type Place } from "@graview/core";
import { aggregateId, EMPTY_VIEW, withFocus, withOverview } from "@graview/layout/view";
import { describe, expect, it } from "vitest";
import { scenePlacesOf, WHOLE_KEY, WHOLE_LABEL } from "../../src/index.js";

/*
 * THE BAR SAYS WHERE YOU ARE. Inside Things' rules on a phone the place
 * picker read "The whole thing" (Nick: confusing). Inside a district no
 * picture draws it names the district, on a record the record, and the
 * overview is "Everything" — each said as where you are and offered nowhere.
 */
const schema = { tryDefinition: (kind: string) => ({ rule: { plural: "Rules" }, task: { plural: "Tasks" } })[kind] };
const week: Place = { kind: "task", as: "the-week", title: "The week" } as Place;
const nameOf = (id: string) => (id === "t1" ? "Pay the deposit" : undefined);
const said = (view: typeof EMPTY_VIEW) => {
  const scene = scenePlacesOf({ places: [week], hidden: new Set(), view, schema, nameOf });
  const here = scene.places.find((place) => place.key === scene.current)!;
  return { here, scene };
};

describe("the bar names the district you are in", () => {
  it("calls the overview Everything", () => {
    expect(WHOLE_LABEL).toBe("Everything");
    expect(said(withOverview(EMPTY_VIEW, true)).here.key).toBe(WHOLE_KEY);
  });

  it("names a district no picture draws by its plural, as a place offered nowhere, and goes back to it", () => {
    const { here, scene } = said(withFocus(EMPTY_VIEW, aggregateId("rule")));
    expect(here).toMatchObject({ label: "Rules", hidden: true, kind: "rule" });
    expect(offeredPlaces(scene.places).map((place) => place.label)).toEqual(["Everything", "The week"]);
    expect(scene.to(here.key, withOverview(EMPTY_VIEW, true))).toMatchObject({ focusId: aggregateId("rule"), overview: false });
  });

  it("names a record gone to by its name, and a district a picture draws by the picture", () => {
    expect(said(withFocus(EMPTY_VIEW, "t1")).here.label).toBe("Pay the deposit");
    expect(said(withFocus(EMPTY_VIEW, aggregateId("task"))).here.label).toBe("The week");
  });

  it("names nothing it may not show: a kept-off kind's district is Everything", () => {
    const scene = scenePlacesOf({ places: [week], hidden: new Set(["rule"]), view: withFocus(EMPTY_VIEW, aggregateId("rule")), schema, nameOf });
    expect(scene.current).toBe(WHOLE_KEY);
  });
});
