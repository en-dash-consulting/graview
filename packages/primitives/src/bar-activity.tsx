import { barPanes } from "./bar-panes-door.js";

/**
 * WHAT HAS HAPPENED, ON A BAR THAT IS NOT THE SCENE'S (FR-152): the routed
 * face's. The scene draws Activity in the bar's place for the face's own
 * tool; on Pages, once the notice that offered a change back had gone, a
 * person with a mouse had no way to the change at all. The same list and
 * the same way back for each change, fetched with the bar's panes, so a
 * face that draws it before anything has happened carries none of it.
 */
export const BarActivity = barPanes.part((panes) => <panes.ActivityRail calls={[]} />, { quiet: true });
