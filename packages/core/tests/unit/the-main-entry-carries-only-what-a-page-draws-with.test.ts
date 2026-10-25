import { describe, expect, it } from "vitest";
import * as arrange from "../../src/arrange.js";
import * as blocks from "../../src/blocks.js";
import * as catalog from "../../src/catalog.js";
import * as city from "../../src/city.js";
import * as csv from "../../src/csv.js";
import * as shown from "../../src/shown.js";
import * as check from "../../src/check.js";
import * as describePlaces from "../../src/describe.js";
import * as document from "../../src/document/index.js";
import * as figures from "../../src/figures.js";
import * as fieldSight from "../../src/field-sight.js";
import * as forms from "../../src/forms.js";
import * as history from "../../src/history.js";
import * as jobs from "../../src/jobs.js";
import * as past from "../../src/past.js";
import * as importing from "../../src/import/index.js";
import * as jsonSchema from "../../src/json-schema.js";
import * as main from "../../src/index.js";
import * as provenance from "../../src/provenance.js";
import * as linked from "../../src/linked.js";
import * as scene from "../../src/scene.js";
import * as search from "../../src/search.js";
import * as seat from "../../src/seat.js";
import * as subscriptions from "../../src/subscriptions.js";
import * as words from "../../src/words.js";
import * as markdown from "../../src/markdown.js";
import * as navigate from "../../src/navigate.js";
import * as tidying from "../../src/tidying.js";

/*
 * THE MAIN ENTRY CARRIES ONLY WHAT A PAGE DRAWS WITH. A hosted page imports
 * `@graview/core` and `@graview/core/document` up front, and a bundler
 * places a whole module in every chunk that can reach it — so a name a
 * barrel re-exports rides in the page's first chunk as soon as any lazily
 * fetched face uses it, though the page never calls it before a reader acts.
 * What only a fetched face, an agent's seat or the checker uses lives on a
 * subpath named for what it holds, and this list keeps it there: a name
 * that drifts back to a barrel is a name every hosted page pays for again.
 */
