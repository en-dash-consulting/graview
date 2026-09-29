import json
from mb import get
rgs=json.load(open("release-groups.json"))
def pick(rgid):
    d=get(f"https://musicbrainz.org/ws/2/release?release-group={rgid}&status=official&fmt=json&limit=100&inc=media")
    rel=d["releases"] or get(f"https://musicbrainz.org/ws/2/release?release-group={rgid}&fmt=json&limit=100&inc=media")["releases"]
    if not rel: return None
    def key(r):
        date=r.get("date") or "9999"
        n=sum(m.get("track-count",0) for m in r.get("media",[]))
        country={"US":0,"XW":1}.get(r.get("country"),2)
        return (date[:4], country, -n, date)
    return sorted(rel,key=key)[0]["id"]
out=[]
for g in rgs:
    rid=pick(g["id"])
    if not rid: continue
    r=get(f"https://musicbrainz.org/ws/2/release/{rid}?fmt=json&inc=recordings+artist-credits+recording-level-rels+artist-rels+release-groups")
    out.append({"group":g,"release":r})
json.dump(out,open("own.json","w"))
print(len(out), sum(len(t) for x in out for t in [[tr for m in x["release"].get("media",[]) for tr in m.get("tracks",[])]]))
