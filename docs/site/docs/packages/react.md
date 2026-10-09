# @graview/react

`@graview/react` is one of the 14 npm packages of Graview, a TypeScript framework for agent-native apps built as isometric scenes. The React binding: a provider, a scene, and the hooks an app builds on.

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

## What it exports (113)

Read off the package's own barrel, so this is what is there today.

`ACTIVITY_HOLD_MS`, `adjustment`, `altitudeOpacity`, `anchorOf`, `applySettings`, `AUDIENCE_ROW`, `bandRows`, `channelRoute`, `clipPolyline`, `clipQuadratic`, `connectorStrands`, `createMotionStore`, `createPointerStore`, `createSeatTalk`, `createViews`, `DEFAULT_VIEW`, `DefaultDrawnElsewhere`, `ErrorReportContext`, `Figure`, `foldRobots`, `GoToContext`, `GraviewProvider`, `HEARTBEAT_MS`, `honorSetting`, `inTopLayer`, `isDefaultView`, `kitConnector`, `landingIn`, `latticePoints`, `layerViews`, `lazyModule`, `loadSetting`, `markActivity`, `markDefaultView`, `markReplacesPage`, `NOTHING_FOUND`, `Occupants`, `onScreen`, `openingView`, `orthogonalPoints`, `participantOf`, `PersonFigure`, `placeOthers`, `placePane`, `polylineD`, `POPOVER_STYLE`, `POPOVERS`, `PRESENCE_SETTINGS`, `raiseOverPopovers`, `rememberSetting`, `REPLACES_PAGE`, `replacesPage`, `ResolvedView`, `retryLazyParts`, `ROBOT_REST_MS`, `roundedPolylineD`, `routedQuadratic`, `routePoint`, `Scene`, `SeatMarks`, `seatTalkKey`, `selectionFor`, `SHARE_OVER`, `SHARE_WHERE`, `stackOpacity`, `standingFor`, `tabSession`, `tieRoute`, `UrlSync`, `useActivity`, `useAffordances`, `useAnimatedLayout`, `useApplyAffordance`, `useAttention`, `useBacktrack`, `useDrawnSize`, `useEditableFields`, `useFlagged`, `useFound`, `useGoTo`, `useGraph`, `useGraview`, `useGraviewIfAny`, `useImplicated`, `useJackIn`, `useKit`, `useLocalIntelligence`, `useMarqueeRoom`, `useNavigation`, `useNode`, `usePopover`, `usePresenceState`, `useReached`, `useRobots`, `useScenePointer`, `useSceneStill`, `useSeatDrawn`, `useSeatTalkState`, `useSeatWork`, `useSelection`, `useTextMeasure`, `useTheKeyboardLandsSomewhere`, `useTheWatchKnowsWhatIsUnseen`, `useTopLayer`, `useTouched`, `useUrlSync`, `useViewMode`, `useViolations`, `useWhereIs`, `ViewBoundary`, `ViewModeProvider`, `VISIT_EACH_UP_TO`, `whereIsIn`

---

The React binding: a provider, a scene, and the hooks an app builds on.

The page: https://graview.dev/docs/packages/react.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
