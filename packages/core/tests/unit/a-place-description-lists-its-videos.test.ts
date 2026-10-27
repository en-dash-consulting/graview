import { describe, expect, it } from "vitest";
import { placeText, type DescribedVideo, type PlaceDescription } from "../../src/describe.js";

/**
 * A PLACE DESCRIPTION LISTS THE VIDEOS A VIEW PLACES (Roadmap f-video-hero).
 *
 * A worker view run headless says each `<graview-video>` it placed with
 * what the browser is handed and whether it will play, so an agent that
 * wrote a hero background can confirm it without opening a browser; the
 * plain text a chat quotes says the same in one line each.
 */
const base: Omit<PlaceDescription, "text" | "videos"> = {
  place: { slug: "reel", title: "Reel", kind: "moment", address: "/places/reel" },
  seat: "an owner",
  width: 1440,
  variant: "wide",
  drawnBy: "view:reel",
  parts: [],
  problems: [],
};

const hero: DescribedVideo = { record: "moment:dusk", field: "clip", text: "The waves at dusk", name: "beach.mov", source: "video/mp4", duration: 45, poster: true, autoplay: true, cover: true, playable: true };
const raw: DescribedVideo = { record: "moment:noon", field: "clip", text: "IMG_4410.MOV", name: "IMG_4410.MOV", source: "video/quicktime", poster: false, autoplay: false, cover: false, playable: false, why: "its source is video/quicktime, which not every browser plays, and it has no poster" };

describe("a place description's videos", () => {
  it("says each in one line: what it shows, where it is, its source, its poster, how it plays and whether it will", () => {
    const text = placeText({ ...base, videos: [hero, raw] });
    expect(text).toContain("Videos:\n- The waves at dusk (clip of moment:dusk): video/mp4, 45 s, with a poster; plays as a background, muted and looping, with no controls, filling its box; playable.");
    expect(text).toContain("- IMG_4410.MOV (clip of moment:noon): video/quicktime, no poster; plays with the browser's controls; not playable: its source is video/quicktime, which not every browser plays, and it has no poster.");
  });

  it("says nothing of videos where a place has none", () => {
    expect(placeText(base)).not.toContain("Videos:");
    expect(placeText({ ...base, videos: [] })).not.toContain("Videos:");
  });
});
