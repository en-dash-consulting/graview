import type { ResolveApp } from "@graview/core";
import { createContext } from "react";

/*
 * THE SHELL'S OWN WAY TO NAME ANOTHER APP (FR-171). A host that draws the
 * Shell hands it `resolveApp` as it hands it `files`, rather than wrapping
 * the provider to reach it; an app-link drawn under the Shell asks this
 * first and the provider's after. Its own module, so a page that draws no
 * Shell and no app-link carries none of it.
 */
export const ResolveAppContext = /* @__PURE__ */ createContext<ResolveApp | undefined>(undefined);
