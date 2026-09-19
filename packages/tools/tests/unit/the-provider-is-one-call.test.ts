import { describe, expect, it } from "vitest";
import { JevError, jevCostUsd, jevDecide, jevKeyFromEnvironment, type Question } from "../../src/index.js";

/**
 * THE PROVIDER ITSELF: one call, many questions, honest about failure.
 *
 * One request carries a map of questions; a busy service is retried with
 * backoff; a refused key is the seat's problem and a malformed question is
 * ours, each said in those words; and the key travels in one header and
 * appears in no error.
 */
const KEY = "ts-live-secret-key-0123456789";
const questions: Record<string, Question> = {
  surface: { type: "choice", instructions: "Which surface?", criteria: { turf: null, bed: null } },
  shaded: { type: "noul", instructions: "Shaded?" },
  effort: { type: "score", instructions: "How much effort?", criteria: ["least", "some", "most"] },
};
const answered = JSON.stringify({
  model: "jev-1.13.0",
  answers: {
    surface: { type: "choice", choice: "turf", confidence: 1, probabilities: { turf: 1, bed: 0 } },
    shaded: { type: "noul", noul: 0.05 },
    effort: { type: "score", score: 0.35, confidence: 0.47, probabilities: { "0": 0.66, "1": 0.33, "2": 0.01 }, legend: { "0": "least", "1": "some", "2": "most" } },
  },
  usage: { input_tokens: 406, output_tokens: 72 },
});

type Seen = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
const answering = (statuses: readonly number[], body = answered) => {
  const seen: Seen[] = [];
  let n = 0;
  const fetch = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    seen.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const status = statuses[Math.min(n, statuses.length - 1)]!;
    n += 1;
    return { ok: status < 400, status, text: async () => (status < 400 ? body : `{"error":"status ${status}"}`) };
  };
  return { seen, fetch };
};
const noSleep = { sleep: async () => {} };

describe("one call carries a map of questions", () => {
  it("posts the state and every question once, with the key in one header, and returns typed answers under the same keys", async () => {
    const { seen, fetch } = answering([200]);
    const decide = jevDecide({ apiKey: KEY, fetch, ...noSleep });
    const decided = await decide({ label: "Back Lawn" }, questions);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(seen[0]!.headers["authorization"]).toBe(`Bearer ${KEY}`);
    expect(seen[0]!.body).toMatchObject({ model: "jev-latest", state: { label: "Back Lawn" } });
    expect(Object.keys(seen[0]!.body["questions"] as object)).toEqual(["surface", "shaded", "effort"]);
    expect(decided.answers["surface"]).toMatchObject({ type: "choice", choice: "turf", confidence: 1 });
    expect(decided.answers["shaded"]).toEqual({ type: "noul", noul: 0.05 });
    expect(decided.answers["effort"]).toMatchObject({ type: "score", score: 0.35 });
    expect(decided.usage).toEqual({ inputTokens: 406, outputTokens: 72 });
  });

  it("asks nothing when there is nothing to ask, and meters what it does ask", async () => {
    const { seen, fetch } = answering([200]);
    const totals: number[] = [];
    const decide = jevDecide({ apiKey: KEY, fetch, ...noSleep, onUsage: (usage) => totals.push(usage.questions) });
    await decide({}, {});
    expect(seen).toHaveLength(0);
    await decide({}, questions);
    await decide({}, questions);
    expect(totals).toEqual([3, 6]);
    expect(jevCostUsd(1_000_000)).toBeCloseTo(0.042);
  });

  it("goes to a bridge with no key when told to, so a browser never holds one", async () => {
    const { seen, fetch } = answering([200]);
    await jevDecide({ baseUrl: "/__graview/decide", fetch, ...noSleep })({}, questions);
    expect(seen[0]!.url).toBe("/__graview/decide");
    expect(seen[0]!.headers["authorization"]).toBeUndefined();
  });
});

describe("whose failure it is", () => {
  it("retries a busy service with backoff and then answers", async () => {
    const { seen, fetch } = answering([429, 529, 200]);
    const waited: number[] = [];
    const decide = jevDecide({ apiKey: KEY, fetch, sleep: async (ms) => void waited.push(ms) });
    const decided = await decide({}, questions);
    expect(seen).toHaveLength(3);
    expect(waited).toEqual([400, 800]);
    expect(decided.answers["shaded"]).toEqual({ type: "noul", noul: 0.05 });
  });

  it("gives up on a service that stays busy, and says so", async () => {
    const { fetch } = answering([529]);
    await expect(jevDecide({ apiKey: KEY, fetch, retries: 2, ...noSleep })({}, questions)).rejects.toMatchObject({
      name: "JevError",
      failure: "busy",
      status: 529,
    });
  });

  it("reads a refused key as the seat's problem, and a malformed question as ours", async () => {
    const seat = await jevDecide({ apiKey: KEY, fetch: answering([401]).fetch, ...noSleep })({}, questions).catch((e: JevError) => e);
    expect(seat).toMatchObject({ failure: "seat" });
    expect(seat.message).toContain("seat problem");
    expect(seat.message).toContain("not the model's");
    const ours = await jevDecide({ apiKey: KEY, fetch: answering([422]).fetch, ...noSleep })({}, questions).catch((e: JevError) => e);
    expect(ours).toMatchObject({ failure: "ours", status: 422 });
    expect(ours.message).toContain("our bug");
  });

  it("never lets the key into an error", async () => {
    for (const status of [401, 422, 500, 529]) {
      const error = await jevDecide({ apiKey: KEY, fetch: answering([status]).fetch, retries: 0, ...noSleep })({}, questions).catch((e: Error) => e);
      expect(String(error)).not.toContain(KEY);
      expect(JSON.stringify(error)).not.toContain(KEY);
    }
  });

  it("refuses an answer that is not typed, or is missing, rather than guessing", async () => {
    const short = JSON.stringify({ answers: { surface: { type: "choice", choice: "turf", confidence: 1, probabilities: {} } }, usage: {} });
    await expect(jevDecide({ apiKey: KEY, fetch: answering([200], short).fetch, ...noSleep })({}, questions)).rejects.toMatchObject({ failure: "shape" });
    await expect(jevDecide({ apiKey: KEY, fetch: answering([200], "<html>").fetch, ...noSleep })({}, questions)).rejects.toMatchObject({ failure: "shape" });
  });
});

describe("the key", () => {
  it("is read from the environment under the documented name, then the older one, and never from nowhere", () => {
    expect(jevKeyFromEnvironment({ TYPESAFE_API_KEY: "a", JEV_API_KEY: "b" })).toBe("a");
    expect(jevKeyFromEnvironment({ JEV_API_KEY: "b" })).toBe("b");
    expect(jevKeyFromEnvironment({ TYPESAFE_API_KEY: "" })).toBeUndefined();
    expect(jevKeyFromEnvironment(undefined)).toBeUndefined();
  });
});
