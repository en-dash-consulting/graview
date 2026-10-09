/**
 * PRESS A PLACE BY NAME, as a person does: its tab on the bar.
 *
 * The bar's places are one row of tabs (FR-117) that scrolls sideways when
 * it is longer than its room, rather than folding the rest into a "+N more"
 * menu. A tab scrolled out of the row is still there; the press scrolls it
 * into view first. A place the bar does not name is an error, never a
 * quiet no-op, so a claim downstream of it cannot pass without the press.
 */
export const PLACE_TAB = 'nav[aria-label="Places"] .graview-place-tab, [data-testid="places"] .graview-place-tab';

export async function pressPlace(page, title) {
  const tab = page.locator(PLACE_TAB).filter({ hasText: new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }).first();
  if ((await tab.count()) === 0) {
    const named = await page.locator(PLACE_TAB).allTextContents().catch(() => []);
    throw new Error(`No place called "${title}" on the bar (it names: ${named.map((one) => one.trim()).join(", ") || "nothing"})`);
  }
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  return "tab";
}

