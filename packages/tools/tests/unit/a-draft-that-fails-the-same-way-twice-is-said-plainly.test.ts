import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import { checkSaid, designAgentPrompt, findingKind, runDesignAgent, type DesignAgentEvent, type DesignAgentHost, type DraftChecked } from "../../src/section.js";

/*
 * WHAT A CHECK FOUND IS SAID AS IT IS (Roadmap f-better-ui-draws-first-time):
 * the panel says the finding by what it is — a part no longer drawn is not
 * "it didn't draw" — the host is told each draft's findings whole, with
 * their kind, and a draft that fails the same way twice ends the turn with
 * a plain sentence and a choice, never another "— fixing".
 */
const part = { name: "Vendors", slot: "list" as const, kind: "vendor" };
const manifest = { name: "vendor-list", attach: "vendor", cardinality: "many" as const, replaces: "page" as const };
const NAMES = "graview.onProps((props) => graview.render(graview.html`<p>The Velvet Notes</p>`));";
const GOOD = "graview.onProps((props) => graview.render(graview.html`<p>The Velvet Notes · booked</p>`));";
const LOST = "A record no longer says what it said: “booked” on “The Velvet Notes”. Show on each record what the page showed on it (its status, its dates, its counts), in words.";
const HEADING = "Our wedding vendors: who is booked and who we are still talking to.";

/** A model that answers in turn, the prompts it was given, and what the host was told of each draft. */
function agentOf(answers: readonly object[]): { ai: HostAi; prompts: Record<string, unknown>[]; checked: DraftChecked[] } {
  const prompts: Record<string, unknown>[] = [];
  const checked: DraftChecked[] = [];
  let at = 0;
  const think = async ({ prompt }: { prompt: string }) => {
    prompts.push(JSON.parse(prompt) as Record<string, unknown>);
    return { text: JSON.stringify(answers[Math.min(at++, answers.length - 1)]) };
  };
  return { ai: { thinking: { model: "full", think }, onDraftChecked: (one: DraftChecked) => checked.push(one) } as unknown as HostAi, prompts, checked };
}

const host = (draft?: DesignAgentHost["draft"]): DesignAgentHost => ({
  look: () => ({ records: [{ record: "The Velvet Notes", says: ["booked"] }] }),
  read: () => ({ count: 1 }),
  draft: draft ?? (async (source) => ({ findings: source.includes("booked") ? [] : [LOST], drew: undefined })),
});

describe("what a draft's check found", () => {
  it("is said by what it is: a part no longer drawn is never “it didn't draw”, and what has no name of its own is said in its own words", () => {
    expect(findingKind(LOST)).toBe("fact-lost");
    expect(findingKind(`“${HEADING}” is not drawn any more.`)).toBe("section-lost");
    expect(findingKind("The view did not draw: It did not draw in 8 seconds.")).toBe("did-not-draw");
    expect(checkSaid([`“${HEADING}” is not drawn any more.`], "vendors")).toBe(`the part “${HEADING}” missing`);
    expect(checkSaid(["The view did not draw: It did not draw in 8 seconds."], "vendors")).toBe("it didn't draw");
    const own = checkSaid(["The draft could not be judged: the page went away."], "vendors");
    expect(own).toBe("The draft could not be judged: the page went away");
    expect(own).not.toMatch(/something didn't draw/);
  });

  it("goes to the host whole, with its kind, for every draft judged — and to the panel with the step", async () => {
    const { ai, checked } = agentOf([
      { say: "Names alone", do: "draft", source: NAMES },
      { say: "Each vendor with its status.", do: "draft", source: GOOD },
    ]);
    const events: DesignAgentEvent[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "simpler" }], host: host(), onEvent: (one) => events.push(one), noun: "vendors" });
    expect(result).toMatchObject({ ended: "done", passed: { source: GOOD } });
    expect(checked).toEqual([
      { part: "Vendors", draft: 1, passed: false, findings: [{ kind: "fact-lost", words: LOST }] },
      { part: "Vendors", draft: 2, passed: true, findings: [] },
    ]);
    expect(events.find((one) => one.kind === "check")).toMatchObject({ text: "Check: details lost on one of the vendors — fixing", findings: [{ kind: "fact-lost", words: LOST }] });
  });

  it("hands the agent what went wrong where judging a draft threw, never a generic failure", async () => {
    const { ai, prompts } = agentOf([
      { say: "Cards", do: "draft", source: GOOD },
      { say: "I stop.", do: "ask" },
    ]);
    await runDesignAgent({
      ai,
      part,
      manifest,
      talk: [{ who: "person", said: "cards" }],
      host: host(async () => {
        throw new Error("the page went away");
      }),
    });
    const told = (prompts[1]!["your_steps"] as { did: string; result?: { findings?: string[] } }[]).find((one) => one.did === "draft");
    expect(told?.result?.findings).toEqual(["The draft could not be judged: the page went away."]);
  });

  it("ends the turn after two drafts fail the same way: said in a plain sentence, the last draft there to keep anyway", async () => {
    const { ai, prompts } = agentOf([
      { say: "Names alone", do: "draft", source: NAMES },
      { say: "Names, bigger", do: "draft", source: NAMES.replace("<p>", "<p class=big>") },
      { say: "Never asked", do: "draft", source: GOOD },
    ]);
    const events: DesignAgentEvent[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "simpler" }], host: host(), onEvent: (one) => events.push(one), noun: "vendors" });
    expect(prompts).toHaveLength(2);
    expect(result.ended).toBe("stuck");
    expect(result.said).toBe("I tried twice, and the new design still loses details on one of the vendors. Keep it anyway, or stop?");
    expect(result.last).toEqual({ source: NAMES.replace("<p>", "<p class=big>"), findings: [LOST] });
    expect(result.keepable).toBe(true);
    expect(events.at(-1)).toMatchObject({ kind: "stuck", text: "Check: details lost on one of the vendors, again", findings: [{ kind: "fact-lost", words: LOST }] });
    expect(events.filter((one) => one.kind === "check")).toHaveLength(1);
  });

  it("does not offer to keep a draft that never drew", async () => {
    const { ai } = agentOf([{ say: "Cards", do: "draft", source: NAMES }]);
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "cards" }], host: host(async () => ({ findings: ["The view did not draw: It threw."], drew: undefined })) });
    expect(result).toMatchObject({ ended: "stuck", keepable: false });
    expect(result.said).toBe("I tried twice, and the new design still doesn't draw. Say it another way, or stop?");
  });

  it("is told it may reword the headings of the part being changed only, where the person asked", () => {
    const prompt = JSON.parse(
      designAgentPrompt({ part: { name: HEADING, slot: "place" }, manifest, talk: [{ who: "person", said: "reword the top heading so it is shorter" }], keep: { title: "", headings: [HEADING, "Where we are", "Booked"], records: [] }, section: HEADING, rewordable: [HEADING] }, []),
    ) as Record<string, unknown>;
    expect(prompt["keep_these_headings"]).toEqual(["Where we are", "Booked"]);
    expect(String(prompt["you_may_reword"])).toContain(`“${HEADING}”`);
  });
});
