import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, fieldInPassing, nameInPassing, Store, type AnySchema } from "../../src/index.js";

/**
 * A CHANGE NAMES A FIELD BY ITS LABEL, OR ITS ID IN WORDS — never half
 * lower-cased. Setting `appleMusic` on an app that labels it "Apple Music"
 * read "Changed the apple Music of …": the label's first letter was
 * lowered and the rest kept. A field is named by its declared label as
 * written when that is a name ("Apple Music", "YouTube"), lowered only when
 * it reads as words ("Release date" → "release date"); a field with no
 * label by its id in words, as a sentence says them ("apple music",
 * "source URL").
 */
const album = defineNode("album", {
  fields: z.object({ label: z.string(), appleMusic: z.string().optional(), youtube: z.string().optional(), sourceUrl: z.string().optional(), spotify: z.string().optional(), tiktok: z.string().optional(), releaseDate: z.string().optional() }),
  display: { labels: { spotify: "Spotify", tiktok: "TikTok", releaseDate: "Release date" } },
});
const schema = createSchema([album]);
const definition = schema.tryDefinition("album");

describe("a field named in passing", () => {
  it("is its id in words when it has no label, its acronyms kept", () => {
    expect(fieldInPassing(definition, "appleMusic")).toBe("apple music");
    expect(fieldInPassing(definition, "youtube")).toBe("youtube");
    expect(fieldInPassing(definition, "sourceUrl")).toBe("source URL");
    expect(fieldInPassing(definition, "label")).toBe("name");
  });

  it("is its declared label as written when that is a name, lowered when it reads as words", () => {
    expect(fieldInPassing(definition, "spotify")).toBe("spotify");
    expect(fieldInPassing(definition, "tiktok")).toBe("TikTok");
    expect(fieldInPassing(definition, "releaseDate")).toBe("release date");
    expect(nameInPassing("Apple Music")).toBe("Apple Music");
    expect(nameInPassing("Due date")).toBe("due date");
    expect(nameInPassing("URL")).toBe("URL");
  });
});

describe("a change's summary", () => {
  const storeOf = (labels?: Record<string, string>) =>
    new Store<AnySchema>({
      schema: createSchema([defineNode("album", { fields: album.fields, ...(labels ? { display: { labels } } : {}) })]),
      snapshot: { nodes: [{ id: "album:one", kind: "album", label: "Blue" }], edges: [] } as never,
    });

  it("names a camelCase field with no label in words, never half lower-cased", () => {
    const store = storeOf();
    const made = store.apply({ name: "edit-album", args: { id: "album:one", appleMusic: "https://music.apple.com/x", youtube: "https://youtu.be/x" } });
    expect(made.ops[0]!.intent).toBe("Changed the apple music of Blue to “https://music.apple.com/x” and the youtube to “https://youtu.be/x”");
  });

  it("names a field by the label the app declares", () => {
    const store = storeOf({ appleMusic: "Apple Music", youtube: "YouTube" });
    const made = store.apply({ name: "edit-album", args: { id: "album:one", appleMusic: "https://music.apple.com/x", youtube: "https://youtu.be/x" } });
    expect(made.ops[0]!.intent).toBe("Changed the Apple Music of Blue to “https://music.apple.com/x” and the YouTube to “https://youtu.be/x”");
  });
});
