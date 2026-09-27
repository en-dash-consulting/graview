/**
 * PRESS A PLACE BY NAME, wherever the bar put it.
 *
 * The bar's places are one row: the pills that fit, and a "+N more" menu
 * for the rest. A harness that finds the pill by its text finds a hidden
 * one at a laptop's width and waits thirty seconds for it to become
 * clickable. This does what a person does — presses the pill if it shows,
 * chooses from the menu if it folded.
 */
export async function pressPlace(page, title) {
  const pill = page.locator('nav[aria-label="Places"] button', { hasText: title }).first();
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
    return "pill";
  }
  const more = page.locator('[data-testid="places-more"], select[data-testid="places"]').first();
  const value = await more.evaluate((select, wanted) => {
    const option = [...select.options].find((o) => o.textContent.trim() === wanted);
    return option ? option.value : null;
  }, title);
  if (value === null) throw new Error(`No place called "${title}" on the bar`);
  await more.selectOption(value);
  return "menu";
}
