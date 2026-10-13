import { createContext } from "react";

/**
 * WHETHER A PANEL BESIDE THE MAP LISTS A DISTRICT (`MapPanel` in
 * `@graview/primitives`).
 *
 * The faces that draw the panel — the whole-page Shell and an embed's scene
 * face — say so around the picture, and opening a district from altitude,
 * by its "open" or by a double-click on a district with no picture of its
 * own, then chooses the district, whose records the panel lists at a size a
 * person reads. A scene drawn without the panel (the studio's, a product's
 * own) keeps opening a district in place, as a card of its records.
 */
export const BesideTheMap = createContext(false);
