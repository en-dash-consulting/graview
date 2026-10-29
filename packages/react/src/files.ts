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

/**
 * WHERE THE HOST SERVES AN APP'S OWN IMAGES (Roadmap
 * f-brand-marks-under-app-base): `assetsAt(path)` for a path under
 * `/graview/assets/` — the brand's logo and page icon, the opening screen's
 * image, an image a script view draws by its path. Set by
 * `GraviewProvider`, the Shell and the routed face from the `assetsAt` a
 * host handed `mount` or `<Embed>`. Unset, every path is drawn as it is.
 */
export const HostAssetsContext = createContext<((path: string) => string) | undefined>(undefined);

/** Where the host serves an app's own images, or undefined where it serves them as their paths say. */
export const useHostAssets = (): ((path: string) => string) | undefined => useContext(HostAssetsContext);
