import { createContext, useContext } from "react";

/**
 * THE ONE FACE, AS THE PAGES REACH IT (`one-place.tsx`). Where the Scene's
 * city stands under the pages there is no second face to switch to: "show
 * this in the city" is the camera rising from the page, and the way to the
 * overview is the city itself. The pages' links and menus that used to send
 * a person to the Scene's own address ask this instead. Null on a face that
 * draws no city under its pages, and they do what they did.
 */
export interface OneFace {
  /** The level the camera rests at or is headed for: 0 the page, 1 beside the city, 2 the city. */
  readonly level: number;
  /** Move to a level, the page this address is. */
  readonly goLevel: (level: number) => void;
  /** A record's page (or a path on this face), at a level: the camera flies there. */
  readonly openRecord: (id: string, level: number) => void;
  readonly openPath: (path: string, level: number) => void;
  /**
   * WHERE THE APP'S BAR STANDS: fixed at the window's top at every level,
   * outside the page that moves — so the app's name and menu, Find, the
   * inbox, the standing and the person are there and work over the city as
   * over the page. The shell draws its bar here, and keeps its room.
   */
  readonly bar: HTMLElement | null;
}

export const OneFaceContext = createContext<OneFace | null>(null);

/** The one face, where the city stands under the pages; null where it does not. */
export const useOneFace = (): OneFace | null => useContext(OneFaceContext);
