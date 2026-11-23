import type { AppVideo, HostFiles, ViewerState } from "@graview/core";
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

/** Where a worker view's `graview.mine` is kept (the host's `viewerState`). Without one, for the visit. */
export const HostViewerStateContext = createContext<ViewerState | undefined>(undefined);
export const useHostViewerState = (): ViewerState | undefined => useContext(HostViewerStateContext);

/**
 * THE APP'S OWN VIDEO (HQ f-view-names-app-video): the reel a host keeps for
 * the whole app, set by `GraviewProvider`, the Shell and the routed face
 * from the `reel` a host handed `mount` or `<Embed>`. A worker view plays it
 * with `<graview-video data-app="reel">`. Unset, the app has no reel.
 */
export const HostReelContext = createContext<AppVideo | undefined>(undefined);
export const useHostReel = (): AppVideo | undefined => useContext(HostReelContext);
