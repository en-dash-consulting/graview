# @graview/react

`@graview/react` is one of the 14 npm packages of Graview, a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration. The React binding: a provider, a scene, and the hooks an app builds on.

```sh
pnpm add @graview/react
```

Entry points: `@graview/react`, `@graview/react/provider`, `@graview/react/drawing`

## What it is

The binding. A provider, a scene, and the hooks an app builds on.

A view is an ORDINARY React component. No scene API, no base class — that is the whole authoring surface, and it is the reason the capture approach earns its cost. Every view must render correctly in both modes: captured into the scene, and lifted out as a full page.

```tsx
<GraviewProvider store={store} views={views} brand={brand} principal={me}>
  <Scene />
  <JackedIn />
</GraviewProvider>
```

The provider holds the store, the view registry, the current view, the selection, the activity and the principal — together, so the scene, the chrome and an agent seat are looking at the same thing rather than at three copies of it.

A part fetched only when it is first drawn is a `lazyModule` over `retryingImport(() => import("./part.js"))` (from `@graview/core/retry`), drawn with its `part(draw, { what })`. Until it arrives, its place says so in one line with a "Try again" button (`lazy-part-missing`, `lazy-part-retry`) rather than throwing; it is asked for again when the browser is back online, when it is drawn again, on `prefetch()`, and when the button is pressed (`retryLazyParts`). Every part the framework fetches as it is drawn — the person's menu, the problems' rows, the faces, the views and lenses, the studio, the assistant — is one.

## What it exports (154)

Read off the package's own barrel, so this is what is there today.

`ACTIVITY_HOLD_MS`, `adjustment`, `afterFirstDraw`, `altitudeOpacity`, `anchorOf`, `applySettings`, `AUDIENCE_ROW`, `bandRows`, `BesideTheMap`, `bleeds`, `BLEEDS`, `channelRoute`, `clipPolyline`, `clipQuadratic`, `connectorStrands`, `createAiDesk`, `createMotionStore`, `createPointerStore`, `createSeatTalk`, `createViews`, `DEFAULT_VIEW`, `DefaultDrawnElsewhere`, `districtOf`, `ErrorReportContext`, `Figure`, `firstDrawn`, `foldRobots`, `GoToContext`, `GraviewProvider`, `hasLanded`, `HEARTBEAT_MS`, `honorSetting`, `HostFilesContext`, `inTopLayer`, `isDefaultView`, `KeptViewsProvider`, `kitConnector`, `landingIn`, `latticePoints`, `layerViews`, `lazyModule`, `loadSetting`, `mapChoice`, `markActivity`, `markBleeds`, `markDefaultView`, `markLanded`, `markPreviews`, `markReplacesPage`, `matchWith`, `MenuSections`, `NOTHING_FOUND`, `Occupants`, `onScreen`, `openingView`, `orthogonalPoints`, `PageDoor`, `PageDoorContext`, `partArriving`, `participantOf`, `partsArriving`, `PersonFigure`, `pickedFrom`, `PLACE_MENU_EVENT`, `placeDrawn`, `placeOthers`, `placePane`, `placeWatched`, `PlaybackContext`, `polylineD`, `POPOVER_STYLE`, `POPOVERS`, `prepareAffordances`, `PRESENCE_SETTINGS`, `previewOf`, `PREVIEWS`, `raiseOverPopovers`, `rememberSetting`, `REPLACES_PAGE`, `replacesPage`, `ResolvedView`, `retryLazyParts`, `RIBBON_WIDTH`, `ribbonSentence`, `ribbonsOf`, `ribbonWidth`, `ROBOT_REST_MS`, `roundedPolylineD`, `routedQuadratic`, `routePoint`, `Scene`, `ScenePreviewing`, `SeatMarks`, `seatTalkKey`, `selectionFor`, `SHARE_OVER`, `SHARE_WHERE`, `stackOpacity`, `standingFor`, `tabSession`, `tieRoute`, `UrlSync`, `useActivity`, `useAffordances`, `useAiDeskState`, `useAnimatedLayout`, `useApplyAffordance`, `useAttention`, `useBacktrack`, `useDrawnSize`, `useEditableFields`, `useFlagged`, `useFound`, `useGoTo`, `useGraph`, `useGraview`, `useGraviewIfAny`, `useHostFiles`, `useImplicated`, `useJackIn`, `useKit`, `useLiveStore`, `useLocalIntelligence`, `useMarqueeRoom`, `useMenuPrepare`, `useMenuSections`, `useNavigation`, `useNode`, `useOwnPlayback`, `usePlayback`, `usePopover`, `usePresenceState`, `useReached`, `useRobots`, `useScenePointer`, `useSceneStill`, `useSeatTalkState`, `useSeatWork`, `useSelection`, `useTextMeasure`, `useTheKeyboardLandsSomewhere`, `useTheWatchKnowsWhatIsUnseen`, `useTidiedViews`, `useTopLayer`, `useTouched`, `useUrlSync`, `useViewMode`, `useViolations`, `useWhereIs`, `ViewBoundary`, `ViewContentHeight`, `ViewModeProvider`, `VISIT_EACH_UP_TO`, `whereIsIn`

---

The React binding: a provider, a scene, and the hooks an app builds on.

The page: https://graview.dev/docs/packages/react.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