const OFF_THE_PAGE = {
  "@graview/core/arrange": { from: arrange, names: ["admitArrangement", "arrange", "arrangeable", "arrangeAllows", "asksForThePast", "bucketStart", "conditionHolds", "edgesOf", "formatArrangement", "matches", "NO_ARRANGEMENT", "parseArrangement", "throughEdges", "kindListFindings", "listFieldsOf", "listGroup", "listOpening", "listSort", "orderListGroups", "withWorkedOut"] },
  // Roadmap f-view-export-csv: a kind's list as its page shows it, which "Export CSV" writes — the list page's alone.
  "@graview/core/shown": { from: shown, names: ["shownList"] },
  // Roadmap f-view-export-csv: a place's list written as a spreadsheet, fetched when somebody presses "Export CSV".
  "@graview/core/csv": { from: csv, names: ["CSV_BOM", "csvCell", "csvFileName", "csvSafe", "listCsv", "listCsvRows", "saveShownList", "switchExport", "toCsv"] },
  // Roadmap f-navigate-filters: where a view's navigate goes, as an address — the worker view's host and the routed face's alone.
  "@graview/core/navigate": { from: navigate, names: ["narrowedPath", "sectionSlug"] },
  // Roadmap f-playback: the timeline around the past, fetched with it when somebody opens the past.
  "@graview/core/history": { from: history, names: ["declarationSentence", "historyInWords", "makerOf", "makerWords", "restoreBatches", "ticksOf", "typedCounts", "typedRun", "typedSpans", "typingSentence", "typingWords", "unpublished"] },
  // Roadmap f-playback: the past itself — the fold, its kept points and the store it makes — fetched by the provider when somebody first asks to see it.
  "@graview/core/past": { from: past, names: ["askArchived", "askDeclaration", "declarationAt", "keptOf", "pastAt", "pastOf", "seqAt"] },
  "@graview/core/provenance": { from: provenance, names: ["isProvisional", "lineageWords", "linkKey", "linkProvenance", "linkProvenances", "provenanceWords", "provisionalLinks"] },
  // FR-171: another app's records, read as the viewer — the in-memory host, a page's reads, a far change kept in the history.
  "@graview/core/linked": { from: linked, names: ["linkedChange", "linkedRecordsOver", "linkedRelationWords", "readLinkedRecord", "recordLinkedChange", "recordsLinking"] },
  "@graview/core/blocks": { from: blocks, names: ["compileBlocks", "fieldSpecsOf", "isTallBlock", "resolveBlocks", "safeHref", "sayNumber", "whatBlocksSay", "blocksName", "computedNames", "computedValues", "withComputed", "factNames", "factValues", "blockContextFor", "CARD_BUDGET", "PAGE_BUDGET", "fieldSpecOf", "fileFieldsOf", "fileWords", "firstPicture", "videoClock"] },
  "@graview/core/field-sight": { from: fieldSight, names: ["fieldsKept", "keptFrom", "partialKinds", "withoutKeptFields"] },
  "@graview/core/forms": { from: forms, names: ["askedFormFields", "changedArgs", "editStart", "formArgs", "formComplete", "formField", "formFields", "keptArguments", "undecidableArguments", "VISITOR_ROLE", "formReceived", "formVisitor", "pickersIn", "visitorForm", "visitorSeesKind"] },
  "@graview/core/import": { from: importing, names: ["coerceCell", "ImportMappingError", "importRows", "parseCsv", "previewImport", "proposeMapping", "readBoolean", "readDateTime", "readDay", "readNumber", "readOption"] },
  "@graview/core/describe": { from: describePlaces, names: ["columnActs", "columnChoices", "columnMoves", "columnOf", "columnReach", "columnSteps", "describePlace", "placeText", "resolveFor", "shadowedPageSlots", "statusColumns"] },
  "@graview/core/check": { from: check, names: ["arrangementFindings", "checkApp", "formatFindings", "compileDocument", "instantiateTemplate", "describeApp", "generateAgentsMd", "generateLlmsTxt", "clockReaders", "designFindings"] },
  "@graview/core/scene": { from: scene, names: ["BLOCK", "cityExtent", "cityMap", "districtBlocks", "districtState", "heightOf", "MAX_SIDE", "plotsOverlap", "roadsOf", "sharedEdges", "sideFor", "TIER_HEIGHT", "TILTED", "toIso", "TOP_DOWN", "villageCap", "villageOf", "sceneDistricts", "sceneThumbnail"] },
  // The map alone, laid out before the scene draws; what stands on the ground is /scene's, fetched with the ground.
  "@graview/core/city": { from: city, names: ["BLOCK", "cityExtent", "cityMap", "districtState", "MAX_SIDE", "PITCH", "plotsOverlap", "sharedEdges", "sideFor", "TILTED", "toIso", "TOP_DOWN"] },
  "@graview/core/figures": { from: figures, names: ["FIGURES", "FIGURE_NAMES", "figureBrief", "figureFaults", "figureSvg"] },
  "@graview/core/json-schema": { from: jsonSchema, names: ["argumentsNeverShown", "mutationToolSchema", "nodeJsonSchema", "schemaJson", "toJsonSchema"] },
  // FR-179: the matcher, a record and an argument said in words, and what the seat and the seeding read.
  "@graview/core/search": { from: search, names: ["MATCHED_MOST", "NEAR_BELOW", "actsOn", "describeSearched", "fold", "fragmentOf", "matchNode", "parseQuery", "search", "searchableFields", "slipsBetween", "squeeze", "stemOf", "strengthOf", "touchWeights"] },
  "@graview/core/words": { from: words, names: ["argShape", "argumentWords", "describeArg", "describeNode", "excerptOf", "failureWords", "isLongText", "isMarkdownField", "pageSections", "readableFields", "repeatAsRead", "repeatingDateAsRead", "tellApart", "viaSaid", "fieldSays", "mapsHref", "parseDuration", "sayDuration", "sayPhone", "telHref", "typedHref", "typedWords", "typedFieldOf", "edgeWords", "valueWords", "amountBox", "amountInBox", "readAmount", "endAfterStartMoved", "namesInstant", "readWhenTyped", "startAndEndOf", "storedOfWall", "wallNow", "wallOfStored", "zoneSaid", "capitalize", "lowerFirst"] },
  // FR-180: Markdown read into blocks, fetched with the first a page draws.
  "@graview/core/markdown": { from: markdown, names: ["escapeHtml", "headingLevel", "inlineOf", "markdownBlocks", "markdownHtml", "safeHref"] },
  "@graview/core/seat": { from: seat, names: ["answerSeenBy", "archivedSeenBy", "archiveFrom", "beginning", "placesFrom", "placesOf", "viewPlaceOf"] },
  // Roadmap f-ai-candidate-catalog: what the inline AI may pick from, the state a model reads and what an interaction leaves behind, fetched when somebody first opens it.
  // Roadmap f-notify-subscriptions: what a person asked to be told of, matched against a commit under their sight — the host's and a sheet's, fetched when somebody first subscribes.
  "@graview/core/subscriptions": { from: subscriptions, names: ["holdTypingRuns", "matchSubscriptions", "subscriptionProblem", "subscriptionWords", "TYPING_QUIET_MS", "watchSubscriptions"] },
  // Roadmap f-app-jobs: an app's jobs resolved and answered as a seat sees it — a design's, a seat's and a host's, fetched when one is drawn.
  "@graview/core/jobs": { from: jobs, names: ["answerJob", "jobIsFor", "jobsFor", "jobsOf", "MOST_JOBS"] },
  "@graview/core/catalog": { from: catalog, names: ["aiContextOf", "aiTargetOf", "catalogOf", "existingViewsOf", "interactionBy", "interactionCost", "interactionTouches", "mergeInteractions", "recordsOfTarget", "schemaDigestOf"] },
  // The app's own actor's suggestions — made, accepted, declined — and what reads it back: the suggestions and declines in a store or a log, what the declaration lets it tidy, and Activity's digest.
  "@graview/core/tidying": {
    from: tidying,
    names: ["acceptSuggestion", "declined", "declinedIn", "declineSuggestion", "declinesIn", "digestWords", "foldDigests", "isDismissed", "isSuggestionBatch", "LEFT_ALONE", "meaningKey", "suggest", "suggestionKey", "suggestions", "suggestionsIn", "tidyingOf", "tidyingRefusal", "typedRowWords"],
  },
} as const;

describe("the entries a hosted page imports up front", () => {
  for (const [subpath, { from, names }] of Object.entries(OFF_THE_PAGE)) {
    it(`leave what ${subpath} holds to ${subpath}: neither @graview/core nor @graview/core/document exports it`, () => {
      expect(Object.keys(from).sort()).toEqual([...names].sort());
      expect(names.filter((name) => name in main)).toEqual([]);
      expect(names.filter((name) => name in document)).toEqual([]);
    });
  }

  it("leave the past's fold and the suggestions' bookkeeping off the store: a class is carried whole, so they are functions of their own entries", () => {
    const methods = Object.getOwnPropertyNames(main.Store.prototype);
    expect(["at", "seqAt", "suggest", "suggestions", "acceptSuggestion", "declineSuggestion", "declined"].filter((name) => methods.includes(name))).toEqual([]);
  });

  it("still compile a document without the checker: compileDocumentWithoutCheck is the document entry's", () => {
    expect(typeof document.compileDocumentWithoutCheck).toBe("function");
  });
});
