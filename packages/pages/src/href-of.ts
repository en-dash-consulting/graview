import { createContext } from "react";

/**
 * Where a view's link goes on the host's page (`PagesAppProps.hrefOf`): the
 * host's own address for a path, `false` where a path of the face is no page
 * of the host's (memory routing), and the face's own address when not said.
 * Apart from the router so the context menu reads it without importing it.
 */
export const HrefOfContext = createContext<((path: string) => string | undefined) | false | undefined>(undefined);
