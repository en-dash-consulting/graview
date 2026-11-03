import { act } from "react";

/**
 * THE SCENE AND THE PAGES ARE THE APP MENU'S ROWS (Roadmap f-app-bar-calm).
 * The bar holds the menu's control beside the app's name; the rows are
 * fetched when it first opens and drawn only while it is open. These open
 * it as a person does and wait for its rows before reading or pressing one.
 */

async function tick(): Promise<void> {
  await act(async () => new Promise((wait) => setTimeout(wait, 10)));
}

/** Opens the app menu on `root`'s bar and waits until its rows are drawn. */
export async function openAppMenu(root: ParentNode, within = 10_000): Promise<HTMLElement> {
  const button = root.querySelector<HTMLButtonElement>('[data-testid="app-menu-open"]');
  if (!button) throw new Error("the bar holds no app menu");
  if (button.getAttribute("aria-expanded") !== "true") await act(async () => button.click());
  const menu = () => root.querySelector<HTMLElement>('[data-testid="app-menu"]');
  for (const end = Date.now() + within; !(menu()?.childElementCount ?? 0); ) {
    if (Date.now() > end) throw new Error("the app menu drew no rows");
    await tick();
  }
  return menu()!;
}

/** Closes the app menu if it is open. */
export async function closeAppMenu(root: ParentNode): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>('[data-testid="app-menu-open"]');
  if (button?.getAttribute("aria-expanded") === "true") await act(async () => button.click());
}

/** Presses the app menu's Scene or Pages, as a person does: the menu opened, then the row. */
export async function pressFace(root: ParentNode, which: "scene" | "pages"): Promise<void> {
  const menu = await openAppMenu(root);
  const row = menu.querySelector<HTMLButtonElement>(`[data-testid="app-face-${which}"]`);
  if (!row) throw new Error(`the app menu holds no ${which}`);
  await act(async () => {
    row.click();
    await new Promise((wait) => setTimeout(wait, 30));
  });
}

/** Whether the app menu says this face is the one drawn: its row's aria-pressed, read with the menu open and closed again. Null where the menu holds no faces. */
export async function facePressed(root: ParentNode, which: "scene" | "pages"): Promise<string | null> {
  if (!root.querySelector('[data-testid="app-menu-open"]')) return null;
  const menu = await openAppMenu(root);
  const pressed = menu.querySelector(`[data-testid="app-face-${which}"]`)?.getAttribute("aria-pressed") ?? null;
  await closeAppMenu(root);
  return pressed;
}
