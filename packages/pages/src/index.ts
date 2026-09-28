export { createPageRegistry, kindOfSlug, placeHref, placePath, pluralSlug, recordPath, spatialHref } from "./registry.js";
export type { RouteRegistration } from "./registry.js";
export type { PageRegistry, PageRegistration, PageType, SurfaceType } from "./registry.js";
export { kindFacts, kindMap, rankedRepairs, recordFacts } from "./facts.js";
export type { KindFacts, KindMap, KindRelation, RecordFacts, RecordLinkGroup, FactsOptions } from "./facts.js";
export { DerivedForm } from "./form.js";
export type { DerivedFormProps } from "./form.js";
export {
  DefaultHomePage,
  DefaultListPage,
  DefaultMapPage,
  DefaultPlacePage,
  DefaultPlacesPage,
  PlaceCard,
  Gallery,
  GalleryCard,
  galleryOf,
  PlacePicture,
  KindMapSection,
  DefaultProblemsPage,
  DefaultRecordPage,
  DefaultSearchPage,
  DefaultShell,
  PageFind,
  SearchToCreate,
  beginningsFor,
  WhyLine,
  StartFreshLink,
  useStoreTick,
  pageStyles,
  PageMain,
  Repairs,
} from "./pages.js";
export type { PageContext, GalleryEntry, Beginning } from "./pages.js";
export { PageAsk } from "./ask.js";
export { PagesApp, PagesRoutes } from "./router.js";
export type { PagesAppProps, PageComponent } from "./router.js";
