export { createPageRegistry, kindOfSlug, pluralSlug, recordPath, spatialHref } from "./registry.js";
export type { PageRegistry, PageRegistration, PageType, SurfaceType } from "./registry.js";
export { recordFacts } from "./facts.js";
export type { RecordFacts, RecordLinkGroup, FactsOptions } from "./facts.js";
export { DerivedForm } from "./form.js";
export type { DerivedFormProps } from "./form.js";
export {
  DefaultHomePage,
  DefaultListPage,
  DefaultProblemsPage,
  DefaultRecordPage,
  DefaultShell,
  StartFreshLink,
  useStoreTick,
  pageStyles,
  PageMain,
  Repairs,
} from "./pages.js";
export type { PageContext } from "./pages.js";
export { PagesApp, PagesRoutes } from "./router.js";
export type { PagesAppProps, PageComponent } from "./router.js";
