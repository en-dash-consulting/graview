import { describe, expect, it } from "vitest";
import * as answer from "../../src/answer.js";
import * as arrange from "../../src/arrange.js";
import * as blocks from "../../src/blocks.js";
import * as check from "../../src/check.js";
import * as describePlaces from "../../src/describe.js";
import * as document from "../../src/document/index.js";
import * as figures from "../../src/figures.js";
import * as forms from "../../src/forms.js";
import * as jsonSchema from "../../src/json-schema.js";
import * as main from "../../src/index.js";
import * as scene from "../../src/scene.js";

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
  "@graview/core/answer": { from: answer, names: ["answerSeenBy", "answersJudgedWith"] },
  "@graview/core/arrange": { from: arrange, names: ["admitArrangement", "arrange", "arrangeable", "arrangeAllows", "asksForThePast", "bucketStart", "conditionHolds", "edgesOf", "formatArrangement", "matches", "NO_ARRANGEMENT", "parseArrangement"] },
  "@graview/core/blocks": { from: blocks, names: ["compileBlocks", "fieldSpecsOf", "isTallBlock", "resolveBlocks", "safeHref", "sayNumber", "whatBlocksSay", "computedNames", "computedValues", "withComputed", "factNames", "factValues", "blockContextFor", "CARD_BUDGET", "PAGE_BUDGET", "fieldSpecOf", "fileFieldsOf", "fileWords", "firstPicture"] },
  "@graview/core/forms": { from: forms, names: ["formArgs", "formComplete", "formField", "formFields", "undecidableArguments"] },
  "@graview/core/describe": { from: describePlaces, names: ["columnActs", "columnMoves", "columnOf", "columnReach", "columnSteps", "describePlace", "placeText", "resolveFor", "statusColumns"] },
  "@graview/core/check": { from: check, names: ["checkApp", "formatFindings", "compileDocument", "instantiateTemplate", "describeApp", "generateAgentsMd", "generateLlmsTxt"] },
  "@graview/core/scene": { from: scene, names: ["BLOCK", "cityExtent", "cityMap", "heightOf", "MAX_SIDE", "plotsOverlap", "roadsOf", "sharedEdges", "sideFor", "toIso", "villageCap", "villageOf", "sceneDistricts", "sceneThumbnail"] },
  "@graview/core/figures": { from: figures, names: ["FIGURES", "FIGURE_NAMES", "figureBrief", "figureFaults", "figureSvg"] },
  "@graview/core/json-schema": { from: jsonSchema, names: ["mutationToolSchema", "nodeJsonSchema", "schemaJson", "toJsonSchema"] },
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
