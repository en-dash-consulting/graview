/**
 * THE WHOLE MENU, AS AFTER MORE… (Roadmap f-make-any-page-better).
 *
 * The right-click menu opens on the field, the two ways to ask, Suggested
 * and the first few acts; the rest — the other acts, what this seat may not
 * do, the face's own rows (Open, Copy link, Notify me…) and the AI's own
 * section — wait behind More…. A harness that means one of those presses
 * More… first, as a person would; a menu with nothing behind it is left as
 * it is.
 */
export async function unfold(page, menu = '[data-testid="context-menu"]') {
  const more = page.locator(`${menu} [data-menu-item="more"]`).first();
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(60);
  }
}
