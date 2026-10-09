/**
 * PRESS A PLACE BY NAME, as a person does: on the one app bar.
 *
 * The scene's places are the bar's (FR-144, FR-145), on the whole-page
 * Shell as in an embed: the ones that fit stand on the row as words, the
 * rest fold into "More", and on a phone they are one control on the page's
 * first line under the bar. Either way a place is `app-place-scene:<kind>:<as>`
 * and is reached in at most two presses — itself where it stands, else the
 * control that opens the list and then it. A place the bar does not name is
 * an error, never a quiet no-op, so a claim downstream of it cannot pass
 * without the press.
 */
export const SCENE_PLACE = '[data-testid^="app-place-scene:"]';

/** The names of the scene's places, as the bar holds them (standing or listed). */
export async function placesNamed(page) {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)].map((one) => one.textContent.trim()), SCENE_PLACE);
}

export async function pressPlace(page, title) {
  const exact = new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const place = page.locator(SCENE_PLACE).filter({ hasText: exact }).first();
  if ((await place.count()) === 0) {
    const named = await placesNamed(page).catch(() => []);
    throw new Error(`No place called "${title}" on the bar (it names: ${named.join(", ") || "nothing"})`);
  }
  if (!(await place.isVisible())) {
    await page.locator('[data-testid="app-places-open"]').first().click();
    await place.waitFor({ state: "visible", timeout: 5_000 });
  }
  await place.click();
  return "bar";
}
