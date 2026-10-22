import { createContext } from "react";

/**
 * WHERE A VIEW'S CONTENT HEIGHT IS TOLD (Roadmap f-view-content-height).
 *
 * A face that holds a view to a box — the Scene's preview of a place —
 * provides this, and the host that draws the view tells it how tall what
 * the view drew is, each time that changes, measured on the drawn root
 * (`mountWorkerView`'s `onContentHeight`). The view itself never says.
 * `undefined` is "not measured": drawn as it lays out.
 */
export const ViewContentHeight = createContext<((height: number | undefined) => void) | null>(null);

/**
 * WHERE A PAGE IS, FROM THE SCENE (Roadmap f-view-content-height): the
 * routed face's own way to one of its pages, given by a host that draws
 * both faces (`@graview/embed`). `open` goes there as the bar's places do;
 * `href` is the page's address, where the host's page has one. Not given,
 * the Scene has no pages to send a reader to, and offers none.
 */
export interface PageDoor {
  open(path: string): void;
  href?(path: string): string | undefined;
}

export const PageDoorContext = createContext<PageDoor | null>(null);
