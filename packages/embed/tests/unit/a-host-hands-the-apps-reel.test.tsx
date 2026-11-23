import { createSchema, defineNode, Store, z, type AnySchema, type AppVideo } from "@graview/core";
import { createViews, GraviewProvider, useHostReel } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { providerProps } from "../../src/frame.js";
import type { EmbedOptions } from "../../src/index.js";

/**
 * A HOST HANDS THE APP'S REEL (HQ f-view-names-app-video).
 *
 * The reel a host keeps for the whole app is handed once — `reel` on
 * `mount` or `<Embed>`, or on `GraviewProvider` — and reaches every worker
 * view drawn under it (`useHostReel`), which plays it where the view places
 * `<graview-video data-app="reel">`.
 */
const reel: AppVideo = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", duration: 30, playable: true };
const moment = defineNode("moment", { fields: z.object({ label: z.string() }), plural: "Moments" });
const store = () => new Store<AnySchema>({ schema: createSchema([moment]) as AnySchema, mutations: [] });

function Said() {
  const handed = useHostReel();
  return <p>{handed ? `${handed.href} ${handed.duration} s` : "no reel"}</p>;
}

describe("the app's reel, as a host hands it", () => {
  it("is carried from mount and <Embed> to the provider", () => {
    expect(providerProps({ reel } as unknown as EmbedOptions, undefined, undefined).reel).toBe(reel);
    expect(providerProps({} as unknown as EmbedOptions, undefined, undefined).reel).toBeUndefined();
  });

  it("reaches what is drawn under the provider, and is absent where none was handed", () => {
    const drawn = (handed?: AppVideo) =>
      renderToStaticMarkup(
        <GraviewProvider store={store()} views={createViews()} {...(handed ? { reel: handed } : {})}>
          <Said />
        </GraviewProvider>,
      );
    expect(drawn(reel)).toContain("/graview/files/reel.mp4 30 s");
    expect(drawn()).toContain("no reel");
  });
});
