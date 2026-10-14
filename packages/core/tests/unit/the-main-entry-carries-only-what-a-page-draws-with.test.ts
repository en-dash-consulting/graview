import { describe, expect, it } from "vitest";
import * as arrange from "../../src/arrange.js";
import * as blocks from "../../src/blocks.js";
import * as city from "../../src/city.js";
import * as check from "../../src/check.js";
import * as describePlaces from "../../src/describe.js";
import * as document from "../../src/document/index.js";
import * as figures from "../../src/figures.js";
import * as forms from "../../src/forms.js";
import * as importing from "../../src/import/index.js";
import * as jsonSchema from "../../src/json-schema.js";
import * as main from "../../src/index.js";
import * as provenance from "../../src/provenance.js";
import * as scene from "../../src/scene.js";
import * as search from "../../src/search.js";
import * as seat from "../../src/seat.js";
import * as words from "../../src/words.js";

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
  "@graview/core/arrange": { from: arrange, names: ["admitArrangement", "arrange", "arrangeable", "arrangeAllows", "asksForThePast", "bucketStart", "conditionHolds", "edgesOf", "formatArrangement", "matches", "NO_ARRANGEMENT", "parseArrangement", "throughEdges"] },
  "@graview/core/provenance": { from: provenance, names: ["isProvisional", "lineageWords", "linkKey", "linkProvenance", "linkProvenances", "provenanceWords", "provisionalLinks"] },
  "@graview/core/blocks": { from: blocks, names: ["compileBlocks", "fieldSpecsOf", "isTallBlock", "resolveBlocks", "safeHref", "sayNumber", "whatBlocksSay", "computedNames", "computedValues", "withComputed", "factNames", "factValues", "blockContextFor", "CARD_BUDGET", "PAGE_BUDGET", "fieldSpecOf", "fileFieldsOf", "fileWords", "firstPicture"] },
  "@graview/core/forms": { from: forms, names: ["formArgs", "formComplete", "formField", "formFields", "undecidableArguments"] },
  "@graview/core/import": { from: importing, names: ["coerceCell", "ImportMappingError", "importRows", "parseCsv", "previewImport", "proposeMapping", "readBoolean", "readDateTime", "readDay", "readNumber", "readOption"] },
  "@graview/core/describe": { from: describePlaces, names: ["columnActs", "columnMoves", "columnOf", "columnReach", "columnSteps", "describePlace", "placeText", "resolveFor", "statusColumns"] },
  "@graview/core/check": { from: check, names: ["arrangementFindings", "checkApp", "formatFindings", "compileDocument", "instantiateTemplate", "describeApp", "generateAgentsMd", "generateLlmsTxt", "clockReaders"] },
  "@graview/core/scene": { from: scene, names: ["BLOCK", "cityExtent", "cityMap", "districtBlocks", "districtState", "heightOf", "MAX_SIDE", "plotsOverlap", "roadsOf", "sharedEdges", "sideFor", "TIER_HEIGHT", "TILTED", "toIso", "TOP_DOWN", "villageCap", "villageOf", "sceneDistricts", "sceneThumbnail"] },
  // The map alone, laid out before the scene draws; what stands on the ground is /scene's, fetched with the ground.
  "@graview/core/city": { from: city, names: ["BLOCK", "cityExtent", "cityMap", "districtState", "MAX_SIDE", "PITCH", "plotsOverlap", "sharedEdges", "sideFor", "TILTED", "toIso", "TOP_DOWN"] },
  "@graview/core/figures": { from: figures, names: ["FIGURES", "FIGURE_NAMES", "figureBrief", "figureFaults", "figureSvg"] },
  "@graview/core/json-schema": { from: jsonSchema, names: ["mutationToolSchema", "nodeJsonSchema", "schemaJson", "toJsonSchema"] },
  // FR-179: the matcher, a record and an argument said in words, and what the seat and the seeding read.
  "@graview/core/search": { from: search, names: ["NEAR_BELOW", "actsOn", "describeSearched", "fold", "fragmentOf", "matchNode", "parseQuery", "search", "searchableFields", "slipsBetween", "squeeze", "stemOf", "strengthOf", "touchWeights"] },
  "@graview/core/words": { from: words, names: ["argShape", "argumentWords", "describeArg", "describeNode", "failureWords", "isLongText", "pageSections", "readableFields", "tellApart", "viaSaid"] },
  "@graview/core/seat": { from: seat, names: ["answerSeenBy", "beginning", "placesFrom", "placesOf"] },
} as const;

describe("the entries a hosted page imports up front", () => {
  for (const [subpath, { from, names }] of Object.entries(OFF_THE_PAGE)) {
    it(`leave what ${subpath} holds to ${subpath}: neither @graview/core nor @graview/core/document exports it`, () => {
      expect(Object.keys(from).sort()).toEqual([...names].sort());
      expect(names.filter((name) => name in main)).toEqual([]);
      expect(names.filter((name) => name in document)).toEqual([]);
    });
  }

  it("still compile a document without the checker: compileDocumentWithoutCheck is the document entry's", () => {
    expect(typeof document.compileDocumentWithoutCheck).toBe("function");
  });
});
