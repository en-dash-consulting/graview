import { createContext } from "react";

/**
 * WHAT A DECLARED LENS IS TOLD OF THE PLACE IT DRAWS (Roadmap
 * f-view-export-csv): its title and address word, which "Export CSV" names
 * the file by and the place menu asks by, and whether it offers the export
 * at all. A lens drawn by an app's own code, outside a declaration, is told
 * nothing, and offers the export under its kind's plural. The lenses' own,
 * so a page that draws none carries none of it.
 */
export interface PlaceExport {
  readonly title: string;
  readonly as: string;
  /** `false`: the declaration offers nobody "Export CSV" here. */
  readonly export?: false;
}

export const PlaceExportContext = createContext<PlaceExport | null>(null);
