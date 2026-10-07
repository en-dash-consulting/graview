import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

export function checkSettings<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * A SETTING NOBODY CAN HONOR IS A CONTROL THAT DOES NOTHING.
   *
   * The profile pane draws what the app declares, and the shell knows
   * exactly two ways to carry an answer to every surface. A setting with
   * one option is not a setting; one whose starting value is not among its
   * options opens on an answer nobody chose and cannot choose again; two
   * settings with one name write over each other's storage.
   */
  const settingNames = new Set<string>();
  const HONORED = ["root-font-size", "root-attribute"] as const;
  for (const setting of app.settings ?? []) {
    const where = `settings["${setting.name}"]`;
    if (!/^[a-z][a-z0-9-]*$/.test(setting.name)) {
      add({
        severity: "error",
        code: "setting-name-unusable",
        where,
        message: `"${setting.name}" becomes a storage key and a data-graview- attribute, so it must be kebab-case.`,
        fix: `Rename it to lower-case letters, digits and hyphens — "text-size", not "${setting.name}".`,
      });
    }
    if (settingNames.has(setting.name)) {
      add({
        severity: "error",
        code: "setting-name-taken",
        where,
        message: `Two settings are called "${setting.name}"; they would write over each other.`,
        fix: `Give one of them another name.`,
      });
    }
    settingNames.add(setting.name);
    if (!(HONORED as readonly string[]).includes(setting.honored)) {
      add({
        severity: "error",
        code: "setting-not-honorable",
        where: `${where}.honored`,
        message: `Nothing knows how to apply "${setting.honored}", so this control would do nothing.`,
        fix: `Use ${HONORED.map((one) => `"${one}"`).join(" or ")}.`,
      });
    }
    if (setting.options.length < 2) {
      add({
        severity: "error",
        code: "setting-without-a-choice",
        where: `${where}.options`,
        message: `A setting with ${setting.options.length === 0 ? "no" : "one"} option is not something a person can set.`,
        fix: `Declare at least two options, or drop the setting.`,
      });
    }
    if (!setting.options.some((option) => option.value === setting.initial)) {
      add({
        severity: "error",
        code: "setting-starts-nowhere",
        where: `${where}.initial`,
        message: `It opens on "${setting.initial}", which is not one of its options — nobody could choose it back.`,
        fix: `Set initial to one of: ${setting.options.map((option) => `"${option.value}"`).join(", ")}.`,
      });
    }
    if (setting.honored === "root-font-size") {
      for (const option of setting.options) {
        // The starting option means "leave it as the reader has it" and
        // stamps nothing, so it is a word rather than a length.
        if (option.value === setting.initial) continue;
        if (!/^[0-9.]+(px|rem|em|%|pt)$/.test(option.value)) {
          add({
            severity: "error",
            code: "setting-not-a-length",
            where: `${where}.options["${option.value}"]`,
            message: `A root font size has to be a CSS length; "${option.value}" is not one.`,
            fix: `Use a length with a unit, such as "18px".`,
          });
        }
      }
    }
  }
}
