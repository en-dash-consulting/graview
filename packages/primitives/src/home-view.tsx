import type { AnySchema } from "@graview/core";
import type { ViewComponent, ViewProps } from "@graview/react/provider";
import { compileBlocks, SpecPlace } from "./spec-views.js";

/**
 * THE HOME'S OWN VIEW (FR-81): the declaration's home blocks, about no one
 * record. On the routed face it is the page, so its first headline is the
 * page's heading; on the scene it is a panel over the city, a level down.
 * Made once per list of blocks.
 */
const MADE = new WeakMap<readonly unknown[], ViewComponent<AnySchema>>();

export function homeView(blocks: readonly unknown[]): ViewComponent<AnySchema> {
  let view = MADE.get(blocks);
  if (!view) {
    const compiled = compileBlocks(blocks);
    view = (props: ViewProps<AnySchema>) =>
      props.mode === "fullscreen" ? <SpecPlace blocks={compiled} slot="home" heading={2} firstHeading={1} /> : <SpecPlace blocks={compiled} slot="home" heading={3} firstHeading={2} />;
    MADE.set(blocks, view);
  }
  return view;
}
