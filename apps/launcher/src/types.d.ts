/**
 * The apps' UI entry points, resolved by a Vite alias rather than by a
 * package export — see `vite.config.ts`. Declared here so the launcher
 * typechecks without widening what an app package means.
 */
declare module "the household example/ui" {
  export const HouseholdApp: (props: Record<string, unknown>) => import("react").ReactElement;
}
declare module "the bid-desk example/ui" {
  export const BidDeskApp: (props: Record<string, unknown>) => import("react").ReactElement;
}
declare module "the coaching example/ui" {
  export const CoachingApp: (props: Record<string, unknown>) => import("react").ReactElement;
}
