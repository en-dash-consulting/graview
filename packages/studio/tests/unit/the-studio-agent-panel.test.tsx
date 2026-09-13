import { createSchema, defineNode, type GraviewApp } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { StudioAgentPanel, createStudio, studioApp, type Studio } from "../../src/index.js";
import type { StudioSchema } from "../../src/meta.js";

/**
 * The studio agent's standing contract, at render time. The living
 * conversation — ask, read the check, keep, undo — is driven in a real
 * browser by scripts/verify-studio.mjs; what belongs here is what must be
 * true before anybody types.
 */

const note = defineNode("note", {
  fields: z.object({ label: z.string().min(1) }),
  plural: "notes",
  label: (node) => node.label,
});
const app: GraviewApp<ReturnType<typeof createSchema>> = { name: "Notes", schema: createSchema([note]) as never, mutations: [] };

const render = () => {
  const studio = createStudio(app) as unknown as Studio<never>;
  const meta = studioApp();
  return renderToStaticMarkup(
    <GraviewProvider<StudioSchema>
      store={studio.store}
      views={registerDefaultViews(meta.schema, createViews(meta.schema))}
      initialView={EMPTY_VIEW}
    >
      <StudioAgentPanel studio={studio as never} />
    </GraviewProvider>,
  );
};

describe("the studio's agent before anybody types", () => {
  it("is a door, closed, on the studio's own bar", () => {
    const html = render();
    expect(html).toContain('data-testid="studio-agent"');
    expect(html).toContain('aria-expanded="false"');
    // Closed means absent, not hidden.
    expect(html).not.toContain('data-testid="studio-agent-panel"');
  });

  it("says what it is for, in terms of the declaration", () => {
    const html = render();
    expect(html).toContain("Ask for a change to this declaration");
    // And it promises the thing that makes it safe to press.
    expect(html).toContain("keep or discard");
  });
});
