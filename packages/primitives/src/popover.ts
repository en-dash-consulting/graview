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
 */
export function closeToTrigger(anchor: HTMLElement | null, close: () => void): void {
  const at = typeof document === "undefined" ? null : document.activeElement;
  const trigger = anchor?.querySelector<HTMLElement>("[aria-expanded]") ?? null;
  const inside = at instanceof HTMLElement && anchor !== null && anchor.contains(at) && at !== trigger;
  close();
  if (inside) trigger?.focus();
}

/**
 * A POPOVER STAYS IN THE BOX IT OPENED IN.
 *
 * On somebody else's page the app is one element with `overflow: hidden`,
 * and a pane anchored to its button's right edge, 280 pixels wide, opened
 * from a button near the element's left side ran off it: the profile's
 * settings were cut in half at 1280 and began off the screen at 390. When
 * the pane is inside an embed, it is slid back inside the embed's box and
 * no taller than the room under its top — nudged, never re-laid out.
 */
export function keepInside(pane: HTMLElement | null): void {
  if (!pane) return;
  pane.style.translate = "";
  const box = pane.closest<HTMLElement>("[data-graview-embed]")?.getBoundingClientRect();
  if (!box) return;
  const at = pane.getBoundingClientRect();
  if (at.width === 0) return;
  const GAP = 8;
  let dx = 0;
  if (at.left < box.left + GAP) dx = box.left + GAP - at.left;
  else if (at.right > box.right - GAP) dx = box.right - GAP - at.right;
  if (dx !== 0) pane.style.translate = `${Math.round(dx)}px 0`;
  const room = box.bottom - GAP - at.top;
  if (at.height > room) {
    // `max-height` is the content box's: the pane's own padding and border come on top of it.
    const frame = at.height - parseFloat(getComputedStyle(pane).height || "0");
    pane.style.maxHeight = `${Math.max(120, Math.floor(room - (Number.isFinite(frame) ? frame : 0)))}px`;
  }
}
