import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import { checkSaid, readAgentReply, runDesignAgent, writingSaid, type DesignAgentEvent, type DesignAgentHost } from "../../src/section.js";

/*
 * BETTER UI AS A CONVERSATION (Roadmap f-make-any-page-better): Graview's
 * agent looks at the page, drafts, is told what the checks found and what
 * it drew, and drafts again until it passes — the checks are what it is
 * told, never a refusal to the person — and says each step for the panel.
 */
const part = { name: "Tasks", slot: "list" as const, kind: "task" };
const manifest = { name: "task-list", attach: "task", cardinality: "many" as const, replaces: "page" as const };
const GOOD = "graview.onProps((props) => graview.render(graview.html`<p>Write the brief · Todo · Sep 3</p>`));";
const TITLES = "graview.onProps((props) => graview.render(graview.html`<p>Write the brief</p>`));";
const LOST = "A record no longer says what it said: “Todo” on “Write the brief”, “Sep 3” on “Write the brief”. Show on each record what the page showed on it (its status, its dates, its counts), in words.";

/** A full model that answers in turn, and the prompts it was given. */
function agentOf(answers: readonly object[]): { ai: HostAi; prompts: Record<string, unknown>[] } {
  const prompts: Record<string, unknown>[] = [];
  let at = 0;
  const think = async ({ prompt }: { prompt: string }) => {
    prompts.push(JSON.parse(prompt) as Record<string, unknown>);
    return { text: JSON.stringify(answers[Math.min(at++, answers.length - 1)]) };
  };
  return { ai: { thinking: { model: "full", think } } as unknown as HostAi, prompts };
}

/** A page that judges a draft by whether it still says the status. */
const host = (drawn: string[] = []): DesignAgentHost => ({
  look: () => ({ records: [{ record: "Write the brief", says: ["Todo", "Sep 3"] }] }),
  read: () => ({ count: 1 }),
  draft: async (source) => {
    drawn.push(source);
    return { findings: source.includes("Todo") ? [] : [LOST], drew: { records: [{ record: "Write the brief" }] } };
  },
});

describe("Graview's agent", () => {
  it("is shown the page, drafts, is told what the checks found, drafts again, and ends its turn on the draft that passed — each step said", async () => {
    const { ai, prompts } = agentOf([
      { say: "Cards with their names", do: "draft", source: TITLES },
      { say: "Tasks are cards now, each with its status and date.", do: "draft", source: GOOD },
    ]);
    const events: DesignAgentEvent[] = [];
    const drawn: string[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "make them cards" }], host: host(drawn), onEvent: (one) => events.push(one), noun: "tasks" });
    expect(result).toMatchObject({ ended: "done", said: "Tasks are cards now, each with its status and date.", passed: { source: GOOD } });
    expect(drawn).toEqual([TITLES, GOOD]);
    // What the checks found went back to it as the result of its draft.
    expect(prompts[0]).toMatchObject({ what_the_page_draws: { records: [{ record: "Write the brief" }] }, records_it_is_handed: { count: 1 } });
    const told = (prompts[1]!["your_steps"] as { did: string; result?: { findings?: string[] } }[]).find((one) => one.did === "draft");
    expect(told?.result?.findings).toEqual([LOST]);
    expect(prompts).toHaveLength(2);
    expect(events.map((one) => one.text)).toEqual(["Looking at Tasks", "Drafting: Cards with their names", "Check: dates lost on one of the tasks — fixing", "Drafting: Tasks are cards now, each with its status and date", "Check: nothing lost — it's on the page"]);
    expect(result.stages.every((one) => one.stage === "thinking")).toBe(true);
  });

  it("is not done until a draft passed: told so, it fixes it", async () => {
    const { ai, prompts } = agentOf([
      { say: "Cards", do: "draft", source: TITLES },
      { say: "Done.", do: "done" },
      { say: "Now it keeps the status.", do: "draft", source: GOOD },
    ]);
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "cards" }], host: host() });
    expect(result).toMatchObject({ ended: "done", said: "Now it keeps the status.", passed: { source: GOOD } });
    expect(JSON.stringify(prompts[2]!["your_steps"])).toContain("No draft has passed the checks yet");
  });

  it("asks the person where it must, and stops the moment it is told to", async () => {
    const asking = agentOf([{ say: "Should the dates go?", do: "ask" }]);
    expect(await runDesignAgent({ ai: asking.ai, part, manifest, talk: [{ who: "person", said: "simpler" }], host: host() })).toMatchObject({ ended: "ask", said: "Should the dates go?" });
    const never = { thinking: { model: "full", think: () => new Promise(() => undefined) } } as unknown as HostAi;
    const stop = new AbortController();
    const running = runDesignAgent({ ai: never, part, manifest, talk: [{ who: "person", said: "cards" }], host: host(), signal: stop.signal });
    stop.abort();
    expect(await running).toMatchObject({ ended: "stopped" });
  });

  it("changes the draft on the page when the person asks again, and only the part named in a view", async () => {
    const { ai, prompts } = agentOf([{ say: "The dates are smaller now.", do: "draft", source: GOOD }]);
    await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "cards" }, { who: "graview", said: "Done." }, { who: "person", said: "make the dates smaller" }], current: GOOD, section: "This week", host: host() });
    expect(prompts[0]).toMatchObject({ your_draft_on_the_page: GOOD, conversation: [{ person: "cards" }, { you: "Done." }, { person: "make the dates smaller" }] });
    expect(String(prompts[0]!["only_change"])).toContain("“This week”");
  });

  it("asks the design slot first, and shows its words as it writes them where it streams", async () => {
    const answer = JSON.stringify({ say: "Tasks are cards now.", do: "draft", source: GOOD });
    const asked: string[] = [];
    const ai = {
      thinking: { model: "full", think: async () => (asked.push("full"), { text: answer }) },
      design: {
        model: "design",
        think: async () => (asked.push("design"), { text: answer }),
        stream: async (_request: unknown, onText: (soFar: string) => void) => {
          asked.push("design-stream");
          onText(answer.slice(0, 26));
          onText(answer);
          return { text: answer };
        },
      },
    } as unknown as HostAi;
    const events: DesignAgentEvent[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk: [{ who: "person", said: "cards" }], host: host(), onEvent: (one) => events.push(one) });
    expect(asked).toEqual(["design-stream"]);
    expect(result).toMatchObject({ ended: "done", passed: { source: GOOD } });
    expect(events.filter((one) => one.kind === "streaming").map((one) => one.text)).toEqual(["Tasks are cards no", "Tasks are cards now."]);
    expect(writingSaid('{"say": "Cards side by side.", "do": "draft", "source": "graview.style(`a`);\\ngraview.onProps(')).toBe("Cards side by side — writing it, 2 lines so far");
    expect(writingSaid('{"so')).toBe("Thinking…");
  });

  it("reads an answer as one step, and says what the checks found in a few plain words", () => {
    expect(readAgentReply('Sure. {"say": "Looking", "do": "look"}')).toEqual({ say: "Looking", do: "look" });
    expect(readAgentReply('{"say": "x", "do": "fly"}')).toBeUndefined();
    expect(checkSaid(["It no longer shows “A”, “B”: show every record the page showed."], "tasks")).toBe("2 tasks missing");
    expect(checkSaid(["A record moved to another group: “A” is under “X”, and was under “Y”. Keep each record under the heading it was under."], "tasks")).toBe("tasks in the wrong group");
  });
});
