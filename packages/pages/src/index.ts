export { createPageRegistry, kindOfSlug, placeHref, placePath, pluralSlug, recordPath, spatialHref } from "./registry.js";
export type { RouteRegistration } from "./registry.js";
export type { PageRegistry, PageRegistration, PageType, ShellComponent, ShellOptions, SurfaceType } from "./registry.js";
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
  pathOfPlace,
  PlacePicture,
  KindMapSection,
  DefaultProblemsPage,
  DefaultRecordPage,
  DefaultSearchPage,
  DefaultShell,
  PageFind,
  SearchToCreate,
  beginningsFor,
  beginningsFrom,
  WhyLine,
  StartFreshLink,
  OverviewLink,
  useStoreTick,
  pageStyles,
  PageMain,
  Repairs,
} from "./pages.js";
export type { PageContext, GalleryEntry, Beginning } from "./pages.js";
export { PageAsk } from "./ask.js";
export { lastChangeOf, PageUndo } from "./face-controls.js";
export type { FaceControl, LastChange } from "./face-controls.js";
export { PagesApp, PagesRoutes } from "./router.js";
export type { NavigationHow, PagesAppProps, PagesSteering, PageComponent } from "./router.js";
