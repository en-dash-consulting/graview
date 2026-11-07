/**
 * THE APP BAR'S TWO MENUS, PRESSED AS A PERSON PRESSES THEM (Roadmap
 * f-app-bar-calm).
 *
 * The scene and the pages are not on the row: they are the first rows of
 * the app menu, the chevron beside the app's name (`app-menu-open`), drawn
 * only while it is open. What waits for a person and what has happened are
 * one inbox, the bell (`inbox-button`), whose tabs are For you, Activity and
 * Your asks. A harness that went to the scene, or read Activity, does it
 * through these, so a claim downstream of them cannot pass without the
 * press. Each takes a Page or a Frame, and `within` — a selector — where a
 * page holds more than one bar.
 */

const at = (page, within, selector) => (within ? page.locator(within).locator(selector) : page.locator(selector)).locator("visible=true").first();

/** Open the app menu (if it is not open already) and wait for its rows. */
export async function openAppMenu(page, { within, timeout = 10_000 } = {}) {
  const menu = at(page, within, '[data-testid="app-menu"]');
  if ((await menu.count()) === 0) await at(page, within, '[data-testid="app-menu-open"]').click({ timeout });
  await at(page, within, '[data-testid="app-menu"] [data-testid="app-faces"], [data-testid="app-menu"] [data-testid="app-menu-rows"], [data-testid="app-menu"] [data-testid="app-menu-scheme"]').waitFor({ state: "visible", timeout });
}

/** Put the app menu away, by its own chevron, where it is open. */
export async function closeAppMenu(page, { within } = {}) {
  if ((await at(page, within, '[data-testid="app-menu"]').count()) === 0) return;
  await at(page, within, '[data-testid="app-menu-open"]').click();
}

/** Go to a face — "scene" or "pages" — from the app menu: open it, press the face's row (which puts the menu away). */
export async function toFace(page, which, { within, timeout = 10_000 } = {}) {
  await openAppMenu(page, { within, timeout });
  const row = at(page, within, `[data-testid="app-face-${which}"]`);
  await row.waitFor({ state: "visible", timeout });
  await row.click({ timeout });
}

/** Which face the app menu says is current ("scene", "pages" or null where it offers neither), read by opening it and putting it away again. */
export async function faceShown(page, { within, timeout = 10_000 } = {}) {
  await openAppMenu(page, { within, timeout });
  const pressed = async (which) => (await at(page, within, `[data-testid="app-face-${which}"]`).getAttribute("aria-pressed", { timeout: 2_000 }).catch(() => null)) === "true";
  const shown = (await pressed("scene")) ? "scene" : (await pressed("pages")) ? "pages" : null;
  await closeAppMenu(page, { within });
  return shown;
}

/** Choose the app's appearance — "system", "light" or "dark" — from the app menu, and put it away. */
export async function chooseScheme(page, value, { within, timeout = 10_000 } = {}) {
  await openAppMenu(page, { within, timeout });
  await at(page, within, `[data-testid="app-menu-scheme-${value}"]`).click({ timeout });
  await closeAppMenu(page, { within });
}

/**
 * Open the inbox (if it is not open already) on a tab — "for-you",
 * "activity" or "asks" — and wait for what that tab holds. The bell is drawn
 * only when there is anything, so this waits for it first.
 */
export async function openInboxTab(page, tab = "activity", { within, timeout = 10_000 } = {}) {
  if ((await at(page, within, '[data-testid="inbox"]').count()) === 0) await at(page, within, '[data-testid="inbox-button"]').click({ timeout });
  const chosen = at(page, within, `[data-testid="inbox-tab-${tab}"]`);
  await chosen.waitFor({ state: "visible", timeout });
  if ((await chosen.getAttribute("aria-selected")) !== "true") await chosen.click({ timeout });
  await at(page, within, `[data-testid="inbox-panel-${tab}"]`).waitFor({ state: "visible", timeout });
}

/** Open the inbox on Activity and wait for its feed (`[data-testid="activity"]`). */
export async function openActivity(page, options = {}) {
  await openInboxTab(page, "activity", options);
  await at(page, options.within, '[data-testid="activity"]').waitFor({ state: "attached", timeout: options.timeout ?? 10_000 });
}

/** Open the inbox on what needs you and wait for the rules broken, in words, under it (`[data-testid="problems"]`). */
export async function openProblems(page, options = {}) {
  await openInboxTab(page, "for-you", options);
  await at(page, options.within, '[data-testid="problems"] li').first().waitFor({ state: "attached", timeout: options.timeout ?? 10_000 });
}

/** Put the inbox away, by its own bell, where it is open. */
export async function closeInbox(page, { within } = {}) {
  if ((await at(page, within, '[data-testid="inbox"]').count()) === 0) return;
  await at(page, within, '[data-testid="inbox-button"]').click();
}
