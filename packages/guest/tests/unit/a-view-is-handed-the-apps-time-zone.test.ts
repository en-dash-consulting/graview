import { sayIn, Store, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { ana, jobsApp, jobsSeed } from "../../../../scripts/fixtures/jobs-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";

/*
 * A VIEW IS HANDED THE APP'S TIME ZONE (Roadmap f-app-time-zone). A view
 * on Graview Cloud hard-coded America/New_York to say a visit's time,
 * because its props carried an instant and nothing about the clock the
 * rest of the app says it on. Every push now carries `locale` and
 * `timeZone`: the person's a host passed, else the app's, else the
 * runtime's — so a view formats with `Intl` and agrees with the record's
 * page.
 */
afterEach(() => sayIn({}));
const store = () => new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
const board: WorkerViewManifest = { name: "job-board", title: "Jobs", attach: "job", cardinality: "many" };

describe("a worker view's props", () => {
  it("carry the app's time zone and locale", () => {
    sayIn({ app: "en-GB", appTimeZone: "Asia/Tokyo" });
    const props = workerViewProps(store(), ana, { manifest: board });
    expect(props.timeZone).toBe("Asia/Tokyo");
    expect(props.locale).toBe("en-GB");
  });

  it("carry the person's zone where a host passed one", () => {
    sayIn({ appTimeZone: "Asia/Tokyo", readerTimeZone: "Europe/London" });
    expect(workerViewProps(store(), ana, { manifest: board }).timeZone).toBe("Europe/London");
  });

  it("carry the runtime's clock by name when nobody said one", () => {
    expect(workerViewProps(store(), ana, { manifest: board })).toMatchObject({ locale: "en-US", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
});
