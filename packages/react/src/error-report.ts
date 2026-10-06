import { createContext } from "react";

/**
 * WHERE A CAUGHT ERROR IS TOLD, beside the console (FR-24). A host that
 * embeds an app observes its failures without reading what was on screen:
 * a boundary tells this the error and the framework module it was caught
 * in, and the host decides what of the error to keep.
 *
 * A file of its own: the frame provides the report before anything draws,
 * and the boundary that tells it is drawn only with a view.
 */
export type ErrorReport = (error: unknown, where: { readonly module: string }) => void;

/** The report every boundary under it tells. Null outside any: the console alone. */
export const ErrorReportContext = createContext<ErrorReport | null>(null);
