import { createContext } from "react";

/**
 * WHERE A HOME'S VIEW THAT STOPPED FALLS BACK TO (Roadmap
 * f-view-budget-fair-to-visitors). A host's view that is the home's body,
 * on an app that declares no home of its own, had nothing to stand in its
 * place, so the host listed every record under a sentence. The face that
 * draws the home provides this: told the view's name and why it stopped,
 * it draws the app's built-in home there instead — the page
 * `?drawn=built-in` shows. Null where no face offers one.
 */
export const HomeFallsBack = createContext<((name: string, reason: string) => void) | null>(null);
