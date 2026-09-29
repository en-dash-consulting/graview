# Tech N9ne's discography, from MusicBrainz

`src/data/seed.json` is Tech N9ne's real catalogue, built from
[MusicBrainz](https://musicbrainz.org) (core data CC0), fetched 2026-09-29:

- every release group credited to him (albums, EPs, compilations, mixtapes,
  singles, remixes), one representative release each — the earliest official,
  US or worldwide first — with its tracklist;
- every release by somebody else with a track that credits him (his features
  and collaborations), with only those tracks;
- who a song is BY and who it FEATURES from the track's artist credit (a
  credit after "feat.", "ft.", "featuring" or "with" is a feature), merged
  across every release the song is on;
- producers where MusicBrainz records a producer relationship on the recording;
- a song's track number is its place on its home release: the first album,
  EP or mixtape it is on (earliest full date), or the first release of any
  kind for a song on none — a single that leads an album is numbered where it
  sits on the album;
- eras are the series the titles themselves name (Collabos, K.O.D.,
  ENTERFEAR, N9NA, Anghellic). Themes are left empty: no source says what a
  song is about, and none is invented. Explicit is left unset for the same
  reason.

Rebuild:

```sh
cd scripts/musicbrainz
MB_CONTACT="you@example.com" python3 -c "import json; from mb import get; A='dde3d9b1-0e44-48bc-b0c9-d739b3570000'; rgs=[]; off=0
while True:
    d=get(f'https://musicbrainz.org/ws/2/release-group?artist={A}&fmt=json&limit=100&offset={off}'); rgs+=d['release-groups']; off+=100
    if off>=d['release-group-count']: break
json.dump(rgs,open('release-groups.json','w'))"
MB_CONTACT="you@example.com" python3 fetch_own.py
MB_CONTACT="you@example.com" python3 fetch_guest.py
python3 build.py && cp seed.json ../../src/data/seed.json
```

The fetch keeps a `cache/` of every response and waits a second between
requests, as MusicBrainz asks. It takes about twenty minutes cold.
