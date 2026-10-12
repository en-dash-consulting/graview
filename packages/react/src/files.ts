import type { HostFiles } from "@graview/core";
import { createContext, useContext } from "react";

/**
 * THE HOST'S FILES (FR-163), where a file field's editor finds them: set by
 * `GraviewProvider`, the Shell and the routed face from the `files` a host
 * handed `mount` or `<Embed>`. Unset, the editor says this host takes no
 * files and offers nothing it would refuse.
 */
export const HostFilesContext = createContext<HostFiles | undefined>(undefined);

/** The host's files, or undefined where it takes none. */
export const useHostFiles = (): HostFiles | undefined => useContext(HostFilesContext);
