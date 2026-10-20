import type { AnySchema } from "@graview/core";
import { useGraview, useSelection, useViolations } from "@graview/react";
import { focusInto, SkipLinks, type SkipTo } from "./skip-links.js";
import { wordsForChosen } from "./subject.js";

/** What is chosen, where it is drawn as itself: its card, else its mark in a picture — never a copy drawn small and inert. */
function chosenDrawn(id: string | undefined): HTMLElement | null {
  if (id === undefined) return null;
  const live = ":not([inert] *):not([aria-hidden='true'] *)";
  const at = CSS.escape(id);
  return document.querySelector<HTMLElement>(`[data-graview-view="${at}"]${live}`) ?? document.querySelector<HTMLElement>(`[data-graview-pick="${at}"]${live}`);
}

/**
 * THE SCENE'S WAYS PAST THE BAR: to what is chosen — whose card then opens
 * its acts on its key — into the picture, and, while a rule is broken, to
 * what is broken, opened. The pointer goes straight to either; from the keyboard each was
 * the far side of the bar (walks XI and XII).
 */
export function SceneSkips() {
  const { store } = useGraview<AnySchema>();
  const { selection } = useSelection();
  const broken = useViolations<AnySchema>().length;
  const to: SkipTo[] = [];
  const last = selection[selection.length - 1];
  if (last !== undefined) {
    to.push({
      label: selection.length === 1 ? `Skip to ${wordsForChosen(store, last) ?? "what is chosen"}` : `Skip to the ${selection.length} chosen`,
      testid: "chosen",
      go: () => void focusInto(chosenDrawn(last)),
    });
  }
  // Into the picture, onto its first card: a district was the far side of the bar too.
  to.push({ label: "Skip to the picture", testid: "picture", go: () => void focusInto(document.querySelector<HTMLElement>("main")) });
  if (broken > 0) {
    to.push({
      label: broken === 1 ? "Skip to the rule that is broken" : `Skip to the ${broken} rules that are broken`,
      testid: "problems",
      opens: true,
      go: () => {
        // The standing, pressed: its list opens under it, and the next Tab is in it.
        const standing = document.querySelector<HTMLElement>('[data-testid="standing"]');
        if (!standing) return;
        standing.focus();
        if (standing.getAttribute("aria-expanded") !== "true") standing.click();
      },
    });
  }
  return <SkipLinks to={to} />;
}
