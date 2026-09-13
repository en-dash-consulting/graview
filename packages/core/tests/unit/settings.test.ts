import { describe, expect, it } from "vitest";
import { checkApp, createSchema, defineApp, defineNode, motion, readerSettings, textSize } from "../../src/index.js";
import { z } from "zod";

/**
 * A SETTING NOBODY CAN HONOUR IS A CONTROL THAT DOES NOTHING.
 *
 * The profile pane draws exactly what the app declares, and the shell knows
 * exactly two ways to carry one answer to every surface. Which means the
 * declaration is checkable — and has to be, because the failure it prevents
 * is a button that visibly does nothing, which is the worst kind.
 */

const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const withSettings = (settings: Parameters<typeof defineApp>[0]["settings"]) =>
  checkApp(defineApp({ name: "t", schema, settings }));
const codes = (result: ReturnType<typeof checkApp>) => result.findings.map((f) => f.code);

describe("the settings a reader may change", () => {
  it("passes the two every app should offer", () => {
    const result = withSettings(readerSettings());
    expect(result.findings.filter((f) => f.code.startsWith("setting-"))).toEqual([]);
    expect(readerSettings().map((one) => one.name)).toEqual(["text-size", "motion"]);
  });

  it("refuses a setting nothing knows how to apply", () => {
    const result = withSettings([
      { ...textSize(), honoured: "telepathy" as never },
    ]);
    expect(codes(result)).toContain("setting-not-honourable");
    expect(result.ok).toBe(false);
  });

  it("refuses a setting with nothing to choose between", () => {
    expect(codes(withSettings([{ ...motion(), options: [{ value: "system", label: "As is" }] }]))).toContain(
      "setting-without-a-choice",
    );
  });

  it("refuses one that opens on an answer it does not offer", () => {
    expect(codes(withSettings([{ ...motion(), initial: "sideways" }]))).toContain("setting-starts-nowhere");
  });

  it("refuses two settings with one name, which would write over each other", () => {
    expect(codes(withSettings([motion(), motion()]))).toContain("setting-name-taken");
  });

  it("refuses a name that cannot be a storage key or an attribute", () => {
    expect(codes(withSettings([{ ...motion(), name: "Text Size" }]))).toContain("setting-name-unusable");
  });

  it("holds a root font size to being an actual length — except the option that defers", () => {
    expect(codes(withSettings([{ ...textSize(), options: [...textSize().options, { value: "huge", label: "Huge" }] }])))
      .toContain("setting-not-a-length");
    /*
     * The starting option is a WORD on purpose: a person who set their
     * browser's default font to 20px has already answered, and an app whose
     * "default" quietly reset them to 16 would override the exact preference
     * WCAG 1.4.4 exists to protect. It stamps nothing, so it is not a length.
     */
    expect(textSize().initial).toBe("browser");
    expect(codes(withSettings([textSize()]))).not.toContain("setting-not-a-length");
  });
});
