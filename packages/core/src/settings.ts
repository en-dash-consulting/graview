import type { SettingDeclaration } from "./app.js";

/**
 * THE TWO SETTINGS EVERY APP SHOULD OFFER, WRITTEN ONCE.
 *
 * Not built in — an app that wants neither declares neither, and an app
 * that wants a third declares it the same way. But text size and motion are
 * the two a reader arrives already needing, and every app writing its own
 * wording for them would give the same control a different name in each
 * one. `settings: [...readerSettings()]` is the whole adoption.
 */
export function readerSettings(): readonly SettingDeclaration[] {
  return [textSize(), motion()];
}

/**
 * How big the words are, carried by the root font size.
 *
 * Every surface the framework draws is sized in `rem`, which is what makes
 * this one line resize the scene, the strip, the routed face and an embed
 * together. 16px is the browser's own default and therefore the starting
 * point; the two above it are the sizes people actually reach for.
 */
export function textSize(): SettingDeclaration {
  return {
    name: "text-size",
    title: "Text size",
    description: "Applies everywhere: the picture, the panes and the pages.",
    honoured: "root-font-size",
    /*
     * THE STARTING OPTION DEFERS RATHER THAN DECIDES.
     *
     * A person who has set their browser's default font to 20px has already
     * answered this question, and an app whose "Default" quietly reset them
     * to 16 would be overriding the exact preference WCAG 1.4.4 exists to
     * protect. So the first option stamps nothing at all and the browser's
     * own size is what the root keeps; every other option overrides it,
     * relative to nothing, because a reader asking for "Largest" means it.
     */
    initial: "browser",
    /*
     * The largest step is 32px because that is 200% of the browser's own
     * default, which is the size WCAG 1.4.4 actually asks an interface to
     * survive. An app offering a size is promising to work at it, so the
     * promise and the requirement are the same number rather than a
     * comfortable one the harness then has to exceed by hand.
     */
    options: [
      { value: "14px", label: "Smaller" },
      { value: "browser", label: "As your browser has it" },
      { value: "20px", label: "Larger" },
      { value: "32px", label: "Largest" },
    ],
  };
}

/**
 * Whether things move.
 *
 * The stylesheet already honours `prefers-reduced-motion` from the system.
 * This is the override for the person whose system says one thing and who
 * wants another here — so "As your system has it" is the starting value and
 * stamps no attribute at all, leaving the media query to answer.
 */
export function motion(): SettingDeclaration {
  return {
    name: "motion",
    title: "Motion",
    honoured: "root-attribute",
    initial: "system",
    options: [
      { value: "system", label: "As your system has it" },
      { value: "reduce", label: "Reduced" },
      { value: "full", label: "Full" },
    ],
  };
}
