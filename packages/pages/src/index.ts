export { createPageRegistry, kindOfSlug, placeHref, placePath, pluralSlug, recordPath, spatialHref } from "./registry.js";
export type { RouteRegistration } from "./registry.js";
export type { PageRegistry, PageRegistration, PageSection, PageType, ShellComponent, ShellOptions, SurfaceType } from "./registry.js";
export { blankWritable, kindFacts, kindMap, rankedRepairs, recordFacts } from "./facts.js";
export type { KindFacts, KindMap, KindRelation, RecordFacts, RecordLinkGroup, FactsOptions } from "./facts.js";
// The facts as one sheet, each drawn and changed by its type, and what can be done beyond them (Roadmap f-facts-by-type).
export { FactSheet } from "./fact-sheet.js";
export type { FactSheetProps } from "./fact-sheet.js";
export { actsBeyondFacts, foldedActs, relationFacts, titleFieldOf } from "./fact-sheet-model.js";
export type { FoldOptions, RelationAct, RelationFact } from "./fact-sheet-model.js";
export { DerivedForm } from "./form.js";
export { RecordField } from "./record-field.js";
export type { RecordFieldProps } from "./record-field.js";
export type { DerivedFormProps } from "./form.js";
export {
  DefaultHomePage,
  ARRANGE_FROM,
  LARGE_LIST,
  ListPage,
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
  SceneLink,
  useStoreTick,
  pageStyles,
  PageMain,
  Repairs,
} from "./pages.js";
export type { PageContext, GalleryEntry, Beginning, ListPageProps, ListRowFacts } from "./pages.js";
export { PageQuickAsk } from "./quick-ask.js";
export { lastChangeOf, PageUndo } from "./face-controls.js";
export type { FaceControl, LastChange, UndoLook } from "./face-controls.js";
export type { ControlSize } from "./control-size.js";
export { PagesApp, PagesRoutes } from "./router.js";
export { PageTrail, placeHere, usePlaceHere } from "./place-here.js";
export type { PlaceHere, PlaceStep } from "./place-here.js";
export type { NavigationHow, PagesAppProps, PagesSteering, PageComponent } from "./router.js";
// What a design links, reads its address and moves with, from the router the face runs on — never the router package itself.
export { Link, MemoryRouter, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "./routing.js";
export type { LinkProps, NavLinkProps } from "./routing.js";
