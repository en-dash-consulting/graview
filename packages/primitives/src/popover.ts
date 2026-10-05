/**
 * CLOSE A POPOVER AND GIVE THE KEYBOARD BACK TO WHAT OPENED IT.
 *
 * Every popover on the bar closes on Escape, and every one of them left the
 * keyboard where it was — on a control inside the pane it had just taken
 * away. A removed or hidden element takes focus to <body>, so pressing
 * Escape after "undo" in the activity list put somebody working from the
 * keyboard at the top of the document, and in WebKit the next Tab went
 * nowhere at all. The button that opened the popover is where the keyboard
 * came from, and it is still there.
 *
 * `anchor` holds the trigger (the element with `aria-expanded`) and the
 * pane; the keyboard is moved only when it was inside the pane, so a press
 * that opened the popover and closed it again stays exactly where it was.
 *
 * The pane itself stands in the browser's top layer (`useTopLayer`), placed
 * by its trigger and kept to the viewport, so it is never cut off by the
 * box it opened in (FR-76).
 */
export function closeToTrigger(anchor: HTMLElement | null, close: () => void): void {
  const at = typeof document === "undefined" ? null : document.activeElement;
  const trigger = anchor?.querySelector<HTMLElement>("[aria-expanded]") ?? null;
  const inside = at instanceof HTMLElement && anchor !== null && anchor.contains(at) && at !== trigger;
  close();
  if (inside) trigger?.focus();
}
