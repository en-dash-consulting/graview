import { act } from "react";
import { ONE_FACE_ARRIVING } from "../../src/index.js";

/**
 * THE ROUTED FACE IS THE ONE FACE (Graview HQ feature:f-one-face-by-default):
 * a `PagesApp` handed `views` draws its page over the Scene's own city
 * unless its host says `sceneUnderPages: false`. The city's part is fetched
 * after the page's first draw, and the page moves into it once it comes. A
 * test that holds a claim about the page waits for that, and reads the page
 * alone: the city under it draws each view on its district too, out of
 * sight (`visibility: hidden`) while the page is read, which jsdom does not
 * know to leave out.
 */
export async function theOneFaceHasCome(host: Element): Promise<void> {
  for (let turn = 0; turn < 400; turn += 1) {
    if (host.querySelector("[data-graview-one-place]") && !document.documentElement.hasAttribute(ONE_FACE_ARRIVING)) break;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The page the person reads on the one face — not the city under it — or `host` on a face without the city. */
export function thePageIn(host: Element): Element {
  return host.querySelector("[data-graview-one-face-page]") ?? host;
}
