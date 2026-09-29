import json, re, unicodedata
from collections import defaultdict, Counter
TECH="dde3d9b1-0e44-48bc-b0c9-d739b3570000"
own=json.load(open("own.json")); guest=json.load(open("guest.json"))

def fold(text):
    t=unicodedata.normalize("NFD",text); t="".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+","-",t.lower()).strip("-") or "x"
FEAT=re.compile(r"\b(feat\.?|ft\.?|featuring|with)\b",re.I)
def split_credit(credit):
    primary,featured=[],[]; into=primary
    for c in credit:
        into.append(c["artist"])
        if FEAT.search(c.get("joinphrase","")): into=featured
    return primary,featured
VERSION=re.compile(r"\s*[\(\[](radio edit|clean|clean version|explicit|dirty|album version|single version|main version|edit|remaster(ed)?( \d{4})?|original version)[\)\]]\s*$",re.I)
SKIP=re.compile(r"\b(instrumental|a ?cappella|acapella)\b",re.I)
GENERIC=re.compile(r"^(intro|outro|interlude|skit|prelude)\b",re.I)
TYPE=lambda g:("mixtape" if "Mixtape/Street" in g.get("secondary-types",[]) else "compilation" if "Compilation" in g.get("secondary-types",[]) else {"Album":"album","EP":"ep","Single":"single"}.get(g.get("primary-type"),"album"))
DAY=re.compile(r"^\d{4}-\d{2}-\d{2}$")

artists={}; songs={}; albums={}; edges=set(); song_key={}; positions={}
def artist(a):
    aid="artist:"+fold(a["name"]) 
    if aid in artists and artists[aid]["mbid"]!=a["id"]: aid+="-"+a["id"][:4]
    for k,v in artists.items():
        if v["mbid"]==a["id"]: return k
    artists[aid]={"id":aid,"kind":"artist","label":a["name"][:200],"mbid":a["id"]}; return aid
def uniq(base,table):
    i=base; n=2
    while i in table: i=f"{base}-{n}"; n+=1
    return i

releases=[(x["group"],x["release"],True) for x in own]+[(r["release-group"],r,False) for r in guest]
releases.sort(key=lambda t:(t[0].get("first-release-date") or "9999"))
for group,rel,mine in releases:
    date=group.get("first-release-date") or ""
    alb=uniq("album:"+fold(group["title"]),albums)
    node={"id":alb,"kind":"album","label":group["title"][:200],"type":TYPE(group)}
    if DAY.match(date): node["released"]=date
    albums[alb]=node
    rp,_=split_credit(rel.get("artist-credit",[]))
    for a in rp: edges.add(("released-by",alb,artist(a)))
    before=0
    for m in rel.get("media",[]):
        offset=before; before+=m.get("track-count",len(m.get("tracks",[])))
        for t in m.get("tracks",[]):
            rec=t["recording"]; credit=t.get("artist-credit") or rec.get("artist-credit",[])
            if not mine and not any(c["artist"]["id"]==TECH for c in credit): continue
            title=t.get("title") or rec["title"]
            if SKIP.search(title): continue
            base=VERSION.sub("",title).strip()
            primary,featured=split_credit(credit)
            ident=rec["id"] if GENERIC.match(base) else (fold(base), tuple(sorted(a["id"] for a in primary)))
            sid=song_key.get(ident) or song_key.get(rec["id"])
            if not sid:
                sid=uniq("song:"+fold(base)[:50],songs)
                s={"id":sid,"kind":"song","label":base[:200],"status":"released"}
                if rec.get("length") and rec["length"]//1000<=3600: s["duration"]=round(rec["length"]/1000)
                songs[sid]=s
            # Every appearance adds its credits: a compilation may credit only the lead,
            # the album the features and the producers.
            for a in primary: edges.add(("by",sid,artist(a)))
            for a in featured: edges.add(("features",sid,artist(a)))
            for r in rec.get("relations",[]):
                if r.get("type")=="producer" and r.get("artist"): edges.add(("produced-by",sid,artist(r["artist"])))
            song_key[ident]=sid; song_key[rec["id"]]=sid
            # Numbered straight through a release: disc two continues where disc one ended.
            pos=t.get("position")
            if isinstance(pos,int) and 1<=offset+pos<=99: positions.setdefault(sid,[]).append((alb,offset+pos))
            edges.add(("tracks",alb,sid))

# A song's number is its place on its HOME release: the first album, EP or mixtape
# it is on, or the first release of any kind when it is on none — the same release
# the app's track rule judges it on. A single that leads an album is track 1 on the
# single and its place on the album, and the album is where a person looks for it.
BODY={"album","ep","mixtape"}
for sid,places in positions.items():
    rank={"album":0,"ep":0,"mixtape":1,"compilation":2,"single":3}
    homes=[ap for ap in places if albums[ap[0]]["type"] in BODY] or places
    home=min(homes,key=lambda ap:(albums[ap[0]].get("released","9999"),rank.get(albums[ap[0]]["type"],2)))
    songs[sid]["track"]=home[1]

# A feature is somebody else: whoever a song is BY is not also featured on it.
by={(f,t) for k,f,t in edges if k=="by"}
edges={e for e in edges if not (e[0]=="features" and (e[1],e[2]) in by)}

# Eras: series the titles themselves name.
SERIES={
 "Collabos":lambda t:t.startswith("Collabos:"),
 "K.O.D.":lambda t:"K.O.D." in t,
 "ENTERFEAR":lambda t:"FEAR" in t.upper() and ("ENTERFEAR" in t.upper() or t.upper() in ("MORE FEAR","FEAR EXODUS")),
 "N9NA":lambda t:t.startswith("N9NA"),
 "Anghellic":lambda t:t.lower().startswith("anghellic"),
}
eras=[]
own_albums={a for a in albums if any(e[0]=="released-by" and e[1]==a and artists[e[2]]["mbid"]==TECH for e in edges)}
for name,test in SERIES.items():
    members=[a for a in own_albums if test(albums[a]["label"])]
    if len(members)<2: continue
    eid="era:"+fold(name)
    eras.append({"id":eid,"kind":"era","label":name,"notes":f"Tech N9ne releases whose titles name the {name} series."})
    for a in members: edges.add(("spans",eid,a))

nodes=[{k:v for k,v in a.items() if k!="mbid"} for a in artists.values()]+list(albums.values())+list(songs.values())+eras
snap={"nodes":nodes,"edges":[{"kind":k,"from":f,"to":t} for k,f,t in sorted(edges)]}
json.dump(snap,open("seed.json","w"),indent=1,ensure_ascii=False)
print(Counter(n["kind"] for n in nodes), len(snap["edges"]), Counter(e["kind"] for e in snap["edges"]))
print("types",Counter(a["type"] for a in albums.values()))
print("longest label",max(len(n["label"]) for n in nodes))
