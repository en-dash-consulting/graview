import json
from mb import get
A="dde3d9b1-0e44-48bc-b0c9-d739b3570000"
rels=[]; off=0
while True:
    d=get(f"https://musicbrainz.org/ws/2/release?track_artist={A}&fmt=json&limit=100&offset={off}&inc=release-groups+artist-credits")
    rels+=d["releases"]; off+=100
    if off>=d["release-count"]: break
own={x["group"]["id"] for x in json.load(open("own.json"))}
by_group={}
for r in rels:
    g=r["release-group"]
    if g["id"] in own: continue
    if r.get("status") not in (None,"Official"): continue
    cur=by_group.get(g["id"])
    k=lambda r:((r.get("date") or "9999")[:4], {"US":0,"XW":1}.get(r.get("country"),2))
    if cur is None or k(r)<k(cur): by_group[g["id"]]=r
out=[]
for gid,r in by_group.items():
    full=get(f"https://musicbrainz.org/ws/2/release/{r['id']}?fmt=json&inc=recordings+artist-credits+recording-level-rels+artist-rels+release-groups")
    out.append(full)
json.dump(out,open("guest.json","w"))
hits=sum(1 for r in out for m in r.get("media",[]) for t in m.get("tracks",[]) if any(c.get("artist",{}).get("id")==A for c in (t.get("artist-credit") or t["recording"].get("artist-credit",[]))))
print(len(rels), "releases;", len(out), "release groups not his own;", hits, "tracks with him on them")
