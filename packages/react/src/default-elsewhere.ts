import { createContext } from "react";

/**
 * WHERE THE FRAMEWORK'S OWN VIEW OF A CELL IS ALREADY DRAWN (FR-36, FR-149).
 *
 * The pages face's record page IS the framework's own record — its facts,
 * its links, what can be done — so a view that draws the default beside
 * what it adds (a spec's `page`, a worker view of one record) draws only
 * what it adds there. True inside such a surface; `DefaultViewElsewhere`
 * (`@graview/primitives`) provides it.
 */
export const DefaultDrawnElsewhere = createContext(false);
